import express, { Router, Request, Response, RequestHandler } from 'express';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { pool, withUser, requireActivity, requireAnyActivity, requireRole, HttpError, isPlatformAdminRole } from './core.js';
import { audit, post } from './domain.js';
import { sniff } from './files.js';
import { notify } from './notify.js';
import { rentSchedule, rentScheduleForPeriod, endDate } from './rent.js';
import { refundLimit } from './refunds.js';
import { loadRules } from './domain.js';
import { getFile, putFile } from './storage.js';
import { Phone } from './validators.js';
import { legacyImmediateLeasesEnabled } from './runtime-config.js';
import { toCsv } from './csv.js';
import { PROPERTY_CHART_OF_ACCOUNTS, propertyPeriodCloseCheck } from './property-accounting.js';
import { enqueueAccountingEvent } from './accounting-outbox.js';
import { propertyVendorAccounting } from './property-vendor-accounting.js';
import { propertyVendorPortal } from './property-vendor-portal.js';
import { staffingAccounting } from './staffing-accounting.js';
import { workforceOperations } from './workforce-operations.js';
import { canTransitionMaintenance, requiresMaintenanceReview } from './maintenance-workflow.js';
import { leaseMoneyToCents, normalizeLeaseMoney, validateLeaseRenewalTerm } from './lease-renewals.js';

export const ops = Router();
ops.use(propertyVendorAccounting);
ops.use(propertyVendorPortal);
ops.use(staffingAccounting);
ops.use(workforceOperations);
const h = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler => (req, res, next) => { fn(req, res).catch(next); };
const AGENT = ['master_agent', 'field_agent'];
const SUPPORT_STAFF = ['global_admin', 'super_admin', 'compliance', 'corporate_business_manager'] as const;
const isSupportStaff = (role: string) => SUPPORT_STAFF.some((staffRole) => staffRole === role);

const AssistantMessageInput = z.object({
  message: z.string().trim().min(1).max(4000),
}).strict();

ops.get('/assistant/availability', h(async (req, res) => {
  res.json(await withUser(req.user!, async (client) => {
    const [online, own] = await Promise.all([
      client.query(
        `SELECT count(*)::int AS count FROM assistant_support_presence
         WHERE available=true AND updated_at>now()-interval '2 minutes'`,
      ),
      client.query(
        `SELECT available AND updated_at>now()-interval '2 minutes' AS available
         FROM assistant_support_presence WHERE user_id=$1`,
        [req.user!.id],
      ),
    ]);
    return { online_count: online.rows[0].count, available: own.rows[0]?.available ?? false };
  }));
}));

ops.put('/assistant/availability', requireRole(...SUPPORT_STAFF), h(async (req, res) => {
  const body = z.object({ available: z.boolean() }).strict().parse(req.body);
  const presence = await withUser(req.user!, async (client) => (await client.query(
    `INSERT INTO assistant_support_presence (user_id,available,updated_at)
     VALUES ($1,$2,now())
     ON CONFLICT (user_id) DO UPDATE SET available=EXCLUDED.available,updated_at=now()
     RETURNING available`,
    [req.user!.id,body.available],
  )).rows[0]);
  res.json(presence);
}));

ops.get('/assistant/conversations/mine', h(async (req, res) => {
  res.json(await withUser(req.user!, async (client) => (await client.query(
    `SELECT id,owner_role,status,created_at,last_message_at FROM assistant_conversations
     WHERE owner_id=$1 ORDER BY last_message_at DESC LIMIT 50`,
    [req.user!.id],
  )).rows));
}));

ops.get('/assistant/conversations/queue', requireRole(...SUPPORT_STAFF), h(async (req, res) => {
  res.json(await withUser(req.user!, async (client) => (await client.query(
    'SELECT * FROM app_assistant_conversation_queue()',
  )).rows));
}));

ops.post('/assistant/conversations', h(async (req, res) => {
  const { message } = AssistantMessageInput.parse(req.body);
  const conversation = await withUser(req.user!, async (client) => {
    const created = (await client.query(
      `INSERT INTO assistant_conversations (owner_id,owner_role)
       VALUES ($1,$2) RETURNING id,owner_role,status,created_at,last_message_at`,
      [req.user!.id,req.user!.role],
    )).rows[0];
    await client.query(
      `INSERT INTO assistant_messages (conversation_id,sender_id,sender_role,sender_type,body)
       VALUES ($1,$2,$3,'user',$4)`,
      [created.id,req.user!.id,req.user!.role,message],
    );
    await audit(client,req.user!.id,'assistant_conversation_created','assistant_conversation',created.id,null,{
      owner_role: req.user!.role,
    });
    await audit(client,req.user!.id,'assistant_message_sent','assistant_conversation',created.id,null,{
      sender_type: 'user',
    });
    return created;
  });
  res.status(201).json(conversation);
}));

ops.get('/assistant/conversations/:id/messages', h(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const messages = await withUser(req.user!, async (client) => {
    const conversation = await client.query(
      'SELECT id FROM assistant_conversations WHERE id=$1',
      [id],
    );
    if (!conversation.rowCount) throw new HttpError(404,'Conversation not found');
    return (await client.query(
      `SELECT id,sender_id,sender_role,sender_type,body,created_at
       FROM assistant_messages WHERE conversation_id=$1 ORDER BY created_at,id LIMIT 500`,
      [id],
    )).rows;
  });
  res.json(messages);
}));

ops.post('/assistant/conversations/:id/claim', requireRole(...SUPPORT_STAFF), h(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const claimed = await withUser(req.user!, async (client) => {
    const result = await client.query('SELECT app_claim_assistant_conversation($1) AS id',[id]);
    if (!result.rows[0]?.id) throw new HttpError(409,'This conversation is already assigned or unavailable');
    await audit(client,req.user!.id,'assistant_conversation_claimed','assistant_conversation',id,null,{});
    return result.rows[0];
  });
  res.json(claimed);
}));

ops.post('/assistant/conversations/:id/messages', h(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const { message } = AssistantMessageInput.parse(req.body);
  const created = await withUser(req.user!, async (client) => {
    const conversation = (await client.query(
      'SELECT owner_id,assigned_to FROM assistant_conversations WHERE id=$1',
      [id],
    )).rows[0];
    if (!conversation) throw new HttpError(404,'Conversation not found');
    const isOwner = conversation.owner_id === req.user!.id;
    const isAssignedStaff = conversation.assigned_to === req.user!.id && isSupportStaff(req.user!.role);
    if (!isOwner && !isAssignedStaff) throw new HttpError(404,'Conversation not found');
    const senderType = isAssignedStaff ? 'staff' : 'user';
    const row = (await client.query(
      `INSERT INTO assistant_messages (conversation_id,sender_id,sender_role,sender_type,body)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id,sender_id,sender_role,sender_type,body,created_at`,
      [id,req.user!.id,req.user!.role,senderType,message],
    )).rows[0];
    await audit(client,req.user!.id,'assistant_message_sent','assistant_conversation',id,null,{
      sender_type: senderType,
    });
    return row;
  });
  res.status(201).json(created);
}));

const SupportCaseInput = z.object({
  category: z.enum(['general','service','agent_complaint','financial','legal','privacy','safety','fraud']),
  subject_user_id: z.string().uuid().optional(),
  subject: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(4000),
}).strict().superRefine((value, context) => {
  if ((value.category === 'agent_complaint') !== Boolean(value.subject_user_id)) {
    context.addIssue({ code: 'custom', message: 'Only an agent complaint may identify a subject user' });
  }
});

ops.post('/support/cases', h(async (req, res) => {
  const body = SupportCaseInput.parse(req.body);
  const row = await withUser(req.user!, async (client) => {
    if (body.subject_user_id) {
      const subject = (await client.query(
        `SELECT id FROM users WHERE id=$1 AND role IN ('master_agent','field_agent') AND active=true`,
        [body.subject_user_id],
      )).rows[0];
      if (!subject) throw new HttpError(422, 'Choose an active Agent as the complaint subject');
    }
    const priority = ['safety','fraud','privacy','legal'].includes(body.category) ? 'urgent' : 'normal';
    const created = (await client.query(
      `INSERT INTO support_cases (user_id,category,subject_user_id,subject,description,priority)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id,category,subject,description,priority,status,created_at`,
      [req.user!.id,body.category,body.subject_user_id ?? null,body.subject,body.description,priority],
    )).rows[0];
    await client.query(
      `INSERT INTO support_case_events (case_id,actor_id,event_type,new_status)
       VALUES ($1,$2,'created','open')`,
      [created.id,req.user!.id],
    );
    await audit(client,req.user!.id,'support_case_created','support_case',created.id,null,{
      category: body.category,priority,
    });
    return created;
  });
  res.status(201).json(row);
}));

ops.get('/support/agents', h(async (req, res) => {
  res.json(await withUser(req.user!, async (client) => (await client.query(
    `SELECT id,legal_name FROM users
     WHERE role IN ('master_agent','field_agent') AND active=true
     ORDER BY legal_name LIMIT 500`,
  )).rows));
}));

ops.get('/support/cases/mine', h(async (req, res) => {
  res.json(await withUser(req.user!, async (client) => (await client.query(
    `SELECT c.id,c.category,c.subject,c.description,c.priority,c.status,c.outcome,c.rationale,c.corrective_action,
       c.refund_reference,c.formal_workflow_reference,c.appeal_route,c.created_at,c.updated_at,c.resolved_at,
       review.decision AS appeal_decision,review.rationale AS appeal_rationale,
       review.corrective_action AS appeal_corrective_action,review.reviewed_at AS appeal_reviewed_at
     FROM support_cases c
     LEFT JOIN support_case_appeal_reviews review ON review.case_id=c.id
     WHERE c.user_id=$1 ORDER BY c.created_at DESC LIMIT 100`,
    [req.user!.id],
  )).rows));
}));

ops.get('/support/cases/queue', requireRole(...SUPPORT_STAFF), h(async (req, res) => {
  res.json(await withUser(req.user!, async (client) => (await client.query(
    'SELECT * FROM app_support_case_queue()',
  )).rows));
}));

ops.get('/support/cases/appeals/queue', requireRole('global_admin','super_admin','compliance'), h(async (req, res) => {
  res.json(await withUser(req.user!, async (client) => (await client.query(
    'SELECT * FROM app_support_appeal_queue()',
  )).rows));
}));

ops.get('/support/cases/:id', h(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const row = await withUser(req.user!, async (client) => (await client.query(
    `SELECT c.id,c.user_id,c.category,c.subject_user_id,c.subject,c.description,c.priority,c.status,
       c.created_at,c.updated_at,c.outcome,c.rationale,c.corrective_action,c.refund_reference,
       c.formal_workflow_reference,c.appeal_route,c.resolved_at,c.resolved_by,
       (SELECT max(a.expires_at) FROM support_case_access_requests a
        WHERE a.case_id=c.id AND a.requested_by=$2 AND a.status='approved' AND a.expires_at>now())
         AS sensitive_access_expires_at,
       review.decision AS appeal_decision,review.rationale AS appeal_rationale,
       review.corrective_action AS appeal_corrective_action,
       review.formal_workflow_reference AS appeal_formal_workflow_reference,
       review.reviewed_at AS appeal_reviewed_at
     FROM support_cases c
     LEFT JOIN support_case_appeal_reviews review ON review.case_id=c.id
     WHERE c.id=$1 AND (
       c.user_id=$2 OR EXISTS (
         SELECT 1 FROM support_case_access_requests a
         WHERE a.case_id=c.id AND a.requested_by=$2 AND a.status='approved' AND a.expires_at>now()
       )
     )`,
    [id,req.user!.id],
  )).rows[0]);
  if (!row) throw new HttpError(404,'Support case not found or sensitive access is not approved');
  res.json(row);
}));

ops.post('/support/cases/:id/appeal-review', requireRole('global_admin','super_admin','compliance'), h(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const body = z.object({
    decision:z.enum(['upheld','overturned']),
    rationale:z.string().trim().min(10).max(2000),
    corrective_action:z.string().trim().min(5).max(2000).optional(),
    formal_workflow_reference:z.string().trim().min(3).max(200).optional(),
  }).strict().parse(req.body);
  if (body.decision==='overturned' && !body.corrective_action) {
    throw new HttpError(422,'An overturned appeal must document the corrective action');
  }
  const row = await withUser(req.user!, async (client) => {
    const current = (await client.query(
      `SELECT c.user_id,c.category,c.status,c.resolved_by
       FROM support_cases c
       WHERE c.id=$1 AND EXISTS (
         SELECT 1 FROM support_case_access_requests a
         WHERE a.case_id=c.id AND a.requested_by=$2 AND a.status='approved' AND a.expires_at>now()
       ) FOR UPDATE`,
      [id,req.user!.id],
    )).rows[0];
    if (!current) throw new HttpError(404,'Support case not found or sensitive access is not approved');
    if (current.status!=='appealed') throw new HttpError(409,'Only an appealed case can receive an appeal review');
    if (current.resolved_by===req.user!.id) throw new HttpError(403,'The original resolution author cannot review its appeal');
    const priorReview = (await client.query(
      'SELECT id FROM support_case_appeal_reviews WHERE case_id=$1',
      [id],
    )).rows[0];
    if (priorReview) throw new HttpError(409,'This appeal has already received an independent review');
    if (['financial','legal'].includes(current.category)
      && body.decision==='overturned' && !body.formal_workflow_reference) {
      throw new HttpError(422,'Overturned financial and legal appeals must reference their formal workflow');
    }
    const review = (await client.query(
      `INSERT INTO support_case_appeal_reviews(
         case_id,decision,rationale,corrective_action,formal_workflow_reference,reviewed_by
       ) VALUES($1,$2,$3,$4,$5,$6)
       RETURNING id,case_id,decision,rationale,corrective_action,formal_workflow_reference,reviewed_at`,
      [id,body.decision,body.rationale,body.corrective_action ?? null,
        body.formal_workflow_reference ?? null,req.user!.id],
    )).rows[0];
    await client.query(
      `INSERT INTO support_case_events(case_id,actor_id,event_type,reason)
       VALUES($1,$2,'appeal_reviewed',$3)`,
      [id,req.user!.id,body.rationale],
    );
    await audit(client,req.user!.id,'support_case_appeal_reviewed','support_case',id,null,{
      decision:body.decision,review_id:review.id,
    });
    await notify(client,current.user_id,'support_case_appeal_reviewed',{
      case_id:id,decision:body.decision,
    });
    return review;
  });
  res.status(201).json(row);
}));

ops.get('/support/cases/:id/events', h(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const events = await withUser(req.user!, async (client) => {
    const visible = (await client.query(
      `SELECT 1 FROM support_cases c
       WHERE c.id=$1 AND (
         c.user_id=$2 OR EXISTS (
           SELECT 1 FROM support_case_access_requests a
           WHERE a.case_id=c.id AND a.requested_by=$2 AND a.status='approved' AND a.expires_at>now()
         )
       )`,
      [id,req.user!.id],
    )).rowCount;
    if (!visible) throw new HttpError(404,'Support case not found or sensitive access is not approved');
    return (await client.query(
      `SELECT e.id,e.event_type,e.prior_status,e.new_status,e.reason,e.created_at,u.legal_name AS actor_name
       FROM support_case_events e JOIN users u ON u.id=e.actor_id
       WHERE e.case_id=$1 ORDER BY e.created_at,e.id LIMIT 500`,
      [id],
    )).rows;
  });
  res.json(events);
}));

ops.post('/support/cases/:id/access-requests', requireRole(...SUPPORT_STAFF), h(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const body = z.object({ reason:z.string().trim().min(10).max(1000) }).strict().parse(req.body);
  const request = await withUser(req.user!, async (client) => {
    const exists = (await client.query(
      `SELECT app_support_case_exists_for_staff($1) AS exists,
         app_support_case_can_request_access($1) AS allowed`,
      [id],
    )).rows[0];
    if (!exists?.exists) throw new HttpError(404,'Support case not found');
    if (!exists.allowed) throw new HttpError(403,'The original resolution author cannot request access to review this appeal');
    const pending = (await client.query(
      `SELECT id FROM support_case_access_requests
       WHERE case_id=$1 AND requested_by=$2 AND status='pending'`,
      [id,req.user!.id],
    )).rows[0];
    if (pending) throw new HttpError(409,'A sensitive-access request is already pending');
    const created = (await client.query(
      `INSERT INTO support_case_access_requests (case_id,requested_by,request_reason)
       VALUES ($1,$2,$3) RETURNING id,case_id,status,requested_at`,
      [id,req.user!.id,body.reason],
    )).rows[0];
    await client.query(
      `INSERT INTO support_case_events (case_id,actor_id,event_type,reason)
       VALUES ($1,$2,'access_requested',$3)`,
      [id,req.user!.id,body.reason],
    );
    return created;
  });
  res.status(201).json(request);
}));

ops.get('/support/access-requests', requireRole('global_admin','super_admin','compliance'), h(async (req, res) => {
  res.json(await withUser(req.user!, async (client) => (await client.query(
    `SELECT a.id,a.case_id,a.requested_by,u.legal_name AS requester_name,a.request_reason,a.requested_at
     FROM support_case_access_requests a JOIN users u ON u.id=a.requested_by
     WHERE a.status='pending' ORDER BY a.requested_at LIMIT 200`,
  )).rows));
}));

ops.post('/support/access-requests/:id/decision', requireRole('global_admin','super_admin','compliance'), h(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const body = z.object({ decision:z.enum(['approve','deny']), reason:z.string().trim().min(10).max(1000) }).strict().parse(req.body);
  const row = await withUser(req.user!, async (client) => {
    const request = (await client.query(
      `SELECT id,case_id,requested_by,status FROM support_case_access_requests WHERE id=$1 FOR UPDATE`,
      [id],
    )).rows[0];
    if (!request) throw new HttpError(404,'Sensitive-access request not found');
    if (request.status!=='pending') throw new HttpError(409,'Sensitive-access request has already been decided');
    if (request.requested_by===req.user!.id) throw new HttpError(403,'The requester cannot approve their own sensitive access');
    const status = body.decision==='approve' ? 'approved' : 'denied';
    const updated = (await client.query(
      `UPDATE support_case_access_requests SET status=$2,reviewed_by=$3,review_reason=$4,
         reviewed_at=now(),expires_at=CASE WHEN $2='approved' THEN now()+interval '15 minutes' ELSE NULL END
       WHERE id=$1 RETURNING id,case_id,status,reviewed_at,expires_at`,
      [id,status,req.user!.id,body.reason],
    )).rows[0];
    await client.query(
      `INSERT INTO support_case_events (case_id,actor_id,event_type,reason)
       VALUES ($1,$2,'access_decided',$3)`,
      [request.case_id,req.user!.id,body.reason],
    );
    await audit(client,req.user!.id,'support_case_sensitive_access_'+body.decision,'support_case',request.case_id,
      {status:'pending'},{status,request_id:id,expires_at:updated.expires_at ?? null});
    return updated;
  });
  res.json(row);
}));

ops.patch('/support/cases/:id/status', requireRole(...SUPPORT_STAFF), h(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const body = z.object({
    status:z.enum(['in_progress','pending_customer','escalated']),
    reason:z.string().trim().min(10).max(1000),
  }).strict().parse(req.body);
  const row = await withUser(req.user!, async (client) => {
    const current = (await client.query(
      `SELECT c.status,c.user_id FROM support_cases c WHERE c.id=$1 AND EXISTS (
         SELECT 1 FROM support_case_access_requests a
         WHERE a.case_id=c.id AND a.requested_by=$2 AND a.status='approved' AND a.expires_at>now()
       ) FOR UPDATE`,
      [id,req.user!.id],
    )).rows[0];
    if (!current) throw new HttpError(404,'Support case not found');
    if (['resolved','appealed'].includes(current.status)) throw new HttpError(409,'Closed cases cannot be moved back to an open state');
    await client.query("SELECT set_config('app.support_case_reason',$1,true)",[body.reason]);
    const updated = (await client.query(
      `UPDATE support_cases SET status=$2,updated_at=now() WHERE id=$1 RETURNING id,status,updated_at`,
      [id,body.status],
    )).rows[0];
    await notify(client,current.user_id,'support_case_status_changed',{case_id:id,status:body.status});
    return updated;
  });
  res.json(row);
}));

