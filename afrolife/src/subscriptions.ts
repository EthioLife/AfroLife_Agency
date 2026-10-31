import express, { type NextFunction, type Request, type Response, type RequestHandler } from 'express';
import { z } from 'zod';
import { enqueueAccountingEvent } from './accounting-outbox.js';
import { HttpError, requireRole, withUser } from './core.js';

const services = [
  { key: 'accounting', name: 'Accounting & Finance' },
  { key: 'property_management', name: 'Property Management' },
  { key: 'workforce_management', name: 'Workforce Management' },
  { key: 'super_agent', name: 'Super Agent' },
  { key: 'edir', name: 'Edir' },
  { key: 'insurance_brokerage', name: 'Insurance Brokerage' },
  { key: 'agent', name: 'Agent' },
  { key: 'landlord', name: 'Landlord' },
  { key: 'seller', name: 'Seller Services' },
] as const;

export function getPublicSubscriptionCatalog() {
  return {
    services: services.map((service) => ({
      ...service,
      monthly_fee: 1000,
      currency: 'ETB',
      payment_method: 'manual',
    })),
  };
}

const serviceKeys = [
  'accounting', 'property_management', 'workforce_management', 'super_agent', 'edir',
  'insurance_brokerage', 'agent', 'landlord', 'seller',
] as const;
const financeRoles = ['finance', 'finance_manager', 'global_admin', 'super_admin'] as const;
const requestSchema = z.object({
  services: z.array(z.enum(serviceKeys)).min(1).max(services.length),
}).strict().refine(({ services: selected }) => new Set(selected).size === selected.length, {
  message: 'Each service may only be requested once',
});
const paymentReferenceSchema = z.object({
  payment_reference: z.string().trim().min(4).max(160),
}).strict();
const reviewSchema = z.object({
  decision: z.enum(['confirm', 'reject']),
  reason: z.string().trim().min(10).max(1000),
}).strict();

const route = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next: NextFunction) => { fn(req, res).catch(next); };

function configuration() {
  const entityId = process.env.SUBSCRIPTION_ACCOUNTING_SOURCE_ENTITY_ID?.trim();
  const cashAccount = process.env.SUBSCRIPTION_ACCOUNTING_CASH_ACCOUNT_CODE?.trim();
  const revenueAccount = process.env.SUBSCRIPTION_ACCOUNTING_REVENUE_ACCOUNT_CODE?.trim();
  if (!entityId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entityId)
    || !cashAccount || cashAccount.length > 100 || !revenueAccount || revenueAccount.length > 100
    || cashAccount === revenueAccount) {
    throw new HttpError(503, 'Subscription Accounting is not configured with a source entity and distinct cash and revenue account mappings');
  }
  return { entityId, cashAccount, revenueAccount };
}

function subscriptionId(req: Request): string {
  const parsed = z.string().uuid().safeParse(req.params.subscriptionId);
  if (!parsed.success) throw new HttpError(400, 'Invalid subscription request identifier');
  return parsed.data;
}

function translateUniqueViolation(error: unknown): never {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
    throw new HttpError(409, 'A service request or payment reference already exists');
  }
  throw error;
}

export const subscriptionRouter = express.Router();

subscriptionRouter.get('/catalog', (_req, res) => {
  res.json(getPublicSubscriptionCatalog());
});

subscriptionRouter.post('/requests', route(async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, 'Select one or more valid services without duplicates');
  try {
    const created = await withUser(req.user!, async (client) => {
      const rows = [];
      for (const serviceKey of parsed.data.services) {
        const inserted = await client.query(
          `INSERT INTO platform_service_subscriptions(user_id,service_key)
           VALUES($1,$2) RETURNING id,service_key,monthly_fee,currency,status,created_at`,
          [req.user!.id, serviceKey],
        );
        const subscription = inserted.rows[0];
        await client.query(
          `INSERT INTO platform_service_subscription_audit
             (subscription_id,actor_id,action,previous_status,next_status)
           VALUES($1,$2,'requested',NULL,'requested')`,
          [subscription.id, req.user!.id],
        );
        rows.push(subscription);
      }
      return rows;
    });
    res.status(201).json({ requests: created });
  } catch (error) {
    translateUniqueViolation(error);
  }
}));

subscriptionRouter.get('/mine', route(async (req, res) => {
  const requests = await withUser(req.user!, async (client) => (await client.query(
    `SELECT id,service_key,monthly_fee,currency,status,payment_reference,
       payment_submitted_at,payment_confirmed_at,active_from,active_until,decision_reason,created_at
     FROM platform_service_subscriptions
     WHERE user_id=$1 ORDER BY created_at DESC,id`,
    [req.user!.id],
  )).rows);
  res.json({ requests });
}));

