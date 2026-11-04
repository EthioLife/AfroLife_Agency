import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  GLOBAL_BI_METRICS,
  getGlobalBiMetric,
  isGlobalBiMetricKey,
  isThirtyMinuteBucket,
} from '../services/global-bi/catalog.js';
import {
  assertProjectionTenant,
  validateGlobalBiProjectionBatch,
} from '../services/global-bi/projection-contract.js';
import { assertGlobalBiAccess } from '../services/global-bi/access-control.js';
import { parseGlobalBiRange } from '../services/global-bi/query-range.js';
import { summarizeProjectionStatus } from '../services/global-bi/projection-status.js';

const now = new Date('2026-10-14T12:00:00.000Z');
const validBatch = {
  tenantId: '00000000-0000-4000-8000-000000000001',
  generatedAt: '2026-10-14T12:00:00.000Z',
  projections: [
    {
      metricKey: 'finance.posted_journals',
      bucketStart: '2026-10-14T11:30:00Z',
      value: '24',
    },
    {
      metricKey: 'finance.posted_volume',
      bucketStart: '2026-10-14T11:30:00Z',
      value: '42150.00',
      currency: 'ETB',
    },
  ],
};

test('Global BI catalog defines bounded aggregate metrics and 30-minute UTC buckets', () => {
  assert.equal(GLOBAL_BI_METRICS.length, 10);
  assert.equal(isGlobalBiMetricKey('finance.posted_volume'), true);
  assert.equal(isGlobalBiMetricKey('users.email_addresses'), false);
  assert.equal(getGlobalBiMetric('finance.pending_journals').aggregation, 'snapshot');
  assert.equal(isThirtyMinuteBucket('2026-10-14T12:00:00Z'), true);
  assert.equal(isThirtyMinuteBucket('2026-10-14T12:30:00.000Z'), true);
  assert.equal(isThirtyMinuteBucket('2026-10-14T12:15:00Z'), false);
  assert.equal(isThirtyMinuteBucket('2026-10-14T12:30:01Z'), false);
  assert.equal(isThirtyMinuteBucket('2026-10-14T12:30:00+03:00'), false);
});

test('Global BI accepts strict aggregate-only 30-minute projections', () => {
  const parsed = validateGlobalBiProjectionBatch(validBatch, now);
  assert.deepEqual(parsed, validBatch);
  assert.doesNotThrow(() => assertProjectionTenant(parsed, validBatch.tenantId));
  assert.throws(() => assertProjectionTenant(parsed, '00000000-0000-4000-8000-000000000002'), /does not match/);
  assert.throws(() => assertProjectionTenant(parsed, undefined), /GLOBAL_BI_PROJECTOR_TENANT_ID must be a valid UUID/);
  assert.throws(() => assertProjectionTenant(parsed, 'not-a-uuid'), /GLOBAL_BI_PROJECTOR_TENANT_ID must be a valid UUID/);
  assert.throws(() => validateGlobalBiProjectionBatch({ ...validBatch, customerEmail: 'private@example.test' }, now), /Unrecognized key/);
  assert.throws(() => validateGlobalBiProjectionBatch({
    ...validBatch,
    projections: [{ ...validBatch.projections[0], transactionId: 'sensitive-row-id' }],
  }, now), /Unrecognized key/);
});

test('Global BI rejects duplicate, future, unaligned, stale, and unit-mismatched projections', () => {
  assert.throws(() => validateGlobalBiProjectionBatch({
    ...validBatch,
    projections: [validBatch.projections[0], validBatch.projections[0]],
  }, now), /only once/);
  assert.throws(() => validateGlobalBiProjectionBatch({
    ...validBatch,
    projections: [{ ...validBatch.projections[0], bucketStart: '2026-10-14T11:15:00Z' }],
  }, now), /UTC 00 or 30 minute boundary/);
  assert.throws(() => validateGlobalBiProjectionBatch({
    ...validBatch,
    projections: [{ ...validBatch.projections[0], bucketStart: '2025-09-01T00:00:00Z' }],
  }, now), /13-month retention window/);
  assert.throws(() => validateGlobalBiProjectionBatch({
    ...validBatch,
    projections: [{ ...validBatch.projections[0], bucketStart: '2026-10-14T12:30:00Z' }],
  }, now), /future bucket/);
  assert.throws(() => validateGlobalBiProjectionBatch({
    ...validBatch,
    projections: [{ ...validBatch.projections[0], bucketStart: '2026-10-14T12:30:00Z' }],
  }, new Date('2026-10-14T12:30:00Z')), /bucket must not start after it was generated/);
  assert.throws(() => validateGlobalBiProjectionBatch({
    ...validBatch,
    projections: [{ ...validBatch.projections[0], value: '1.5' }],
  }, now), /integer count/);
  assert.throws(() => validateGlobalBiProjectionBatch({
    ...validBatch,
    projections: [{ ...validBatch.projections[1], currency: undefined }],
  }, now), /requires a currency/);
});

