import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPrivateStorage } from '../src/storage.js';

const fileKey = '00000000-0000-4000-8000-000000000001';

test('private file storage preserves local filesystem behavior', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'afrolife-private-files-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const storage = createPrivateStorage({ FILE_STORAGE_DIR: root });
  const content = Buffer.from('local private file');

  await storage.putFile(fileKey, content);
  await storage.check();
  assert.deepEqual(await storage.getFile(fileKey), content);
  await assert.rejects(storage.putFile('../invalid', content), /Invalid private file key/);
});

test('private object storage signs requests and round-trips private objects', async (t) => {
  const bucket = 'afrolife-private-files';
  const content = Buffer.from('private object contents');
  const stored = new Map<string, Buffer>();
  let signedRequests = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    if (request.headers.get('authorization')?.startsWith('AWS4-HMAC-SHA256')) signedRequests += 1;
    const path = new URL(request.url).pathname;
    if (request.method === 'HEAD' && path === `/${bucket}`) return new Response(null, { status: 200 });
    if (path !== `/${bucket}/${fileKey}`) return new Response(null, { status: 404 });
    if (request.method === 'PUT') {
      if (request.headers.get('if-none-match') !== '*') return new Response(null, { status: 400 });
      if (stored.has(path)) return new Response(null, { status: 412 });
      stored.set(path, Buffer.from(await request.arrayBuffer()));
      return new Response(null, { status: 200 });
    }
    if (request.method === 'GET') {
      const object = stored.get(path);
      return object ? new Response(object, { status: 200 }) : new Response(null, { status: 404 });
    }
    return new Response(null, { status: 405 });
  };
  try {
    const storage = createPrivateStorage({
      NODE_ENV: 'test',
      S3_BUCKET: bucket,
      S3_ENDPOINT: 'https://s3.aletcloud.test',
      AWS_REGION: 'test-region',
      AWS_ACCESS_KEY_ID: 'test-access-key',
      AWS_SECRET_ACCESS_KEY: 'test-secret-key',
    });

    await storage.check();
    await storage.putFile(fileKey, content);
    await assert.rejects(storage.putFile(fileKey, Buffer.from('replacement')), /HTTP 412/);
    assert.deepEqual(await storage.getFile(fileKey), content);
    assert.equal(signedRequests, 4);
    await assert.rejects(storage.getFile('../invalid'), /Invalid private file key/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
