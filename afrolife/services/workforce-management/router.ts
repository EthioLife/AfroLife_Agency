import express, { Router } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { pool, withUser, requireActivity, requireRole, HttpError, isPlatformAdminRole } from '../../src/core.js';
import { sniff, sniffListingMedia } from '../../src/files.js';
import { isClamAvConfigured, scanWithClamAv } from '../../src/clamav.js';
import { getFile, putFile } from '../../src/storage.js';
import { notify } from '../../src/notify.js';
import { audit, loadRules } from '../../src/domain.js';
import { matchingTuningFromRules, scoreMatch, weightsFromRules } from '../../src/matching.js';
import { Phone } from '../../src/validators.js';
import { h, AGENT, num, requireListingPlan } from '../../src/supply-common.js';
import { workforceOperations } from '../../src/workforce-operations.js';

export const router = Router();
router.use(workforceOperations);
// ================= Worker management =================
const WorkerIn = z.object({
  name: z.string().trim().min(2).max(200), phone: Phone, national_id: z.string().trim().min(5).max(100).optional(),
  sector: z.string().trim().min(2).max(100),
  skills: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  languages: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  experience_years: z.number().int().min(0).default(0), rate_expected: z.number().nonnegative(),
  availability: z.enum(['immediate', 'within_2_weeks', 'later', 'unavailable']).default('immediate'),
  territory_id: z.number().int().positive(),
});

router.post('/workers', requireActivity('workforce.workers.register'), h(async (req, res) => {
  const b = WorkerIn.parse(req.body);
  const row = await withUser(req.user!, async (c) => {
    const r = await c.query(
      `INSERT INTO workers (name, phone, national_id, sector, skills, languages, experience_years, rate_expected, availability, territory_id, source_agent_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, name, phone, sector, skills, languages, experience_years, rate_expected,
                 availability, verification, territory_id, source_agent_id, created_at`,
      [b.name, b.phone, b.national_id ?? null, b.sector, b.skills, b.languages, b.experience_years, b.rate_expected, b.availability, b.territory_id, req.user!.id],
    );
    await audit(c, req.user!.id, 'worker_created', 'worker', r.rows[0].id, null, { name: b.name, sector: b.sector });
    return r.rows[0];
  });
  res.status(201).json(row);
}));
router.get('/workers', requireActivity('workforce.workers.view'), h(async (req, res) => {
  res.json(await withUser(req.user!, async (c) => (await c.query(
    `SELECT w.id, w.name, w.phone, w.sector, w.skills, w.languages, w.experience_years, w.rate_expected,
            w.availability,
            CASE WHEN app_has_permission('workforce.documents.view') AND w.verification = 'verified' AND (
              NOT EXISTS (SELECT 1 FROM documents d WHERE d.worker_id=w.id AND d.doc_type='national_id'
                AND d.status='verified' AND (d.expires_on IS NULL OR d.expires_on > current_date))
              OR NOT EXISTS (SELECT 1 FROM documents d WHERE d.worker_id=w.id AND d.doc_type='police_clearance'
                AND d.status='verified' AND (d.expires_on IS NULL OR d.expires_on > current_date))
            ) THEN 'expired' ELSE w.verification END AS verification,
            w.employment_status, w.terminated_at, w.territory_id, w.source_agent_id, w.created_at
     FROM workers w ORDER BY w.created_at DESC LIMIT 200`,
  )).rows));
}));

// ---- Documents: uploading is not verification ----
const UploadQ = z.object({ doc_type: z.enum(['national_id', 'police_clearance', 'reference', 'certificate']), expires_on: z.string().date().optional() });

router.get('/documents/expiry', requireActivity('workforce.documents.view'), h(async (req, res) => {
  const withinDays = z.coerce.number().int().min(0).max(90).default(30).parse(req.query.within_days);
  res.json(await withUser(req.user!, async (c) => (await c.query(
    `SELECT d.id,d.worker_id,w.name AS worker_name,d.doc_type,d.status,d.expires_on,
       CASE WHEN d.expires_on < current_date THEN 'expired' ELSE 'expiring' END AS expiry_state
     FROM documents d JOIN workers w ON w.id=d.worker_id
     WHERE d.expires_on IS NOT NULL AND d.expires_on <= current_date + $1::integer
       AND d.status IN ('verified','uploaded','under_review')
     ORDER BY CASE WHEN d.expires_on < current_date THEN 0 ELSE 1 END,
       CASE WHEN d.expires_on < current_date THEN d.expires_on END DESC,
       d.expires_on,d.created_at LIMIT 300`,
    [withinDays],
  )).rows));
}));

/** Raw file body (PDF/JPEG/PNG, max 10 MB). The type is checked from the file's own bytes, not the client's claim. */
router.post('/workers/:id/documents/upload', requireActivity('workforce.documents.upload'), express.raw({ type: () => true, limit: '10mb' }), h(async (req, res) => {
  const q = UploadQ.parse(req.query);
  const buf = req.body as Buffer;
  if (!Buffer.isBuffer(buf) || buf.length === 0) throw new HttpError(400, 'No file received');
  const mime = sniff(buf);
  if (!mime) throw new HttpError(415, 'Only PDF, JPEG or PNG files are accepted');
  const row = await withUser(req.user!, async (c) => {
    if (!(await c.query('SELECT id FROM workers WHERE id = $1', [req.params.id])).rowCount) throw new HttpError(404, 'Worker not found'); // RLS: must be in your scope
    if (!isClamAvConfigured()) throw new HttpError(503, 'Worker document upload is unavailable until the malware scanner is configured.');
    let scanResult: 'clean' | 'infected';
    try {
      scanResult = await scanWithClamAv(buf);
    } catch (error) {
      console.error('Workforce document malware scan failed', error instanceof Error ? error.message : error);
      throw new HttpError(503, 'Worker document upload is unavailable because the malware scan could not be completed.');
    }
    if (scanResult !== 'clean') throw new HttpError(422, 'The worker document was rejected by the malware scanner.');
    const key = randomUUID();
    const r = await c.query(
      'INSERT INTO documents (worker_id, doc_type, storage_key, sha256, expires_on, mime, size_bytes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, doc_type, status, expires_on',
      [req.params.id, q.doc_type, key, createHash('sha256').update(buf).digest('hex'), q.expires_on ?? null, mime, buf.length],
    );
    await putFile(key, buf); // if this fails the transaction rolls back: no row without a file
    await audit(c, req.user!.id, 'document_uploaded', 'document', r.rows[0].id, null, { doc_type: q.doc_type, bytes: buf.length });
    return r.rows[0];
  });
  res.status(201).json(row);
}));

