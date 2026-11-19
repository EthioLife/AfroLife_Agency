import { createHash } from 'node:crypto';
import type { Request, Response, RequestHandler, Router as RouterType } from 'express';
import { Router } from 'express';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import type { AuthUser } from '../../src/auth-types.js';
import { HttpError } from '../../src/http-error.js';
import { hashPassword } from './auth.js';
import type { WithUser } from './router-types.js';
import { createAccountingProductRouter } from './products.js';
import { createAccountingWorkflowRouter } from './workflows.js';
import { toCents, validateBalancedJournal } from './journal-validation.js';

const h = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler => (req,res,next) => { fn(req,res).catch(next); };
const UUID = z.string().uuid();
const accountCode = z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,24}$/);
const money = z.string().regex(/^\d{1,16}(?:\.\d{1,2})?$/);
const roles = ['entity_admin','finance_manager','accountant','reviewer','auditor','viewer'];
const writers = ['entity_admin','finance_manager','accountant'];
const reviewers = ['entity_admin','finance_manager','reviewer'];
const global = (role: string) => role === 'global_admin' || role === 'super_admin';

async function assertAccess(withUser: WithUser, user: AuthUser, entityId: string, allowed: string[]) {
  if (global(user.role)) return;
  const allowedByMembership = await withUser(user, async (client) => Boolean((await client.query(
    'SELECT accounting_can_access($1,$2::text[]) AS allowed', [entityId,allowed],
  )).rows[0]?.allowed));
  if (!allowedByMembership) throw new HttpError(403,'Accounting entity membership is required');
}

async function audit(client: PoolClient, entityId: string, actorId: string, action: string, type: string, id: string, details: unknown) {
  await client.query('INSERT INTO accounting_audit(entity_id,actor_id,action,record_type,record_id,details) VALUES($1,$2,$3,$4,$5,$6)',
    [entityId,actorId,action,type,id,JSON.stringify(details ?? {})]);
}

