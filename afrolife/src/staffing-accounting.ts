import { Router, type Request, type Response, type RequestHandler } from 'express';
import { z } from 'zod';
import { withUser, requireRole, HttpError } from './core.js';
import { audit, post } from './domain.js';
import { enqueueAccountingEvent } from './accounting-outbox.js';

const h=(fn:(req:Request,res:Response)=>Promise<unknown>):RequestHandler=>(req,res,next)=>{fn(req,res).catch(next);};
const finance=['finance','finance_manager','super_admin','global_admin'] as const;
const reviewers=['finance_manager','super_admin','global_admin'] as const;
const amount=(n:number)=>{const cents=Math.round(n*100);if(!Number.isSafeInteger(cents)||cents<=0||Math.abs(n*100-cents)>1e-7)throw new HttpError(422,'Amounts must be positive and limited to two decimal places');return (cents/100).toFixed(2);};
const money=(x:unknown)=>Number(x).toFixed(2);
const event=(c:Parameters<typeof enqueueAccountingEvent>[0],input:Parameters<typeof enqueueAccountingEvent>[1])=>enqueueAccountingEvent(c,input);

/** Staffing financial controls. An accepted match is only the sourcing decision; this workflow records terms, accepted work, receivables and worker settlement separately. */
export const staffingAccounting=Router();