ops.post('/support/cases/:id/resolve', requireRole(...SUPPORT_STAFF), h(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const body = z.object({
    outcome:z.string().trim().min(5).max(2000),
    rationale:z.string().trim().min(10).max(2000),
    corrective_action:z.string().trim().min(5).max(2000),
    refund_reference:z.string().trim().min(2).max(200),
    formal_workflow_reference:z.string().trim().min(3).max(200).optional(),
    appeal_route:z.string().trim().min(5).max(1000),
  }).strict().parse(req.body);
  const row = await withUser(req.user!, async (client) => {
    const current = (await client.query(
      `SELECT c.user_id,c.category,c.status FROM support_cases c
       WHERE c.id=$1 AND EXISTS (
         SELECT 1 FROM support_case_access_requests a
         WHERE a.case_id=c.id AND a.requested_by=$2 AND a.status='approved' AND a.expires_at>now()
       ) FOR UPDATE`,
      [id,req.user!.id],
    )).rows[0];
    if (!current) throw new HttpError(404,'Support case not found or sensitive access is not approved');
    if (current.status==='resolved'||current.status==='appealed') throw new HttpError(409,'Support case is already closed');
    if (['financial','legal'].includes(current.category) && !body.formal_workflow_reference) {
      throw new HttpError(422,'Financial and legal corrections must reference their formal workflow');
    }
    await client.query("SELECT set_config('app.support_case_reason',$1,true)",[body.rationale]);
    await client.query(
      `UPDATE support_cases SET status='resolved',outcome=$2,rationale=$3,corrective_action=$4,
         refund_reference=$5,formal_workflow_reference=$6,appeal_route=$7,resolved_by=$8,
         resolved_at=now(),updated_at=now() WHERE id=$1`,
      [id,body.outcome,body.rationale,body.corrective_action,body.refund_reference,
        body.formal_workflow_reference ?? null,body.appeal_route,req.user!.id],
    );
    await audit(client,req.user!.id,'support_case_resolved','support_case',id,{status:current.status},{
      status:'resolved',formal_workflow_reference:body.formal_workflow_reference ?? null,
    });
    await notify(client,current.user_id,'support_case_resolved',{case_id:id,appeal_route:body.appeal_route});
    return (await client.query(
      `SELECT id,status,outcome,rationale,corrective_action,refund_reference,formal_workflow_reference,
         appeal_route,resolved_at FROM support_cases WHERE id=$1`,
      [id],
    )).rows[0];
  });
  res.json(row);
}));

ops.post('/support/cases/:id/appeal', h(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const body = z.object({ reason:z.string().trim().min(10).max(2000) }).strict().parse(req.body);
  const row = await withUser(req.user!, async (client) => {
    const current = (await client.query(
      `SELECT status FROM support_cases WHERE id=$1 AND user_id=$2 FOR UPDATE`,
      [id,req.user!.id],
    )).rows[0];
    if (!current) throw new HttpError(404,'Support case not found');
    if (current.status!=='resolved') throw new HttpError(409,'Only a resolved case can be appealed');
    await client.query("SELECT set_config('app.support_case_reason',$1,true)",[body.reason]);
    const updated = (await client.query(
      `UPDATE support_cases SET status='appealed',updated_at=now() WHERE id=$1 RETURNING id,status,updated_at`,
      [id],
    )).rows[0];
    await audit(client,req.user!.id,'support_case_appealed','support_case',id,{status:'resolved'},{status:'appealed'});
    return updated;
  });
  res.json(row);
}));

ops.get('/accounting-event-outbox/status', requireRole('global_admin','finance','finance_manager'), h(async(req,res)=>{
  const rows=await withUser(req.user!,async(client)=>(await client.query(
    `SELECT id,source_event_id,source_entity_id,status,attempts,next_attempt_at,delivered_at,last_error,created_at
     FROM accounting_event_outbox ORDER BY created_at DESC LIMIT 200`,
  )).rows);
  res.json(rows);
}));

ops.post('/accounting-event-outbox/:id/retry', requireRole('global_admin','finance_manager'), h(async(req,res)=>{
  const id=z.string().uuid().parse(req.params.id);
  const row=await withUser(req.user!,async(client)=>(await client.query(
    `UPDATE accounting_event_outbox SET status='pending',attempts=0,next_attempt_at=now(),locked_until=NULL,last_error=NULL
     WHERE id=$1 AND status='dead' RETURNING id,source_event_id,status`,[id],
  )).rows[0]);
  if(!row)throw new HttpError(404,'Dead Accounting event was not found');
  res.json(row);
}));

ops.get('/owner/statements', requireRole('property_owner'), h(async (req, res) => {
  const format = z.enum(['json', 'csv']).default('json').parse(req.query.format ?? 'json');
  const statements = await withUser(req.user!, async (client) => (await client.query(
    `SELECT l.id AS lease_id,p.id AS property_id,p.address,u.unit_no,l.start_date,l.rent_start_on,l.end_date,l.status,
       l.rent::text AS monthly_rent,l.deposit::text AS agreed_deposit,
       COALESCE((SELECT sum(c.amount) FROM rent_charges c WHERE c.lease_id=l.id AND c.status<>'waived'),0)::text AS rent_charged,
       COALESCE((SELECT sum(t.amount) FROM rent_transactions t WHERE t.lease_id=l.id AND t.kind='rent' AND t.status='reconciled'),0)::text AS rent_reconciled,
       COALESCE((SELECT sum(t.amount) FROM rent_transactions t WHERE t.lease_id=l.id AND t.kind='rent' AND t.status='pending'),0)::text AS rent_pending_reconciliation,
       COALESCE((SELECT sum(t.amount) FROM rent_transactions t WHERE t.lease_id=l.id AND t.kind='deposit' AND t.status='reconciled'),0)::text AS deposit_reconciled,
       COALESCE((SELECT sum(t.amount) FROM rent_transactions t WHERE t.lease_id=l.id AND t.kind='deposit_refund' AND t.status='reconciled'),0)::text AS deposit_refunded,
       COALESCE((SELECT sum(t.amount) FROM rent_transactions t WHERE t.lease_id=l.id AND t.kind='deposit_refund' AND t.status='pending'),0)::text AS deposit_refund_pending,
       COALESCE((SELECT inspection.deposit_deduction FROM lease_move_out_inspections inspection
         WHERE inspection.lease_id=l.id AND inspection.status='approved'),0)::text AS approved_deposit_deduction,
       GREATEST(0,
         COALESCE((SELECT sum(t.amount) FROM rent_transactions t WHERE t.lease_id=l.id AND t.kind='deposit' AND t.status='reconciled'),0)
         - COALESCE((SELECT inspection.deposit_deduction FROM lease_move_out_inspections inspection
           WHERE inspection.lease_id=l.id AND inspection.status='approved'),0)
         - COALESCE((SELECT sum(t.amount) FROM rent_transactions t WHERE t.lease_id=l.id AND t.kind='deposit_refund' AND t.status<>'void'),0)
       )::text AS approved_deposit_refund_remaining,
       (SELECT max(t.reconciled_at) FROM rent_transactions t WHERE t.lease_id=l.id AND t.status='reconciled') AS last_reconciled_at
     FROM leases l JOIN property_units u ON u.id=l.unit_id JOIN properties p ON p.id=u.property_id
     WHERE p.owner_user_id=$1 ORDER BY l.created_at DESC LIMIT 500`,
    [req.user!.id],
  )).rows);
  const note = 'Shows recorded lease charges and reconciled receipts. This is not a payout, remittance, or trust-account statement.';
  if (format === 'csv') {
    const columns = [
      'lease_id', 'property_id', 'address', 'unit_no', 'start_date', 'end_date', 'status',
      'monthly_rent', 'agreed_deposit', 'rent_charged', 'rent_reconciled',
      'rent_pending_reconciliation', 'deposit_reconciled', 'deposit_refunded',
      'deposit_refund_pending', 'approved_deposit_deduction',
      'approved_deposit_refund_remaining', 'last_reconciled_at',
    ] as const;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="owner-rent-statement.csv"');
    res.setHeader('X-Statement-Disclaimer', note);
    return res.send(toCsv(statements, columns));
  }
  res.json({ statements, note });
}));

// ================= Disputes =================
ops.post('/disputes', requireRole(...AGENT, 'super_admin', 'global_admin', 'compliance'), h(async (req, res) => {
  const b = z.object({ contract_id: z.string().uuid(), category: z.enum(['payment', 'service', 'worker_conduct', 'fees', 'other']), description: z.string().min(10) }).parse(req.body);
  const row = await withUser(req.user!, async (c) => {
    if (!(await c.query('SELECT 1 FROM contracts WHERE id = $1', [b.contract_id])).rowCount) throw new HttpError(404, 'Contract not found');
    const r = await c.query('INSERT INTO disputes (contract_id, category, description, opened_by) VALUES ($1,$2,$3,$4) RETURNING *', [b.contract_id, b.category, b.description, req.user!.id]);
    await audit(c, req.user!.id, 'dispute_opened', 'dispute', r.rows[0].id, null, { category: b.category });
    return r.rows[0];
  });
  res.status(201).json(row);
}));

ops.get('/disputes', h(async (req, res) => {
  res.json(await withUser(req.user!, async (c) => (await c.query('SELECT d.*, k.contract_no FROM disputes d JOIN contracts k ON k.id = d.contract_id ORDER BY d.opened_at DESC LIMIT 200')).rows));
}));

ops.post('/disputes/:id/assign', requireRole('super_admin', 'global_admin'), h(async (req, res) => {
  const { user_id } = z.object({ user_id: z.string().uuid() }).parse(req.body);
  res.json(await withUser(req.user!, async (c) => {
    const r = await c.query("UPDATE disputes SET assigned_to = $2, status = 'investigating' WHERE id = $1 AND status <> 'resolved' RETURNING *", [req.params.id, user_id]);
    if (!r.rowCount) throw new HttpError(409, 'Dispute not found or already resolved');
    await audit(c, req.user!.id, 'dispute_assigned', 'dispute', String(req.params.id), null, { user_id });
    return r.rows[0];
  }));
}));

/** Resolving may include a refund. The refund is a new ledger transaction, never an edit of the original one. */
ops.post('/disputes/:id/resolve', requireRole('super_admin', 'global_admin', 'compliance'), h(async (req, res) => {
  const b = z.object({ resolution: z.string().min(10), refund_amount: z.number().nonnegative().transform((x) => Math.round(x * 100) / 100).default(0), refund_kind: z.enum(['fee', 'guarantee']).optional() }).parse(req.body);
  if (b.refund_amount > 0 && !b.refund_kind) throw new HttpError(400, 'Say whether this refunds fees or the guarantee');
  if (b.refund_amount > 0 && !isPlatformAdminRole(req.user!.role)) throw new HttpError(403, 'Only a platform administrator can approve a refund');
  res.json(await withUser(req.user!, async (c) => {
    const d = (await c.query('SELECT * FROM disputes WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!d) throw new HttpError(404, 'Dispute not found');
    if (d.status === 'resolved') throw new HttpError(409, 'Already resolved');
    if (d.opened_by === req.user!.id) throw new HttpError(403, 'The person who opened a dispute cannot resolve it');
    const k = (await c.query('SELECT * FROM contracts WHERE id = $1', [d.contract_id])).rows[0];
    if (b.refund_amount > 0) {
      if (!['active', 'completed', 'closed'].includes(k.state)) throw new HttpError(422, 'Nothing was collected on this contract yet');
      // Two disputes on one contract could otherwise both pass the limit check below and refund more than was collected.
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', ['refund:' + d.contract_id]);
      const done = Number((await c.query("SELECT coalesce(sum(refund_amount),0) AS s FROM disputes WHERE contract_id = $1 AND refund_kind = $2 AND status = 'resolved'", [d.contract_id, b.refund_kind])).rows[0].s);
      const rules = await loadRules(c);
      const capPercent = b.refund_kind === 'guarantee' ? rules.refund_guarantee_cap_pct : rules.refund_fee_cap_pct;
      const limit = refundLimit(k, b.refund_kind!, done, capPercent ?? 100);
      if (b.refund_amount > limit) throw new HttpError(422, `Refund is more than was collected. The most that can still be refunded is ETB ${limit}.`);
      await post(c, 'dispute', d.id, b.refund_kind === 'guarantee'
        ? [['Guarantee Liability', b.refund_amount, 0], ['Cash', 0, b.refund_amount]]
        : [['Refunds', b.refund_amount, 0], ['Cash', 0, b.refund_amount]]);
      await enqueueAccountingEvent(c, {
        source_entity_id: k.source_agent_id,
        entry_date: (await c.query('SELECT current_date::text AS entry_date')).rows[0].entry_date,
        source_reference: `agency-dispute-refund:${d.id}`,
        description: `Agency ${b.refund_kind} refund for contract ${k.contract_no}`,
        lines: b.refund_kind === 'guarantee'
          ? [
            { source_account_code: 'Guarantee Liability', debit: b.refund_amount.toFixed(2), credit: '0.00' },
            { source_account_code: 'Cash', debit: '0.00', credit: b.refund_amount.toFixed(2) },
          ]
          : [
            { source_account_code: 'Refunds', debit: b.refund_amount.toFixed(2), credit: '0.00' },
            { source_account_code: 'Cash', debit: '0.00', credit: b.refund_amount.toFixed(2) },
          ],
        maker_id: d.opened_by,
        checker_id: req.user!.id,
        checker_reason: `Dispute ${d.id} refund approved: ${b.resolution}`,
      });
    }
    const r = await c.query("UPDATE disputes SET status = 'resolved', resolution = $2, refund_amount = $3, refund_kind = $4, resolved_by = $5, closed_at = now() WHERE id = $1 RETURNING *",
      [d.id, b.resolution, b.refund_amount, b.refund_amount > 0 ? b.refund_kind : null, req.user!.id]);
    await audit(c, req.user!.id, 'dispute_resolved', 'dispute', d.id, { status: d.status }, { refund: b.refund_amount, kind: b.refund_kind ?? null });
    await notify(c, k.source_agent_id, 'dispute_resolved', { contract_no: k.contract_no });
    return r.rows[0];
  }));
}));

// ================= Tenants =================
ops.post('/tenants', requireActivity('property.tenancy.manage'), h(async (req, res) => {
  const b = z.object({ name: z.string().min(2), phone: Phone, national_id: z.string().min(5).optional() }).parse(req.body);
  const row = await withUser(req.user!, async (c) => {
    const r = await c.query('INSERT INTO tenants (name, phone, national_id, source_agent_id) VALUES ($1,$2,$3,$4) RETURNING *', [b.name, b.phone, b.national_id ?? null, req.user!.id]);
    await audit(c, req.user!.id, 'tenant_created', 'tenant', r.rows[0].id, null, { name: b.name });
    return r.rows[0];
  });
  res.status(201).json(row);
}));

ops.get('/tenants', requireActivity('property.tenancy.manage'), h(async (req, res) => {
  res.json(await withUser(req.user!, async (c) => (await c.query(
    'SELECT id, name, phone, source_agent_id, created_at FROM tenants ORDER BY created_at DESC LIMIT 200',
  )).rows));
}));

ops.post('/leases/:id/tenant-access-invitations', requireActivity('property.tenancy.manage'), h(async (req, res) => {
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const invitation = await withUser(req.user!, async (client) => {
    const lease = (await client.query(
      `SELECT l.id,l.tenant_id,l.source_agent_id,p.owner_user_id
       FROM leases l JOIN property_units u ON u.id=l.unit_id
       JOIN properties p ON p.id=u.property_id
       WHERE l.id=$1 AND l.status='active' FOR UPDATE OF l`,
      [req.params.id],
    )).rows[0];
    if (!lease) throw new HttpError(404, 'Active lease not found');
    await client.query(
      `UPDATE property_tenant_access_invitations
       SET revoked_by=$2,revoked_at=now(),revocation_reason='Replaced by a new resident access invitation'
       WHERE lease_id=$1 AND redeemed_at IS NULL AND revoked_at IS NULL`,
      [lease.id, req.user!.id],
    );
    const created = (await client.query(
      `INSERT INTO property_tenant_access_invitations
         (lease_id,tenant_id,source_agent_id,property_owner_user_id,token_hash,invited_by,expires_at)
       VALUES($1,$2,$3,$4,$5,$6,now()+interval '7 days')
       RETURNING id,lease_id,expires_at`,
      [lease.id, lease.tenant_id, lease.source_agent_id, lease.owner_user_id, tokenHash, req.user!.id],
    )).rows[0];
    await audit(client, req.user!.id, 'property_tenant_access_invitation_created', 'lease', lease.id, null, {
      invitation_id: created.id, expires_at: created.expires_at,
    });
    return created;
  });
  res.status(201).json({
    ...invitation,
    claim_code: token,
    delivery_notice: 'Deliver this one-time code only to the tenant through a separately verified contact channel. AfroLife does not send it.',
  });
}));

ops.post('/leases/:leaseId/tenant-access-links/:linkId/revoke', requireActivity('property.tenancy.manage'), h(async (req, res) => {
  const { reason } = z.object({ reason: z.string().trim().min(10).max(1000) }).strict().parse(req.body);
  const revoked = await withUser(req.user!, async (client) => {
    const result = (await client.query(
      `UPDATE property_tenant_account_links link
       SET revoked_by=$3,revoked_at=now(),revocation_reason=$4
       FROM property_tenant_access_invitations invitation
       WHERE link.invitation_id=invitation.id AND invitation.lease_id=$1
         AND link.id=$2 AND link.revoked_at IS NULL
       RETURNING link.id,link.tenant_id,link.user_id,link.revoked_at`,
      [req.params.leaseId, req.params.linkId, req.user!.id, reason],
    )).rows[0];
    if (!result) throw new HttpError(404, 'Active resident account link not found');
    await audit(client, req.user!.id, 'property_tenant_account_link_revoked', 'lease', req.params.leaseId, null, {
      link_id: result.id, user_id: result.user_id, reason,
    });
    return result;
  });
  res.json(revoked);
}));

ops.post('/resident/access/claim', requireRole('customer'), h(async (req, res) => {
  const { claim_code: claimCode } = z.object({
    claim_code: z.string().trim().regex(/^[0-9a-f]{64}$/i),
  }).strict().parse(req.body);
  const tokenHash = createHash('sha256').update(claimCode.toLowerCase()).digest('hex');
  const link = await withUser(req.user!, async (client) => {
    await client.query("SELECT set_config('app.property_tenant_invite_hash',$1,true)", [tokenHash]);
    const invitation = (await client.query(
      `SELECT id,lease_id,tenant_id,expires_at
       FROM property_tenant_access_invitations
       WHERE token_hash=$1 AND redeemed_at IS NULL AND revoked_at IS NULL
         AND expires_at>now()
       FOR UPDATE`,
      [tokenHash],
    )).rows[0];
    if (!invitation) throw new HttpError(404, 'Tenant access invitation is invalid, expired, or already used');
    const account = (await client.query(
      `SELECT u.phone,t.phone AS tenant_phone
       FROM users u JOIN tenants t ON t.id=$2
       WHERE u.id=$1 AND u.active AND u.role='customer'`,
      [req.user!.id, invitation.tenant_id],
    )).rows[0];
    if (!account || account.phone !== account.tenant_phone) {
      throw new HttpError(403, 'Sign in with the customer account registered to the tenant contact phone to claim this invitation');
    }
    const existingLink = (await client.query(
      `SELECT id,tenant_id,created_at FROM property_tenant_account_links
       WHERE tenant_id=$1 AND user_id=$2 AND revoked_at IS NULL`,
      [invitation.tenant_id, req.user!.id],
    )).rows[0];
    if (existingLink) return { ...existingLink, already_linked: true };
    const redeemed = await client.query(
      `UPDATE property_tenant_access_invitations
       SET redeemed_by=$2,redeemed_at=now()
       WHERE id=$1 AND redeemed_at IS NULL AND revoked_at IS NULL
         AND expires_at>now()
       RETURNING id`,
      [invitation.id, req.user!.id],
    );
    if (!redeemed.rowCount) throw new HttpError(409, 'Tenant access invitation has already been used');
    const created = (await client.query(
      `INSERT INTO property_tenant_account_links(tenant_id,user_id,invitation_id)
       VALUES($1,$2,$3)
       RETURNING id,tenant_id,created_at`,
      [invitation.tenant_id, req.user!.id, invitation.id],
    )).rows[0];
    await audit(client, req.user!.id, 'property_tenant_account_link_claimed', 'lease', invitation.lease_id, null, {
      link_id: created.id, invitation_id: invitation.id,
    });
    return { ...created, already_linked: false };
  });
  res.status(201).json(link);
}));

ops.get('/property/associations', h(async (req, res) => {
  const result = await withUser(req.user!, async (client) => {
    const tenant = await client.query(
      'SELECT currency FROM property_operating_tenants WHERE id=app_property_tenant_system_id()',
    );
    const tenantCurrency: string | undefined = tenant.rows[0]?.currency;
    if (!tenantCurrency) throw new HttpError(403, 'An active property tenant context is required.');
    const associations = await client.query(
      `SELECT association.id,association.name,association.status,association.created_at,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'property_id',property.id,'address',property.address
           ) ORDER BY property.address)
           FROM property_association_properties association_property
           JOIN properties property
             ON property.id=association_property.property_id
            AND property.tenant_system_id=association_property.tenant_system_id
           WHERE association_property.tenant_system_id=association.tenant_system_id
             AND association_property.association_id=association.id
         ),'[]'::jsonb) AS properties
       FROM property_associations association
       WHERE association.tenant_system_id=app_property_tenant_system_id()
       ORDER BY association.name,association.id`,
    );
    const assessments = await client.query(
      `SELECT assessment.id,assessment.association_id,assessment.property_id,
         assessment.unit_id,property.address,unit.unit_no,
         assessment.period_start,assessment.due_on,assessment.amount::text AS amount,
         assessment.description,assessment.created_at,
         (assessment.owner_user_id=app_user_id()) AS is_owner,
         CASE
           WHEN COALESCE((
             SELECT sum(receipt.amount) FROM property_association_receipts receipt
             WHERE receipt.tenant_system_id=assessment.tenant_system_id
               AND receipt.assessment_id=assessment.id
               AND receipt.status='reconciled'
           ),0)>=assessment.amount THEN 'reconciled'
           WHEN EXISTS (
             SELECT 1 FROM property_association_receipts receipt
             WHERE receipt.tenant_system_id=assessment.tenant_system_id
               AND receipt.assessment_id=assessment.id
               AND receipt.status='pending'
           ) THEN 'pending'
           ELSE 'open'
         END AS status,
         COALESCE((
           SELECT sum(receipt.amount) FROM property_association_receipts receipt
           WHERE receipt.tenant_system_id=assessment.tenant_system_id
             AND receipt.assessment_id=assessment.id
             AND receipt.status='reconciled'
         ),0)::text AS reconciled_amount,
         COALESCE((
           SELECT sum(receipt.amount) FROM property_association_receipts receipt
           WHERE receipt.tenant_system_id=assessment.tenant_system_id
             AND receipt.assessment_id=assessment.id
             AND receipt.status='pending'
         ),0)::text AS pending_amount,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'id',receipt.id,'amount',receipt.amount::text,'channel',receipt.channel,
             'reference',receipt.reference,'status',receipt.status,
             'review_reason',receipt.review_reason,'created_at',receipt.created_at,
             'is_recorder',(receipt.recorded_by=app_user_id())
           ) ORDER BY receipt.created_at,receipt.id)
           FROM property_association_receipts receipt
           WHERE receipt.tenant_system_id=assessment.tenant_system_id
             AND receipt.assessment_id=assessment.id
         ),'[]'::jsonb) AS receipts
       FROM property_association_assessments assessment
       JOIN properties property
         ON property.id=assessment.property_id
        AND property.tenant_system_id=assessment.tenant_system_id
       LEFT JOIN property_units unit
         ON unit.id=assessment.unit_id
        AND unit.property_id=assessment.property_id
       WHERE assessment.tenant_system_id=app_property_tenant_system_id()
       ORDER BY assessment.due_on,assessment.created_at DESC
       LIMIT 500`,
    );
    const violations = await client.query(
      `SELECT violation.id,violation.association_id,violation.property_id,violation.unit_id,
         property.address,unit.unit_no,violation.category,violation.summary,
         violation.description,violation.evidence_reference,violation.status,
         violation.closure_reason,violation.created_at,
         (violation.owner_user_id=app_user_id()) AS is_owner,
         (violation.reported_by=app_user_id()) AS is_reporter,
         (
           app_property_agent_can_manage(violation.tenant_system_id,violation.property_id)
           AND violation.owner_user_id<>app_user_id()
           AND violation.reported_by<>app_user_id()
         ) AS can_decide,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'event_type',event.event_type,'from_status',event.from_status,
             'to_status',event.to_status,'reason',event.reason,
             'evidence_reference',event.evidence_reference,'created_at',event.created_at,
             'actor_name',CASE WHEN app_role()='field_agent' THEN NULL ELSE actor.legal_name END
           ) ORDER BY event.id)
           FROM property_association_violation_events event
           LEFT JOIN users actor ON actor.id=event.actor_id
           WHERE event.tenant_system_id=violation.tenant_system_id
             AND event.violation_id=violation.id
         ),'[]'::jsonb) AS events
       FROM property_association_violations violation
       JOIN properties property
         ON property.id=violation.property_id
        AND property.tenant_system_id=violation.tenant_system_id
       LEFT JOIN property_units unit
         ON unit.id=violation.unit_id AND unit.property_id=violation.property_id
       WHERE violation.tenant_system_id=app_property_tenant_system_id()
       ORDER BY violation.created_at DESC,violation.id
       LIMIT 500`,
    );
    const amenityPolicies = await client.query(
      `SELECT policy.policy_version_id,policy.association_id,policy.property_id,
         property.address,policy.amenity_name,policy.policy_version,policy.rules,
         policy.status,policy.created_at
       FROM property_association_amenity_policies policy
       JOIN properties property
         ON property.id=policy.property_id
        AND property.tenant_system_id=policy.tenant_system_id
       WHERE policy.tenant_system_id=app_property_tenant_system_id()
       ORDER BY policy.association_id,policy.property_id,
         lower(policy.amenity_name),policy.policy_version`,
    );
    return {
      currency: tenantCurrency,
      associations: associations.rows,
      assessments: assessments.rows,
      violations: violations.rows,
      amenity_policies: amenityPolicies.rows,
    };
  });
  res.json(result);
}));

ops.post('/property/associations', h(async (req, res) => {
  const body = z.object({
    name: z.string().trim().min(2).max(160),
    property_ids: z.array(z.string().uuid()).min(1).max(200),
  }).strict().parse(req.body);
  const result = await withUser(req.user!, async (client) => (
    await client.query(
      'SELECT create_property_association($1,$2::uuid[]) AS id',
      [body.name,body.property_ids],
    )
  ));
  res.status(201).json({ id: result.rows[0].id, status: 'active' });
}));

ops.post('/property/associations/:id/amenity-policies', h(async (req, res) => {
  const associationId = z.string().uuid().parse(req.params.id);
  const body = z.object({
    property_id: z.string().uuid(),
    amenity_name: z.string().trim().min(2).max(120),
    rules: z.string().trim().min(10).max(3000),
    status: z.enum(['active','retired']),
  }).strict().parse(req.body);
  const result = await withUser(req.user!, async (client) => (
    await client.query(
      'SELECT * FROM record_property_association_amenity_policy($1,$2,$3,$4,$5)',
      [associationId,body.property_id,body.amenity_name,body.rules,body.status],
    )
  ));
  res.status(201).json(result.rows[0]);
}));

ops.post('/property/associations/:id/assessments', h(async (req, res) => {
  const associationId = z.string().uuid().parse(req.params.id);
  const body = z.object({
    property_id: z.string().uuid(),
    unit_id: z.string().uuid().optional(),
    period_start: z.string().date(),
    due_on: z.string().date(),
    amount: z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/)
      .refine((value) => Number(value) > 0),
    description: z.string().trim().min(3).max(500),
  }).strict().parse(req.body);
  const result = await withUser(req.user!, async (client) => (
    await client.query(
      'SELECT create_property_association_assessment($1,$2,$3,$4,$5,$6,$7) AS id',
      [
        associationId,body.property_id,body.unit_id ?? null,
        body.period_start,body.due_on,body.amount,body.description,
      ],
    )
  ));
  res.status(201).json({ id: result.rows[0].id });
}));

ops.post('/property/associations/:id/violations', h(async (req, res) => {
  const associationId = z.string().uuid().parse(req.params.id);
  const body = z.object({
    property_id: z.string().uuid(),
    unit_id: z.string().uuid().optional(),
    category: z.string().trim().min(2).max(80),
    summary: z.string().trim().min(3).max(160),
    description: z.string().trim().min(10).max(2000),
    evidence_reference: z.string().trim().min(2).max(200)
      .refine((value) => !value.includes('://') && !/(password|secret|token|credential)/i.test(value)),
  }).strict().parse(req.body);
  const result = await withUser(req.user!, async (client) => (
    await client.query(
      'SELECT record_property_association_violation($1,$2,$3,$4,$5,$6,$7) AS id',
      [
        associationId,body.property_id,body.unit_id ?? null,body.category,
        body.summary,body.description,body.evidence_reference,
      ],
    )
  ));
  res.status(201).json({ id: result.rows[0].id, status: 'pending_review' });
}));

ops.post('/property/association-violations/:id/response', h(async (req, res) => {
  const violationId = z.string().uuid().parse(req.params.id);
  const body = z.object({
    response: z.string().trim().min(10).max(2000),
    evidence_reference: z.string().trim().min(2).max(200)
      .refine((value) => !value.includes('://') && !/(password|secret|token|credential)/i.test(value))
      .optional(),
  }).strict().parse(req.body);
  await withUser(req.user!, async (client) => {
    await client.query(
      'SELECT submit_property_association_violation_response($1,$2,$3)',
      [violationId,body.response,body.evidence_reference ?? null],
    );
  });
  res.status(201).json({ status: 'response_submitted' });
}));

ops.post('/property/association-violations/:id/decision', h(async (req, res) => {
  const violationId = z.string().uuid().parse(req.params.id);
  const body = z.object({
    decision: z.enum(['resolved','dismissed']),
    reason: z.string().trim().min(10).max(1000),
  }).strict().parse(req.body);
  await withUser(req.user!, async (client) => {
    await client.query(
      'SELECT decide_property_association_violation($1,$2,$3)',
      [violationId,body.decision,body.reason],
    );
  });
  res.status(204).end();
}));

ops.post('/property/association-assessments/:id/receipts', h(async (req, res) => {
  const assessmentId = z.string().uuid().parse(req.params.id);
  const body = z.object({
    amount: z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/)
      .refine((value) => Number(value) > 0),
    channel: z.string().trim().min(2).max(40),
    reference: z.string().trim().min(3).max(160)
      .refine((value) => !value.includes('://') && !/(password|secret|token|credential)/i.test(value)),
  }).strict().parse(req.body);
  const result = await withUser(req.user!, async (client) => (
    await client.query(
      'SELECT record_property_association_receipt($1,$2,$3,$4) AS id',
      [assessmentId,body.amount,body.channel,body.reference],
    )
  ));
  res.status(201).json({ id: result.rows[0].id, status: 'pending' });
}));

