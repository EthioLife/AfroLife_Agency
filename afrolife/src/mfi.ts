import { createHash, randomUUID } from 'node:crypto';
import express, { Router, Request, Response, RequestHandler } from 'express';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import type { AuthUser } from './auth-types.js';
import { isPlatformAdminRole } from './auth-types.js';
import { HttpError } from './http-error.js';
import { enqueueAccountingEvent } from './accounting-outbox.js';
import { centsToAmount, decimalToCents, mfiAmountSchema as amountSchema, normalizeAmount } from './mfi-money.js';
import { Phone } from './validators.js';
import { sniff } from './files.js';
import { getFile, putFile } from './storage.js';
import { assertCleanUpload } from './clamav.js';
import { toCsv } from './csv.js';
import { creditPolicySchema, principalSchedule, scoreLoan } from './mfi-credit.js';
import { cooldownRemainingDays, evaluateLoanEligibility, lendingProductTermsSchema, quoteLoan, type LendingProductTerms } from './lending-products.js';
import { MFI_SANDBOX_SIMULATIONS, runMfiSandboxSimulation } from './mfi-sandbox.js';

export type MfiWithUser = <T>(
  user: AuthUser,
  callback: (client: PoolClient) => Promise<T>,
  options?: { userLookupPhones?: readonly string[] },
) => Promise<T>;

const h = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { fn(req, res).catch(next); };

const institutionRoles = ['institution_admin', 'finance_manager', 'credit_manager', 'loan_officer', 'teller', 'compliance', 'auditor'] as const;
type InstitutionRole = typeof institutionRoles[number];

function createInstitutionRunner(withUser: MfiWithUser) {
  return async function withInstitution<T>(
    user: AuthUser,
    institutionId: string,
    allowedRoles: readonly InstitutionRole[],
    fn: (client: PoolClient, role: InstitutionRole) => Promise<T>,
    options?: { userLookupPhones?: readonly string[] },
  ): Promise<T> {
    return withUser(user, async (client) => {
      await client.query("SELECT set_config('app.mfi_institution_id', $1, true)", [institutionId]);
      const institution = (await client.query(
        'SELECT id FROM mfi_institutions WHERE id=$1',
        [institutionId],
      )).rows[0];
      if (!institution) throw new HttpError(404, 'Institution not found');
      const membership = (await client.query(
        `SELECT role FROM mfi_institution_memberships
         WHERE institution_id = $1 AND user_id = $2 AND active`,
        [institutionId, user.id],
      )).rows[0];
      const platformAdmin = isPlatformAdminRole(user.role);
      if (!membership && !platformAdmin) throw new HttpError(404, 'Institution not found');
      if (!platformAdmin && !allowedRoles.includes(membership.role)) {
        throw new HttpError(403, 'Your institution role cannot do this');
      }
      if (platformAdmin) {
        await auditMfi(client, institutionId, user.id, 'mfi_platform_admin_access', 'mfi_institution', institutionId, null, {
          method: 'institution_scoped_api_access',
          path: '/mfi/institutions/:institutionId',
          access: 'platform_super_admin_override',
        });
      }
      return fn(client, platformAdmin ? 'institution_admin' : membership.role);
    }, options);
  };
}

const viewRoles: readonly InstitutionRole[] = institutionRoles;
const auditRoles: readonly InstitutionRole[] = ['institution_admin', 'finance_manager', 'compliance', 'auditor'];
function amountHash(payload: object) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

async function auditMfi(
  client: PoolClient,
  institutionId: string,
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
  oldValue?: unknown,
  newValue?: unknown,
) {
  await client.query(
    `INSERT INTO mfi_audit_logs (institution_id, actor_id, action, entity, entity_id, old_value, new_value)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      institutionId, actorId, action, entity, entityId,
      oldValue === undefined ? null : JSON.stringify(oldValue),
      newValue === undefined ? null : JSON.stringify(newValue),
    ],
  );
}

async function findJournalReplay(
  client: PoolClient,
  input: {
    institutionId: string; idempotencyKey: string; type: string; memberAccountId: string | null;
    loanId?: string | null; amount: string; reversalOf?: string | null; reversalReason?: string | null; writeoffId?: string | null;
  },
) {
  const payloadHash = amountHash({
    type: input.type,
    member_account_id: input.memberAccountId,
    loan_id: input.loanId ?? null,
    amount: normalizeAmount(input.amount),
    reversal_of: input.reversalOf ?? null,
    reversal_reason: input.reversalReason ?? null,
    ...(input.writeoffId ? { writeoff_id: input.writeoffId } : {}),
  });
  const existing = (await client.query(
    'SELECT * FROM mfi_journals WHERE institution_id = $1 AND idempotency_key = $2',
    [input.institutionId, input.idempotencyKey],
  )).rows[0];
  if (!existing) return null;
  if (existing.payload_hash !== payloadHash) throw new HttpError(409, 'This idempotency key was already used for a different financial request');
  if (existing.status === 'draft' && existing.requires_approval) return { ...existing, replayed: true };
  if (existing.status === 'rejected') throw new HttpError(409, 'This financial request was rejected by an independent reviewer');
  if (existing.status !== 'posted') throw new Error('An incomplete MFI journal was found for an idempotency key');
  return { ...existing, replayed: true };
}

async function lockCashAccount(client: PoolClient, institutionId: string) {
  const account = (await client.query(
    `SELECT id FROM mfi_gl_accounts WHERE institution_id=$1 AND account_code='1000' FOR UPDATE`,
    [institutionId],
  )).rows[0];
  if (!account) throw new Error('Required MFI general-ledger account is missing: 1000');
}

async function cashBalance(client: PoolClient, institutionId: string) {
  return (await client.query(
    `SELECT COALESCE(sum(l.debit-l.credit),0)::numeric(16,2) AS balance
     FROM mfi_journal_lines l
     JOIN mfi_journals j ON j.id=l.journal_id AND j.institution_id=l.institution_id AND j.status='posted'
     JOIN mfi_gl_accounts g ON g.id=l.gl_account_id AND g.institution_id=l.institution_id
     WHERE l.institution_id=$1 AND g.account_code='1000'`,
    [institutionId],
  )).rows[0].balance as string;
}

async function allocateLoanPrincipal(client: PoolClient, institutionId: string, loanId: string, totalPaid: string) {
  await client.query(
    `WITH ordered AS (
       SELECT id, principal_due,
         COALESCE(sum(principal_due) OVER (ORDER BY installment_no ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) AS prior_due
       FROM mfi_loan_installments WHERE institution_id=$1 AND loan_id=$2
     ), allocated AS (
       SELECT id, principal_due, LEAST(principal_due, GREATEST(0,$3::numeric-prior_due)) AS paid FROM ordered
     )
     UPDATE mfi_loan_installments i SET principal_paid=a.paid,
       status=CASE WHEN a.paid=i.principal_due AND i.interest_paid=i.interest_due AND i.penalty_paid=i.penalty_due THEN 'paid'
         WHEN a.paid=0 AND i.interest_paid=0 AND i.penalty_paid=0 THEN 'due' ELSE 'partial' END
     FROM allocated a WHERE i.institution_id=$1 AND i.id=a.id`,
    [institutionId, loanId, totalPaid],
  );
}

async function reverseServicingAllocation(client: PoolClient, institutionId: string, loanId: string,
  interestAmount: string, penaltyAmount: string) {
  let interest = decimalToCents(interestAmount);
  let penalty = decimalToCents(penaltyAmount);
  const rows = (await client.query(
    `SELECT id,interest_paid::text,penalty_paid::text,principal_paid::text,principal_due::text,
            interest_due::text,penalty_due::text
     FROM mfi_loan_installments WHERE institution_id=$1 AND loan_id=$2 ORDER BY installment_no DESC FOR UPDATE`,
    [institutionId, loanId],
  )).rows;
  for (const row of rows) {
    const interestPaid = decimalToCents(String(row.interest_paid));
    const penaltyPaid = decimalToCents(String(row.penalty_paid));
    const interestBack = interest < interestPaid ? interest : interestPaid;
    const penaltyBack = penalty < penaltyPaid ? penalty : penaltyPaid;
    interest -= interestBack;
    penalty -= penaltyBack;
    const remainingInterest = interestPaid - interestBack;
    const remainingPenalty = penaltyPaid - penaltyBack;
    const principalPaid = decimalToCents(String(row.principal_paid));
    const paidStatus = principalPaid === decimalToCents(String(row.principal_due))
      && remainingInterest === decimalToCents(String(row.interest_due))
      && remainingPenalty === decimalToCents(String(row.penalty_due));
    const dueStatus = principalPaid === 0n && remainingInterest === 0n && remainingPenalty === 0n;
    await client.query(
      `UPDATE mfi_loan_installments SET interest_paid=$3,penalty_paid=$4,status=$5
       WHERE institution_id=$1 AND id=$2`,
      [institutionId, row.id, centsToAmount(remainingInterest), centsToAmount(remainingPenalty), paidStatus ? 'paid' : dueStatus ? 'due' : 'partial'],
    );
  }
  if (interest !== 0n || penalty !== 0n) throw new HttpError(409, 'Reversal allocation does not match paid installment interest and penalties');
}

async function postJournal(
  client: PoolClient,
  input: {
    institutionId: string;
    idempotencyKey: string;
    type: string;
    memberAccountId: string | null;
    loanId?: string | null;
    writeoffId?: string | null;
    reversalOf?: string | null;
    reversalReason?: string | null;
    requiresApproval?: boolean;
    amount: string;
    actorId: string;
    lines: { code: string; memberAccountId?: string | null; debit: string; credit: string }[];
    accountingApproval?: { makerId: string; checkerId: string; reason: string };
  },
) {
  const amount = normalizeAmount(input.amount);
  const replay = await findJournalReplay(client, input);
  if (replay) return replay;
  const payloadHash = amountHash({
    type: input.type,
    member_account_id: input.memberAccountId,
    loan_id: input.loanId ?? null,
    amount,
    reversal_of: input.reversalOf ?? null,
    reversal_reason: input.reversalReason ?? null,
    ...(input.writeoffId ? { writeoff_id: input.writeoffId } : {}),
  });

  const inserted = await client.query(
    `INSERT INTO mfi_journals
       (institution_id, idempotency_key, payload_hash, transaction_type, member_account_id, loan_id,
        reversal_of, reversal_reason, amount, created_by,writeoff_id,requires_approval)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (institution_id, idempotency_key) DO NOTHING
     RETURNING *`,
    [
      input.institutionId, input.idempotencyKey, payloadHash, input.type, input.memberAccountId,
      input.loanId ?? null, input.reversalOf ?? null, input.reversalReason ?? null, amount, input.actorId,input.writeoffId??null,input.requiresApproval??false,
    ],
  );
  if (!inserted.rowCount) {
    const raced = (await client.query(
      'SELECT * FROM mfi_journals WHERE institution_id = $1 AND idempotency_key = $2',
      [input.institutionId, input.idempotencyKey],
    )).rows[0];
    if (!raced || raced.payload_hash !== payloadHash) throw new HttpError(409, 'This idempotency key was already used for a different financial request');
    return { ...raced, replayed: true };
  }

  const accounts = await client.query(
    `SELECT id, account_code FROM mfi_gl_accounts
     WHERE institution_id=$1 AND account_code=ANY($2::text[])
     ORDER BY account_code FOR UPDATE`,
    [input.institutionId, [...new Set(input.lines.map((line) => line.code))]],
  );
  const glAccounts = new Map(accounts.rows.map((row) => [row.account_code, row.id]));
  for (const line of input.lines) {
    const glAccountId = glAccounts.get(line.code);
    if (!glAccountId) throw new Error(`Required MFI general-ledger account is missing: ${line.code}`);
    await client.query(
      `INSERT INTO mfi_journal_lines
         (institution_id, journal_id, gl_account_id, member_account_id, debit, credit)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [input.institutionId, inserted.rows[0].id, glAccountId, line.memberAccountId ?? null, line.debit, line.credit],
    );
  }
  if (input.requiresApproval) {
    await auditMfi(client,input.institutionId,input.actorId,'mfi_journal_submitted_for_approval','mfi_journal',inserted.rows[0].id,null,{
      transaction_type:input.type,amount,idempotency_key:input.idempotencyKey,
    });
    return { ...inserted.rows[0], replayed:false };
  }
  const posted = (await client.query(
    `UPDATE mfi_journals SET status = 'posted', posted_at = now()
     WHERE id = $1 AND institution_id = $2 RETURNING *,posted_at::date::text AS posted_date`,
    [inserted.rows[0].id, input.institutionId],
  )).rows[0];
  await auditMfi(client, input.institutionId, input.actorId, 'mfi_journal_posted', 'mfi_journal', posted.id, null, {
    transaction_type: input.type, amount, idempotency_key: input.idempotencyKey,
  });
  if(input.accountingApproval&&input.accountingApproval.makerId!==input.accountingApproval.checkerId){
    await enqueueAccountingEvent(client,{
      source_entity_id:input.institutionId,
      entry_date:posted.posted_date,
      source_reference:`mfi:${input.type}:${posted.id}`,
      description:`MFI ${input.type.replaceAll('_',' ')} ${posted.id}`,
      lines:input.lines.map(line=>({source_account_code:line.code,debit:line.debit,credit:line.credit})),
      maker_id:input.accountingApproval.makerId,checker_id:input.accountingApproval.checkerId,
      checker_reason:input.accountingApproval.reason,
    });
  }
  return { ...posted, replayed: false };
}

async function approvePendingFinancialJournal(
  client:PoolClient,
  institutionId:string,
  journalId:string,
  checkerId:string,
  decision:'approve'|'reject',
  reason:string,
) {
  const journal=(await client.query(
    `SELECT * FROM mfi_journals WHERE institution_id=$1 AND id=$2 AND status='draft' AND requires_approval FOR UPDATE`,
    [institutionId,journalId],
  )).rows[0];
  if(!journal)throw new HttpError(404,'Pending financial journal not found');
  if(journal.created_by===checkerId)throw new HttpError(409,'The financial request maker cannot review their own request');
  const lines=(await client.query(
    `SELECT g.account_code,jl.member_account_id,jl.debit::text,jl.credit::text
     FROM mfi_journal_lines jl JOIN mfi_gl_accounts g ON g.id=jl.gl_account_id AND g.institution_id=jl.institution_id
     WHERE jl.institution_id=$1 AND jl.journal_id=$2 ORDER BY g.account_code`,[institutionId,journalId],
  )).rows;
  if(decision==='reject'){
    const rejected=(await client.query(`UPDATE mfi_journals SET status='rejected',approved_by=$3,approval_reason=$4
      WHERE institution_id=$1 AND id=$2 RETURNING *`,[institutionId,journalId,checkerId,reason])).rows[0];
    await auditMfi(client,institutionId,checkerId,'mfi_journal_rejected','mfi_journal',journalId,{status:'draft'},{reason});
    return rejected;
  }

  let loan:Record<string,unknown>|undefined;
  if(journal.transaction_type==='loan_repayment'){
    loan=(await client.query('SELECT * FROM mfi_loans WHERE institution_id=$1 AND id=$2 FOR UPDATE',[institutionId,journal.loan_id])).rows[0];
    if(!loan||loan.status!=='disbursed')throw new HttpError(409,'The loan is no longer available for repayment approval');
    const pending=(await client.query(`SELECT id FROM mfi_journals WHERE institution_id=$1 AND loan_id=$2 AND requires_approval AND status='draft' AND id<>$3 LIMIT 1`,[institutionId,journal.loan_id,journalId])).rows[0];
    if(pending)throw new HttpError(409,'Resolve the other pending repayment before approving this one');
  }
  await lockCashAccount(client,institutionId);
  if(journal.transaction_type==='savings_withdrawal'){
    const account=(await client.query(`SELECT a.id,p.minimum_balance AS product_minimum,a.status
      FROM mfi_member_accounts a JOIN mfi_products p ON p.id=a.product_id AND p.institution_id=a.institution_id
      WHERE a.institution_id=$1 AND a.id=$2 FOR UPDATE OF a`,[institutionId,journal.member_account_id])).rows[0];
    if(!account||account.status!=='active')throw new HttpError(409,'The member account is no longer active');
    const balance=(await client.query(`SELECT COALESCE(sum(l.credit-l.debit),0)::numeric(16,2)::text AS amount
      FROM mfi_journal_lines l JOIN mfi_journals j ON j.id=l.journal_id AND j.institution_id=l.institution_id AND j.status='posted'
      WHERE l.institution_id=$1 AND l.member_account_id=$2`,[institutionId,account.id])).rows[0].amount;
    const minimum=decimalToCents(String(account.product_minimum??account.minimum_balance));
    const cash=decimalToCents(await cashBalance(client,institutionId));
    if(decimalToCents(String(balance))-decimalToCents(String(journal.amount))<minimum)throw new HttpError(409,'Withdrawal would breach the product minimum balance');
    if(cash<decimalToCents(String(journal.amount)))throw new HttpError(409,'The institution has insufficient cash for this withdrawal');
  }
  if(journal.transaction_type==='loan_repayment'&&loan){
    const priority:('principal'|'interest'|'penalty'|'fee')[]=lendingProductTermsSchema.safeParse(loan.product_terms).success
      ? [...lendingProductTermsSchema.parse(loan.product_terms).repayment_priority] : ['principal','interest','penalty','fee'];
    const totals={principal:0n,interest:0n,penalty:0n};
    for(const line of lines){const amount=decimalToCents(String(line.credit))-decimalToCents(String(line.debit));
      if(line.account_code==='1300')totals.principal+=amount;
      if(line.account_code==='4100')totals.interest+=amount;
      if(line.account_code==='4300')totals.penalty+=amount;}
    const installments=(await client.query(`SELECT id,principal_due::text,principal_paid::text,interest_due::text,interest_paid::text,
      penalty_due::text,penalty_paid::text FROM mfi_loan_installments WHERE institution_id=$1 AND loan_id=$2 ORDER BY due_on,installment_no FOR UPDATE`,[institutionId,journal.loan_id])).rows;
    const work=installments.map((r)=>({id:r.id as string,pd:decimalToCents(String(r.principal_due)),pp:decimalToCents(String(r.principal_paid)),
      idue:decimalToCents(String(r.interest_due)),ip:decimalToCents(String(r.interest_paid)),td:decimalToCents(String(r.penalty_due)),tp:decimalToCents(String(r.penalty_paid))}));
    for(const bucket of priority){if(bucket==='fee')continue;let remaining=totals[bucket];for(const row of work){if(!remaining)break;
      const due=bucket==='principal'?row.pd:bucket==='interest'?row.idue:row.td;const paid=bucket==='principal'?row.pp:bucket==='interest'?row.ip:row.tp;
      const applied=remaining<due-paid?remaining:due-paid;if(applied<=0n)continue;
      if(bucket==='principal')row.pp+=applied;else if(bucket==='interest')row.ip+=applied;else row.tp+=applied;remaining-=applied;}
      if(remaining>0n)throw new HttpError(409,'Repayment allocation is no longer available; reject and resubmit the payment');}
    for(const row of work)await client.query(`UPDATE mfi_loan_installments SET principal_paid=$3,interest_paid=$4,penalty_paid=$5,
      status=CASE WHEN $3::numeric=principal_due AND $4::numeric=interest_due AND $5::numeric=penalty_due THEN 'paid'
        WHEN $3::numeric=0 AND $4::numeric=0 AND $5::numeric=0 THEN 'due' ELSE 'partial' END WHERE institution_id=$1 AND id=$2`,
      [institutionId,row.id,centsToAmount(row.pp),centsToAmount(row.ip),centsToAmount(row.tp)]);
    const principalPaid=decimalToCents(String(loan.principal_repaid))+totals.principal;
    const remaining=(await client.query(`SELECT COALESCE(sum((principal_due-principal_paid)+(interest_due-interest_paid)+(penalty_due-penalty_paid)),0)::numeric(16,2)::text AS amount
      FROM mfi_loan_installments WHERE institution_id=$1 AND loan_id=$2`,[institutionId,journal.loan_id])).rows[0].amount;
    await client.query(`UPDATE mfi_loans SET principal_repaid=$3,status=$4 WHERE institution_id=$1 AND id=$2`,
      [institutionId,journal.loan_id,centsToAmount(principalPaid),decimalToCents(String(remaining))===0n?'repaid':'disbursed']);
  }
  const posted=(await client.query(`UPDATE mfi_journals SET status='posted',approved_by=$3,approval_reason=$4
    WHERE institution_id=$1 AND id=$2 RETURNING *,posted_at::date::text AS posted_date`,[institutionId,journalId,checkerId,reason])).rows[0];
  await auditMfi(client,institutionId,checkerId,'mfi_journal_approved','mfi_journal',journalId,{status:'draft'},{reason,transaction_type:journal.transaction_type});
  await enqueueAccountingEvent(client,{source_entity_id:institutionId,entry_date:posted.posted_date,
    source_reference:`mfi:${journal.transaction_type}:${journalId}`,description:`MFI ${String(journal.transaction_type).replaceAll('_',' ')} ${journalId}`,
    lines:lines.map((l)=>({source_account_code:String(l.account_code),debit:String(l.debit),credit:String(l.credit)})),
    maker_id:String(journal.created_by),checker_id:checkerId,checker_reason:reason});
  return posted;
}

