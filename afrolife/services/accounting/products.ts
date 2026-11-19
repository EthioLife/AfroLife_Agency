import type { Request, Response, RequestHandler, Router as RouterType } from 'express';
import { Router } from 'express';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import type { AuthUser } from '../../src/auth-types.js';
import { HttpError } from '../../src/http-error.js';
import type { WithUser } from './router-types.js';
import {
  ethioLifePlanScenario,
  ethioLifePrices,
  ethioLifeProducts,
  ethioLifeRevenueTargets,
  ethioLifeTemplateCaveat,
} from './product-catalog.js';

const h = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { fn(req, res).catch(next); };
const UUID = z.string().uuid();
const readers = ['entity_admin', 'finance_manager', 'accountant', 'reviewer', 'auditor', 'viewer'];
const writers = ['entity_admin', 'finance_manager', 'accountant'];
const reviewers = ['entity_admin', 'finance_manager', 'reviewer'];
const global = (role: string) => role === 'global_admin' || role === 'super_admin';
const rateUnits = (value: string) => {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 10000n + BigInt((fraction + '0000').slice(0, 4));
};

function sendProfitabilityCsv(res: Response, rows: Array<Record<string, unknown>>) {
  const columns = [
    'division_name', 'product_code', 'product_name', 'revenue',
    'attributed_expenses', 'gross_profit_estimate', 'gross_margin_percent_estimate',
    'attributed_line_count',
  ];
  const cell = (value: unknown) => {
    const raw = String(value ?? '');
    const safe = /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw;
    return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
  };
  const csv = [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => cell(row[column])).join(',')),
  ].join('\r\n') + '\r\n';
  res.status(200).type('text/csv')
    .set('Content-Disposition', 'attachment; filename="product-profitability.csv"')
    .send(csv);
}

async function assertAccess(withUser: WithUser, user: AuthUser, entityId: string, allowed: string[]) {
  if (global(user.role)) return;
  const allowedByMembership = await withUser(user, async (client) => Boolean((await client.query(
    'SELECT accounting_can_access($1,$2::text[]) AS allowed',
    [entityId, allowed],
  )).rows[0]?.allowed));
  if (!allowedByMembership) throw new HttpError(403, 'Accounting entity membership is required');
}

async function audit(
  client: PoolClient,
  entityId: string,
  actorId: string,
  action: string,
  type: string,
  id: string,
  details: unknown,
) {
  await client.query(
    'INSERT INTO accounting_audit(entity_id,actor_id,action,record_type,record_id,details) VALUES($1,$2,$3,$4,$5,$6)',
    [entityId, actorId, action, type, id, JSON.stringify(details ?? {})],
  );
}

