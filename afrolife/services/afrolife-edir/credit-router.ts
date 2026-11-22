import { createHash, randomUUID } from 'node:crypto';
import express, { Router, type Request, type Response, type RequestHandler } from 'express';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import type { AuthUser } from '../../src/auth-types.js';
import { HttpError } from '../../src/http-error.js';
import { toCsv } from '../../src/csv.js';
import { sniff } from '../../src/files.js';
import { getFile, putFile } from '../../src/storage.js';
import { assertCleanUpload } from '../../src/clamav.js';
import { withUser } from './db.js';
import { assessEdirLoan, edirCreditPolicySchema } from './credit.js';
import { formatEdirMoney, parseEdirMoney } from './money.js';
import { cooldownRemainingDays, evaluateLoanEligibility, lendingProductTermsSchema } from '../../src/lending-products.js';

const creditMakerRoles = ['edir_admin', 'credit_manager'];
const creditReaderRoles = [...creditMakerRoles, 'credit_officer', 'finance_manager', 'treasurer', 'compliance', 'auditor'];
const servicingMakerRoles = ['edir_admin', 'credit_manager', 'finance_manager', 'treasurer'];
const platformAdmin = (user: AuthUser) => user.role === 'global_admin' || user.role === 'super_admin';
const h = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { fn(req, res).catch(next); };

async function hasStaffRole(user: AuthUser, roles: string[], client?: PoolClient) {
  if (platformAdmin(user)) return true;
  const check = async (db: PoolClient) => Boolean((await db.query(
    `SELECT 1 FROM edir_staff
     WHERE user_id=$1 AND active AND role=ANY($2::text[])`,
    [user.id, roles],
  )).rowCount);
  return client ? check(client) : withUser(user, check);
}

function requireStaffRole(roles: string[], message: string): RequestHandler {
  return (req, _res, next) => hasStaffRole(req.user!, roles).then(
    (allowed) => next(allowed ? undefined : new HttpError(403, message)),
    next,
  );
}

function requirePlatformAdmin(message: string): RequestHandler {
  return (req, _res, next) => next(platformAdmin(req.user!) ? undefined : new HttpError(403, message));
}

async function audit(client: PoolClient, actorId: string, action: string, entityId: string, detail: unknown) {
  await client.query(
    `INSERT INTO edir_audit_logs (actor_id, action, entity, entity_id, new_value)
     VALUES ($1,$2,$3,$4,$5)`,
    [actorId, action, 'edir_credit_workflow', entityId, JSON.stringify(detail)],
  );
}

const money = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/);
const positiveMoney = money.refine((amount) => parseEdirMoney(amount) > 0n);
const reason = z.string().trim().min(10).max(1000);

export const edirCreditRouter = Router();

edirCreditRouter.get('/complaints', h(async (req,res)=>{
  const rows=await withUser(req.user!,async(client)=>(await client.query(
    `SELECT complaint.id,complaint.member_id,membership.member_number,membership.full_name,
            complaint.reference,complaint.category,complaint.subject,complaint.description,complaint.status,
            complaint.priority,complaint.resolution_due_at,
            complaint.assigned_to,complaint.resolution,complaint.resolved_by,complaint.resolved_at,
            complaint.created_at,complaint.updated_at
     FROM edir_customer_complaints complaint
     JOIN edir_memberships membership ON membership.id=complaint.member_id
     ORDER BY complaint.created_at DESC LIMIT 200`,
  )).rows);
  res.json(rows);
}));

edirCreditRouter.get('/disbursement-limits',requireStaffRole(creditReaderRoles,'Edir finance control access is required'),h(async(req,res)=>{
  const rows=await withUser(req.user!,async(client)=>(await client.query(
    `SELECT id,version,daily_limit::text,status,change_reason,created_by,reviewed_by,reviewed_at,review_reason,created_at
     FROM edir_disbursement_limit_versions ORDER BY version DESC LIMIT 100`,
  )).rows);
  res.json(rows);
}));

edirCreditRouter.post('/disbursement-limits',requireStaffRole(creditMakerRoles,'Edir finance control setup access is required'),h(async(req,res)=>{
  const body=z.object({daily_limit:z.union([positiveMoney,z.null()]),change_reason:reason}).strict().parse(req.body);
  const row=await withUser(req.user!,async(client)=>{
    const organizationId=req.user!.edir_id??'00000000-0000-4000-8000-000000000002';
    await client.query('SELECT pg_advisory_xact_lock(779818,hashtext($1))',[organizationId]);
    if((await client.query("SELECT 1 FROM edir_disbursement_limit_versions WHERE status='pending'")).rowCount)
      throw new HttpError(409,'Review the pending daily disbursement limit proposal first');
    const version=Number((await client.query('SELECT coalesce(max(version),0)+1 AS version FROM edir_disbursement_limit_versions')).rows[0].version);
    const created=(await client.query(`INSERT INTO edir_disbursement_limit_versions(organization_id,version,daily_limit,change_reason,created_by)
      VALUES($1,$2,$3,$4,$5) RETURNING id,version,daily_limit::text,status,created_by,created_at`,
      [organizationId,version,body.daily_limit,body.change_reason,req.user!.id])).rows[0];
    await audit(client,req.user!.id,'edir_disbursement_limit_submitted',created.id,{version,daily_limit:body.daily_limit,change_reason:body.change_reason});
    return created;
  });
  res.status(201).json(row);
}));

edirCreditRouter.post('/disbursement-limits/:versionId/decision',requireStaffRole(creditMakerRoles,'Edir finance control review access is required'),h(async(req,res)=>{
  const id=z.string().uuid().parse(req.params.versionId);
  const body=z.object({decision:z.enum(['approve','reject']),reason}).strict().parse(req.body);
  const row=await withUser(req.user!,async(client)=>{
    const pending=(await client.query("SELECT * FROM edir_disbursement_limit_versions WHERE id=$1 AND status='pending' FOR UPDATE",[id])).rows[0];
    if(!pending)throw new HttpError(404,'Pending Edir daily disbursement limit proposal not found');
    if(pending.created_by===req.user!.id)throw new HttpError(403,'The limit author cannot approve their own proposal');
    if(body.decision==='approve')await client.query("UPDATE edir_disbursement_limit_versions SET status='superseded' WHERE organization_id=$1 AND status='active'",[pending.organization_id]);
    const updated=(await client.query(`UPDATE edir_disbursement_limit_versions SET status=$2,reviewed_by=$3,reviewed_at=now(),review_reason=$4
      WHERE id=$1 RETURNING id,version,daily_limit::text,status,reviewed_by,reviewed_at,review_reason`,
      [id,body.decision==='approve'?'active':'rejected',req.user!.id,body.reason])).rows[0];
    await audit(client,req.user!.id,`edir_disbursement_limit_${body.decision}d`,id,{version:pending.version,status:updated.status,reason:body.reason});
    return updated;
  });
  res.json(row);
}));

edirCreditRouter.get('/platform-disbursement-limits',requirePlatformAdmin('Platform disbursement limit administration access is required'),h(async(req,res)=>{
  const rows=await withUser(req.user!,async(client)=>(await client.query(
    `SELECT id,version,daily_limit::text,status,change_reason,created_by,reviewed_by,reviewed_at,review_reason,created_at
     FROM edir_platform_disbursement_limit_versions ORDER BY version DESC LIMIT 100`,
  )).rows);
  res.json(rows);
}));

edirCreditRouter.post('/platform-disbursement-limits',requirePlatformAdmin('Platform disbursement limit administration access is required'),h(async(req,res)=>{
  const body=z.object({daily_limit:z.union([positiveMoney,z.null()]),change_reason:reason}).strict().parse(req.body);
  const row=await withUser(req.user!,async(client)=>{
    await client.query('SELECT pg_advisory_xact_lock(779819,1)');
    if((await client.query("SELECT 1 FROM edir_platform_disbursement_limit_versions WHERE status='pending'")).rowCount)
      throw new HttpError(409,'Review the pending platform disbursement limit proposal first');
    const version=Number((await client.query('SELECT coalesce(max(version),0)+1 AS version FROM edir_platform_disbursement_limit_versions')).rows[0].version);
    const created=(await client.query(`INSERT INTO edir_platform_disbursement_limit_versions(version,daily_limit,change_reason,created_by)
      VALUES($1,$2,$3,$4) RETURNING id,version,daily_limit::text,status,change_reason,created_by,created_at`,
      [version,body.daily_limit,body.change_reason,req.user!.id])).rows[0];
    await audit(client,req.user!.id,'edir_platform_disbursement_limit_submitted',created.id,{version,daily_limit:body.daily_limit,change_reason:body.change_reason});
    return created;
  });
  res.status(201).json(row);
}));

edirCreditRouter.post('/platform-disbursement-limits/:versionId/decision',requirePlatformAdmin('Platform disbursement limit administration access is required'),h(async(req,res)=>{
  const id=z.string().uuid().parse(req.params.versionId);
  const body=z.object({decision:z.enum(['approve','reject']),reason}).strict().parse(req.body);
  const row=await withUser(req.user!,async(client)=>{
    await client.query('SELECT pg_advisory_xact_lock(779819,1)');
    const pending=(await client.query("SELECT * FROM edir_platform_disbursement_limit_versions WHERE id=$1 AND status='pending' FOR UPDATE",[id])).rows[0];
    if(!pending)throw new HttpError(404,'Pending platform disbursement limit proposal not found');
    if(pending.created_by===req.user!.id)throw new HttpError(403,'The platform limit author cannot approve their own proposal');
    if(body.decision==='approve')await client.query("UPDATE edir_platform_disbursement_limit_versions SET status='superseded' WHERE status='active'");
    const updated=(await client.query(`UPDATE edir_platform_disbursement_limit_versions SET status=$2,reviewed_by=$3,reviewed_at=now(),review_reason=$4
      WHERE id=$1 RETURNING id,version,daily_limit::text,status,reviewed_by,reviewed_at,review_reason`,
      [id,body.decision==='approve'?'active':'rejected',req.user!.id,body.reason])).rows[0];
    await audit(client,req.user!.id,`edir_platform_disbursement_limit_${body.decision}d`,id,{version:pending.version,status:updated.status,reason:body.reason});
    return updated;
  });
  res.json(row);
}));