ops.post('/property/association-receipts/:id/decision', h(async (req, res) => {
  const receiptId = z.string().uuid().parse(req.params.id);
  const body = z.object({
    decision: z.enum(['reconciled','rejected']),
    reason: z.string().trim().min(10).max(1000),
  }).strict().parse(req.body);
  await withUser(req.user!, async (client) => {
    await client.query(
      'SELECT decide_property_association_receipt($1,$2,$3)',
      [receiptId,body.decision,body.reason],
    );
  });
  res.status(204).end();
}));

ops.get('/property/arc-requests', h(async (req, res) => {
  const result = await withUser(req.user!, async (client) => {
    const requests = await client.query(
      `SELECT request.id,request.property_id,property.address,request.request_type,
         request.summary,request.proposal,request.evidence_reference,request.status,
         request.created_at,(request.submitted_by=app_user_id()) AS is_requester,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'event_type',event.event_type,'from_status',event.from_status,
             'to_status',event.to_status,'reason',event.reason,
             'evidence_reference',event.evidence_reference,'created_at',event.created_at,
             'actor_name',CASE WHEN app_role()='field_agent' THEN NULL ELSE actor.legal_name END
           ) ORDER BY event.id)
           FROM property_arc_events event
           LEFT JOIN users actor ON actor.id=event.actor_id
           WHERE event.tenant_system_id=request.tenant_system_id
             AND event.arc_request_id=request.id
         ),'[]'::jsonb) AS events
       FROM property_arc_requests request
       JOIN properties property
         ON property.id=request.property_id
        AND property.tenant_system_id=request.tenant_system_id
       WHERE request.tenant_system_id=app_property_tenant_system_id()
       ORDER BY request.request_sequence DESC
       LIMIT 100`,
    );
    const eligibleProperties = await client.query(
      'SELECT * FROM list_property_arc_eligible_properties()',
    );
    return { requests: requests.rows, eligible_properties: eligibleProperties.rows };
  });
  res.json(result);
}));

ops.post('/property/arc-requests', h(async (req, res) => {
  const body = z.object({
    property_id: z.string().uuid(),
    request_type: z.enum(['exterior_alteration','landscaping','painting','structural','other']),
    summary: z.string().trim().min(3).max(120),
    proposal: z.string().trim().min(10).max(2000),
    evidence_reference: z.string().trim().min(2).max(200)
      .refine((value) => !value.includes('://') && !/(password|secret|token|credential)/i.test(value))
      .optional(),
  }).strict().parse(req.body);
  const requestId = await withUser(req.user!, async (client) => (
    await client.query(
      'SELECT submit_property_arc_request($1,$2,$3,$4,$5) AS id',
      [body.property_id,body.request_type,body.summary,body.proposal,body.evidence_reference ?? null],
    )
  )).then((result) => result.rows[0].id as string);
  res.status(201).json({ id: requestId, status: 'pending_review' });
}));

ops.post('/property/arc-requests/:id/decision', h(async (req, res) => {
  const requestId = z.string().uuid().parse(req.params.id);
  const body = z.object({
    decision: z.enum(['approved','rejected']),
    reason: z.string().trim().min(10).max(1000),
  }).strict().parse(req.body);
  await withUser(req.user!, async (client) => {
    await client.query(
      'SELECT decide_property_arc_request($1,$2,$3)',
      [requestId,body.decision,body.reason],
    );
  });
  res.status(204).end();
}));

ops.post('/property/arc-requests/:id/inspection', h(async (req, res) => {
  const requestId = z.string().uuid().parse(req.params.id);
  const body = z.object({
    notes: z.string().trim().min(10).max(1000),
    evidence_reference: z.string().trim().min(2).max(200)
      .refine((value) => !value.includes('://') && !/(password|secret|token|credential)/i.test(value))
      .optional(),
  }).strict().parse(req.body);
  await withUser(req.user!, async (client) => {
    await client.query(
      'SELECT record_property_arc_inspection($1,$2,$3)',
      [requestId,body.notes,body.evidence_reference ?? null],
    );
  });
  res.status(201).json({ status: 'inspection_recorded' });
}));

ops.get('/resident/property-workspace', requireRole('customer'), h(async (req, res) => {
  const workspace = await withUser(req.user!, async (client) => {
    const leases = (await client.query(
      `SELECT l.id,l.status,l.rent::text,l.deposit::text,l.start_date,l.rent_start_on,l.end_date,
         l.possession_handover_on,l.move_in_inspection_completed,
         t.name AS tenant_name,u.unit_no,p.address,
         COALESCE((SELECT json_agg(json_build_object(
           'id',d.id,'party',d.party,'signer_name',d.signer_name,'mime',d.mime,
           'size_bytes',d.size_bytes,'created_at',d.created_at
         ) ORDER BY d.created_at,d.id) FROM lease_documents d WHERE d.lease_id=l.id),'[]'::json) AS documents,
         COALESCE((SELECT json_agg(json_build_object(
           'notice_type',n.notice_type,'received_on',n.received_on,
           'proposed_effective_on',n.proposed_effective_on,'summary',n.summary,
           'created_at',n.created_at
         ) ORDER BY n.created_at DESC) FROM lease_notices n WHERE n.lease_id=l.id),'[]'::json) AS notices
         ,COALESCE((SELECT json_agg(json_build_object(
           'id',offer.id,'status',offer.status,'proposed_rent',offer.proposed_rent::text,
           'proposed_deposit',offer.proposed_deposit::text,'proposed_start_date',offer.proposed_start_date,
           'proposed_end_date',offer.proposed_end_date,'term_months',offer.term_months,
           'due_day',offer.due_day,'expires_on',offer.expires_on,'review_reason',offer.review_reason,
           'response_note',offer.response_note,'request_reason',offer.request_reason,
           'events',(SELECT json_agg(json_build_object(
             'event_type',event.event_type,'from_status',event.from_status,'to_status',event.to_status,
             'reason',event.reason,'created_at',event.created_at
           ) ORDER BY event.created_at,event.id)
             FROM lease_renewal_offer_events event WHERE event.offer_id=offer.id),
           'created_by',offer.created_by,
           'converted_lease_id',(SELECT renewal.id FROM leases renewal WHERE renewal.renewal_offer_id=offer.id)
         ) ORDER BY offer.created_at DESC,offer.id)
             FROM lease_renewal_offers offer WHERE offer.lease_id=l.id),'[]'::json) AS renewal_offers,
           COALESCE((SELECT json_agg(json_build_object(
             'id',inspection.id,'revision',inspection.revision,'actual_vacated_on',inspection.actual_vacated_on,
             'inspected_on',inspection.inspected_on,'condition_notes',inspection.condition_notes,
             'keys_returned',inspection.keys_returned,'deposit_deduction',inspection.deposit_deduction::text,
             'deduction_reason',inspection.deduction_reason,'status',inspection.status,
             'submitted_by',inspection.submitted_by,'reviewed_by',inspection.reviewed_by,
             'review_note',inspection.review_note,'submitted_at',inspection.submitted_at,
             'reviewed_at',inspection.reviewed_at,
             'evidence',(SELECT COALESCE(json_agg(json_build_object(
               'id',evidence.id,'mime',evidence.mime,'size_bytes',evidence.size_bytes,
               'created_at',evidence.created_at
             ) ORDER BY evidence.created_at,evidence.id),'[]'::json)
               FROM lease_move_out_inspection_evidence evidence WHERE evidence.inspection_id=inspection.id)
           ) ORDER BY inspection.revision DESC)
             FROM lease_move_out_inspections inspection WHERE inspection.lease_id=l.id),'[]'::json)
             AS move_out_inspections
         ,COALESCE((SELECT json_agg(json_build_object(
           'id',inspection.id,'revision',inspection.revision,'actual_vacated_on',inspection.actual_vacated_on,
           'inspected_on',inspection.inspected_on,'condition_notes',inspection.condition_notes,
           'keys_returned',inspection.keys_returned,'deposit_deduction',inspection.deposit_deduction::text,
           'deduction_reason',inspection.deduction_reason,'status',inspection.status,
           'submitted_by',inspection.submitted_by,'reviewed_by',inspection.reviewed_by,
           'review_note',inspection.review_note,'submitted_at',inspection.submitted_at,
           'reviewed_at',inspection.reviewed_at,
           'evidence',(SELECT COALESCE(json_agg(json_build_object(
             'id',evidence.id,'mime',evidence.mime,'size_bytes',evidence.size_bytes,
             'created_at',evidence.created_at
           ) ORDER BY evidence.created_at,evidence.id),'[]'::json)
             FROM lease_move_out_inspection_evidence evidence WHERE evidence.inspection_id=inspection.id),
           'events',(SELECT COALESCE(json_agg(json_build_object(
             'event_type',event.event_type,'reason',event.reason,'created_at',event.created_at
           ) ORDER BY event.created_at,event.id),'[]'::json)
             FROM lease_move_out_inspection_events event WHERE event.inspection_id=inspection.id)
         ) ORDER BY inspection.revision DESC)
           FROM lease_move_out_inspections inspection WHERE inspection.lease_id=l.id),'[]'::json)
           AS move_out_inspections
       FROM leases l
       JOIN property_tenant_account_links link ON link.tenant_id=l.tenant_id
       JOIN tenants t ON t.id=l.tenant_id
       JOIN property_units u ON u.id=l.unit_id
       JOIN properties p ON p.id=u.property_id
       WHERE link.user_id=$1 AND link.revoked_at IS NULL
       ORDER BY l.start_date DESC,l.created_at DESC`,
      [req.user!.id],
    )).rows;
    const leaseIds = leases.map((lease) => lease.id);
    if (!leaseIds.length) return { leases, charges: [], payments: [], maintenance: [] };
    const [charges, payments, maintenance] = await Promise.all([
      client.query(
        `SELECT charge.id,charge.lease_id,charge.period,charge.due_on,charge.amount::text,
           CASE WHEN charge.status='due' AND charge.due_on<current_date THEN 'overdue'
             ELSE charge.status END AS status,charge.paid_at,charge.payment_ref
         FROM rent_charges charge WHERE charge.lease_id=ANY($1::uuid[])
         ORDER BY charge.due_on DESC,charge.id`,
        [leaseIds],
      ),
      client.query(
        `SELECT id,lease_id,kind,amount::text,channel,reference,status,created_at,reconciled_at
         FROM rent_transactions WHERE lease_id=ANY($1::uuid[])
         ORDER BY created_at DESC,id`,
        [leaseIds],
      ),
      client.query(
        `SELECT maintenance.id,maintenance.lease_id,maintenance.category,maintenance.priority,
           maintenance.description,maintenance.status,maintenance.created_at,
           property.address,unit.unit_no,
           COALESCE((SELECT json_agg(json_build_object(
             'event_type',event.event_type,'from_status',event.from_status,'to_status',event.to_status,
             'created_at',event.created_at
           ) ORDER BY event.created_at,event.id) FROM maintenance_request_events event
             WHERE event.maintenance_request_id=maintenance.id),'[]'::json) AS events,
           COALESCE((SELECT json_agg(json_build_object(
             'id',evidence.id,'mime',evidence.mime,'created_at',evidence.created_at
           ) ORDER BY evidence.created_at,evidence.id) FROM maintenance_evidence evidence
             WHERE evidence.maintenance_request_id=maintenance.id AND evidence.scan_status='clean'),'[]'::json) AS evidence
         FROM maintenance_requests maintenance
         JOIN properties property ON property.id=maintenance.property_id
         LEFT JOIN property_units unit ON unit.id=maintenance.unit_id
         WHERE maintenance.resident_user_id=$1 AND maintenance.lease_id=ANY($2::uuid[])
         ORDER BY maintenance.created_at DESC`,
        [req.user!.id, leaseIds],
      ),
    ]);
    return { leases, charges: charges.rows, payments: payments.rows, maintenance: maintenance.rows };
  });
  res.json(workspace);
}));