export function createMfiRouter(withUser: MfiWithUser): Router {
  const mfiRouter = Router();
  const withInstitution = createInstitutionRunner(withUser);

mfiRouter.get('/institutions', h(async (req, res) => {
  const rows = await withUser(req.user!, async (client) => {
    const platformAdmin = isPlatformAdminRole(req.user!.role);
    const result = await client.query(
    `SELECT i.id, i.institution_code, i.name, i.currency, m.role
     FROM mfi_institutions i
     LEFT JOIN mfi_institution_memberships m
       ON m.institution_id = i.id AND m.user_id = $1 AND m.active
     WHERE $2::boolean OR m.user_id IS NOT NULL
     ORDER BY i.name`,
      [req.user!.id, platformAdmin],
    );
    if (platformAdmin) {
      for (const institution of result.rows) {
        await auditMfi(client, institution.id, req.user!.id, 'mfi_platform_admin_institution_listed', 'mfi_institution', institution.id, null, {
          access: 'platform_super_admin_override',
        });
      }
    }
    return result.rows.map((row) => ({
      ...row,
      role: platformAdmin ? 'platform_super_admin' : row.role,
    }));
  });
  res.json(rows);
}));

mfiRouter.get('/institutions/catalog', h(async (_req, res) => {
  const rows = await withUser(_req.user!, async (client) => (await client.query(
    `SELECT id, institution_code, name, currency
     FROM mfi_institutions ORDER BY name`,
  )).rows);
  res.json(rows);
}));

mfiRouter.get('/member-portal', h(async (req, res) => {
  const portal = await withUser(req.user!, async (client) => {
    const [applications, members] = await Promise.all([
      client.query(
        `SELECT application.id, application.institution_id, institution.institution_code,
                institution.name AS institution_name, application.status, application.review_reason,
                application.created_at, application.reviewed_at
         FROM mfi_member_applications application
         JOIN mfi_institutions institution ON institution.id=application.institution_id
         WHERE application.user_id=$1 ORDER BY application.created_at DESC`,
        [req.user!.id],
      ),
      client.query(
        `SELECT member.id, member.institution_id, institution.institution_code,
                institution.name AS institution_name, member.member_number, member.full_name,
                member.status, member.kyc_status, member.created_at
         FROM mfi_members member
         JOIN mfi_institutions institution ON institution.id=member.institution_id
         WHERE member.user_id=$1 ORDER BY member.created_at DESC`,
        [req.user!.id],
      ),
    ]);
    const memberIds = members.rows.map((member) => member.id);
    if (!memberIds.length) return { applications: applications.rows, memberships: [] };

    const [accounts, loans] = await Promise.all([
      client.query(
        `SELECT account.id, account.institution_id, account.member_id, account.account_number,
                account.account_type, account.status, account.created_at, product.name AS product_name,
                COALESCE(sum(CASE WHEN account.account_type='loan' THEN line.debit-line.credit
                                  ELSE line.credit-line.debit END)
                  FILTER (WHERE journal.status='posted'),0)::numeric(16,2)::text AS balance
         FROM mfi_member_accounts account
         JOIN mfi_products product ON product.institution_id=account.institution_id
           AND product.id=account.product_id
         LEFT JOIN mfi_journal_lines line ON line.institution_id=account.institution_id
           AND line.member_account_id=account.id
         LEFT JOIN mfi_journals journal ON journal.institution_id=line.institution_id
           AND journal.id=line.journal_id
         WHERE account.member_id=ANY($1::uuid[])
         GROUP BY account.id, product.id ORDER BY account.created_at DESC`,
        [memberIds],
      ),
      client.query(
        `SELECT loan.id, loan.institution_id, loan.member_id, loan.status,
                loan.principal_amount::text, loan.principal_repaid::text,
                (loan.principal_amount-loan.principal_repaid)::numeric(16,2)::text AS outstanding_principal,
                loan.term_months, loan.created_at, loan.reviewed_at, loan.disbursed_at,
                product.name AS product_name,
                COALESCE(jsonb_agg(jsonb_build_object(
                  'installment_no', installment.installment_no, 'due_on', installment.due_on,
                  'principal_due', installment.principal_due::text,
                  'principal_paid', installment.principal_paid::text, 'status', installment.status
                ) ORDER BY installment.installment_no) FILTER (WHERE installment.id IS NOT NULL), '[]'::jsonb) AS schedule
         FROM mfi_loans loan
         JOIN mfi_products product ON product.institution_id=loan.institution_id
           AND product.id=loan.product_id
         LEFT JOIN mfi_loan_installments installment ON installment.institution_id=loan.institution_id
           AND installment.loan_id=loan.id
         WHERE loan.member_id=ANY($1::uuid[])
         GROUP BY loan.id, product.id ORDER BY loan.created_at DESC`,
        [memberIds],
      ),
    ]);
    const transactions = await client.query(
      `SELECT journal.id, journal.institution_id, journal.transaction_type, journal.amount::text,
              journal.status, journal.created_at, journal.posted_at, journal.reversal_of,
              journal.reversal_reason, account.account_number, account.account_type,
              loan.id AS loan_id,
              COALESCE(jsonb_agg(jsonb_build_object(
                'account_code', gl.account_code, 'account_name', gl.name,
                'debit', line.debit::text, 'credit', line.credit::text
              ) ORDER BY gl.account_code) FILTER (WHERE line.id IS NOT NULL), '[]'::jsonb) AS lines
       FROM mfi_journals journal
       LEFT JOIN mfi_member_accounts account ON account.institution_id=journal.institution_id
         AND account.id=journal.member_account_id
       LEFT JOIN mfi_loans loan ON loan.institution_id=journal.institution_id AND loan.id=journal.loan_id
       JOIN mfi_journal_lines line ON line.institution_id=journal.institution_id
         AND line.journal_id=journal.id
       JOIN mfi_gl_accounts gl ON gl.institution_id=line.institution_id AND gl.id=line.gl_account_id
       WHERE journal.status='posted'
         AND (account.member_id=ANY($1::uuid[]) OR loan.member_id=ANY($1::uuid[]))
       GROUP BY journal.id, account.id, loan.id ORDER BY journal.posted_at DESC LIMIT 500`,
      [memberIds],
    );
    return {
      applications: applications.rows,
      memberships: members.rows.map((member) => ({
        ...member,
        accounts: accounts.rows.filter((account) => account.member_id === member.id),
        loans: loans.rows.filter((loan) => loan.member_id === member.id),
        transactions: transactions.rows.filter((transaction) =>
          transaction.institution_id === member.institution_id
          && (accounts.rows.some((account) => account.member_id === member.id
            && account.account_number === transaction.account_number)
            || loans.rows.some((loan) => loan.member_id === member.id && loan.id === transaction.loan_id))),
      })),
    };
  });
  res.json(portal);
}));

mfiRouter.post('/institutions/:institutionId/member-applications', h(async (req, res) => {
  z.object({ consent: z.literal(true) }).strict().parse(req.body);
  if (req.user!.kyc_status !== 'verified') {
    throw new HttpError(403, 'Verified identity is required before requesting SACCO membership');
  }
  if (!req.user!.legal_name || !req.user!.phone) {
    throw new HttpError(409, 'Complete your account name and phone number before applying');
  }
  const application = await withUser(req.user!, async (client) => {
    const institution = (await client.query(
      'SELECT id FROM mfi_institutions WHERE id=$1',
      [req.params.institutionId],
    )).rows[0];
    if (!institution) throw new HttpError(404, 'SACCO institution not found');
    const linkedMember = (await client.query(
      'SELECT id FROM mfi_members WHERE institution_id=$1 AND user_id=$2',
      [req.params.institutionId, req.user!.id],
    )).rows[0];
    if (linkedMember) throw new HttpError(409, 'You already have a membership record with this institution');
    const existing = (await client.query(
      `SELECT id, status FROM mfi_member_applications
       WHERE institution_id=$1 AND user_id=$2 AND status='pending'`,
      [req.params.institutionId, req.user!.id],
    )).rows[0];
    if (existing) throw new HttpError(409, 'Your membership application is already awaiting review');
    const row = (await client.query(
      `INSERT INTO mfi_member_applications (institution_id, user_id, full_name, phone, email)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, institution_id, user_id, status, created_at`,
      [req.params.institutionId, req.user!.id, req.user!.legal_name, req.user!.phone, req.user!.email ?? null],
    )).rows[0];
    await auditMfi(client, req.params.institutionId, req.user!.id, 'mfi_member_application_submitted',
      'mfi_member_application', row.id, null, { status: row.status });
    return row;
  });
  res.status(201).json(application);
}));

mfiRouter.get('/institutions/:institutionId/member-applications', h(async (req, res) => {
  const applications = await withInstitution(req.user!, req.params.institutionId,
    ['institution_admin', 'compliance'], async (client) => (await client.query(
      `SELECT application.id, application.full_name, application.phone, application.email,
              application.status, application.created_at
       FROM mfi_member_applications application
       WHERE application.institution_id=$1 AND application.status='pending'
         AND application.user_id<>$2
       ORDER BY application.created_at`,
      [req.params.institutionId, req.user!.id],
    )).rows);
  res.json(applications);
}));

mfiRouter.post('/institutions/:institutionId/member-applications/:applicationId/decision', h(async (req, res) => {
  const body = z.object({
    decision: z.enum(['approve', 'reject']),
    reason: z.string().trim().min(10).max(1000),
  }).strict().parse(req.body);
  const result = await withInstitution(req.user!, req.params.institutionId,
    ['institution_admin', 'compliance'], async (client) => {
      const application = (await client.query(
        `SELECT * FROM mfi_member_applications
         WHERE institution_id=$1 AND id=$2 FOR UPDATE`,
        [req.params.institutionId, req.params.applicationId],
      )).rows[0];
      if (!application) throw new HttpError(404, 'SACCO membership application not found');
      if (application.status !== 'pending') throw new HttpError(409, 'SACCO membership application has already been reviewed');
      if (application.user_id === req.user!.id) throw new HttpError(409, 'Applicants cannot review their own membership request');
      const status = body.decision === 'approve' ? 'approved' : 'rejected';
      if (status === 'approved') {
        const memberNumber = 'M-' + (await client.query(
          "SELECT lpad(nextval('mfi_member_seq')::text, 8, '0') AS value",
        )).rows[0].value;
        await client.query(
          `INSERT INTO mfi_members
             (institution_id, member_number, full_name, phone, email, status,
              created_by, reviewed_by, reviewed_at, review_reason, user_id)
           VALUES ($1,$2,$3,$4,$5,'active',$6,$7,now(),$8,$6)`,
          [req.params.institutionId, memberNumber, application.full_name, application.phone,
            application.email, application.user_id, req.user!.id, body.reason],
        );
      }
      const updated = (await client.query(
        `UPDATE mfi_member_applications
         SET status=$3, reviewed_by=$4, reviewed_at=now(), review_reason=$5
         WHERE institution_id=$1 AND id=$2
         RETURNING id, user_id, status, reviewed_by, reviewed_at, review_reason`,
        [req.params.institutionId, application.id, status, req.user!.id, body.reason],
      )).rows[0];
      await auditMfi(client, req.params.institutionId, req.user!.id,
        `mfi_member_application_${body.decision}d`, 'mfi_member_application', application.id,
        { status: application.status }, { status, reason: body.reason });
      return updated;
    });
  res.json(result);
}));

mfiRouter.post('/institutions', h(async (req, res) => {
  if (!isPlatformAdminRole(req.user!.role)) throw new HttpError(403, 'Only a platform administrator can register an institution');
  const body = z.object({
    institution_code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,12}$/),
    name: z.string().trim().min(2).max(160),
  }).parse(req.body);
  const institution = await withUser(req.user!, async (client) => {
    const institutionId = randomUUID();
    await client.query(
      'INSERT INTO mfi_institutions (id, institution_code, name, created_by) VALUES ($1,$2,$3,$4)',
      [institutionId, body.institution_code, body.name, req.user!.id],
    );
    await client.query(
      "INSERT INTO mfi_institution_memberships (institution_id, user_id, role) VALUES ($1,$2,'institution_admin')",
      [institutionId, req.user!.id],
    );
    const created = (await client.query(
      'SELECT * FROM mfi_institutions WHERE id=$1',
      [institutionId],
    )).rows[0];
    await client.query(
      `INSERT INTO mfi_gl_accounts (institution_id, account_code, name, account_type) VALUES
        ($1,'1000','Cash on hand','asset'),
        ($1,'1300','Loan principal receivable','asset'),
        ($1,'2100','Member savings liabilities','liability'),
        ($1,'3100','Member share capital','equity'),
        ($1,'4100','Loan interest income','income'),
        ($1,'4200','Loan fee income','income'),
        ($1,'4300','Loan penalty income','income'),
        ($1,'5100','Loan write-off expense','expense')`,
      [institutionId],
    );
    await client.query(
      `INSERT INTO mfi_products (institution_id, product_code, name, product_type) VALUES
        ($1,'SAV-ORD','Ordinary savings','savings'),
        ($1,'SHR-CAP','Member share capital','share'),
        ($1,'LON-GEN','General credit - principal-only pilot','loan')`,
      [institutionId],
    );
    await auditMfi(client, institutionId, req.user!.id, 'mfi_institution_created', 'mfi_institution', institutionId, null, {
      institution_code: created.institution_code, name: created.name,
    });
    return created;
  });
  res.status(201).json(institution);
}));

mfiRouter.get('/institutions/:institutionId/credit-policy', h(async (req, res) => {
  const data = await withInstitution(req.user!, req.params.institutionId, viewRoles, async (client) => ({
    active: (await client.query(
      `SELECT id, version, policy, approved_by, approved_at, effective_at
       FROM mfi_credit_policy_versions WHERE institution_id=$1 AND status='active'`, [req.params.institutionId],
    )).rows[0] ?? null,
    pending: (await client.query(
      `SELECT id, version, policy, change_reason, created_by, created_at
       FROM mfi_credit_policy_versions WHERE institution_id=$1 AND status='pending_approval'`, [req.params.institutionId],
    )).rows[0] ?? null,
  }));
  res.json(data);
}));

mfiRouter.post('/institutions/:institutionId/credit-policy', h(async (req, res) => {
  const body = z.object({ policy: creditPolicySchema, change_reason: z.string().trim().min(10).max(1000) }).parse(req.body);
  const row = await withInstitution(req.user!, req.params.institutionId, ['institution_admin'], async (client) => {
    const pending = await client.query(
      `SELECT id FROM mfi_credit_policy_versions WHERE institution_id=$1 AND status='pending_approval'`, [req.params.institutionId],
    );
    if (pending.rowCount) throw new HttpError(409, 'Review or reject the existing pending credit policy before submitting another');
    const version = Number((await client.query(
      'SELECT COALESCE(max(version),0)+1 AS version FROM mfi_credit_policy_versions WHERE institution_id=$1', [req.params.institutionId],
    )).rows[0].version);
    const created = (await client.query(
      `INSERT INTO mfi_credit_policy_versions (institution_id, version, policy, change_reason, created_by, status)
       VALUES ($1,$2,$3,$4,$5,'pending_approval') RETURNING *`,
      [req.params.institutionId, version, JSON.stringify(body.policy), body.change_reason, req.user!.id],
    )).rows[0];
    await auditMfi(client, req.params.institutionId, req.user!.id, 'mfi_credit_policy_submitted', 'mfi_credit_policy', created.id, null, {
      version, reason: body.change_reason,
    });
    return created;
  });
  res.status(201).json(row);
}));

mfiRouter.post('/institutions/:institutionId/credit-policy/:policyId/approve', h(async (req, res) => {
  const body = z.object({ decision: z.enum(['approve','reject']), reason: z.string().trim().min(10).max(1000) }).parse(req.body);
  const result = await withInstitution(req.user!, req.params.institutionId, ['institution_admin'], async (client) => {
    const pending = (await client.query(
      `SELECT * FROM mfi_credit_policy_versions WHERE institution_id=$1 AND id=$2 AND status='pending_approval' FOR UPDATE`,
      [req.params.institutionId, req.params.policyId],
    )).rows[0];
    if (!pending) throw new HttpError(404, 'Pending credit policy not found');
    if (pending.created_by === req.user!.id) throw new HttpError(409, 'The policy author cannot approve their own policy');
    if (body.decision === 'reject') {
      await client.query(`UPDATE mfi_credit_policy_versions SET status='rejected' WHERE institution_id=$1 AND id=$2`, [req.params.institutionId, pending.id]);
      await auditMfi(client, req.params.institutionId, req.user!.id, 'mfi_credit_policy_rejected', 'mfi_credit_policy', pending.id, { status: pending.status }, { reason: body.reason });
      return { ...pending, status: 'rejected' };
    }
    await client.query(`UPDATE mfi_credit_policy_versions SET status='superseded' WHERE institution_id=$1 AND status='active'`, [req.params.institutionId]);
    const active = (await client.query(
      `UPDATE mfi_credit_policy_versions SET status='active', approved_by=$3, approved_at=now(), effective_at=now()
       WHERE institution_id=$1 AND id=$2 RETURNING *`, [req.params.institutionId, pending.id, req.user!.id],
    )).rows[0];
    await auditMfi(client, req.params.institutionId, req.user!.id, 'mfi_credit_policy_activated', 'mfi_credit_policy', active.id, null, {
      version: active.version, reason: body.reason,
    });
    return active;
  });
  res.json(result);
}));

mfiRouter.get('/institutions/:institutionId/staff', h(async (req, res) => {
  const rows = await withInstitution(req.user!, req.params.institutionId, ['institution_admin'], async (client) =>
    (await client.query(
      `SELECT m.user_id, u.legal_name, u.phone, m.role, m.active, m.created_at
       FROM mfi_institution_memberships m JOIN users u ON u.id=m.user_id
       WHERE m.institution_id=$1 ORDER BY u.legal_name`,
      [req.params.institutionId],
    )).rows,
  );
  res.json(rows);
}));

mfiRouter.post('/institutions/:institutionId/staff', h(async (req, res) => {
  const body = z.object({
    phone: Phone,
    role: z.enum(institutionRoles),
  }).parse(req.body);
  const membership = await withInstitution(req.user!, req.params.institutionId, ['institution_admin'], async (client) => {
    const staff = (await client.query(
      `SELECT id, legal_name, phone FROM users
       WHERE phone=$1 AND active AND role IN ('global_admin','super_admin','compliance','finance','finance_manager')`,
      [body.phone],
    )).rows[0];
    if (!staff) throw new HttpError(404, 'No active AfroLife finance or compliance staff account matches that phone number');
    const row = (await client.query(
      `INSERT INTO mfi_institution_memberships (institution_id, user_id, role)
       VALUES ($1,$2,$3) RETURNING *`,
      [req.params.institutionId, staff.id, body.role],
    )).rows[0];
    await auditMfi(client, req.params.institutionId, req.user!.id, 'mfi_staff_provisioned', 'mfi_membership', staff.id, null, {
      legal_name: staff.legal_name, phone: staff.phone, role: body.role,
    });
    return row;
  }, { userLookupPhones: [body.phone] });
  res.status(201).json(membership);
}));

