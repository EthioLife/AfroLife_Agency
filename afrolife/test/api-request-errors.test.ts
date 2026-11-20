import test from 'node:test';
import assert from 'node:assert/strict';
import { isMalformedJsonRequestError } from '../src/api-request-errors.js';

test('malformed JSON errors are identified without inspecting their request body', () => {
  const error = Object.assign(new SyntaxError('Invalid JSON'), {
    type: 'entity.parse.failed',
    body: '{"password":"must-not-be-logged"}',
  });

  assert.equal(isMalformedJsonRequestError(error), true);
  assert.equal(isMalformedJsonRequestError(new SyntaxError('Invalid JSON')), false);
  assert.equal(isMalformedJsonRequestError(null), false);
});
