// Executes the shipped client code in two isolated JS contexts against the real
// socket server. Only DOM + Rive property access are stubbed. This checks sync
// logic when a browser is unavailable; it does NOT claim to verify Rive pixels.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as world from '../rive/web/world.js';
import * as interpolation from '../rive/web/interpolation.js';

const pause = ms => new Promise(r => setTimeout(r, ms));
async function until(fn) {
  for (let i = 0; i < 100; i++) { const r = fn(); if (r) return r; await pause(30); }
  throw new Error('Client did not reach expected state');
}
function instance() {
  const numbers = new Map(), strings = new Map(), models = new Map();
  const property = (map, name, initial) => {
    if (!map.has(name)) map.set(name, { value: initial }); return map.get(name);
  };
  return {
    number: name => property(numbers, name, 0), string: name => property(strings, name, ''),
    viewModel: name => { if (!models.has(name)) models.set(name, instance()); return models.get(name); },
  };
}
async function client() {
  const events = new EventTarget(), document = new EventTarget(), canvas = new EventTarget(), timers = new Set(), intervals = new Set();
  canvas.getBoundingClientRect = () => ({ width: 1600, height: 1000, left: 0, top: 0 }); canvas.focus = () => {};
  document.getElementById = () => canvas;
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(performance.now()); }, ms); timers.add(id); return id; };
  const context = vm.createContext({
    ...world, ...interpolation, document, console, location: { hostname: '127.0.0.1' }, devicePixelRatio: 1,
    performance, WebSocket, setTimeout: later, clearTimeout,
    setInterval: (fn, ms) => { const id = setInterval(fn, ms); intervals.add(id); return id; },
    requestAnimationFrame: fn => later(fn, 16), addEventListener: events.addEventListener.bind(events),
    rive: { RuntimeLoader: { setWasmUrl() {}, setWasmFallbackUrl() {} }, Layout: class {}, Fit: { Contain: 1 }, Alignment: { Center: 1 }, Rive: class {
      constructor(options) { this.viewModelInstance = instance(); queueMicrotask(options.onLoad); }
      resizeDrawingSurfaceToCanvas() {}
    } },
  });
  context.window = context;
  const code = (await readFile(new URL('../rive/web/multiplayer.js', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '');
  vm.runInContext(code, context);
  await until(() => context.game?.inspect().connected && context.game.inspect().ducks.length === 10);
  return {
    state: () => context.game.inspect(),
    key(type, key) { const event = new Event(type); Object.assign(event, { key, repeat: false }); events.dispatchEvent(event); },
    tap(x, y) { const event = new Event('pointerdown'); Object.assign(event, { clientX: x, clientY: y }); canvas.dispatchEvent(event); },
    close() { events.dispatchEvent(new Event('pagehide')); for (const t of timers) clearTimeout(t); for (const t of intervals) clearInterval(t); },
  };
}
test('two isolated clients sync input, interpolated positions, Rive values, emotes, totals, and disconnects', async () => {
  const a = await client(), b = await client();
  try {
    await until(() => a.state().realCount === 2 && b.state().realCount === 2);
    const original = a.state().self;
    const choices = [['d', 1, 0], ['a', -1, 0], ['s', 0, 1], ['w', 0, -1]];
    const [key, dx, dy] = choices.find(([, dx, dy]) => Array.from({ length: 21 }, (_, i) => world.walkable(original.x + dx * i * 5, original.y + dy * i * 5)).every(Boolean));
    a.key('keydown', key); await pause(600); a.key('keyup', key);
    await pause(350);
    const moved = a.state().self, observed = b.state().rendered.find(d => d.id === original.id);
    assert.ok(Math.hypot(moved.x - original.x, moved.y - original.y) > 50);
    assert.ok(Math.hypot(observed.x - moved.x, observed.y - moved.y) < 3);
    assert.equal(observed.cap, original.cap); assert.ok(observed.name.includes(original.name));
    const baseline = a.state().quacks[world.CITIES[original.city]];
    a.key('keydown', 'q'); a.key('keyup', 'q');
    await until(() => b.state().rendered.find(d => d.id === original.id)?.action === 2);
    await until(() => a.state().quacks[world.CITIES[original.city]] === baseline + 1);
    a.key('keydown', 'q'); a.key('keyup', 'q'); await pause(150);
    assert.equal(a.state().quacks[world.CITIES[original.city]], baseline + 1);
    b.key('keydown', 'e'); b.key('keyup', 'e');
    await until(() => a.state().rendered.find(d => d.id === b.state().self.id)?.action === 3);
    // Tap a reachable point back along the path, proving coordinate input too.
    await pause(1200); a.tap(original.x, original.y);
    await until(() => Math.hypot(a.state().self.x - original.x, a.state().self.y - original.y) < 5);
    b.close(); await until(() => a.state().realCount === 1);
    assert.equal(a.state().botCount, 9);
    assert.equal(a.state().ducks.length, 10);
  } finally { a.close(); b.close(); }
});