mfiRouter.get('/institutions/:institutionId/overview', h(async (req, res) => {
  const data = await withInstitution(req.user!, req.params.institutionId, viewRoles, async (client) => {
    const [members, accounts, loans, journals, cash] = await Promise.all([
      client.query(`SELECT status, count(*)::int AS count FROM mfi_members WHERE institution_id=$1 GROUP BY status`, [req.params.institutionId]),
      client.query(
        `SELECT a.account_type, count(*)::int AS count,
           COALESCE(sum(CASE WHEN a.account_type='loan' THEN l.debit-l.credit ELSE l.credit-l.debit END),0)::numeric(16,2) AS balance
         FROM mfi_member_accounts a
         LEFT JOIN mfi_journal_lines l ON l.institution_id=a.institution_id AND l.member_account_id=a.id
         LEFT JOIN mfi_journals j ON j.id=l.journal_id AND j.institution_id=l.institution_id AND j.status='posted'
         WHERE a.institution_id=$1 AND a.status='active'
         GROUP BY a.account_type`,
        [req.params.institutionId],
      ),
      client.query(`SELECT status, count(*)::int AS count FROM mfi_loans WHERE institution_id=$1 GROUP BY status`, [req.params.institutionId]),
      client.query(`SELECT count(*)::int AS count FROM mfi_journals WHERE institution_id=$1 AND status='posted'`, [req.params.institutionId]),
      client.query(
        `SELECT COALESCE(sum(l.debit-l.credit),0)::numeric(16,2) AS balance
         FROM mfi_journal_lines l JOIN mfi_journals j ON j.id=l.journal_id AND j.institution_id=l.institution_id
         JOIN mfi_gl_accounts g ON g.id=l.gl_account_id AND g.institution_id=l.institution_id
         WHERE l.institution_id=$1 AND j.status='posted' AND g.account_code='1000'`,
        [req.params.institutionId],
      ),
    ]);
    return {
      members: Object.fromEntries(members.rows.map((row) => [row.status, row.count])),
      accounts: Object.fromEntries(accounts.rows.map((row) => [row.account_type, { count: row.count, balance: row.balance }])),
      loans: Object.fromEntries(loans.rows.map((row) => [row.status, row.count])),
      posted_transactions: journals.rows[0].count,
      cash_balance: cash.rows[0].balance,
    };
  });
  res.json(data);
}));

// Operational reports are computed from posted ledger entries and the
// contractual installment schedule; they never consume manually recorded UAT
// outcomes or draft journals.
mfiRouter.get('/institutions/:institutionId/reports/portfolio', h(async (req, res) => {
  const report = await withInstitution(req.user!, req.params.institutionId,
    ['institution_admin','finance_manager','credit_manager','compliance','auditor'], async (client) => {
      const [summary, aging] = await Promise.all([
        client.query(
          `WITH loan_balances AS (
             SELECT l.id,l.principal_amount,l.principal_repaid,l.npl_status,
               COALESCE(max(current_date-i.due_on) FILTER (WHERE i.status NOT IN ('paid','waived') AND i.due_on<current_date),0)::int AS dpd,
               COALESCE(sum(i.principal_due-i.principal_paid+i.interest_due-i.interest_paid+i.penalty_due-i.penalty_paid)
                 FILTER (WHERE i.status NOT IN ('paid','waived') AND i.due_on<current_date),0)::numeric(16,2) AS overdue_amount
             FROM mfi_loans l LEFT JOIN mfi_loan_installments i
               ON i.institution_id=l.institution_id AND i.loan_id=l.id
             WHERE l.institution_id=$1 AND l.status='disbursed'
             GROUP BY l.id
           )
           SELECT count(*)::int AS disbursed_loans,
             COALESCE(sum(principal_amount-principal_repaid),0)::numeric(16,2) AS outstanding_principal,
             count(*) FILTER (WHERE overdue_amount>0)::int AS loans_past_due,
             COALESCE(sum(principal_amount-principal_repaid) FILTER (WHERE overdue_amount>0),0)::numeric(16,2) AS par_principal,
             COALESCE(sum(overdue_amount),0)::numeric(16,2) AS overdue_installments,
             CASE WHEN COALESCE(sum(principal_amount-principal_repaid),0)=0 THEN 0
               ELSE round(100*sum(principal_amount-principal_repaid) FILTER (WHERE overdue_amount>0)
                 / sum(principal_amount-principal_repaid),2) END AS par_ratio_pct
           FROM loan_balances`, [req.params.institutionId],
        ),
        client.query(
          `WITH loan_balances AS (
             SELECT l.id,l.principal_amount-l.principal_repaid AS outstanding,
               COALESCE(max(current_date-i.due_on) FILTER (WHERE i.status NOT IN ('paid','waived') AND i.due_on<current_date),0)::int AS dpd
             FROM mfi_loans l LEFT JOIN mfi_loan_installments i
               ON i.institution_id=l.institution_id AND i.loan_id=l.id
             WHERE l.institution_id=$1 AND l.status='disbursed' GROUP BY l.id
           )
           SELECT CASE WHEN dpd BETWEEN 1 AND 30 THEN '1_30' WHEN dpd BETWEEN 31 AND 60 THEN '31_60'
             WHEN dpd BETWEEN 61 AND 90 THEN '61_90' WHEN dpd>90 THEN 'over_90' ELSE 'current' END AS bucket,
             count(*)::int AS loan_count, COALESCE(sum(outstanding),0)::numeric(16,2) AS outstanding_principal
           FROM loan_balances GROUP BY bucket ORDER BY CASE bucket WHEN 'current' THEN 0 WHEN '1_30' THEN 1
             WHEN '31_60' THEN 2 WHEN '61_90' THEN 3 ELSE 4 END`, [req.params.institutionId],
        ),
      ]);
      return { as_of: new Date().toISOString().slice(0,10), ...summary.rows[0], aging: aging.rows };
    });
  res.json(report);
}));

// Institution-scoped, aggregate-only reporting for the standalone credit risk
// workspace. Score bands describe the configured policy scorecard, not a
// probability of default. Borrower-identifying and application-level fields
// are deliberately excluded from this endpoint.
mfiRouter.get('/institutions/:institutionId/reports/credit-risk', h(async (req, res) => {
  const report = await withInstitution(req.user!, req.params.institutionId,
    ['institution_admin','finance_manager','credit_manager','compliance','auditor'], async (client) => {
      const [summary, scoreBands, classifications, portfolio] = await Promise.all([
        client.query(
          `SELECT count(*)::int AS applications,
             count(*) FILTER (WHERE credit_score IS NOT NULL)::int AS assessed,
             count(*) FILTER (WHERE credit_score IS NULL)::int AS unscored,
             count(*) FILTER (WHERE status IN ('approved','disbursed','repaid','written_off'))::int AS approved_or_later,
             count(*) FILTER (WHERE status='rejected')::int AS rejected,
             count(DISTINCT credit_scorecard_version) FILTER (WHERE credit_score IS NOT NULL)::int AS policy_versions_used
           FROM mfi_loans WHERE institution_id=$1`,
          [req.params.institutionId],
        ),
        client.query(
          `WITH scored AS (
             SELECT CASE
                 WHEN credit_score IS NULL THEN 'unscored'
                 WHEN credit_score < 40 THEN '0-39'
                 WHEN credit_score < 60 THEN '40-59'
                 WHEN credit_score < 80 THEN '60-79'
                 ELSE '80-100'
               END AS band,
               credit_score, status
             FROM mfi_loans WHERE institution_id=$1
           )
           SELECT band,
             count(*)::int AS application_count,
             round(avg(credit_score),1) AS average_score,
             count(*) FILTER (WHERE status IN ('approved','disbursed','repaid','written_off'))::int AS approved_or_later,
             count(*) FILTER (WHERE status='rejected')::int AS rejected,
             count(*) FILTER (WHERE status='pending')::int AS pending
           FROM scored
           GROUP BY band
           ORDER BY CASE band WHEN '0-39' THEN 0 WHEN '40-59' THEN 1 WHEN '60-79' THEN 2
             WHEN '80-100' THEN 3 ELSE 4 END`,
          [req.params.institutionId],
        ),
        client.query(
          `SELECT loan.npl_status AS classification,count(*)::int AS loan_count,
             COALESCE(sum(loan.principal_amount-loan.principal_repaid),0)::numeric(16,2) AS outstanding_principal
           FROM mfi_loans loan
           WHERE loan.institution_id=$1 AND loan.status IN ('disbursed','repaid','written_off')
           GROUP BY loan.npl_status
           ORDER BY CASE loan.npl_status WHEN 'performing' THEN 0 WHEN 'watch' THEN 1
             WHEN 'substandard' THEN 2 WHEN 'doubtful' THEN 3 WHEN 'loss' THEN 4 ELSE 5 END`,
          [req.params.institutionId],
        ),
        client.query(
          `WITH loan_balances AS (
             SELECT l.id,l.principal_amount-l.principal_repaid AS outstanding,
               COALESCE(max(current_date-i.due_on) FILTER (WHERE i.status NOT IN ('paid','waived') AND i.due_on<current_date),0)::int AS dpd,
               COALESCE(sum(i.principal_due-i.principal_paid+i.interest_due-i.interest_paid+i.penalty_due-i.penalty_paid)
                 FILTER (WHERE i.status NOT IN ('paid','waived') AND i.due_on<current_date),0)::numeric(16,2) AS overdue_amount
             FROM mfi_loans l LEFT JOIN mfi_loan_installments i
               ON i.institution_id=l.institution_id AND i.loan_id=l.id
             WHERE l.institution_id=$1 AND l.status='disbursed' GROUP BY l.id
           ), buckets AS (
             SELECT CASE WHEN dpd BETWEEN 1 AND 30 THEN '1-30 days' WHEN dpd BETWEEN 31 AND 60 THEN '31-60 days'
               WHEN dpd BETWEEN 61 AND 90 THEN '61-90 days' WHEN dpd>90 THEN 'over 90 days' ELSE 'current' END AS bucket,
               count(*)::int AS loan_count, COALESCE(sum(outstanding),0)::numeric(16,2) AS outstanding_principal
             FROM loan_balances GROUP BY bucket
           )
           SELECT (SELECT count(*)::int FROM loan_balances) AS disbursed_loans,
             (SELECT COALESCE(sum(outstanding),0)::numeric(16,2) FROM loan_balances) AS outstanding_principal,
             (SELECT count(*)::int FROM loan_balances WHERE overdue_amount>0) AS loans_past_due,
             (SELECT COALESCE(sum(outstanding),0)::numeric(16,2) FROM loan_balances WHERE overdue_amount>0) AS par_principal,
             (SELECT COALESCE(sum(overdue_amount),0)::numeric(16,2) FROM loan_balances) AS overdue_installments,
             CASE WHEN COALESCE((SELECT sum(outstanding) FROM loan_balances),0)=0 THEN 0
               ELSE round(100*(SELECT COALESCE(sum(outstanding),0) FROM loan_balances WHERE overdue_amount>0)
                 / (SELECT sum(outstanding) FROM loan_balances),2) END AS par_ratio_pct,
             (SELECT COALESCE(jsonb_agg(b ORDER BY CASE bucket WHEN 'current' THEN 0 WHEN '1-30 days' THEN 1
               WHEN '31-60 days' THEN 2 WHEN '61-90 days' THEN 3 ELSE 4 END),'[]'::jsonb) FROM buckets b) AS aging` ,
          [req.params.institutionId],
        ),
      ]);
      return {
        as_of: new Date().toISOString().slice(0,10),
        ...summary.rows[0],
        score_bands: scoreBands.rows,
        classifications: classifications.rows,
        portfolio: portfolio.rows[0],
        scoring: {
          method: 'institution_policy_scorecard',
          output: '0-100 policy score; not a probability of default',
          decision_control: 'staff review with approved policy eligibility checks',
          machine_learning: 'not connected; supplied challenger remains shadow-only',
        },
        model_registry: [
          {
            model_id: 'institution-policy-scorecard', version: 'institution-versioned',
            status: 'active', connected: true, purpose: 'Explainable application affordability and policy eligibility score',
            decision_control: 'A score is not approval; independent institution staff review is required',
          },
          {
            model_id: 'archive-collection-risk-challenger', version: 'unvalidated-archive-candidate',
            status: 'shadow_only', connected: false, purpose: 'Potential portfolio early-warning challenger; not a probability of default',
            prohibited_uses: ['underwriting decisions', 'pricing', 'adverse action', 'borrower prioritization'],
            promotion_gates: ['decision-time features without target leakage', 'independent out-of-time validation', 'approved lawful data and consent', 'fairness and stability review', 'risk committee approval'],
          },
        ],
      };
    });
  res.json(report);
}));

// Provider and challenger demos consume synthetic fixture data only. Every run is
// stored in a separate append-only table; no real provider, member, or ledger is touched.
const mfiSandboxRoleSet: readonly InstitutionRole[] = ['institution_admin','finance_manager','credit_manager','compliance','auditor'];
mfiRouter.get('/institutions/:institutionId/sandbox/runs', h(async (req, res) => {
  const runs = await withInstitution(req.user!, req.params.institutionId, mfiSandboxRoleSet, async (client) =>
    (await client.query(
      `SELECT id,simulation,scenario,result,created_at FROM mfi_sandbox_runs
       WHERE institution_id=$1 ORDER BY created_at DESC,id DESC LIMIT 50`, [req.params.institutionId],
    )).rows);
  res.json(runs);
}));

mfiRouter.post('/institutions/:institutionId/sandbox/:simulation', h(async (req, res) => {
  const { simulation } = z.object({ simulation: z.enum(MFI_SANDBOX_SIMULATIONS) }).parse(req.params);
  const body = z.object({ scenario: z.string().trim().min(1).max(100) }).strict().parse(req.body);
  let outcome: ReturnType<typeof runMfiSandboxSimulation>;
  try {
    outcome = runMfiSandboxSimulation(simulation, body.scenario);
  } catch {
    throw new HttpError(422, 'Choose a supported synthetic sandbox scenario');
  }
  const saved = await withInstitution(req.user!, req.params.institutionId, mfiSandboxRoleSet, async (client) => {
    const row = (await client.query(
      `INSERT INTO mfi_sandbox_runs (institution_id,actor_id,simulation,scenario,result)
       VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING id,created_at`,
      [req.params.institutionId, req.user!.id, simulation, body.scenario, JSON.stringify(outcome)],
    )).rows[0];
    await auditMfi(client, req.params.institutionId, req.user!.id, 'mfi_sandbox_simulation_run',
      'mfi_sandbox_run', row.id, null, { simulation, scenario: body.scenario, sandbox_only: true });
    return row;
  });
  res.status(201).json({ id: saved.id, created_at: saved.created_at, ...outcome });
}));

mfiRouter.get('/institutions/:institutionId/reports/trial-balance', h(async (req, res) => {
  const asOf = z.string().date().optional().parse(req.query.as_of);
  const format = z.enum(['json','csv']).default('json').parse(req.query.format);
  const report = await withInstitution(req.user!, req.params.institutionId,
    ['institution_admin','finance_manager','compliance','auditor'], async (client) => {
      const result = await client.query(
        `SELECT g.account_code,g.name,g.account_type,
           COALESCE(sum(l.debit) FILTER (WHERE j.id IS NOT NULL),0)::numeric(16,2) AS debits,
           COALESCE(sum(l.credit) FILTER (WHERE j.id IS NOT NULL),0)::numeric(16,2) AS credits,
           CASE WHEN g.account_type IN ('asset','expense')
             THEN COALESCE(sum(l.debit-l.credit) FILTER (WHERE j.id IS NOT NULL),0)
             ELSE COALESCE(sum(l.credit-l.debit) FILTER (WHERE j.id IS NOT NULL),0) END::numeric(16,2) AS balance
         FROM mfi_gl_accounts g
         LEFT JOIN mfi_journal_lines l ON l.institution_id=g.institution_id AND l.gl_account_id=g.id
         LEFT JOIN mfi_journals j ON j.institution_id=l.institution_id AND j.id=l.journal_id
           AND j.status='posted' AND j.posted_at < (($2::date + interval '1 day')::timestamptz)
         WHERE g.institution_id=$1 GROUP BY g.id ORDER BY g.account_code`,
        [req.params.institutionId, asOf ?? new Date().toISOString().slice(0,10)],
      );
      const totals = result.rows.reduce((acc, row) => ({
        debits: acc.debits + Number(row.debits), credits: acc.credits + Number(row.credits),
      }), { debits: 0, credits: 0 });
      return { as_of: asOf ?? new Date().toISOString().slice(0,10), accounts: result.rows,
        total_debits: totals.debits.toFixed(2), total_credits: totals.credits.toFixed(2),
        balanced: Math.abs(totals.debits-totals.credits) < 0.005 };
    });
  if (format === 'csv') {
    const rows = report.accounts.map((row) => ({
      account_code: String(row.account_code), account_name: String(row.name), account_type: String(row.account_type),
      debits: String(row.debits), credits: String(row.credits), balance: String(row.balance),
    }));
    rows.push({ account_code: 'TOTAL', account_name: '', account_type: '',
      debits: String(report.total_debits), credits: String(report.total_credits), balance: '' });
    res.type('text/csv').attachment(`sacco-trial-balance-${report.as_of}.csv`)
      .send(toCsv(rows, ['account_code','account_name','account_type','debits','credits','balance']));
  } else res.json(report);
}));

mfiRouter.get('/institutions/:institutionId/reports/disbursement-reconciliation', h(async (req, res) => {
  const from = z.string().date().optional().parse(req.query.from);
  const to = z.string().date().optional().parse(req.query.to);
  if (from && to && from > to) throw new HttpError(400, 'from must be on or before to');
  const report = await withInstitution(req.user!, req.params.institutionId,
    ['institution_admin','finance_manager','compliance','auditor'], async (client) => {
      const result = await client.query(
        `SELECT j.transaction_type,count(*)::int AS journal_count,
           COALESCE(sum(j.amount),0)::numeric(16,2) AS total_amount,
           COALESCE(sum(CASE WHEN j.transaction_type='loan_disbursement' THEN j.amount ELSE 0 END),0)::numeric(16,2) AS disbursed,
           COALESCE(sum(CASE WHEN j.transaction_type='loan_repayment' THEN j.amount ELSE 0 END),0)::numeric(16,2) AS repaid,
           count(*) FILTER (WHERE abs(lines.debits-lines.credits)>0.005)::int AS unbalanced_journals
         FROM mfi_journals j JOIN LATERAL (
           SELECT COALESCE(sum(debit),0) AS debits,COALESCE(sum(credit),0) AS credits
           FROM mfi_journal_lines WHERE institution_id=j.institution_id AND journal_id=j.id
         ) lines ON true
         WHERE j.institution_id=$1 AND j.status='posted'
           AND ($2::date IS NULL OR j.posted_at >= $2::date::timestamptz)
           AND ($3::date IS NULL OR j.posted_at < ($3::date + interval '1 day')::timestamptz)
           AND j.transaction_type IN ('loan_disbursement','loan_repayment')
         GROUP BY j.transaction_type ORDER BY j.transaction_type`, [req.params.institutionId, from ?? null, to ?? null],
      );
      return { from: from ?? null, to: to ?? null, by_type: result.rows,
        disbursed: result.rows.find((row) => row.transaction_type==='loan_disbursement')?.disbursed ?? '0.00',
        repaid: result.rows.find((row) => row.transaction_type==='loan_repayment')?.repaid ?? '0.00',
        unbalanced_journals: result.rows.reduce((sum, row) => sum+Number(row.unbalanced_journals),0) };
    });
  res.json(report);
}));

mfiRouter.get('/institutions/:institutionId/audit', h(async (req, res) => {
  const rows = await withInstitution(req.user!, req.params.institutionId, auditRoles, async (client) =>
    (await client.query(
      `SELECT a.id, a.actor_id, u.legal_name AS actor_name, a.action, a.entity, a.entity_id,
         a.old_value, a.new_value, a.created_at
       FROM mfi_audit_logs a JOIN users u ON u.id=a.actor_id
       WHERE a.institution_id=$1 ORDER BY a.created_at DESC LIMIT 200`,
      [req.params.institutionId],
    )).rows,
  );
  res.json(rows);
}));

mfiRouter.get('/institutions/:institutionId/transactions', h(async (req, res) => {
  const rows = await withInstitution(req.user!, req.params.institutionId, viewRoles, async (client) =>
    (await client.query(
      `SELECT j.id, j.transaction_type, j.amount, j.created_at, j.posted_at, j.created_by,j.status,j.requires_approval,j.approved_by,j.approval_reason,
         j.reversal_of, j.reversal_reason,
         u.legal_name AS posted_by, j.loan_id, l.member_account_id AS loan_account_id,
         (SELECT r.id FROM mfi_journals r WHERE r.institution_id=j.institution_id AND r.reversal_of=j.id) AS reversal_id,
         jsonb_agg(jsonb_build_object(
           'account_code', g.account_code, 'account_name', g.name,
           'debit', jl.debit, 'credit', jl.credit,
           'account_number', a.account_number
         ) ORDER BY g.account_code) AS lines
       FROM mfi_journals j
       JOIN users u ON u.id=j.created_by
       JOIN mfi_journal_lines jl ON jl.institution_id=j.institution_id AND jl.journal_id=j.id
       JOIN mfi_gl_accounts g ON g.institution_id=jl.institution_id AND g.id=jl.gl_account_id
       LEFT JOIN mfi_member_accounts a ON a.institution_id=jl.institution_id AND a.id=jl.member_account_id
       LEFT JOIN mfi_loans l ON l.institution_id=j.institution_id AND l.id=j.loan_id
       WHERE j.institution_id=$1 AND (j.status IN ('posted','rejected') OR (j.status='draft' AND j.requires_approval))
       GROUP BY j.id,u.legal_name,l.member_account_id ORDER BY j.posted_at DESC LIMIT 100`,
      [req.params.institutionId],
    )).rows,
  );
  res.json(rows);
}));