/** Downloads are limited to agents who can see the worker, compliance and super admin, and every download is audited. */
router.get('/documents/:id/file', requireActivity('workforce.documents.view'), h(async (req, res) => {
  const d = await withUser(req.user!, async (c) => {
    const r = (await c.query('SELECT id, worker_id, storage_key, mime FROM documents WHERE id = $1', [req.params.id])).rows[0];
    if (!r) throw new HttpError(404, 'Document not found');
    const privileged = ['compliance', 'super_admin', 'global_admin'].includes(req.user!.role);
    if (!privileged && !(await c.query('SELECT 1 FROM workers WHERE id = $1', [r.worker_id])).rowCount) throw new HttpError(404, 'Document not found');
    await audit(c, req.user!.id, 'document_downloaded', 'document', r.id);
    return r;
  });
  const buf = await getFile(d.storage_key);
  res.set({ 'Content-Type': d.mime, 'Content-Disposition': 'attachment', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' }).send(buf);
}));

router.get('/workers/:id/documents', requireActivity('workforce.documents.view'), h(async (req, res) => {
  res.json(await withUser(req.user!, async (c) => {
    if (!(await c.query('SELECT id FROM workers WHERE id = $1', [req.params.id])).rowCount) throw new HttpError(404, 'Worker not found');
    return (await c.query('SELECT id, doc_type, status, issued_on, expires_on, reviewed_at, review_note FROM documents WHERE worker_id = $1 ORDER BY id', [req.params.id])).rows;
  }));
}));

router.post('/documents/:id/review', requireActivity('workforce.documents.review'), h(async (req, res) => {
  const { decision, note } = z.object({
    decision: z.enum(['verified', 'rejected']),
    note: z.string().trim().min(10).max(1000).optional(),
  }).strict().parse(req.body);
  if (decision === 'rejected' && !note) throw new HttpError(422, 'Give the worker a reason and tell them what needs to change (at least 10 characters).');
  res.json(await withUser(req.user!, async (c) => {
    const document = (await c.query('SELECT id, doc_type, status, uploaded_by, review_note FROM documents WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!document) throw new HttpError(404, 'Document not found');
    if (document.uploaded_by === req.user!.id) throw new HttpError(403, 'A different compliance officer must review this document');
    if (!['uploaded', 'under_review'].includes(document.status)) throw new HttpError(409, 'Document has already been reviewed');
    const r = await c.query("UPDATE documents SET status = $2, reviewer_id = $3, reviewed_at = now(), review_note = $4 WHERE id = $1 RETURNING id, doc_type, status, review_note", [req.params.id, decision, req.user!.id, decision === 'rejected' ? note : null]);
    if (decision === 'verified') {
      const replaced = await c.query(
        `UPDATE documents SET status='superseded'
         WHERE worker_id=(SELECT worker_id FROM documents WHERE id=$1)
           AND doc_type=$2 AND id<>$1 AND status='verified' RETURNING id`,
        [req.params.id, document.doc_type],
      );
      if (replaced.rowCount) {
        await audit(c, req.user!.id, 'documents_superseded', 'worker', (await c.query('SELECT worker_id FROM documents WHERE id=$1', [req.params.id])).rows[0].worker_id, null, {
          replacement_document_id: req.params.id, superseded_document_ids: replaced.rows.map((row) => row.id), doc_type: document.doc_type,
        });
      }
    }
    await audit(c, req.user!.id, 'document_' + decision, 'document', r.rows[0].id, { status: document.status }, { status: decision });
    return r.rows[0];
  }));
}));

router.post('/workers/:id/verify', requireActivity('workforce.workers.verify'), h(async (req, res) => {
  res.json(await withUser(req.user!, async (c) => {
    const w = (await c.query('SELECT id, name, source_agent_id, verification FROM workers WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!w) throw new HttpError(404, 'Worker not found');
    const have = (await c.query("SELECT doc_type FROM documents WHERE worker_id = $1 AND status = 'verified' AND (expires_on IS NULL OR expires_on > current_date)", [w.id])).rows.map((x) => x.doc_type);
    const missing = ['national_id', 'police_clearance'].filter((x) => !have.includes(x));
    if (missing.length) throw new HttpError(409, 'Missing verified documents: ' + missing.join(', '));
    const r = await c.query("UPDATE workers SET verification = 'verified' WHERE id = $1 RETURNING id, name, verification", [w.id]);
    await audit(c, req.user!.id, 'worker_verified', 'worker', w.id, { verification: w.verification }, { verification: 'verified' });
    await notify(c, w.source_agent_id, 'worker_verified', { name: w.name });
    return r.rows[0];
  }));
}));
