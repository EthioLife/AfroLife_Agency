import { createHash, randomUUID } from 'node:crypto';
import { Router, type Request, type Response, type RequestHandler } from 'express';
import { z } from 'zod';
import { HttpError, requireActivity, requireRole, withUser } from './core.js';
import { requireMiniAppAccess } from './mini-app-access.js';
import { audit } from './domain.js';
import { isClamAvConfigured, scanWithClamAv } from './clamav.js';
import { sniff } from './files.js';
import { getFile, putFile } from './storage.js';

const h = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { fn(req, res).catch(next); };

const portal = Router();
const vendorOnly = [requireRole('property_vendor'), requireMiniAppAccess('properties')];
const evidenceAccess: RequestHandler = (req, res, next) => {
  if (req.user?.role === 'property_vendor') return requireMiniAppAccess('properties')(req, res, next);
  if (req.user?.role === 'customer') return requireMiniAppAccess('properties')(req, res, next);
  return requireActivity('property.maintenance.manage')(req, res, next);
};
const vendorManagement = requireRole('finance','finance_manager','super_admin','global_admin');
const vendorAssignment = `
  EXISTS (
    SELECT 1 FROM property_vendor_memberships membership
    WHERE membership.vendor_id=maintenance_requests.assigned_vendor_id
    AND membership.user_id=$2 AND membership.active
  )
`;
const vendorAssignmentList = vendorAssignment.replace('membership.user_id=$2', 'membership.user_id=$1');

portal.post('/property-vendors/:vendorId/portal-members', vendorManagement, h(async (req, res) => {
  const body = z.object({ user_id: z.string().uuid() }).strict().parse(req.body);
  const membership = await withUser(req.user!, async (client) => {
    const vendor = (await client.query(
      'SELECT id FROM property_vendors WHERE id=$1 AND active FOR UPDATE',
      [req.params.vendorId],
    )).rows[0];
    if (!vendor) throw new HttpError(404, 'Active property vendor not found');
    const account = (await client.query(
      `SELECT id FROM users WHERE id=$1 AND role='property_vendor' AND active=true AND kyc_status='verified'`,
      [body.user_id],
    )).rows[0];
    if (!account) throw new HttpError(422, 'Choose an active, verified property-vendor account');
    const row = (await client.query(
      `INSERT INTO property_vendor_memberships(vendor_id,user_id,created_by)
       VALUES($1,$2,$3) RETURNING vendor_id,user_id,active,created_at`,
      [vendor.id, account.id, req.user!.id],
    )).rows[0];
    await audit(client, req.user!.id, 'property_vendor_portal_member_added', 'property_vendor', vendor.id, null, {
      user_id: account.id,
    });
    return row;
  });
  res.status(201).json(membership);
}));

portal.get('/maintenance/vendor/assigned', vendorOnly, h(async (req, res) => {
  res.json(await withUser(req.user!, async (client) => (await client.query(
    `SELECT m.id,m.property_id,m.unit_id,p.address,u.unit_no,m.description,m.category,m.priority,
       m.status,m.assigned_to,m.cost,m.sla_due_at,m.created_at,m.updated_at,
       m.resolution_note,m.review_note,
       (SELECT count(*)::int FROM maintenance_evidence e
        WHERE e.maintenance_request_id=m.id AND e.scan_status='clean') AS evidence_count
     FROM maintenance_requests m
     JOIN properties p ON p.id=m.property_id
     LEFT JOIN property_units u ON u.id=m.unit_id
     WHERE ${vendorAssignmentList}
     ORDER BY (m.status IN ('completed','done','cancelled')),m.sla_due_at NULLS LAST,m.created_at DESC,m.id
     LIMIT 200`,
    [req.user!.id],
  )).rows));
}));

portal.get('/maintenance/vendors', requireRole('corporate_business_manager','super_admin','global_admin'), h(async (req, res) => {
  res.json(await withUser(req.user!, async (client) => (await client.query(
    `SELECT id,name FROM property_vendors WHERE active ORDER BY name,id LIMIT 500`,
  )).rows));
}));