edirCreditRouter.post('/members/:memberId/risk-flags',requireStaffRole(['edir_admin','credit_manager','compliance'],'Edir member risk control access is required'),h(async(req,res)=>{
  const memberId=z.string().uuid().parse(req.params.memberId);
  const body=z.object({category:z.enum(['identity_mismatch','suspicious_activity','fraud','aml_hold','delinquency_restriction']),reason:z.string().trim().min(10).max(2000)}).strict().parse(req.body);
  const flag=await withUser(req.user!,async(client)=>{
    const lock=(await client.query('SELECT edir_lock_member_credit_controls($1) AS locked',[memberId])).rows[0].locked;
    if(!lock)throw new HttpError(404,'Edir member not found');
    const row=(await client.query(`INSERT INTO edir_member_risk_flags(member_id,category,reason,created_by)
      VALUES($1,$2,$3,$4) RETURNING id,member_id,category,reason,status,created_at`,
      [memberId,body.category,body.reason,req.user!.id])).rows[0];
    await audit(client,req.user!.id,'edir_member_risk_flag_submitted',row.id,{category:body.category,reason:body.reason});
    return row;
  });
  res.status(201).json(flag);
}));

edirCreditRouter.post('/risk-flags/:flagId/decision',requireStaffRole(['edir_admin','credit_manager','compliance'],'Edir member risk review access is required'),h(async(req,res)=>{
  const id=z.string().uuid().parse(req.params.flagId);
  const body=z.object({decision:z.enum(['activate','reject','release']),reason:z.string().trim().min(10).max(2000)}).strict().parse(req.body);
  const flag=await withUser(req.user!,async(client)=>{
    const current=(await client.query('SELECT * FROM edir_member_risk_flags WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if(!current)throw new HttpError(404,'Member risk flag not found');
    await client.query('SELECT edir_lock_member_credit_controls($1)',[current.member_id]);
    if(current.created_by===req.user!.id)throw new HttpError(403,'The flag author cannot review or release their own risk flag');
    let row;
    if(body.decision==='release'){
      if(current.status!=='active')throw new HttpError(409,'Only an active risk hold can be released');
      row=(await client.query(`UPDATE edir_member_risk_flags SET status='released',released_by=$2,released_at=now(),release_reason=$3
        WHERE id=$1 RETURNING id,member_id,category,status,released_by,released_at,release_reason`,[id,req.user!.id,body.reason])).rows[0];
    } else {
      if(current.status!=='pending_review')throw new HttpError(409,'Only a pending risk flag can be reviewed');
      row=(await client.query(`UPDATE edir_member_risk_flags SET status=$2,reviewed_by=$3,reviewed_at=now(),review_reason=$4
        WHERE id=$1 RETURNING id,member_id,category,status,reviewed_by,reviewed_at,review_reason`,
        [id,body.decision==='activate'?'active':'rejected',req.user!.id,body.reason])).rows[0];
    }
    await audit(client,req.user!.id,`edir_member_risk_flag_${body.decision}d`,id,{prior_status:current.status,status:row.status,reason:body.reason});
    return row;
  });
  res.json(flag);
}));

edirCreditRouter.post('/complaints', h(async(req,res)=>{
  const body=z.object({category:z.enum(['service','loan_decision','repayment','fees','privacy','fraud','other']),
    subject:z.string().trim().min(5).max(160),description:z.string().trim().min(10).max(5000)}).strict().parse(req.body);
  const complaint=await withUser(req.user!,async(client)=>{
    const member=(await client.query(`SELECT id FROM edir_memberships WHERE user_id=$1 AND status='active'`,[req.user!.id])).rows[0];
    if(!member)throw new HttpError(403,'An active Edir membership is required to file a complaint');
    const reference=`EDR-${randomUUID().replaceAll('-','').slice(0,12).toUpperCase()}`;
    const row=(await client.query(
      `INSERT INTO edir_customer_complaints(member_id,reference,category,subject,description,created_by)
       VALUES($1,$2,$3,$4,$5,$6)
       RETURNING id,member_id,reference,category,subject,status,priority,resolution_due_at,created_at`,
      [member.id,reference,body.category,body.subject,body.description,req.user!.id],
    )).rows[0];
    await audit(client,req.user!.id,'edir_complaint_opened',row.id,{reference,category:body.category});
    return row;
  });
  res.status(201).json(complaint);
}));

edirCreditRouter.post('/complaints/:complaintId/decision',requireStaffRole(['edir_admin','member_support','compliance'],'Edir complaint management access is required'),h(async(req,res)=>{
  const id=z.string().uuid().parse(req.params.complaintId);
  const body=z.object({status:z.enum(['investigating','awaiting_customer','resolved','rejected']),priority:z.enum(['low','normal','high','urgent']).optional(),
    assigned_to:z.string().uuid().nullable().optional(),resolution:z.string().trim().min(10).max(5000).optional()}).strict().parse(req.body);
  const row=await withUser(req.user!,async(client)=>{
    const current=(await client.query('SELECT * FROM edir_customer_complaints WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if(!current)throw new HttpError(404,'Complaint not found');
    if(['resolved','rejected'].includes(current.status))throw new HttpError(409,'Closed complaints cannot be changed');
    if(['resolved','rejected'].includes(body.status)&&!body.resolution)throw new HttpError(422,'A resolution summary is required to close a complaint');
    if(body.assigned_to){
      const assignee=(await client.query(
        `SELECT 1 FROM edir_staff WHERE user_id=$1 AND organization_id=$2 AND active
         AND role IN ('edir_admin','member_support','compliance')`,
        [body.assigned_to,current.organization_id],
      )).rowCount;
      if(!assignee)throw new HttpError(422,'Assign the complaint to an active Edir administrator, member-support officer, or Compliance officer');
    }
    const updated=(await client.query(
      `UPDATE edir_customer_complaints SET status=$2,priority=coalesce($3,priority),
        assigned_to=CASE WHEN $4::boolean THEN $5::uuid ELSE assigned_to END,
        resolution=CASE WHEN $2 IN ('resolved','rejected') THEN $6 ELSE resolution END,
        resolved_by=CASE WHEN $2 IN ('resolved','rejected') THEN $7::uuid ELSE null END,
        resolved_at=CASE WHEN $2 IN ('resolved','rejected') THEN now() ELSE null END,updated_at=now()
       WHERE id=$1 RETURNING id,reference,status,priority,assigned_to,resolution,resolved_by,resolved_at,updated_at`,
      [id,body.status,body.priority??null,body.assigned_to!==undefined,body.assigned_to??null,body.resolution??null,req.user!.id],
    )).rows[0];
    await audit(client,req.user!.id,'edir_complaint_updated',id,{prior_status:current.status,status:updated.status,reason:body.resolution??null});
    return updated;
  });
  res.json(row);
}));

edirCreditRouter.get('/me', h(async (req, res) => {
  const data = await withUser(req.user!, async (client) => {
    const member = (await client.query(
      `SELECT id,status,activated_at,kyc_status,kyc_reviewed_by FROM edir_memberships WHERE user_id=$1`, [req.user!.id],
    )).rows[0] ?? null;
    if (!member) return { membership: null, applications: [] };
    const applications = (await client.query(
      `SELECT id,requested_principal::text,requested_term_months,purpose,status,credit_score,
              score_factors,decision_reason,accepted_at,product_version_id,product_terms,eligibility_context,created_at
       FROM edir_loan_applications WHERE member_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [member.id],
    )).rows;
    return { membership: member, applications };
  });
  res.json(data);
}));

edirCreditRouter.get('/policies', h(async (req, res) => {
  const policies = await withUser(req.user!, async (client) => (await client.query(
    `SELECT id,version,status,policy,change_reason,created_by,approved_by,approved_at,review_reason,created_at
     FROM edir_credit_policy_versions ORDER BY version DESC LIMIT 100`,
  )).rows);
  res.json(policies);
}));

edirCreditRouter.get('/products', h(async (req, res) => {
  const products = await withUser(req.user!, async (client) => (await client.query(
    `SELECT id,organization_id,product_code,version,status,terms,change_reason,
            created_by,reviewed_by,reviewed_at,review_reason,created_at
     FROM edir_loan_product_versions ORDER BY product_code,version DESC LIMIT 300`,
  )).rows);
  res.json(products);
}));

edirCreditRouter.post('/products', requireStaffRole(creditMakerRoles, 'Edir loan product setup access is required'), h(async (req, res) => {
  const body = z.object({ terms: lendingProductTermsSchema, change_reason: reason }).strict().parse(req.body);
  if (body.terms.annual_interest_rate_bps !== 0 || body.terms.origination_fee_bps !== 0 || body.terms.late_penalty_bps !== 0
      || body.terms.interest_method !== 'none') {
    throw new HttpError(422, 'Edir servicing currently supports principal-only terms; interest and fee collection must not be activated until its servicing ledger supports them');
  }
  const product = await withUser(req.user!, async (client) => {
    const organizationId = req.user!.edir_id ?? '00000000-0000-4000-8000-000000000002';
    await client.query('SELECT pg_advisory_xact_lock(779817, hashtext($1))', [organizationId + body.terms.product_code]);
    const existing = (await client.query(
      `SELECT id,status FROM edir_loan_product_versions
       WHERE organization_id=$1 AND product_code=$2 ORDER BY version DESC LIMIT 1 FOR UPDATE`,
      [organizationId, body.terms.product_code],
    )).rows[0];
    if (existing?.status === 'pending') throw new HttpError(409, 'Review or reject the pending product version first');
    const version = Number((await client.query(
      `SELECT coalesce(max(version),0)+1 AS version FROM edir_loan_product_versions
       WHERE organization_id=$1 AND product_code=$2`, [organizationId, body.terms.product_code],
    )).rows[0].version);
    const created = (await client.query(
      `INSERT INTO edir_loan_product_versions(organization_id,product_code,version,terms,change_reason,created_by)
       VALUES($1,$2,$3,$4,$5,$6)
       RETURNING id,organization_id,product_code,version,status,terms,change_reason,created_by,created_at`,
      [organizationId, body.terms.product_code, version, JSON.stringify(body.terms), body.change_reason, req.user!.id],
    )).rows[0];
    await audit(client, req.user!.id, 'edir_loan_product_submitted', created.id, { product_code: created.product_code, version, terms: body.terms });
    return created;
  });
  res.status(201).json(product);
}));

edirCreditRouter.post('/products/:versionId/decision', requireStaffRole(creditMakerRoles, 'Edir loan product review access is required'), h(async (req, res) => {
  const versionId = z.string().uuid().parse(req.params.versionId);
  const body = z.object({ decision: z.enum(['approve','reject']), reason }).strict().parse(req.body);
  const product = await withUser(req.user!, async (client) => {
    const pending = (await client.query(
      `SELECT * FROM edir_loan_product_versions WHERE id=$1 AND status='pending' FOR UPDATE`, [versionId],
    )).rows[0];
    if (!pending) throw new HttpError(404, 'Pending Edir loan product version was not found');
    if (pending.created_by === req.user!.id) throw new HttpError(403, 'The product author cannot review their own version');
    let updated;
    if (body.decision === 'approve') {
      lendingProductTermsSchema.parse(pending.terms);
      await client.query(`UPDATE edir_loan_product_versions SET status='superseded' WHERE organization_id=$1 AND product_code=$2 AND status='active'`, [pending.organization_id, pending.product_code]);
      updated = (await client.query(
        `UPDATE edir_loan_product_versions SET status='active',reviewed_by=$2,reviewed_at=now(),review_reason=$3
         WHERE id=$1 RETURNING id,organization_id,product_code,version,status,terms,reviewed_by,reviewed_at,review_reason`,
        [versionId, req.user!.id, body.reason],
      )).rows[0];
    } else updated = (await client.query(
      `UPDATE edir_loan_product_versions SET status='rejected',reviewed_by=$2,reviewed_at=now(),review_reason=$3
       WHERE id=$1 RETURNING id,organization_id,product_code,version,status,terms,reviewed_by,reviewed_at,review_reason`,
      [versionId, req.user!.id, body.reason],
    )).rows[0];
    await audit(client, req.user!.id, `edir_loan_product_${body.decision}d`, versionId, { product_code: pending.product_code, version: pending.version, reason: body.reason });
    return updated;
  });
  res.json(product);
}));

edirCreditRouter.post('/policies', requireStaffRole(creditMakerRoles, 'Edir credit policy setup access is required'), h(async (req, res) => {
  const body = z.object({ policy: edirCreditPolicySchema, change_reason: reason }).strict().parse(req.body);
  const result = await withUser(req.user!, async (client) => {
    const organizationId = req.user!.edir_id ?? '00000000-0000-4000-8000-000000000002';
    await client.query('SELECT pg_advisory_xact_lock(779816, hashtext($1))', [organizationId]);
    const pending = await client.query(
      `SELECT id FROM edir_credit_policy_versions WHERE status='pending'`,
    );
    if (pending.rowCount) throw new HttpError(409, 'Review or reject the pending Edir credit policy before submitting another');
    const version = Number((await client.query(
      `SELECT coalesce(max(version),0)+1 AS version FROM edir_credit_policy_versions`,
    )).rows[0].version);
    const policy = (await client.query(
      `INSERT INTO edir_credit_policy_versions (version,policy,change_reason,created_by)
       VALUES ($1,$2,$3,$4)
       RETURNING id,version,status,policy,change_reason,created_by,created_at`,
      [version, JSON.stringify(body.policy), body.change_reason, req.user!.id],
    )).rows[0];
    await audit(client, req.user!.id, 'edir_credit_policy_submitted', policy.id, {
      version, policy, change_reason: body.change_reason,
    });
    return policy;
  });
  res.status(201).json(result);
}));

edirCreditRouter.post('/policies/:policyId/decision', requireStaffRole(creditMakerRoles, 'Edir credit policy review access is required'), h(async (req, res) => {
  const policyId = z.string().uuid().parse(req.params.policyId);
  const body = z.object({ decision: z.enum(['approve', 'reject']), reason }).strict().parse(req.body);
  const policy = await withUser(req.user!, async (client) => {
    const pending = (await client.query(
      `SELECT * FROM edir_credit_policy_versions WHERE id=$1 AND status='pending' FOR UPDATE`, [policyId],
    )).rows[0];
    if (!pending) throw new HttpError(404, 'Pending Edir credit policy was not found');
    if (pending.created_by === req.user!.id) throw new HttpError(403, 'The policy author cannot review their own policy');
    if (body.decision === 'reject') {
      const rejected = (await client.query(
        `UPDATE edir_credit_policy_versions
         SET status='rejected',approved_by=$2,approved_at=now(),review_reason=$3
         WHERE id=$1 RETURNING id,version,status,policy,approved_by,approved_at,review_reason`,
        [policyId, req.user!.id, body.reason],
      )).rows[0];
      await audit(client, req.user!.id, 'edir_credit_policy_rejected', policyId, { version: pending.version, reason: body.reason });
      return rejected;
    }
    const validatedPolicy = edirCreditPolicySchema.parse(pending.policy);
    await client.query(`UPDATE edir_credit_policy_versions SET status='superseded' WHERE status='active'`);
    const active = (await client.query(
      `UPDATE edir_credit_policy_versions
       SET status='active',approved_by=$2,approved_at=now(),review_reason=$3
       WHERE id=$1 RETURNING id,version,status,policy,approved_by,approved_at,review_reason`,
      [policyId, req.user!.id, body.reason],
    )).rows[0];
    await audit(client, req.user!.id, 'edir_credit_policy_activated', policyId, {
      version: pending.version, policy: validatedPolicy, reason: body.reason,
    });
    return active;
  });
  res.json(policy);
}));

edirCreditRouter.get('/applications', requireStaffRole(creditReaderRoles, 'Edir credit application access is required'), h(async (req, res) => {
  const rows = await withUser(req.user!, async (client) => (await client.query(
    `SELECT a.id,a.member_id,m.member_number,m.full_name AS member_name,a.requested_principal::text,
            a.requested_term_months,a.purpose,a.monthly_income::text,a.monthly_expenses::text,a.monthly_debt::text,
            a.status,a.policy_version_id,a.credit_score,a.score_factors,a.scored_by,a.scored_at,
            a.decision_by,a.decision_at,a.decision_reason,a.accepted_at,a.created_by,a.created_at
     FROM edir_loan_applications a
     JOIN edir_memberships m ON m.id=a.member_id
     ORDER BY a.created_at DESC LIMIT 200`,
  )).rows);
  res.json(rows);
}));

edirCreditRouter.post('/applications', h(async (req, res) => {
  const body = z.object({
    requested_principal: positiveMoney,
    requested_term_months: z.number().int().min(1).max(360),
    purpose: z.string().trim().min(3).max(1000),
    monthly_income: positiveMoney,
    monthly_expenses: money,
    monthly_debt: money,
    product_code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,20}$/).optional(),
    customer_category: z.enum(['employee','individual','petty_trader','formal_business','partnership','plc','student','youth_entrepreneur','agriculture','group_member']).default('individual'),
    age: z.number().int().min(18).max(120).optional(),
    business_months: z.number().int().min(0).max(1200).optional(),
    employment_months: z.number().int().min(0).max(1200).optional(),
    equity_amount: money.optional(),
    collateral_value: positiveMoney.optional(),
    documents: z.array(z.string().trim().min(2).max(80)).max(30).default([]),
    supplied_fields: z.array(z.string().trim().min(2).max(80)).max(30).default([]),
    idempotency_key: z.string().uuid(),
  }).strict().parse(req.body);
  const result = await withUser(req.user!, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))', ['edir-credit-application', req.user!.id]);
    const member = (await client.query(
      `SELECT id,status,activated_at,kyc_status FROM edir_memberships WHERE user_id=$1`, [req.user!.id],
    )).rows[0];
    if (!member || member.status !== 'active') throw new HttpError(403, 'An active Edir membership is required to request credit');
    await client.query('SELECT edir_lock_member_credit_controls($1)',[member.id]);
    if(member.kyc_status!=='verified')throw new HttpError(409,'Edir member KYC must be independently verified before applying for credit');
    if ((await client.query('SELECT edir_member_has_active_risk_hold($1) AS held',[member.id])).rows[0].held) {
      throw new HttpError(409,'An active Edir risk hold prevents new credit applications');
    }
    const payloadHash = createHash('sha256').update([
      formatEdirMoney(parseEdirMoney(body.requested_principal)), body.requested_term_months, body.purpose.trim(),
      formatEdirMoney(parseEdirMoney(body.monthly_income)),
      formatEdirMoney(parseEdirMoney(body.monthly_expenses, true)),
      formatEdirMoney(parseEdirMoney(body.monthly_debt, true)), body.product_code ?? '', body.customer_category,
      body.age ?? '', body.business_months ?? '', body.employment_months ?? '',
      body.equity_amount ?? '', body.collateral_value ?? '', [...body.supplied_fields].sort().join(','),
    ].join('\n')).digest('hex');
    const replay = (await client.query(
      `SELECT id,payload_hash,status FROM edir_loan_applications
       WHERE created_by=$1 AND idempotency_key=$2`,
      [req.user!.id, body.idempotency_key],
    )).rows[0];
    if (replay) {
      if (replay.payload_hash !== payloadHash) throw new HttpError(409, 'Idempotency key was used for a different Edir credit application');
      return { application: replay, created: false };
    }
    const activePolicy = (await client.query(
      `SELECT policy FROM edir_credit_policy_versions WHERE status='active'`,
    )).rows[0];
    const openCount = Number((await client.query(
      `SELECT count(*) AS count FROM edir_loan_applications
       WHERE member_id=$1 AND status IN ('awaiting_policy','submitted','scored','approved','accepted')`,
      [member.id],
    )).rows[0].count);
    const maxApplications = activePolicy
      ? edirCreditPolicySchema.parse(activePolicy.policy).maximum_concurrent_applications
      : 1;
    if (openCount >= maxApplications) throw new HttpError(409, 'The Edir credit application limit has been reached');
    const activatedAt = new Date(member.activated_at).getTime();
    const membershipDays = Math.max(0, Math.floor((Date.now() - activatedAt) / 86400000));
    const status = activePolicy ? 'submitted' : 'awaiting_policy';
    const productVersion = body.product_code ? (await client.query(
      `SELECT id,terms FROM edir_loan_product_versions
       WHERE organization_id=$1 AND product_code=$2 AND status='active'`,
      [req.user!.edir_id ?? '00000000-0000-4000-8000-000000000002', body.product_code],
    )).rows[0] : null;
    if (body.product_code && !productVersion) throw new HttpError(409, 'This Edir loan product has no approved version');
    const verifiedDocuments=(await client.query(
      `SELECT DISTINCT document_type FROM edir_loan_documents WHERE member_id=$1 AND status='verified'`,[member.id],
    )).rows.map((row)=>String(row.document_type));
    if (productVersion) {
      const terms = lendingProductTermsSchema.parse(productVersion.terms);
      if (terms.rejection_cooldown_days > 0 || terms.settlement_cooldown_days > 0) {
        const recent = (await client.query(
          `SELECT (SELECT max(application.decision_at) FROM edir_loan_applications application
                    WHERE application.member_id=$1 AND application.status='rejected') AS rejected_at,
                  (SELECT max(journal.posted_at) FROM edir_loans loan
                    JOIN edir_loan_operations operation ON operation.loan_id=loan.id AND operation.organization_id=loan.organization_id
                      AND operation.operation_type='repayment' AND operation.status='approved'
                    JOIN edir_loan_journals journal ON journal.operation_id=operation.id
                      AND journal.organization_id=operation.organization_id AND journal.status='posted'
                    WHERE loan.member_id=$1 AND loan.status='repaid') AS settled_at`, [member.id],
        )).rows[0];
        const rejectedDays = cooldownRemainingDays(recent.rejected_at, terms.rejection_cooldown_days);
        if (rejectedDays > 0) throw new HttpError(409, `Product rejection cooldown is active for ${rejectedDays} more day(s)`);
        const settlementDays = cooldownRemainingDays(recent.settled_at, terms.settlement_cooldown_days);
        if (settlementDays > 0) throw new HttpError(409, `Product settlement cooldown is active for ${settlementDays} more day(s)`);
      }
    }
    const context = { customer_category: body.customer_category, age: body.age ?? null,
      business_months: body.business_months ?? null, employment_months: body.employment_months ?? null,
      equity_amount: body.equity_amount ?? '0', collateral_value: body.collateral_value ?? null,
      documents: verifiedDocuments, supplied_fields: body.supplied_fields,
      membership_days: membershipDays };
    const application = (await client.query(
      `INSERT INTO edir_loan_applications
       (member_id,requested_principal,requested_term_months,purpose,monthly_income,monthly_expenses,monthly_debt,
        status,created_by,idempotency_key,payload_hash,product_version_id,product_terms,eligibility_context)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id,requested_principal::text,requested_term_months,purpose,status,created_at`,
      [member.id, body.requested_principal, body.requested_term_months, body.purpose.trim(),
        body.monthly_income, body.monthly_expenses, body.monthly_debt, status, req.user!.id,
        body.idempotency_key, payloadHash, productVersion?.id ?? null,
        productVersion ? JSON.stringify(productVersion.terms) : null, JSON.stringify(context)],
    )).rows[0];
    await audit(client, req.user!.id, 'edir_loan_application_submitted', application.id, {
      status, requested_principal: body.requested_principal, requested_term_months: body.requested_term_months,
      membership_days_at_submission: membershipDays,
      product_version_id: productVersion?.id ?? null,
    });
    return { application, created: true };
  });
  res.status(result.created ? 201 : 200).json(result.application);
}));

edirCreditRouter.post('/members/:memberId/kyc-review', requireStaffRole(
  ['edir_admin','compliance'],'Edir KYC review access is required',
), h(async(req,res)=>{
  const memberId=z.string().uuid().parse(req.params.memberId);
  const body=z.object({decision:z.enum(['verified','rejected']),reason:z.string().trim().min(10).max(1000)}).strict().parse(req.body);
  const member=await withUser(req.user!,async(client)=>{
    const current=(await client.query(
      `SELECT id,user_id,created_by,kyc_status,kyc_reviewed_by FROM edir_memberships WHERE id=$1 FOR UPDATE`,[memberId],
    )).rows[0];
    if(!current)throw new HttpError(404,'Edir member not found');
    if([current.user_id,current.created_by,current.kyc_reviewed_by].includes(req.user!.id)){
      throw new HttpError(409,'The member, registrar, and previous KYC reviewer cannot review this KYC decision');
    }
    if(current.kyc_status===body.decision)throw new HttpError(409,`Edir member KYC is already ${body.decision}`);
    if(body.decision==='verified' && !(await client.query(
      `SELECT 1 FROM edir_loan_documents WHERE member_id=$1 AND document_type='national_id'
       AND status='verified' AND reviewed_by<>$2 LIMIT 1`,[memberId,req.user!.id],
    )).rowCount)throw new HttpError(409,'A national ID document must be independently verified before Edir member KYC can be verified');
    const updated=(await client.query(
      `UPDATE edir_memberships SET kyc_status=$2,kyc_reviewed_by=$3,kyc_reviewed_at=now(),kyc_review_reason=$4
       WHERE id=$1 RETURNING id,member_number,kyc_status,kyc_reviewed_by,kyc_reviewed_at,kyc_review_reason`,
      [memberId,body.decision,req.user!.id,body.reason],
    )).rows[0];
    await audit(client,req.user!.id,'edir_member_kyc_'+body.decision,memberId,{kyc_status:current.kyc_status,next:body.decision,reason:body.reason});
    return updated;
  });
  res.json(member);
}));

edirCreditRouter.post('/documents/:documentType',express.raw({type:()=>true,limit:'10mb'}),h(async(req,res)=>{
  const documentType=z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_-]{1,79}$/).parse(req.params.documentType);
  const file=req.body as Buffer;
  if(!Buffer.isBuffer(file)||file.length===0)throw new HttpError(400,'Choose a document file to upload');
  const mime=sniff(file);
  if(!mime)throw new HttpError(415,'Only PDF, JPEG, or PNG loan documents are accepted');
  const document=await withUser(req.user!,async(client)=>{
    const member=(await client.query(
      `SELECT id FROM edir_memberships WHERE user_id=$1 AND status='active'`,[req.user!.id],
    )).rows[0];
    if(!member)throw new HttpError(403,'An active Edir membership is required to upload loan documents');
    await assertCleanUpload(file);
    const storageKey=randomUUID();
    const row=(await client.query(
      `INSERT INTO edir_loan_documents(member_id,document_type,storage_key,sha256,mime,size_bytes,uploaded_by)
       VALUES($1,$2,$3,$4,$5,$6,$7)
       RETURNING id,member_id,document_type,status,mime,size_bytes,created_at`,
      [member.id,documentType,storageKey,createHash('sha256').update(file).digest('hex'),mime,file.length,req.user!.id],
    )).rows[0];
    await putFile(storageKey,file);
    await audit(client,req.user!.id,'edir_loan_document_uploaded',row.id,{member_id:member.id,document_type:documentType,mime,size_bytes:file.length});
    return row;
  });
  res.status(201).json(document);
}));

edirCreditRouter.get('/documents/me',h(async(req,res)=>{
  const documents=await withUser(req.user!,async(client)=>(await client.query(
    `SELECT id,document_type,status,mime,size_bytes,uploaded_by,reviewed_by,reviewed_at,review_reason,created_at
     FROM edir_loan_documents WHERE member_id IN(SELECT id FROM edir_memberships WHERE user_id=$1)
     ORDER BY created_at DESC`,[req.user!.id],
  )).rows);
  res.json(documents);
}));

edirCreditRouter.get('/documents/pending-review',requireStaffRole(
  ['edir_admin','compliance','credit_manager','auditor'],'Edir loan document review access is required',
),h(async(req,res)=>{
  const documents=await withUser(req.user!,async(client)=>(await client.query(
    `SELECT document.id,document.member_id,member.member_number,member.full_name AS member_name,
       document.document_type,document.status,document.mime,document.size_bytes,document.uploaded_by,document.created_at
     FROM edir_loan_documents document JOIN edir_memberships member
       ON member.id=document.member_id AND member.organization_id=document.organization_id
     WHERE document.status='uploaded' ORDER BY document.created_at LIMIT 300`,
  )).rows);
  res.json(documents);
}));

edirCreditRouter.get('/documents/:documentId/file',h(async(req,res)=>{
  const file=await withUser(req.user!,async(client)=>{
    const row=(await client.query(`SELECT id,storage_key,mime FROM edir_loan_documents WHERE id=$1`,[req.params.documentId])).rows[0];
    if(!row)throw new HttpError(404,'Edir loan document not found');
    await audit(client,req.user!.id,'edir_loan_document_downloaded',row.id,{});
    return row;
  });
  res.set({'Content-Type':file.mime,'Content-Disposition':'attachment','X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'})
    .send(await getFile(file.storage_key));
}));

edirCreditRouter.get('/members/:memberId/documents',requireStaffRole(creditReaderRoles,'Edir loan document review access is required'),h(async(req,res)=>{
  const memberId=z.string().uuid().parse(req.params.memberId);
  const documents=await withUser(req.user!,async(client)=>(await client.query(
    `SELECT id,member_id,document_type,status,mime,size_bytes,uploaded_by,reviewed_by,reviewed_at,review_reason,created_at
     FROM edir_loan_documents WHERE member_id=$1 ORDER BY created_at DESC`,[memberId],
  )).rows);
  res.json(documents);
}));

edirCreditRouter.post('/members/:memberId/documents/:documentId/review',requireStaffRole(
  ['edir_admin','compliance','credit_manager'],'Edir loan document review access is required',
),h(async(req,res)=>{
  const memberId=z.string().uuid().parse(req.params.memberId);
  const body=z.object({decision:z.enum(['verified','rejected']),reason:z.string().trim().min(10).max(1000)}).strict().parse(req.body);
  const document=await withUser(req.user!,async(client)=>{
    const current=(await client.query(
      `SELECT id,status,uploaded_by FROM edir_loan_documents WHERE id=$1 AND member_id=$2 FOR UPDATE`,
      [req.params.documentId,memberId],
    )).rows[0];
    if(!current)throw new HttpError(404,'Edir loan document not found');
    if(current.status!=='uploaded')throw new HttpError(409,'Edir loan document has already been reviewed');
    if(current.uploaded_by===req.user!.id)throw new HttpError(409,'The document uploader cannot review their own upload');
    const updated=(await client.query(
      `UPDATE edir_loan_documents SET status=$2,reviewed_by=$3,reviewed_at=now(),review_reason=$4 WHERE id=$1
       RETURNING id,member_id,document_type,status,reviewed_by,reviewed_at,review_reason`,
      [current.id,body.decision,req.user!.id,body.reason],
    )).rows[0];
    await audit(client,req.user!.id,'edir_loan_document_'+body.decision,current.id,{status:current.status,next:body.decision,reason:body.reason});
    return updated;
  });
  res.json(document);
}));

edirCreditRouter.post('/applications/:applicationId/assess', requireStaffRole(['edir_admin', 'credit_officer', 'credit_manager'], 'Edir credit assessment access is required'), h(async (req, res) => {
  const applicationId = z.string().uuid().parse(req.params.applicationId);
  const result = await withUser(req.user!, async (client) => {
    const application = (await client.query(
      `SELECT a.*,
              greatest(floor(extract(epoch FROM (now()-m.activated_at))/86400),0)::int AS membership_days_at_assessment
       FROM edir_loan_applications a
       JOIN edir_memberships m ON m.id=a.member_id
       WHERE a.id=$1 FOR UPDATE OF a`,
      [applicationId],
    )).rows[0];
    if (!application) throw new HttpError(404, 'Edir credit application was not found');
    if (!['awaiting_policy', 'submitted'].includes(application.status)) {
      throw new HttpError(409, 'Only a submitted application can be assessed');
    }
    if (application.created_by === req.user!.id) {
      throw new HttpError(403, 'The applicant cannot assess their own Edir credit request');
    }
    const activePolicy = (await client.query(
      `SELECT id,version,policy FROM edir_credit_policy_versions WHERE status='active'`,
    )).rows[0];
    if (!activePolicy) throw new HttpError(409, 'This Edir must independently approve a credit policy before underwriting applications');
    const policy = edirCreditPolicySchema.parse(activePolicy.policy);
    const balance = (await client.query(
      `SELECT coalesce(sum(l.credit-l.debit),0)::text AS balance
       FROM edir_member_accounts ma
       JOIN edir_financial_products p ON p.id=ma.product_id AND p.product_type='savings'
       JOIN edir_financial_journal_lines l ON l.member_account_id=ma.id
       JOIN edir_financial_journals j ON j.id=l.journal_id AND j.status='posted'
       WHERE ma.member_id=$1 AND ma.status='active'`,
      [application.member_id],
    )).rows[0].balance;
    const membershipDays = Number(application.membership_days_at_assessment);
    const assessment = assessEdirLoan({
      policy,
      requestedPrincipal: String(application.requested_principal),
      requestedTermMonths: Number(application.requested_term_months),
      monthlyIncome: String(application.monthly_income),
      monthlyExpenses: String(application.monthly_expenses),
      monthlyDebt: String(application.monthly_debt),
      savingsBalance: balance,
      membershipDays,
    });
    let productEligibility = null;
    if (application.product_version_id) {
      const terms = lendingProductTermsSchema.parse(application.product_terms);
      const context = z.object({
        customer_category: z.enum(['employee','individual','petty_trader','formal_business','partnership','plc','student','youth_entrepreneur','agriculture','group_member']),
        age: z.number().int().nullable(), business_months: z.number().int().nullable(), employment_months: z.number().int().nullable(),
        equity_amount: money, collateral_value: positiveMoney.nullable(), documents: z.array(z.string()), supplied_fields: z.array(z.string()),
      }).passthrough().parse(application.eligibility_context);
      const activeLoans = Number((await client.query(
        `SELECT count(*) AS count FROM edir_loans WHERE member_id=$1 AND status IN ('approved','disbursed')`, [application.member_id],
      )).rows[0].count);
      productEligibility = evaluateLoanEligibility({
        terms, category: context.customer_category, principal: String(application.requested_principal),
        tenorMonths: Number(application.requested_term_months), debtServiceBps: assessment.factors.debt_service_bps,
        membershipDays, savingsBalance: balance, activeLoans, age: context.age ?? undefined,
        businessMonths: context.business_months ?? undefined, employmentMonths: context.employment_months ?? undefined,
        equityAmount: context.equity_amount, collateralValue: context.collateral_value ?? undefined,
        suppliedDocuments: context.documents, suppliedFields: context.supplied_fields,
      });
    }
    const scored = (await client.query(
      `UPDATE edir_loan_applications
       SET status='scored',policy_version_id=$2,credit_score=$3,score_factors=$4,scored_by=$5,scored_at=now()
       WHERE id=$1
       RETURNING id,status,policy_version_id,credit_score,score_factors,scored_by,scored_at`,
      [application.id, activePolicy.id, assessment.score, JSON.stringify(assessment.factors), req.user!.id],
    )).rows[0];
    await audit(client, req.user!.id, 'edir_loan_application_assessed', application.id, {
      policy_version: activePolicy.version, score: assessment.score, factors: assessment.factors,
      eligible: assessment.eligible,
      product_eligibility: productEligibility,
    });
    return { ...scored, eligible: assessment.eligible && (productEligibility?.eligible ?? true),
      product_eligibility: productEligibility, policy_version: activePolicy.version };
  });
  res.json(result);
}));

edirCreditRouter.post('/applications/:applicationId/decision', requireStaffRole(creditMakerRoles, 'Edir credit approval access is required'), h(async (req, res) => {
  const applicationId = z.string().uuid().parse(req.params.applicationId);
  const body = z.object({ decision: z.enum(['approve', 'reject']), reason }).strict().parse(req.body);
  const result = await withUser(req.user!, async (client) => {
    const application = (await client.query(
      `SELECT * FROM edir_loan_applications WHERE id=$1 AND status='scored' FOR UPDATE`, [applicationId],
    )).rows[0];
    if (!application) throw new HttpError(404, 'Scored Edir credit application was not found');
    if ([application.created_by, application.scored_by].includes(req.user!.id)) {
      throw new HttpError(403, 'The applicant and credit assessor cannot decide this application');
    }
    const policyRow = (await client.query(
      `SELECT policy FROM edir_credit_policy_versions WHERE id=$1 AND status IN ('active','superseded')`,
      [application.policy_version_id],
    )).rows[0];
    if (!policyRow) throw new HttpError(409, 'The approved policy used for scoring is unavailable');
    const policy = edirCreditPolicySchema.parse(policyRow.policy);
    const factors = z.object({
      affordability: z.number().int().min(0).max(100),
      savings: z.number().int().min(0).max(100),
      membership_tenure: z.number().int().min(0).max(100),
      debt_service_bps: z.number().int().nonnegative(),
      membership_days: z.number().int().nonnegative(),
    }).strict().parse(application.score_factors);
    const recomputedScore = Math.round(
      (factors.affordability * policy.scorecard.weights.affordability
        + factors.savings * policy.scorecard.weights.savings
        + factors.membership_tenure * policy.scorecard.weights.membership_tenure) / 100,
    );
    const productEligible = application.product_version_id
      ? (() => {
        const terms = lendingProductTermsSchema.parse(application.product_terms);
        const context = z.object({
          customer_category: z.enum(['employee','individual','petty_trader','formal_business','partnership','plc','student','youth_entrepreneur','agriculture','group_member']),
          age: z.number().int().nullable(), business_months: z.number().int().nullable(), employment_months: z.number().int().nullable(),
          equity_amount: money, collateral_value: positiveMoney.nullable(), documents: z.array(z.string()), supplied_fields: z.array(z.string()),
          membership_days: z.number().int().nonnegative(),
        }).passthrough().parse(application.eligibility_context);
        return { terms, context };
      })() : null;
    const otherOpenApplications = Number((await client.query(
      `SELECT count(*) AS count FROM edir_loan_applications
       WHERE member_id=$1 AND id<>$2
         AND status IN ('awaiting_policy','submitted','scored','approved','accepted')`,
      [application.member_id, application.id],
    )).rows[0].count);
    const withinPolicy = parseEdirMoney(String(application.requested_principal)) <= parseEdirMoney(policy.maximum_principal)
      && Number(application.requested_term_months) <= policy.maximum_tenor_months
      && factors.membership_days >= policy.minimum_membership_days
      && factors.debt_service_bps <= policy.maximum_debt_service_bps
      && factors.savings >= 100
      && otherOpenApplications < policy.maximum_concurrent_applications
      && recomputedScore === Number(application.credit_score)
      && recomputedScore >= policy.scorecard.minimum_score;
    let productWithinLimits = true;
    if (productEligible) {
      const currentSavings = String((await client.query(
        `SELECT coalesce(sum(l.credit-l.debit),0)::text AS balance
         FROM edir_member_accounts ma
         JOIN edir_financial_products p ON p.id=ma.product_id AND p.product_type='savings'
         JOIN edir_financial_journal_lines l ON l.member_account_id=ma.id
         JOIN edir_financial_journals j ON j.id=l.journal_id AND j.status='posted'
         WHERE ma.member_id=$1 AND ma.status='active'`, [application.member_id],
      )).rows[0].balance);
      const activeLoans = Number((await client.query(
        `SELECT count(*) AS count FROM edir_loans WHERE member_id=$1 AND status IN ('approved','disbursed')`, [application.member_id],
      )).rows[0].count);
      productWithinLimits = evaluateLoanEligibility({
        terms: productEligible.terms, category: productEligible.context.customer_category,
        principal: String(application.requested_principal), tenorMonths: Number(application.requested_term_months),
        debtServiceBps: factors.debt_service_bps, membershipDays: productEligible.context.membership_days,
        savingsBalance: currentSavings, activeLoans, age: productEligible.context.age ?? undefined,
        businessMonths: productEligible.context.business_months ?? undefined,
        employmentMonths: productEligible.context.employment_months ?? undefined,
        equityAmount: productEligible.context.equity_amount, collateralValue: productEligible.context.collateral_value ?? undefined,
        suppliedDocuments: productEligible.context.documents, suppliedFields: productEligible.context.supplied_fields,
      }).eligible;
    }
    const mayApprove = withinPolicy && productWithinLimits;
    const status = body.decision === 'approve' && mayApprove ? 'approved' : body.decision === 'reject' ? 'rejected' : null;
    if (!status) throw new HttpError(409, 'The application does not satisfy the approved policy limits and cannot be approved');
    const updated = (await client.query(
      `UPDATE edir_loan_applications
       SET status=$2,decision_by=$3,decision_at=now(),decision_reason=$4
       WHERE id=$1
       RETURNING id,status,requested_principal::text,requested_term_months,decision_by,decision_at,decision_reason`,
      [application.id, status, req.user!.id, body.reason],
    )).rows[0];
    await audit(client, req.user!.id, `edir_loan_application_${status}`, application.id, {
      status, policy_version_id: application.policy_version_id, reason: body.reason,
    });
    return updated;
  });
  res.json(result);
}));

edirCreditRouter.post('/applications/:applicationId/accept', h(async (req, res) => {
  const applicationId = z.string().uuid().parse(req.params.applicationId);
  const body = z.object({
    accept: z.literal(true),
    savings_account_id: z.string().uuid(),
  }).strict().parse(req.body);
  const application = await withUser(req.user!, async (client) => {
    const row = (await client.query(
      `SELECT a.id,a.member_id,a.status,a.requested_principal::text,a.requested_term_months,a.product_version_id,
              a.product_terms,a.eligibility_context,m.kyc_status,
              a.policy_version_id,m.organization_id
       FROM edir_loan_applications a
       JOIN edir_memberships m ON m.id=a.member_id
       WHERE a.id=$1 AND m.user_id=$2 FOR UPDATE OF a`,
      [applicationId, req.user!.id],
    )).rows[0];
    if (!row) throw new HttpError(404, 'Edir loan offer was not found for this member');
    await client.query('SELECT edir_lock_member_credit_controls($1)',[row.member_id]);
    const existing = (await client.query(
      `SELECT loan.id,loan.status,loan.principal_amount::text,loan.term_months,
              loan.member_account_id,loan.principal_repaid::text,loan.disbursed_at,
              acceptance.agreement_hash,acceptance.terms_snapshot
       FROM edir_loans loan LEFT JOIN edir_loan_acceptances acceptance
         ON acceptance.application_id=loan.application_id AND acceptance.organization_id=loan.organization_id
       WHERE loan.application_id=$1`,
      [applicationId],
    )).rows[0];
    if (existing) {
      if (existing.member_account_id !== body.savings_account_id) {
        throw new HttpError(409, 'This accepted Edir loan is already assigned to a different savings account');
      }
      return { ...row, loan: existing, created: false };
    }
    if (row.status !== 'approved') throw new HttpError(409, 'Only an approved Edir loan offer can be accepted');
    if(row.kyc_status!=='verified')throw new HttpError(409,'Edir member KYC must remain verified before accepting the loan offer');
    if ((await client.query('SELECT edir_member_has_active_risk_hold($1) AS held',[row.member_id])).rows[0].held) {
      throw new HttpError(409,'An active Edir risk hold prevents loan acceptance');
    }
    const termsSnapshot={
      contract:'afrolife-edir-loan-offer-v1',
      organization_id:row.organization_id,application_id:row.id,member_id:row.member_id,
      principal:row.requested_principal,term_months:row.requested_term_months,
      product_version_id:row.product_version_id,product_terms:row.product_terms,
      eligibility_context:row.eligibility_context,savings_account_id:body.savings_account_id,
    };
    const agreementHash=createHash('sha256').update(JSON.stringify(termsSnapshot)).digest('hex');
    const acceptanceText=`I accept ETB ${row.requested_principal} for ${row.requested_term_months} months under the approved AfroLife Edir offer. This consent is bound to agreement ${agreementHash}.`;
    const acceptance = (await client.query(
      `INSERT INTO edir_loan_acceptances
         (application_id,member_id,member_account_id,accepted_by,consent_text,terms_snapshot,agreement_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING accepted_at,agreement_hash,terms_snapshot`,
      [
        applicationId, row.member_id, body.savings_account_id, req.user!.id,
        acceptanceText,JSON.stringify(termsSnapshot),agreementHash,
      ],
    )).rows[0];
    const loan = (await client.query(
      `INSERT INTO edir_loans
         (organization_id,application_id,member_id,member_account_id,policy_version_id,
          principal_amount,term_months,accepted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id,status,principal_amount::text,term_months,member_account_id,
                 principal_repaid::text,disbursed_at`,
      [row.organization_id, applicationId, row.member_id, body.savings_account_id,
        row.policy_version_id, row.requested_principal, row.requested_term_months, acceptance.accepted_at],
    )).rows[0];
    await audit(client, req.user!.id, 'edir_loan_offer_accepted', applicationId, {
      requested_principal: row.requested_principal, requested_term_months: row.requested_term_months,
      member_account_id: body.savings_account_id, loan_id: loan.id,agreement_hash:acceptance.agreement_hash,
    });
    return { ...row, status: 'accepted', accepted_at: acceptance.accepted_at,agreement_hash:acceptance.agreement_hash,
      terms_snapshot:acceptance.terms_snapshot,loan,created: true };
  });
  res.status(application.created === false ? 200 : 201).json(application);
}));

edirCreditRouter.get('/loans/me', h(async (req, res) => {
  const loans = await withUser(req.user!, async (client) => (await client.query(
    `SELECT loan.id,loan.application_id,loan.status,loan.principal_amount::text,
            loan.principal_repaid::text,(loan.principal_amount-loan.principal_repaid)::text AS outstanding_principal,
            loan.term_months,loan.accepted_at,loan.disbursed_at,loan.member_account_id,
            account.product_id,product.name AS savings_product_name,
            coalesce(installment_data.schedule,'[]'::jsonb) AS schedule,
            coalesce(operation_data.operations,'[]'::jsonb) AS operations
     FROM edir_loans loan
     JOIN edir_memberships member ON member.id=loan.member_id
     JOIN edir_member_accounts account ON account.id=loan.member_account_id
     JOIN edir_financial_products product ON product.id=account.product_id
     LEFT JOIN LATERAL (
       SELECT jsonb_agg(jsonb_build_object(
              'installment_no',installment.installment_no,'due_on',installment.due_on,
              'principal_due',installment.principal_due::text,'principal_paid',installment.principal_paid::text,
              'status',installment.status
            ) ORDER BY installment.installment_no) AS schedule
       FROM edir_loan_installments installment
       WHERE installment.loan_id=loan.id AND installment.organization_id=loan.organization_id
     ) installment_data ON true
     LEFT JOIN LATERAL (
       SELECT jsonb_agg(jsonb_build_object(
              'id',operation.id,'operation_type',operation.operation_type,'amount',operation.amount::text,
              'status',operation.status,'created_at',operation.created_at,'reviewed_at',operation.reviewed_at,
              'review_reason',operation.review_reason
            ) ORDER BY operation.created_at) AS operations
       FROM edir_loan_operations operation
       WHERE operation.loan_id=loan.id AND operation.organization_id=loan.organization_id
     ) operation_data ON true
     WHERE member.user_id=$1
     ORDER BY loan.accepted_at DESC`,
    [req.user!.id],
  )).rows);
  res.json(loans);
}));

edirCreditRouter.get('/loans', requireStaffRole(creditReaderRoles, 'Edir credit servicing access is required'), h(async (_req, res) => {
  const loans = await withUser(_req.user!, async (client) => (await client.query(
    `SELECT loan.id,loan.application_id,loan.member_id,member.member_number,member.full_name AS member_name,
            loan.status,loan.principal_amount::text,loan.principal_repaid::text,
            (loan.principal_amount-loan.principal_repaid)::text AS outstanding_principal,
            loan.term_months,loan.accepted_at,loan.disbursed_at,loan.member_account_id,
            coalesce(installment_data.schedule,'[]'::jsonb) AS schedule,
            coalesce(operation_data.operations,'[]'::jsonb) AS operations
     FROM edir_loans loan
     JOIN edir_memberships member ON member.id=loan.member_id
     LEFT JOIN LATERAL (
       SELECT jsonb_agg(jsonb_build_object(
              'installment_no',installment.installment_no,'due_on',installment.due_on,
              'principal_due',installment.principal_due::text,'principal_paid',installment.principal_paid::text,
              'status',installment.status
            ) ORDER BY installment.installment_no) AS schedule
       FROM edir_loan_installments installment
       WHERE installment.loan_id=loan.id AND installment.organization_id=loan.organization_id
     ) installment_data ON true
     LEFT JOIN LATERAL (
       SELECT jsonb_agg(jsonb_build_object(
              'id',operation.id,'operation_type',operation.operation_type,'amount',operation.amount::text,
              'status',operation.status,'created_by',operation.created_by,'reviewed_by',operation.reviewed_by,
              'created_at',operation.created_at,'reviewed_at',operation.reviewed_at,'review_reason',operation.review_reason
            ) ORDER BY operation.created_at) AS operations
       FROM edir_loan_operations operation
       WHERE operation.loan_id=loan.id AND operation.organization_id=loan.organization_id
     ) operation_data ON true
     ORDER BY loan.accepted_at DESC LIMIT 200`,
  )).rows);
  res.json(loans);
}));

edirCreditRouter.get('/reports/portfolio', requireStaffRole(creditReaderRoles, 'Edir portfolio report access is required'), h(async (req, res) => {
  const report = await withUser(req.user!, async (client) => {
    const [summary, aging] = await Promise.all([
      client.query(
        `WITH balances AS (
           SELECT loan.id,loan.principal_amount-loan.principal_repaid AS outstanding,
             coalesce(max(current_date-installment.due_on) FILTER
               (WHERE installment.status<>'paid' AND installment.due_on<current_date),0)::int AS dpd,
             coalesce(sum(installment.principal_due-installment.principal_paid) FILTER
               (WHERE installment.status<>'paid' AND installment.due_on<current_date),0)::numeric(14,2) AS overdue
           FROM edir_loans loan LEFT JOIN edir_loan_installments installment
             ON installment.loan_id=loan.id AND installment.organization_id=loan.organization_id
           WHERE loan.status='disbursed' GROUP BY loan.id
         )
         SELECT count(*)::int AS disbursed_loans,
           coalesce(sum(outstanding),0)::numeric(14,2) AS outstanding_principal,
           count(*) FILTER (WHERE overdue>0)::int AS loans_past_due,
           coalesce(sum(outstanding) FILTER (WHERE overdue>0),0)::numeric(14,2) AS par_principal,
           CASE WHEN coalesce(sum(outstanding),0)=0 THEN 0
             ELSE round(100*sum(outstanding) FILTER (WHERE overdue>0)/sum(outstanding),2) END AS par_ratio_pct
         FROM balances`,
      ),
      client.query(
        `WITH balances AS (
           SELECT loan.id,loan.principal_amount-loan.principal_repaid AS outstanding,
             coalesce(max(current_date-installment.due_on) FILTER
               (WHERE installment.status<>'paid' AND installment.due_on<current_date),0)::int AS dpd
           FROM edir_loans loan LEFT JOIN edir_loan_installments installment
             ON installment.loan_id=loan.id AND installment.organization_id=loan.organization_id
           WHERE loan.status='disbursed' GROUP BY loan.id
         ), buckets AS (
           SELECT CASE WHEN dpd BETWEEN 1 AND 30 THEN '1_30' WHEN dpd BETWEEN 31 AND 60 THEN '31_60'
             WHEN dpd BETWEEN 61 AND 90 THEN '61_90' WHEN dpd>90 THEN 'over_90' ELSE 'current' END AS bucket,
             outstanding FROM balances
         )
         SELECT count(*)::int AS loan_count,coalesce(sum(outstanding),0)::numeric(14,2) AS outstanding_principal
         FROM buckets GROUP BY bucket ORDER BY CASE bucket WHEN 'current' THEN 0 WHEN '1_30' THEN 1
           WHEN '31_60' THEN 2 WHEN '61_90' THEN 3 ELSE 4 END`,
      ),
    ]);
    return { as_of: new Date().toISOString().slice(0,10), ...summary.rows[0], aging: aging.rows };
  });
  res.json(report);
}));

edirCreditRouter.get('/reports/trial-balance', requireStaffRole(
  ['edir_admin','finance_manager','treasurer','compliance','auditor'], 'Edir trial balance access is required',
), h(async (req, res) => {
  const asOf = z.string().date().optional().parse(req.query.as_of);
  const format = z.enum(['json','csv']).default('json').parse(req.query.format);
  const report = await withUser(req.user!, async (client) => {
    const result = await client.query(
      `WITH posted_lines AS (
         SELECT line.ledger_account_id,line.debit,line.credit,journal.posted_at
         FROM edir_financial_journal_lines line JOIN edir_financial_journals journal
           ON journal.id=line.journal_id AND journal.status='posted'
         UNION ALL
         SELECT line.ledger_account_id,line.debit,line.credit,journal.posted_at
         FROM edir_loan_journal_lines line JOIN edir_loan_journals journal
           ON journal.id=line.journal_id AND journal.organization_id=line.organization_id AND journal.status='posted'
       )
       SELECT account.code AS account_code,account.name,account.category AS account_type,
         coalesce(sum(line.debit),0)::numeric(14,2) AS debits,
         coalesce(sum(line.credit),0)::numeric(14,2) AS credits,
         CASE WHEN account.category IN ('asset','expense') THEN coalesce(sum(line.debit-line.credit),0)
           ELSE coalesce(sum(line.credit-line.debit),0) END::numeric(14,2) AS balance
       FROM edir_ledger_accounts account LEFT JOIN posted_lines line
         ON line.ledger_account_id=account.id AND line.posted_at < (($1::date+interval '1 day')::timestamptz)
       GROUP BY account.id ORDER BY account.code`, [asOf ?? new Date().toISOString().slice(0,10)],
    );
    const totals = result.rows.reduce((acc, row) => ({
      debits: acc.debits + Number(row.debits), credits: acc.credits + Number(row.credits),
    }), { debits: 0, credits: 0 });
    return { as_of: asOf ?? new Date().toISOString().slice(0,10), accounts: result.rows,
      total_debits: totals.debits.toFixed(2), total_credits: totals.credits.toFixed(2),
      balanced: Math.abs(totals.debits-totals.credits)<0.005 };
  });
  if (format === 'csv') {
    const rows = report.accounts.map((row) => ({
      account_code: String(row.account_code), account_name: String(row.name), account_type: String(row.account_type),
      debits: String(row.debits), credits: String(row.credits), balance: String(row.balance),
    }));
    rows.push({ account_code: 'TOTAL', account_name: '', account_type: '',
      debits: String(report.total_debits), credits: String(report.total_credits), balance: '' });
    res.type('text/csv').attachment(`edir-trial-balance-${report.as_of}.csv`)
      .send(toCsv(rows, ['account_code','account_name','account_type','debits','credits','balance']));
  } else res.json(report);
}));

edirCreditRouter.get('/reports/disbursement-reconciliation', requireStaffRole(
  ['edir_admin','finance_manager','treasurer','compliance','auditor'], 'Edir reconciliation report access is required',
), h(async (req, res) => {
  const from = z.string().date().optional().parse(req.query.from);
  const to = z.string().date().optional().parse(req.query.to);
  if (from && to && from>to) throw new HttpError(400, 'from must be on or before to');
  const report = await withUser(req.user!, async (client) => {
    const rows = (await client.query(
      `SELECT operation.operation_type,count(*)::int AS operation_count,
         coalesce(sum(operation.amount),0)::numeric(14,2) AS total_amount,
         count(*) FILTER (WHERE journal.id IS NULL)::int AS missing_posted_journals,
         coalesce(sum(CASE WHEN operation.operation_type='disbursement' THEN operation.amount ELSE 0 END),0)::numeric(14,2) AS disbursed,
         coalesce(sum(CASE WHEN operation.operation_type='repayment' THEN operation.amount ELSE 0 END),0)::numeric(14,2) AS repaid
       FROM edir_loan_operations operation LEFT JOIN edir_loan_journals journal
         ON journal.operation_id=operation.id AND journal.organization_id=operation.organization_id AND journal.status='posted'
       WHERE operation.status='approved' AND ($1::date IS NULL OR journal.posted_at >= $1::date::timestamptz)
         AND ($2::date IS NULL OR journal.posted_at < ($2::date+interval '1 day')::timestamptz)
       GROUP BY operation.operation_type ORDER BY operation.operation_type`, [from ?? null,to ?? null],
    )).rows;
    return { from: from ?? null,to: to ?? null,by_type: rows,
      disbursed: rows.find((row) => row.operation_type==='disbursement')?.disbursed ?? '0.00',
      repaid: rows.find((row) => row.operation_type==='repayment')?.repaid ?? '0.00',
      missing_posted_journals: rows.reduce((sum,row)=>sum+Number(row.missing_posted_journals),0) };
  });
  res.json(report);
}));

async function requestLoanOperation(
  req: Request, loanId: string, operationType: 'disbursement' | 'repayment', amount: string,
  idempotencyKey: string,
) {
  const payloadHash = createHash('sha256')
    .update(JSON.stringify({ loan_id: loanId, operation_type: operationType, amount }))
    .digest('hex');
  return withUser(req.user!, async (client) => {
    const inserted = await client.query(
      `INSERT INTO edir_loan_operations
         (loan_id,operation_type,amount,idempotency_key,payload_hash,created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (organization_id,created_by,idempotency_key) DO NOTHING
       RETURNING id`,
      [loanId, operationType, amount, idempotencyKey, payloadHash, req.user!.id],
    );
    const operation = (await client.query(
      `SELECT id,loan_id,operation_type,amount::text,status,created_by,reviewed_by,reviewed_at,
              review_reason,created_at,payload_hash
       FROM edir_loan_operations WHERE organization_id=$1 AND created_by=$2 AND idempotency_key=$3`,
      [req.user!.edir_id ?? '00000000-0000-4000-8000-000000000002', req.user!.id, idempotencyKey],
    )).rows[0];
    if (!operation) throw new HttpError(404, 'Edir loan was not found or is not available in this organization');
    if (operation.payload_hash !== payloadHash) {
      throw new HttpError(409, 'Idempotency key was already used for a different Edir loan operation');
    }
    delete operation.payload_hash;
    return { ...operation, created: Boolean(inserted.rowCount) };
  });
}

edirCreditRouter.post('/loans/:loanId/disbursements', requireStaffRole(servicingMakerRoles, 'Edir loan disbursement access is required'), h(async (req, res) => {
  const loanId = z.string().uuid().parse(req.params.loanId);
  const body = z.object({ amount: positiveMoney, idempotency_key: z.string().uuid() }).strict().parse(req.body);
  const operation = await requestLoanOperation(req, loanId, 'disbursement', body.amount, body.idempotency_key);
  res.status(operation.created ? 201 : 200).json(operation);
}));

edirCreditRouter.post('/loans/:loanId/writeoffs', requireStaffRole(servicingMakerRoles, 'Edir loan write-off access is required'), h(async (req, res) => {
  const loanId = z.string().uuid().parse(req.params.loanId);
  const body = z.object({ idempotency_key: z.string().uuid(), reason: z.string().trim().min(10).max(1000) }).strict().parse(req.body);
  const payloadHash = createHash('sha256').update(JSON.stringify({ loan_id: loanId, operation_type: 'writeoff', reason: body.reason })).digest('hex');
  const result = await withUser(req.user!, async (client) => {
    const existing = (await client.query(
      `SELECT id,loan_id,amount::text,status,created_by,payload_hash FROM edir_loan_operations
       WHERE organization_id=$1 AND created_by=$2 AND idempotency_key=$3 FOR UPDATE`,
      [req.user!.edir_id ?? '00000000-0000-4000-8000-000000000002', req.user!.id, body.idempotency_key],
    )).rows[0];
    if (existing) {
      if (existing.payload_hash !== payloadHash || existing.loan_id !== loanId) throw new HttpError(409, 'Idempotency key was already used for a different Edir write-off request');
      delete existing.payload_hash;
      return { ...existing, created: false };
    }
    const loan = (await client.query(
      `SELECT id,status,principal_amount::text,principal_repaid::text FROM edir_loans WHERE id=$1 FOR UPDATE`, [loanId],
    )).rows[0];
    if (!loan) throw new HttpError(404, 'Edir loan was not found');
    if (loan.status !== 'disbursed') throw new HttpError(409, 'Only a disbursed Edir loan can be written off');
    const outstanding = parseEdirMoney(loan.principal_amount) - parseEdirMoney(loan.principal_repaid, true);
    if (outstanding <= 0n) throw new HttpError(409, 'The Edir loan has no outstanding principal to write off');
    const amount = formatEdirMoney(outstanding);
    const inserted = await client.query(
      `INSERT INTO edir_loan_operations(loan_id,operation_type,amount,idempotency_key,payload_hash,created_by)
       VALUES($1,'writeoff',$2,$3,$4,$5) ON CONFLICT(organization_id,created_by,idempotency_key) DO NOTHING RETURNING id`,
      [loanId, amount, body.idempotency_key, payloadHash, req.user!.id],
    );
    const operation = (await client.query(
      `SELECT id,loan_id,amount::text,status,created_by,payload_hash FROM edir_loan_operations
       WHERE organization_id=$1 AND created_by=$2 AND idempotency_key=$3 FOR UPDATE`,
      [req.user!.edir_id ?? '00000000-0000-4000-8000-000000000002', req.user!.id, body.idempotency_key],
    )).rows[0];
    if (!operation) throw new HttpError(404, 'Edir loan was not found or is not available in this organization');
    if (operation.payload_hash !== payloadHash) throw new HttpError(409, 'Idempotency key was already used for a different Edir write-off request');
    if (inserted.rowCount) await client.query(
      `INSERT INTO edir_loan_writeoffs(operation_id,loan_id,amount,reason,created_by) VALUES($1,$2,$3,$4,$5)`,
      [operation.id, loanId, amount, body.reason, req.user!.id],
    );
    delete operation.payload_hash;
    return { ...operation, created: Boolean(inserted.rowCount) };
  });
  res.status(result.created ? 201 : 200).json(result);
}));

edirCreditRouter.post('/loans/:loanId/repayments', h(async (req, res) => {
  const loanId = z.string().uuid().parse(req.params.loanId);
  const body = z.object({ amount: positiveMoney, idempotency_key: z.string().uuid() }).strict().parse(req.body);
  const operation = await requestLoanOperation(req, loanId, 'repayment', body.amount, body.idempotency_key);
  res.status(operation.created ? 201 : 200).json(operation);
}));

edirCreditRouter.post('/operations/:operationId/decision',
  requireStaffRole(servicingMakerRoles, 'Edir loan servicing review access is required'),
  h(async (req, res) => {
    const operationId = z.string().uuid().parse(req.params.operationId);
    const body = z.object({ decision: z.enum(['approved', 'rejected']), reason }).strict().parse(req.body);
    const operation = await withUser(req.user!, async (client) => {
      const current = (await client.query(
        `SELECT operation.*,loan.member_id,loan.application_id,loan.member_account_id,
                loan.principal_amount::text,loan.principal_repaid::text,loan.status AS loan_status
         FROM edir_loan_operations operation
         JOIN edir_loans loan ON loan.id=operation.loan_id AND loan.organization_id=operation.organization_id
         WHERE operation.id=$1 FOR UPDATE OF operation,loan`,
        [operationId],
      )).rows[0];
      if (!current) throw new HttpError(404, 'Edir loan operation was not found');
      if (current.created_by === req.user!.id) throw new HttpError(403, 'The operation maker cannot review the same operation');
      if (current.status !== 'pending') throw new HttpError(409, 'This Edir loan operation has already been reviewed');
      if (body.decision === 'approved' && current.operation_type === 'disbursement'
          && (current.loan_status !== 'accepted'
            || parseEdirMoney(String(current.amount)) !== parseEdirMoney(current.principal_amount))) {
        throw new HttpError(409, 'Only the full accepted Edir loan principal can be disbursed once');
      }
      if (body.decision === 'approved' && current.operation_type === 'writeoff'
          && (current.loan_status !== 'disbursed' || parseEdirMoney(String(current.amount)) !== parseEdirMoney(current.principal_amount) - parseEdirMoney(current.principal_repaid, true))) {
        throw new HttpError(409, 'The write-off must cover the full current Edir principal balance');
      }
      if (current.operation_type === 'disbursement') {
        await client.query('SELECT edir_lock_member_credit_controls($1)',[current.member_id]);
        await client.query('SELECT id FROM edir_organizations WHERE id=$1 FOR UPDATE',[req.user!.edir_id??'00000000-0000-4000-8000-000000000002']);
        const capAllows=(await client.query(
          'SELECT edir_platform_disbursement_cap_allows($1) AS allowed',[current.id],
        )).rows[0].allowed;
        if(!capAllows)throw new HttpError(409,'The approved platform-wide daily disbursement limit would be exceeded');
      }
      if (body.decision === 'approved' && current.operation_type === 'disbursement'
          && (await client.query('SELECT edir_member_has_active_risk_hold($1) AS held',[current.member_id])).rows[0].held) {
        throw new HttpError(409,'An active Edir risk hold prevents loan disbursement');
      }
      if(body.decision==='approved'&&current.operation_type==='disbursement'){
        const limit=(await client.query("SELECT daily_limit::text FROM edir_disbursement_limit_versions WHERE organization_id=$1 AND status='active'",[current.organization_id])).rows[0];
        if(limit?.daily_limit!==null&&limit?.daily_limit!==undefined){
          const today=(await client.query(`SELECT coalesce(sum(j.amount),0)::text AS amount FROM edir_loan_journals j
            JOIN edir_loan_operations o ON o.id=j.operation_id AND o.organization_id=j.organization_id
            WHERE j.organization_id=$1 AND j.status='posted' AND o.operation_type='disbursement' AND j.posted_at::date=current_date`,
            [current.organization_id])).rows[0].amount as string;
          if(parseEdirMoney(today,true)+parseEdirMoney(String(current.amount))>parseEdirMoney(String(limit.daily_limit)))
            throw new HttpError(409,'The approved Edir daily disbursement limit would be exceeded');
        }
      }
      if (body.decision === 'approved' && current.operation_type === 'repayment') {
        const outstanding = parseEdirMoney(current.principal_amount) - parseEdirMoney(current.principal_repaid, true);
        if (current.loan_status !== 'disbursed' || parseEdirMoney(String(current.amount)) > outstanding) {
          throw new HttpError(409, 'The requested repayment exceeds the outstanding Edir loan principal');
        }
        const account = (await client.query(
          `SELECT edir_loan_account_balance(account.id)::text AS balance,
                  account.status AS account_status,product.status AS product_status,
                  product.minimum_balance::text
           FROM edir_member_accounts account
           JOIN edir_financial_products product
             ON product.id=account.product_id AND product.organization_id=account.organization_id
           WHERE account.id=$1 AND account.organization_id=$2 AND account.member_id=$3`,
          [current.member_account_id, req.user!.edir_id ?? '00000000-0000-4000-8000-000000000002', current.member_id],
        )).rows[0];
        if (!account || account.account_status !== 'active' || account.product_status !== 'active'
            || parseEdirMoney(account.balance, true) - parseEdirMoney(String(current.amount))
              < parseEdirMoney(account.minimum_balance, true)) {
          throw new HttpError(409, 'The selected Edir savings account has insufficient available balance for repayment');
        }
      }
      const updated = (await client.query(
        `UPDATE edir_loan_operations
         SET status=$2,reviewed_by=$3,reviewed_at=now(),review_reason=$4
         WHERE id=$1
         RETURNING id,loan_id,operation_type,amount::text,status,created_by,reviewed_by,reviewed_at,review_reason`,
        [operationId, body.decision, req.user!.id, body.reason],
      )).rows[0];
      let journalId: string | null = null;
      if (body.decision === 'approved') {
        const mapping = (await client.query(
          `SELECT receivable.id AS loan_ledger_id,product.ledger_account_id AS savings_ledger_id
           FROM edir_loans loan
           JOIN edir_member_accounts account ON account.id=loan.member_account_id
             AND account.organization_id=loan.organization_id
           JOIN edir_financial_products product ON product.id=account.product_id
             AND product.organization_id=account.organization_id
           JOIN edir_ledger_accounts receivable ON receivable.organization_id=loan.organization_id
             AND receivable.code='1300' AND receivable.active
           WHERE loan.id=$1`,
          [updated.loan_id],
        )).rows[0];
        if (!mapping) throw new HttpError(503, 'Required Edir savings or loan receivable ledger mappings are unavailable');
        if (updated.operation_type === 'writeoff') {
          const loss = (await client.query("SELECT id FROM edir_ledger_accounts WHERE organization_id=$1 AND code='5100' AND active", [current.organization_id])).rows[0];
          if (!loss) throw new HttpError(503, 'Required Edir loan write-off expense ledger mapping is unavailable');
          mapping.loss_ledger_id = loss.id;
        }
        journalId = (await client.query(
          `INSERT INTO edir_loan_journals (operation_id,amount)
           VALUES ($1,$2) RETURNING id`,
          [updated.id, updated.amount],
        )).rows[0].id;
        const isDisbursement = updated.operation_type === 'disbursement';
        const journalLines = updated.operation_type === 'writeoff'
          ? [[mapping.loss_ledger_id, null, updated.amount, '0'], [mapping.loan_ledger_id, null, '0', updated.amount]]
          : isDisbursement
          ? [
            [mapping.loan_ledger_id, null, updated.amount, '0'],
            [mapping.savings_ledger_id, current.member_account_id, '0', updated.amount],
          ]
          : [
            [mapping.savings_ledger_id, current.member_account_id, updated.amount, '0'],
            [mapping.loan_ledger_id, null, '0', updated.amount],
          ];
        for (const [ledgerId, accountId, debit, credit] of journalLines) {
          await client.query(
            `INSERT INTO edir_loan_journal_lines
               (journal_id,ledger_account_id,member_account_id,debit,credit)
             VALUES ($1,$2,$3,$4,$5)`,
            [journalId, ledgerId, accountId, debit, credit],
          );
        }
        await client.query(
          `UPDATE edir_loan_journals SET status='posted',posted_by=$2,posted_at=now() WHERE id=$1`,
          [journalId, req.user!.id],
        );
      }
      await audit(client, req.user!.id, `edir_loan_${updated.operation_type}_${body.decision}`, operationId, {
        loan_id: updated.loan_id, amount: updated.amount, reason: body.reason, journal_id: journalId,
      });
      return { ...updated, journal_id: journalId };
    });
    res.json(operation);
  }),
);