mfiRouter.post('/institutions/:institutionId/journals/:journalId/decision',h(async(req,res)=>{
  const body=z.object({decision:z.enum(['approve','reject']),reason:z.string().trim().min(10).max(1000)}).strict().parse(req.body);
  const result=await withInstitution(req.user!,req.params.institutionId,['institution_admin','finance_manager'],async(client)=>
    approvePendingFinancialJournal(client,req.params.institutionId,req.params.journalId,req.user!.id,body.decision,body.reason));
  res.json(result);
}));

mfiRouter.post('/institutions/:institutionId/journals/:journalId/reverse', h(async (req, res) => {
  const body = z.object({
    idempotency_key: z.string().uuid(),
    reason: z.string().trim().min(10).max(1000),
  }).parse(req.body);
  const reversal = await withInstitution(req.user!, req.params.institutionId, ['institution_admin', 'finance_manager'], async (client) => {
    const original = (await client.query(
      `SELECT * FROM mfi_journals
       WHERE institution_id=$1 AND id=$2 AND status='posted'
       FOR UPDATE`,
      [req.params.institutionId, req.params.journalId],
    )).rows[0];
    if (!original) throw new HttpError(404, 'Posted journal not found');
    if (original.transaction_type === 'reversal' || original.reversal_of) {
      throw new HttpError(409, 'A reversal event cannot itself be reversed');
    }
    if (original.transaction_type === 'loan_writeoff') {
      throw new HttpError(409, 'An approved loan write-off is final; any correction requires a separately approved recovery journal');
    }
    const replay = await findJournalReplay(client, {
      institutionId: req.params.institutionId,
      idempotencyKey: body.idempotency_key,
      type: 'reversal',
      memberAccountId: original.member_account_id,
      loanId: original.loan_id,
      amount: String(original.amount),
      reversalOf: original.id,
      reversalReason: body.reason,
    });
    if (replay) return replay;
    if (original.created_by === req.user!.id) {
      throw new HttpError(409, 'The original transaction maker cannot approve its reversal');
    }
    const priorReversal = (await client.query(
      'SELECT id FROM mfi_journals WHERE institution_id=$1 AND reversal_of=$2',
      [req.params.institutionId, original.id],
    )).rows[0];
    if (priorReversal) throw new HttpError(409, 'This posted transaction already has a full reversal');

    const originalLines = (await client.query(
      `SELECT jl.debit, jl.credit, jl.member_account_id, g.account_code
       FROM mfi_journal_lines jl JOIN mfi_gl_accounts g
         ON g.id=jl.gl_account_id AND g.institution_id=jl.institution_id
       WHERE jl.institution_id=$1 AND jl.journal_id=$2 ORDER BY g.account_code`,
      [req.params.institutionId, original.id],
    )).rows;
    const cashChange = originalLines
      .filter((line) => line.account_code === '1000')
      .reduce((sum, line) => sum + decimalToCents(String(line.credit)) - decimalToCents(String(line.debit)), 0n);
    const subledgerId = original.member_account_id ?? originalLines.find((line) => line.member_account_id)?.member_account_id ?? null;
    let loan: Record<string, unknown> | undefined;
    if (original.loan_id) {
      loan = (await client.query(
        'SELECT * FROM mfi_loans WHERE institution_id=$1 AND id=$2 FOR UPDATE',
        [req.params.institutionId, original.loan_id],
      )).rows[0];
      if (!loan) throw new Error('The original loan journal has no loan record');
      if (original.transaction_type === 'loan_disbursement' &&
          (loan.status !== 'disbursed' || decimalToCents(String(loan.principal_repaid)) !== 0n)) {
        throw new HttpError(409, 'A loan disbursement can only be reversed before any principal repayment');
      }
      if (original.transaction_type === 'loan_repayment' && !['disbursed', 'repaid'].includes(String(loan.status))) {
        throw new HttpError(409, 'This loan is not in a repayable state');
      }
    }

    // Loan operations consistently lock the loan before cash. Keeping that order here
    // avoids a cash/loan lock cycle with repayment and disbursement requests.
    await lockCashAccount(client, req.params.institutionId);
    if (cashChange < 0n && decimalToCents(await cashBalance(client, req.params.institutionId)) < -cashChange) {
      throw new HttpError(409, 'The institution has insufficient cash to reverse this transaction');
    }
    if (subledgerId) {
      const account = (await client.query(
        `SELECT a.account_type, p.minimum_balance
         FROM mfi_member_accounts a JOIN mfi_products p ON p.id=a.product_id AND p.institution_id=a.institution_id
         WHERE a.institution_id=$1 AND a.id=$2`,
        [req.params.institutionId, subledgerId],
      )).rows[0];
      if (account && account.account_type !== 'loan') {
        const balance = (await client.query(
          `SELECT COALESCE(sum(l.credit-l.debit),0)::numeric(16,2) AS value
           FROM mfi_journal_lines l JOIN mfi_journals j
             ON j.id=l.journal_id AND j.institution_id=l.institution_id AND j.status='posted'
           WHERE l.institution_id=$1 AND l.member_account_id=$2`,
          [req.params.institutionId, subledgerId],
        )).rows[0].value as string;
        const balanceChange = originalLines
          .filter((line) => line.member_account_id === subledgerId)
          .reduce((sum, line) => sum + decimalToCents(String(line.debit)) - decimalToCents(String(line.credit)), 0n);
        if (decimalToCents(balance) + balanceChange < decimalToCents(String(account.minimum_balance))) {
          throw new HttpError(409, 'Reversal would breach the member account minimum balance');
        }
      }
    }

    const journal = await postJournal(client, {
      institutionId: req.params.institutionId,
      idempotencyKey: body.idempotency_key,
      type: 'reversal',
      memberAccountId: original.member_account_id,
      loanId: original.loan_id,
      reversalOf: original.id,
      reversalReason: body.reason,
      amount: String(original.amount),
      actorId: req.user!.id,
      accountingApproval: { makerId: String(original.created_by), checkerId: req.user!.id, reason: body.reason },
      lines: originalLines.map((line) => ({
        code: line.account_code,
        memberAccountId: line.member_account_id,
        debit: String(line.credit),
        credit: String(line.debit),
      })),
    });
    if (loan && original.transaction_type === 'loan_disbursement') {
      await client.query(
        `UPDATE mfi_loans SET status='cancelled'
         WHERE institution_id=$1 AND id=$2`,
        [req.params.institutionId, original.loan_id],
      );
    } else if (loan && original.transaction_type === 'loan_repayment') {
      const reversedInterest = originalLines.filter((line) => line.account_code === '4100')
        .reduce((sum, line) => sum + decimalToCents(String(line.credit)) - decimalToCents(String(line.debit)), 0n);
      const reversedPenalty = originalLines.filter((line) => line.account_code === '4300')
        .reduce((sum, line) => sum + decimalToCents(String(line.credit)) - decimalToCents(String(line.debit)), 0n);
      const outstanding = (await client.query(
        `SELECT COALESCE(sum(l.debit-l.credit),0)::numeric(16,2) AS value
         FROM mfi_journal_lines l JOIN mfi_journals j
           ON j.id=l.journal_id AND j.institution_id=l.institution_id AND j.status='posted'
         WHERE l.institution_id=$1 AND l.member_account_id=$2`,
        [req.params.institutionId, loan.member_account_id],
      )).rows[0].value as string;
      const outstandingCents = decimalToCents(outstanding);
      const repaidCents = decimalToCents(String(loan.principal_amount)) - outstandingCents;
      const isRepaid = repaidCents === decimalToCents(String(loan.principal_amount));
      await client.query(
        `UPDATE mfi_loans SET principal_repaid=$3, status=$4 WHERE institution_id=$1 AND id=$2`,
        [req.params.institutionId, original.loan_id, centsToAmount(repaidCents), isRepaid ? 'repaid' : 'disbursed'],
      );
      await allocateLoanPrincipal(client, req.params.institutionId, String(original.loan_id), centsToAmount(repaidCents));
      await reverseServicingAllocation(client, req.params.institutionId, String(original.loan_id),
        centsToAmount(reversedInterest), centsToAmount(reversedPenalty));
    }
    await auditMfi(client, req.params.institutionId, req.user!.id, 'mfi_journal_reversed', 'mfi_journal', original.id, {
      status: 'posted',
    }, { reversal_id: journal.id, reason: body.reason });
    return journal;
  });
  res.status(reversal.replayed ? 200 : 201).json(reversal);
}));

mfiRouter.get('/institutions/:institutionId/members', h(async (req, res) => {
  const result = await withInstitution(req.user!, req.params.institutionId, viewRoles, async (client, role) => {
    const rows = (await client.query(
      `SELECT m.id, m.member_number, m.full_name, m.phone, m.email, m.status, m.kyc_status,m.kyc_reviewed_by,m.kyc_reviewed_at,m.created_at,
         m.created_by, m.reviewed_by, m.reviewed_at,
         count(a.id)::int AS account_count
       FROM mfi_members m
       LEFT JOIN mfi_member_accounts a ON a.institution_id=m.institution_id AND a.member_id=m.id
       WHERE m.institution_id=$1
      GROUP BY m.id ORDER BY m.created_at DESC LIMIT 200`,
      [req.params.institutionId],
    )).rows;
    // Contact details are only needed for member servicing, compliance review,
    // and audit. Tellers and other operational roles receive the minimum list data.
    const canViewContactDetails = ['institution_admin', 'loan_officer', 'compliance', 'auditor'].includes(role);
    return canViewContactDetails ? rows : rows.map(({ phone: _phone, email: _email, ...member }) => member);
  });
  res.json(result);
}));