ops.post('/resident/leases/:id/notices', requireRole('customer'), h(async (req, res) => {
  const body = z.object({
    idempotency_key: z.string().uuid(),
    proposed_effective_on: z.string().date(),
    summary: z.string().trim().min(10).max(1000),
  }).strict().parse(req.body);
  const receivedOn = new Date().toISOString().slice(0, 10);
  if (body.proposed_effective_on < receivedOn) {
    throw new HttpError(422, 'The proposed effective date cannot be before today');
  }
  const notice = await withUser(req.user!, async (client) => {
    const lease = (await client.query(
      `SELECT lease.id FROM leases lease
       JOIN property_tenant_account_links link ON link.tenant_id=lease.tenant_id
       WHERE lease.id=$1 AND lease.status='active'
         AND link.user_id=$2 AND link.revoked_at IS NULL`,
      [req.params.id, req.user!.id],
    )).rows[0];
    if (!lease) throw new HttpError(404, 'Active resident lease not found');
    const inserted = await client.query(
      `INSERT INTO lease_notices
         (lease_id,idempotency_key,notice_type,received_on,proposed_effective_on,summary,recorded_by)
       VALUES($1,$2,'tenant_to_owner',$3,$4,$5,$6)
       ON CONFLICT(lease_id,idempotency_key) DO NOTHING
       RETURNING id,lease_id,notice_type,received_on,proposed_effective_on,summary,created_at`,
      [lease.id, body.idempotency_key, receivedOn, body.proposed_effective_on, body.summary, req.user!.id],
    );
    if (inserted.rowCount) {
      await audit(client, req.user!.id, 'resident_lease_notice_recorded', 'lease', lease.id, null, {
        notice_id: inserted.rows[0].id, notice_type: 'tenant_to_owner',
      });
      return inserted.rows[0];
    }
    const existing = (await client.query(
      `SELECT id,lease_id,notice_type,received_on,proposed_effective_on,summary,recorded_by,created_at
       FROM lease_notices WHERE lease_id=$1 AND idempotency_key=$2`,
      [lease.id, body.idempotency_key],
    )).rows[0];
    if (!existing || existing.recorded_by !== req.user!.id
      || String(existing.proposed_effective_on).slice(0, 10) !== body.proposed_effective_on
      || existing.summary !== body.summary) {
      throw new HttpError(409, 'Idempotency-Key was already used for a different tenant notice');
    }
    return existing;
  });
  res.status(201).json(notice);
}));

ops.post('/resident/maintenance', requireRole('customer'), h(async (req, res) => {
  const body = z.object({
    lease_id: z.string().uuid(),
    category: z.enum(['general','plumbing','electrical','appliance','structural','cleaning','safety','other']).default('general'),
    priority: z.enum(['low','normal','urgent']).default('normal'),
    description: z.string().trim().min(10).max(2000),
    idempotency_key: z.string().uuid(),
  }).strict().parse(req.body);
  const priority = body.category === 'safety' ? 'urgent' : body.priority;
  const payloadHash = createHash('sha256').update(JSON.stringify({
    lease_id: body.lease_id, category: body.category, priority, description: body.description,
  })).digest('hex');
  const result = await withUser(req.user!, async (client) => {
    const existing = (await client.query(
      `SELECT * FROM maintenance_requests
       WHERE idempotency_user_id=$1 AND idempotency_key=$2`,
      [req.user!.id, body.idempotency_key],
    )).rows[0];
    if (existing) {
      if (existing.idempotency_payload_hash !== payloadHash) {
        throw new HttpError(409, 'Idempotency-Key was already used for a different maintenance request');
      }
      return { row: existing, replayed: true };
    }
    const lease = (await client.query(
      `SELECT lease.id,lease.unit_id,lease.source_agent_id,unit.property_id
       FROM leases lease
       JOIN property_tenant_account_links link ON link.tenant_id=lease.tenant_id
       JOIN property_units unit ON unit.id=lease.unit_id
       WHERE lease.id=$1 AND lease.status='active'
         AND lease.start_date<=current_date AND lease.end_date>=current_date
         AND link.user_id=$2 AND link.revoked_at IS NULL
       FOR UPDATE OF lease`,
      [body.lease_id, req.user!.id],
    )).rows[0];
    if (!lease) throw new HttpError(404, 'Active resident lease not found');
    const inserted = await client.query(
      `INSERT INTO maintenance_requests
         (property_id,unit_id,lease_id,resident_user_id,description,category,priority,
          source_agent_id,idempotency_user_id,idempotency_key,idempotency_payload_hash)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$4,$9,$10)
       ON CONFLICT (idempotency_user_id,idempotency_key)
         WHERE idempotency_key IS NOT NULL DO NOTHING
       RETURNING *`,
      [lease.property_id, lease.unit_id, lease.id, req.user!.id, body.description,
        body.category, priority, lease.source_agent_id, body.idempotency_key, payloadHash],
    );
    if (!inserted.rowCount) {
      const replay = (await client.query(
        `SELECT * FROM maintenance_requests
         WHERE idempotency_user_id=$1 AND idempotency_key=$2`,
        [req.user!.id, body.idempotency_key],
      )).rows[0];
      if (!replay || replay.idempotency_payload_hash !== payloadHash) {
        throw new HttpError(409, 'Maintenance request could not be replayed safely; retry with a new Idempotency-Key');
      }
      return { row: replay, replayed: true };
    }
    const row = inserted.rows[0];
    await client.query(
      `INSERT INTO maintenance_request_events
         (maintenance_request_id,actor_id,event_type,to_status,note)
       VALUES($1,$2,'opened','open',$3)`,
      [row.id, req.user!.id, body.description],
    );
    await audit(client, req.user!.id, 'resident_maintenance_opened', 'maintenance', row.id, null, {
      lease_id: lease.id, category: body.category, priority,
    });
    return { row, replayed: false };
  });
  res.status(result.replayed ? 200 : 201).json({ ...result.row, replayed: result.replayed });
}));

// ================= Leases and rent =================
const LeaseIn = z.object({
  unit_id: z.string().uuid(), tenant_id: z.string().uuid(), rent: z.number().positive(), deposit: z.number().nonnegative().default(0),
  start_date: z.string().date(), rent_start_on: z.string().date().optional(),
  months: z.number().int().min(1).max(120), due_day: z.number().int().min(1).max(28).optional(),
});

const LifecycleReason = z.string().trim().min(10).max(1000);

const LeaseMoveOutInspectionIn = z.object({
  actual_vacated_on: z.string().date(),
  inspected_on: z.string().date(),
  condition_notes: z.string().trim().min(10).max(4000),
  keys_returned: z.boolean(),
  deposit_deduction: z.string().regex(/^\d{1,12}(?:\.\d{1,2})?$/).default('0'),
  deduction_reason: z.string().trim().min(10).max(1000).optional(),
}).strict();

const LeaseRenewalOfferIn = z.object({
  proposed_rent: z.string().regex(/^\d{1,12}(?:\.\d{1,2})?$/),
  proposed_deposit: z.string().regex(/^\d{1,12}(?:\.\d{1,2})?$/),
  proposed_start_date: z.string().date(),
  term_months: z.number().int().min(1).max(120),
  due_day: z.number().int().min(1).max(28).optional(),
  expires_on: z.string().date(),
  request_reason: LifecycleReason,
  idempotency_key: z.string().uuid(),
}).strict();

function renewalMoney(value: string, allowZero = false): string {
  try {
    return normalizeLeaseMoney(value, allowZero);
  } catch (error) {
    if (error instanceof RangeError) throw new HttpError(422, error.message);
    throw error;
  }
}

const LeaseNoticeIn = z.object({
  idempotency_key: z.string().uuid(),
  notice_type: z.enum(['tenant_to_owner', 'owner_to_tenant', 'mutual_agreement', 'other']),
  received_on: z.string().date(),
  proposed_effective_on: z.string().date(),
  summary: z.string().trim().min(10).max(1000),
});

ops.post('/leases/:id/notices', requireActivity('property.tenancy.manage'), h(async (req, res) => {
  const body = LeaseNoticeIn.parse(req.body);
  if (body.proposed_effective_on < body.received_on) {
    throw new HttpError(422, 'The proposed effective date cannot be before the recorded receipt date');
  }
  if (body.received_on > new Date().toISOString().slice(0, 10)) {
    throw new HttpError(422, 'The recorded receipt date cannot be in the future');
  }
  const result = await withUser(req.user!, async (c) => {
    const lease = (await c.query(
      `SELECT l.id,l.status,l.source_agent_id,p.owner_user_id
       FROM leases l
       JOIN property_units u ON u.id=l.unit_id
       JOIN properties p ON p.id=u.property_id
       WHERE l.id=$1 FOR UPDATE OF l`,
      [req.params.id],
    )).rows[0];
    if (!lease) throw new HttpError(404, 'Lease not found');
    if (lease.status !== 'active') throw new HttpError(409, 'Notice records can only be added to an active lease');

    const inserted = await c.query(
      `INSERT INTO lease_notices
         (lease_id,idempotency_key,notice_type,received_on,proposed_effective_on,summary,recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (lease_id,idempotency_key) DO NOTHING
       RETURNING *`,
      [lease.id, body.idempotency_key, body.notice_type, body.received_on,
        body.proposed_effective_on, body.summary, req.user!.id],
    );
    if (!inserted.rowCount) {
      const existing = (await c.query(
        'SELECT * FROM lease_notices WHERE lease_id=$1 AND idempotency_key=$2',
        [lease.id, body.idempotency_key],
      )).rows[0];
      if (!existing || existing.recorded_by !== req.user!.id
        || existing.notice_type !== body.notice_type
        || existing.received_on !== body.received_on
        || existing.proposed_effective_on !== body.proposed_effective_on
        || existing.summary !== body.summary) {
        throw new HttpError(409, 'This idempotency key was already used for a different notice');
      }
      return { notice: existing, created: false };
    }

    const notice = inserted.rows[0];
    await c.query(
      `INSERT INTO lease_lifecycle_events (lease_id,from_status,to_status,action,actor_id,reason,metadata)
       VALUES ($1,'active','active','notice_recorded',$2,'Operational notice record added',
         jsonb_build_object('notice_id',$3::uuid,'notice_type',$4::text,'proposed_effective_on',$5::date))`,
      [lease.id, req.user!.id, notice.id, body.notice_type, body.proposed_effective_on],
    );
    await audit(c, req.user!.id, 'lease_notice_recorded', 'lease', lease.id, null, {
      notice_id: notice.id, notice_type: body.notice_type,
      received_on: body.received_on, proposed_effective_on: body.proposed_effective_on,
    });
    const recipients = new Set<string>([lease.source_agent_id]);
    if (lease.owner_user_id) recipients.add(lease.owner_user_id);
    for (const id of recipients) {
      if (id === req.user!.id) continue;
      await notify(c, id, 'lease_notice_recorded', {
        lease_id: lease.id, notice_id: notice.id, notice_type: body.notice_type,
        proposed_effective_on: body.proposed_effective_on,
      });
    }
    return { notice, created: true };
  });
  res.status(result.created ? 201 : 200).json({
    ...result,
    legal_effect: 'record_only',
    notice_disclaimer: 'This records an operational notice only. It does not verify service, establish legal validity, change lease status, or terminate the lease.',
  });
}));

ops.get('/leases/:id/notices', requireAnyActivity(
  'property.tenancy.manage', 'property.tenancy.approve', 'property.tenancy.execute',
), h(async (req, res) => {
  res.json(await withUser(req.user!, async (c) => (await c.query(
    `SELECT id,lease_id,notice_type,received_on,proposed_effective_on,summary,recorded_by,created_at
     FROM lease_notices WHERE lease_id=$1 ORDER BY created_at DESC LIMIT 100`,
    [req.params.id],
  )).rows));
}));

ops.post('/leases/workflow', requireActivity('property.tenancy.manage'), h(async (req, res) => {
  const b = LeaseIn.parse(req.body);
  const row = await withUser(req.user!, async (c) => {
    const rules = await loadRules(c);
    const minMonths = rules.lease_min_term_months ?? 24;
    const maxMonths = rules.lease_max_months ?? 24;
    if (b.months < minMonths) throw new HttpError(422, `Lease term cannot be less than ${minMonths} months.`);
    if (b.months > maxMonths) throw new HttpError(422, `Lease term cannot exceed ${maxMonths} months.`);
    const dueDay = b.due_day ?? rules.lease_default_due_day ?? 5;
    const rentStartOn = b.rent_start_on ?? b.start_date;
    const leaseEnd = endDate(b.start_date, b.months);
    if (rentStartOn < b.start_date || rentStartOn > leaseEnd) {
      throw new HttpError(422, 'Rent start date must fall within the lease term and cannot precede lease commencement');
    }
    const unit = (await c.query(
      `SELECT u.id, u.occupancy, p.source_agent_id, p.id AS property_id
       FROM property_units u JOIN properties p ON p.id=u.property_id
       WHERE u.id=$1 FOR UPDATE OF u`,
      [b.unit_id],
    )).rows[0];
    if (!unit) throw new HttpError(404, 'Unit not found');
    if (unit.occupancy !== 'vacant') throw new HttpError(409, 'This unit is not vacant');
    if (!(await c.query('SELECT 1 FROM tenants WHERE id=$1', [b.tenant_id])).rowCount) {
      throw new HttpError(404, 'Tenant not found');
    }
    const lease = (await c.query(
      `INSERT INTO leases
         (unit_id,tenant_id,rent,deposit,start_date,rent_start_on,end_date,source_agent_id,status,created_by,term_months,due_day)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9,$10,$11)
       RETURNING *`,
      [b.unit_id, b.tenant_id, b.rent, b.deposit, b.start_date, rentStartOn, leaseEnd,
        unit.source_agent_id, req.user!.id, b.months, dueDay],
    )).rows[0];
    await c.query(
      `INSERT INTO lease_lifecycle_events (lease_id,from_status,to_status,action,actor_id,reason,metadata)
       VALUES ($1,NULL,'draft','draft_created',$2,'Lease draft created',
         jsonb_build_object('workflow_version',1,'commencement_on',$3::date,'rent_start_on',$4::date))`,
      [lease.id, req.user!.id, b.start_date, rentStartOn],
    );
    await audit(c, req.user!.id, 'lease_workflow_draft_created', 'lease', lease.id, null,
      { unit_id: b.unit_id, tenant_id: b.tenant_id, months: b.months });
    return lease;
  });
  res.status(201).json(row);
}));

ops.post('/leases/:id/renewal-offers', requireActivity('property.tenancy.manage'), h(async (req, res) => {
  const body = LeaseRenewalOfferIn.parse(req.body);
  const proposedRent = renewalMoney(body.proposed_rent);
  const proposedDeposit = renewalMoney(body.proposed_deposit, true);
  const payloadHash = createHash('sha256').update(JSON.stringify({
    proposed_rent: proposedRent,
    proposed_deposit: proposedDeposit,
    proposed_start_date: body.proposed_start_date,
    term_months: body.term_months,
    due_day: body.due_day ?? null,
    expires_on: body.expires_on,
    request_reason: body.request_reason,
  })).digest('hex');
  const result = await withUser(req.user!, async (client) => {
    const lease = (await client.query(
      `SELECT id,tenant_id,unit_id,source_agent_id,status,end_date,due_day,current_date::text AS today
       FROM leases WHERE id=$1 FOR UPDATE`,
      [req.params.id],
    )).rows[0];
    if (!lease) throw new HttpError(404, 'Lease not found');
    const prior = (await client.query(
      `SELECT * FROM lease_renewal_offers
       WHERE lease_id=$1 AND created_by=$2 AND idempotency_key=$3`,
      [lease.id, req.user!.id, body.idempotency_key],
    )).rows[0];
    if (prior) {
      if (prior.payload_hash !== payloadHash) {
        throw new HttpError(409, 'Idempotency key was already used for a different renewal offer');
      }
      return { offer: prior, replayed: true };
    }
    if (lease.status !== 'active') throw new HttpError(409, 'Only an active lease can receive a renewal offer');
    const rules = await loadRules(client);
    const minMonths = rules.lease_min_term_months ?? 24;
    const maxMonths = rules.lease_max_months ?? 24;
    if (body.term_months < minMonths || body.term_months > maxMonths) {
      throw new HttpError(422, `Renewal term must be between ${minMonths} and ${maxMonths} months.`);
    }
    const term = validateLeaseRenewalTerm({
      currentEndDate: String(lease.end_date).slice(0, 10),
      proposedStartDate: body.proposed_start_date,
      months: body.term_months,
      today: lease.today,
    });
    if (body.expires_on < lease.today || body.expires_on >= term.startDate) {
      throw new HttpError(422, 'The offer expiration must be today or later and before the proposed renewal starts.');
    }
    const expiredOffers = await client.query<{ id: string }>(
      `UPDATE lease_renewal_offers
       SET status='expired',updated_at=now()
       WHERE lease_id=$1 AND status='offered' AND expires_on<current_date
       RETURNING id`,
      [lease.id],
    );
    for (const expired of expiredOffers.rows) {
      await client.query(
        `INSERT INTO lease_renewal_offer_events(offer_id,actor_id,event_type,from_status,to_status,reason)
         VALUES($1,$2,'expired','offered','expired','Renewal offer expired before a replacement was created')`,
        [expired.id, req.user!.id],
      );
      await audit(client, req.user!.id, 'lease_renewal_offer_expired', 'lease', lease.id, null, {
        offer_id: expired.id,
      });
    }
    const dueDay = body.due_day ?? lease.due_day ?? rules.lease_default_due_day ?? 5;
    const offer = (await client.query(
      `INSERT INTO lease_renewal_offers(
         lease_id,proposed_rent,proposed_deposit,proposed_start_date,proposed_end_date,
         term_months,due_day,expires_on,idempotency_key,payload_hash,request_reason,created_by
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT DO NOTHING RETURNING *`,
      [lease.id, proposedRent, proposedDeposit, term.startDate, term.endDate,
        body.term_months, dueDay, body.expires_on, body.idempotency_key, payloadHash, body.request_reason, req.user!.id],
    )).rows[0];
    if (!offer) {
      const replay = (await client.query(
        `SELECT * FROM lease_renewal_offers
         WHERE lease_id=$1 AND created_by=$2 AND idempotency_key=$3`,
        [lease.id, req.user!.id, body.idempotency_key],
      )).rows[0];
      if (replay) {
        if (replay.payload_hash !== payloadHash) {
          throw new HttpError(409, 'Idempotency key was already used for a different renewal offer');
        }
        return { offer: replay, replayed: true };
      }
      throw new HttpError(409, 'This lease already has a renewal offer awaiting a decision.');
    }
    await client.query(
      `INSERT INTO lease_renewal_offer_events(offer_id,actor_id,event_type,from_status,to_status,reason)
       VALUES($1,$2,'created',NULL,'pending_approval',$3)`,
      [offer.id, req.user!.id, body.request_reason],
    );
    await client.query(
      `INSERT INTO lease_lifecycle_events(lease_id,from_status,to_status,action,actor_id,reason,metadata)
       VALUES($1,'active','active','renewal_offer_created',$2,$3,
        jsonb_build_object('offer_id',$4::uuid,'proposed_start_date',$5::date,'proposed_end_date',$6::date))`,
      [lease.id, req.user!.id, body.request_reason, offer.id, term.startDate, term.endDate],
    );
    await audit(client, req.user!.id, 'lease_renewal_offer_created', 'lease', lease.id, null, {
      offer_id: offer.id, term_months: body.term_months, proposed_rent: proposedRent, request_reason: body.request_reason,
    });
    return { offer, replayed: false };
  });
  res.status(result.replayed ? 200 : 201).json({ ...result.offer, replayed: result.replayed });
}));

