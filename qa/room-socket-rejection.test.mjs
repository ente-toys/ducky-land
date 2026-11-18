import assert from 'node:assert/strict';
import test from 'node:test';
import {sentryOptions} from '../server/sentry.js';
import {makeRoom} from './room-harness.mjs';

test('room reports each command rejection before closing the socket', async t => {
  const room = await makeRoom();
  t.mock.timers.enable({apis: ['Date'], now: Date.now()});
  for (const {tokens, message, reason} of [
    {tokens: 0, message: '{}', reason: 'rate_limit'},
    {tokens: 30, message: new Uint8Array(1), reason: 'non_text_message'},
    {tokens: 30, message: 'x'.repeat(513), reason: 'message_too_large'},
  ]) {
    const events = [];
    const socket = {close: (code, message) => events.push(['close', code, message])};
    room.connections.set(socket, {tokens, tokenTime: Date.now()});
    room.reportSocketRejection = (...args) => events.push(['report', ...args]);

    room.webSocketMessage(socket, message);

    assert.deepEqual(events, [
      ['report', reason, 1008],
      ['close', 1008, 'Invalid or excessive commands'],
    ]);
    room.connections.delete(socket);
  }
});

test('Sentry keeps only allowlisted socket rejection details', () => {
  const {beforeSendLog} = sentryOptions({}, 'room', new Set());
  for (const reason of ['rate_limit', 'non_text_message', 'message_too_large', 'unexpected']) {
    const log = beforeSendLog({
      message: 'Room socket rejected',
      attributes: {rejection_reason: reason, close_code: 1008, connections: 40, payload: 'private'},
    });
    const expected = {service: 'room', close_code: 1008, connections: 40};
    if (reason !== 'unexpected') expected.rejection_reason = reason;
    assert.deepEqual(log.attributes, expected);
  }
});
