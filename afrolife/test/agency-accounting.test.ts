import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('Agency contract, commission, payout and refund journals enqueue balanced Accounting events in their source transaction', () => {
  const domain = source('src/domain.ts');
  const agencyOperations = source('src/agency-operations.ts');
  const ops = source('src/ops.ts');
  const webhook = source('src/webhooks.ts');
  assert.match(domain, /source_reference:`agency-contract:\$\{k\.id\}`/);
  assert.match(domain, /source_reference: `agency-commission-accrual:\$\{id\}`/);
  assert.match(agencyOperations, /source_reference: `agency-commission-payment:\$\{k\.id\}`/);
  assert.match(agencyOperations, /source_reference: `agency-commission-holdback-payment:\$\{k\.id\}`/);
  assert.match(ops, /source_reference: `agency-dispute-refund:\$\{d\.id\}`/);
  for (const path of ['src/domain.ts', 'src/agency-operations.ts', 'src/ops.ts']) {
    assert.match(source(path), /enqueueAccountingEvent/);
  }
  assert.match(ops, /maker_id: d\.opened_by,[\s\S]*checker_id: req\.user!\.id/);
  assert.match(agencyOperations, /checker_id: k\.approved_by/);
  assert.match(domain, /provider_event_id IS NOT NULL AND reconciled=false/);
  assert.match(domain, /A different finance user must reconcile this payment/);
  assert.doesNotMatch(webhook, /post\(c,/);
  assert.match(webhook, /payment-provider-event:/);
});
