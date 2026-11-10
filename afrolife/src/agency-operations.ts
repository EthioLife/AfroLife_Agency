import { createHash, randomUUID } from 'node:crypto';
import express, { Router } from 'express';
import { z } from 'zod';
import { withUser, requireRole, HttpError } from './core.js';
import { audit, feeSnapshot, loadRules, post, transition } from './domain.js';
import { notify } from './notify.js';
import { enqueueAccountingEvent } from './accounting-outbox.js';
import { sniff } from './files.js';
import { getFile, putFile } from './storage.js';
import { Phone } from './validators.js';
import { requireMiniAppAccess } from './mini-app-access.js';
import { AGENT, h } from './supply-common.js';

const STAFF = ['global_admin', 'super_admin', 'compliance', 'finance', 'finance_manager'];

export function createAgencyOperationsRouter(): Router {
  const router = Router();

  // ---- Leads (row-level security limits what each agent can see) ----
  router.post('/leads', requireRole(...AGENT), h(async (req, res) => {
    const b = z.object({ lead_type: z.enum(['household', 'business', 'worker', 'property']), name: z.string().min(2), phone: Phone }).parse(req.body);
    const row = await withUser(req.user!, async (c) => {
      const protection = await c.query("SELECT value FROM config_rules WHERE key='lead_protection_days'");
      const days = Number(protection.rows[0]?.value ?? 90);
      if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error('Lead protection rule is invalid');
      const r = await c.query(
        'INSERT INTO leads (lead_type, name, phone, source_agent_id, protected_until) VALUES ($1,$2,$3,$4,now()+make_interval(days => $5)) RETURNING *',
        [b.lead_type, b.name, b.phone, req.user!.id, days],
      );
      await audit(c, req.user!.id, 'lead_created', 'lead', r.rows[0].id, null, { ...b, protected_until: r.rows[0].protected_until });
      return r.rows[0];
    });
    res.status(201).json(row);
  }));

  router.get('/leads', h(async (req, res) => {
    res.json(await withUser(req.user!, async (c) => (await c.query('SELECT * FROM leads ORDER BY created_at DESC LIMIT 200')).rows));
  }));

  router.patch('/leads/:id/status', requireRole(...AGENT), h(async (req, res) => {
    const body = z.object({
      status: z.enum(['qualified', 'lost']),
      reason: z.string().trim().min(10).max(1000),
    }).strict().parse(req.body);
    const lead = await withUser(req.user!, async (c) => {
      const current = (await c.query('SELECT * FROM leads WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
      if (!current) throw new HttpError(404, 'Lead not found');
      const allowed = current.status === 'new'
        ? ['qualified', 'lost'].includes(body.status)
        : current.status === 'qualified' && body.status === 'lost';
      if (!allowed) throw new HttpError(409, `A ${current.status} lead cannot be changed to ${body.status}`);
      const updated = (await c.query(
        'UPDATE leads SET status=$2 WHERE id=$1 RETURNING *',
        [current.id, body.status],
      )).rows[0];
      await audit(c, req.user!.id, 'lead_status_changed', 'lead', current.id,
        { status: current.status }, { status: updated.status, reason: body.reason });
      return updated;
    });
    res.json(lead);
  }));

  router.get('/leads/:id/attribution-history', h(async (req, res) => {
    const events = await withUser(req.user!, async (c) => {
      const lead = await c.query('SELECT id FROM leads WHERE id=$1', [req.params.id]);
      if (!lead.rowCount) throw new HttpError(404, 'Lead not found');
      return (await c.query(
        `SELECT prior_agent_id,new_agent_id,actor_id,event_type,reason,created_at
         FROM lead_attribution_history WHERE lead_id=$1 ORDER BY created_at,id`, [req.params.id],
      )).rows;
    });
    res.json(events);
  }));

  router.post('/admin/leads/:id/reassign', requireMiniAppAccess('leads'), requireRole('global_admin'), h(async (req, res) => {
    const body = z.object({ target_agent_id: z.string().uuid(), reason: z.string().trim().min(10).max(1000) }).strict().parse(req.body);
    const lead = await withUser(req.user!, async (c) => {
      const current = (await c.query('SELECT * FROM leads WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
      if (!current) throw new HttpError(404, 'Lead not found');
      if (!['new','qualified','lost'].includes(current.status)) throw new HttpError(409, 'Converted leads cannot be reassigned');
      const contract = await c.query('SELECT lead_has_non_cancelled_contract($1) AS has_contract', [current.id]);
      if (contract.rows[0].has_contract) throw new HttpError(409, 'A lead with a non-cancelled contract cannot be reassigned');
      const target = await c.query(
        `SELECT a.id FROM agents a JOIN users u ON u.id=a.id
         WHERE a.id=$1 AND u.active AND u.role IN ('master_agent','field_agent')`, [body.target_agent_id],
      );
      if (!target.rowCount) throw new HttpError(422, 'Choose an active master or field agent');
      if (current.source_agent_id === body.target_agent_id) throw new HttpError(409, 'Lead already belongs to this agent');
      const protection = await c.query("SELECT value FROM config_rules WHERE key='lead_protection_days'");
      const days = Number(protection.rows[0]?.value ?? 90);
      if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error('Lead protection rule is invalid');
      await c.query("SELECT set_config('app.lead_reassignment_reason',$1,true)", [body.reason]);
      const updated = (await c.query(
        'UPDATE leads SET source_agent_id=$2,protected_until=now()+make_interval(days => $3) WHERE id=$1 RETURNING *',
        [current.id, body.target_agent_id, days],
      )).rows[0];
      await audit(c, req.user!.id, 'lead_reassigned', 'lead', current.id,
        { source_agent_id: current.source_agent_id, protected_until: current.protected_until },
        { source_agent_id: updated.source_agent_id, protected_until: updated.protected_until, reason: body.reason });
      return updated;
    });
    res.json(lead);
  }));

  // ---- Contracts ----
  router.post('/leads/:id/contracts', requireRole(...AGENT, 'super_admin', 'global_admin'), h(async (req, res) => {
    const b = z.object({ track: z.enum(['A', 'B']), base_value: z.number().positive() }).parse(req.body);
    const row = await withUser(req.user!, async (c) => {
      const l = (await c.query('SELECT * FROM leads WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
      if (!l) throw new HttpError(404, 'Lead not found');
      if (!['new', 'qualified'].includes(l.status)) throw new HttpError(409, `Lead is already ${l.status}`);
      const f = feeSnapshot(b.track, b.base_value, await loadRules(c));
      const r = await c.query(
        `INSERT INTO contracts (contract_no, lead_id, source_agent_id, track, base_value, onboarding_amt, guarantee_amt, monthly_mgmt_amt, employer_fee_amt, other_fee_amt)
         VALUES ('C-' || lpad(nextval('contract_seq')::text, 6, '0'), $1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [l.id, l.source_agent_id, b.track, b.base_value, f.onboarding_amt, f.guarantee_amt, f.monthly_mgmt_amt, f.employer_fee_amt, f.other_fee_amt],
      );
      await c.query("UPDATE leads SET status = 'converted' WHERE id = $1", [l.id]);
      await audit(c, req.user!.id, 'contract_created', 'contract', r.rows[0].id, null, { ...b, ...f });
      return r.rows[0];
    });
    res.status(201).json(row);
  }));

  router.get('/contracts', h(async (req, res) => {
    res.json(await withUser(req.user!, async (c) => (await c.query(
      `SELECT k.*,
         COALESCE((SELECT jsonb_agg(jsonb_build_object('id',d.id,'document_stage',d.document_stage,'mime',d.mime,'size_bytes',d.size_bytes,'uploaded_by',d.uploaded_by,'uploader_role',u.role,'created_at',d.created_at) ORDER BY d.created_at DESC)
                   FROM contract_documents d JOIN users u ON u.id = d.uploaded_by WHERE d.contract_id = k.id), '[]'::jsonb) AS documents,
         (SELECT jsonb_build_object('signed_by',s.signed_by,'signer_name',u.legal_name,'signer_role',s.signer_role,'signed_at',s.signed_at)
          FROM contract_signatures s JOIN users u ON u.id = s.signed_by WHERE s.contract_id = k.id) AS signature
       FROM contracts k ORDER BY k.created_at DESC LIMIT 200`,
    )).rows));
  }));

  // Agent supplied contract files stay in private storage and are available only within the contract's RLS scope.
  router.post('/contracts/:id/documents', requireRole(...AGENT, 'super_admin', 'global_admin', 'corporate_business_manager'), express.raw({ type: () => true, limit: '10mb' }), h(async (req, res) => {
    const { stage } = z.object({ stage: z.enum(['party_signed', 'company_countersigned']) }).parse(req.query);
    const agentUploader = AGENT.includes(req.user!.role);
    if ((stage === 'party_signed' && !agentUploader) || (stage === 'company_countersigned' && !['global_admin', 'super_admin', 'corporate_business_manager'].includes(req.user!.role))) {
      throw new HttpError(403, 'Your role cannot upload this contract document stage');
    }
    const buf = req.body as Buffer;
    if (!Buffer.isBuffer(buf) || buf.length === 0) throw new HttpError(400, 'No file received');
    const mime = sniff(buf);
    if (!mime) throw new HttpError(415, 'Only PDF, JPEG or PNG files are accepted');
    const row = await withUser(req.user!, async (c) => {
      const contract = (await c.query('SELECT id, state FROM contracts WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
      if (!contract) throw new HttpError(404, 'Contract not found');
      if (contract.state !== 'signature_pending') throw new HttpError(409, 'Contract documents can be uploaded while awaiting signature');
      if (stage === 'company_countersigned') {
        const partySigned = await c.query(
          "SELECT 1 FROM contract_documents WHERE contract_id=$1 AND document_stage='party_signed' LIMIT 1",
          [contract.id],
        );
        if (!partySigned.rowCount) throw new HttpError(409, 'The agent must upload the party-signed contract first');
      }
      const key = randomUUID();
      const result = await c.query(
        `INSERT INTO contract_documents (contract_id, document_stage, storage_key, sha256, mime, size_bytes, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, document_stage, mime, size_bytes, created_at`,
        [contract.id, stage, key, createHash('sha256').update(buf).digest('hex'), mime, buf.length, req.user!.id],
      );
      await putFile(key, buf);
      await audit(c, req.user!.id, 'contract_document_uploaded', 'contract', contract.id, null, { document_id: result.rows[0].id, mime, size_bytes: buf.length });
      return result.rows[0];
    });
    res.status(201).json(row);
  }));

  router.get('/contract-documents/:id/file', h(async (req, res) => {
    const document = await withUser(req.user!, async (c) => (await c.query(
      'SELECT id, contract_id, storage_key, mime FROM contract_documents WHERE id = $1', [req.params.id],
    )).rows[0]);
    if (!document) throw new HttpError(404, 'Contract document not found');
    const file = await getFile(document.storage_key);
    res.set({ 'Content-Type': document.mime, 'Content-Disposition': 'attachment', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' }).send(file);
  }));

  router.post('/contracts/:id/transition', h(async (req, res) => {
    const { action } = z.object({ action: z.string() }).parse(req.body);
    res.json(await withUser(req.user!, (c) => transition(c, req.user!, String(req.params.id), action, req.body)));
  }));

  router.post('/contracts/:id/renew', requireRole('super_admin', 'global_admin'), h(async (req, res) => {
    const row = await withUser(req.user!, async (c) => {
      const o = (await c.query("SELECT * FROM contracts WHERE id = $1 AND state = 'active'", [req.params.id])).rows[0];
      if (!o) throw new HttpError(404, 'Active contract not found');
      const r = await c.query(
        `INSERT INTO contracts (contract_no, lead_id, source_agent_id, track, is_renewal, base_value, onboarding_amt, guarantee_amt, monthly_mgmt_amt, employer_fee_amt, other_fee_amt)
         VALUES ('C-' || lpad(nextval('contract_seq')::text, 6, '0'), $1,$2,$3,true,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [o.lead_id, o.source_agent_id, o.track, o.base_value, o.onboarding_amt, o.guarantee_amt, o.monthly_mgmt_amt, o.employer_fee_amt, o.other_fee_amt],
      );
      await audit(c, req.user!.id, 'renewal_created', 'contract', r.rows[0].id, null, { from: o.id });
      return r.rows[0];
    });
    res.status(201).json(row);
  }));

  // ---- Invoices (staff only) ----
  router.get('/invoices', requireMiniAppAccess('commissions'), requireRole(...STAFF), h(async (req, res) => {
    res.json(await withUser(req.user!, async (c) => (await c.query('SELECT * FROM invoices ORDER BY due_on DESC LIMIT 200')).rows));
  }));

  // ---- Commissions (finance approves; super admin pays; nothing is edited in place) ----
  router.get('/commissions', h(async (req, res) => {
    const all = STAFF.includes(req.user!.role);
    res.json(await withUser(req.user!, async (c) => (await c.query(
      all ? `SELECT e.*, u.legal_name AS agent_name, k.contract_no
             FROM commission_events e JOIN users u ON u.id=e.agent_id JOIN contracts k ON k.id=e.contract_id
             ORDER BY e.created_at DESC LIMIT 200`
          : `SELECT e.*, u.legal_name AS agent_name, k.contract_no
             FROM commission_events e JOIN users u ON u.id=e.agent_id JOIN contracts k ON k.id=e.contract_id
             WHERE e.agent_id = $1 OR e.agent_id IN (SELECT id FROM agents WHERE parent_id = $1)
             ORDER BY e.created_at DESC LIMIT 200`,
      all ? [] : [req.user!.id],
    )).rows));
  }));

  router.post('/commissions/:id/approve', requireRole('finance', 'finance_manager'), h(async (req, res) => {
    res.json(await withUser(req.user!, async (c) => {
      const k = (await c.query('SELECT * FROM commission_events WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
      if (!k) throw new HttpError(404, 'Commission not found');
      if (k.status !== 'qualified') throw new HttpError(409, `Commission is ${k.status}`);
      if (k.qualified_by === req.user!.id) throw new HttpError(403, 'A different user must approve (four-eyes rule)');
      const r = await c.query("UPDATE commission_events SET status='approved', approved_by=$2 WHERE id=$1 RETURNING *", [k.id, req.user!.id]);
      await audit(c, req.user!.id, 'commission_approved', 'commission', k.id);
      await notify(c, k.agent_id, 'commission_approved', { amount: k.amount });
      return r.rows[0];
    }));
  }));

  router.post('/commissions/:id/pay', requireRole('super_admin', 'global_admin'), h(async (req, res) => {
    const b = z.object({ reference: z.string().trim().min(3).max(200) }).strict().parse(req.body);
    res.json(await withUser(req.user!, async (c) => {
      const k = (await c.query('SELECT * FROM commission_events WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
      if (!k) throw new HttpError(404, 'Commission not found');
      if (k.status !== 'approved') throw new HttpError(409, `Commission is ${k.status}; approve it first`);
      if (!k.approved_by || k.approved_by === req.user!.id) throw new HttpError(409, 'Commission payout requires a different finance approver');
      const amt = Math.round((Number(k.amount) - Number(k.held_amount ?? 0)) * 100) / 100;
      if (amt > 0) await post(c, 'commission', k.id, [['Commission Payable', amt, 0], ['Cash', 0, amt]]);
      if (amt > 0) await enqueueAccountingEvent(c, {
        source_entity_id: k.agent_id,
        entry_date: (await c.query('SELECT current_date::text AS entry_date')).rows[0].entry_date,
        source_reference: `agency-commission-payment:${k.id}`,
        description: `Agency commission payment for contract ${k.contract_id}`,
        lines: [
          { source_account_code: 'Commission Payable', debit: amt.toFixed(2), credit: '0.00' },
          { source_account_code: 'Cash', debit: '0.00', credit: amt.toFixed(2) },
        ],
        maker_id: req.user!.id,
        checker_id: k.approved_by,
        checker_reason: `Commission payment approved by finance; payment reference ${b.reference}`,
      });
      const r = await c.query("UPDATE commission_events SET status='paid', paid_ref=$2 WHERE id=$1 RETURNING *", [k.id, amt > 0 ? b.reference : null]);
      await audit(c, req.user!.id, 'commission_paid', 'commission', k.id, null, { reference: amt > 0 ? b.reference : null, amount: amt, held_amount: k.held_amount ?? 0 });
      await notify(c, k.agent_id, 'commission_paid', { amount: amt });
      return r.rows[0];
    }));
  }));

  router.post('/commissions/:id/release-held', requireRole('super_admin', 'global_admin'), h(async (req, res) => {
    const b = z.object({ reference: z.string().trim().min(3).max(200) }).strict().parse(req.body);
    res.json(await withUser(req.user!, async (c) => {
      const k = (await c.query('SELECT * FROM commission_events WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
      if (!k) throw new HttpError(404, 'Commission not found');
      if (k.held_status !== 'held' || Number(k.held_amount) <= 0) throw new HttpError(409, 'This commission has no held amount to release.');
      if (k.holdback_release_on > new Date().toISOString().slice(0, 10)) throw new HttpError(409, `The held commission is available after ${k.holdback_release_on}.`);
      if (k.status === 'approved' && Number(k.amount) > Number(k.held_amount)) throw new HttpError(409, 'Pay the approved commission installment before releasing the holdback.');
      if (!['approved', 'paid'].includes(k.status)) throw new HttpError(409, `Commission is ${k.status}; approve it first.`);
      if (!k.approved_by || k.approved_by === req.user!.id) throw new HttpError(409, 'Holdback payout requires a different finance approver');
      const amount = Number(k.held_amount);
      await post(c, 'commission_holdback', k.id, [['Commission Held Payable', amount, 0], ['Cash', 0, amount]]);
      await enqueueAccountingEvent(c, {
        source_entity_id: k.agent_id,
        entry_date: (await c.query('SELECT current_date::text AS entry_date')).rows[0].entry_date,
        source_reference: `agency-commission-holdback-payment:${k.id}`,
        description: `Agency commission holdback payment for contract ${k.contract_id}`,
        lines: [
          { source_account_code: 'Commission Held Payable', debit: amount.toFixed(2), credit: '0.00' },
          { source_account_code: 'Cash', debit: '0.00', credit: amount.toFixed(2) },
        ],
        maker_id: req.user!.id,
        checker_id: k.approved_by,
        checker_reason: `Commission holdback release approved by finance; payment reference ${b.reference}`,
      });
      const result = await c.query("UPDATE commission_events SET held_status='released', held_paid_ref=$2, status='paid' WHERE id=$1 RETURNING *", [k.id, b.reference]);
      await audit(c, req.user!.id, 'commission_holdback_released', 'commission', k.id, { held_status: k.held_status, amount }, { held_status: 'released', reference: b.reference });
      await notify(c, k.agent_id, 'commission_paid', { amount });
      return result.rows[0];
    }));
  }));

  return router;
}