mfiRouter.post('/institutions/:institutionId/members', h(async (req, res) => {
  const body = z.object({
    full_name: z.string().trim().min(2).max(160),
    phone: Phone,
    email: z.union([z.string().trim().email().max(254), z.literal('')]).optional(),
  }).parse(req.body);
  const member = await withInstitution(req.user!, req.params.institutionId, ['institution_admin', 'loan_officer', 'compliance'], async (client) => {
    const memberNumber = 'M-' + (await client.query("SELECT lpad(nextval('mfi_member_seq')::text, 8, '0') AS value")).rows[0].value;
    const row = (await client.query(
      `INSERT INTO mfi_members (institution_id, member_number, full_name, phone, email, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.institutionId, memberNumber, body.full_name, body.phone, body.email || null, req.user!.id],
    )).rows[0];
    await auditMfi(client, req.params.institutionId, req.user!.id, 'mfi_member_created', 'mfi_member', row.id, null, {
      member_number: row.member_number, full_name: row.full_name, phone: row.phone,
    });
    return row;
  });
  res.status(201).json(member);
}));

mfiRouter.post('/institutions/:institutionId/members/:memberId/review', h(async (req, res) => {
  const body = z.object({
    decision: z.enum(['activate', 'reject']),
    reason: z.string().trim().min(10).max(1000),
  }).parse(req.body);
  const member = await withInstitution(req.user!, req.params.institutionId, ['institution_admin', 'compliance'], async (client) => {
    const old = (await client.query(
      'SELECT * FROM mfi_members WHERE institution_id=$1 AND id=$2 FOR UPDATE',
      [req.params.institutionId, req.params.memberId],
    )).rows[0];
    if (!old) throw new HttpError(404, 'Member not found');
    if (old.status !== 'pending') throw new HttpError(409, `Member is already ${old.status}`);
    if (old.created_by === req.user!.id) throw new HttpError(409, 'The member registrar cannot review their own submission');
    const updated = (await client.query(
      `UPDATE mfi_members SET status=$3, reviewed_by=$4, reviewed_at=now()
       WHERE institution_id=$1 AND id=$2 RETURNING *`,
      [req.params.institutionId, req.params.memberId, body.decision === 'activate' ? 'active' : 'rejected', req.user!.id],
    )).rows[0];
    await auditMfi(client, req.params.institutionId, req.user!.id, 'mfi_member_' + body.decision, 'mfi_member', old.id, { status: old.status }, {
      status: updated.status, reason: body.reason,
    });
    return updated;
  });
  res.json(member);
}));

mfiRouter.post('/institutions/:institutionId/members/:memberId/kyc-review', h(async (req, res) => {
  const body = z.object({ decision: z.enum(['verified','rejected']), reason: z.string().trim().min(10).max(1000) }).strict().parse(req.body);
  const member = await withInstitution(req.user!, req.params.institutionId, ['institution_admin','compliance'], async (client) => {
    const current = (await client.query(
      `SELECT id,created_by,kyc_status,kyc_reviewed_by FROM mfi_members
       WHERE institution_id=$1 AND id=$2 FOR UPDATE`, [req.params.institutionId,req.params.memberId],
    )).rows[0];
    if (!current) throw new HttpError(404,'Member not found');
    if (current.created_by===req.user!.id || current.kyc_reviewed_by===req.user!.id) {
      throw new HttpError(409,'The registrar and previous KYC reviewer cannot review this KYC decision');
    }
    if (current.kyc_status===body.decision) throw new HttpError(409,`Member KYC is already ${body.decision}`);
    if(body.decision==='verified' && !(await client.query(
      `SELECT 1 FROM mfi_loan_documents WHERE institution_id=$1 AND member_id=$2 AND document_type='national_id'
       AND status='verified' AND reviewed_by<>$3 LIMIT 1`,[req.params.institutionId,current.id,req.user!.id],
    )).rowCount)throw new HttpError(409,'A national ID document must be independently verified before member KYC can be verified');
    const updated=(await client.query(
      `UPDATE mfi_members SET kyc_status=$3,kyc_reviewed_by=$4,kyc_reviewed_at=now(),kyc_review_reason=$5
       WHERE institution_id=$1 AND id=$2 RETURNING id,member_number,kyc_status,kyc_reviewed_by,kyc_reviewed_at,kyc_review_reason`,
      [req.params.institutionId,req.params.memberId,body.decision,req.user!.id,body.reason],
    )).rows[0];
    await auditMfi(client,req.params.institutionId,req.user!.id,'mfi_member_kyc_'+body.decision,'mfi_member',current.id,
      {kyc_status:current.kyc_status},{kyc_status:updated.kyc_status,reason:body.reason});
    return updated;
  });
  res.json(member);
}));

mfiRouter.post('/institutions/:institutionId/members/:memberId/documents/:documentType',
  express.raw({type:()=>true,limit:'10mb'}), h(async(req,res)=>{
    const documentType=z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_-]{1,79}$/).parse(req.params.documentType);
    const file=req.body as Buffer;
    if(!Buffer.isBuffer(file)||file.length===0)throw new HttpError(400,'Choose a document file to upload');
    const mime=sniff(file);
    if(!mime)throw new HttpError(415,'Only PDF, JPEG, or PNG identity and supporting documents are accepted');
    const row=await withInstitution(req.user!,req.params.institutionId,
      ['institution_admin','loan_officer','compliance'],async(client)=>{
        if(!(await client.query('SELECT id FROM mfi_members WHERE institution_id=$1 AND id=$2',
          [req.params.institutionId,req.params.memberId])).rowCount)throw new HttpError(404,'Member not found');
        await assertCleanUpload(file);
        const storageKey=randomUUID();
        const document=(await client.query(
          `INSERT INTO mfi_loan_documents(institution_id,member_id,document_type,storage_key,sha256,mime,size_bytes,uploaded_by)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8)
           RETURNING id,member_id,document_type,status,mime,size_bytes,created_at`,
          [req.params.institutionId,req.params.memberId,documentType,storageKey,createHash('sha256').update(file).digest('hex'),mime,file.length,req.user!.id],
        )).rows[0];
        await putFile(storageKey,file);
        await auditMfi(client,req.params.institutionId,req.user!.id,'mfi_loan_document_uploaded','mfi_loan_document',document.id,null,
          {member_id:req.params.memberId,document_type:documentType,mime,size_bytes:file.length});
        return document;
      });
    res.status(201).json(row);
  }));

mfiRouter.get('/institutions/:institutionId/members/:memberId/documents',h(async(req,res)=>{
  const rows=await withInstitution(req.user!,req.params.institutionId,viewRoles,async(client)=>(await client.query(
    `SELECT id,document_type,status,mime,size_bytes,uploaded_by,reviewed_by,reviewed_at,review_reason,created_at
     FROM mfi_loan_documents WHERE institution_id=$1 AND member_id=$2 ORDER BY created_at DESC`,
    [req.params.institutionId,req.params.memberId],
  )).rows);
  res.json(rows);
}));

mfiRouter.get('/institutions/:institutionId/documents',h(async(req,res)=>{
  const rows=await withInstitution(req.user!,req.params.institutionId,['institution_admin','compliance','auditor'],async(client)=>(await client.query(
    `SELECT document.id,document.member_id,member.member_number,member.full_name AS member_name,
       document.document_type,document.status,document.mime,document.size_bytes,document.uploaded_by,
       document.reviewed_by,document.reviewed_at,document.review_reason,document.created_at
     FROM mfi_loan_documents document JOIN mfi_members member
       ON member.id=document.member_id AND member.institution_id=document.institution_id
     WHERE document.institution_id=$1 AND ($2::text IS NULL OR document.status=$2)
     ORDER BY document.created_at DESC LIMIT 300`,
    [req.params.institutionId,req.query.status ? z.enum(['uploaded','verified','rejected']).parse(req.query.status) : null],
  )).rows);
  res.json(rows);
}));

mfiRouter.get('/institutions/:institutionId/documents/:documentId/file',h(async(req,res)=>{
  const document=await withInstitution(req.user!,req.params.institutionId,
    ['institution_admin','loan_officer','compliance','auditor'],async(client)=>{
      const row=(await client.query(
        `SELECT id,storage_key,mime FROM mfi_loan_documents WHERE institution_id=$1 AND id=$2`,
        [req.params.institutionId,req.params.documentId],
      )).rows[0];
      if(!row)throw new HttpError(404,'Loan document not found');
      await auditMfi(client,req.params.institutionId,req.user!.id,'mfi_loan_document_downloaded','mfi_loan_document',row.id);
      return row;
    });
  res.set({'Content-Type':document.mime,'Content-Disposition':'attachment','X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'})
    .send(await getFile(document.storage_key));
}));

mfiRouter.post('/institutions/:institutionId/documents/:documentId/review',h(async(req,res)=>{
  const body=z.object({decision:z.enum(['verified','rejected']),reason:z.string().trim().min(10).max(1000)}).strict().parse(req.body);
  const result=await withInstitution(req.user!,req.params.institutionId,['institution_admin','compliance'],async(client)=>{
    const current=(await client.query(
      `SELECT id,member_id,document_type,status,uploaded_by FROM mfi_loan_documents
       WHERE institution_id=$1 AND id=$2 FOR UPDATE`,[req.params.institutionId,req.params.documentId],
    )).rows[0];
    if(!current)throw new HttpError(404,'Pending loan document not found');
    if(current.status!=='uploaded')throw new HttpError(409,'Loan document has already been reviewed');
    if(current.uploaded_by===req.user!.id)throw new HttpError(409,'The document uploader cannot review their own upload');
    const updated=(await client.query(
      `UPDATE mfi_loan_documents SET status=$3,reviewed_by=$4,reviewed_at=now(),review_reason=$5
       WHERE institution_id=$1 AND id=$2 RETURNING id,member_id,document_type,status,reviewed_by,reviewed_at,review_reason`,
      [req.params.institutionId,current.id,body.decision,req.user!.id,body.reason],
    )).rows[0];
    await auditMfi(client,req.params.institutionId,req.user!.id,'mfi_loan_document_'+body.decision,'mfi_loan_document',current.id,
      {status:current.status},{status:updated.status,reason:body.reason});
    return updated;
  });
  res.json(result);
}));

mfiRouter.post('/institutions/:institutionId/members/:memberId/lifecycle', h(async (req, res) => {
  const body = z.object({ action: z.enum(['suspend','reactivate','close']), reason: z.string().trim().min(10).max(1000) }).parse(req.body);
  const member = await withInstitution(req.user!, req.params.institutionId, ['institution_admin','compliance'], async (client) => {
    const prior = (await client.query(
      'SELECT * FROM mfi_members WHERE institution_id=$1 AND id=$2 FOR UPDATE', [req.params.institutionId, req.params.memberId],
    )).rows[0];
    if (!prior) throw new HttpError(404, 'Member not found');
    const targets = { suspend: 'suspended', reactivate: 'active', close: 'closed' } as const;
    const next = targets[body.action];
    const allowed = body.action === 'suspend' ? prior.status === 'active'
      : body.action === 'reactivate' ? prior.status === 'suspended' : ['active','suspended'].includes(prior.status);
    if (!allowed) throw new HttpError(409, `Cannot ${body.action} a member with status ${prior.status}`);
    if (prior.created_by === req.user!.id || prior.reviewed_by === req.user!.id) {
      throw new HttpError(409, 'A different staff member must perform this member lifecycle action');
    }
    if (body.action === 'close') {
      const exposure = (await client.query(
        `SELECT
           COALESCE((SELECT sum(CASE WHEN a.account_type='loan' THEN l.debit-l.credit ELSE l.credit-l.debit END)
             FROM mfi_member_accounts a LEFT JOIN mfi_journal_lines l ON l.institution_id=a.institution_id AND l.member_account_id=a.id
             LEFT JOIN mfi_journals j ON j.id=l.journal_id AND j.institution_id=l.institution_id AND j.status='posted'
             WHERE a.institution_id=$1 AND a.member_id=$2 AND a.account_type<>'loan'),0)::numeric(16,2) AS deposit_balance,
           COALESCE((SELECT sum(principal_amount-principal_repaid) FROM mfi_loans
             WHERE institution_id=$1 AND member_id=$2 AND status IN ('disbursed','repaid')),0)::numeric(16,2) AS loan_balance`,
        [req.params.institutionId, prior.id],
      )).rows[0];
      if (decimalToCents(String(exposure.deposit_balance)) !== 0n || decimalToCents(String(exposure.loan_balance)) !== 0n) {
        throw new HttpError(409, 'Settle all member savings, shares, and loan balances before closing membership');
      }
    }
    const updated = (await client.query(
      `UPDATE mfi_members SET status=$3, lifecycle_updated_by=$4, lifecycle_updated_at=now()
       WHERE institution_id=$1 AND id=$2 RETURNING *`, [req.params.institutionId, prior.id, next, req.user!.id],
    )).rows[0];
    await client.query(
      `INSERT INTO mfi_member_lifecycle_events (institution_id, member_id, prior_status, next_status, reason, actor_id)
       VALUES ($1,$2,$3,$4,$5,$6)`, [req.params.institutionId, prior.id, prior.status, next, body.reason, req.user!.id],
    );
    await auditMfi(client, req.params.institutionId, req.user!.id, `mfi_member_${body.action}d`, 'mfi_member', prior.id,
      { status: prior.status }, { status: next, reason: body.reason });
    return updated;
  });
  res.json(member);
}));

mfiRouter.get('/institutions/:institutionId/products', h(async (req, res) => {
  const rows = await withInstitution(req.user!, req.params.institutionId, viewRoles, async (client) =>
    (await client.query(
      `SELECT id, product_code, name, product_type, minimum_balance, active
       FROM mfi_products WHERE institution_id=$1 ORDER BY product_type, product_code`,
      [req.params.institutionId],
    )).rows,
  );
  res.json(rows);
}));

mfiRouter.get('/institutions/:institutionId/loan-products', h(async (req, res) => {
  const rows = await withInstitution(req.user!, req.params.institutionId, viewRoles, async (client) =>
    (await client.query(
      `SELECT version.id,product.product_code,product.name,version.version,version.status,version.terms,
              version.change_reason,version.created_by,version.approved_by,version.approved_at,
              version.review_reason,version.created_at
       FROM mfi_loan_product_versions version
       JOIN mfi_products product ON product.id=version.product_id AND product.institution_id=version.institution_id
       WHERE version.institution_id=$1 ORDER BY product.product_code,version.version DESC LIMIT 300`,
      [req.params.institutionId],
    )).rows,
  );
  res.json(rows);
}));

mfiRouter.post('/institutions/:institutionId/loan-products', h(async (req, res) => {
  const body = z.object({ terms: lendingProductTermsSchema, change_reason: z.string().trim().min(10).max(1000) }).strict().parse(req.body);
  const result = await withInstitution(req.user!, req.params.institutionId, ['institution_admin','credit_manager'], async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))', [req.params.institutionId, body.terms.product_code]);
    let product = (await client.query(
      `SELECT id,product_type,active FROM mfi_products WHERE institution_id=$1 AND product_code=$2 FOR UPDATE`,
      [req.params.institutionId, body.terms.product_code],
    )).rows[0];
    if (product && product.product_type !== 'loan') throw new HttpError(409, 'This product code is already used for a non-loan product');
    if (!product) product = (await client.query(
      `INSERT INTO mfi_products(institution_id,product_code,name,product_type,active)
       VALUES($1,$2,$3,'loan',false) RETURNING id,product_type,active`,
      [req.params.institutionId, body.terms.product_code, body.terms.name],
    )).rows[0];
    const pending = await client.query(
      `SELECT id FROM mfi_loan_product_versions
       WHERE institution_id=$1 AND product_id=$2 AND status='pending_approval'`,
      [req.params.institutionId, product.id],
    );
    if (pending.rowCount) throw new HttpError(409, 'Review or reject the pending version before submitting another product change');
    const version = Number((await client.query(
      `SELECT coalesce(max(version),0)+1 AS version FROM mfi_loan_product_versions
       WHERE institution_id=$1 AND product_id=$2`, [req.params.institutionId, product.id],
    )).rows[0].version);
    const created = (await client.query(
      `INSERT INTO mfi_loan_product_versions(institution_id,product_id,version,terms,change_reason,created_by)
       VALUES($1,$2,$3,$4::jsonb,$5,$6)
       RETURNING id,version,status,terms,change_reason,created_by,created_at`,
      [req.params.institutionId, product.id, version, JSON.stringify(body.terms), body.change_reason, req.user!.id],
    )).rows[0];
    await auditMfi(client, req.params.institutionId, req.user!.id, 'mfi_loan_product_submitted', 'mfi_loan_product_version', created.id, null, {
      product_code: body.terms.product_code, version, change_reason: body.change_reason,
    });
    return { ...created, product_code: body.terms.product_code, product_active: product.active };
  });
  res.status(201).json(result);
}));

mfiRouter.post('/institutions/:institutionId/loan-products/:versionId/decision', h(async (req, res) => {
  const versionId = z.string().uuid().parse(req.params.versionId);
  const body = z.object({ decision: z.enum(['approve','reject']), reason: z.string().trim().min(10).max(1000) }).strict().parse(req.body);
  const result = await withInstitution(req.user!, req.params.institutionId, ['institution_admin','credit_manager'], async (client) => {
    const pending = (await client.query(
      `SELECT version.*,product.product_code,product.name AS product_name
       FROM mfi_loan_product_versions version
       JOIN mfi_products product ON product.id=version.product_id AND product.institution_id=version.institution_id
       WHERE version.institution_id=$1 AND version.id=$2 AND version.status='pending_approval' FOR UPDATE OF version,product`,
      [req.params.institutionId, versionId],
    )).rows[0];
    if (!pending) throw new HttpError(404, 'Pending loan product version was not found');
    if (pending.created_by === req.user!.id) throw new HttpError(403, 'The product maker cannot review their own product version');
    const terms = lendingProductTermsSchema.parse(pending.terms);
    if (body.decision === 'approve') {
      await client.query(
        `UPDATE mfi_loan_product_versions SET status='superseded'
         WHERE institution_id=$1 AND product_id=$2 AND status='active'`,
        [req.params.institutionId, pending.product_id],
      );
    }
    const updated = (await client.query(
      `UPDATE mfi_loan_product_versions SET status=$3,approved_by=$4,approved_at=now(),review_reason=$5
       WHERE institution_id=$1 AND id=$2
       RETURNING id,version,status,terms,approved_by,approved_at,review_reason`,
      [req.params.institutionId, versionId, body.decision === 'approve' ? 'active' : 'rejected', req.user!.id, body.reason],
    )).rows[0];
    if (body.decision === 'approve') await client.query(
      `UPDATE mfi_products SET name=$3,active=true WHERE institution_id=$1 AND id=$2`,
      [req.params.institutionId, pending.product_id, terms.name],
    );
    await auditMfi(client, req.params.institutionId, req.user!.id, `mfi_loan_product_${body.decision}d`, 'mfi_loan_product_version', versionId,
      { status: 'pending_approval' }, { status: updated.status, product_code: pending.product_code, version: pending.version, reason: body.reason });
    return updated;
  });
  res.json(result);
}));

mfiRouter.get('/institutions/:institutionId/disbursement-limits',h(async(req,res)=>{
  const rows=await withInstitution(req.user!,req.params.institutionId,viewRoles,async(client)=>(await client.query(
    `SELECT id,version,daily_limit::text,status,change_reason,created_by,approved_by,approved_at,review_reason,created_at
     FROM mfi_disbursement_limit_versions WHERE institution_id=$1 ORDER BY version DESC LIMIT 100`,[req.params.institutionId])).rows);
  res.json(rows);
}));

mfiRouter.post('/institutions/:institutionId/disbursement-limits',h(async(req,res)=>{
  const body=z.object({daily_limit:z.union([amountSchema,z.null()]),change_reason:z.string().trim().min(10).max(1000)}).strict().parse(req.body);
  const row=await withInstitution(req.user!,req.params.institutionId,['institution_admin','finance_manager'],async(client)=>{
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',[req.params.institutionId,'daily-disbursement-limit']);
    if((await client.query("SELECT 1 FROM mfi_disbursement_limit_versions WHERE institution_id=$1 AND status='pending_approval'",[req.params.institutionId])).rowCount)
      throw new HttpError(409,'Review the pending disbursement limit proposal first');
    const version=Number((await client.query('SELECT coalesce(max(version),0)+1 AS version FROM mfi_disbursement_limit_versions WHERE institution_id=$1',[req.params.institutionId])).rows[0].version);
    const created=(await client.query(`INSERT INTO mfi_disbursement_limit_versions(institution_id,version,daily_limit,change_reason,created_by)
      VALUES($1,$2,$3,$4,$5) RETURNING id,version,daily_limit::text,status,created_by,created_at`,
      [req.params.institutionId,version,body.daily_limit,body.change_reason,req.user!.id])).rows[0];
    await auditMfi(client,req.params.institutionId,req.user!.id,'mfi_disbursement_limit_submitted','mfi_disbursement_limit',created.id,null,created);
    return created;
  });
  res.status(201).json(row);
}));

mfiRouter.post('/institutions/:institutionId/disbursement-limits/:versionId/decision',h(async(req,res)=>{
  const id=z.string().uuid().parse(req.params.versionId);
  const body=z.object({decision:z.enum(['approve','reject']),reason:z.string().trim().min(10).max(1000)}).strict().parse(req.body);
  const row=await withInstitution(req.user!,req.params.institutionId,['institution_admin','finance_manager'],async(client)=>{
    const pending=(await client.query("SELECT * FROM mfi_disbursement_limit_versions WHERE institution_id=$1 AND id=$2 AND status='pending_approval' FOR UPDATE",[req.params.institutionId,id])).rows[0];
    if(!pending)throw new HttpError(404,'Pending disbursement limit proposal not found');
    if(pending.created_by===req.user!.id)throw new HttpError(403,'The limit author cannot approve their own proposal');
    if(body.decision==='approve')await client.query("UPDATE mfi_disbursement_limit_versions SET status='superseded' WHERE institution_id=$1 AND status='active'",[req.params.institutionId]);
    const updated=(await client.query(`UPDATE mfi_disbursement_limit_versions SET status=$3,approved_by=$4,approved_at=now(),review_reason=$5
      WHERE id=$1 AND institution_id=$2 RETURNING id,version,daily_limit::text,status,approved_by,approved_at,review_reason`,
      [id,req.params.institutionId,body.decision==='approve'?'active':'rejected',req.user!.id,body.reason])).rows[0];
    await auditMfi(client,req.params.institutionId,req.user!.id,`mfi_disbursement_limit_${body.decision}d`,'mfi_disbursement_limit',id,pending,updated);
    return updated;
  });
  res.json(row);
}));

mfiRouter.get('/institutions/:institutionId/accounts', h(async (req, res) => {
  const rows = await withInstitution(req.user!, req.params.institutionId, viewRoles, async (client) =>
    (await client.query(
      `SELECT a.id, a.account_number, a.account_type, a.status, a.created_at,
         m.id AS member_id, m.member_number, m.full_name AS member_name,
         p.product_code, p.name AS product_name,
         COALESCE(sum(CASE WHEN j.status='posted' THEN
           CASE WHEN a.account_type='loan' THEN l.debit-l.credit ELSE l.credit-l.debit END ELSE 0 END),0)::numeric(16,2) AS balance
       FROM mfi_member_accounts a
       JOIN mfi_members m ON m.id=a.member_id AND m.institution_id=a.institution_id
       JOIN mfi_products p ON p.id=a.product_id AND p.institution_id=a.institution_id
       LEFT JOIN mfi_journal_lines l ON l.member_account_id=a.id AND l.institution_id=a.institution_id
       LEFT JOIN mfi_journals j ON j.id=l.journal_id AND j.institution_id=l.institution_id AND j.status='posted'
       WHERE a.institution_id=$1
       GROUP BY a.id, m.id, p.id ORDER BY a.created_at DESC LIMIT 200`,
      [req.params.institutionId],
    )).rows,
  );
  res.json(rows);
}));

mfiRouter.post('/institutions/:institutionId/members/:memberId/accounts', h(async (req, res) => {
  const body = z.object({ product_id: z.string().uuid() }).parse(req.body);
  const account = await withInstitution(req.user!, req.params.institutionId, ['institution_admin', 'loan_officer', 'teller'], async (client) => {
    const member = (await client.query(
      'SELECT * FROM mfi_members WHERE institution_id=$1 AND id=$2 FOR SHARE',
      [req.params.institutionId, req.params.memberId],
    )).rows[0];
    if (!member) throw new HttpError(404, 'Member not found');
    if (member.status !== 'active') throw new HttpError(409, 'Only an active member can open an account');
    const product = (await client.query(
      'SELECT * FROM mfi_products WHERE institution_id=$1 AND id=$2 AND active',
      [req.params.institutionId, body.product_id],
    )).rows[0];
    if (!product || product.product_type === 'loan') throw new HttpError(400, 'Choose an active savings or share product');
    const row = (await client.query(
      `INSERT INTO mfi_member_accounts (institution_id, member_id, product_id, account_number, account_type, opened_by)
       VALUES ($1,$2,$3,'A-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),$4,$5)
       RETURNING *`,
      [req.params.institutionId, req.params.memberId, body.product_id, product.product_type, req.user!.id],
    )).rows[0];
    await auditMfi(client, req.params.institutionId, req.user!.id, 'mfi_member_account_opened', 'mfi_member_account', row.id, null, {
      account_number: row.account_number, account_type: row.account_type, product_code: product.product_code,
    });
    return row;
  });
  res.status(201).json(account);
}));

const transactionBody = z.object({
  idempotency_key: z.string().uuid(),
  amount: amountSchema,
});

mfiRouter.post('/institutions/:institutionId/accounts/:accountId/transactions', h(async (req, res) => {
  const body = z.object({
    ...transactionBody.shape,
    transaction_type: z.enum(['savings_deposit', 'savings_withdrawal', 'share_contribution']),
  }).parse(req.body);
  const result = await withInstitution(req.user!, req.params.institutionId, ['institution_admin', 'finance_manager', 'teller'], async (client) => {
    const replay = await findJournalReplay(client, {
      institutionId: req.params.institutionId, idempotencyKey: body.idempotency_key,
      type: body.transaction_type, memberAccountId: req.params.accountId, amount: body.amount,
    });
    if (replay) return replay;
    const account = (await client.query(
      `SELECT a.*, p.minimum_balance
       FROM mfi_member_accounts a JOIN mfi_products p ON p.id=a.product_id AND p.institution_id=a.institution_id
       JOIN mfi_members m ON m.id=a.member_id AND m.institution_id=a.institution_id
       WHERE a.institution_id=$1 AND a.id=$2 AND m.status='active'
       FOR UPDATE OF a`,
      [req.params.institutionId, req.params.accountId],
    )).rows[0];
    if (!account || account.status !== 'active') throw new HttpError(404, 'Active member account not found');
    const afterLockReplay = await findJournalReplay(client, {
      institutionId: req.params.institutionId, idempotencyKey: body.idempotency_key,
      type: body.transaction_type, memberAccountId: req.params.accountId, amount: body.amount,
    });
    if (afterLockReplay) return afterLockReplay;
    const typeMap = { savings_deposit: 'savings', savings_withdrawal: 'savings', share_contribution: 'share' } as const;
    if (account.account_type !== typeMap[body.transaction_type]) throw new HttpError(409, 'Transaction type does not match the member account');
    await lockCashAccount(client, req.params.institutionId);
    if (body.transaction_type === 'savings_withdrawal') {
      const balance = (await client.query(
        `SELECT COALESCE(sum(l.credit-l.debit),0)::numeric(16,2) AS value
         FROM mfi_journal_lines l JOIN mfi_journals j
           ON j.id=l.journal_id AND j.institution_id=l.institution_id AND j.status='posted'
         WHERE l.institution_id=$1 AND l.member_account_id=$2`,
        [req.params.institutionId, account.id],
      )).rows[0].value as string;
      if (decimalToCents(balance) - decimalToCents(body.amount) < decimalToCents(String(account.minimum_balance))) {
        throw new HttpError(409, 'Withdrawal would breach the product minimum balance');
      }
      if (decimalToCents(await cashBalance(client, req.params.institutionId)) < decimalToCents(body.amount)) {
        throw new HttpError(409, 'The institution has insufficient cash for this withdrawal');
      }
    }
    const deposit = body.transaction_type !== 'savings_withdrawal';
    const memberCode = account.account_type === 'share' ? '3100' : '2100';
    const entry = await postJournal(client, {
      institutionId: req.params.institutionId,
      idempotencyKey: body.idempotency_key,
      type: body.transaction_type,
      memberAccountId: account.id,
      amount: body.amount,
      actorId: req.user!.id,
      requiresApproval: true,
      lines: deposit
        ? [{ code: '1000', debit: normalizeAmount(body.amount), credit: '0' },
          { code: memberCode, memberAccountId: account.id, debit: '0', credit: normalizeAmount(body.amount) }]
        : [{ code: memberCode, memberAccountId: account.id, debit: normalizeAmount(body.amount), credit: '0' },
          { code: '1000', debit: '0', credit: normalizeAmount(body.amount) }],
    });
    return entry;
  });
  res.status(result.replayed ? 200 : 201).json(result);
}));

mfiRouter.get('/institutions/:institutionId/loans', h(async (req, res) => {
  const rows = await withInstitution(req.user!, req.params.institutionId, viewRoles, async (client, role) =>
    (await client.query(
      `SELECT l.id,l.member_id,l.product_id,l.member_account_id,l.principal_amount,l.term_months,l.status,
         l.created_by,l.checked_by,l.decision_reason,l.disbursed_by,l.principal_repaid,l.created_at,l.reviewed_at,l.disbursed_at,
         CASE WHEN $2::boolean THEN l.purpose END AS purpose,
         l.credit_score,l.credit_scorecard_version,l.application_submitted_at,l.offer_accepted_at,
         CASE WHEN $2::boolean THEN l.monthly_income END AS monthly_income,
         CASE WHEN $2::boolean THEN l.monthly_expenses END AS monthly_expenses,
         CASE WHEN $2::boolean THEN l.monthly_debt END AS monthly_debt,
         CASE WHEN $2::boolean THEN l.credit_score_factors END AS credit_score_factors,
         l.npl_status,l.npl_classified_at,l.npl_reason,m.member_number,m.full_name AS member_name,
         COALESCE(sum(CASE WHEN jl.member_account_id=l.member_account_id AND j.status='posted' THEN jl.debit-jl.credit ELSE 0 END),0)::numeric(16,2) AS outstanding_principal,
         COALESCE((SELECT GREATEST(0,current_date-min(i.due_on))::int FROM mfi_loan_installments i
           WHERE i.institution_id=l.institution_id AND i.loan_id=l.id AND i.status<>'paid' AND i.due_on<current_date),0) AS days_past_due,
         COALESCE((SELECT jsonb_agg(jsonb_build_object('installment_no',i.installment_no,'due_on',i.due_on,
           'principal_due',i.principal_due,'principal_paid',i.principal_paid,'status',i.status) ORDER BY i.installment_no)
           FROM mfi_loan_installments i WHERE i.institution_id=l.institution_id AND i.loan_id=l.id),'[]'::jsonb) AS schedule
       FROM mfi_loans l JOIN mfi_members m ON m.id=l.member_id AND m.institution_id=l.institution_id
       LEFT JOIN mfi_journal_lines jl ON jl.institution_id=l.institution_id AND jl.member_account_id=l.member_account_id
       LEFT JOIN mfi_journals j ON j.id=jl.journal_id AND j.institution_id=jl.institution_id
       WHERE l.institution_id=$1
       GROUP BY l.id,m.member_number,m.full_name ORDER BY l.created_at DESC LIMIT 200`,
      [req.params.institutionId, ['institution_admin','credit_manager','compliance','auditor'].includes(role)],
    )).rows,
  );
  res.json(rows);
}));

mfiRouter.get('/institutions/:institutionId/loans/:loanId/installments', h(async (req, res) => {
  const rows = await withInstitution(req.user!, req.params.institutionId, viewRoles, async (client) =>
    (await client.query(
      `SELECT installment_no,due_on,principal_due,principal_paid,interest_due,interest_paid,penalty_due,penalty_paid,status,
         GREATEST(0,current_date-due_on)::int AS days_past_due
       FROM mfi_loan_installments WHERE institution_id=$1 AND loan_id=$2 ORDER BY installment_no`,
      [req.params.institutionId, req.params.loanId],
    )).rows,
  );
  res.json(rows);
}));

mfiRouter.get('/institutions/:institutionId/collections', h(async (req, res) => {
  const rows = await withInstitution(req.user!, req.params.institutionId,
    ['institution_admin','finance_manager','credit_manager','loan_officer','compliance','auditor'], async (client) =>
    (await client.query(
      `SELECT c.id, c.loan_id, c.status, c.created_by, c.assigned_to, c.opened_at, c.next_action_at,
         l.member_id, m.member_number, m.full_name AS member_name, l.principal_amount, l.principal_repaid,
         COALESCE(i.scheduled_arrears,0)::numeric(16,2) AS scheduled_arrears,
         COALESCE(i.days_past_due,0)::int AS days_past_due,
         COALESCE(e.events,'[]'::jsonb) AS events
       FROM mfi_collection_cases c JOIN mfi_loans l ON l.id=c.loan_id AND l.institution_id=c.institution_id
       JOIN mfi_members m ON m.id=l.member_id AND m.institution_id=l.institution_id
       LEFT JOIN LATERAL (
         SELECT sum(principal_due-principal_paid) FILTER (WHERE status<>'paid' AND due_on<=current_date) AS scheduled_arrears,
           GREATEST(0,current_date-min(due_on) FILTER (WHERE status<>'paid' AND due_on<current_date))::int AS days_past_due
         FROM mfi_loan_installments WHERE institution_id=l.institution_id AND loan_id=l.id
       ) i ON true
       LEFT JOIN LATERAL (
         SELECT jsonb_agg(jsonb_build_object('event_type',event_type,'outcome',outcome,'created_at',created_at)
           ORDER BY created_at DESC) AS events FROM mfi_collection_events
         WHERE institution_id=c.institution_id AND case_id=c.id
       ) e ON true
       WHERE c.institution_id=$1 ORDER BY c.opened_at DESC LIMIT 200`,
      [req.params.institutionId],
    )).rows,
  );
  res.json(rows);
}));

mfiRouter.post('/institutions/:institutionId/loans/:loanId/collections', h(async (req, res) => {
  const body = z.object({ assigned_to: z.string().uuid().optional(), reason: z.string().trim().min(10).max(1000) }).parse(req.body);
  const result = await withInstitution(req.user!, req.params.institutionId,
    ['institution_admin','finance_manager','credit_manager','loan_officer'], async (client) => {
    const loan = (await client.query(
      `SELECT id,status FROM mfi_loans WHERE institution_id=$1 AND id=$2 FOR UPDATE`, [req.params.institutionId, req.params.loanId],
    )).rows[0];
    if (!loan || loan.status !== 'disbursed') throw new HttpError(404, 'Outstanding disbursed loan not found');
    const existing = (await client.query(
      `SELECT * FROM mfi_collection_cases WHERE institution_id=$1 AND loan_id=$2 AND status IN ('open','promise_to_pay','escalated')`,
      [req.params.institutionId, loan.id],
    )).rows[0];
    if (existing) return { ...existing, replayed: true };
    if (body.assigned_to) {
      const assignee = (await client.query(
        `SELECT role FROM mfi_institution_memberships WHERE institution_id=$1 AND user_id=$2 AND active`,
        [req.params.institutionId, body.assigned_to],
      )).rows[0];
      if (!assignee || !['institution_admin','finance_manager','credit_manager','loan_officer'].includes(assignee.role)) {
        throw new HttpError(400, 'Assign the case to an active institution collection officer');
      }
    }
    const row = (await client.query(
      `INSERT INTO mfi_collection_cases (institution_id,loan_id,created_by,assigned_to)
       VALUES ($1,$2,$3,$4) RETURNING *`, [req.params.institutionId, loan.id, req.user!.id, body.assigned_to ?? req.user!.id],
    )).rows[0];
    await client.query(
      `INSERT INTO mfi_collection_events (institution_id,case_id,event_type,outcome,actor_id)
       VALUES ($1,$2,'note',$3,$4)`, [req.params.institutionId, row.id, body.reason, req.user!.id],
    );
    await auditMfi(client, req.params.institutionId, req.user!.id, 'mfi_collection_case_opened', 'mfi_collection_case', row.id, null, {
      loan_id: loan.id, assigned_to: row.assigned_to, reason: body.reason,
    });
    return row;
  });
  res.status(result.replayed ? 200 : 201).json(result);
}));

mfiRouter.post('/institutions/:institutionId/collections/:caseId/events', h(async (req, res) => {
  const body = z.object({
    event_type: z.enum(['contact','promise_to_pay','visit','escalation','note']),
    outcome: z.string().trim().min(2).max(1000),
    promised_amount: amountSchema.optional(),
    promised_on: z.string().date().optional(),
    next_action_at: z.string().datetime().optional(),
  }).superRefine((value, ctx) => {
    if (value.event_type === 'promise_to_pay' && (!value.promised_amount || !value.promised_on)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A promise requires an amount and date', path: ['promised_on'] });
    }
  }).parse(req.body);
  const row = await withInstitution(req.user!, req.params.institutionId,
    ['institution_admin','finance_manager','credit_manager','loan_officer'], async (client, role) => {
    const record = (await client.query(
      `SELECT * FROM mfi_collection_cases WHERE institution_id=$1 AND id=$2 AND status IN ('open','promise_to_pay','escalated') FOR UPDATE`,
      [req.params.institutionId, req.params.caseId],
    )).rows[0];
    if (!record) throw new HttpError(404, 'Open collection case not found');
    if (!['institution_admin','finance_manager','credit_manager'].includes(role) && record.assigned_to !== req.user!.id) {
      throw new HttpError(403, 'Only the assigned collection officer or a collection manager can update this case');
    }
    if (body.event_type === 'promise_to_pay') {
      const loan = (await client.query(
        `SELECT principal_amount-principal_repaid AS outstanding FROM mfi_loans WHERE institution_id=$1 AND id=$2`,
        [req.params.institutionId, record.loan_id],
      )).rows[0];
      const today = (await client.query('SELECT current_date::text AS today')).rows[0].today as string;
      if (body.promised_on! < today) throw new HttpError(400, 'Promise date cannot be in the past');
      if (decimalToCents(body.promised_amount!) > decimalToCents(String(loan.outstanding))) {
        throw new HttpError(409, 'Promised principal cannot exceed the outstanding loan balance');
      }
    }
    const saved = (await client.query(
      `INSERT INTO mfi_collection_events (institution_id,case_id,event_type,outcome,promised_amount,promised_on,next_action_at,actor_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.params.institutionId, record.id, body.event_type, body.outcome,
        body.promised_amount ? normalizeAmount(body.promised_amount) : null, body.promised_on ?? null,
        body.next_action_at ?? null, req.user!.id],
    )).rows[0];
    if (body.event_type === 'promise_to_pay' || body.event_type === 'escalation') {
      await client.query(
        `UPDATE mfi_collection_cases SET status=$3,next_action_at=$4 WHERE institution_id=$1 AND id=$2`,
        [req.params.institutionId, record.id, body.event_type === 'promise_to_pay' ? 'promise_to_pay' : 'escalated',
          body.next_action_at ?? (body.promised_on ? `${body.promised_on}T00:00:00Z` : null)],
      );
    }
    await auditMfi(client, req.params.institutionId, req.user!.id, `mfi_collection_${body.event_type}`, 'mfi_collection_case', record.id, null, {
      event_id: saved.id, outcome: body.outcome,
    });
    return saved;
  });
  res.status(201).json(row);
}));

