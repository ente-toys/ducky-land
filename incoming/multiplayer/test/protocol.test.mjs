import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { sample } from '../rive/web/interpolation.js';
import { CITIES, walkable } from '../rive/web/world.js';

const pause = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn) {
  for (let i = 0; i < 100; i++) { const result = await fn(); if (result) return result; await pause(40); }
  throw new Error('Timed out');
}
async function join() {
  const ws = new WebSocket('ws://127.0.0.1:8803/room');
  const client = { ws, welcome: null, latest: null };
  ws.on('message', bytes => {
    const m = JSON.parse(bytes);
    if (m.type === 'welcome') client.welcome = m;
    if (m.type === 'snapshot') client.latest = m;
  });
  await waitFor(() => client.welcome); return client;
}
const health = () => fetch('http://127.0.0.1:8803/health').then(r => r.json());
test('snapshot interpolation blends, retains actions and freezes on missing packets', () => {
  const history = [{ time: 0, x: 10, y: 20, action: 1 }, { time: 100, x: 30, y: 60, action: 2 }];
  assert.deepEqual(sample(history, 50), { time: 0, x: 20, y: 40, action: 1 });
  assert.deepEqual(sample(history, 500), { time: 100, x: 30, y: 60, action: 2 });
});
test('server owns identity, validates state, deduplicates quacks, enforces capacity and replaces filler', async () => {
  assert.equal((await health()).players, 0, 'Run with no other tabs open');
  const clients = [];
  try {
    const a = await join(); clients.push(a);
    const self = a.welcome.self;
    assert.ok(walkable(self.x, self.y)); assert.ok(self.cap >= 1 && self.cap <= 13);
    assert.ok(self.acc >= 0 && self.acc <= 7);
    const before = { ...(await health()).quacks };
    a.ws.send('{broken');
    a.ws.send(JSON.stringify({ type: 'state', seq: 1, x: -1e9, y: 820, facing: 1, action: 0, city: 999, cap: 999 }));
    a.ws.send(JSON.stringify({ type: 'state', seq: 2, x: self.x, y: self.y, facing: -1, action: 0, city: 999, cap: 999 }));
    await waitFor(() => a.latest?.players.find(p => p.id === self.id)?.ack === 2);
    const authoritative = a.latest.players.find(p => p.id === self.id);
    assert.equal(authoritative.x, self.x); assert.equal(authoritative.city, self.city); assert.equal(authoritative.cap, self.cap);
    for (const seq of [1, 1, 2]) a.ws.send(JSON.stringify({ type: 'emote', action: 'quack', seq }));
    await waitFor(async () => (await health()).quacks[CITIES[self.city]] === before[CITIES[self.city]] + 1);
    await pause(150);
    assert.equal((await health()).quacks[CITIES[self.city]], before[CITIES[self.city]] + 1);
    assert.equal((await health()).bots, 9);
    for (let i = 1; i < 16; i++) clients.push(await join());
    assert.equal((await health()).bots, 0);
    assert.equal((await health()).players, 16);
    const extra = new WebSocket('ws://127.0.0.1:8803/room');
    const [code] = await once(extra, 'close'); assert.equal(code, 1013);
    for (const c of clients.slice(1)) c.ws.close();
    await waitFor(async () => (await health()).players === 1);
    assert.equal((await health()).bots, 9);
    assert.equal(a.latest.players.length, 1);
  } finally {
    for (const c of clients) c.ws.close();
    await waitFor(async () => (await health()).players === 0);
  }
});
