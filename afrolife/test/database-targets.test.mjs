import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSameDatabaseTarget } from '../scripts/database-targets.mjs';

test('database target check permits different roles and connection options for one database', () => {
  assert.doesNotThrow(() => assertSameDatabaseTarget(
    'postgres://runtime:runtime-secret@db.example.net:5432/afrolife?sslmode=require',
    'postgres://owner:owner-secret@db.example.net:5432/afrolife?sslmode=verify-full',
  ));
});

test('database target check rejects a different host, port, or database', () => {
  const runtime = 'postgres://runtime:secret@db.example.net:5432/afrolife';
  for (const migration of [
    'postgres://owner:secret@other.example.net:5432/afrolife',
    'postgres://owner:secret@db.example.net:5433/afrolife',
    'postgres://owner:secret@db.example.net:5432/other',
  ]) {
    assert.throws(
      () => assertSameDatabaseTarget(runtime, migration),
      /must target the same host, port, and database/,
    );
  }
});
