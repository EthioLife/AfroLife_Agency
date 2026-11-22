import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { resolveEnvironmentUrl } from '../launcher.js';

const config = JSON.parse(
  await readFile(new URL('../environments.json', import.meta.url), 'utf8')
);
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('loads the launcher from a JavaScript asset supported by static hosts', () => {
  assert.match(html, /<link rel="stylesheet" href="\/admin\/styles\.css">/);
  assert.match(html, /<script type="module" src="\/admin\/launcher\.js"><\/script>/);
});

test('exposes the recovered UAT Canary destination without a stale warning', () => {
  assert.match(html, /id="uat-readiness"[^>]*role="status"/);
  assert.equal(
    resolveEnvironmentUrl(config.uatCanary),
    'https://afrolife-agency.app.aletcloud.com/'
  );
  assert.equal(config.uatCanaryNotice, '');
});

test('does not show a stale warning when Development is ready', () => {
  assert.equal(
    resolveEnvironmentUrl(config.development),
    'https://afrolife-development.app.aletcloud.com/'
  );
  assert.equal(config.developmentNotice, '');
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