portal.get('/maintenance/:id/evidence', evidenceAccess, h(async (req, res) => {
  res.json(await withUser(req.user!, async (client) => (await client.query(
    `SELECT e.id,e.maintenance_request_id,e.mime,e.size_bytes,e.uploaded_by,e.created_at
     FROM maintenance_evidence e
     WHERE e.maintenance_request_id=$1 AND e.scan_status='clean'
     ORDER BY e.created_at,e.id`,
    [req.params.id],
  )).rows));
}));

portal.post('/maintenance/vendor/:id/accept', vendorOnly, h(async (req, res) => {
  const body = z.object({ note: z.string().trim().min(5).max(500) }).strict().parse(req.body);
  const row = await withUser(req.user!, async (client) => {
    const current = (await client.query(
      `SELECT m.* FROM maintenance_requests m
       WHERE m.id=$1 AND ${vendorAssignment} FOR UPDATE OF m`,
      [req.params.id, req.user!.id],
    )).rows[0];
    if (!current) throw new HttpError(404, 'Assigned maintenance request not found');
    if (current.status !== 'assigned') throw new HttpError(409, 'Maintenance request is not awaiting vendor acceptance');
    const updated = (await client.query(
      `UPDATE maintenance_requests SET status='accepted',accepted_by=$2,accepted_at=now(),
         resolution_note=$3,updated_at=now() WHERE id=$1 RETURNING *`,
      [current.id, req.user!.id, body.note],
    )).rows[0];
    await client.query(
      `INSERT INTO maintenance_request_events(maintenance_request_id,actor_id,event_type,from_status,to_status,note)
       VALUES($1,$2,'accepted','assigned','accepted',$3)`,
      [current.id, req.user!.id, body.note],
    );
    await audit(client, req.user!.id, 'maintenance_vendor_accepted', 'maintenance', current.id,
      { status: current.status }, { status: updated.status });
    return updated;
  });
  res.json(row);
}));

portal.post('/maintenance/vendor/:id/start', vendorOnly, h(async (req, res) => {
  const body = z.object({ note: z.string().trim().min(5).max(1000) }).strict().parse(req.body);
  const row = await withUser(req.user!, async (client) => {
    const current = (await client.query(
      `SELECT m.* FROM maintenance_requests m
       WHERE m.id=$1 AND ${vendorAssignment} FOR UPDATE OF m`,
      [req.params.id, req.user!.id],
    )).rows[0];
    if (!current) throw new HttpError(404, 'Assigned maintenance request not found');
    if (!['accepted','rework_required'].includes(current.status)) {
      throw new HttpError(409, 'Only accepted or returned work can be started');
    }
    const updated = (await client.query(
      `UPDATE maintenance_requests SET status='in_progress',resolution_note=$2,updated_at=now()
       WHERE id=$1 RETURNING *`,
      [current.id, body.note],
    )).rows[0];
    await client.query(
      `INSERT INTO maintenance_request_events(maintenance_request_id,actor_id,event_type,from_status,to_status,note)
       VALUES($1,$2,'in_progress',$3,'in_progress',$4)`,
      [current.id, req.user!.id, current.status, body.note],
    );
    await audit(client, req.user!.id, 'maintenance_vendor_work_started', 'maintenance', current.id,
      { status: current.status }, { status: updated.status });
    return updated;
  });
  res.json(row);
}));

