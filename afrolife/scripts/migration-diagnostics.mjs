import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export function diagnoseMigrations(expectedMigrations, appliedMigrations) {
  const applied = new Map(appliedMigrations.map(({ name, checksum }) => [name, checksum]));
  const expectedNames = new Set(expectedMigrations.map(({ name }) => name));
  const missing = expectedMigrations.filter(({ name }) => !applied.has(name)).map(({ name }) => name);
  const checksumMismatches = expectedMigrations
    .filter(({ name, checksum }) => {
      const stored = applied.get(name);
      return stored !== undefined && stored !== null && stored !== checksum;
    })
    .map(({ name }) => name);
  const checksumsUnverified = expectedMigrations
    .filter(({ name }) => applied.get(name) === null)
    .map(({ name }) => name);
  const unexpected = [...applied.keys()].filter((name) => !expectedNames.has(name)).sort();

  return {
    expected: expectedMigrations.length,
    applied: expectedMigrations.length - missing.length,
    missing,
    checksumMismatches,
    checksumsUnverified,
    unexpected,
  };
}

export async function loadExpectedMigrations(directory) {
  const files = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
  return Promise.all(files.map(async (name) => {
    const sql = await readFile(join(directory, name), 'utf8');
    return { name, checksum: createHash('sha256').update(sql).digest('hex') };
  }));
}