ops.post('/leases/:id/renewal-offers/:offerId/decision',
  requireActivity('property.tenancy.approve'), requireActivity('property.tenancy.manage'), h(async (req, res) => {
  const body = z.object({
    decision: z.enum(['offer','reject']),
    reason: LifecycleReason,
  }).strict().parse(req.body);
  const result = await withUser(req.user!, async (client) => {
    const current = (await client.query(
      `SELECT offer.*,lease.status AS lease_status
       FROM lease_renewal_offers offer JOIN leases lease ON lease.id=offer.lease_id
       WHERE offer.id=$1 AND offer.lease_id=$2 FOR UPDATE OF offer,lease`,
      [req.params.offerId, req.params.id],
    )).rows[0];
    if (!current) throw new HttpError(404, 'Lease renewal offer not found');
    if (current.status !== 'pending_approval') throw new HttpError(409, 'Renewal offer is not awaiting approval');
    if (current.created_by === req.user!.id) throw new HttpError(403, 'The offer creator cannot approve their own renewal offer');
    if (body.decision === 'offer') {
      if (current.lease_status !== 'active') throw new HttpError(409, 'The current lease is no longer active');
      const resident = await client.query(
        `SELECT account.id FROM property_tenant_account_links link
         JOIN users account ON account.id=link.user_id AND account.active
         WHERE link.tenant_id=(SELECT tenant_id FROM leases WHERE id=$1)
           AND link.revoked_at IS NULL ORDER BY account.id`,
        [current.lease_id],
      );
      if (!resident.rowCount) throw new HttpError(409, 'Link a verified resident account before issuing a renewal offer.');
      if (current.expires_on < new Date().toISOString().slice(0, 10)) {
        throw new HttpError(409, 'The renewal offer has expired and cannot be issued.');
      }
    }
    const status = body.decision === 'offer' ? 'offered' : 'rejected';
    const offer = (await client.query(
      `UPDATE lease_renewal_offers SET status=$2,approved_by=$3,approved_at=now(),
         review_reason=$4,updated_at=now()
       WHERE id=$1 RETURNING *`,
      [current.id, status, req.user!.id, body.decision === 'reject' ? body.reason : null],
    )).rows[0];
    await client.query(
      `INSERT INTO lease_renewal_offer_events(offer_id,actor_id,event_type,from_status,to_status,reason)
       VALUES($1,$2,$3,'pending_approval',$4,$5)`,
      [offer.id, req.user!.id, status, status, body.reason],
    );
    await client.query(
      `INSERT INTO lease_lifecycle_events(lease_id,from_status,to_status,action,actor_id,reason,metadata)
       VALUES($1,'active','active',$2,$3,$4,jsonb_build_object('offer_id',$5::uuid))`,
      [offer.lease_id, `renewal_offer_${status}`, req.user!.id, body.reason, offer.id],
    );
    if (status === 'offered') {
      const residents = await client.query<{ user_id: string }>(
        `SELECT user_id FROM property_tenant_account_links
         WHERE tenant_id=(SELECT tenant_id FROM leases WHERE id=$1) AND revoked_at IS NULL`,
        [offer.lease_id],
      );
      for (const resident of residents.rows) {
        await notify(client, resident.user_id, 'lease_renewal_offer', {
          lease_id: offer.lease_id, offer_id: offer.id, expires_on: offer.expires_on,
        });
      }
    }
    await audit(client, req.user!.id, `lease_renewal_offer_${status}`, 'lease', offer.lease_id,
      { offer_status: current.status }, { offer_status: status, offer_id: offer.id, reason: body.reason });
    return offer;
  });
  res.json(result);
}));

ops.post('/resident/leases/:leaseId/renewal-offers/:offerId/respond', requireRole('customer'), h(async (req, res) => {
  const body = z.object({
    decision: z.enum(['accept','decline']),
    response_note: z.string().trim().min(5).max(1000).optional(),
  }).strict().superRefine((value, context) => {
    if (value.decision === 'decline' && (!value.response_note || value.response_note.length < 10)) {
      context.addIssue({ code: 'custom', path: ['response_note'], message: 'A decline reason of at least 10 characters is required.' });
    }
  }).parse(req.body);
  const result = await withUser(req.user!, async (client) => {
    const current = (await client.query(
      `SELECT offer.*,lease.tenant_id,lease.status AS lease_status
       FROM lease_renewal_offers offer JOIN leases lease ON lease.id=offer.lease_id
       JOIN property_tenant_account_links link ON link.tenant_id=lease.tenant_id
       WHERE offer.id=$1 AND offer.lease_id=$2 AND link.user_id=$3 AND link.revoked_at IS NULL
       FOR UPDATE OF offer`,
      [req.params.offerId, req.params.leaseId, req.user!.id],
    )).rows[0];
    if (!current) throw new HttpError(404, 'Renewal offer not found for this resident account');
    if (current.status !== 'offered' || current.lease_status !== 'active') {
      throw new HttpError(409, 'This renewal offer is no longer available for a response.');
    }
    if (current.expires_on < new Date().toISOString().slice(0, 10)) {
      throw new HttpError(409, 'This renewal offer has expired.');
    }
    const status = body.decision === 'accept' ? 'accepted' : 'declined';
    const offer = (await client.query(
      `UPDATE lease_renewal_offers SET status=$2,responded_by=$3,responded_at=now(),
         response_note=$4,updated_at=now() WHERE id=$1 RETURNING *`,
      [current.id, status, req.user!.id, body.response_note ?? null],
    )).rows[0];
    await client.query(
      `INSERT INTO lease_renewal_offer_events(offer_id,actor_id,event_type,from_status,to_status,reason)
       VALUES($1,$2,$3,'offered',$4,$5)`,
      [offer.id, req.user!.id, status,
        status, body.response_note ?? 'Resident accepted the proposed renewal terms'],
    );
    await client.query(
      `INSERT INTO lease_lifecycle_events(lease_id,from_status,to_status,action,actor_id,reason,metadata)
       VALUES($1,'active','active',$2,$3,$4,jsonb_build_object('offer_id',$5::uuid))`,
      [offer.lease_id, `renewal_offer_${status}`, req.user!.id,
        body.response_note ?? 'Resident accepted the proposed renewal terms', offer.id],
    );
    await notify(client, offer.created_by, `lease_renewal_offer_${status}`, {
      lease_id: offer.lease_id, offer_id: offer.id,
    });
    await audit(client, req.user!.id, `lease_renewal_offer_${status}`, 'lease', offer.lease_id,
      { offer_status: current.status }, { offer_status: status, offer_id: offer.id });
    return { ...offer, renewal_lease_draft_required: status === 'accepted' };
  });
  res.json(result);
}));

ops.post('/leases/renewal-offers/:offerId/convert', requireActivity('property.tenancy.manage'), h(async (req, res) => {
  const { reason } = z.object({ reason: LifecycleReason }).strict().parse(req.body);
  const result = await withUser(req.user!, async (client) => {
    const offer = (await client.query(
      `SELECT offer.*,lease.tenant_id,lease.unit_id,lease.source_agent_id,lease.status AS lease_status,
          lease.end_date AS current_end_date
       FROM lease_renewal_offers offer JOIN leases lease ON lease.id=offer.lease_id
       WHERE offer.id=$1 FOR UPDATE OF offer,lease`,
      [req.params.offerId],
    )).rows[0];
    if (!offer) throw new HttpError(404, 'Lease renewal offer not found');
    const existingDraft = (await client.query(
      `SELECT id FROM leases WHERE renewal_offer_id=$1`,
      [offer.id],
    )).rows[0];
    if (existingDraft) return { lease: existingDraft, replayed: true };
    if (offer.status !== 'accepted') throw new HttpError(409, 'Only an accepted renewal offer can create a lease draft');
    if (offer.lease_status !== 'active') throw new HttpError(409, 'The current lease is no longer active');
    if (String(offer.proposed_start_date).slice(0, 10) <= String(offer.current_end_date).slice(0, 10)) {
      throw new HttpError(409, 'The renewal dates no longer follow the current lease term.');
    }
    const overlap = await client.query(
      `SELECT id FROM leases
       WHERE unit_id=$1 AND id<>$2
         AND status IN ('draft','pending_approval','pending_signature','executed','active')
         AND start_date<=$3 AND end_date>=$4
       FOR UPDATE`,
      [offer.unit_id, offer.lease_id, offer.proposed_end_date, offer.proposed_start_date],
    );
    if (overlap.rowCount) throw new HttpError(409, 'Another lease overlaps the proposed renewal period.');
    const lease = (await client.query(
      `INSERT INTO leases(
         unit_id,tenant_id,rent,deposit,start_date,rent_start_on,end_date,source_agent_id,status,
         created_by,term_months,due_day,renewal_of_lease_id,renewal_offer_id
       ) VALUES($1,$2,$3,$4,$5,$5,$6,$7,'draft',$8,$9,$10,$11,$12)
       RETURNING *`,
      [offer.unit_id, offer.tenant_id, offer.proposed_rent, offer.proposed_deposit,
        offer.proposed_start_date, offer.proposed_end_date, offer.source_agent_id,
        req.user!.id, offer.term_months, offer.due_day, offer.lease_id, offer.id],
    )).rows[0];
    await client.query(
      `INSERT INTO lease_lifecycle_events(lease_id,from_status,to_status,action,actor_id,reason,metadata)
       VALUES($1,NULL,'draft','renewal_draft_created',$2,$3,
         jsonb_build_object('renewal_of_lease_id',$4::uuid,'renewal_offer_id',$5::uuid))`,
      [lease.id, req.user!.id, reason, offer.lease_id, offer.id],
    );
    await client.query(
      `INSERT INTO lease_renewal_offer_events(offer_id,actor_id,event_type,from_status,to_status,reason)
       VALUES($1,$2,'converted','accepted','accepted',$3)`,
      [offer.id, req.user!.id, reason],
    );
    await audit(client, req.user!.id, 'lease_renewal_converted_to_draft', 'lease', lease.id, null, {
      renewal_of_lease_id: offer.lease_id, renewal_offer_id: offer.id,
    });
    return { lease, replayed: false };
  });
  res.status(result.replayed ? 200 : 201).json(result);
}));

