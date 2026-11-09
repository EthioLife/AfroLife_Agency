import { createHash } from 'node:crypto';

const acceptedLegacyMigrationName = '114_property_resident_rls_recursion_fix.sql';
const acceptedLegacyMigrationChecksum = '99372e3e6d9f8e7eb2717eaa65fdba9cf4c3b2166ad5738c43a6937d40596af5';
const acceptedLegacyCurrentChecksum = '7522ab1fdbe1f5579308cbf27e87ba8bcb8d3d2d20184c3caf9377c35929b2c9';

/**
 * This exact historical QA record is accepted because its original SQL
 * checksum could not be reconstructed from the available source history.
 * Keep this exception limited to this migration name and exact source checksum.
 * Do not update the historical schema_migrations record.
 */
function isAcceptedLegacyMigrationChecksum(name: string, stored: string): boolean {
  return name === acceptedLegacyMigrationName
    && stored === acceptedLegacyMigrationChecksum;
}

function isAcceptedLegacyMigration(name: string, stored: string, current: string): boolean {
  return isAcceptedLegacyMigrationChecksum(name, stored)
    && current === acceptedLegacyCurrentChecksum;
}

export function migrationChecksum(sql: string): string {
  return createHash('sha256').update(sql).digest('hex');
}

export function assertMigrationChecksum(name: string, stored: string | null, current: string): void {
  if (
    stored !== null
    && stored !== current
    && !isAcceptedLegacyMigration(name, stored, current)
  ) {
    throw new Error(
      `Migration ${name} has changed since it was applied; restore the applied migration and add a new migration instead.`,
    );
  }
}

export function assessMigrationReadiness(
  expectedMigrations: ReadonlyArray<{ name: string; checksum: string }>,
  appliedMigrations: ReadonlyArray<{ name: string; checksum: string | null }>,
) {
  const applied = new Map(appliedMigrations.map(({ name, checksum }) => [name, checksum]));
  const expectedNames = new Set(expectedMigrations.map(({ name }) => name));
  const missing = expectedMigrations.filter(({ name }) => !applied.has(name));

  const checksumMismatches = expectedMigrations.filter(({ name, checksum }) => {
    const storedChecksum = applied.get(name);
    return storedChecksum !== undefined
      && storedChecksum !== null
      && storedChecksum !== checksum
      && !isAcceptedLegacyMigration(name, storedChecksum, checksum);
  }).length;

  const checksumsUnverified = expectedMigrations.filter(
    ({ name }) => applied.get(name) === null,
  ).length;

  const unexpectedMigrations = [...applied.keys()].filter(
    (name) => !expectedNames.has(name),
  ).length;

  return {
    current: missing.length === 0
      && checksumMismatches === 0
      && checksumsUnverified === 0
      && unexpectedMigrations === 0,
    applied: expectedMigrations.length - missing.length,
    expected: expectedMigrations.length,
    checksumMismatches,
    checksumsUnverified,
    unexpectedMigrations,
  };
}