subscriptionRouter.post('/:subscriptionId/payment-reference', route(async (req, res) => {
  const parsed = paymentReferenceSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, 'Enter a payment reference between 4 and 160 characters');
  const id = subscriptionId(req);
  try {
    const updated = await withUser(req.user!, async (client) => {
      const result = await client.query(
        `UPDATE platform_service_subscriptions
         SET status='payment_review',payment_reference=$3,payment_submitted_by=$2,payment_submitted_at=now()
         WHERE id=$1 AND user_id=$2 AND status='requested'
         RETURNING id,service_key,status,payment_submitted_at`,
        [id, req.user!.id, parsed.data.payment_reference],
      );
      if (!result.rowCount) throw new HttpError(404, 'A pending subscription request was not found');
      await client.query(
        `INSERT INTO platform_service_subscription_audit
           (subscription_id,actor_id,action,previous_status,next_status)
         VALUES($1,$2,'payment_submitted','requested','payment_review')`,
        [id, req.user!.id],
      );
      return result.rows[0];
    });
    res.json({ request: updated });
  } catch (error) {
    translateUniqueViolation(error);
  }
}));

subscriptionRouter.get('/review', requireRole(...financeRoles), route(async (_req, res) => {
  const requests = await withUser(_req.user!, async (client) => (await client.query(
    `SELECT subscription.id,subscription.user_id,users.legal_name,subscription.service_key,
       subscription.monthly_fee,subscription.currency,subscription.payment_reference,
       subscription.payment_submitted_at,subscription.created_at
     FROM platform_service_subscriptions subscription
     JOIN users ON users.id=subscription.user_id
     WHERE subscription.status='payment_review'
     ORDER BY subscription.payment_submitted_at,subscription.id`,
  )).rows);
  res.json({ requests });
}));

subscriptionRouter.post('/review/:subscriptionId', requireRole(...financeRoles), route(async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, 'Choose confirm or reject and provide a reason of at least 10 characters');
  const id = subscriptionId(req);
  try {
    const result = await withUser(req.user!, async (client) => {
      const selected = await client.query(
        `SELECT * FROM platform_service_subscriptions
         WHERE id=$1 AND status='payment_review' FOR UPDATE`,
        [id],
      );
      const subscription = selected.rows[0];
      if (!subscription) throw new HttpError(404, 'A payment awaiting Finance review was not found');
      if (subscription.payment_submitted_by === req.user!.id) {
        throw new HttpError(409, 'The payment submitter cannot review their own payment');
      }
      if (parsed.data.decision === 'reject') {
        const rejected = await client.query(
          `UPDATE platform_service_subscriptions
           SET status='rejected',payment_confirmed_by=$2,payment_confirmed_at=now(),decision_reason=$3
           WHERE id=$1 RETURNING id,service_key,status,decision_reason`,
          [subscription.id, req.user!.id, parsed.data.reason],
        );
        await client.query(
          `INSERT INTO platform_service_subscription_audit
             (subscription_id,actor_id,action,previous_status,next_status,details)
           VALUES($1,$2,'payment_rejected','payment_review','rejected',jsonb_build_object('reason',$3::text))`,
          [subscription.id, req.user!.id, parsed.data.reason],
        );
        return rejected.rows[0];
      }

      const { entityId, cashAccount, revenueAccount } = configuration();
      const { entry_date: entryDate } = (await client.query(
        'SELECT current_date::text AS entry_date',
      )).rows[0] as { entry_date: string };
      const eventId = await enqueueAccountingEvent(client, {
        source_entity_id: entityId,
        entry_date: entryDate,
        source_reference: `platform-service-subscription:${subscription.id}`,
        description: `Monthly ${subscription.service_key} subscription`,
        lines: [
          { source_account_code: cashAccount, debit: '1000.00', credit: '0.00' },
          { source_account_code: revenueAccount, debit: '0.00', credit: '1000.00' },
        ],
        maker_id: subscription.payment_submitted_by,
        checker_id: req.user!.id,
        checker_reason: `${parsed.data.reason}; payment reference ${subscription.payment_reference}`,
      });
      if (!eventId) throw new HttpError(503, 'Accounting event delivery is not configured; the subscription was not confirmed');
      const approved = await client.query(
        `UPDATE platform_service_subscriptions subscription
         SET status='accounting_pending',payment_confirmed_by=$2,payment_confirmed_at=now(),
           decision_reason=$3,accounting_event_id=$4
         WHERE subscription.id=$1
         RETURNING subscription.id,subscription.service_key,subscription.status,
         subscription.active_from,subscription.active_until,subscription.accounting_event_id`,
        [subscription.id, req.user!.id, parsed.data.reason, eventId],
      );
      await client.query(
        `INSERT INTO platform_service_subscription_audit
           (subscription_id,actor_id,action,previous_status,next_status,details)
         VALUES($1,$2,'payment_confirmed','payment_review','accounting_pending',
           jsonb_build_object('accounting_event_id',$3))`,
        [subscription.id, req.user!.id, eventId],
      );
      return approved.rows[0];
    });
    res.json({ request: result });
  } catch (error) {
    translateUniqueViolation(error);
  }
}));