export function createAccountingProductRouter(withUser: WithUser): RouterType {
  const router = Router();

  router.get('/entities/:entityId/products', h(async (req, res) => {
    const entityId = UUID.parse(req.params.entityId);
    await assertAccess(withUser, req.user!, entityId, readers);
    const result = await withUser(req.user!, async (client) => {
      const products = (await client.query(
        `SELECT p.id,p.parent_product_id,p.product_type,p.code,p.name,p.description,p.status,
          parent.code AS division_code,parent.name AS division_name
         FROM accounting_products p
         LEFT JOIN accounting_products parent
           ON parent.id=p.parent_product_id AND parent.entity_id=p.entity_id
         WHERE p.entity_id=$1
         ORDER BY COALESCE(parent.name,p.name),p.product_type,p.name`,
        [entityId],
      )).rows;
      const prices = (await client.query(
        `SELECT id,product_id,price_unit,pricing_model,minimum_rate::text,maximum_rate::text,currency,
          source_note,status,requested_by,reviewed_by,review_reason,effective_from,effective_to,created_at,reviewed_at
         FROM accounting_product_prices WHERE entity_id=$1
         ORDER BY product_id,price_unit,created_at DESC`,
        [entityId],
      )).rows;
      const targets = (await client.query(
        `SELECT t.id,t.product_id,p.code AS division_code,p.name AS division_name,t.scenario_code,
          t.scenario_name,t.plan_year_index,t.revenue_target::text,t.currency,t.source_note
         FROM accounting_product_targets t
         JOIN accounting_products p ON p.id=t.product_id AND p.entity_id=t.entity_id
         WHERE t.entity_id=$1 ORDER BY t.scenario_code,t.plan_year_index,p.code`,
        [entityId],
      )).rows;
      return { products, prices, targets };
    });
    res.json(result);
  }));

  router.post('/entities/:entityId/products/template', h(async (req, res) => {
    const entityId = UUID.parse(req.params.entityId);
    await assertAccess(withUser, req.user!, entityId, writers);
    const result = await withUser(req.user!, async (client) => {
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
        [`accounting-product-template:${entityId}`],
      );
      const existing = Number((await client.query(
        'SELECT count(*)::int AS count FROM accounting_products WHERE entity_id=$1',
        [entityId],
      )).rows[0].count);
      if (existing) throw new HttpError(409, 'Apply the service catalog only to an entity with no products');

      const productIds = new Map<string, string>();
      for (const product of ethioLifeProducts) {
        const parentId = product.parentCode ? productIds.get(product.parentCode) : null;
        if (product.parentCode && !parentId) throw new Error(`Unknown service division ${product.parentCode}`);
        const row = (await client.query(
          `INSERT INTO accounting_products(entity_id,parent_product_id,product_type,code,name,description,created_by)
           VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [entityId, parentId, product.productType, product.code, product.name, product.description, req.user!.id],
        )).rows[0];
        productIds.set(product.code, row.id);
      }

      for (const price of ethioLifePrices) {
        const productId = productIds.get(price.productCode);
        if (!productId) throw new Error(`Unknown priced offering ${price.productCode}`);
        await client.query(
          `INSERT INTO accounting_product_prices(
             entity_id,product_id,price_unit,pricing_model,minimum_rate,maximum_rate,currency,source_note,requested_by
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            entityId, productId, price.priceUnit, price.pricingModel,
            price.minimumRate ?? null, price.maximumRate ?? null, price.currency,
            price.sourceNote, req.user!.id,
          ],
        );
      }

      for (const target of ethioLifeRevenueTargets) {
        const productId = productIds.get(target.productCode);
        if (!productId) throw new Error(`Unknown target division ${target.productCode}`);
        await client.query(
          `INSERT INTO accounting_product_targets(
             entity_id,product_id,scenario_code,scenario_name,plan_year_index,revenue_target,currency,source_note,created_by
           ) VALUES($1,$2,$3,$4,$5,$6,'ETB',$7,$8)`,
          [
            entityId, productId, ethioLifePlanScenario.code, ethioLifePlanScenario.name,
            target.planYearIndex, target.revenueTarget, ethioLifePlanScenario.sourceNote, req.user!.id,
          ],
        );
      }

      await audit(client, entityId, req.user!.id, 'product_template_applied', 'accounting_product_template', entityId, {
        product_count: ethioLifeProducts.length,
        draft_price_count: ethioLifePrices.length,
        historical_target_count: ethioLifeRevenueTargets.length,
        scenario_code: ethioLifePlanScenario.code,
      });
      return {
        product_count: ethioLifeProducts.length,
        draft_price_count: ethioLifePrices.length,
        historical_target_count: ethioLifeRevenueTargets.length,
        scenario_code: ethioLifePlanScenario.code,
        caveat: ethioLifeTemplateCaveat,
      };
    });
    res.status(201).json(result);
  }));

  router.post('/entities/:entityId/products', h(async (req, res) => {
    const entityId = UUID.parse(req.params.entityId);
    await assertAccess(withUser, req.user!, entityId, writers);
    const body = z.object({
      parent_product_id: UUID,
      code: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_-]{1,39}$/),
      name: z.string().trim().min(2).max(160),
      description: z.string().trim().min(2).max(1000),
    }).strict().parse(req.body);
    const row = await withUser(req.user!, async (client) => {
      const parent = (await client.query(
        `SELECT id FROM accounting_products
         WHERE id=$1 AND entity_id=$2 AND product_type='division' AND status='active'`,
        [body.parent_product_id, entityId],
      )).rows[0];
      if (!parent) throw new HttpError(422, 'Choose an active division in this Accounting entity');
      const product = (await client.query(
        `INSERT INTO accounting_products(entity_id,parent_product_id,product_type,code,name,description,created_by)
         VALUES($1,$2,'offering',$3,$4,$5,$6) RETURNING *`,
        [entityId, parent.id, body.code, body.name, body.description, req.user!.id],
      )).rows[0];
      await audit(client, entityId, req.user!.id, 'product_created', 'accounting_product', product.id, { code: product.code });
      return product;
    });
    res.status(201).json(row);
  }));

  router.post('/entities/:entityId/products/:productId/prices', h(async (req, res) => {
    const entityId = UUID.parse(req.params.entityId);
    const productId = UUID.parse(req.params.productId);
    await assertAccess(withUser, req.user!, entityId, writers);
    const body = z.object({
      price_unit: z.enum(['hour', 'visit', 'week', 'month', 'sqm', 'day', 'course', 'percentage_of_gross_monthly_rent', 'quote']),
      pricing_model: z.enum(['fixed', 'range', 'percentage', 'quote']),
      minimum_rate: z.string().regex(/^\d{1,14}(?:\.\d{1,4})?$/).optional().nullable(),
      maximum_rate: z.string().regex(/^\d{1,14}(?:\.\d{1,4})?$/).optional().nullable(),
      currency: z.string().regex(/^[A-Z]{3}$/).optional().nullable(),
      source_note: z.string().trim().min(10).max(1000),
    }).strict().parse(req.body);

    let minimum = body.minimum_rate ?? null;
    let maximum = body.maximum_rate ?? null;
    if (body.pricing_model === 'quote') {
      if (body.price_unit !== 'quote' || minimum !== null || maximum !== null) {
        throw new HttpError(400, 'Quote pricing requires the quote unit and no numeric rates');
      }
    } else if (body.pricing_model === 'percentage') {
      if (body.price_unit !== 'percentage_of_gross_monthly_rent' || !minimum || !maximum) {
        throw new HttpError(400, 'Percentage pricing requires a gross-monthly-rent percentage range');
      }
      if (rateUnits(maximum) > 1000000n || rateUnits(minimum) > rateUnits(maximum)) {
        throw new HttpError(400, 'Percentage rates must be ordered and no greater than 100');
      }
    } else if (body.price_unit === 'percentage_of_gross_monthly_rent' || body.price_unit === 'quote') {
      throw new HttpError(400, 'Choose a compatible price unit and pricing model');
    } else if (body.pricing_model === 'fixed') {
      if (!minimum || (maximum !== null && rateUnits(maximum) !== rateUnits(minimum))) {
        throw new HttpError(400, 'Fixed pricing requires one rate; minimum and maximum must match');
      }
      maximum = minimum;
    } else if (!minimum || !maximum || rateUnits(minimum) > rateUnits(maximum)) {
      throw new HttpError(400, 'Range pricing requires ordered minimum and maximum rates');
    }

    const row = await withUser(req.user!, async (client) => {
      const product = (await client.query(
        `SELECT p.id,e.base_currency FROM accounting_products p
         JOIN accounting_entities e ON e.id=p.entity_id
         WHERE p.id=$1 AND p.entity_id=$2 AND p.product_type='offering' AND p.status='active'`,
        [productId, entityId],
      )).rows[0];
      if (!product) throw new HttpError(404, 'Active Accounting offering not found');
      const currency = body.price_unit === 'percentage_of_gross_monthly_rent'
        ? null
        : body.currency ?? product.base_currency;
      const price = (await client.query(
        `INSERT INTO accounting_product_prices(
           entity_id,product_id,price_unit,pricing_model,minimum_rate,maximum_rate,currency,source_note,requested_by
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [entityId, productId, body.price_unit, body.pricing_model, minimum, maximum, currency, body.source_note, req.user!.id],
      )).rows[0];
      await audit(client, entityId, req.user!.id, 'product_price_submitted', 'accounting_product_price', price.id, {
        product_id: productId,
        pricing_model: price.pricing_model,
        price_unit: price.price_unit,
      });
      return price;
    });
    res.status(201).json(row);
  }));

  router.post('/entities/:entityId/product-prices/:priceId/decision', h(async (req, res) => {
    const entityId = UUID.parse(req.params.entityId);
    const priceId = UUID.parse(req.params.priceId);
    await assertAccess(withUser, req.user!, entityId, reviewers);
    const body = z.object({
      decision: z.enum(['approve', 'reject']),
      reason: z.string().trim().min(10).max(1000),
      effective_from: z.string().date().optional(),
      effective_to: z.string().date().optional().nullable(),
    }).strict().parse(req.body);
    if (body.decision === 'approve' && !body.effective_from) {
      throw new HttpError(400, 'An effective start date is required to approve a price');
    }
    if (body.effective_from && body.effective_to && body.effective_to < body.effective_from) {
      throw new HttpError(400, 'Price end date must be on or after its start date');
    }
    if (body.decision === 'reject' && (body.effective_from || body.effective_to)) {
      throw new HttpError(400, 'Rejected prices cannot have effective dates');
    }

    const row = await withUser(req.user!, async (client) => {
      const current = (await client.query(
        'SELECT id,requested_by,status FROM accounting_product_prices WHERE id=$1 AND entity_id=$2 FOR UPDATE',
        [priceId, entityId],
      )).rows[0];
      if (!current) throw new HttpError(404, 'Accounting product price not found');
      if (current.status !== 'draft') throw new HttpError(409, 'Only draft prices can be reviewed');
      if (current.requested_by === req.user!.id) throw new HttpError(409, 'The price requester cannot review their own price');
      const status = body.decision === 'approve' ? 'approved' : 'rejected';
      const updated = (await client.query(
        `UPDATE accounting_product_prices
         SET status=$3,reviewed_by=$4,review_reason=$5,reviewed_at=now(),effective_from=$6,effective_to=$7
         WHERE id=$1 AND entity_id=$2 AND status='draft' RETURNING *`,
        [
          priceId, entityId, status, req.user!.id, body.reason,
          body.decision === 'approve' ? body.effective_from : null,
          body.decision === 'approve' ? body.effective_to ?? null : null,
        ],
      )).rows[0];
      await audit(client, entityId, req.user!.id, `product_price_${status}`, 'accounting_product_price', priceId, {
        reason: body.reason,
        effective_from: updated.effective_from,
        effective_to: updated.effective_to,
      });
      return updated;
    });
    res.json(row);
  }));

  router.post('/entities/:entityId/product-prices/:priceId/retire', h(async (req, res) => {
    const entityId = UUID.parse(req.params.entityId);
    const priceId = UUID.parse(req.params.priceId);
    await assertAccess(withUser, req.user!, entityId, reviewers);
    const body = z.object({
      effective_to: z.string().date(),
      reason: z.string().trim().min(10).max(1000),
    }).strict().parse(req.body);
    const row = await withUser(req.user!, async (client) => {
      const current = (await client.query(
        `SELECT id,requested_by,status,effective_from FROM accounting_product_prices
         WHERE id=$1 AND entity_id=$2 FOR UPDATE`,
        [priceId, entityId],
      )).rows[0];
      if (!current) throw new HttpError(404, 'Accounting product price not found');
      if (current.status !== 'approved') throw new HttpError(409, 'Only approved prices can be retired');
      if (current.requested_by === req.user!.id) throw new HttpError(409, 'The price requester cannot retire their own price');
      if (body.effective_to < String(current.effective_from).slice(0, 10)) {
        throw new HttpError(400, 'Price end date must be on or after its start date');
      }
      const retired = (await client.query(
        `UPDATE accounting_product_prices
         SET status='retired',effective_to=$3,reviewed_by=$4,review_reason=$5,reviewed_at=now()
         WHERE id=$1 AND entity_id=$2 AND status='approved' RETURNING *`,
        [priceId, entityId, body.effective_to, req.user!.id, body.reason],
      )).rows[0];
      await audit(client, entityId, req.user!.id, 'product_price_retired', 'accounting_product_price', priceId, {
        reason: body.reason,
        effective_to: body.effective_to,
      });
      return retired;
    });
    res.json(row);
  }));

  router.get('/entities/:entityId/reports/product-profitability', h(async (req, res) => {
    const entityId = UUID.parse(req.params.entityId);
    await assertAccess(withUser, req.user!, entityId, readers);
    const range = z.object({ from: z.string().date().optional(), to: z.string().date().optional() }).parse(req.query);
    if (range.from && range.to && range.from > range.to) {
      throw new HttpError(400, 'Report start date must be on or before its end date');
    }
    const result = await withUser(req.user!, async (client) => {
      const params: unknown[] = [entityId];
      let dates = '';
      if (range.from) {
        params.push(range.from);
        dates += ` AND j.entry_date >= $${params.length}::date`;
      }
      if (range.to) {
        params.push(range.to);
        dates += ` AND j.entry_date <= $${params.length}::date`;
      }
      const rows = (await client.query(
        `SELECT p.id AS product_id,p.code AS product_code,p.name AS product_name,
          division.code AS division_code,division.name AS division_name,
          coalesce(sum(CASE WHEN a.account_type='revenue' THEN l.credit-l.debit ELSE 0 END),0)::text AS revenue,
          coalesce(sum(CASE WHEN a.account_type='expense' THEN l.debit-l.credit ELSE 0 END),0)::text AS attributed_expenses,
          coalesce(sum(CASE WHEN a.account_type='revenue' THEN l.credit-l.debit
            WHEN a.account_type='expense' THEN l.credit-l.debit ELSE 0 END),0)::text AS gross_profit_estimate,
          CASE WHEN coalesce(sum(CASE WHEN a.account_type='revenue' THEN l.credit-l.debit ELSE 0 END),0)=0
            THEN NULL
            ELSE round(
              100.0*sum(CASE WHEN a.account_type='revenue' THEN l.credit-l.debit
                WHEN a.account_type='expense' THEN l.credit-l.debit ELSE 0 END)
              /sum(CASE WHEN a.account_type='revenue' THEN l.credit-l.debit ELSE 0 END),2
            )::text
          END AS gross_margin_percent_estimate,
          count(*)::int AS attributed_line_count
         FROM accounting_journals j
         JOIN accounting_journal_lines l ON l.journal_id=j.id AND l.entity_id=j.entity_id
         JOIN accounting_accounts a ON a.id=l.account_id AND a.entity_id=l.entity_id
         LEFT JOIN accounting_products p ON p.id=l.product_id AND p.entity_id=l.entity_id
         LEFT JOIN accounting_products division
           ON division.id=CASE WHEN p.product_type='division' THEN p.id ELSE p.parent_product_id END
           AND division.entity_id=p.entity_id
         WHERE j.entity_id=$1 AND j.status='posted' AND a.account_type IN ('revenue','expense')${dates}
         GROUP BY p.id,p.code,p.name,division.code,division.name
         ORDER BY division.name NULLS LAST,p.name NULLS LAST`,
        params,
      )).rows;
      const targets = (await client.query(
        `SELECT p.code AS division_code,p.name AS division_name,t.scenario_code,t.scenario_name,
          t.plan_year_index,t.revenue_target::text,t.currency,t.source_note
         FROM accounting_product_targets t
         JOIN accounting_products p ON p.id=t.product_id AND p.entity_id=t.entity_id
         WHERE t.entity_id=$1 ORDER BY t.scenario_code,t.plan_year_index,p.code`,
        [entityId],
      )).rows;
      const entity = (await client.query(
        'SELECT id,name,base_currency FROM accounting_entities WHERE id=$1',
        [entityId],
      )).rows[0];
      return { entity, report: 'product-profitability', from: range.from ?? null, to: range.to ?? null, rows, targets };
    });
    if (req.query.format === 'csv') {
      sendProfitabilityCsv(res, result.rows);
      return;
    }
    res.json(result);
  }));

  return router;
}