ops.post('/leases/:id/submit-for-approval', requireActivity('property.tenancy.manage'), h(async (req, res) => {
  const { reason } = z.object({ reason: LifecycleReason }).parse(req.body);
  res.json(await withUser(req.user!, async (c) => {
    const lease = (await c.query('SELECT * FROM leases WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
    if (!lease) throw new HttpError(404, 'Lease not found');
    if (lease.status !== 'draft') throw new HttpError(409, 'Only a draft lease can be submitted for approval');
    if (lease.created_by !== req.user!.id && !isPlatformAdminRole(req.user!.role)) {
      throw new HttpError(403, 'Only the draft creator or a platform administrator may submit this lease');
    }
    const updated = (await c.query(
      "UPDATE leases SET status='pending_approval' WHERE id=$1 RETURNING *",
      [lease.id],
    )).rows[0];
    await c.query(
      `INSERT INTO lease_lifecycle_events (lease_id,from_status,to_status,action,actor_id,reason)
       VALUES ($1,'draft','pending_approval','submitted_for_approval',$2,$3)`,
      [lease.id, req.user!.id, reason],
    );
    await audit(c, req.user!.id, 'lease_submitted_for_approval', 'lease', lease.id, { status: lease.status }, { reason });
    return updated;
  }));
}));

ops.post('/leases/:id/approve', requireActivity('property.tenancy.approve'), h(async (req, res) => {
  const { reason } = z.object({ reason: LifecycleReason }).parse(req.body);
  res.json(await withUser(req.user!, async (c) => {
    const lease = (await c.query('SELECT * FROM leases WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
    if (!lease) throw new HttpError(404, 'Lease not found');
    if (lease.status !== 'pending_approval') throw new HttpError(409, 'Lease is not awaiting approval');
    if (lease.created_by === req.user!.id) throw new HttpError(403, 'The lease creator cannot approve their own lease');
    const updated = (await c.query(
      `UPDATE leases SET status='pending_signature', approved_by=$2, approved_at=now()
       WHERE id=$1 RETURNING *`,
      [lease.id, req.user!.id],
    )).rows[0];
    await c.query(
      `INSERT INTO lease_lifecycle_events (lease_id,from_status,to_status,action,actor_id,reason)
       VALUES ($1,'pending_approval','pending_signature','lease_approved',$2,$3)`,
      [lease.id, req.user!.id, reason],
    );
    await audit(c, req.user!.id, 'lease_approved', 'lease', lease.id, { status: lease.status }, { reason });
    return updated;
  }));
}));

ops.post('/leases/:id/signature-documents', requireActivity('property.tenancy.manage'),
  express.raw({ type: () => true, limit: '10mb' }), h(async (req, res) => {
    const { party, signer_name: signerName } = z.object({
      party: z.enum(['tenant', 'owner']),
      signer_name: z.string().trim().min(2).max(200),
    }).parse(req.query);
    const buffer = req.body as Buffer;
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new HttpError(400, 'No file received');
    const mime = sniff(buffer);
    if (!mime) throw new HttpError(415, 'Only PDF, JPEG or PNG files are accepted');
    const document = await withUser(req.user!, async (c) => {
      const lease = (await c.query('SELECT id,status FROM leases WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
      if (!lease) throw new HttpError(404, 'Lease not found');
      if (lease.status !== 'pending_signature') throw new HttpError(409, 'Lease is not awaiting signature evidence');
      const storageKey = randomUUID();
      const sha256 = createHash('sha256').update(buffer).digest('hex');
      const row = (await c.query(
        `INSERT INTO lease_documents
           (lease_id,party,signer_name,storage_key,sha256,mime,size_bytes,uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id,lease_id,party,signer_name,sha256,mime,size_bytes,uploaded_by,created_at`,
        [lease.id, party, signerName, storageKey, sha256, mime, buffer.length, req.user!.id],
      )).rows[0];
      await putFile(storageKey, buffer);
      await audit(c, req.user!.id, 'lease_signature_evidence_uploaded', 'lease', lease.id, null,
        { document_id: row.id, party, sha256, mime, size_bytes: buffer.length });
      return row;
    });
    res.status(201).json({ ...document, signature_evidence_only: true });
  }));

ops.get('/lease-signature-documents/:id/file', h(async (req, res) => {
  const document = await withUser(req.user!, async (c) => {
    const row = (await c.query(
      'SELECT id,lease_id,storage_key,mime FROM lease_documents WHERE id=$1',
      [req.params.id],
    )).rows[0];
    if (!row) throw new HttpError(404, 'Lease signature evidence not found');
    await audit(c, req.user!.id, 'lease_signature_evidence_downloaded', 'lease', row.lease_id, null, {
      document_id: row.id,
    });
    return row;
  });
  if (!document) throw new HttpError(404, 'Lease signature evidence not found');
  const file = await getFile(document.storage_key);
  res.set({
    'Content-Type': document.mime,
    'Content-Disposition': 'attachment',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  }).send(file);
}));

ops.post('/leases/:id/execute', requireActivity('property.tenancy.execute'), h(async (req, res) => {
  const b = z.object({
    reason: LifecycleReason,
    handover_date: z.string().date(),
    move_in_inspection_completed: z.literal(true),
  }).parse(req.body);
  const result = await withUser(req.user!, async (c) => {
    const lease = (await c.query('SELECT * FROM leases WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
    if (!lease) throw new HttpError(404, 'Lease not found');
    if (lease.status !== 'pending_signature') throw new HttpError(409, 'Lease is not ready for execution');
    if (lease.created_by === req.user!.id || lease.approved_by === req.user!.id) {
      throw new HttpError(403, 'Lease execution must be performed by someone other than its creator and approver');
    }
    if (b.handover_date < lease.start_date || b.handover_date > lease.end_date) {
      throw new HttpError(422, 'Handover date must fall within the lease term');
    }
    const unit = (await c.query('SELECT id,occupancy FROM property_units WHERE id=$1 FOR UPDATE', [lease.unit_id])).rows[0];
    if (!unit) throw new HttpError(404, 'Unit not found');
    if (unit.occupancy !== 'vacant') throw new HttpError(409, 'The unit is no longer vacant');
    const overlap = await c.query(
      `SELECT id FROM leases
       WHERE unit_id=$1 AND id<>$2 AND status IN ('active','executed')
         AND start_date <= $3 AND end_date >= $4
       FOR UPDATE`,
      [lease.unit_id, lease.id, lease.end_date, lease.start_date],
    );
    if (overlap.rowCount) throw new HttpError(409, 'Another active lease overlaps this lease term');
    const documents = (await c.query(
      `SELECT id,party,signer_name,sha256,mime,size_bytes,uploaded_by
       FROM lease_documents WHERE lease_id=$1 ORDER BY party`,
      [lease.id],
    )).rows;
    if (!documents.some((doc) => doc.party === 'tenant') || !documents.some((doc) => doc.party === 'owner')) {
      throw new HttpError(409, 'Tenant and owner signature evidence are both required');
    }
    const details = (await c.query(
      `SELECT p.id AS property_id,p.address,u.unit_no,t.name AS tenant_name
       FROM property_units u JOIN properties p ON p.id=u.property_id
       JOIN tenants t ON t.id=$2 WHERE u.id=$1`,
      [lease.unit_id, lease.tenant_id],
    )).rows[0];
    if (!details) throw new HttpError(409, 'Lease property or tenant details are no longer available');
    const snapshot = {
      workflow_version: 1,
      lease_id: lease.id,
      property_id: details.property_id,
      property_address: details.address,
      unit_id: lease.unit_id,
      unit_no: details.unit_no,
      tenant_id: lease.tenant_id,
      tenant_name: details.tenant_name,
      rent: String(lease.rent),
      deposit: String(lease.deposit),
      start_date: lease.start_date,
      rent_start_on: lease.rent_start_on,
      end_date: lease.end_date,
      term_months: lease.term_months,
      due_day: lease.due_day,
      approved_by: lease.approved_by,
      approved_at: lease.approved_at,
      handover_date: b.handover_date,
      move_in_inspection_completed: true,
      signature_evidence: documents.map((doc) => ({
        id: doc.id, party: doc.party, signer_name: doc.signer_name, sha256: doc.sha256,
        mime: doc.mime, size_bytes: doc.size_bytes, uploaded_by: doc.uploaded_by,
      })),
    };
    const version = (await c.query(
      `INSERT INTO lease_versions
         (lease_id,version,snapshot,snapshot_sha256,signature_document_ids,created_by)
       VALUES ($1,1,$2::jsonb,encode(digest(convert_to($2::jsonb::text,'UTF8'),'sha256'),'hex'),$3::uuid[],$4)
       RETURNING id,version,snapshot_sha256`,
      [lease.id, JSON.stringify(snapshot), documents.map((doc) => doc.id), req.user!.id],
    )).rows[0];
    const updated = (await c.query(
      `UPDATE leases
       SET status='active',executed_by=$2,executed_at=now(),execution_hash=$3,
           possession_handover_on=$4,move_in_inspection_completed=true
       WHERE id=$1 RETURNING *`,
      [lease.id, req.user!.id, version.snapshot_sha256, b.handover_date],
    )).rows[0];
    for (const charge of rentScheduleForPeriod(lease.rent_start_on, lease.end_date, Number(lease.rent), lease.due_day)) {
      await c.query(
        'INSERT INTO rent_charges (lease_id,period,due_on,amount) VALUES ($1,$2,$3,$4)',
        [lease.id, charge.period, charge.due_on, charge.amount],
      );
    }
    await c.query("UPDATE property_units SET occupancy='occupied' WHERE id=$1", [lease.unit_id]);
    await c.query(
      `INSERT INTO lease_lifecycle_events (lease_id,from_status,to_status,action,actor_id,reason,metadata)
       VALUES ($1,'pending_signature','active','lease_executed',$2,$3,
         jsonb_build_object('lease_version_id',$4::uuid,'snapshot_sha256',$5::text,'handover_date',$6::date,'commencement_on',$7::date,'rent_start_on',$8::date))`,
      [lease.id, req.user!.id, b.reason, version.id, version.snapshot_sha256, b.handover_date, lease.start_date, lease.rent_start_on],
    );
    await c.query(
      `INSERT INTO lease_lifecycle_events (lease_id,from_status,to_status,action,actor_id,reason,metadata)
       VALUES ($1,'active','active','rent_commencement_recorded',$2,
         'Rent commencement is recorded separately from lease commencement and possession handover',
         jsonb_build_object('rent_start_on',$3::date))`,
      [lease.id, req.user!.id, lease.rent_start_on],
    );
    await audit(c, req.user!.id, 'lease_executed', 'lease', lease.id, { status: lease.status }, {
      reason: b.reason, version: version.version, snapshot_sha256: version.snapshot_sha256,
    });
    return { lease: updated, version: { id: version.id, version: version.version, snapshot_sha256: version.snapshot_sha256 } };
  });
  res.json({ ...result, signature_evidence_only: true });
}));

ops.post('/leases', requireActivity('property.tenancy.manage'), h(async (req, res) => {
  if (!legacyImmediateLeasesEnabled(process.env)) {
    throw new HttpError(409, 'Immediate lease activation is disabled. Create a lease draft and complete the approval, signature-evidence, and handover workflow.');
  }
  const row = await withUser(req.user!, async (c) => {
    const b = LeaseIn.parse(req.body);
    const rules = await loadRules(c);
    const minMonths = rules.lease_min_term_months ?? 24;
    const maxMonths = rules.lease_max_months ?? 24;
    if (b.months < minMonths) throw new HttpError(422, `Lease term cannot be less than ${minMonths} months.`);
    if (b.months > maxMonths) throw new HttpError(422, `Lease term cannot exceed ${maxMonths} months.`);
    const dueDay = b.due_day ?? rules.lease_default_due_day ?? 5;
    const u = (await c.query(
      `SELECT u.id,u.occupancy,u.unit_no,p.id AS property_id,p.address,p.source_agent_id
       FROM property_units u JOIN properties p ON p.id=u.property_id
       WHERE u.id=$1 FOR UPDATE OF u`,
      [b.unit_id],
    )).rows[0]; // RLS: must be your unit. The row lock stops two agents leasing the same vacant unit at once.
    if (!u) throw new HttpError(404, 'Unit not found');
    if (u.occupancy !== 'vacant') throw new HttpError(409, 'This unit is not vacant');
    const tenant = (await c.query('SELECT id,name FROM tenants WHERE id=$1', [b.tenant_id])).rows[0];
    if (!tenant) throw new HttpError(404, 'Tenant not found');
    const lease = (await c.query(
      `INSERT INTO leases
         (unit_id,tenant_id,rent,deposit,start_date,rent_start_on,end_date,source_agent_id,created_by,term_months,due_day)
       VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [b.unit_id, b.tenant_id, b.rent, b.deposit, b.start_date, endDate(b.start_date, b.months),
        u.source_agent_id, req.user!.id, b.months, dueDay],
    )).rows[0];
    const legacySnapshot = {
      workflow_version: 1,
      legacy_immediate_active_path: true,
      signature_evidence_available: false,
      lease_id: lease.id,
      property_id: u.property_id,
      property_address: u.address,
      unit_id: b.unit_id,
      unit_no: u.unit_no,
      tenant_id: b.tenant_id,
      tenant_name: tenant.name,
      rent: String(lease.rent),
      deposit: String(lease.deposit),
      start_date: lease.start_date,
      rent_start_on: lease.rent_start_on,
      end_date: lease.end_date,
      term_months: b.months,
      due_day: dueDay,
    };
    await c.query(
      `INSERT INTO lease_versions
         (lease_id,version,snapshot,snapshot_sha256,signature_document_ids,created_by)
       VALUES ($1,1,$2::jsonb,encode(digest(convert_to($2::jsonb::text,'UTF8'),'sha256'),'hex'),'{}'::uuid[],$3)`,
      [lease.id, JSON.stringify(legacySnapshot), req.user!.id],
    );
    await c.query(
      `INSERT INTO lease_lifecycle_events (lease_id,from_status,to_status,action,actor_id,reason,metadata)
       VALUES ($1,NULL,'active','legacy_active_lease_created',$2,
         'Legacy immediate-active lease path retained',
         jsonb_build_object('signature_evidence_available',false))`,
      [lease.id, req.user!.id],
    );
    for (const s of rentSchedule(b.start_date, b.months, b.rent, dueDay)) {
      await c.query('INSERT INTO rent_charges (lease_id, period, due_on, amount) VALUES ($1,$2,$3,$4)', [lease.id, s.period, s.due_on, s.amount]);
    }
    await c.query("UPDATE property_units SET occupancy = 'occupied' WHERE id = $1", [b.unit_id]);
    await audit(c, req.user!.id, 'lease_created', 'lease', lease.id, null, { unit: b.unit_id, months: b.months, rent: b.rent });
    return lease;
  });
  res.status(201).json(row);
}));

ops.get('/leases', requireAnyActivity('property.tenancy.manage', 'rent.payments.submit', 'rent.transactions.view', 'rent.transactions.reconcile', 'rent.transactions.void', 'rent.deposit.refund_request'), h(async (req, res) => {
  res.json(await withUser(req.user!, async (c) => (await c.query(
    `SELECT l.*, t.name AS tenant_name, u.unit_no, p.address,
       (SELECT count(*)::int FROM rent_charges r WHERE r.lease_id = l.id AND r.status = 'due' AND r.due_on < current_date) AS overdue_count,
       COALESCE((SELECT json_agg(json_build_object(
         'id',link.id,'user_id',account.id,'legal_name',account.legal_name
       ) ORDER BY account.legal_name)
         FROM property_tenant_account_links link JOIN users account ON account.id=link.user_id
         WHERE link.tenant_id=l.tenant_id AND link.revoked_at IS NULL),'[]'::json) AS tenant_access_accounts,
       EXISTS (SELECT 1 FROM lease_documents d WHERE d.lease_id=l.id AND d.party='tenant') AS tenant_signature_evidence,
       EXISTS (SELECT 1 FROM lease_documents d WHERE d.lease_id=l.id AND d.party='owner') AS owner_signature_evidence,
       COALESCE((SELECT json_agg(json_build_object(
         'id',offer.id,'status',offer.status,'proposed_rent',offer.proposed_rent::text,
         'proposed_deposit',offer.proposed_deposit::text,'proposed_start_date',offer.proposed_start_date,
         'proposed_end_date',offer.proposed_end_date,'term_months',offer.term_months,
         'due_day',offer.due_day,'expires_on',offer.expires_on,'review_reason',offer.review_reason,
         'response_note',offer.response_note,'request_reason',offer.request_reason,
         'events',(SELECT json_agg(json_build_object(
           'event_type',event.event_type,'from_status',event.from_status,'to_status',event.to_status,
           'reason',event.reason,'created_at',event.created_at
         ) ORDER BY event.created_at,event.id)
           FROM lease_renewal_offer_events event WHERE event.offer_id=offer.id),
         'created_by',offer.created_by,
         'converted_lease_id',(SELECT renewal.id FROM leases renewal WHERE renewal.renewal_offer_id=offer.id)
       ) ORDER BY offer.created_at DESC,offer.id)
         FROM lease_renewal_offers offer WHERE offer.lease_id=l.id),'[]'::json) AS renewal_offers,
       COALESCE((SELECT json_agg(json_build_object(
         'id',inspection.id,'revision',inspection.revision,'actual_vacated_on',inspection.actual_vacated_on,
         'inspected_on',inspection.inspected_on,'condition_notes',inspection.condition_notes,
         'keys_returned',inspection.keys_returned,'deposit_deduction',inspection.deposit_deduction::text,
         'deduction_reason',inspection.deduction_reason,'status',inspection.status,
         'submitted_by',inspection.submitted_by,'reviewed_by',inspection.reviewed_by,
         'review_note',inspection.review_note,'submitted_at',inspection.submitted_at,
         'reviewed_at',inspection.reviewed_at,
         'evidence',(SELECT COALESCE(json_agg(json_build_object(
           'id',evidence.id,'mime',evidence.mime,'size_bytes',evidence.size_bytes,
           'created_at',evidence.created_at
         ) ORDER BY evidence.created_at,evidence.id),'[]'::json)
           FROM lease_move_out_inspection_evidence evidence WHERE evidence.inspection_id=inspection.id),
         'events',(SELECT COALESCE(json_agg(json_build_object(
           'event_type',event.event_type,'reason',event.reason,'created_at',event.created_at
         ) ORDER BY event.created_at,event.id),'[]'::json)
           FROM lease_move_out_inspection_events event WHERE event.inspection_id=inspection.id)
       ) ORDER BY inspection.revision DESC)
         FROM lease_move_out_inspections inspection WHERE inspection.lease_id=l.id),'[]'::json)
         AS move_out_inspections,
       latest_notice.notice_type,latest_notice.received_on AS notice_received_on,
       latest_notice.proposed_effective_on
     FROM leases l JOIN property_units u ON u.id = l.unit_id JOIN properties p ON p.id = u.property_id LEFT JOIN tenants t ON t.id = l.tenant_id
     LEFT JOIN LATERAL (
       SELECT n.notice_type,n.received_on,n.proposed_effective_on
       FROM lease_notices n WHERE n.lease_id=l.id ORDER BY n.created_at DESC LIMIT 1
     ) latest_notice ON true
     ORDER BY l.created_at DESC LIMIT 200`)).rows));
}));

ops.get('/leases/:id/charges', requireAnyActivity('property.tenancy.manage', 'rent.payments.submit', 'rent.transactions.view', 'rent.transactions.reconcile'), h(async (req, res) => {
  res.json(await withUser(req.user!, async (c) => (await c.query(
    "SELECT id, period, due_on, amount, paid_at, payment_ref, CASE WHEN status = 'due' AND due_on < current_date THEN 'overdue' ELSE status END AS status FROM rent_charges WHERE lease_id = $1 ORDER BY period", [req.params.id])).rows));
}));

ops.get('/leases/:id/payments', requireAnyActivity('property.tenancy.manage', 'rent.payments.submit', 'rent.transactions.view', 'rent.transactions.reconcile', 'rent.transactions.void', 'rent.deposit.refund_request'), h(async (req, res) => {
  res.json(await withUser(req.user!, async (c) => (await c.query(
    'SELECT id, kind, amount, channel, reference, reason, status, recorded_by, reconciled_by, created_at, reconciled_at FROM rent_transactions WHERE lease_id = $1 ORDER BY created_at DESC',
    [req.params.id],
  )).rows));
}));

ops.post('/leases/:id/move-out-inspections', requireActivity('property.tenancy.manage'), h(async (req, res) => {
  const body = LeaseMoveOutInspectionIn.parse(req.body);
  const deduction = renewalMoney(body.deposit_deduction, true);
  if (leaseMoneyToCents(deduction) > 0n && !body.deduction_reason) {
    throw new HttpError(422, 'A reason is required for proposed deposit deductions.');
  }
  const inspection = await withUser(req.user!, async (c) => {
    const lease = (await c.query(
      `SELECT id,status,start_date,current_date::text AS today
       FROM leases WHERE id=$1 FOR UPDATE`,
      [req.params.id],
    )).rows[0];
    if (!lease) throw new HttpError(404, 'Lease not found');
    if (lease.status !== 'active') throw new HttpError(409, 'Only an active lease can receive a move-out inspection');
    if (body.actual_vacated_on < String(lease.start_date).slice(0, 10)
      || body.actual_vacated_on > lease.today
      || body.inspected_on < body.actual_vacated_on
      || body.inspected_on > lease.today) {
      throw new HttpError(422, 'Move-out and inspection dates must be valid, current dates within the lease period.');
    }
    const latest = (await c.query(
      `SELECT revision,status FROM lease_move_out_inspections
       WHERE lease_id=$1 ORDER BY revision DESC LIMIT 1 FOR UPDATE`,
      [lease.id],
    )).rows[0];
    if (latest?.status === 'pending_review') {
      throw new HttpError(409, 'A move-out inspection is already awaiting review.');
    }
    if (latest?.status === 'approved') {
      throw new HttpError(409, 'An approved move-out inspection already exists for this lease.');
    }
    const row = (await c.query(
      `INSERT INTO lease_move_out_inspections(
         lease_id,revision,actual_vacated_on,inspected_on,condition_notes,keys_returned,
         deposit_deduction,deduction_reason,submitted_by
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [lease.id, (latest?.revision ?? 0) + 1, body.actual_vacated_on, body.inspected_on,
        body.condition_notes, body.keys_returned, deduction, body.deduction_reason ?? null, req.user!.id],
    )).rows[0];
    await c.query(
      `INSERT INTO lease_move_out_inspection_events(inspection_id,actor_id,event_type,reason)
       VALUES($1,$2,'submitted',$3)`,
      [row.id, req.user!.id, body.condition_notes.slice(0, 1000)],
    );
    await audit(c, req.user!.id, 'lease_move_out_inspection_submitted', 'lease', lease.id, null, {
      inspection_id: row.id, revision: row.revision, actual_vacated_on: body.actual_vacated_on,
      deposit_deduction: deduction,
    });
    return row;
  });
  res.status(201).json(inspection);
}));

ops.post('/leases/:id/move-out-inspections/:inspectionId/decision',
  requireActivity('property.tenancy.approve'), h(async (req, res) => {
    const body = z.object({ decision: z.enum(['approve','reject']), reason: LifecycleReason }).strict().parse(req.body);
    const inspection = await withUser(req.user!, async (c) => {
      const current = (await c.query(
        `SELECT inspection.*,lease.status AS lease_status
         FROM lease_move_out_inspections inspection
         JOIN leases lease ON lease.id=inspection.lease_id
         WHERE inspection.id=$1 AND inspection.lease_id=$2
         FOR UPDATE OF inspection,lease`,
        [req.params.inspectionId, req.params.id],
      )).rows[0];
      if (!current) throw new HttpError(404, 'Move-out inspection not found');
      if (current.status !== 'pending_review') throw new HttpError(409, 'Move-out inspection is not awaiting review');
      if (current.submitted_by === req.user!.id) {
        throw new HttpError(403, 'The inspection submitter cannot review their own inspection');
      }
      if (current.lease_status !== 'active') throw new HttpError(409, 'The lease is no longer active');
      if (body.decision === 'approve') {
        const deposit = (await c.query(
          `SELECT COALESCE(sum(amount),0)::text AS amount FROM rent_transactions
           WHERE lease_id=$1 AND kind='deposit' AND status='reconciled'`,
          [req.params.id],
        )).rows[0].amount;
        if (leaseMoneyToCents(String(current.deposit_deduction)) > leaseMoneyToCents(String(deposit))) {
          throw new HttpError(422, 'Proposed deposit deductions exceed the reconciled deposit.');
        }
      }
      const status = body.decision === 'approve' ? 'approved' : 'rejected';
      const updated = (await c.query(
        `UPDATE lease_move_out_inspections
         SET status=$2,reviewed_by=$3,reviewed_at=now(),review_note=$4
         WHERE id=$1 RETURNING *`,
        [current.id, status, req.user!.id, body.reason],
      )).rows[0];
      await c.query(
        `INSERT INTO lease_move_out_inspection_events(inspection_id,actor_id,event_type,reason)
         VALUES($1,$2,$3,$4)`,
        [current.id, req.user!.id, status, body.reason],
      );
      await audit(c, req.user!.id, `lease_move_out_inspection_${status}`, 'lease', req.params.id, {
        status: current.status,
      }, { status, inspection_id: current.id, revision: current.revision, reason: body.reason });
      return updated;
    });
    res.json(inspection);
  }));

ops.post('/leases/:id/move-out-inspections/:inspectionId/evidence',
  requireActivity('property.tenancy.manage'),
  express.raw({ type: () => true, limit: '10mb' }), h(async (req, res) => {
    const buffer = req.body as Buffer;
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new HttpError(400, 'No file received');
    const mime = sniff(buffer);
    if (!mime) throw new HttpError(415, 'Only PDF, JPEG or PNG evidence is accepted');
    const evidence = await withUser(req.user!, async (c) => {
      const inspection = (await c.query(
        `SELECT inspection.id,inspection.status,lease.status AS lease_status
         FROM lease_move_out_inspections inspection JOIN leases lease ON lease.id=inspection.lease_id
         WHERE inspection.id=$1 AND inspection.lease_id=$2 FOR UPDATE OF inspection,lease`,
        [req.params.inspectionId, req.params.id],
      )).rows[0];
      if (!inspection) throw new HttpError(404, 'Move-out inspection not found');
      if (inspection.status !== 'pending_review' || inspection.lease_status !== 'active') {
        throw new HttpError(409, 'Evidence can only be added to an inspection awaiting review.');
      }
      const storageKey = randomUUID();
      const sha256 = createHash('sha256').update(buffer).digest('hex');
      const row = (await c.query(
        `INSERT INTO lease_move_out_inspection_evidence
           (inspection_id,storage_key,sha256,mime,size_bytes,uploaded_by)
         VALUES($1,$2,$3,$4,$5,$6)
         RETURNING id,inspection_id,sha256,mime,size_bytes,uploaded_by,created_at`,
        [inspection.id, storageKey, sha256, mime, buffer.length, req.user!.id],
      )).rows[0];
      await putFile(storageKey, buffer);
      await audit(c, req.user!.id, 'lease_move_out_evidence_uploaded', 'lease', req.params.id, null, {
        evidence_id: row.id, inspection_id: inspection.id, sha256, mime, size_bytes: buffer.length,
      });
      return row;
    });
    res.status(201).json(evidence);
  }));

ops.get('/lease-move-out-evidence/:id/file', h(async (req, res) => {
  const evidence = await withUser(req.user!, async (c) => {
    const row = (await c.query(
      `SELECT evidence.id,evidence.inspection_id,evidence.storage_key,evidence.mime,inspection.lease_id
       FROM lease_move_out_inspection_evidence evidence
       JOIN lease_move_out_inspections inspection ON inspection.id=evidence.inspection_id
       WHERE evidence.id=$1`,
      [req.params.id],
    )).rows[0];
    if (!row) throw new HttpError(404, 'Move-out inspection evidence not found');
    await audit(c, req.user!.id, 'lease_move_out_evidence_downloaded', 'lease', row.lease_id, null, {
      evidence_id: row.id, inspection_id: row.inspection_id,
    });
    return row;
  });
  const file = await getFile(evidence.storage_key);
  res.set({
    'Content-Type': evidence.mime,
    'Content-Disposition': 'attachment',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  }).send(file);
}));

ops.post('/leases/:id/end', requireActivity('property.tenancy.manage'), h(async (req, res) => {
  const { reason } = z.object({ reason: LifecycleReason }).strict().parse(req.body);
  res.json(await withUser(req.user!, async (c) => {
    const lease = (await c.query('SELECT * FROM leases WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
    if (!lease || lease.status !== 'active') throw new HttpError(404, 'Active lease not found');
    const inspection = (await c.query(
      `SELECT id,revision,actual_vacated_on FROM lease_move_out_inspections
       WHERE lease_id=$1 AND status='approved' FOR SHARE`,
      [lease.id],
    )).rows[0];
    if (!inspection) throw new HttpError(409, 'An independently reviewed move-out inspection is required before ending this lease.');
    if (await c.query(
      `SELECT 1 FROM leases WHERE unit_id=$1 AND id<>$2 AND status='active' FOR UPDATE`,
      [lease.unit_id, lease.id],
    ).then((result) => result.rowCount)) {
      throw new HttpError(409, 'Another active lease still occupies this unit.');
    }
    const ended = (await c.query(
      `UPDATE leases SET status='ended',ended_on=$2,termination_reason=$3
       WHERE id=$1 AND status='active' RETURNING *`,
      [lease.id, inspection.actual_vacated_on, reason],
    )).rows[0];
    if (!ended) throw new HttpError(409, 'Lease status changed before closeout completed.');
    await c.query(
      `UPDATE rent_charges SET status='waived'
       WHERE lease_id=$1 AND status='due' AND period>current_date`,
      [lease.id],
    );
    await c.query("SELECT set_config('app.unit_turnover_lease_id',$1,true)", [lease.id]);
    await c.query("UPDATE property_units SET occupancy='turnover' WHERE id=$1", [lease.unit_id]);
    await c.query(
      `INSERT INTO lease_lifecycle_events(lease_id,from_status,to_status,action,actor_id,reason,metadata)
       VALUES($1,'active','ended','lease_ended',$2,$3,
         jsonb_build_object('inspection_id',$4::uuid,'inspection_revision',$5::int,'ended_on',$6::date))`,
      [lease.id, req.user!.id, reason, inspection.id, inspection.revision, inspection.actual_vacated_on],
    );
    await audit(c, req.user!.id, 'lease_ended', 'lease', lease.id, { status: lease.status }, {
      reason, ended_on: inspection.actual_vacated_on, inspection_id: inspection.id,
    });
    return ended;
  }));
}));

// ----------------- Service identity inventory -----------------
ops.post('/service-identities', requireRole('global_admin'), h(async (req, res) => {
  const b = z.object({
    name: z.string().trim().min(3).max(200),
    purpose: z.string().trim().min(3).max(1000),
    environment: z.enum(['production','staging','development','sandbox']).default('staging'),
    owner_user_id: z.string().uuid().optional(),
    expiry_date: z.string().date().optional(),
    secret_manager_reference: z.string().trim().regex(/^(vault|aws-sm|azure-kv):\/\/[A-Za-z0-9._/-]+$/),
    evidence: z.string().trim().min(10).max(2000),
  }).parse(req.body);
  if (b.expiry_date && b.expiry_date <= new Date().toISOString().slice(0, 10)) {
    throw new HttpError(422, 'Expiry date must be in the future');
  }
  res.status(201).json(await withUser(req.user!, async (c) => {
    if (b.owner_user_id && !(await c.query('SELECT 1 FROM users WHERE id=$1 AND active=true', [b.owner_user_id])).rowCount) {
      throw new HttpError(422, 'The named service identity owner must be an active user');
    }
    const row = (await c.query(
      `INSERT INTO service_identities
         (name,purpose,environment,owner_user_id,expiry_date,secret_manager_reference,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [b.name, b.purpose, b.environment, b.owner_user_id ?? null, b.expiry_date ?? null, b.secret_manager_reference, req.user!.id],
    )).rows[0];
    await c.query(
      `INSERT INTO service_identity_events
         (service_identity_id,action,actor_id,current_status,evidence)
       VALUES ($1,'created',$2,$3,$4)`,
      [row.id, req.user!.id, row.status, b.evidence],
    );
    await audit(c, req.user!.id, 'service_identity_created', 'service_identity', row.id, null, { name: b.name, environment: b.environment });
    return row;
  }));
}));

ops.get('/service-identities', requireRole('global_admin'), h(async (req, res) => {
  res.json(await withUser(req.user!, async (c) => (await c.query(
    `SELECT si.id,si.name,si.purpose,si.environment,si.owner_user_id,si.expiry_date,
       si.secret_manager_reference,si.rotated_at,si.last_rotated_by,si.last_rotation_evidence,
       si.status,si.created_by,si.created_at,
       (SELECT max(e.created_at) FROM service_identity_events e WHERE e.service_identity_id=si.id) AS last_event_at
     FROM service_identities si ORDER BY si.created_at DESC LIMIT 500`,
  )).rows));
}));

ops.post('/service-identities/:id/rotate', requireRole('super_admin', 'global_admin'), h(async (req, res) => {
  const b = z.object({
    secret_manager_reference: z.string().trim().regex(/^(vault|aws-sm|azure-kv):\/\/[A-Za-z0-9._/-]+$/),
    expiry_date: z.string().date(),
    evidence: z.string().trim().min(10).max(2000),
  }).parse(req.body);
  if (b.expiry_date <= new Date().toISOString().slice(0, 10)) throw new HttpError(422, 'Expiry date must be in the future');
  res.json(await withUser(req.user!, async (c) => {
    const current = (await c.query('SELECT id,status,created_by FROM service_identities WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
    if (!current) throw new HttpError(404, 'Service identity not found');
    if (current.status !== 'active') throw new HttpError(409, 'Only an active service identity can be rotated');
    if (current.created_by === req.user!.id) throw new HttpError(403, 'A different platform administrator must verify the rotation');
    const row = (await c.query(
      `UPDATE service_identities
       SET secret_manager_reference=$2,expiry_date=$3,rotated_at=now(),
           last_rotated_by=$4,last_rotation_evidence=$5
       WHERE id=$1 RETURNING *`,
      [current.id, b.secret_manager_reference, b.expiry_date, req.user!.id, b.evidence],
    )).rows[0];
    await c.query(
      `INSERT INTO service_identity_events
         (service_identity_id,action,actor_id,previous_status,current_status,evidence)
       VALUES ($1,'rotated',$2,$3,$4,$5)`,
      [row.id, req.user!.id, current.status, row.status, b.evidence],
    );
    await audit(c, req.user!.id, 'service_identity_rotated', 'service_identity', row.id, null, { expiry_date: b.expiry_date });
    return row;
  }));
}));

ops.post('/service-identities/:id/retire', requireRole('super_admin', 'global_admin'), h(async (req, res) => {
  const { evidence } = z.object({ evidence: z.string().trim().min(10).max(2000) }).parse(req.body);
  res.json(await withUser(req.user!, async (c) => {
    const current = (await c.query('SELECT id,status,created_by FROM service_identities WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
    if (!current) throw new HttpError(404, 'Service identity not found');
    if (current.status !== 'active') throw new HttpError(409, 'Only an active service identity can be retired');
    if (current.created_by === req.user!.id) throw new HttpError(403, 'A different platform administrator must approve retirement');
    const row = (await c.query(
      "UPDATE service_identities SET status='retired' WHERE id=$1 RETURNING *",
      [current.id],
    )).rows[0];
    await c.query(
      `INSERT INTO service_identity_events
         (service_identity_id,action,actor_id,previous_status,current_status,evidence)
       VALUES ($1,'retired',$2,$3,$4,$5)`,
      [row.id, req.user!.id, current.status, row.status, evidence],
    );
    await audit(c, req.user!.id, 'service_identity_retired', 'service_identity', row.id, { status: current.status }, { status: row.status });
    return row;
  }));
}));

ops.get('/service-identities/:id/events', requireRole('global_admin'), h(async (req, res) => {
  res.json(await withUser(req.user!, async (c) => {
    if (!(await c.query('SELECT 1 FROM service_identities WHERE id=$1', [req.params.id])).rowCount) {
      throw new HttpError(404, 'Service identity not found');
    }
    return (await c.query(
      `SELECT id,action,actor_id,previous_status,current_status,evidence,created_at
       FROM service_identity_events WHERE service_identity_id=$1 ORDER BY created_at DESC LIMIT 200`,
      [req.params.id],
    )).rows;
  }));
}));

ops.get('/finance/property-chart-of-accounts-template', requireRole('finance','finance_manager','super_admin','global_admin'), h(async (_req, res) => {
  res.json(PROPERTY_CHART_OF_ACCOUNTS);
}));

ops.get('/finance/property-period-close', requireRole('finance','finance_manager','super_admin','global_admin'), h(async (req, res) => {
  const { period } = z.object({ period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }).parse(req.query);
  const result = await withUser(req.user!, async (c) => {
    const pending = await c.query(
      `SELECT count(*)::int AS count FROM rent_transactions
       WHERE created_at < (($1 || '-01')::date + interval '1 month')
         AND (status='pending'
           OR (status='reconciled' AND reconciled_at >= (($1 || '-01')::date + interval '1 month'))
           OR (status='void' AND voided_at >= (($1 || '-01')::date + interval '1 month')))`,
      [period],
    );
    const unpaid = await c.query(
      `SELECT count(*)::int AS count FROM rent_charges
       WHERE due_on < (($1 || '-01')::date + interval '1 month')
         AND (status='due' OR (status='paid' AND paid_at >= (($1 || '-01')::date + interval '1 month')))`,
      [period],
    );
    const unbalanced = await c.query(
      `SELECT count(*)::int AS count FROM (
         SELECT entries.txn_id
         FROM ledger_entries entries
         WHERE entries.ref_type='rent_transaction'
           AND entries.txn_id IN (
             SELECT period_entries.txn_id FROM ledger_entries period_entries
             WHERE period_entries.ref_type='rent_transaction'
               AND period_entries.created_at >= ($1 || '-01')::date
               AND period_entries.created_at < (($1 || '-01')::date + interval '1 month')
           )
         GROUP BY entries.txn_id HAVING sum(entries.debit) <> sum(entries.credit)
       ) invalid`,
      [period],
    );
    return propertyPeriodCloseCheck({
      period,
      pendingReceipts: Number(pending.rows[0].count),
      unpaidRentCharges: Number(unpaid.rows[0].count),
      unbalancedLedgerTransactions: Number(unbalanced.rows[0].count),
    });
  });
  res.json({ ...result, chart_of_accounts_status: PROPERTY_CHART_OF_ACCOUNTS.status });
}));

// ----------------- Release approvals (record owner sign-off) -----------------
ops.get('/readiness-evidence', requireRole('super_admin','global_admin'), h(async (req, res) => {
  res.json(await withUser(req.user!, async (c) => (await c.query(
    `SELECT e.id,e.module,e.category,e.status,e.owner_name,e.approver_name,
       e.evidence_reference,e.environment,e.notes,e.recorded_by_role,e.created_at,
       u.legal_name AS recorded_by_name
     FROM release_readiness_evidence e
     JOIN users u ON u.id=e.recorded_by
     ORDER BY e.created_at DESC LIMIT 500`,
  )).rows));
}));

ops.post('/readiness-evidence', requireRole('super_admin','global_admin'), h(async (req, res) => {
  const b = z.object({
    module: z.enum(['platform','workforce','insurance','mfi','edir','property','marketplace','agency']),
    category: z.enum([
      'legal','provider','finance','security','operations','accessibility','capacity','dr','incident','service_account','release_owner','privacy',
      'insurance_license','insurance_professional_indemnity','insurance_ceo_oversight','insurance_branch_oversight',
      'insurance_market_comparison','insurance_customer_choice_exception','insurance_disclosure_consent',
      'insurance_policy_issuance','insurance_premium_custody','insurance_claims_records','insurance_data_rights',
      'insurance_tenant_isolation','insurance_integration_reconciliation','insurance_business_continuity',
      'insurance_global_financial_reporting','insurance_commission_distribution','insurance_legal_signoff',
    ]),
    status: z.enum(['open','evidence_recorded','blocked','not_applicable']),
    owner_name: z.string().trim().min(2).max(160),
    approver_name: z.string().trim().min(2).max(160),
    evidence_reference: z.string().trim().min(3).max(500),
    environment: z.enum(['production','staging','sandbox','development']),
    notes: z.string().trim().max(4000).default(''),
  }).strict().parse(req.body);
  res.status(201).json(await withUser(req.user!, async (c) => {
    const row = (await c.query(
      `INSERT INTO release_readiness_evidence
         (module,category,status,owner_name,approver_name,evidence_reference,environment,notes,recorded_by,recorded_by_role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id,module,category,status,owner_name,approver_name,evidence_reference,environment,notes,recorded_by_role,created_at`,
      [b.module,b.category,b.status,b.owner_name,b.approver_name,b.evidence_reference,b.environment,b.notes,req.user!.id,req.user!.role],
    )).rows[0];
    await audit(c, req.user!.id, 'release_readiness_evidence_recorded', 'release_readiness_evidence', row.id, null, {
      module: b.module, category: b.category, status: b.status, environment: b.environment,
    });
    return row;
  }));
}));

ops.post('/releases/:id/approve', requireRole('super_admin','global_admin','finance','finance_manager'), h(async (req, res) => {
  const b = z.object({
    decision: z.enum(['approve','reject']),
    notes: z.string().trim().min(10).max(4000),
  }).parse(req.body);
  res.status(201).json(await withUser(req.user!, async (c) => {
    const approver = (await c.query('SELECT legal_name,email,role FROM users WHERE id=$1', [req.user!.id])).rows[0];
    const row = (await c.query(
      `INSERT INTO release_approvals (release_candidate, approver_role, approver_name, approver_email, decision, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.id, approver.role, approver.legal_name, approver.email, b.decision, b.notes ?? null],
    )).rows[0];
    await audit(c, req.user!.id, 'release_approval_recorded', 'release_approval', row.id, null, { release_candidate: req.params.id, decision: b.decision });
    return row;
  }));
}));

ops.post('/charges/:id/pay', requireActivity('rent.payments.submit'), h(async (req, res) => {
  const { reference, channel } = z.object({ reference: z.string().trim().min(3).max(200), channel: z.string().trim().min(2).max(40).default('manual') }).parse(req.body);
  res.json(await withUser(req.user!, async (c) => {
    const charge = (await c.query('SELECT r.*, l.id AS lease_id FROM rent_charges r JOIN leases l ON l.id = r.lease_id WHERE r.id = $1 FOR UPDATE OF r', [req.params.id])).rows[0];
    if (!charge || charge.status !== 'due') throw new HttpError(409, 'Charge not found or already settled');
    if (await c.query("SELECT 1 FROM rent_transactions WHERE rent_charge_id = $1 AND kind = 'rent' AND status <> 'void'", [charge.id]).then((x) => x.rowCount)) throw new HttpError(409, 'A payment is already awaiting reconciliation for this charge');
    if (await c.query('SELECT 1 FROM rent_transactions WHERE reference = $1', [reference]).then((x) => x.rowCount)) throw new HttpError(409, 'That payment reference has already been used');
    const r = await c.query(
      `INSERT INTO rent_transactions (lease_id, rent_charge_id, kind, amount, channel, reference, recorded_by)
       VALUES ($1,$2,'rent',$3,$4,$5,$6) RETURNING *`,
      [charge.lease_id, charge.id, charge.amount, channel, reference, req.user!.id],
    );
    await audit(c, req.user!.id, 'rent_payment_recorded', 'rent_transaction', r.rows[0].id, null, { reference, amount: charge.amount });
    return r.rows[0];
  }));
}));

ops.post('/leases/:id/deposit/pay', requireActivity('rent.payments.submit'), h(async (req, res) => {
  const b = z.object({ reference: z.string().trim().min(3).max(200), channel: z.string().trim().min(2).max(40).default('manual') }).parse(req.body);
  res.status(201).json(await withUser(req.user!, async (c) => {
    const lease = (await c.query('SELECT * FROM leases WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!lease) throw new HttpError(404, 'Lease not found');
    if (lease.status !== 'active') throw new HttpError(409, 'A deposit can be collected only for an active lease');
    if (Number(lease.deposit) <= 0) throw new HttpError(409, 'This lease has no deposit due');
    if (await c.query('SELECT 1 FROM rent_transactions WHERE reference = $1', [b.reference]).then((x) => x.rowCount)) throw new HttpError(409, 'That payment reference has already been used');
    if (await c.query("SELECT 1 FROM rent_transactions WHERE lease_id = $1 AND kind = 'deposit' AND status <> 'void'", [lease.id]).then((x) => x.rowCount)) throw new HttpError(409, 'A deposit payment is already recorded for this lease');
    const payment = (await c.query(
      `INSERT INTO rent_transactions (lease_id, kind, amount, channel, reference, recorded_by)
       VALUES ($1,'deposit',$2,$3,$4,$5) RETURNING *`,
      [lease.id, lease.deposit, b.channel, b.reference, req.user!.id],
    )).rows[0];
    await audit(c, req.user!.id, 'deposit_payment_recorded', 'rent_transaction', payment.id, null, { amount: lease.deposit, reference: b.reference });
    return payment;
  }));
}));

ops.post('/leases/:id/deposit/refund', requireActivity('rent.deposit.refund_request'), h(async (req, res) => {
  const b = z.object({
    amount: z.union([z.string().trim(), z.number().finite().transform(String)])
      .pipe(z.string().regex(/^\d{1,12}(?:\.\d{1,2})?$/)),
    reference: z.string().trim().min(3).max(200),
    channel: z.string().trim().min(2).max(40).default('manual'),
    reason: z.string().trim().min(10).max(1000),
  }).strict().parse(req.body);
  const amount = renewalMoney(b.amount);
  res.status(201).json(await withUser(req.user!, async (c) => {
    const lease = (await c.query('SELECT * FROM leases WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!lease) throw new HttpError(404, 'Lease not found');
    if (lease.status !== 'ended') throw new HttpError(409, 'A deposit can be returned only after the lease ends');
    const disposition = (await c.query(
      `SELECT deposit_deduction::text FROM lease_move_out_inspections
       WHERE lease_id=$1 AND status='approved'`,
      [lease.id],
    )).rows[0];
    if (!disposition) throw new HttpError(409, 'An approved move-out deposit disposition is required before refunding the deposit.');
    if (await c.query('SELECT 1 FROM rent_transactions WHERE reference = $1', [b.reference]).then((x) => x.rowCount)) throw new HttpError(409, 'That payment reference has already been used');
    const deposit = (await c.query("SELECT * FROM rent_transactions WHERE lease_id = $1 AND kind = 'deposit' AND status = 'reconciled' FOR UPDATE", [lease.id])).rows[0];
    if (!deposit) throw new HttpError(409, 'The deposit must be collected and reconciled before it can be returned');
    const reserved = (await c.query("SELECT coalesce(sum(amount),0)::text AS amount FROM rent_transactions WHERE lease_id = $1 AND kind = 'deposit_refund' AND status <> 'void'", [lease.id])).rows[0].amount;
    const refundable = leaseMoneyToCents(String(deposit.amount)) - leaseMoneyToCents(String(disposition.deposit_deduction));
    const available = refundable - leaseMoneyToCents(renewalMoney(String(reserved), true));
    if (available < 0n || leaseMoneyToCents(amount) > available) {
      throw new HttpError(422, 'Refund exceeds the approved remaining deposit disposition.');
    }
    const refund = (await c.query(
      `INSERT INTO rent_transactions (lease_id, kind, amount, channel, reference, reason, recorded_by)
       VALUES ($1,'deposit_refund',$2,$3,$4,$5,$6) RETURNING *`,
      [lease.id, amount, b.channel, b.reference, b.reason, req.user!.id],
    )).rows[0];
    await audit(c, req.user!.id, 'deposit_refund_recorded', 'rent_transaction', refund.id, null, { amount, reference: b.reference, reason: b.reason });
    return refund;
  }));
}));

ops.post('/rent-transactions/:id/reconcile', requireActivity('rent.transactions.reconcile'), h(async (req, res) => {
  res.json(await withUser(req.user!, async (c) => {
    const link = (await c.query('SELECT lease_id FROM rent_transactions WHERE id = $1', [req.params.id])).rows[0];
    if (!link) throw new HttpError(404, 'Rent transaction not found');
    const lease = (await c.query('SELECT * FROM leases WHERE id = $1 FOR UPDATE', [link.lease_id])).rows[0];
    const transaction = (await c.query('SELECT * FROM rent_transactions WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!transaction) throw new HttpError(404, 'Rent transaction not found');
    if (transaction.status !== 'pending') throw new HttpError(409, 'Rent transaction is already reconciled');
    if (transaction.recorded_by === req.user!.id) throw new HttpError(403, 'A different finance officer must reconcile this transaction');
    let entry: [string, number, number][];
    if (transaction.kind === 'rent') {
      const charge = (await c.query('SELECT * FROM rent_charges WHERE id = $1 AND lease_id = $2 FOR UPDATE', [transaction.rent_charge_id, lease.id])).rows[0];
      if (!charge || charge.status !== 'due' || Math.round(Number(charge.amount) * 100) !== Math.round(Number(transaction.amount) * 100)) throw new HttpError(409, 'The rent charge is no longer payable');
      await c.query("UPDATE rent_charges SET status = 'paid', paid_at = now(), payment_ref = $2, recorded_by = $3 WHERE id = $1", [charge.id, transaction.reference, transaction.recorded_by]);
      entry = [['Cash', Number(transaction.amount), 0], ['Rental Revenue', 0, Number(transaction.amount)]];
    } else if (transaction.kind === 'deposit') {
      entry = [['Cash', Number(transaction.amount), 0], ['Tenant Deposit Liability', 0, Number(transaction.amount)]];
    } else {
      if (lease.status !== 'ended') throw new HttpError(409, 'The lease must remain ended while its deposit is returned');
      const disposition = (await c.query(
        `SELECT deposit_deduction::text FROM lease_move_out_inspections
         WHERE lease_id=$1 AND status='approved'`,
        [lease.id],
      )).rows[0];
      if (!disposition) throw new HttpError(409, 'An approved move-out deposit disposition is required before reconciling this refund');
      const deposit = (await c.query("SELECT amount FROM rent_transactions WHERE lease_id = $1 AND kind = 'deposit' AND status = 'reconciled' FOR UPDATE", [lease.id])).rows[0];
      if (!deposit) throw new HttpError(409, 'No collected deposit is available');
      const reserved = (await c.query("SELECT coalesce(sum(amount),0)::text AS amount FROM rent_transactions WHERE lease_id = $1 AND kind = 'deposit_refund' AND status <> 'void'", [lease.id])).rows[0].amount;
      const refundable = leaseMoneyToCents(String(deposit.amount)) - leaseMoneyToCents(String(disposition.deposit_deduction));
      if (refundable < 0n || leaseMoneyToCents(String(reserved)) > refundable) {
        throw new HttpError(409, 'Deposit refunds exceed the independently approved refundable balance');
      }
      entry = [['Tenant Deposit Liability', Number(transaction.amount), 0], ['Cash', 0, Number(transaction.amount)]];
    }
    await post(c, 'rent_transaction', transaction.id, entry);
    const reconciled = (await c.query("UPDATE rent_transactions SET status = 'reconciled', reconciled_by = $2, reconciled_at = now() WHERE id = $1 AND status = 'pending' RETURNING *,reconciled_at::date::text AS accounting_entry_date", [transaction.id, req.user!.id])).rows[0];
    const property = (await c.query(
      `SELECT p.id FROM properties p JOIN property_units u ON u.property_id=p.id WHERE u.id=$1`, [lease.unit_id],
    )).rows[0];
    const accountLines = transaction.kind === 'rent'
      ? [{ source_account_code: 'cash', debit: String(transaction.amount), credit: '0.00' }, { source_account_code: 'rental_revenue', debit: '0.00', credit: String(transaction.amount) }]
      : transaction.kind === 'deposit'
        ? [{ source_account_code: 'cash', debit: String(transaction.amount), credit: '0.00' }, { source_account_code: 'tenant_deposit_liability', debit: '0.00', credit: String(transaction.amount) }]
        : [{ source_account_code: 'tenant_deposit_liability', debit: String(transaction.amount), credit: '0.00' }, { source_account_code: 'cash', debit: '0.00', credit: String(transaction.amount) }];
    await enqueueAccountingEvent(c, {
      source_entity_id: property.id,
      entry_date: reconciled.accounting_entry_date,
      source_reference: `rent:${transaction.reference}`,
      description: `${transaction.kind.replace('_', ' ')} payment ${transaction.reference}`,
      lines: accountLines,
      maker_id: transaction.recorded_by,
      checker_id: req.user!.id,
      checker_reason: `Rent transaction ${transaction.id} reconciled after independent finance review`,
    });
    await audit(c, req.user!.id, 'rent_transaction_reconciled', 'rent_transaction', transaction.id, { status: transaction.status }, { status: 'reconciled', kind: transaction.kind, amount: transaction.amount });
    return reconciled;
  }));
}));

ops.post('/rent-transactions/:id/void', requireActivity('rent.transactions.void'), h(async (req, res) => {
  const { reason } = z.object({ reason: z.string().trim().min(10).max(1000) }).parse(req.body);
  res.json(await withUser(req.user!, async (c) => {
    const transaction = (await c.query('SELECT * FROM rent_transactions WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!transaction) throw new HttpError(404, 'Rent transaction not found');
    if (transaction.status !== 'pending') throw new HttpError(409, 'Only a pending receipt can be voided');
    if (transaction.recorded_by === req.user!.id) throw new HttpError(403, 'A different finance officer must void this receipt');
    const result = (await c.query(
      "UPDATE rent_transactions SET status = 'void', voided_by = $2, voided_at = now(), void_reason = $3 WHERE id = $1 AND status = 'pending' RETURNING *",
      [transaction.id, req.user!.id, reason],
    )).rows[0];
    await audit(c, req.user!.id, 'rent_transaction_voided', 'rent_transaction', transaction.id, { status: 'pending' }, { status: 'void', reason });
    return result;
  }));
}));

ops.get('/rent-transactions/pending', requireAnyActivity('rent.transactions.view', 'rent.transactions.reconcile', 'rent.transactions.void'), h(async (req, res) => {
  res.json(await withUser(req.user!, async (c) => (await c.query(
    "SELECT id, lease_id, rent_charge_id, kind, amount, channel, reference, reason, recorded_by, created_at FROM rent_transactions WHERE status = 'pending' ORDER BY created_at LIMIT 200",
  )).rows));
}));

// ================= Maintenance =================
ops.post('/maintenance', requireActivity('property.maintenance.manage'), h(async (req, res) => {
  if (req.user!.role === 'field_agent') {
    throw new HttpError(403, 'Field agents can only work on maintenance assigned to them');
  }
  const b = z.object({ property_id: z.string().uuid(), unit_id: z.string().uuid().optional(), description: z.string().trim().min(10).max(2000), category: z.enum(['general','plumbing','electrical','appliance','structural','cleaning','safety','other']).default('general'), priority: z.enum(['low', 'normal', 'urgent']).default('normal'), idempotency_key: z.string().uuid().optional() }).parse(req.body);
  const priority = b.category === 'safety' ? 'urgent' : b.priority;
  const payloadHash = b.idempotency_key ? createHash('sha256').update(JSON.stringify({
    property_id: b.property_id, unit_id: b.unit_id ?? null, description: b.description, category: b.category, priority,
  })).digest('hex') : null;
  const result = await withUser(req.user!, async (c) => {
    if (b.idempotency_key) {
      const existing = (await c.query(
        'SELECT * FROM maintenance_requests WHERE idempotency_user_id=$1 AND idempotency_key=$2',
        [req.user!.id, b.idempotency_key],
      )).rows[0];
      if (existing) {
        if (existing.idempotency_payload_hash !== payloadHash) throw new HttpError(409, 'Idempotency-Key was already used for a different maintenance request');
        return { row: existing, replayed: true };
      }
    }
    const p = (await c.query('SELECT source_agent_id FROM properties WHERE id = $1', [b.property_id])).rows[0];
    if (!p) throw new HttpError(404, 'Property not found');
    if (b.unit_id && !(await c.query('SELECT 1 FROM property_units WHERE id = $1 AND property_id = $2', [b.unit_id, b.property_id])).rowCount) throw new HttpError(422, 'That unit does not belong to this property');
    const r = await c.query(
      `INSERT INTO maintenance_requests
         (property_id,unit_id,description,category,priority,source_agent_id,idempotency_user_id,idempotency_key,idempotency_payload_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (idempotency_user_id,idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
       RETURNING *`,
      [b.property_id, b.unit_id ?? null, b.description, b.category, priority, p.source_agent_id,
        b.idempotency_key ? req.user!.id : null, b.idempotency_key ?? null, payloadHash],
    );
    if (!r.rowCount && b.idempotency_key) {
      const existing = (await c.query(
        'SELECT * FROM maintenance_requests WHERE idempotency_user_id=$1 AND idempotency_key=$2',
        [req.user!.id, b.idempotency_key],
      )).rows[0];
      if (!existing || existing.idempotency_payload_hash !== payloadHash) throw new HttpError(409, 'Maintenance request could not be replayed safely; retry with a new Idempotency-Key');
      return { row: existing, replayed: true };
    }
    await c.query("INSERT INTO maintenance_request_events (maintenance_request_id,actor_id,event_type,to_status,note) VALUES ($1,$2,'opened','open',$3)", [r.rows[0].id, req.user!.id, b.description]);
    await audit(c, req.user!.id, 'maintenance_opened', 'maintenance', r.rows[0].id, null, { priority, category: b.category });
    return { row: r.rows[0], replayed: false };
  });
  res.status(result.replayed ? 200 : 201).json({ ...result.row, replayed: result.replayed });
}));

ops.get('/maintenance', requireActivity('property.maintenance.manage'), h(async (req, res) => {
  const offset = z.coerce.number().int().min(0).max(100000).parse(req.query.offset ?? 0);
  res.json(await withUser(req.user!, async (c) => (await c.query(
    `SELECT m.id,m.property_id,m.unit_id,m.description,m.priority,m.status,m.assigned_to,
       m.assigned_vendor_id,m.category,m.resolution_note,m.completed_at,m.updated_at,m.created_at,
       m.sla_due_at,m.review_note,m.completion_submitted_by,m.completion_submitted_at,
       m.reviewed_by,m.reviewed_at,
       CASE WHEN app_role()='field_agent' THEN NULL ELSE m.cost END AS cost,
       COALESCE(p.address,field_context.property_address) AS address,
       COALESCE(u.unit_no,field_context.unit_no) AS unit_no,vendor.name AS vendor_name,
       extract(epoch FROM (COALESCE(m.completed_at,now())-m.created_at))/3600 AS age_hours,
       latest.event_type AS latest_event_type, latest.note AS latest_event_note,
       latest.created_at AS latest_event_at,
       (SELECT count(*)::int FROM maintenance_evidence e
        WHERE e.maintenance_request_id=m.id AND e.scan_status='clean') AS evidence_count
     FROM maintenance_requests m LEFT JOIN properties p ON p.id = m.property_id
     LEFT JOIN property_units u ON u.id=m.unit_id
     LEFT JOIN LATERAL app_property_agent_task_context(m.id) field_context ON true
     LEFT JOIN property_vendors vendor ON vendor.id=m.assigned_vendor_id
     LEFT JOIN LATERAL (
       SELECT e.event_type,e.note,e.created_at FROM maintenance_request_events e
       WHERE e.maintenance_request_id=m.id ORDER BY e.created_at DESC,e.id DESC LIMIT 1
     ) latest ON true
     ORDER BY (m.status IN ('completed','done','cancelled')), m.sla_due_at NULLS LAST,
       m.priority = 'urgent' DESC, m.created_at DESC, m.id DESC LIMIT 201 OFFSET $1`, [offset])).rows));
}));

ops.get('/maintenance/metrics', requireActivity('property.maintenance.manage'), h(async (req, res) => {
  res.json(await withUser(req.user!, async (c) => (await c.query(
    `SELECT count(*) FILTER (WHERE status IN ('open','triaged','assigned','in_progress','awaiting_review','rework_required'))::int AS open_count,
       count(*) FILTER (WHERE status='open' AND priority='urgent')::int AS urgent_open_count,
       count(*) FILTER (WHERE status IN ('completed','done') AND completed_at >= now()-interval '30 days')::int AS completed_last_30_days,
       count(*) FILTER (WHERE status NOT IN ('completed','done','cancelled') AND sla_due_at < now())::int AS overdue_count,
       round(avg(extract(epoch FROM (completed_at-created_at))/3600) FILTER (WHERE status IN ('completed','done') AND completed_at >= now()-interval '30 days'),1) AS avg_resolution_hours_30d
     FROM maintenance_requests`)).rows[0]));
}));

ops.get('/maintenance/sla/overdue', requireRole('corporate_business_manager','super_admin','global_admin'), h(async (req, res) => {
  res.json(await withUser(req.user!, async (c) => (await c.query(
    `SELECT m.id,m.property_id,p.address,u.unit_no,m.category,m.priority,m.status,
       m.sla_due_at,extract(epoch FROM (now()-m.sla_due_at))/3600 AS overdue_hours,
       m.assigned_to,vendor.name AS vendor_name
     FROM maintenance_requests m
     JOIN properties p ON p.id=m.property_id
     LEFT JOIN property_units u ON u.id=m.unit_id
     LEFT JOIN property_vendors vendor ON vendor.id=m.assigned_vendor_id
     WHERE m.sla_due_at < now() AND m.status NOT IN ('completed','done','cancelled')
     ORDER BY m.sla_due_at,m.id LIMIT 200`,
  )).rows));
}));

ops.get('/maintenance/:id/events', requireActivity('property.maintenance.manage'), h(async (req, res) => {
  res.json(await withUser(req.user!, async (c) => (await c.query(
    `SELECT e.id,e.event_type,e.from_status,e.to_status,e.note,e.created_at,u.legal_name AS actor_name
     FROM maintenance_request_events e LEFT JOIN users u ON u.id=e.actor_id
     WHERE e.maintenance_request_id=$1 ORDER BY e.created_at,e.id`, [req.params.id])).rows));
}));

ops.post('/maintenance/:id/update', requireActivity('property.maintenance.manage'), requireRole(...AGENT, 'corporate_business_manager', 'super_admin', 'global_admin'), h(async (req, res) => {
  const b = z.object({
    status: z.enum(['triaged', 'assigned', 'in_progress', 'awaiting_review', 'completed', 'rework_required', 'cancelled']),
    assigned_to: z.string().uuid().optional(),
    assigned_vendor_id: z.string().uuid().optional(),
    sla_hours: z.number().int().min(1).max(720).optional(),
    cost: z.number().nonnegative().finite().optional(),
    resolution_note: z.string().trim().min(5).max(1000).optional(),
    review_note: z.string().trim().min(5).max(1000).optional(),
  }).strict().superRefine((body, context) => {
    if (body.status === 'triaged' && body.sla_hours === undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['sla_hours'], message: 'Set an SLA deadline from 1 to 720 hours' });
    }
    if (body.status === 'assigned' && !body.assigned_to && !body.assigned_vendor_id) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['assigned_to'], message: 'Assign an internal technician or external vendor' });
    }
    if (body.status === 'triaged' && !body.resolution_note) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['resolution_note'], message: 'Add triage notes before routing this request' });
    }
    if (body.assigned_to && body.assigned_vendor_id) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['assigned_vendor_id'], message: 'Choose either an internal technician or an external vendor, not both' });
    }
    if (body.status === 'awaiting_review' && !body.resolution_note) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['resolution_note'], message: 'Describe completed work before requesting review' });
    }
    if (requiresMaintenanceReview(body.status) && !body.review_note) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['review_note'], message: 'Provide the independent review decision and rationale' });
    }
    if (body.status === 'cancelled' && !body.review_note) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['review_note'], message: 'Provide a cancellation reason' });
    }
  }).parse(req.body);
  const reviewRoles = ['corporate_business_manager', 'super_admin', 'global_admin'];
  if (req.user!.role === 'field_agent'
    && (!['in_progress','awaiting_review'].includes(b.status)
      || b.assigned_to !== undefined || b.assigned_vendor_id !== undefined
      || b.sla_hours !== undefined || b.cost !== undefined || b.review_note !== undefined)) {
    throw new HttpError(403, 'Field agents may only update their assigned work status and completion notes');
  }
  if (requiresMaintenanceReview(b.status) && !reviewRoles.includes(req.user!.role)) {
    throw new HttpError(403, 'Only a maintenance reviewer can approve completion or return work for rework');
  }
  res.json(await withUser(req.user!, async (c) => {
    const m = (await c.query('SELECT * FROM maintenance_requests WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!m) throw new HttpError(404, 'Request not found');
    if (req.user!.role === 'field_agent' && m.assigned_to_user_id !== req.user!.id) {
      throw new HttpError(404, 'Assigned maintenance request not found');
    }
    if (b.assigned_to) {
      const assignee = (await c.query(
        `SELECT 1 FROM users user_row
         JOIN property_operating_tenant_members member
           ON member.user_id=user_row.id AND member.tenant_system_id=$2 AND member.status='active'
          AND member.tenant_role IN ('master_agent','field_agent')
         WHERE user_row.id=$1 AND user_row.active=true
           AND app_property_tenant_role_matches(member.tenant_role,user_row.role)`,
        [b.assigned_to,m.tenant_system_id],
      )).rowCount;
      if (!assignee) throw new HttpError(422, 'Choose an active agent who is a member of this property tenant');
      const propertyScope = (await c.query(
        `SELECT 1 FROM property_agent_scopes
         WHERE tenant_system_id=$1 AND property_id=$2 AND user_id=$3 AND status='active'
           AND effective_from<=current_date AND (effective_to IS NULL OR effective_to>=current_date)`,
        [m.tenant_system_id,m.property_id,b.assigned_to],
      )).rowCount;
      if (!propertyScope) throw new HttpError(422, 'Assign this agent to the property before routing maintenance work');
    }
    if (b.assigned_vendor_id) {
      if (!['corporate_business_manager','super_admin','global_admin'].includes(req.user!.role)) {
        throw new HttpError(403, 'Only a maintenance supervisor can assign an external vendor');
      }
      const vendor = (await c.query(
        'SELECT id FROM property_vendors WHERE id=$1 AND active=true',
        [b.assigned_vendor_id],
      )).rows[0];
      if (!vendor) throw new HttpError(422, 'Choose an active property vendor');
    }
    if (!canTransitionMaintenance(m.status, b.status)) throw new HttpError(409, `A ${m.status.replace('_', ' ')} request cannot move to ${b.status.replace('_', ' ')}`);
    if (requiresMaintenanceReview(b.status) && (!m.completion_submitted_by || m.completion_submitted_by === req.user!.id)) {
      throw new HttpError(409, 'Completion review must be performed by someone other than the person who submitted the work');
    }
    if (b.status === 'in_progress' && m.assigned_vendor_id) {
      throw new HttpError(409, 'Assigned vendors must accept the work in their portal before it can start');
    }
    const r = await c.query(`UPDATE maintenance_requests SET status=$2,
      assigned_to=CASE WHEN $8 IS NOT NULL THEN NULL WHEN $3 IS NOT NULL THEN $3 ELSE assigned_to END,
      assigned_to_user_id=CASE WHEN $8 IS NOT NULL THEN NULL WHEN $3 IS NOT NULL THEN $3::uuid ELSE assigned_to_user_id END,
      assigned_vendor_id=CASE WHEN $3 IS NOT NULL THEN NULL WHEN $8 IS NOT NULL THEN $8 ELSE assigned_vendor_id END,
      sla_due_at=CASE WHEN $2='triaged' THEN now()+make_interval(hours=>$9) ELSE sla_due_at END,
      cost=COALESCE($4,cost), resolution_note=COALESCE($5,resolution_note),
      review_note=CASE WHEN $2='awaiting_review' THEN NULL ELSE COALESCE($6,review_note) END,
      completion_submitted_by=CASE WHEN $2='awaiting_review' THEN $7 ELSE completion_submitted_by END,
      completion_submitted_at=CASE WHEN $2='awaiting_review' THEN now() ELSE completion_submitted_at END,
      reviewed_by=CASE WHEN $2='awaiting_review' THEN NULL WHEN $2 IN ('completed','rework_required') THEN $7 ELSE reviewed_by END,
      reviewed_at=CASE WHEN $2='awaiting_review' THEN NULL WHEN $2 IN ('completed','rework_required') THEN now() ELSE reviewed_at END,
      completed_at=CASE WHEN $2='completed' THEN now() ELSE completed_at END, updated_at=now()
      WHERE id=$1 RETURNING *`, [m.id, b.status, b.assigned_to ?? null, b.cost ?? null,
      b.resolution_note ?? null, b.review_note ?? null, req.user!.id,
      b.assigned_vendor_id ?? null, b.sla_hours ?? null]);
    const eventNote = b.review_note ?? b.resolution_note ?? b.assigned_to ?? b.assigned_vendor_id ?? null;
    await c.query('INSERT INTO maintenance_request_events (maintenance_request_id,actor_id,event_type,from_status,to_status,note) VALUES ($1,$2,$3,$4,$5,$6)', [m.id, req.user!.id, b.status, m.status, b.status, eventNote]);
    await audit(c, req.user!.id, 'maintenance_' + b.status, 'maintenance', m.id, { status: m.status }, { status: b.status, cost: b.cost ?? null });
    return r.rows[0];
  }));
}));

// ================= Notifications (each person sees only their own) =================
ops.get('/notifications', h(async (req, res) => {
  res.json((await pool.query("SELECT id, template, payload, status, created_at FROM notifications WHERE user_id = $1 AND channel = 'inapp' ORDER BY id DESC LIMIT 50", [req.user!.id])).rows);
}));

ops.post('/notifications/read', h(async (req, res) => {
  await pool.query("UPDATE notifications SET status = 'read' WHERE user_id = $1 AND channel = 'inapp' AND status = 'sent'", [req.user!.id]);
  res.json({ ok: true });
}));

ops.get('/notifications/delivery-status', requireRole('global_admin'), h(async (_req, res) => {
  res.json(await withUser(_req.user!, async (c) => (await c.query(
    `SELECT id,template,status,attempt_count,total_attempt_count,retry_generation,
        next_attempt_at,claimed_at,last_error,created_at,sent_at
     FROM notifications WHERE channel='webhook'
     ORDER BY created_at DESC,id DESC LIMIT 200`,
  )).rows));
}));

ops.post('/notifications/:id/retry', requireRole('global_admin'), h(async (req, res) => {
  const id = z.string().regex(/^[1-9]\d{0,18}$/).parse(req.params.id);
  const { reason } = z.object({
    reason: z.string().trim().min(10).max(1000),
  }).strict().parse(req.body);
  const result = await withUser(req.user!, async (c) => {
    const event = (await c.query(
      `UPDATE notifications
       SET status='pending',attempt_count=0,retry_generation=retry_generation+1,
           next_attempt_at=now(),claimed_at=NULL
       WHERE id=$1 AND channel='webhook' AND status='dead'
       RETURNING id,total_attempt_count,retry_generation,last_error`,
      [id],
    )).rows[0];
    if (!event) throw new HttpError(409, 'Only a dead-lettered webhook notification can be manually retried.');
    await audit(c, req.user!.id, 'notification_delivery_requeued', 'notification', event.id,
      { status: 'dead', total_attempt_count: event.total_attempt_count, last_error: event.last_error },
      { status: 'pending', retry_generation: event.retry_generation, reason });
    return event;
  });
  res.json(result);
}));