mfiRouter.post('/institutions/:institutionId/collections/:caseId/close', h(async (req, res) => {
  const body = z.object({ status: z.enum(['resolved','closed']), reason: z.string().trim().min(10).max(1000) }).parse(req.body);
  const row = await withInstitution(req.user!, req.params.institutionId,
    ['institution_admin','finance_manager','credit_manager'], async (client) => {
    const record = (await client.query(
      `SELECT * FROM mfi_collection_cases WHERE institution_id=$1 AND id=$2 AND status IN ('open','promise_to_pay','escalated') FOR UPDATE`,
      [req.params.institutionId, req.params.caseId],
    )).rows[0];
    if (!record) throw new HttpError(404, 'Open collection case not found');
    if (record.created_by === req.user!.id) throw new HttpError(409, 'The collection case opener cannot close their own case');
    const updated = (await client.query(
      `UPDATE mfi_collection_cases SET status=$3,closed_at=now(),closed_by=$4,close_reason=$5,next_action_at=NULL
       WHERE institution_id=$1 AND id=$2 RETURNING *`,
      [req.params.institutionId, record.id, body.status, req.user!.id, body.reason],
    )).rows[0];
    await client.query(
      `INSERT INTO mfi_collection_events (institution_id,case_id,event_type,outcome,actor_id)
       VALUES ($1,$2,'resolution',$3,$4)`, [req.params.institutionId, record.id, body.reason, req.user!.id],
    );
    await auditMfi(client, req.params.institutionId, req.user!.id, 'mfi_collection_case_closed', 'mfi_collection_case', record.id,
      { status: record.status }, { status: body.status, reason: body.reason });
    return updated;
  });
  res.json(row);
}));

mfiRouter.get('/institutions/:institutionId/npl-events', h(async (req, res) => {
  const rows = await withInstitution(req.user!, req.params.institutionId,
    ['institution_admin','finance_manager','credit_manager','compliance','auditor'], async (client) =>
    (await client.query(
      `SELECT e.*,m.member_number,m.full_name AS member_name,l.principal_amount,l.principal_repaid,
         l.created_by,l.checked_by,l.disbursed_by,u.legal_name AS proposer_name
       FROM mfi_npl_events e JOIN mfi_loans l ON l.institution_id=e.institution_id AND l.id=e.loan_id
       JOIN mfi_members m ON m.institution_id=l.institution_id AND m.id=l.member_id
       JOIN users u ON u.id=e.proposed_by
       WHERE e.institution_id=$1 ORDER BY e.created_at DESC LIMIT 200`, [req.params.institutionId],
    )).rows,
  );
  res.json(rows);
}));