function centsDecimal(value:bigint):string{return `${value/100n}.${String(value%100n).padStart(2,'0')}`;}
function sendReport(req:Request,res:Response,data:{report:string;rows:any[];[key:string]:any}){
  if(req.query.format!=='csv'){res.json(data);return;}
  const columns=data.report==='general-ledger'?['entry_date','source_reference','code','name','journal_description','line_description','debit','credit','running_balance']:['code','name','account_type','debit','credit','net','journal_count'];
  const cell=(value:unknown)=>{const raw=String(value??'');const safe=/^[\s]*[=+@-]/.test(raw)?`'${raw}`:raw;return /[",\r\n]/.test(safe)?`"${safe.replaceAll('"','""')}"`:safe;};
  const csv=[columns.join(','),...data.rows.map(row=>columns.map(key=>cell(row[key])).join(','))].join('\r\n')+'\r\n';
  res.status(200).type('text/csv').set('Content-Disposition',`attachment; filename="${data.report}.csv"`).send(csv);
}

export function createAccountingRouter(withUser: WithUser): RouterType {
  const router = Router();
  router.use(createAccountingProductRouter(withUser));
  router.use(createAccountingWorkflowRouter(withUser));

  router.get('/entities', h(async (req,res) => {
    const rows = await withUser(req.user!, async (client) => (await client.query(
      `SELECT id,parent_entity_id,source_system,source_entity_id,entity_type,name,legal_name,base_currency,
         fiscal_year_start_month,status,created_at FROM accounting_entities ORDER BY name LIMIT 1000`,
    )).rows);
    res.json(rows);
  }));

  router.post('/entities', h(async (req,res) => {
    const body = z.object({ parent_entity_id: UUID.nullable().optional(), source_system: z.string().trim().min(2).max(40).optional(),
      source_entity_id: z.string().trim().min(1).max(160).optional(), entity_type: z.enum(['group','legal_entity','subsidiary','branch','business_unit','department','cooperative','merchant','landlord','edir','insurance_broker','agent_network','agent','property_owner','other']),
      name: z.string().trim().min(2).max(160), legal_name: z.string().trim().min(2).max(200).optional(),
      base_currency: z.string().regex(/^[A-Z]{3}$/).default('ETB'), fiscal_year_start_month: z.number().int().min(1).max(12).default(1),
    }).strict().parse(req.body);
    const selfServiceOwner = ['customer','property_owner'].includes(req.user!.role);
    if (body.parent_entity_id) await assertAccess(withUser,req.user!,body.parent_entity_id,['entity_admin']);
    else if (selfServiceOwner) {
      if (!['legal_entity','cooperative','merchant','landlord','property_owner','other'].includes(body.entity_type)) {
        throw new HttpError(400,'Choose a supported business entity type');
      }
    } else if (!global(req.user!.role)) throw new HttpError(403,'Only a platform administrator can create a root accounting entity');
    const row = await withUser(req.user!, async (client) => {
      const entity = (await client.query(`INSERT INTO accounting_entities(parent_entity_id,source_system,source_entity_id,entity_type,name,legal_name,base_currency,fiscal_year_start_month,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [body.parent_entity_id??null,body.source_system??null,body.source_entity_id??null,body.entity_type,body.name,body.legal_name??null,body.base_currency,body.fiscal_year_start_month,req.user!.id])).rows[0];
      await client.query(`INSERT INTO accounting_memberships(entity_id,user_id,role,assigned_by) VALUES($1,$2,'entity_admin',$2) ON CONFLICT DO NOTHING`,[entity.id,req.user!.id]);
      await audit(client,entity.id,req.user!.id,'entity_created','accounting_entity',entity.id,{name:entity.name,parent_entity_id:entity.parent_entity_id});
      return entity;
    });
    res.status(201).json(row);
  }));

  router.post('/users', h(async(req,res)=>{
    if(process.env.ACCOUNTING_AUTH_MODE!=='local')throw new HttpError(404,'Local user administration is disabled in gateway mode');
    if(!global(req.user!.role))throw new HttpError(403,'Standalone Accounting administrator access is required');
    const body=z.object({email:z.string().trim().email().max(320),name:z.string().trim().min(2).max(160),password:z.string().min(12).max(200)}).strict().parse(req.body);
    const row=await withUser(req.user!,async(client)=>(await client.query(`INSERT INTO accounting_local_users(email,display_name,password_hash)
      VALUES(lower($1),$2,$3) RETURNING id,email,display_name,platform_role,active,created_at`,[body.email,body.name,await hashPassword(body.password)])).rows[0]);
    res.status(201).json(row);
  }));

  router.post('/entities/:entityId/members', h(async (req,res) => {
    const entityId = UUID.parse(req.params.entityId);
    await assertAccess(withUser,req.user!,entityId,['entity_admin']);
    const body = z.object({ user_id: UUID, role: z.enum(['entity_admin','finance_manager','accountant','reviewer','auditor','viewer','consolidated_viewer']) }).strict().parse(req.body);
    const row = await withUser(req.user!,async (client) => {
      const result = (await client.query(`INSERT INTO accounting_memberships(entity_id,user_id,role,assigned_by) VALUES($1,$2,$3,$4)
        ON CONFLICT(entity_id,user_id) DO UPDATE SET role=EXCLUDED.role,active=true,assigned_by=EXCLUDED.assigned_by,created_at=now()
        RETURNING entity_id,user_id,role,active,created_at`,[entityId,body.user_id,body.role,req.user!.id])).rows[0];
      await audit(client,entityId,req.user!.id,'membership_assigned','accounting_membership',body.user_id,{role:body.role});
      return result;
    });
    res.status(201).json(row);
  }));

  router.get('/entities/:entityId/members',h(async(req,res)=>{
    const entityId=UUID.parse(req.params.entityId);await assertAccess(withUser,req.user!,entityId,['entity_admin','finance_manager']);
    const rows=await withUser(req.user!,async(client)=>(await client.query('SELECT entity_id,user_id,role,active,created_at FROM accounting_memberships WHERE entity_id=$1 ORDER BY created_at',[entityId])).rows);
    res.json(rows);
  }));

  router.post('/entities/:entityId/source-mappings',h(async(req,res)=>{
    const entityId=UUID.parse(req.params.entityId);await assertAccess(withUser,req.user!,entityId,['entity_admin','finance_manager']);
    const body=z.object({source_system:z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_-]{1,39}$/),source_entity_id:z.string().trim().min(1).max(160)}).strict().parse(req.body);
    const row=await withUser(req.user!,async(client)=>{
      const r=(await client.query(`INSERT INTO accounting_source_mappings(entity_id,source_system,source_entity_id,created_by) VALUES($1,$2,$3,$4)
        ON CONFLICT(source_system,source_entity_id) DO UPDATE SET entity_id=EXCLUDED.entity_id,active=true,created_by=EXCLUDED.created_by,created_at=now() RETURNING *`,[entityId,body.source_system,body.source_entity_id,req.user!.id])).rows[0];
      await audit(client,entityId,req.user!.id,'source_entity_mapped','accounting_source_mapping',r.id,body);return r;
    });res.status(201).json(row);
  }));

  router.post('/entities/:entityId/source-account-maps',h(async(req,res)=>{
    const entityId=UUID.parse(req.params.entityId);await assertAccess(withUser,req.user!,entityId,['entity_admin','finance_manager']);
    const body=z.object({source_system:z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_-]{1,39}$/),source_account_code:z.string().trim().min(1).max(80),account_code:accountCode}).strict().parse(req.body);
    const row=await withUser(req.user!,async(client)=>{
      const account=(await client.query('SELECT id FROM accounting_accounts WHERE entity_id=$1 AND code=$2 AND active',[entityId,body.account_code])).rows[0];
      if(!account)throw new HttpError(422,'Choose an active account in this entity book');
      const r=(await client.query(`INSERT INTO accounting_source_account_maps(entity_id,source_system,source_account_code,account_id,created_by)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT(entity_id,source_system,source_account_code)
        DO UPDATE SET account_id=EXCLUDED.account_id,active=true,created_by=EXCLUDED.created_by,created_at=now() RETURNING *`,[entityId,body.source_system,body.source_account_code,account.id,req.user!.id])).rows[0];
      await audit(client,entityId,req.user!.id,'source_account_mapped','accounting_source_account_map',r.id,body);return r;
    });res.status(201).json(row);
  }));

  router.get('/entities/:entityId/accounts', h(async(req,res) => {
    const entityId=UUID.parse(req.params.entityId); await assertAccess(withUser,req.user!,entityId,roles);
    const rows=await withUser(req.user!,async(client)=>(await client.query(`SELECT a.id,a.code,a.name,a.account_type,a.normal_balance,a.active,
      coalesce(sum(CASE WHEN j.status='posted' THEN l.debit-l.credit ELSE 0 END),0)::numeric(18,2) AS balance
      FROM accounting_accounts a LEFT JOIN accounting_journal_lines l ON l.account_id=a.id AND l.entity_id=a.entity_id
      LEFT JOIN accounting_journals j ON j.id=l.journal_id AND j.entity_id=l.entity_id
      WHERE a.entity_id=$1 GROUP BY a.id ORDER BY a.code`,[entityId])).rows);
    res.json(rows);
  }));

  router.post('/entities/:entityId/accounts', h(async(req,res) => {
    const entityId=UUID.parse(req.params.entityId); await assertAccess(withUser,req.user!,entityId,writers);
    const body=z.object({code:accountCode,name:z.string().trim().min(2).max(160),name_am:z.string().trim().max(200).optional(),account_type:z.enum(['asset','liability','equity','revenue','expense']),normal_balance:z.enum(['debit','credit'])}).strict().parse(req.body);
    const row=await withUser(req.user!,async(client)=>{
      const a=(await client.query(`INSERT INTO accounting_accounts(entity_id,code,name,name_am,account_type,normal_balance,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[entityId,body.code,body.name,body.name_am??null,body.account_type,body.normal_balance,req.user!.id])).rows[0];
      await audit(client,entityId,req.user!.id,'account_created','accounting_account',a.id,body); return a;
    });
    res.status(201).json(row);
  }));

  router.post('/entities/:entityId/chart-template', h(async(req,res)=>{
    const entityId=UUID.parse(req.params.entityId); await assertAccess(withUser,req.user!,entityId,writers);
    const accounts=[
      ['1000','Cash and bank','ባንክ እና ጥሬ ገንዘብ','asset','debit'],['1100','Accounts receivable','የሚሰበሰብ ሂሳብ','asset','debit'],
      ['1500','Property and equipment','ንብረት እና መሣሪያ','asset','debit'],['2000','Accounts payable','የሚከፈል ሂሳብ','liability','credit'],
      ['2100','Tax payable','የታክስ እዳ','liability','credit'],['3000','Owner capital','የባለቤት ካፒታል','equity','credit'],
      ['3100','Retained earnings','የተያዘ ትርፍ','equity','credit'],['4000','Revenue','ገቢ','revenue','credit'],
      ['5000','Cost of sales','የሽያጭ ወጪ','expense','debit'],['6000','Operating expenses','የሥራ ወጪዎች','expense','debit'],
    ];
    const result=await withUser(req.user!,async(client)=>{
      const count=Number((await client.query('SELECT count(*)::int AS n FROM accounting_accounts WHERE entity_id=$1',[entityId])).rows[0].n);
      if(count)throw new HttpError(409,'Chart template can only be applied to an entity with no accounts');
      for(const [code,name,nameAm,type,normal] of accounts)await client.query(`INSERT INTO accounting_accounts(entity_id,code,name,name_am,account_type,normal_balance,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)`,[entityId,code,name,nameAm,type,normal,req.user!.id]);
      await audit(client,entityId,req.user!.id,'chart_template_applied','accounting_entity',entityId,{template:'ethiopia_general_v1',account_count:accounts.length});
      return {template:'ethiopia_general_v1',account_count:accounts.length,status:'draft_requires_entity_review'};
    });res.status(201).json(result);
  }));

  router.post('/entities/:entityId/periods', h(async(req,res) => {
    const entityId=UUID.parse(req.params.entityId); await assertAccess(withUser,req.user!,entityId,['entity_admin','finance_manager']);
    const body=z.object({period_start:z.string().date(),period_end:z.string().date()}).strict().refine(v=>v.period_end>=v.period_start,{message:'Period end must be on or after start'}).parse(req.body);
    const row=await withUser(req.user!,async(client)=>{
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`accounting-period:${entityId}`]);
      const overlap=(await client.query(`SELECT 1 FROM accounting_periods
        WHERE entity_id=$1 AND period_start<=$3::date AND period_end>=$2::date LIMIT 1`,
      [entityId,body.period_start,body.period_end])).rowCount;
      if(overlap)throw new HttpError(409,'Accounting periods cannot overlap');
      return (await client.query(`INSERT INTO accounting_periods(entity_id,period_start,period_end) VALUES($1,$2,$3) RETURNING *`,[entityId,body.period_start,body.period_end])).rows[0];
    });
    res.status(201).json(row);
  }));

  router.get('/entities/:entityId/periods',h(async(req,res)=>{
    const entityId=UUID.parse(req.params.entityId);await assertAccess(withUser,req.user!,entityId,roles);
    const rows=await withUser(req.user!,async(client)=>(await client.query('SELECT id,period_start,period_end,status,close_requested_by,close_requested_at,close_reason,closed_by,closed_at FROM accounting_periods WHERE entity_id=$1 ORDER BY period_start DESC',[entityId])).rows);
    res.json(rows);
  }));

  router.post('/entities/:entityId/periods/:periodId/close', h(async(req,res)=>{
    const entityId=UUID.parse(req.params.entityId),periodId=UUID.parse(req.params.periodId);
    await assertAccess(withUser,req.user!,entityId,['entity_admin','finance_manager']);
    const body=z.object({reason:z.string().trim().min(10).max(1000)}).strict().parse(req.body);
    const row=await withUser(req.user!,async(client)=>{
      const period=(await client.query('SELECT * FROM accounting_periods WHERE id=$1 AND entity_id=$2 FOR UPDATE',[periodId,entityId])).rows[0];
      if(!period)throw new HttpError(404,'Accounting period not found');
      if(period.status!=='open')throw new HttpError(409,'Only open periods can have a close request');
      const pending=(await client.query("SELECT count(*)::int AS count FROM accounting_journals WHERE entity_id=$1 AND period_id=$2 AND status='pending_approval'",[entityId,periodId])).rows[0].count;
      if(pending)throw new HttpError(409,'Resolve pending journal approvals before requesting period close');
      const updated=(await client.query("UPDATE accounting_periods SET status='review',close_requested_by=$3,close_requested_at=now(),close_reason=$4 WHERE id=$1 AND entity_id=$2 RETURNING *",[periodId,entityId,req.user!.id,body.reason])).rows[0];
      await audit(client,entityId,req.user!.id,'period_close_requested','accounting_period',periodId,{reason:body.reason}); return updated;
    });res.json(row);
  }));

  router.post('/entities/:entityId/periods/:periodId/close/approve', h(async(req,res)=>{
    const entityId=UUID.parse(req.params.entityId),periodId=UUID.parse(req.params.periodId);
    await assertAccess(withUser,req.user!,entityId,['entity_admin','finance_manager']);
    const body=z.object({reason:z.string().trim().min(10).max(1000)}).strict().parse(req.body);
    const row=await withUser(req.user!,async(client)=>{
      const period=(await client.query('SELECT * FROM accounting_periods WHERE id=$1 AND entity_id=$2 FOR UPDATE',[periodId,entityId])).rows[0];
      if(!period)throw new HttpError(404,'Accounting period not found');
      if(period.status!=='review')throw new HttpError(409,'Period has no close request awaiting approval');
      if(period.close_requested_by===req.user!.id)throw new HttpError(409,'The period close requester cannot approve their own request');
      const pending=(await client.query("SELECT count(*)::int AS count FROM accounting_journals WHERE entity_id=$1 AND period_id=$2 AND status='pending_approval'",[entityId,periodId])).rows[0].count;
      if(pending)throw new HttpError(409,'Resolve pending journal approvals before approving period close');
      const updated=(await client.query("UPDATE accounting_periods SET status='closed',closed_by=$3,closed_at=now(),close_approval_reason=$4 WHERE id=$1 AND entity_id=$2 RETURNING *",[periodId,entityId,req.user!.id,body.reason])).rows[0];
      await audit(client,entityId,req.user!.id,'period_closed','accounting_period',periodId,{request_reason:period.close_reason,approval_reason:body.reason,requested_by:period.close_requested_by}); return updated;
    });res.json(row);
  }));

  const journalLines=z.array(z.object({account_code:accountCode,debit:money,credit:money,description:z.string().max(255).optional(),product_id:UUID.optional().nullable()}).strict()).min(2).max(100);
  router.post('/entities/:entityId/journals', h(async(req,res) => {
    const entityId=UUID.parse(req.params.entityId); await assertAccess(withUser,req.user!,entityId,writers);
    const body=z.object({idempotency_key:UUID,period_id:UUID,entry_date:z.string().date(),source_reference:z.string().trim().min(1).max(160),description:z.string().trim().min(10).max(1000),lines:journalLines}).strict().parse(req.body);
    const debit=validateBalancedJournal(body.lines);
    const payloadHash=createHash('sha256').update(JSON.stringify({...body,period_id:body.period_id??null})).digest('hex');
    const result=await withUser(req.user!,async(client)=>{
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`accounting-journal:${entityId}:${body.idempotency_key}`]);
      const prior=(await client.query('SELECT * FROM accounting_journals WHERE entity_id=$1 AND idempotency_key=$2',[entityId,body.idempotency_key])).rows[0];
      if(prior){if(prior.payload_hash!==payloadHash) throw new HttpError(409,'Idempotency key was reused for a different journal');return {...prior,replayed:true};}
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`accounting-reference:${entityId}:${body.source_reference}`]);
      const referenceOwner=(await client.query('SELECT id FROM accounting_journals WHERE entity_id=$1 AND source_reference=$2',[entityId,body.source_reference])).rows[0];
      if(referenceOwner)throw new HttpError(409,'Accounting transaction reference is already in use');
      const accounts=(await client.query('SELECT id,code FROM accounting_accounts WHERE entity_id=$1 AND active AND code=ANY($2::text[])',[entityId,body.lines.map(x=>x.account_code)])).rows;
      const ids=new Map(accounts.map(a=>[a.code,a.id])); if(ids.size!==new Set(body.lines.map(x=>x.account_code)).size) throw new HttpError(400,'Journal references an inactive or unknown account');
      const productIds=[...new Set(body.lines.flatMap(line=>line.product_id?[line.product_id]:[]))];
      if(productIds.length){
        const products=(await client.query(`SELECT id FROM accounting_products WHERE entity_id=$1
          AND product_type='offering' AND status='active' AND id=ANY($2::uuid[])`,[entityId,productIds])).rows;
        if(products.length!==productIds.length)throw new HttpError(422,'Journal lines must reference active offerings in this Accounting entity');
      }
      const j=(await client.query(`INSERT INTO accounting_journals(entity_id,period_id,idempotency_key,payload_hash,entry_date,source_reference,description,amount,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[entityId,body.period_id??null,body.idempotency_key,payloadHash,body.entry_date,body.source_reference,body.description,centsDecimal(debit),req.user!.id])).rows[0];
      for(const [i,line] of body.lines.entries()) await client.query(`INSERT INTO accounting_journal_lines(journal_id,entity_id,line_no,account_id,description,debit,credit,product_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[j.id,entityId,i+1,ids.get(line.account_code),line.description??null,line.debit,line.credit,line.product_id??null]);
      const pending=(await client.query("UPDATE accounting_journals SET status='pending_approval' WHERE id=$1 RETURNING *",[j.id])).rows[0];
      await audit(client,entityId,req.user!.id,'journal_submitted','accounting_journal',j.id,{amount:(Number(debit)/100).toFixed(2),source_reference:body.source_reference});
      return {...pending,replayed:false};
    });
    res.status(result.replayed?200:201).json(result);
  }));

  router.post('/entities/:entityId/journals/:journalId/reversal',h(async(req,res)=>{
    const entityId=UUID.parse(req.params.entityId);await assertAccess(withUser,req.user!,entityId,writers);
    const journalId=UUID.parse(req.params.journalId);
    const body=z.object({idempotency_key:UUID,period_id:UUID,entry_date:z.string().date(),source_reference:z.string().trim().min(1).max(160),description:z.string().trim().min(10).max(1000),reason:z.string().trim().min(10).max(1000)}).strict().parse(req.body);
    const payloadHash=createHash('sha256').update(JSON.stringify({source_journal_id:journalId,...body})).digest('hex');
    const result=await withUser(req.user!,async(client)=>{
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`accounting-journal:${entityId}:${body.idempotency_key}`]);
      const prior=(await client.query('SELECT * FROM accounting_journals WHERE entity_id=$1 AND idempotency_key=$2',[entityId,body.idempotency_key])).rows[0];
      if(prior){if(prior.payload_hash!==payloadHash)throw new HttpError(409,'Idempotency key was reused for a different reversal');return {...prior,replayed:true};}
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`accounting-reference:${entityId}:${body.source_reference}`]);
      const referenceOwner=(await client.query('SELECT id FROM accounting_journals WHERE entity_id=$1 AND source_reference=$2',[entityId,body.source_reference])).rows[0];
      if(referenceOwner)throw new HttpError(409,'Accounting transaction reference is already in use');
      const source=(await client.query(`SELECT j.id,j.status,j.transaction_type,
        jsonb_agg(jsonb_build_object('account_id',l.account_id,'product_id',l.product_id,'debit',l.credit::text,'credit',l.debit::text,'description',l.description) ORDER BY l.line_no) AS lines,
        coalesce(sum(l.debit),0)::numeric(18,2) AS amount FROM accounting_journals j
        JOIN accounting_journal_lines l ON l.journal_id=j.id AND l.entity_id=j.entity_id
        WHERE j.id=$1 AND j.entity_id=$2 GROUP BY j.id`,[journalId,entityId])).rows[0];
      if(!source||source.status!=='posted'||source.transaction_type!=='manual')throw new HttpError(409,'Only posted manual journals can be reversed');
      const period=(await client.query("SELECT status,period_start,period_end FROM accounting_periods WHERE id=$1 AND entity_id=$2",[body.period_id,entityId])).rows[0];
      if(!period||period.status!=='open'||body.entry_date<period.period_start||body.entry_date>period.period_end)throw new HttpError(422,'Choose an open period that covers the reversal date');
      const reversal=(await client.query(`INSERT INTO accounting_journals(entity_id,period_id,idempotency_key,payload_hash,entry_date,source_reference,description,amount,transaction_type,reversal_of,reversal_reason,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,'reversal',$9,$10,$11) RETURNING *`,[entityId,body.period_id,body.idempotency_key,payloadHash,body.entry_date,body.source_reference,body.description,source.amount,journalId,body.reason,req.user!.id])).rows[0];
      for(const [index,line] of source.lines.entries())await client.query(`INSERT INTO accounting_journal_lines(journal_id,entity_id,line_no,account_id,description,debit,credit,product_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[reversal.id,entityId,index+1,line.account_id,line.description,line.debit,line.credit,line.product_id??null]);
      const pending=(await client.query("UPDATE accounting_journals SET status='pending_approval' WHERE id=$1 RETURNING *",[reversal.id])).rows[0];
      await audit(client,entityId,req.user!.id,'reversal_submitted','accounting_journal',reversal.id,{reversal_of:journalId,reason:body.reason});return {...pending,replayed:false};
    });res.status(result.replayed?200:201).json(result);
  }));

  router.post('/entities/:entityId/journals/:journalId/decision', h(async(req,res)=>{
    const entityId=UUID.parse(req.params.entityId); await assertAccess(withUser,req.user!,entityId,reviewers);
    const journalId=UUID.parse(req.params.journalId); const body=z.object({decision:z.enum(['approve','reject']),reason:z.string().trim().min(10).max(1000)}).strict().parse(req.body);
    const row=await withUser(req.user!,async(client)=>{
      const current=(await client.query('SELECT * FROM accounting_journals WHERE id=$1 AND entity_id=$2 FOR UPDATE',[journalId,entityId])).rows[0];
      if(!current) throw new HttpError(404,'Journal not found'); if(current.status!=='pending_approval') throw new HttpError(409,'Journal is not awaiting approval');
      if(current.created_by===req.user!.id) throw new HttpError(409,'Maker cannot approve or reject their own journal');
      const status=body.decision==='approve'?'posted':'rejected';
      const updated=(await client.query('UPDATE accounting_journals SET status=$2,approved_by=$3,approval_reason=$4 WHERE id=$1 RETURNING *',[journalId,status,req.user!.id,body.reason])).rows[0];
      await audit(client,entityId,req.user!.id,`journal_${status}`,'accounting_journal',journalId,{reason:body.reason}); return updated;
    }); res.json(row);
  }));

  router.get('/entities/:entityId/journals', h(async(req,res)=>{
    const entityId=UUID.parse(req.params.entityId); await assertAccess(withUser,req.user!,entityId,roles);
    const rows=await withUser(req.user!,async(client)=>(await client.query(`SELECT j.*,
      coalesce(jsonb_agg(jsonb_build_object('account_code',a.code,'account_name',a.name,'debit',l.debit::text,'credit',l.credit::text,'description',l.description,'product_id',l.product_id,'product_code',p.code,'product_name',p.name) ORDER BY l.line_no) FILTER(WHERE l.id IS NOT NULL),'[]'::jsonb) AS lines
      FROM accounting_journals j LEFT JOIN accounting_journal_lines l ON l.journal_id=j.id AND l.entity_id=j.entity_id
      LEFT JOIN accounting_accounts a ON a.id=l.account_id AND a.entity_id=l.entity_id
      LEFT JOIN accounting_products p ON p.id=l.product_id AND p.entity_id=l.entity_id WHERE j.entity_id=$1
      GROUP BY j.id ORDER BY j.entry_date DESC,j.created_at DESC LIMIT 500`,[entityId])).rows);
    res.json(rows);
  }));

  router.get('/entities/:entityId/dashboard', h(async(req,res)=>{
    const entityId=UUID.parse(req.params.entityId); await assertAccess(withUser,req.user!,entityId,roles);
    const summary=await withUser(req.user!,async(client)=>{
      const totals=(await client.query(`SELECT
        count(*) FILTER(WHERE status='posted')::int AS posted_journals,
        count(*) FILTER(WHERE status='pending_approval')::int AS pending_journals,
        coalesce(sum(amount) FILTER(WHERE status='posted'),0)::numeric(18,2) AS posted_volume
        FROM accounting_journals WHERE entity_id=$1`,[entityId])).rows[0];
      const monthly=(await client.query(`SELECT months.month_start::date::text AS month,
        count(j.id) FILTER(WHERE j.status='posted')::int AS posted_journals,
        coalesce(sum(j.amount) FILTER(WHERE j.status='posted'),0)::numeric(18,2)::text AS posted_volume
        FROM generate_series(date_trunc('month',current_date)-interval '11 months',
          date_trunc('month',current_date),interval '1 month') AS months(month_start)
        LEFT JOIN accounting_journals j ON j.entity_id=$1
          AND j.entry_date>=months.month_start::date
          AND j.entry_date<(months.month_start+interval '1 month')::date
        GROUP BY months.month_start ORDER BY months.month_start`,[entityId])).rows;
      return { ...totals, monthly };
    });
    res.json(summary);
  }));

  router.get('/entities/:entityId/reports/:report', h(async(req,res)=>{
    const entityId=UUID.parse(req.params.entityId);
    await assertAccess(withUser,req.user!,entityId,roles);
    const report=z.enum(['trial-balance','income-statement','balance-sheet','general-ledger']).parse(req.params.report);
    const range=z.object({from:z.string().date().optional(),to:z.string().date().optional(),account_code:accountCode.optional()}).parse(req.query);
    if(range.from&&range.to&&range.from>range.to)throw new HttpError(400,'Report start date must be on or before its end date');
    const result=await withUser(req.user!,async(client)=>{
      const params:unknown[]=[entityId];
      let periodFilter='';
      if(range.from){params.push(range.from);periodFilter+=` AND j.entry_date >= $${params.length}::date`;}
      if(range.to){params.push(range.to);periodFilter+=` AND j.entry_date <= $${params.length}::date`;}
      if(report==='balance-sheet'){
        params.length=1;
        periodFilter=range.to?(params.push(range.to),` AND j.entry_date <= $2::date`):' AND j.entry_date <= current_date';
      }
      let accountFilter='';
      if(report==='income-statement')accountFilter=" AND a.account_type IN ('revenue','expense')";
      if(report==='balance-sheet')accountFilter=" AND a.account_type IN ('asset','liability','equity')";
      if(report==='general-ledger'&&range.account_code){params.push(range.account_code);accountFilter=` AND a.code=$${params.length}`;}
      if(report==='general-ledger'){
        const rows=(await client.query(`SELECT a.code,a.name,a.account_type,j.entry_date,j.source_reference,j.description AS journal_description,
          l.description AS line_description,l.debit::numeric(18,2) AS debit,l.credit::numeric(18,2) AS credit,j.id AS journal_id
          FROM accounting_accounts a JOIN accounting_journal_lines l ON l.account_id=a.id AND l.entity_id=a.entity_id
          JOIN accounting_journals j ON j.id=l.journal_id AND j.entity_id=l.entity_id
          WHERE a.entity_id=$1 AND j.status='posted'${periodFilter}${accountFilter}
          ORDER BY a.code,j.entry_date,j.created_at,j.id,l.line_no LIMIT 5000`,params)).rows;
        const running=new Map<string,bigint>();
        if(range.from){
          const openingParams:unknown[]=[entityId,range.from];
          let openingAccountFilter='';
          if(range.account_code){openingParams.push(range.account_code);openingAccountFilter=` AND a.code=$3`;}
          const openings=(await client.query(`SELECT a.code,coalesce(sum(l.debit-l.credit),0)::numeric(18,2) AS balance
            FROM accounting_accounts a JOIN accounting_journal_lines l ON l.account_id=a.id AND l.entity_id=a.entity_id
            JOIN accounting_journals j ON j.id=l.journal_id AND j.entity_id=l.entity_id
            WHERE a.entity_id=$1 AND j.status='posted' AND j.entry_date<$2::date${openingAccountFilter}
            GROUP BY a.code`,openingParams)).rows;
          for(const opening of openings)running.set(opening.code,toCents(String(opening.balance)));
        }
        for(const row of rows){const balance=(running.get(row.code)??0n)+toCents(String(row.debit))-toCents(String(row.credit));running.set(row.code,balance);row.running_balance=centsDecimal(balance);}
        const entity=(await client.query('SELECT name,base_currency FROM accounting_entities WHERE id=$1',[entityId])).rows[0];
        return {entity,report,from:range.from??null,to:range.to??null,generated_at:new Date().toISOString(),rows,
          totals:{debit:centsDecimal(rows.reduce((n,r)=>n+toCents(String(r.debit)),0n)),credit:centsDecimal(rows.reduce((n,r)=>n+toCents(String(r.credit)),0n))}};
      }
      const rows=(await client.query(`SELECT a.code,a.name,a.account_type,a.normal_balance,
        coalesce(sum(l.debit) FILTER(WHERE j.id IS NOT NULL),0)::numeric(18,2) AS debit,
        coalesce(sum(l.credit) FILTER(WHERE j.id IS NOT NULL),0)::numeric(18,2) AS credit,
        (coalesce(sum(l.debit-l.credit) FILTER(WHERE j.id IS NOT NULL),0))::numeric(18,2) AS net,
        count(DISTINCT j.id)::int AS journal_count
        FROM accounting_accounts a LEFT JOIN accounting_journal_lines l ON l.account_id=a.id AND l.entity_id=a.entity_id
        LEFT JOIN accounting_journals j ON j.id=l.journal_id AND j.entity_id=l.entity_id AND j.status='posted'${periodFilter}
        WHERE a.entity_id=$1${accountFilter} GROUP BY a.id ORDER BY a.code`,params)).rows;
      if(report==='balance-sheet'){
        const earnings=(await client.query(`SELECT coalesce(sum(CASE
          WHEN a.account_type='revenue' THEN l.credit-l.debit
          WHEN a.account_type='expense' THEN l.credit-l.debit ELSE 0 END),0)::numeric(18,2) AS amount
          FROM accounting_journals j JOIN accounting_journal_lines l ON l.journal_id=j.id AND l.entity_id=j.entity_id
          JOIN accounting_accounts a ON a.id=l.account_id AND a.entity_id=l.entity_id
          WHERE j.entity_id=$1 AND j.status='posted' AND j.entry_date <= $2::date AND a.account_type IN ('revenue','expense')`,[entityId,range.to??new Date().toISOString().slice(0,10)])).rows[0];
        const amount=toCents(String(earnings.amount));
        if(amount!==0n)rows.push({code:'CURRENT-EARNINGS',name:'Current period earnings',account_type:'equity',normal_balance:'credit',debit:centsDecimal(amount<0n?-amount:0n),credit:centsDecimal(amount>0n?amount:0n),net:centsDecimal(-amount),journal_count:0});
      }
      const entity=(await client.query('SELECT name,base_currency FROM accounting_entities WHERE id=$1',[entityId])).rows[0];
      return {entity,report,from:range.from??null,to:range.to??null,generated_at:new Date().toISOString(),rows,
        totals:{debit:centsDecimal(rows.reduce((n,r)=>n+toCents(String(r.debit)),0n)),credit:centsDecimal(rows.reduce((n,r)=>n+toCents(String(r.credit)),0n))}};
    });
    sendReport(req,res,result);
  }));

  router.get('/entities/:entityId/consolidation', h(async(req,res)=>{
    const entityId=UUID.parse(req.params.entityId); await assertAccess(withUser,req.user!,entityId,['entity_admin','finance_manager','consolidated_viewer']);
    const rows=await withUser(req.user!,async(client)=>(await client.query(`SELECT t.entity_id,e.name,e.entity_type,t.posted_journals,t.posted_volume,t.refreshed_at
      FROM accounting_consolidated_totals t JOIN accounting_entities e ON e.id=t.entity_id
      WHERE t.parent_entity_id=$1 ORDER BY e.name`,[entityId])).rows);
    res.json(rows);
  }));
  return router;
}
