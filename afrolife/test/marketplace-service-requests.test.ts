import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  marketplaceServiceDecisionInput,
  marketplaceServiceQuoteInput,
  marketplaceServiceRequestInput,
} from '../src/marketplace-service-requests.js';

const migration = readFileSync(resolve(process.cwd(), 'migrations/150_marketplace_service_requests.sql'), 'utf8');

test('service inquiries require valid listing and detailed request data', () => {
  const validRequest = {
    listing_id: '109156be-c4fb-41ea-b1b4-efe1671c5836',
    preferred_date: '2030-01-01',
    request_details: 'Please quote weekly home cleaning for a two-bedroom apartment.',
  };
  assert.equal(marketplaceServiceRequestInput.safeParse(validRequest).success, true);
  assert.equal(marketplaceServiceRequestInput.safeParse({
    ...validRequest, request_details: 'Too short',
  }).success, false);
  assert.equal(marketplaceServiceRequestInput.safeParse({
    ...validRequest, preferred_date: '2026-02-30',
  }).success, false);
});

test('service quotes require a positive ETB amount and valid terms', () => {
  const validQuote = {
    amount: '0.01',
    expires_on: '2030-01-01',
    terms: 'Includes the agreed service and listed materials.',
  };
  assert.equal(marketplaceServiceQuoteInput.safeParse(validQuote).success, true);
  assert.equal(marketplaceServiceQuoteInput.safeParse({ ...validQuote, amount: '0' }).success, false);
  assert.equal(marketplaceServiceQuoteInput.safeParse({ ...validQuote, amount: '0.00' }).success, false);
  assert.equal(marketplaceServiceQuoteInput.safeParse({ ...validQuote, amount: '-1' }).success, false);
});

test('declining a service quote requires a reason', () => {
  assert.equal(marketplaceServiceDecisionInput.safeParse({ decision: 'accept' }).success, true);
  assert.equal(marketplaceServiceDecisionInput.safeParse({ decision: 'decline' }).success, false);
  assert.equal(marketplaceServiceDecisionInput.safeParse({
    decision: 'decline', reason: 'The service terms do not meet my needs.',
  }).success, true);
});

test('service request migration enforces participant-scoped RLS and Addis date semantics', () => {
  assert.match(migration, /ALTER TABLE marketplace_service_requests ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /ALTER TABLE marketplace_service_requests FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /UNIQUE \(buyer_user_id,idempotency_key\)/);
  assert.match(migration, /Africa\/Addis_Ababa/);
  assert.equal(
    (migration.match(/role_name NOT IN \('global_admin','super_admin','corporate_business_manager'\)/g) ?? []).length,
    4,
  );
  assert.ok((migration.match(/app_role\(\) IN \('global_admin','super_admin','corporate_business_manager'\)/g) ?? []).length >= 3);
  assert.doesNotMatch(migration, /current_date/i);
});
