// Two real browser tabs, actual keyboard input, and reads from the native Rive VMs.
// Start `npm start` first. Run `node test/two-tabs.mjs` to regenerate proof.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { walkable, CITIES } from '../rive/web/world.js';

await mkdir('shots', { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const errors = [], trace = [];
const inspect = page => page.evaluate(() => window.game.inspect());
const wait = ms => new Promise(r => setTimeout(r, ms));
const waitReal = (page, n) => page.waitForFunction(n => window.game?.inspect().realCount === n && window.game.inspect().ducks.filter(d => !d.bot).length === n, n);
async function open() {
  const p = await context.newPage();
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto('http://127.0.0.1:8804/');
  await p.waitForFunction(() => window.game?.inspect().connected);
  return p;
}
function direction(d) {
  const choices = [['d', 1, 0], ['a', -1, 0], ['s', 0, 1], ['w', 0, -1]];
  // Prefer horizontal motion to prove facing too; choose a collision-free 130px run.
  return choices.find(([, dx, dy]) => Array.from({ length: 27 }, (_, i) => walkable(d.x + dx * i * 5, d.y + dy * i * 5)).every(Boolean));
}
async function proveMovement(actor, observer, label) {
  const initial = (await inspect(actor)).self, [key, vx, vy] = direction(initial);
  await actor.keyboard.down(key);
  for (let i = 0; i < 12; i++) {
    await wait(70);
    const state = await inspect(observer), remote = state.ducks.find(d => d.id === initial.id);
    const rendered = state.rendered.find(d => d.id === initial.id);
    trace.push({ label, time: Date.now(), remote, rendered, newest: state.histories.find(h => h.id === initial.id).newest });
  }
  await actor.keyboard.up(key);
  await wait(500);
  const actual = (await inspect(actor)).self, observed = (await inspect(observer)).rendered.find(d => d.id === initial.id);
  const distance = Math.hypot(actual.x - initial.x, actual.y - initial.y);
  assert.ok(distance > 60, `${label}: local moved ${distance}`);
  assert.ok(Math.hypot(observed.x - actual.x, observed.y - actual.y) < 3, `${label}: remote converged`);
  if (vx) assert.equal(observed.facing, vx);
  for (const key of ['cap', 'shades', 'acc', 'shoes']) assert.equal(observed[key], initial[key], `${label}: ${key} outfit synced`);
  assert.ok(observed.name.includes(initial.name));
  const samples = trace.filter(s => s.label === label);
  assert.ok(samples.some(s => s.rendered.action === 1), `${label}: remote Rive walking`);
  assert.ok(samples.some(s => Math.hypot(s.remote.x - s.newest.x, s.remote.y - s.newest.y) > 1), `${label}: interpolated behind newest packet`);
  return { id: initial.id, key, distance, final: { x: actual.x, y: actual.y } };
}
try {
  const a = await open(); await waitReal(a, 1);
  const b = await open(); await Promise.all([waitReal(a, 2), waitReal(b, 2)]);
  const aStart = await inspect(a), bStart = await inspect(b);
  assert.notEqual(aStart.self.id, bStart.self.id);
  assert.equal(aStart.botCount, 8); assert.equal(bStart.botCount, 8);
  assert.deepEqual(aStart.ducks.filter(d => d.bot).map(d => d.id).sort(), bStart.ducks.filter(d => d.bot).map(d => d.id).sort());
  await a.screenshot({ path: 'shots/tab-a-before.png' });
  await b.screenshot({ path: 'shots/tab-b-before.png' });
  const movementA = await proveMovement(a, b, 'A seen by B');
  const movementB = await proveMovement(b, a, 'B seen by A');
  const start = await inspect(a), startTime = Date.now();
  await wait(2100);
  const end = await inspect(a), elapsed = (Date.now() - startTime) / 1000;
  const sendHz = (end.stateSends - start.stateSends) / elapsed, receiveHz = (end.snapshots - start.snapshots) / elapsed;
  assert.ok(sendHz >= 10 && sendHz <= 15, `send cadence ${sendHz}`);
  assert.ok(receiveHz >= 10 && receiveHz <= 15, `receive cadence ${receiveHz}`);
  const beforeQuacks = { ...end.quacks };
  await a.keyboard.press('q');
  await b.waitForFunction(id => window.game.inspect().rendered.some(d => d.id === id && d.action === 2), aStart.self.id);
  await b.keyboard.press('e');
  await a.waitForFunction(id => window.game.inspect().rendered.some(d => d.id === id && d.action === 3), bStart.self.id);
  await wait(280);
  await a.screenshot({ path: 'shots/tab-a.png' });
  await b.screenshot({ path: 'shots/tab-b.png' });
  const proofA = await inspect(a), proofB = await inspect(b);
  assert.deepEqual(proofA.quacks, proofB.quacks);
  assert.equal(proofA.quacks[CITIES[aStart.self.city]], beforeQuacks[CITIES[aStart.self.city]] + 1);
  await b.keyboard.press('q');
  await a.waitForFunction(({ city, n }) => window.game.inspect().quacks[city] === n, {
    city: CITIES[bStart.self.city], n: beforeQuacks[CITIES[bStart.self.city]] + (aStart.self.city === bStart.self.city ? 2 : 1),
  });
  const aggregated = (await inspect(a)).quacks;
  await b.close(); await waitReal(a, 1);
  const afterLeave = await inspect(a);
  assert.equal(afterLeave.botCount, 9);
  assert.ok(!afterLeave.rendered.some(d => d.id === bStart.self.id));
  const b2 = await open(); await Promise.all([waitReal(a, 2), waitReal(b2, 2)]);
  const rejoined = await inspect(b2);
  assert.notEqual(rejoined.self.id, bStart.self.id);
  assert.deepEqual(rejoined.quacks, aggregated);
  assert.equal(errors.length, 0, errors.join('\n'));
  const proof = { passed: true, at: new Date().toISOString(), movementA, movementB, sendHz, receiveHz,
    serverCityQuacks: aggregated, joinsLeavesRejoin: true, errors, tabA: proofA, tabB: proofB, trace };
  await writeFile('shots/proof.json', JSON.stringify(proof, null, 2));
  console.log(JSON.stringify({ passed: true, movementA, movementB, sendHz, receiveHz, serverCityQuacks: aggregated, screenshots: ['shots/tab-a.png', 'shots/tab-b.png'], errors }, null, 2));
} finally { await browser.close(); }