test('Global BI filters require aligned UTC ranges bounded to 31 days and retention', () => {
  assert.deepEqual(parseGlobalBiRange({
    from: '2026-10-14T00:00:00.000Z',
    to: '2026-10-14T12:00:00.000Z',
  }, now), {
    from: '2026-10-14T00:00:00.000Z',
    to: '2026-10-14T12:00:00.000Z',
  });
  assert.throws(() => parseGlobalBiRange({
    from: '2026-10-14T00:15:00.000Z', to: '2026-10-14T12:00:00.000Z',
  }, now), /align to a 30-minute UTC bucket/);
  assert.throws(() => parseGlobalBiRange({
    from: '2026-09-01T00:00:00.000Z', to: '2026-10-14T12:00:00.000Z',
  }, now), /limited to 31 days/);
  assert.throws(() => parseGlobalBiRange({
    from: '2025-01-01T00:00:00.000Z', to: '2025-01-02T00:00:00.000Z',
  }, now), /limited to the retention window/);
  assert.doesNotThrow(() => assertGlobalBiAccess('super_admin'));
  assert.throws(() => assertGlobalBiAccess('analytics_admin'), /assigned platform administrators/);
  assert.doesNotThrow(() => assertGlobalBiAccess('global_admin'));
});

test('Global BI status never confuses observed data with configured projector health', () => {
  const noData = summarizeProjectionStatus(null, 0, now);
  assert.equal(noData.projectionState, 'not_configured');
  assert.equal(noData.projectorConfiguration, 'not_configured');
  assert.equal(noData.schedulerConfiguration, 'not_configured');
  assert.equal(noData.tenantProjectorHealth, 'unconfirmed');

  const recent = summarizeProjectionStatus(new Date('2026-10-14T11:30:00.000Z'), 2, now);
  assert.equal(recent.projectionState, 'recent_projection_observed');
  assert.equal(recent.observedTenants, 2);
  assert.equal(recent.projectorConfiguration, 'not_configured');
  assert.equal(recent.tenantProjectorHealth, 'unconfirmed');

  assert.equal(
    summarizeProjectionStatus(new Date('2026-10-14T11:00:00.000Z'), 1, now).projectionState,
    'stale',
  );
  assert.equal(
    summarizeProjectionStatus(new Date('2026-10-14T12:30:00.000Z'), 1, now).projectionState,
    'invalid_timestamp',
  );
});

test('Global BI schema keeps tenant projectors and Global Admin query isolated', async () => {
  const migration = await readFile(
    new URL('../services/global-bi/migrations/002_global_bi_30_minute_aggregates.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /global_bi_30m_aggregates_global_admin_read/);
  assert.match(migration, /current_setting\('app\.role',true\)='global_admin'/);
  assert.match(migration, /current_setting\('app\.service',true\)='global_bi_projector'/);
  assert.match(migration, /GRANT SELECT ON TABLE global_bi_30m_aggregates TO "\{\{query_role\}\}"/);
  assert.match(migration, /GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE global_bi_30m_aggregates TO "\{\{ingest_role\}\}"/);
  assert.match(migration, /extract\(epoch FROM bucket_start\)::bigint % 1800 = 0/);
  assert.match(migration, /DROP POLICY IF EXISTS global_bi_aggregates_authorized_read/);

  const template = await readFile(
    new URL('../services/global-bi/projector/cronjob.example.yaml', import.meta.url),
    'utf8',
  );
  assert.match(template, /suspend: true/);
  assert.match(template, /schedule: "\*\/30 \* \* \* \*"/);
  assert.doesNotMatch(template, /password:|connectionString:|tenantDatabaseUrl:/i);
});