const uploadMaintenanceEvidence = h(async (req, res) => {
  const buffer = req.body as Buffer;
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new HttpError(400, 'Choose an evidence image');
  if (buffer.length > 10 * 1024 * 1024) throw new HttpError(413, 'Evidence images must be 10 MB or smaller');
  const mime = sniff(buffer);
  if (mime !== 'image/jpeg' && mime !== 'image/png') throw new HttpError(415, 'Evidence must be a JPEG or PNG image');
  if (!isClamAvConfigured()) throw new HttpError(503, 'Evidence upload is unavailable until the malware scanner is configured');
  let scanResult: 'clean' | 'infected';
  try {
    scanResult = await scanWithClamAv(buffer);
  } catch (error) {
    console.error('Maintenance evidence malware scan failed', error instanceof Error ? error.message : error);
    throw new HttpError(503, 'Evidence upload is unavailable because the malware scan could not be completed');
  }
  if (scanResult !== 'clean') throw new HttpError(422, 'The evidence image was rejected by the malware scanner');

  const row = await withUser(req.user!, async (client) => {
    const maintenance = (await client.query(
      `SELECT m.id,m.status FROM maintenance_requests m WHERE m.id=$1 FOR UPDATE`,
      [req.params.id],
    )).rows[0];
    if (!maintenance) throw new HttpError(404, 'Maintenance request not found');
    const permittedStatuses = req.user!.role === 'property_vendor'
      ? ['accepted','in_progress','rework_required']
      : req.user!.role === 'field_agent'
        ? ['assigned','in_progress','rework_required']
        : ['open','triaged','assigned','in_progress'];
    if (!permittedStatuses.includes(maintenance.status)) {
      throw new HttpError(409, 'Evidence cannot be added in the current maintenance status');
    }
    const storageKey = randomUUID();
    const digest = createHash('sha256').update(buffer).digest('hex');
    const evidence = (await client.query(
      `INSERT INTO maintenance_evidence
         (maintenance_request_id,storage_key,sha256,mime,size_bytes,scan_status,uploaded_by)
       VALUES($1,$2,$3,$4,$5,'clean',$6)
       RETURNING id,maintenance_request_id,sha256,mime,size_bytes,uploaded_by,created_at`,
      [maintenance.id, storageKey, digest, mime, buffer.length, req.user!.id],
    )).rows[0];
    await putFile(storageKey, buffer);
    await audit(client, req.user!.id, 'maintenance_evidence_uploaded', 'maintenance', maintenance.id, null, {
      evidence_id: evidence.id, sha256: digest, mime, size_bytes: buffer.length,
    });
    return evidence;
  });
  res.status(201).json(row);
});
portal.post('/maintenance/vendor/:id/evidence', vendorOnly, uploadMaintenanceEvidence);
portal.post('/maintenance/:id/evidence', evidenceAccess, uploadMaintenanceEvidence);

portal.get('/maintenance/evidence/:evidenceId/file', h(async (req, res) => {
  const evidence = await withUser(req.user!, async (client) => (await client.query(
    `SELECT e.id,e.storage_key,e.mime,e.maintenance_request_id
     FROM maintenance_evidence e WHERE e.id=$1 AND e.scan_status='clean'`,
    [req.params.evidenceId],
  )).rows[0]);
  if (!evidence) throw new HttpError(404, 'Maintenance evidence not found');
  const buffer = await getFile(evidence.storage_key);
  res.set({
    'Content-Type': evidence.mime,
    'Content-Disposition': 'attachment',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  }).send(buffer);
}));

