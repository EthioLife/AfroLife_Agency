import test from 'node:test';
import assert from 'node:assert/strict';
import { completeClamAvStream } from '../scripts/clamav-test-fixture.mjs';

function frame(...chunks) {
  const frames = chunks.flatMap((chunk) => {
    const size = Buffer.alloc(4);
    size.writeUInt32BE(chunk.length);
    return [size, chunk];
  });
  return Buffer.concat([Buffer.from('zINSTREAM\0'), ...frames, Buffer.alloc(4)]);
}

test('ClamAV fixture accepts complete one- and multi-chunk INSTREAM frames', () => {
  assert.equal(completeClamAvStream(frame(Buffer.from('evidence'))), true);
  assert.equal(completeClamAvStream(frame(Buffer.from([0, 0, 0, 0]), Buffer.from('file'))), true);
});

test('ClamAV fixture rejects missing, truncated, and trailing INSTREAM frames', () => {
  const command = Buffer.from('zINSTREAM\0');
  const valid = frame(Buffer.from('evidence'));

  assert.equal(completeClamAvStream(command), undefined);
  assert.equal(completeClamAvStream(valid.subarray(0, valid.length - 4)), undefined);
  assert.equal(completeClamAvStream(Buffer.concat([command, Buffer.from([0, 0, 0, 8]), Buffer.from('short')])), undefined);
  assert.equal(completeClamAvStream(Buffer.concat([valid, Buffer.from([0])])), false);
  assert.equal(completeClamAvStream(Buffer.from('xINSTREAM\0')), false);
  assert.equal(completeClamAvStream(Buffer.concat([command, Buffer.from([0, 0, 0, 0]), Buffer.from([0])])), false);
});
