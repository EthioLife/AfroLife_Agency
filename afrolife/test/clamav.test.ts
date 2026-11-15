import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { once } from 'node:events';
import { isClamAvConfigured, scanWithClamAv } from '../src/clamav.js';

async function withScanner(response: string, run: (port: number, received: () => Buffer) => Promise<void>) {
  let received = Buffer.alloc(0);
  const server = net.createServer((socket) => {
    socket.on('data', (chunk) => {
      received = Buffer.concat([received, chunk]);
      if (received.length >= 4 && received.subarray(-4).equals(Buffer.alloc(4))) {
        socket.end(Buffer.from(response, 'utf8'));
      }
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    await run(address.port, () => received);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('ClamAV configuration rejects an absent host or invalid port', () => {
  assert.equal(isClamAvConfigured({}), false);
  assert.equal(isClamAvConfigured({ host: '127.0.0.1', port: '0' }), false);
  assert.equal(isClamAvConfigured({ host: '127.0.0.1', port: '3310' }), true);
});

test('ClamAV configuration reads the documented environment variables', () => {
  const priorHost = process.env.CLAMAV_HOST;
  const priorPort = process.env.CLAMAV_PORT;
  try {
    process.env.CLAMAV_HOST = '127.0.0.1';
    process.env.CLAMAV_PORT = '3310';
    assert.equal(isClamAvConfigured(), true);
  } finally {
    if (priorHost === undefined) delete process.env.CLAMAV_HOST;
    else process.env.CLAMAV_HOST = priorHost;
    if (priorPort === undefined) delete process.env.CLAMAV_PORT;
    else process.env.CLAMAV_PORT = priorPort;
  }
});

test('ClamAV streaming scan sends framed bytes and accepts only a clean response', async () => {
  const content = Buffer.from('private evidence bytes');
  await withScanner('stream: OK\0', async (port, received) => {
    assert.equal(await scanWithClamAv(content, { host: '127.0.0.1', port: String(port) }), 'clean');
    assert.ok(received().includes(Buffer.from('zINSTREAM\0')));
    assert.ok(received().includes(content));
  });
});

test('ClamAV streaming scan reports infected content without treating it as clean', async () => {
  await withScanner('stream: Eicar-Test-Signature FOUND\0', async (port) => {
    assert.equal(await scanWithClamAv(Buffer.from('infected'), {
      host: '127.0.0.1', port: String(port),
    }), 'infected');
  });
});

test('ClamAV scans fail explicitly when scanner configuration is missing', async () => {
  await assert.rejects(scanWithClamAv(Buffer.from('evidence'), {}), /host and a valid port must be configured/);
});