portal.post('/maintenance/vendor/:id/complete', vendorOnly, h(async (req, res) => {
  const body = z.object({
    idempotency_key: z.string().uuid(),
    resolution_note: z.string().trim().min(5).max(1000),
  }).strict().parse(req.body);
  const payloadHash = createHash('sha256').update(body.resolution_note).digest('hex');
  const result = await withUser(req.user!, async (client) => {
    const replay = (await client.query(
      `SELECT m.* FROM maintenance_requests m
       WHERE m.completion_idempotency_key=$1 AND ${vendorAssignment}`,
      [body.idempotency_key, req.user!.id],
    )).rows[0];
    if (replay) {
      if (replay.completion_payload_hash !== payloadHash) {
        throw new HttpError(409, 'Completion key was already used for different work evidence');
      }
      return { row: replay, replayed: true };
    }
    const current = (await client.query(
      `SELECT m.* FROM maintenance_requests m
       WHERE m.id=$1 AND ${vendorAssignment} FOR UPDATE OF m`,
      [req.params.id, req.user!.id],
    )).rows[0];
    if (!current) throw new HttpError(404, 'Assigned maintenance request not found');
    if (!['in_progress','rework_required'].includes(current.status)) {
      throw new HttpError(409, 'Only in-progress or returned work can be submitted for review');
    }
    const evidence = await client.query(
      `SELECT 1 FROM maintenance_evidence
       WHERE maintenance_request_id=$1 AND uploaded_by=$2 AND scan_status='clean' LIMIT 1`,
      [current.id, req.user!.id],
    );
    if (!evidence.rowCount) throw new HttpError(422, 'Upload at least one malware-scanned completion photo before submitting work');
    const updated = (await client.query(
      `UPDATE maintenance_requests SET status='awaiting_review',resolution_note=$2,
         completion_submitted_by=$3,completion_submitted_at=now(),
         completion_idempotency_key=$4,completion_payload_hash=$5,review_note=NULL,
         reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
       WHERE id=$1 RETURNING *`,
      [current.id, body.resolution_note, req.user!.id, body.idempotency_key, payloadHash],
    )).rows[0];
    await client.query(
      `INSERT INTO maintenance_request_events(maintenance_request_id,actor_id,event_type,from_status,to_status,note)
       VALUES($1,$2,'awaiting_review',$3,'awaiting_review',$4)`,
      [current.id, req.user!.id, current.status, body.resolution_note],
    );
    await audit(client, req.user!.id, 'maintenance_vendor_completion_submitted', 'maintenance', current.id,
      { status: current.status }, { status: updated.status, idempotency_key: body.idempotency_key });
    return { row: updated, replayed: false };
  });
  res.status(result.replayed ? 200 : 201).json({ ...result.row, replayed: result.replayed });
}));

portal.post('/maintenance/vendor/:id/additional-cost', vendorOnly, h(async (req, res) => {
  const body = z.object({
    amount: z.number().positive().finite(),
    rationale: z.string().trim().min(10).max(1000),
  }).strict().parse(req.body);
  const amountInCents = Math.round(body.amount * 100);
  if (Math.abs(body.amount * 100 - amountInCents) > 1e-7 || !Number.isSafeInteger(amountInCents)) {
    throw new HttpError(422, 'Enter an amount with at most two decimal places');
  }
  const row = await withUser(req.user!, async (client) => {
    const maintenance = (await client.query(
      `SELECT m.id,m.status,m.assigned_vendor_id FROM maintenance_requests m
       WHERE m.id=$1 AND ${vendorAssignment} FOR UPDATE OF m`,
      [req.params.id, req.user!.id],
    )).rows[0];
    if (!maintenance) throw new HttpError(404, 'Assigned maintenance request not found');
    if (!['accepted','in_progress','rework_required'].includes(maintenance.status)) {
      throw new HttpError(409, 'Additional cost must be requested before completion');
    }
    const request = (await client.query(
      `INSERT INTO maintenance_cost_change_requests
         (maintenance_request_id,vendor_id,amount,rationale,requested_by)
       VALUES($1,$2,$3,$4,$5) RETURNING *`,
      [maintenance.id, maintenance.assigned_vendor_id, (amountInCents / 100).toFixed(2), body.rationale, req.user!.id],
    )).rows[0];
    await audit(client, req.user!.id, 'maintenance_additional_cost_requested', 'maintenance_cost_change', request.id, null, {
      maintenance_request_id: maintenance.id, amount: request.amount,
    });
    return request;
  });
  res.status(201).json(row);
}));

