import test from 'node:test';
import assert from 'node:assert/strict';
import {SledClient} from '../src/features/sled-race/client.js';

class FakeSocket {constructor() {this.readyState = 1; this.sent = [];} send(m) {this.sent.push(JSON.parse(m));} close() {this.readyState = 3;}}
function client() {
  let now = 100;
  const c = new SledClient({Socket: FakeSocket, url: 'ws://test/sled-room', clock: () => now});
  const say = m => c.receive(JSON.stringify(m));
  return {c, say, at: t => {now = t;}};
}
const racer = (d, x = 0) => ({id: 'me', d, x, v: 14, vx: 0, tuck: false, crashUntil: -1, boostUntil: -1, airUntil: -1, place: null, finishedAt: null});

test('joins, readies and steers through the room socket, without flooding it', () => {
  const {c, say, at} = client();
  say({type: 'sled-welcome', id: 'me'});
  c.join(); c.ready();
  assert.deepEqual(c.socket.sent.map(m => m.type), ['sled-join', 'sled-ready']);
  for (let i = 0; i < 10; i++) {at(100 + i * .003); c.steer({steer: 1, tuck: false});}
  assert.equal(c.socket.sent.filter(m => m.type === 'sled-input').length, 1, 'same input is sent at most 30 times a second');
});

test('the race is smoothed between updates and the results outlive the lobby resetting', () => {
  const {c, say, at} = client();
  say({type: 'sled-welcome', id: 'me'});
  const racers = [{id: 'me', name: 'Me', bot: false, colour: 0}];
  say({type: 'sled-state', now: 1000, phase: 'racing', seed: 7, time: 10, racers, state: [racer(100)], events: []});
  at(100.05);
  say({type: 'sled-state', now: 1000.05, phase: 'racing', seed: 7, time: 10.05, racers, state: [racer(101)], events: [{type: 'boost', id: 'me'}]});
  at(100.125);
  const mid = c.view().racers[0];
  assert.ok(mid.d > 100 && mid.d < 101, `between the two updates, got ${mid.d}`);
  assert.equal(mid.name, 'Me');
  assert.deepEqual(c.drainEvents().map(e => e.type), ['boost']);
  say({type: 'sled-state', now: 1060, phase: 'results', seed: 7, racers, results: {seed: 7, standings: [{id: 'me', name: 'Me', place: 1, time: 55}]}, events: []});
  say({type: 'sled-state', now: 1070, phase: 'empty', seats: [], events: []});
  assert.equal(c.finished(), true);
  assert.equal(c.standings()[0].finishedAt, 55);
  assert.equal(c.view().racers.length, 1, 'the last race stays on screen');
  say({type: 'sled-state', now: 1200, phase: 'racing', seed: 8, time: 0, racers, state: [racer(0)], events: []});
  assert.equal(c.finished(), false, 'a new race clears the old results');
});
