import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createThreeGameView} from '../src/rendering/three/three-game-view.js';
import {mapOf} from '../src/world/island-maps.js';

async function fixture(t, {altitude, movement = true, cameraMoving = false, speed = 480}) {
  const dom = new JSDOM('<div id="view"></div>');
  for (const [key, value] of Object.entries({window: dom.window, document: dom.window.document, devicePixelRatio: 1, cancelAnimationFrame() {}})) {
    const old = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, {value, writable: true, configurable: true});
    t.after(() => {if (old) Object.defineProperty(globalThis, key, old); else delete globalThis[key];});
  }
  t.after(() => dom.window.close());
  const host = document.getElementById('view');
  Object.defineProperties(host, {clientWidth: {value: 800}, clientHeight: {value: 600}});
  const map = mapOf('home'), player = {x: map.cx, y: map.cy, travel: speed};
  const ticks = [], captures = [], centres = [];
  let update, last = 1000, centre = {x: player.x, y: player.y - 90};
  const world = {
    ready: Promise.resolve(), clearLiveCanvas() {}, setPresentation() {}, destroy() {},
    centreOn(id, x, y) {centre = {x, y}; centres.push(centre);},
    setLiveCanvas(...args) {captures.push({camera: {...game.camera}, centre: {...centre}, bounds: args[6]});},
  };
  const game = {
    ready: true, islandId: 'home', artShown: 'home', width: 800, height: 600,
    canvas: document.createElement('canvas'), camera: {x: player.x, y: player.y - 90, zoom: 1}, target: {},
    player, keys: new Set(movement ? ['arrowright', 'shift'] : []), touchInput: {x: 0, y: 0},
    rigs: [], localDucks: [], liveRigs: new Map(), arts: new Map([['home', {ready: true}]]),
    zoomMotion: {velocity: 0}, ocean: {alpha: 1, visible: true},
    app: {render() {}, renderer: {background: {alpha: 1}, resolution: 1, resize() {}}},
    resize() {}, listen() {}, artReady() {return true;}, ensureArt() {}, onInteriorChange() {},
    playerView() {return {x: player.x, y: player.y};},
    tick(now, {followCamera} = {}) {
      player.x += player.travel * (now - last) / 1000; last = now;
      followCamera?.(game.externalCamera, game.playerView());
      Object.assign(game.camera, game.externalCamera);
      ticks.push({now, camera: {...game.camera}}); game.app.render();
    },
  };
  const view = await createThreeGameView(game, host, {createWorld: async (_, options) => {update = options.onFrame; return world;}});
  t.after(() => view.destroy());
  centres.length = 0;
  return {game, ticks, captures, centres, frame(now) {
    update({now, id: 'home', altitude, heading: 0, point: {x: centre.x - map.cx, y: centre.y - map.cy},
      width: 800, height: 600, fov: 35, moving: cameraMoving, flying: false, zooming: false});
  }};
}

test('zoomed-out sprint captures every display frame at 60, 75, 120 and 144 Hz', async t => {
  for (const altitude of [.247, .403, .65]) for (const hz of [60, 75, 120, 144]) await t.test(`${altitude} at ${hz} Hz`, async t => {
    const f = await fixture(t, {altitude});
    for (let i = 0; i < hz; i++) f.frame(1000 + i * 1000 / hz);
    assert.equal(f.ticks.length, hz, 'no held scenery frame while sprinting');
    assert.equal(f.captures.length, hz, 'every simulated frame reaches the globe texture');
    if (altitude < .55) {
      assert.ok(f.captures.every(c => Math.abs(c.camera.x - c.centre.x) < 1e-9 && Math.abs(c.camera.y - c.centre.y) < 1e-9), 'detail and globe follow the same camera position in the same frame');
      const steps = f.ticks.slice(-20).map((v, i, a) => i ? v.camera.x - a[i - 1].camera.x : 480 / hz);
      assert.ok(Math.max(...steps) - Math.min(...steps) < .02, 'steady sprint has steady background displacement');
    }
  });
});

test('camera motion and click-to-walk also bypass the stationary capture budget', async t => {
  for (const cameraMoving of [false, true]) await t.test(String(cameraMoving), async t => {
    const f = await fixture(t, {altitude: .4, movement: false, cameraMoving, speed: cameraMoving ? 0 : 480});
    for (let i = 0; i < 75; i++) f.frame(1000 + i * 1000 / 75);
    assert.equal(f.captures.length, 75);
  });
});

test('the following camera stays at display cadence while settling after release', async t => {
  const f = await fixture(t, {altitude: .4});
  for (let i = 0; i < 75; i++) f.frame(1000 + i * 1000 / 75);
  f.game.keys.clear(); f.game.player.travel = 0;
  const before = f.captures.length;
  for (let i = 75; i < 100; i++) f.frame(1000 + i * 1000 / 75);
  assert.equal(f.captures.length - before, 25, 'no cadence switch during the camera deceleration');
});

test('stationary and hidden detail retain their reduced work budgets', async t => {
  for (const altitude of [.65, 1.2]) await t.test(String(altitude), async t => {
    const f = await fixture(t, {altitude, movement: false, speed: 0});
    for (let i = 0; i < 75; i++) f.frame(1000 + i * 1000 / 75);
    assert.ok(f.ticks.length <= (altitude < 1 ? 30 : 20));
    assert.equal(f.captures.length, altitude < 1 ? f.ticks.length : 0);
  });
});
