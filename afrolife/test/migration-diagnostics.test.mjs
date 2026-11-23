import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseMigrations } from '../scripts/migration-diagnostics.mjs';

test('migration diagnostics report missing, mismatched, unverified, and unexpected names only', () => {
  const result = diagnoseMigrations(
    [
      { name: '001_initial.sql', checksum: 'expected-1' },
      { name: '002_next.sql', checksum: 'expected-2' },
      { name: '003_last.sql', checksum: 'expected-3' },
    ],
    [
      { name: '001_initial.sql', checksum: 'expected-1' },
      { name: '002_next.sql', checksum: null },
      { name: '004_unexpected.sql', checksum: 'unneeded' },
    ],
  );

  assert.deepEqual(result, {
    expected: 3,
    applied: 2,
    missing: ['003_last.sql'],
    checksumMismatches: [],
    checksumsUnverified: ['002_next.sql'],
    unexpected: ['004_unexpected.sql'],
  });
  assert.equal(JSON.stringify(result).includes('unneeded'), false);
});

test('migration diagnostics report checksum mismatch names without checksum values', () => {
  const result = diagnoseMigrations(
    [{ name: '001_initial.sql', checksum: 'expected-value' }],
    [{ name: '001_initial.sql', checksum: 'stored-value' }],
  );

  assert.deepEqual(result.checksumMismatches, ['001_initial.sql']);
  assert.equal(JSON.stringify(result).includes('stored-value'), false);
  assert.equal(JSON.stringify(result).includes('expected-value'), false);
});