portal.get('/maintenance/vendor/additional-cost/pending', requireRole('finance_manager','super_admin','global_admin'), h(async (_req, res) => {
  res.json(await withUser(_req.user!, async (client) => (await client.query(
    `SELECT c.*,vendor.name AS vendor_name,m.property_id,m.description
     FROM maintenance_cost_change_requests c
     JOIN property_vendors vendor ON vendor.id=c.vendor_id
     JOIN maintenance_requests m ON m.id=c.maintenance_request_id
     WHERE c.status='pending' ORDER BY c.created_at,c.id LIMIT 200`,
  )).rows));
}));

portal.post('/maintenance/vendor/additional-cost/:id/decision', requireRole('finance_manager','super_admin','global_admin'), h(async (req, res) => {
  const body = z.object({
    decision: z.enum(['approve','reject']),
    reason: z.string().trim().min(10).max(1000),
  }).strict().parse(req.body);
  const updated = await withUser(req.user!, async (client) => {
    const request = (await client.query(
      `SELECT * FROM maintenance_cost_change_requests WHERE id=$1 FOR UPDATE`,
      [req.params.id],
    )).rows[0];
    if (!request) throw new HttpError(404, 'Additional-cost request not found');
    if (request.status !== 'pending') throw new HttpError(409, 'Additional-cost request is no longer pending');
    if (request.requested_by === req.user!.id) throw new HttpError(403, 'The requester cannot approve their additional-cost request');
    const status = body.decision === 'approve' ? 'approved' : 'rejected';
    if (status === 'approved') {
      await client.query(
        `UPDATE maintenance_requests SET cost=COALESCE(cost,0)+$2,updated_at=now()
         WHERE id=$1`,
        [request.maintenance_request_id, request.amount],
      );
    }
    const row = (await client.query(
      `UPDATE maintenance_cost_change_requests
       SET status=$2,decision_reason=$3,decided_by=$4,decided_at=now()
       WHERE id=$1 RETURNING *`,
      [request.id, status, body.reason, req.user!.id],
    )).rows[0];
    await audit(client, req.user!.id, `maintenance_additional_cost_${status}`, 'maintenance_cost_change', request.id,
      { status: 'pending' }, { status, reason: body.reason, amount: request.amount });
    return row;
  });
  res.json(updated);
}));