staffingAccounting.post('/staffing-engagements',requireRole('master_agent','field_agent','finance','finance_manager','super_admin','global_admin'),h(async(req,res)=>{
  const b=z.object({match_id:z.string().uuid(),worker_type:z.enum(['full_time_employee','part_time_employee','hourly_professional','contracted_service_provider']),billing_unit:z.enum(['hour','day','week','month','fixed']),client_rate:z.number().positive().finite(),worker_rate:z.number().positive().finite(),starts_on:z.string().date(),ends_on:z.string().date().optional()}).strict().parse(req.body);
  const clientRate=amount(b.client_rate),workerRate=amount(b.worker_rate);if(Number(workerRate)>Number(clientRate))throw new HttpError(422,'Worker pay rate cannot exceed the agreed client bill rate');if(b.ends_on&&b.ends_on<b.starts_on)throw new HttpError(422,'Engagement end date must be on or after its start date');
  const row=await withUser(req.user!,async c=>{
    const match=(await c.query(`SELECT m.id AS match_id,m.request_id,m.worker_id,m.status AS match_status,r.lead_id,r.source_agent_id
      FROM matches m JOIN job_requests r ON r.id=m.request_id WHERE m.id=$1`,[b.match_id])).rows[0];
    if(!match)throw new HttpError(404,'Staffing match not found');if(match.match_status!=='accepted')throw new HttpError(409,'Only an accepted Staffing match can become an engagement');
    const worker=(await c.query('SELECT employment_status FROM workers WHERE id=$1 FOR UPDATE',[match.worker_id])).rows[0];
    if(!worker||worker.employment_status!=='active')throw new HttpError(409,'A terminated worker cannot be assigned to a new engagement');
    const e=(await c.query(`INSERT INTO staffing_engagements(match_id,request_id,worker_id,client_lead_id,source_agent_id,worker_type,billing_unit,client_rate,worker_rate,starts_on,ends_on,recorded_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,[match.match_id,match.request_id,match.worker_id,match.lead_id,match.source_agent_id,b.worker_type,b.billing_unit,clientRate,workerRate,b.starts_on,b.ends_on??null,req.user!.id])).rows[0];
    await audit(c,req.user!.id,'staffing_engagement_terms_submitted','staffing_engagement',e.id,null,{worker_type:b.worker_type,billing_unit:b.billing_unit,client_rate:clientRate,worker_rate:workerRate,starts_on:b.starts_on,ends_on:b.ends_on??null,terms_status:'pending_approval'});return e;
  });res.status(201).json(row);
}));

staffingAccounting.get('/staffing-engagements',requireRole(...finance),h(async(req,res)=>{
  res.json(await withUser(req.user!,async c=>(await c.query(`SELECT e.*,l.name AS client_name,w.name AS worker_name,
    COALESCE((SELECT sum(client_amount) FROM staffing_work_periods p WHERE p.engagement_id=e.id AND p.status='approved'),0)::numeric(14,2)::text AS client_accrued,
    COALESCE((SELECT sum(worker_amount) FROM staffing_work_periods p WHERE p.engagement_id=e.id AND p.status='approved'),0)::numeric(14,2)::text AS worker_accrued
    FROM staffing_engagements e JOIN leads l ON l.id=e.client_lead_id JOIN workers w ON w.id=e.worker_id ORDER BY e.created_at DESC LIMIT 500`)).rows));
}));

// Worker/client self-service uses the participant RLS policy added for party acceptance.
staffingAccounting.get('/staffing-engagements/mine',requireRole('customer','worker'),h(async(req,res)=>{
  res.json(await withUser(req.user!,async c=>(await c.query(`SELECT e.id,e.status,e.billing_unit,e.worker_type,l.name AS employer_client,
      e.client_rate::text,e.worker_rate::text,e.starts_on,e.ends_on,
      (e.client_accepted_by IS NOT NULL) AS client_accepted,(e.worker_accepted_by IS NOT NULL) AS worker_accepted,
      e.terms_approved_at,e.created_at
    FROM staffing_engagements e LEFT JOIN leads l ON l.id=e.client_lead_id
    ORDER BY e.created_at DESC LIMIT 100`)).rows));
}));

staffingAccounting.post('/staffing-engagements/:id/terms-decision',requireRole(...reviewers),h(async(req,res)=>{
  const b=z.object({decision:z.enum(['approve','reject']),reason:z.string().trim().min(10).max(1000)}).strict().parse(req.body);
  const row=await withUser(req.user!,async c=>{
    const e=(await c.query('SELECT * FROM staffing_engagements WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];if(!e)throw new HttpError(404,'Staffing engagement not found');if(e.status!=='terms_pending')throw new HttpError(409,'Engagement terms are not awaiting review');if(e.recorded_by===req.user!.id)throw new HttpError(403,'The terms maker cannot review their own engagement');
    const status=b.decision==='approve'?'terms_approved':'cancelled';
    const updated=(await c.query(`UPDATE staffing_engagements SET status=$2,terms_approved_by=$3,terms_approval_reason=$4,terms_approved_at=now() WHERE id=$1 RETURNING *`,[e.id,status,req.user!.id,b.reason])).rows[0];
    await audit(c,req.user!.id,`staffing_engagement_terms_${b.decision}`,'staffing_engagement',e.id,{status:e.status},{status,reason:b.reason});return updated;
  });res.json(row);
}));

staffingAccounting.post('/staffing-engagements/:id/accept',requireRole('customer','worker'),h(async(req,res)=>{
  const b=z.object({reason:z.string().trim().min(10).max(1000)}).strict().parse(req.body);
  const row=await withUser(req.user!,async c=>{
    const party=req.user!.role==='customer'?'client':'worker';
    const updated=(await c.query('SELECT accepted.* FROM accept_staffing_engagement($1,$2,$3) AS accepted',[req.params.id,party,b.reason])).rows[0];
    await audit(c,req.user!.id,`staffing_engagement_${party}_accepted`,'staffing_engagement',req.params.id,{status:'terms_approved'},{status:updated.status,party,reason:b.reason});return updated;
  });res.json(row);
}));

staffingAccounting.post('/staffing-engagements/:id/work-periods',requireRole('master_agent','field_agent','finance','finance_manager','super_admin','global_admin','worker'),h(async(req,res)=>{
  const b=z.object({period_start:z.string().date(),period_end:z.string().date(),quantity:z.number().positive().finite(),description:z.string().trim().min(5).max(1000)}).strict().parse(req.body);
  if(b.period_end<b.period_start)throw new HttpError(422,'Work period end must be on or after its start');
  const row=await withUser(req.user!,async c=>{
    const lockClause=req.user!.role==='worker'?'':' FOR UPDATE';
    const e=(await c.query(`SELECT * FROM staffing_engagements WHERE id=$1${lockClause}`,[req.params.id])).rows[0];if(!e)throw new HttpError(404,'Staffing engagement not found');if(e.status!=='active')throw new HttpError(409,'Approved active engagement terms are required before work is recorded');if(b.period_start< String(e.starts_on).slice(0,10)||(e.ends_on&&b.period_end>String(e.ends_on).slice(0,10)))throw new HttpError(422,'Work period must fall within the engagement dates');
    if(req.user!.role==='worker'&&!(await c.query('SELECT 1 FROM workers w JOIN users u ON u.id=$2 WHERE w.id=$1 AND w.phone=u.phone',[e.worker_id,req.user!.id])).rowCount)throw new HttpError(404,'Staffing engagement not found');
    const qty=Math.round(b.quantity*100)/100;if(qty<=0||Math.abs(qty-b.quantity)>1e-7)throw new HttpError(422,'Work quantity must be positive and limited to two decimal places');
    const clientAmount=amount(Number(e.client_rate)*qty),workerAmount=amount(Number(e.worker_rate)*qty);
    return (await c.query(`INSERT INTO staffing_work_periods(engagement_id,period_start,period_end,quantity,client_amount,worker_amount,description,recorded_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[e.id,b.period_start,b.period_end,qty,clientAmount,workerAmount,b.description,req.user!.id])).rows[0];
  });res.status(201).json(row);
}));

staffingAccounting.get('/staffing-work-periods/mine',requireRole('worker'),h(async(req,res)=>{
  res.json(await withUser(req.user!,async c=>(await c.query(`SELECT p.id,p.engagement_id,p.period_start,p.period_end,p.quantity,
      p.worker_amount::text,p.description,p.status,p.review_reason,p.reviewed_at,p.created_at
    FROM staffing_work_periods p JOIN staffing_engagements e ON e.id=p.engagement_id
    JOIN workers w ON w.id=e.worker_id JOIN users u ON u.id=$1
    WHERE w.phone=u.phone ORDER BY p.period_start DESC,p.created_at DESC LIMIT 200`,[req.user!.id])).rows));
}));

staffingAccounting.get('/staffing-work-periods/pending',requireRole(...reviewers),h(async(req,res)=>{
  res.json(await withUser(req.user!,async c=>(await c.query(`SELECT p.*,e.source_agent_id,e.client_lead_id,e.worker_id,l.name AS client_name,w.name AS worker_name
    FROM staffing_work_periods p JOIN staffing_engagements e ON e.id=p.engagement_id
    JOIN leads l ON l.id=e.client_lead_id JOIN workers w ON w.id=e.worker_id
    WHERE p.status='submitted' ORDER BY p.created_at LIMIT 200`)).rows));
}));

staffingAccounting.get('/staffing-settlements/mine',requireRole('worker'),h(async(req,res)=>{
  res.json(await withUser(req.user!,async c=>(await c.query(`SELECT s.id,s.engagement_id,s.amount::text,s.channel,s.reference,s.payment_date,
      s.status,s.reason,s.reconciled_at,s.created_at
    FROM staffing_settlements s JOIN staffing_engagements e ON e.id=s.engagement_id
    JOIN workers w ON w.id=e.worker_id JOIN users u ON u.id=$1
    WHERE w.phone=u.phone AND s.kind='worker_payment'
    ORDER BY s.payment_date DESC,s.created_at DESC LIMIT 200`,[req.user!.id])).rows));
}));

const workerSupportStaff=['global_admin','super_admin','corporate_business_manager','master_agent'] as const;
const WorkerSupportRequest=z.object({
  category:z.enum(['work_assignment','contract_terms','work_report_or_pay','safety_and_wellbeing','other']),
  subject:z.string().trim().min(3).max(160),
  description:z.string().trim().min(10).max(4000),
}).strict();

staffingAccounting.post('/worker-support',requireRole('worker'),h(async(req,res)=>{
  const b=WorkerSupportRequest.parse(req.body);
  const row=await withUser(req.user!,async c=>{
    const ticket=(await c.query(`INSERT INTO worker_support_requests(user_id,category,subject,description)
      VALUES($1,$2,$3,$4) RETURNING id,category,subject,description,status,response,created_at,updated_at`,
    [req.user!.id,b.category,b.subject,b.description])).rows[0];
    await audit(c,req.user!.id,'worker_support_request_created','worker_support_request',ticket.id,null,{category:b.category});
    return ticket;
  });
  res.status(201).json(row);
}));

staffingAccounting.get('/worker-support/mine',requireRole('worker'),h(async(req,res)=>{
  res.json(await withUser(req.user!,async c=>(await c.query(`SELECT id,category,subject,description,status,response,responded_at,created_at,updated_at
    FROM worker_support_requests WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,[req.user!.id])).rows));
}));

staffingAccounting.get('/worker-support/queue',requireRole(...workerSupportStaff),h(async(req,res)=>{
  res.json(await withUser(req.user!,async c=>(await c.query(`SELECT r.id,r.user_id,u.legal_name,u.phone,r.category,r.subject,r.description,
      r.status,r.response,r.created_at,r.updated_at
    FROM worker_support_requests r JOIN users u ON u.id=r.user_id
    ORDER BY CASE WHEN r.status='open' THEN 0 WHEN r.status='in_progress' THEN 1 ELSE 2 END,r.created_at
    LIMIT 200`)).rows));
}));

staffingAccounting.post('/worker-support/:id/respond',requireRole(...workerSupportStaff),h(async(req,res)=>{
  const b=z.object({status:z.enum(['in_progress','resolved']),response:z.string().trim().min(5).max(2000)}).strict().parse(req.body);
  const row=await withUser(req.user!,async c=>{
    const ticket=(await c.query('SELECT id,status FROM worker_support_requests WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];
    if(!ticket)throw new HttpError(404,'Worker support request not found');
    if(ticket.status==='resolved')throw new HttpError(409,'Worker support request is already resolved');
    const updated=(await c.query(`UPDATE worker_support_requests SET status=$2,response=$3,responded_by=$4,responded_at=now(),updated_at=now()
      WHERE id=$1 RETURNING id,status,response,responded_at,updated_at`,
    [ticket.id,b.status,b.response,req.user!.id])).rows[0];
    await audit(c,req.user!.id,'worker_support_request_responded','worker_support_request',ticket.id,{status:ticket.status},{status:b.status});
    return updated;
  });
  res.json(row);
}));

staffingAccounting.post('/staffing-work-periods/:id/decision',requireRole(...reviewers),h(async(req,res)=>{
  const b=z.object({decision:z.enum(['approve','reject']),reason:z.string().trim().min(10).max(1000)}).strict().parse(req.body);
  const row=await withUser(req.user!,async c=>{
    const p=(await c.query(`SELECT p.*,e.source_agent_id,e.status AS engagement_status,e.client_lead_id,e.worker_id FROM staffing_work_periods p JOIN staffing_engagements e ON e.id=p.engagement_id WHERE p.id=$1 FOR UPDATE OF p,e`,[req.params.id])).rows[0];if(!p)throw new HttpError(404,'Staffing work period not found');if(p.status!=='submitted')throw new HttpError(409,'Work period is not awaiting review');if(p.recorded_by===req.user!.id)throw new HttpError(403,'The work evidence maker cannot approve their own work');if(b.decision==='approve'&&p.engagement_status!=='active')throw new HttpError(409,'Only work for an active engagement can be accrued');
    const status=b.decision==='approve'?'approved':'rejected';
    if(status==='approved'){
      const clientAmount=Number(p.client_amount),workerAmount=Number(p.worker_amount);
      await post(c,'staffing_work_period',p.id,[['Staffing Receivable',clientAmount,0],['Staffing Revenue',0,clientAmount],['Contractor Expense',workerAmount,0],['Worker Payable',0,workerAmount]]);
      await event(c,{source_entity_id:p.source_agent_id,entry_date:String(p.period_end).slice(0,10),source_reference:`staffing-work:${p.id}`,description:`Approved Staffing work evidence ${p.period_start} to ${p.period_end}`,
        lines:[{source_account_code:'staffing_receivable',debit:money(p.client_amount),credit:'0.00'},{source_account_code:'staffing_revenue',debit:'0.00',credit:money(p.client_amount)},{source_account_code:'contractor_expense',debit:money(p.worker_amount),credit:'0.00'},{source_account_code:'worker_payable',debit:'0.00',credit:money(p.worker_amount)}],maker_id:p.recorded_by,checker_id:req.user!.id,checker_reason:b.reason});
    }
    const updated=(await c.query(`UPDATE staffing_work_periods SET status=$2,reviewed_by=$3,review_reason=$4,reviewed_at=now() WHERE id=$1 RETURNING *`,[p.id,status,req.user!.id,b.reason])).rows[0];
    await audit(c,req.user!.id,`staffing_work_${b.decision}`,'staffing_work_period',p.id,{status:p.status},{status,reason:b.reason});return updated;
  });res.json(row);
}));

staffingAccounting.post('/staffing-engagements/:id/settlements',requireRole(...finance),h(async(req,res)=>{
  const b=z.object({kind:z.enum(['client_receipt','worker_payment']),amount:z.number().positive().finite(),channel:z.string().trim().min(2).max(40),reference:z.string().trim().min(3).max(160),payment_date:z.string().date()}).strict().parse(req.body);const paymentAmount=amount(b.amount);
  const row=await withUser(req.user!,async c=>{
    const e=(await c.query('SELECT * FROM staffing_engagements WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];if(!e)throw new HttpError(404,'Staffing engagement not found');
    const field=b.kind==='client_receipt'?'client_amount':'worker_amount';
    const accrued=Number((await c.query(`SELECT COALESCE(sum(${field}),0)::numeric(14,2)::text AS total FROM staffing_work_periods WHERE engagement_id=$1 AND status='approved'`,[e.id])).rows[0].total);
    const reserved=Number((await c.query(`SELECT COALESCE(sum(amount),0)::numeric(14,2)::text AS total FROM staffing_settlements WHERE engagement_id=$1 AND kind=$2 AND status IN ('pending','reconciled')`,[e.id,b.kind])).rows[0].total);
    if(Number(paymentAmount)>Math.round((accrued-reserved)*100)/100)throw new HttpError(422,`Settlement exceeds the remaining accrued ${b.kind==='client_receipt'?'client receivable':'worker payable'}`);
    return (await c.query(`INSERT INTO staffing_settlements(engagement_id,kind,amount,channel,reference,payment_date,recorded_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[e.id,b.kind,paymentAmount,b.channel,b.reference,b.payment_date,req.user!.id])).rows[0];
  });res.status(201).json(row);
}));

staffingAccounting.get('/staffing-settlements/pending',requireRole(...reviewers),h(async(req,res)=>{
  res.json(await withUser(req.user!,async c=>(await c.query(`SELECT s.*,e.source_agent_id,e.client_lead_id,e.worker_id FROM staffing_settlements s JOIN staffing_engagements e ON e.id=s.engagement_id WHERE s.status='pending' ORDER BY s.created_at LIMIT 200`)).rows));
}));

staffingAccounting.post('/staffing-settlements/:id/reconcile',requireRole(...reviewers),h(async(req,res)=>{
  const b=z.object({reason:z.string().trim().min(10).max(1000)}).strict().parse(req.body);
  const row=await withUser(req.user!,async c=>{
    const s=(await c.query(`SELECT s.*,e.source_agent_id FROM staffing_settlements s JOIN staffing_engagements e ON e.id=s.engagement_id WHERE s.id=$1 FOR UPDATE OF s,e`,[req.params.id])).rows[0];if(!s)throw new HttpError(404,'Staffing settlement not found');if(s.status!=='pending')throw new HttpError(409,'Staffing settlement is not pending reconciliation');if(s.recorded_by===req.user!.id)throw new HttpError(403,'Settlement maker cannot reconcile their own transfer');
    const val=Number(s.amount),isReceipt=s.kind==='client_receipt';const debit=isReceipt?'Cash':'Worker Payable',credit=isReceipt?'Staffing Receivable':'Cash';
    await post(c,'staffing_settlement',s.id,[[debit,val,0],[credit,0,val]]);
    const debitCode=isReceipt?'cash':'worker_payable',creditCode=isReceipt?'staffing_receivable':'cash';
    await event(c,{source_entity_id:s.source_agent_id,entry_date:String(s.payment_date).slice(0,10),source_reference:`staffing-settlement:${s.id}:${s.reference}`,description:`Reconciled Staffing ${isReceipt?'client receipt':'worker payment'} ${s.reference}`,
      lines:[{source_account_code:debitCode,debit:money(s.amount),credit:'0.00'},{source_account_code:creditCode,debit:'0.00',credit:money(s.amount)}],maker_id:s.recorded_by,checker_id:req.user!.id,checker_reason:b.reason});
    const updated=(await c.query(`UPDATE staffing_settlements SET status='reconciled',reconciled_by=$2,reason=$3,reconciled_at=now() WHERE id=$1 RETURNING *`,[s.id,req.user!.id,b.reason])).rows[0];
    await audit(c,req.user!.id,'staffing_settlement_reconciled','staffing_settlement',s.id,{status:'pending'},{status:'reconciled',reason:b.reason});return updated;
  });res.json(row);
}));

export default staffingAccounting;
