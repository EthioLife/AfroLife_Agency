import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { resolveEnvironmentUrl } from '../launcher.mjs';

const config = JSON.parse(
  await readFile(new URL('../environments.json', import.meta.url), 'utf8')
);
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('exposes UAT Canary with an explicit readiness warning', () => {
  assert.match(html, /id="uat-readiness"[^>]*role="status"/);
  assert.equal(
    resolveEnvironmentUrl(config.uatCanary),
    'https://afrolife-agency.app.aletcloud.com/'
  );
  assert.match(config.uatCanaryNotice, /2026-11-20/);
  assert.match(config.uatCanaryNotice, /118\/152 migrations applied/);
});

test('uses the verified Development sign-in destination', () => {
  assert.equal(
    resolveEnvironmentUrl(config.development),
    'https://afrolife-development.app.aletcloud.com/'
  );
  assert.match(config.developmentNotice, /2026-11-20/);
  assert.match(config.developmentNotice, /all 152 expected migrations/);
});

test('rejects destinations that are not an exact secure admin URL', () => {
  for (const value of [
    'http://example.com/admin',
    'https://example.com/admin/',
    'https://example.com/admin/settings',
    'https://example.com/',
    'https://example.com/admin?next=/',
    'https://example.com/admin#section',
    'https://user:pass@example.com/admin',
    '/admin',
    'https://afrolife-agency.app.aletcloud.com/unverified-path',
    'https://afrolife-agency.app.aletcloud.com:8443/admin',
    'https://evil.example/admin',
  ]) {
    assert.equal(resolveEnvironmentUrl(value), null, `expected rejection: ${value}`);
  }
});

test('accepts the configured app admin path', () => {
  assert.equal(
    resolveEnvironmentUrl('https://afrolife-development.app.aletcloud.com/admin'),
    'https://afrolife-development.app.aletcloud.com/admin'
  );
});