mfiRouter.post('/institutions/:institutionId/loans/:loanId/npl-classification', h(async (req, res) => {
  const body = z.object({ status: z.enum(['performing','watch','substandard','doubtful','loss']), reason: z.string().trim().min(10).max(1000) }).parse(req.body);
  const event = await withInstitution(req.user!, req.params.institutionId, ['institution_admin','credit_manager','compliance'], async (client) => {
    const loan = (await client.query(
      `SELECT * FROM mfi_loans WHERE institution_id=$1 AND id=$2 FOR UPDATE`, [req.params.institutionId, req.params.loanId],
    )).rows[0];
    if (!loan || !['disbursed','repaid'].includes(loan.status)) throw new HttpError(404, 'Serviced loan not found');
    if (loan.created_by === req.user!.id || loan.checked_by === req.user!.id || loan.disbursed_by === req.user!.id) {
      throw new HttpError(409, 'The loan originator, approver, or disburser cannot classify this loan');
    }
    if (loan.npl_status === body.status) throw new HttpError(409, `Loan is already classified as ${body.status}`);
    if ((await client.query(
      `SELECT 1 FROM mfi_npl_events WHERE institution_id=$1 AND loan_id=$2 AND status='pending_approval'`,
      [req.params.institutionId, loan.id],
    )).rowCount) throw new HttpError(409, 'An NPL classification is already awaiting independent review');
    {
      const active = (await client.query(
        `SELECT policy FROM mfi_credit_policy_versions WHERE institution_id=$1 AND status='active'`, [req.params.institutionId],
      )).rows[0];
      if (!active) throw new HttpError(409, 'An active delinquency policy is required for risk classification');
      const policy = creditPolicySchema.parse(active.policy);
      const due = (await client.query(
        `SELECT GREATEST(0,current_date-min(due_on) FILTER (WHERE status<>'paid' AND due_on<current_date))::int AS days_past_due
         FROM mfi_loan_installments WHERE institution_id=$1 AND loan_id=$2`,
        [req.params.institutionId, loan.id],
      )).rows[0];
      const dpd = Number(due?.days_past_due ?? 0);
      const minimumClass = dpd >= policy.delinquency.loss_days ? 'loss'
        : dpd >= policy.delinquency.doubtful_days ? 'doubtful'
          : dpd >= policy.delinquency.substandard_days ? 'substandard'
            : dpd >= policy.delinquency.watch_days ? 'watch' : 'performing';
      const rank = ['performing','watch','substandard','doubtful','loss'];
      if (rank.indexOf(body.status) < rank.indexOf(minimumClass)) {
        throw new HttpError(409, `Days past due (${dpd}) require at least ${minimumClass} classification under active policy`);
      }
    }
    const proposal = (await client.query(
      `INSERT INTO mfi_npl_events (institution_id,loan_id,prior_status,next_status,reason,proposed_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.institutionId, loan.id, loan.npl_status, body.status, body.reason, req.user!.id],
    )).rows[0];
    await auditMfi(client, req.params.institutionId, req.user!.id, 'mfi_loan_classification_proposed', 'mfi_npl_event', proposal.id,
      { status: loan.npl_status }, { status: body.status, reason: body.reason });
    return proposal;
  });
  res.status(201).json(event);
}));

mfiRouter.post('/institutions/:institutionId/npl-events/:eventId/decision', h(async (req, res) => {
  const body = z.object({ decision: z.enum(['approve','reject']), reason: z.string().trim().min(10).max(1000) }).parse(req.body);
  const result = await withInstitution(req.user!, req.params.institutionId, ['institution_admin','credit_manager'], async (client) => {
    const event = (await client.query(
      `SELECT * FROM mfi_npl_events WHERE institution_id=$1 AND id=$2 AND status='pending_approval' FOR UPDATE`,
      [req.params.institutionId, req.params.eventId],
    )).rows[0];
    if (!event) throw new HttpError(404, 'Pending NPL classification not found');
    if (event.proposed_by === req.user!.id) throw new HttpError(409, 'The classification proposer cannot approve their own proposal');
    const loan = (await client.query(
      `SELECT * FROM mfi_loans WHERE institution_id=$1 AND id=$2 FOR UPDATE`,
      [req.params.institutionId, event.loan_id],
    )).rows[0];
    if (!loan || loan.npl_status !== event.prior_status) throw new HttpError(409, 'Loan classification changed after this proposal; submit a new assessment');
    if (body.decision === 'approve' && [loan.created_by, loan.disbursed_by].includes(req.user!.id)) {
      throw new HttpError(409, 'The loan originator or disburser cannot approve its risk classification');
    }
    if (body.decision === 'approve') {
      {
        const active = (await client.query(
          `SELECT policy FROM mfi_credit_policy_versions WHERE institution_id=$1 AND status='active'`, [req.params.institutionId],
        )).rows[0];
        if (!active) throw new HttpError(409, 'An active delinquency policy is required');
        const policy = creditPolicySchema.parse(active.policy);
        const due = (await client.query(
          `SELECT GREATEST(0,current_date-min(due_on) FILTER (WHERE status<>'paid' AND due_on<current_date))::int AS days_past_due
           FROM mfi_loan_installments WHERE institution_id=$1 AND loan_id=$2`, [req.params.institutionId, loan.id],
        )).rows[0];
        const dpd = Number(due?.days_past_due ?? 0);
        const minimumClass = dpd >= policy.delinquency.loss_days ? 'loss' : dpd >= policy.delinquency.doubtful_days ? 'doubtful'
          : dpd >= policy.delinquency.substandard_days ? 'substandard' : dpd >= policy.delinquency.watch_days ? 'watch' : 'performing';
        const rank = ['performing','watch','substandard','doubtful','loss'];
        if (rank.indexOf(event.next_status) < rank.indexOf(minimumClass)) {
          throw new HttpError(409, `Days past due (${dpd}) require at least ${minimumClass} classification under active policy`);
        }
      }
      await client.query(
        `UPDATE mfi_loans SET npl_status=$3,npl_classified_at=now(),npl_reason=$4 WHERE institution_id=$1 AND id=$2`,
        [req.params.institutionId, loan.id, event.next_status, event.reason],
      );
    }
    const updated = (await client.query(
      `UPDATE mfi_npl_events SET status=$3,approved_by=$4,decision_reason=$5,reviewed_at=now()
       WHERE institution_id=$1 AND id=$2 RETURNING *`,
      [req.params.institutionId, event.id, body.decision === 'approve' ? 'approved' : 'rejected', req.user!.id, body.reason],
    )).rows[0];
    await auditMfi(client, req.params.institutionId, req.user!.id, `mfi_loan_classification_${body.decision}d`, 'mfi_npl_event', event.id,
      { status: 'pending_approval' }, { status: updated.status, reason: body.reason });
    return updated;
  });
  res.json(result);
}));

mfiRouter.post('/institutions/:institutionId/loans', h(async (req, res) => {
  const body = z.object({
    member_id: z.string().uuid(),
    product_id: z.string().uuid().optional(),
    product_code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,20}$/).optional(),
    principal_amount: amountSchema,
    term_months: z.number().int().min(1).max(360),
    purpose: z.string().trim().min(10).max(1000),
    monthly_income: z.string().regex(/^(?:0|[1-9]\d{0,13})(?:\.\d{1,2})?$/).refine((value) => decimalToCents(value) > 0n),
    monthly_expenses: z.string().regex(/^(?:0|[1-9]\d{0,13})(?:\.\d{1,2})?$/),
    monthly_debt: z.string().regex(/^(?:0|[1-9]\d{0,13})(?:\.\d{1,2})?$/),
    customer_category: z.enum(['employee','individual','petty_trader','formal_business','partnership','plc','student','youth_entrepreneur','agriculture','group_member']).default('group_member'),
    age: z.number().int().min(0).max(120).optional(),
    business_months: z.number().int().min(0).max(1200).optional(),
    employment_months: z.number().int().min(0).max(1200).optional(),
    equity_amount: amountSchema.optional(),
    collateral_value: amountSchema.optional(),
    supplied_documents: z.array(z.string().trim().min(2).max(80)).max(30).default([]),
    supplied_fields: z.array(z.string().trim().min(2).max(80)).max(30).default([]),
  }).refine((value) => value.product_id || value.product_code, { message: 'Choose a loan product' }).parse(req.body);
  const loan = await withInstitution(req.user!, req.params.institutionId, ['institution_admin', 'loan_officer'], async (client) => {
    const member = (await client.query(
      'SELECT id, created_at,kyc_status FROM mfi_members WHERE institution_id=$1 AND id=$2 AND status=\'active\' FOR UPDATE',
      [req.params.institutionId, body.member_id],
    )).rows[0];
    const product = (await client.query(
      `SELECT id,product_code FROM mfi_products
       WHERE institution_id=$1 AND product_type='loan' AND active
         AND ($2::uuid IS NULL OR id=$2) AND ($3::text IS NULL OR product_code=$3)`,
      [req.params.institutionId, body.product_id ?? null, body.product_code ?? null],
    )).rows[0];
    if (!member) throw new HttpError(404, 'Active member not found');
    if (member.kyc_status!=='verified') throw new HttpError(409,'Member KYC must be independently verified before applying for credit');
    const riskHold = (await client.query(
      `SELECT id,category FROM mfi_member_risk_flags WHERE institution_id=$1 AND member_id=$2 AND status='active' LIMIT 1`,
      [req.params.institutionId,body.member_id],
    )).rows[0];
    if (riskHold) throw new HttpError(409, `Member is on an approved ${riskHold.category} lending hold`);
    if (!product) throw new HttpError(400, 'Choose an active loan product');
    const activePolicyRow = (await client.query(
      `SELECT version, policy FROM mfi_credit_policy_versions WHERE institution_id=$1 AND status='active'`, [req.params.institutionId],
    )).rows[0];
    if (!activePolicyRow) throw new HttpError(409, 'An approved credit policy must be configured before accepting loan applications');
    const policy = creditPolicySchema.parse(activePolicyRow.policy);
    const versionRow = (await client.query(
      `SELECT id,terms FROM mfi_loan_product_versions
       WHERE institution_id=$1 AND product_id=$2 AND status='active'`,
      [req.params.institutionId, product.id],
    )).rows[0] ?? null;
    if (body.product_code && !versionRow) throw new HttpError(409, 'This loan product has no approved version yet');
    const productTerms = versionRow ? lendingProductTermsSchema.parse(versionRow.terms) : null;
    const verifiedDocuments=productTerms ? (await client.query(
      `SELECT DISTINCT document_type FROM mfi_loan_documents
       WHERE institution_id=$1 AND member_id=$2 AND status='verified'`,
      [req.params.institutionId,body.member_id],
    )).rows.map((row)=>String(row.document_type)) : [];
    if (productTerms && (productTerms.rejection_cooldown_days > 0 || productTerms.settlement_cooldown_days > 0)) {
      const recent = (await client.query(
        `SELECT max(l.reviewed_at) FILTER (WHERE l.status='rejected') AS rejected_at,
                max(j.posted_at) FILTER (WHERE l.status='repaid' AND j.transaction_type='loan_repayment') AS settled_at
         FROM mfi_loans l LEFT JOIN mfi_journals j
           ON j.institution_id=l.institution_id AND j.loan_id=l.id AND j.status='posted'
         WHERE l.institution_id=$1 AND l.member_id=$2`, [req.params.institutionId, body.member_id],
      )).rows[0];
      const rejectedDays = cooldownRemainingDays(recent.rejected_at, productTerms.rejection_cooldown_days);
      if (rejectedDays > 0) throw new HttpError(409, `Product rejection cooldown is active for ${rejectedDays} more day(s)`);
      const settlementDays = cooldownRemainingDays(recent.settled_at, productTerms.settlement_cooldown_days);
      if (settlementDays > 0) throw new HttpError(409, `Product settlement cooldown is active for ${settlementDays} more day(s)`);
    }
    const savingsBalance = (await client.query(
      `SELECT COALESCE(sum(l.credit-l.debit),0)::numeric(16,2) AS balance
       FROM mfi_member_accounts a JOIN mfi_journal_lines l ON l.institution_id=a.institution_id AND l.member_account_id=a.id
       JOIN mfi_journals j ON j.institution_id=l.institution_id AND j.id=l.journal_id AND j.status='posted'
       WHERE a.institution_id=$1 AND a.member_id=$2 AND a.account_type='savings'`,
      [req.params.institutionId, body.member_id],
    )).rows[0].balance as string;
    const history = (await client.query(
      `SELECT count(*) FILTER (WHERE status IN ('repaid','cancelled'))::int AS total,
              count(*) FILTER (WHERE status='repaid')::int AS repaid,
              count(*) FILTER (WHERE status IN ('pending','approved','disbursed'))::int AS active
       FROM mfi_loans WHERE institution_id=$1 AND member_id=$2`,
      [req.params.institutionId, body.member_id],
    )).rows[0];
    const membershipDays = Math.max(0, Math.floor((Date.now() - new Date(member.created_at).getTime()) / 86400000));
    let proposedMonthlyPayment: string | undefined;
    if (productTerms) {
      const firstDue = new Date();
      firstDue.setUTCMonth(firstDue.getUTCMonth() + 1);
      const quote = quoteLoan({ principal: body.principal_amount, tenorMonths: body.term_months,
        firstDueOn: firstDue.toISOString().slice(0, 10), terms: productTerms });
      const highestInstallment = quote.installments.reduce((max, installment) =>
        decimalToCents(installment.total_due) > max ? decimalToCents(installment.total_due) : max, 0n);
      const annualPeriods = productTerms.repayment_frequency === 'monthly' ? 12
        : productTerms.repayment_frequency === 'fortnightly' ? 26 : 52;
      proposedMonthlyPayment = centsToAmount((highestInstallment * BigInt(annualPeriods) + 11n) / 12n);
    }
    const assessment = scoreLoan({ policy, requestedAmount: body.principal_amount, termMonths: body.term_months,
      monthlyIncome: body.monthly_income, monthlyExpenses: body.monthly_expenses, monthlyDebt: body.monthly_debt,
      savingsBalance, membershipDays, priorLoans: history.total, repaidLoans: history.repaid, proposedMonthlyPayment });
    let eligibilityContext: Record<string, unknown> | null = null;
    if (productTerms) {
      eligibilityContext = {
        category: body.customer_category,
        age: body.age,
        businessMonths: body.business_months,
        employmentMonths: body.employment_months,
        equityAmount: body.equity_amount ?? '0.00',
        collateralValue: body.collateral_value,
        suppliedDocuments: verifiedDocuments,
        suppliedFields: body.supplied_fields,
        debtServiceBps: Math.ceil(Number(assessment.factors.debt_service_pct) * 100),
        membershipDays,
        savingsBalance,
        activeLoans: history.active,
      };
      const eligibility = evaluateLoanEligibility({
        terms: productTerms, category: body.customer_category, principal: body.principal_amount,
        tenorMonths: body.term_months, debtServiceBps: Math.ceil(Number(assessment.factors.debt_service_pct) * 100),
        membershipDays, savingsBalance, activeLoans: history.active, age: body.age,
        businessMonths: body.business_months, employmentMonths: body.employment_months,
        equityAmount: body.equity_amount ?? '0.00', collateralValue: body.collateral_value,
        suppliedDocuments: verifiedDocuments, suppliedFields: body.supplied_fields,
      });
      if (!eligibility.eligible) throw new HttpError(409, `Loan product requirements are not met: ${eligibility.reasons.join(', ')}`);
    }
    const row = (await client.query(
      `INSERT INTO mfi_loans (institution_id, member_id, product_id, principal_amount, term_months, purpose,
         monthly_income, monthly_expenses, monthly_debt, credit_score, credit_scorecard_version, credit_score_factors,
         application_submitted_at, created_by, product_version_id, product_terms, eligibility_context)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),$13,$14,$15::jsonb,$16::jsonb) RETURNING *`,
      [req.params.institutionId, body.member_id, product.id, normalizeAmount(body.principal_amount), body.term_months,
        body.purpose, normalizeAmount(body.monthly_income), normalizeAmount(body.monthly_expenses), normalizeAmount(body.monthly_debt),
        assessment.score, activePolicyRow.version, JSON.stringify(assessment.factors), req.user!.id,
        versionRow?.id ?? null, productTerms ? JSON.stringify(productTerms) : null,
        eligibilityContext ? JSON.stringify(eligibilityContext) : null],
    )).rows[0];
    await auditMfi(client, req.params.institutionId, req.user!.id, 'mfi_loan_requested', 'mfi_loan', row.id, null, {
      member_id: row.member_id, principal_amount: row.principal_amount, term_months: row.term_months,
      credit_score: assessment.score, scorecard_version: activePolicyRow.version, factors: assessment.factors,
      product_version_id: versionRow?.id ?? null, product_code: product.product_code,
    });
    return { ...row, eligible_by_scorecard: assessment.eligible, product_eligibility: productTerms ? eligibilityContext : null };
  });
  res.status(201).json(loan);
}));

mfiRouter.post('/institutions/:institutionId/loans/:loanId/decision', h(async (req, res) => {
  const body = z.object({
    decision: z.enum(['approve', 'reject']),
    reason: z.string().trim().min(10).max(1000),
  }).parse(req.body);
  const loan = await withInstitution(req.user!, req.params.institutionId, ['institution_admin', 'credit_manager'], async (client) => {
    const old = (await client.query(
      'SELECT * FROM mfi_loans WHERE institution_id=$1 AND id=$2 FOR UPDATE',
      [req.params.institutionId, req.params.loanId],
    )).rows[0];
    if (!old) throw new HttpError(404, 'Loan request not found');
    if (old.status !== 'pending') throw new HttpError(409, `Loan is already ${old.status}`);
    if (old.created_by === req.user!.id) throw new HttpError(409, 'The loan originator cannot approve or reject their own request');
    if (body.decision === 'approve') {
      const scorecard = (await client.query(
        `SELECT policy FROM mfi_credit_policy_versions WHERE institution_id=$1 AND version=$2`,
        [req.params.institutionId, old.credit_scorecard_version],
      )).rows[0];
      if (!scorecard) throw new HttpError(409, 'The application scorecard is unavailable; reassess the application before approval');
      const policy = creditPolicySchema.parse(scorecard.policy);
      if (Number(old.credit_score ?? 0) < policy.scorecard.minimum_score ||
          Number(old.credit_score_factors?.debt_service_pct ?? 10000) > policy.scorecard.maximum_debt_service_pct) {
        throw new HttpError(409, 'The application does not meet the approved scorecard threshold; reject it or reassess under a new application');
      }
      if (old.product_version_id && old.product_terms && old.eligibility_context) {
        const terms = lendingProductTermsSchema.parse(old.product_terms);
        const context = old.eligibility_context;
        const eligibility = evaluateLoanEligibility({
          terms, category: context.category, principal: String(old.principal_amount), tenorMonths: Number(old.term_months),
          debtServiceBps: Number(context.debtServiceBps), membershipDays: Number(context.membershipDays),
          savingsBalance: String(context.savingsBalance), activeLoans: Number(context.activeLoans), age: context.age,
          businessMonths: context.businessMonths, employmentMonths: context.employmentMonths,
          equityAmount: String(context.equityAmount ?? '0'), collateralValue: context.collateralValue,
          suppliedDocuments: context.suppliedDocuments ?? [], suppliedFields: context.suppliedFields ?? [],
        });
        if (!eligibility.eligible) throw new HttpError(409, `Loan product requirements are no longer satisfied: ${eligibility.reasons.join(', ')}`);
      }
    }
    const updated = (await client.query(
      `UPDATE mfi_loans SET status=$3, checked_by=$4, decision_reason=$5, reviewed_at=now()
       WHERE institution_id=$1 AND id=$2 RETURNING *`,
      [req.params.institutionId, req.params.loanId, body.decision === 'approve' ? 'approved' : 'rejected', req.user!.id, body.reason],
    )).rows[0];
    await auditMfi(client, req.params.institutionId, req.user!.id, 'mfi_loan_' + body.decision + 'd', 'mfi_loan', old.id, { status: old.status }, {
      status: updated.status, reason: body.reason,
    });
    return updated;
  });
  res.json(loan);
}));

mfiRouter.post('/institutions/:institutionId/loans/:loanId/disburse', h(async (req, res) => {
  const body = z.object({ idempotency_key: z.string().uuid() }).parse(req.body);
  const result = await withInstitution(req.user!, req.params.institutionId, ['institution_admin', 'finance_manager'], async (client) => {
    const loan = (await client.query(
      `SELECT l.*, p.product_code FROM mfi_loans l JOIN mfi_products p ON p.id=l.product_id AND p.institution_id=l.institution_id
       WHERE l.institution_id=$1 AND l.id=$2 FOR UPDATE OF l`,
      [req.params.institutionId, req.params.loanId],
    )).rows[0];
    if (!loan) throw new HttpError(404, 'Loan request not found');
    const member=(await client.query('SELECT id,kyc_status FROM mfi_members WHERE institution_id=$1 AND id=$2 FOR UPDATE',
      [req.params.institutionId,loan.member_id])).rows[0];
    if(member?.kyc_status!=='verified')throw new HttpError(409,'Member KYC must be independently verified before disbursement');
    const riskHold = (await client.query(
      `SELECT id,category FROM mfi_member_risk_flags WHERE institution_id=$1 AND member_id=$2 AND status='active' LIMIT 1`,
      [req.params.institutionId,loan.member_id],
    )).rows[0];
    if (riskHold) throw new HttpError(409, `Member is on an approved ${riskHold.category} disbursement hold`);
    const replay = await findJournalReplay(client, {
      institutionId: req.params.institutionId, idempotencyKey: body.idempotency_key,
      type: 'loan_disbursement', memberAccountId: null, loanId: req.params.loanId,
      amount: String(loan.principal_amount),
    });
    if (replay) {
      const accountId = (await client.query(
        `SELECT member_account_id FROM mfi_journal_lines
         WHERE institution_id=$1 AND journal_id=$2 AND member_account_id IS NOT NULL LIMIT 1`,
        [req.params.institutionId, replay.id],
      )).rows[0]?.member_account_id;
      const account = accountId ? (await client.query(
        'SELECT * FROM mfi_member_accounts WHERE institution_id=$1 AND id=$2',
        [req.params.institutionId, accountId],
      )).rows[0] : null;
      return { loan_id: req.params.loanId, account, journal: replay };
    }
    if (loan.status !== 'approved') throw new HttpError(409, 'Only an approved loan can be disbursed');
    if (loan.created_by === req.user!.id || loan.checked_by === req.user!.id) {
      throw new HttpError(409, 'The loan originator and approver cannot disburse this loan');
    }
    const firstDueOn = (await client.query("SELECT (current_date + interval '1 month')::date::text AS due_on")).rows[0].due_on as string;
    const productTerms = loan.product_terms ? lendingProductTermsSchema.parse(loan.product_terms) : null;
    const quote = productTerms ? quoteLoan({
      principal: String(loan.principal_amount), tenorMonths: Number(loan.term_months), firstDueOn, terms: productTerms,
    }) : null;
    const feeAmount = decimalToCents(quote?.origination_fee ?? '0.00');
    const netDisbursement = decimalToCents(String(loan.principal_amount)) - feeAmount;
    if (netDisbursement <= 0n) throw new HttpError(409, 'The product fee must be less than the loan principal');
    await lockCashAccount(client, req.params.institutionId);
    const activeDailyLimit=(await client.query("SELECT daily_limit::text FROM mfi_disbursement_limit_versions WHERE institution_id=$1 AND status='active'",[req.params.institutionId])).rows[0];
    if(activeDailyLimit?.daily_limit!==null&&activeDailyLimit?.daily_limit!==undefined){
      const disbursedToday=(await client.query(`SELECT coalesce(sum(j.amount),0)::text AS amount FROM mfi_journals j
        WHERE j.institution_id=$1 AND j.transaction_type='loan_disbursement' AND j.status='posted' AND j.posted_at::date=current_date
          AND NOT EXISTS(SELECT 1 FROM mfi_journals reversal WHERE reversal.institution_id=j.institution_id AND reversal.reversal_of=j.id)`,
        [req.params.institutionId])).rows[0].amount as string;
      if(decimalToCents(disbursedToday)+decimalToCents(String(loan.principal_amount))>decimalToCents(String(activeDailyLimit.daily_limit)))
        throw new HttpError(409,'The approved daily institution disbursement limit would be exceeded');
    }
    if (decimalToCents(await cashBalance(client, req.params.institutionId)) < netDisbursement) {
      throw new HttpError(409, 'The institution has insufficient cash to disburse this loan');
    }
    const account = (await client.query(
      `INSERT INTO mfi_member_accounts (institution_id, member_id, product_id, account_number, account_type, opened_by)
       VALUES ($1,$2,$3,'L-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),'loan',$4)
       RETURNING *`,
      [req.params.institutionId, loan.member_id, loan.product_id, req.user!.id],
    )).rows[0];
    const journal = await postJournal(client, {
      institutionId: req.params.institutionId,
      idempotencyKey: body.idempotency_key,
      type: 'loan_disbursement',
      memberAccountId: null,
      loanId: loan.id,
      amount: String(loan.principal_amount),
      actorId: req.user!.id,
      accountingApproval: { makerId: loan.created_by, checkerId: loan.checked_by, reason: loan.decision_reason },
      lines: [
        { code: '1300', memberAccountId: account.id, debit: String(loan.principal_amount), credit: '0' },
        ...(netDisbursement > 0n ? [{ code: '1000', debit: '0', credit: centsToAmount(netDisbursement) }] : []),
        ...(feeAmount > 0n ? [{ code: '4200', debit: '0', credit: centsToAmount(feeAmount) }] : []),
      ],
    });
    await client.query(
      `UPDATE mfi_loans SET status='disbursed', member_account_id=$3, disbursed_by=$4, disbursed_at=now()
       WHERE institution_id=$1 AND id=$2`,
      [req.params.institutionId, loan.id, account.id, req.user!.id],
    );
    const schedule = quote?.installments ?? principalSchedule(String(loan.principal_amount), Number(loan.term_months), firstDueOn)
      .map((item) => ({ ...item, interest_due: '0.00' }));
    for (const installment of schedule) {
      await client.query(
        `INSERT INTO mfi_loan_installments (institution_id, loan_id, installment_no, due_on, principal_due,interest_due)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [req.params.institutionId, loan.id, installment.installment_no, installment.due_on, installment.principal_due, installment.interest_due],
      );
    }
    await auditMfi(client, req.params.institutionId, req.user!.id, 'mfi_loan_disbursed', 'mfi_loan', loan.id, { status: loan.status }, {
      status: 'disbursed', account_number: account.account_number, journal_id: journal.id,
      principal_only_schedule: productTerms?.interest_method === 'none' || !productTerms,
      product_version_id: loan.product_version_id ?? null,
      quote: quote ?? { principal: String(loan.principal_amount), total_interest: '0.00', origination_fee: '0.00' },
      net_disbursed: centsToAmount(netDisbursement), installment_count: schedule.length, first_due_on: firstDueOn,
    });
    return { loan_id: loan.id, account, journal, quote, net_disbursed: centsToAmount(netDisbursement) };
  });
  res.status(result.journal.replayed ? 200 : 201).json(result);
}));

mfiRouter.get('/institutions/:institutionId/writeoffs',h(async(req,res)=>{
  const rows=await withInstitution(req.user!,req.params.institutionId,
    ['institution_admin','finance_manager','credit_manager','compliance','auditor'],async(client)=>(await client.query(
      `SELECT writeoff.id,writeoff.loan_id,loan.member_id,loan.created_by AS loan_created_by,
         loan.checked_by,loan.disbursed_by,member.member_number,member.full_name AS member_name,
         writeoff.amount::text,writeoff.reason,writeoff.status,writeoff.created_by,writeoff.reviewed_by,
         writeoff.reviewed_at,writeoff.review_reason,writeoff.journal_id,writeoff.created_at
       FROM mfi_loan_writeoffs writeoff JOIN mfi_loans loan
         ON loan.id=writeoff.loan_id AND loan.institution_id=writeoff.institution_id
       JOIN mfi_members member ON member.id=loan.member_id AND member.institution_id=loan.institution_id
       WHERE writeoff.institution_id=$1 ORDER BY writeoff.created_at DESC LIMIT 300`,[req.params.institutionId],
    )).rows);
  res.json(rows);
}));

mfiRouter.post('/institutions/:institutionId/loans/:loanId/writeoffs',h(async(req,res)=>{
  const body=z.object({idempotency_key:z.string().uuid(),reason:z.string().trim().min(10).max(1000)}).strict().parse(req.body);
  const request=await withInstitution(req.user!,req.params.institutionId,
    ['institution_admin','finance_manager','credit_manager','compliance'],async(client)=>{
      const loan=(await client.query(
        `SELECT id,status,principal_amount::text,principal_repaid::text,created_by,checked_by,disbursed_by
         FROM mfi_loans WHERE institution_id=$1 AND id=$2 FOR UPDATE`,[req.params.institutionId,req.params.loanId],
      )).rows[0];
      if(!loan)throw new HttpError(404,'Loan not found');
      const outstanding=decimalToCents(String(loan.principal_amount))-decimalToCents(String(loan.principal_repaid));
      if(loan.status!=='disbursed'||outstanding<=0n)throw new HttpError(409,'Only a disbursed loan with outstanding principal can be proposed for write-off');
      const payloadHash=amountHash({loan_id:loan.id,amount:centsToAmount(outstanding),reason:body.reason});
      const existing=(await client.query(
        `SELECT id,loan_id,amount::text,status,created_by,reviewed_by,reviewed_at,review_reason,journal_id,reason,payload_hash
         FROM mfi_loan_writeoffs WHERE institution_id=$1 AND idempotency_key=$2`,[req.params.institutionId,body.idempotency_key],
      )).rows[0];
      if(existing){
        if(existing.payload_hash&&existing.payload_hash!==payloadHash)throw new HttpError(409,'Write-off idempotency key was used with different request details');
        return {...existing,created:false};
      }
      const created=(await client.query(
        `INSERT INTO mfi_loan_writeoffs(institution_id,loan_id,amount,idempotency_key,payload_hash,reason,created_by)
         VALUES($1,$2,$3,$4,$5,$6,$7)
         RETURNING id,loan_id,amount::text,status,created_by,reviewed_by,reviewed_at,review_reason,journal_id,reason`,
        [req.params.institutionId,loan.id,centsToAmount(outstanding),body.idempotency_key,payloadHash,body.reason,req.user!.id],
      )).rows[0];
      await auditMfi(client,req.params.institutionId,req.user!.id,'mfi_loan_writeoff_proposed','mfi_loan_writeoff',created.id,null,
        {loan_id:loan.id,amount:created.amount,reason:body.reason});
      return {...created,created:true};
    });
  res.status(request.created?201:200).json(request);
}));