portal.post('/maintenance/vendor/:id/invoice', vendorOnly, h(async (req, res) => {
  const body = z.object({
    invoice_reference: z.string().trim().min(1).max(160),
    amount: z.coerce.number().positive().finite(),
    invoice_date: z.string().date(),
    due_date: z.string().date(),
  }).strict().parse(req.query);
  if (body.due_date < body.invoice_date) throw new HttpError(422, 'Invoice due date must be on or after invoice date');
  const buffer = req.body as Buffer;
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new HttpError(400, 'Choose the invoice evidence file');
  if (buffer.length > 10 * 1024 * 1024) throw new HttpError(413, 'Invoice evidence must be 10 MB or smaller');
  const mime = sniff(buffer);
  if (!mime) throw new HttpError(415, 'Invoice evidence must be a PDF, JPEG, or PNG file');
  if (!isClamAvConfigured()) throw new HttpError(503, 'Invoice submission is unavailable until the malware scanner is configured');
  try {
    if (await scanWithClamAv(buffer) !== 'clean') throw new HttpError(422, 'Invoice evidence was rejected by the malware scanner');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error('Maintenance invoice malware scan failed', error instanceof Error ? error.message : error);
    throw new HttpError(503, 'Invoice submission is unavailable because the malware scan could not be completed');
  }

  const amountCents = Math.round(body.amount * 100);
  if (!Number.isSafeInteger(amountCents) || Math.abs(body.amount * 100 - amountCents) > 1e-7) {
    throw new HttpError(422, 'Enter an invoice amount with at most two decimal places');
  }
  const result = await withUser(req.user!, async (client) => {
    const maintenance = (await client.query(
      `SELECT m.id,m.status,m.assigned_vendor_id,COALESCE(m.cost,0)::numeric(14,2)::text AS approved_amount
       FROM maintenance_requests m
       WHERE m.id=$1 AND ${vendorAssignment} FOR UPDATE OF m`,
      [req.params.id, req.user!.id],
    )).rows[0];
    if (!maintenance) throw new HttpError(404, 'Assigned maintenance request not found');
    if (!['completed','done'].includes(maintenance.status)) {
      throw new HttpError(409, 'Vendor invoices may only be submitted for completed work');
    }
    const expectedCents = Math.round(Number(maintenance.approved_amount) * 100);
    const varianceCents = amountCents - expectedCents;
    const matchStatus = varianceCents === 0 ? 'matched' : 'mismatch';
    const storageKey = randomUUID();
    const digest = createHash('sha256').update(buffer).digest('hex');
    const bill = (await client.query(
      `INSERT INTO property_vendor_bills
         (maintenance_request_id,vendor_id,invoice_reference,amount,invoice_date,due_date,
          recorded_by,expected_amount,match_status,match_variance,evidence_storage_key,
          evidence_sha256,evidence_mime,evidence_size_bytes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [maintenance.id, maintenance.assigned_vendor_id, body.invoice_reference, (amountCents / 100).toFixed(2),
        body.invoice_date, body.due_date, req.user!.id, maintenance.approved_amount, matchStatus,
        (varianceCents / 100).toFixed(2), storageKey, digest, mime, buffer.length],
    )).rows[0];
    await putFile(storageKey, buffer);
    await audit(client, req.user!.id, 'property_vendor_invoice_submitted', 'property_vendor_bill', bill.id, null, {
      maintenance_request_id: maintenance.id, match_status: matchStatus, variance: bill.match_variance,
    });
    return bill;
  });
  res.status(201).json(result);
}));

portal.get('/maintenance/vendor/invoices/mismatches', requireRole('finance_manager','super_admin','global_admin'), h(async (_req, res) => {
  res.json(await withUser(_req.user!, async (client) => (await client.query(
    `SELECT bill.id,bill.maintenance_request_id,bill.vendor_id,vendor.name AS vendor_name,
       bill.invoice_reference,bill.amount,bill.expected_amount,bill.match_variance,
       bill.match_status,bill.created_at
     FROM property_vendor_bills bill
     JOIN property_vendors vendor ON vendor.id=bill.vendor_id
     WHERE bill.match_status='mismatch' AND bill.status='pending_approval'
     ORDER BY bill.created_at,bill.id LIMIT 200`,
  )).rows));
}));

portal.post('/maintenance/vendor/invoices/:id/resolve-mismatch', requireRole('finance_manager','super_admin','global_admin'), h(async (req, res) => {
  const body = z.object({ reason: z.string().trim().min(10).max(1000) }).strict().parse(req.body);
  const row = await withUser(req.user!, async (client) => {
    const bill = (await client.query('SELECT * FROM property_vendor_bills WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
    if (!bill) throw new HttpError(404, 'Vendor invoice not found');
    if (bill.status !== 'pending_approval' || bill.match_status !== 'mismatch') {
      throw new HttpError(409, 'Only a pending mismatch can be resolved');
    }
    if (bill.recorded_by === req.user!.id) throw new HttpError(403, 'The invoice submitter cannot resolve the mismatch');
    const updated = (await client.query(
      `UPDATE property_vendor_bills
       SET match_status='accepted_exception',match_reviewed_by=$2,match_reviewed_at=now(),match_review_reason=$3
       WHERE id=$1 RETURNING *`,
      [bill.id, req.user!.id, body.reason],
    )).rows[0];
    await audit(client, req.user!.id, 'property_vendor_invoice_mismatch_resolved', 'property_vendor_bill', bill.id,
      { match_status: 'mismatch' }, { match_status: updated.match_status, reason: body.reason });
    return updated;
  });
  res.json(row);
}));

export const propertyVendorPortal = portal;
