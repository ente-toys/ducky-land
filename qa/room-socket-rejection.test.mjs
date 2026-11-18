import assert from 'node:assert/strict';
import test from 'node:test';
import {sentryOptions} from '../server/sentry.js';
import {addPlayer, makeRoom} from './room-harness.mjs';

test('room caps the command budget at 300 and refills 240 commands per second', async t => {
  const room = await makeRoom();
  t.mock.timers.enable({apis: ['Date'], now: Date.now()});
  const closes = [];
  const socket = {close: code => closes.push(code)};
  const info = {tokens: 0, tokenTime: Date.now()};
  room.connections.set(socket, info);

  t.mock.timers.tick(1000);
  room.webSocketMessage(socket, '{}');
  assert.equal(info.tokens, 239);

  t.mock.timers.tick(2000);
  room.webSocketMessage(socket, '{}');
  assert.equal(info.tokens, 299);
  assert.deepEqual(closes, []);

  info.tokens = 0;
  room.webSocketMessage(socket, '{}');
  assert.equal(info.tokens, 0);
  assert.deepEqual(closes, []);
});

test('room keeps a throttled socket open, coalesces movement, and acknowledges dropped actions', async t => {
  const room = await makeRoom();
  t.after(() => clearInterval(room.timer));
  t.mock.timers.enable({apis: ['Date'], now: Date.now()});
  const {socket, actor} = addPlayer(room, 1, room.pickSpawn('fixture', []));
  const info = room.connections.get(socket);
  info.tokens = 0;
  const send = command => room.webSocketMessage(socket, JSON.stringify(command));

  send({type: 'input', seq: 1, x: 1, y: 0});
  send({type: 'input', seq: 2, x: 0, y: 1, run: true});
  send({type: 'jump', seq: 3});
  room.step();
  assert.equal(info.ack, 0);
  assert.equal(socket.readyState, 1);

  t.mock.timers.tick(50);
  room.step();
  assert.deepEqual(info.input, {x: 0, y: 1, run: true});
  assert.equal(info.tokens, 11);
  assert.equal(info.ack, 3);
  assert.equal(actor.jumpLeft, 0);
  assert.equal(socket.readyState, 1);

  info.tokens = 0;
  send({type: 'input', seq: 4, x: 0, y: 0, stop: true});
  t.mock.timers.tick(50);
  room.step();
  assert.deepEqual(info.input, {x: 0, y: 0, run: false});
  assert.equal(info.ack, 4);

  info.tokens = 0;
  send({type: 'input', seq: 5, x: -1, y: 0});
  t.mock.timers.tick(350);
  room.step();
  assert.deepEqual(info.input, {x: 0, y: 0});
  assert.equal(info.ack, 5);
});

test('room reports invalid frames before closing the socket even when the budget is exhausted', async t => {
  const room = await makeRoom();
  t.mock.timers.enable({apis: ['Date'], now: Date.now()});
  for (const {tokens, message, reason} of [
    {message: new Uint8Array(1), reason: 'non_text_message'},
    {message: 'x'.repeat(513), reason: 'message_too_large'},
  ]) {
    const events = [];
    const socket = {close: (code, message) => events.push(['close', code, message])};
    room.connections.set(socket, {tokens: 0, tokenTime: Date.now()});
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