mfiRouter.post('/institutions/:institutionId/writeoffs/:writeoffId/decision',h(async(req,res)=>{
  const body=z.object({decision:z.enum(['approve','reject']),reason:z.string().trim().min(10).max(1000)}).strict().parse(req.body);
  const result=await withInstitution(req.user!,req.params.institutionId,
    ['institution_admin','finance_manager','compliance'],async(client)=>{
      const current=(await client.query(
        `SELECT writeoff.*,loan.member_id,loan.member_account_id,loan.principal_amount::text,loan.principal_repaid::text,
            loan.status AS loan_status,loan.created_by AS loan_created_by,loan.checked_by,loan.disbursed_by
         FROM mfi_loan_writeoffs writeoff JOIN mfi_loans loan
           ON loan.id=writeoff.loan_id AND loan.institution_id=writeoff.institution_id
         WHERE writeoff.institution_id=$1 AND writeoff.id=$2 FOR UPDATE OF writeoff,loan`,
        [req.params.institutionId,req.params.writeoffId],
      )).rows[0];
      if(!current)throw new HttpError(404,'Pending loan write-off was not found');
      if(current.status!=='pending')throw new HttpError(409,'This loan write-off was already decided');
      if([current.created_by,current.loan_created_by,current.checked_by,current.disbursed_by].includes(req.user!.id))
        throw new HttpError(409,'The request maker, loan originator, approver, or disburser cannot approve this write-off');
      if(body.decision==='reject'){
        const rejected=(await client.query(
          `UPDATE mfi_loan_writeoffs SET status='rejected',reviewed_by=$3,reviewed_at=now(),review_reason=$4
           WHERE institution_id=$1 AND id=$2 RETURNING id,loan_id,amount::text,status,reviewed_by,reviewed_at,review_reason`,
          [req.params.institutionId,current.id,req.user!.id,body.reason],
        )).rows[0];
        await auditMfi(client,req.params.institutionId,req.user!.id,'mfi_loan_writeoff_rejected','mfi_loan_writeoff',current.id,
          {status:'pending'},{status:'rejected',reason:body.reason});
        return rejected;
      }
      const outstanding=decimalToCents(String(current.principal_amount))-decimalToCents(String(current.principal_repaid));
      if(current.loan_status!=='disbursed'||outstanding<=0n||centsToAmount(outstanding)!==normalizeAmount(String(current.amount)))
        throw new HttpError(409,'Loan balance changed after the write-off request; submit a new proposal for the current balance');
      const journal=await postJournal(client,{
        institutionId:req.params.institutionId,idempotencyKey:current.idempotency_key,type:'loan_writeoff',
        memberAccountId:null,loanId:current.loan_id,writeoffId:current.id,amount:String(current.amount),actorId:req.user!.id,
        accountingApproval:{makerId:current.created_by,checkerId:req.user!.id,reason:body.reason},
        lines:[
          {code:'5100',debit:String(current.amount),credit:'0'},
          {code:'1300',memberAccountId:current.member_account_id,debit:'0',credit:String(current.amount)},
        ],
      });
      await client.query(
        `UPDATE mfi_loan_installments SET status='waived'
         WHERE institution_id=$1 AND loan_id=$2 AND status IN ('due','partial')`,
        [req.params.institutionId,current.loan_id],
      );
      await client.query(
        `UPDATE mfi_loans SET status='written_off' WHERE institution_id=$1 AND id=$2`,
        [req.params.institutionId,current.loan_id],
      );
      const approved=(await client.query(
        `UPDATE mfi_loan_writeoffs SET status='approved',reviewed_by=$3,reviewed_at=now(),review_reason=$4,journal_id=$5
         WHERE institution_id=$1 AND id=$2
         RETURNING id,loan_id,amount::text,status,reviewed_by,reviewed_at,review_reason,journal_id`,
        [req.params.institutionId,current.id,req.user!.id,body.reason,journal.id],
      )).rows[0];
      await client.query(
        `INSERT INTO mfi_member_risk_flags(institution_id,member_id,category,reason,status,created_by,reviewed_by,reviewed_at,review_reason)
         VALUES($1,$2,'delinquency_restriction',$3,'active',$4,$5,now(),$6)`,
        [req.params.institutionId,current.member_id,
          `Member account restricted after approved loan write-off ${current.id}: ${body.reason}`,
          current.created_by,req.user!.id,`Independent lending restriction following approved write-off ${current.id}`],
      );
      await auditMfi(client,req.params.institutionId,req.user!.id,'mfi_loan_writeoff_approved','mfi_loan_writeoff',current.id,
        {loan_status:current.loan_status,amount:current.amount},{loan_status:'written_off',journal_id:journal.id,risk_hold:true,reason:body.reason});
      return {...approved,journal};
    });
  res.json(result);
}));

mfiRouter.post('/institutions/:institutionId/loans/:loanId/repay', h(async (req, res) => {
  const body = z.object({ ...transactionBody.shape }).parse(req.body);
  const result = await withInstitution(req.user!, req.params.institutionId, ['institution_admin', 'finance_manager', 'teller'], async (client) => {
    const loan = (await client.query(
      `SELECT * FROM mfi_loans WHERE institution_id=$1 AND id=$2 FOR UPDATE`,
      [req.params.institutionId, req.params.loanId],
    )).rows[0];
    if (loan) {
      const replay = await findJournalReplay(client, {
        institutionId: req.params.institutionId, idempotencyKey: body.idempotency_key,
        type: 'loan_repayment', memberAccountId: null, loanId: req.params.loanId, amount: body.amount,
      });
      if (replay) return replay;
      const pendingRepayment=(await client.query(`SELECT id FROM mfi_journals WHERE institution_id=$1 AND loan_id=$2
        AND status='draft' AND requires_approval LIMIT 1`,[req.params.institutionId,loan.id])).rows[0];
      if(pendingRepayment)throw new HttpError(409,'Approve or reject the existing pending repayment before submitting another');
    }
    if (!loan || loan.status !== 'disbursed' || !loan.member_account_id) {
      throw new HttpError(409, 'Only a disbursed loan can receive a repayment');
    }
    const terms = loan.product_terms ? lendingProductTermsSchema.parse(loan.product_terms) : null;
    const latePenaltyBps = terms?.late_penalty_bps ?? 0;
    const graceDays = terms?.grace_days ?? 0;
    if (latePenaltyBps > 0) await client.query(
      `UPDATE mfi_loan_installments SET
         penalty_due=round(((principal_due-principal_paid)+(interest_due-interest_paid))*$4/10000,2),
         penalty_assessed_at=now()
       WHERE institution_id=$1 AND loan_id=$2 AND penalty_assessed_at IS NULL
         AND due_on + $3::integer < current_date
         AND (principal_paid<principal_due OR interest_paid<interest_due)`,
      [req.params.institutionId, loan.id, graceDays, latePenaltyBps],
    );
    const installments = (await client.query(
      `SELECT id,principal_due::text,principal_paid::text,interest_due::text,interest_paid::text,
              penalty_due::text,penalty_paid::text
       FROM mfi_loan_installments WHERE institution_id=$1 AND loan_id=$2
       ORDER BY due_on,installment_no FOR UPDATE`,
      [req.params.institutionId, loan.id],
    )).rows;
    let unallocated = decimalToCents(body.amount);
    const paidTotals = { principal: 0n, interest: 0n, penalty: 0n };
    const pendingUpdates = installments.map((row) => ({
      id: row.id as string,
      principalDue: decimalToCents(String(row.principal_due)), principalPaid: decimalToCents(String(row.principal_paid)),
      interestDue: decimalToCents(String(row.interest_due)), interestPaid: decimalToCents(String(row.interest_paid)),
      penaltyDue: decimalToCents(String(row.penalty_due)), penaltyPaid: decimalToCents(String(row.penalty_paid)),
    }));
    const priority = terms?.repayment_priority ?? ['principal','interest','penalty','fee'] as const;
    for (const bucket of priority) {
      if (bucket === 'fee') continue;
      for (const row of pendingUpdates) {
        if (unallocated === 0n) break;
        const due = bucket === 'principal' ? row.principalDue : bucket === 'interest' ? row.interestDue : row.penaltyDue;
        const paid = bucket === 'principal' ? row.principalPaid : bucket === 'interest' ? row.interestPaid : row.penaltyPaid;
        const allocation = unallocated < due - paid ? unallocated : due - paid;
        if (allocation <= 0n) continue;
        if (bucket === 'principal') row.principalPaid += allocation;
        else if (bucket === 'interest') row.interestPaid += allocation;
        else row.penaltyPaid += allocation;
        paidTotals[bucket] += allocation;
        unallocated -= allocation;
      }
    }
    if (unallocated > 0n) throw new HttpError(409, 'Repayment exceeds the total amount due under the product schedule');
    await lockCashAccount(client, req.params.institutionId);
    const journal = await postJournal(client, {
      institutionId: req.params.institutionId,
      idempotencyKey: body.idempotency_key,
      type: 'loan_repayment',
      memberAccountId: null,
      loanId: loan.id,
      amount: body.amount,
      actorId: req.user!.id,
      requiresApproval: true,
      lines: [
        { code: '1000', debit: normalizeAmount(body.amount), credit: '0' },
        ...(paidTotals.principal > 0n ? [{ code: '1300', memberAccountId: loan.member_account_id, debit: '0', credit: centsToAmount(paidTotals.principal) }] : []),
        ...(paidTotals.interest > 0n ? [{ code: '4100', debit: '0', credit: centsToAmount(paidTotals.interest) }] : []),
        ...(paidTotals.penalty > 0n ? [{ code: '4300', debit: '0', credit: centsToAmount(paidTotals.penalty) }] : []),
      ],
    });
    if (!journal.replayed && journal.status === 'posted') {
      for (const row of pendingUpdates) {
        await client.query(
          `UPDATE mfi_loan_installments SET principal_paid=$3,interest_paid=$4,penalty_paid=$5,
             status=CASE WHEN $3::numeric=0::numeric THEN 'due'
               WHEN $3::numeric=principal_due THEN 'paid' ELSE 'partial' END
           WHERE institution_id=$1 AND id=$2`,
          [req.params.institutionId, row.id, centsToAmount(row.principalPaid), centsToAmount(row.interestPaid), centsToAmount(row.penaltyPaid)],
        );
      }
      const paid = decimalToCents(String(loan.principal_repaid)) + paidTotals.principal;
      const remaining = (await client.query(
        `SELECT coalesce(sum((principal_due-principal_paid)+(interest_due-interest_paid)+(penalty_due-penalty_paid)),0)::numeric(16,2)::text AS amount
         FROM mfi_loan_installments WHERE institution_id=$1 AND loan_id=$2`,
        [req.params.institutionId, loan.id],
      )).rows[0].amount as string;
      const repaid = decimalToCents(remaining) === 0n;
      await client.query(
        `UPDATE mfi_loans SET principal_repaid=$3, status=$4 WHERE institution_id=$1 AND id=$2`,
        [req.params.institutionId, loan.id, centsToAmount(paid), repaid ? 'repaid' : 'disbursed'],
      );
    }
    return journal;
  });
  res.status(result.replayed ? 200 : 201).json(result);
}));

mfiRouter.get('/institutions/:institutionId/complaints', h(async (req, res) => {
  const rows = await withInstitution(req.user!, req.params.institutionId,
    ['institution_admin','finance_manager','credit_manager','loan_officer','compliance','auditor'], async (client) =>
      (await client.query(
        `SELECT c.id,c.member_id,m.member_number,m.full_name AS member_name,c.reference,c.category,c.subject,
                c.description,c.status,c.priority,c.resolution_due_at,c.assigned_to,c.resolution,c.resolved_by,
                c.resolved_at,c.created_by,c.created_at,c.updated_at
         FROM mfi_customer_complaints c JOIN mfi_members m ON m.id=c.member_id AND m.institution_id=c.institution_id
         WHERE c.institution_id=$1 ORDER BY CASE c.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
                  c.created_at DESC LIMIT 500`, [req.params.institutionId],
      )).rows);
  res.json(rows);
}));

mfiRouter.post('/institutions/:institutionId/complaints', h(async (req, res) => {
  const body = z.object({ member_id:z.string().uuid(), category:z.enum(['service','loan_decision','repayment','fees','privacy','fraud','other']),
    subject:z.string().trim().min(5).max(160), description:z.string().trim().min(10).max(5000), priority:z.enum(['low','normal','high','urgent']).default('normal') }).strict().parse(req.body);
  const complaint = await withInstitution(req.user!, req.params.institutionId,
    ['institution_admin','finance_manager','credit_manager','loan_officer','compliance'], async (client) => {
      const member = (await client.query('SELECT id FROM mfi_members WHERE institution_id=$1 AND id=$2',
        [req.params.institutionId,body.member_id])).rows[0];
      if (!member) throw new HttpError(404,'Member not found');
      const reference = `MFI-${randomUUID().replaceAll('-','').slice(0,12).toUpperCase()}`;
      const row = (await client.query(
        `INSERT INTO mfi_customer_complaints(institution_id,member_id,reference,category,subject,description,priority,created_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id,member_id,reference,category,subject,status,priority,resolution_due_at,created_at`,
        [req.params.institutionId,body.member_id,reference,body.category,body.subject,body.description,body.priority,req.user!.id],
      )).rows[0];
      await auditMfi(client,req.params.institutionId,req.user!.id,'mfi_complaint_opened','mfi_customer_complaint',row.id,null,row);
      return row;
    });
  res.status(201).json(complaint);
}));

mfiRouter.post('/institutions/:institutionId/complaints/:complaintId/decision', h(async (req, res) => {
  const complaintId=z.string().uuid().parse(req.params.complaintId);
  const body=z.object({status:z.enum(['investigating','awaiting_customer','resolved','rejected']),priority:z.enum(['low','normal','high','urgent']).optional(),
    assigned_to:z.string().uuid().nullable().optional(),resolution:z.string().trim().min(10).max(5000).optional()}).strict().parse(req.body);
  const complaint=await withInstitution(req.user!,req.params.institutionId,
    ['institution_admin','finance_manager','credit_manager','compliance'],async(client)=>{
      const current=(await client.query('SELECT * FROM mfi_customer_complaints WHERE institution_id=$1 AND id=$2 FOR UPDATE',
        [req.params.institutionId,complaintId])).rows[0];
      if(!current)throw new HttpError(404,'Complaint not found');
      if(['resolved','rejected'].includes(current.status))throw new HttpError(409,'Closed complaints cannot be changed');
      if(['resolved','rejected'].includes(body.status)&&!body.resolution)throw new HttpError(422,'A resolution summary is required to close a complaint');
      const updated=(await client.query(
        `UPDATE mfi_customer_complaints SET status=$3,priority=coalesce($4,priority),assigned_to=coalesce($5,assigned_to),
          resolution=CASE WHEN $3 IN ('resolved','rejected') THEN $6 ELSE resolution END,
          resolved_by=CASE WHEN $3 IN ('resolved','rejected') THEN $7 ELSE null END,
          resolved_at=CASE WHEN $3 IN ('resolved','rejected') THEN now() ELSE null END,updated_at=now()
         WHERE institution_id=$1 AND id=$2 RETURNING id,reference,status,priority,assigned_to,resolution,resolved_by,resolved_at,updated_at`,
        [req.params.institutionId,complaintId,body.status,body.priority??null,body.assigned_to??null,body.resolution??null,req.user!.id],
      )).rows[0];
      await auditMfi(client,req.params.institutionId,req.user!.id,'mfi_complaint_updated','mfi_customer_complaint',complaintId,current,updated);
      return updated;
    });
  res.json(complaint);
}));

mfiRouter.get('/institutions/:institutionId/members/:memberId/risk-flags', h(async(req,res)=>{
  const memberId=z.string().uuid().parse(req.params.memberId);
  const rows=await withInstitution(req.user!,req.params.institutionId,
    ['institution_admin','finance_manager','credit_manager','loan_officer','compliance','auditor'],async(client)=>
      (await client.query(`SELECT id,member_id,category,reason,status,created_by,reviewed_by,reviewed_at,review_reason,
        released_by,released_at,release_reason,created_at FROM mfi_member_risk_flags
        WHERE institution_id=$1 AND member_id=$2 ORDER BY created_at DESC`,[req.params.institutionId,memberId])).rows);
  res.json(rows);
}));

mfiRouter.post('/institutions/:institutionId/members/:memberId/risk-flags', h(async(req,res)=>{
  const memberId=z.string().uuid().parse(req.params.memberId);
  const body=z.object({category:z.enum(['identity_mismatch','suspicious_activity','fraud','aml_hold','delinquency_restriction']),reason:z.string().trim().min(10).max(2000)}).strict().parse(req.body);
  const row=await withInstitution(req.user!,req.params.institutionId,
    ['institution_admin','credit_manager','compliance'],async(client)=>{
      const member=(await client.query('SELECT id FROM mfi_members WHERE institution_id=$1 AND id=$2 FOR UPDATE',[req.params.institutionId,memberId])).rows[0];
      if(!member)throw new HttpError(404,'Member not found');
      const flag=(await client.query(`INSERT INTO mfi_member_risk_flags(institution_id,member_id,category,reason,created_by)
        VALUES($1,$2,$3,$4,$5) RETURNING id,member_id,category,reason,status,created_at`,
        [req.params.institutionId,memberId,body.category,body.reason,req.user!.id])).rows[0];
      await auditMfi(client,req.params.institutionId,req.user!.id,'mfi_member_risk_flag_submitted','mfi_member_risk_flag',flag.id,null,flag);
      return flag;
    });
  res.status(201).json(row);
}));

mfiRouter.post('/institutions/:institutionId/risk-flags/:flagId/decision', h(async(req,res)=>{
  const id=z.string().uuid().parse(req.params.flagId);
  const body=z.object({decision:z.enum(['activate','reject','release']),reason:z.string().trim().min(10).max(2000)}).strict().parse(req.body);
  const flag=await withInstitution(req.user!,req.params.institutionId,
    ['institution_admin','credit_manager','compliance'],async(client)=>{
      const current=(await client.query('SELECT * FROM mfi_member_risk_flags WHERE institution_id=$1 AND id=$2 FOR UPDATE',[req.params.institutionId,id])).rows[0];
      if(!current)throw new HttpError(404,'Member risk flag not found');
      await client.query('SELECT id FROM mfi_members WHERE institution_id=$1 AND id=$2 FOR UPDATE',[req.params.institutionId,current.member_id]);
      if(current.created_by===req.user!.id)throw new HttpError(403,'The flag author cannot review or release their own risk flag');
      if(body.decision==='release'){
        if(current.status!=='active')throw new HttpError(409,'Only an active risk hold can be released');
        const updated=(await client.query(`UPDATE mfi_member_risk_flags SET status='released',released_by=$3,released_at=now(),release_reason=$4
          WHERE institution_id=$1 AND id=$2 RETURNING id,member_id,category,status,released_by,released_at,release_reason`,
          [req.params.institutionId,id,req.user!.id,body.reason])).rows[0];
        await auditMfi(client,req.params.institutionId,req.user!.id,'mfi_member_risk_hold_released','mfi_member_risk_flag',id,current,updated);
        return updated;
      }
      if(current.status!=='pending_review')throw new HttpError(409,'Only a pending risk flag can be reviewed');
      const updated=(await client.query(`UPDATE mfi_member_risk_flags SET status=$3,reviewed_by=$4,reviewed_at=now(),review_reason=$5
        WHERE institution_id=$1 AND id=$2 RETURNING id,member_id,category,status,reviewed_by,reviewed_at,review_reason`,
        [req.params.institutionId,id,body.decision==='activate'?'active':'rejected',req.user!.id,body.reason])).rows[0];
      await auditMfi(client,req.params.institutionId,req.user!.id,`mfi_member_risk_flag_${body.decision}d`,'mfi_member_risk_flag',id,current,updated);
      return updated;
    });
  res.json(flag);
}));

  return mfiRouter;
}
