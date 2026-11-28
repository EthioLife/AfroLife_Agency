import { createHash, createHmac, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

type AccountingLine = { source_account_code: string; debit: string; credit: string; description?: string };
type AccountingEvent = {
  source_event_id: string; source_entity_id: string; entry_date: string; source_reference: string;
  description: string; lines: AccountingLine[]; maker_id: string; checker_id: string; checker_reason: string;
};

export async function enqueueAccountingEvent(client: PoolClient, input: Omit<AccountingEvent, 'source_event_id'>): Promise<string | undefined> {
  if (input.maker_id === input.checker_id) throw new Error('Accounting events require distinct maker and checker identities');
  if (!process.env.ACCOUNTING_SERVICE_URL && !process.env.ACCOUNTING_INGEST_SECRET) return;
  if (!process.env.ACCOUNTING_SERVICE_URL || !process.env.ACCOUNTING_INGEST_SECRET) throw new Error('Accounting event delivery requires both ACCOUNTING_SERVICE_URL and ACCOUNTING_INGEST_SECRET');
  const source_event_id = randomUUID();
  const payload = { ...input, source_event_id };
  await client.query(
    `INSERT INTO accounting_event_outbox(source_event_id,source_entity_id,payload)
     VALUES($1,$2,$3::jsonb) ON CONFLICT(source_event_id) DO NOTHING`,
    [source_event_id, input.source_entity_id, JSON.stringify(payload)],
  );
  return source_event_id;
}

export async function dispatchAccountingEvents(pool: Pool, serviceUrl: string, secret: string, source = 'afrolife_core', dispatcherRole = 'finance_manager') {
  const client = await pool.connect();
  let events: { id: string; payload: AccountingEvent }[] = [];
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.role',$1,true)", [dispatcherRole]);
    events = (await client.query(
      `WITH picked AS (
         SELECT id FROM accounting_event_outbox
         WHERE status='pending' AND next_attempt_at <= now() AND (locked_until IS NULL OR locked_until < now())
         ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 20
       )
       UPDATE accounting_event_outbox o SET locked_until=now()+interval '2 minutes',attempts=attempts+1
       FROM picked WHERE o.id=picked.id RETURNING o.id,o.payload`,
    )).rows;
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }

  for (const event of events) {
    try {
      const url = new URL('/api/v1/accounting/internal/events', serviceUrl);
      const body = JSON.stringify(event.payload);
      const timestamp = String(Date.now());
      const bodyHash = createHash('sha256').update(body).digest('hex');
      const signature = createHmac('sha256', secret)
        .update(`${source}\n${timestamp}\nPOST\n${url.pathname}\n${bodyHash}`).digest('hex');
      const response = await fetch(url, { method: 'POST', headers: {
        'content-type': 'application/json', 'x-accounting-source': source,
        'x-accounting-timestamp': timestamp, 'x-accounting-signature': signature,
      }, body, signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`Accounting service returned HTTP ${response.status}: ${(await response.text()).slice(0,500)}`);
      await updateOutbox(
        pool,
        `UPDATE accounting_event_outbox SET status='delivered',delivered_at=now(),locked_until=NULL,last_error=NULL WHERE id=$1`,
        [event.id],
        dispatcherRole,
        event.payload.source_event_id,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0,1000) : 'Accounting event delivery failed';
      await updateOutbox(pool,
        `UPDATE accounting_event_outbox SET status=CASE WHEN attempts>=12 THEN 'dead' ELSE 'pending' END,
         next_attempt_at=now()+make_interval(secs=>LEAST(3600,15*power(2,LEAST(attempts,8))::int)),
         locked_until=NULL,last_error=$2 WHERE id=$1`, [event.id, message],
        dispatcherRole,
      );
      console.error('accounting event delivery failed', { outbox_id: event.id, error: message });
    }
  }
  return events.length;
}

async function updateOutbox(pool:Pool,sql:string,params:unknown[],dispatcherRole:string,deliveredEventId?:string){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.role',$1,true)",[dispatcherRole]);
    await client.query(sql,params);
    if(deliveredEventId){
      const subscriptionsExist=(await client.query(
        "SELECT to_regclass('public.platform_service_subscriptions') IS NOT NULL AS present",
      )).rows[0]?.present===true;
      if(subscriptionsExist){
        await client.query(
        `UPDATE platform_service_subscriptions
         SET status='active',active_from=transaction_timestamp(),
           active_until=transaction_timestamp()+interval '1 month'
         WHERE accounting_event_id=$1 AND status='accounting_pending'`,
        [deliveredEventId],
      );
      }
    }
    await client.query('COMMIT');
  }
  catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
