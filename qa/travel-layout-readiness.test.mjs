import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Assets, Container, DOMAdapter, Sprite, Texture} from 'pixi.js';
import {JSDOM} from 'jsdom';
import {lazyPinkScene} from '../scripts/vite-prerender-art.mjs';

const {outputFiles: [bundle]} = await build({
  stdin: {
    contents: `
      export {PixiIsland} from './src/rendering/pixi/engine.js';
      export {createTravelView} from './src/rendering/pixi/travel-view.js';
      export {createSailingFX} from './src/rendering/pixi/sailing-fx.js';
      export {mapOf, prepareIslandMap, islandMapReady} from './src/world/island-maps.js';
      export {attachBogCombat} from './src/features/bog-combat/attach.js';
      export {BOG_COMBAT} from './src/features/bog-combat/config.js';
      export {boardingPoint, canSail} from './src/gameplay/islands.js';
      export {placeRigid} from './src/world/rigid.js';
      export {RoomClient} from './src/multiplayer/room-client.js';
    `,
    resolveDir: fileURLToPath(new URL('..', import.meta.url)),
  },
  bundle: true, packages: 'external', platform: 'node', format: 'esm', write: false,
  define: {'import.meta.env.DEV': 'false', 'import.meta.url': JSON.stringify(import.meta.url)},
  plugins: [{
    name: 'defer-island-layouts',
    setup(build) {
      build.onLoad({filter: /\/(pink|snow|bog|library)-scene\.js$/}, async ({path}) => {
        const [, theme] = path.match(/\/([^/]+)-scene\.js$/);
        return {contents: lazyPinkScene(await readFile(path, 'utf8'), `/layouts/${theme}.json`)};
      });
    },
  }],
});
const code = bundle.text.replaceAll('import.meta.glob(', '(()=>({}))(')
  .replaceAll('"pixi.js"', JSON.stringify(import.meta.resolve('pixi.js'))) +
  '\n//# sourceURL=travel-layout-bundle.mjs';
const {PixiIsland, createTravelView, createSailingFX, mapOf, prepareIslandMap, islandMapReady,
  attachBogCombat, BOG_COMBAT, boardingPoint, canSail, placeRigid, RoomClient} =
  await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

const flush = () => new Promise(setImmediate);
async function layoutResponse(theme) {
  const directory = theme === 'bog' ? 'bog-arena' : theme;
  const packed = await readFile(new URL(`../assets/world/themes/${directory}/scene-pack.json`, import.meta.url), 'utf8');
  return {ok: true, json: async () => JSON.parse(packed)};
}

function serveLayouts(t) {
  t.mock.method(globalThis, 'fetch', async url => {
    const theme = /^\/layouts\/(pink|snow|bog|library)\.json$/.exec(url)?.[1];
    if (!theme) return {ok: false};
    return layoutResponse(theme);
  });
}

function mockBoatAssets(t) {
  t.mock.method(Assets, 'load', async () => Texture.WHITE);
  const adapter = DOMAdapter.get();
  DOMAdapter.set({...adapter, createCanvas: () => ({getContext: () => null})});
  t.after(() => DOMAdapter.set(adapter));
}

test('a boat from an unloaded island renders, and the harbor appears once its layout is ready', async t => {
  serveLayouts(t);
  mockBoatAssets(t);
  const objects = new Container(), water = new Container(), decks = new Container();
  const travel = await createTravelView(objects, water, decks);
  t.after(() => {travel.dispose(); objects.destroy(); water.destroy(); decks.destroy();});
  const homeBoat = {id: 'home-0', islandId: 'home', ...mapOf('home').boatSpots()[0]};
  const visitingBoat = {id: 'sunset-0', islandId: 'sunset', x: 800, y: 900};
  const update = boats => travel.update(boats, 1, false, () => true);
  assert.throws(() => mapOf('sunset').nav(), /pink layout is not ready/);
  update([homeBoat]);
  update([homeBoat, visitingBoat]);
  assert.equal(objects.getChildByLabel(visitingBoat.id).alpha, 1);

  travel.switchIsland('sunset');
  update([visitingBoat]);
  assert.equal(decks.getChildByLabel('Jetty home').visible, false);
  assert.equal(decks.getChildByLabel('Jetty pink'), null);
  await prepareIslandMap('sunset');
  update([visitingBoat]);
  assert.equal(decks.getChildByLabel('Jetty pink').visible, true);

  const moored = {id: 'sunset-1', islandId: 'sunset', ...mapOf('sunset').boatSpots()[1]};
  update([visitingBoat, moored]);
  assert.ok(objects.getChildByLabel(moored.id).alpha < 1, 'prepared moorings still animate new boats');
});

test('travel options wait for the room island layout when the rendered island still shows Home', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const attempts = [];
  t.mock.method(globalThis, 'fetch', (_url, {signal}) => new Promise(resolve => attempts.push({signal,resolve})));
  let navLookups = 0;
  const room = {
    islandId: 'isle-55', player: {mode: 'walking'},
    navHere() {navLookups++; return mapOf(this.islandId).nav();},
    boatPoses: () => [],
  };
  const game = Object.assign(Object.create(PixiIsland.prototype), {
    room, islandId: 'home', globeBusy: () => true,
  });
  assert.throws(() => mapOf(room.islandId).nav(), /snow layout is not ready/);
  assert.deepEqual(game.travelOptions(), {});
  assert.equal(navLookups, 0);
  const preparation = prepareIslandMap(room.islandId);
  assert.equal(prepareIslandMap(room.islandId), preparation);
  t.mock.timers.tick(8000);
  await flush();
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0].signal.aborted, true);
  assert.equal(islandMapReady(room.islandId), false);
  attempts[1].resolve(await layoutResponse('snow'));
  await preparation;
  attempts[0].resolve({ok: true, json: async () => null});
  await flush();
  assert.deepEqual(game.travelOptions(), {});
  assert.equal(navLookups, 0, 'the renderer still shows the previous island');
  game.islandId = room.islandId;
  assert.deepEqual(game.travelOptions(), {});
  assert.equal(navLookups, 1, 'travel options resume once the layout and renderer are ready');
});

test('sailing remains responsive during a cold layout and an unavailable walking layout reports an error', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  t.mock.method(console, 'warn', () => {});
  const islandId = 'isle-251';
  const room = new RoomClient(() => {});
  t.after(() => room.dispose());
  const harbor = mapOf(islandId).HARBOR.water;
  const dx = canSail(harbor.x + 12, harbor.y, islandId) ? 1 : -1;
  room.islandId = islandId;
  room.player = {...harbor, islandId, mode: 'sailing'};
  room.step(1/60, {x: dx, y: 0});
  assert.notEqual(room.player.x, harbor.x);
  room.player.mode = 'walking';
  assert.doesNotThrow(() => room.step(1/60, {x: dx, y: 0}));

  const errors = [];
  const game = Object.assign(Object.create(PixiIsland.prototype), {
    room, islandId, artShown: 'library', arts: new Map(),
    ensureArt: () => new Promise(() => {}), onError: error => errors.push(error.message),
  });
  const preparing = game.ensureMapArt('library', {timeoutMs: 100});
  t.mock.timers.tick(100);
  await preparing;
  assert.deepEqual(errors, ['Could not load the layout for library']);
});

test('Bog combat waits for the deferred layout before opening its socket', async t => {
  const dom = new JSDOM('<canvas></canvas>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  t.after(() => {dom.window.close(); delete globalThis.window; delete globalThis.document;});
  let finish, socket;
  t.mock.method(globalThis, 'fetch', () => new Promise(resolve => {finish=resolve;}));
  class Socket {
    readyState = 1;
    bufferedAmount = 0;
    constructor() {socket=this;}
    send() {}
    close() {}
    push(message) {this.onmessage({data: JSON.stringify(message)});}
  }
  const engine = {
    canvas: document.querySelector('canvas'), objects: new Container(), islandId: 'isle-249',
    liveRigs: new Map(), stopInput() {}, renderLiveDucks() {}, dispose() {},
  };
  t.after(() => engine.objects.destroy({children: true}));
  const joining = attachBogCombat(engine, {
    ...BOG_COMBAT, profile: 'layout-test', team: 'karma', url: 'ws://fixture', Socket,
    loadGun: async () => [], loadGhosts: async () => ({}), loadPickups: async () => ({}),
    loadLeaves: async () => Texture.EMPTY,
  });
  await flush();
  assert.equal(socket, undefined);
  finish(await layoutResponse('bog'));
  const layer = await joining;
  try {
    const dock = mapOf(engine.islandId).spawn;
    const player = {id: 'duck', team: 'karma', alive: true, ...dock};
    socket.push({type: 'arena-welcome', id: player.id});
    socket.push({type: 'arena-snapshot', tick: 1, time: 0, players: [player]});
    assert.ok(layer.room.player.alive);
    assert.doesNotThrow(() => layer.room.step(1/60, {x: 1, y: 0}));
  } finally {
    layer.leave(false);
  }
});

test('boarding uses the boat island even when the viewer sees it in another chart', async t => {
  serveLayouts(t);
  mockBoatAssets(t);
  let now = 1000;
  t.mock.method(performance, 'now', () => now);
  const water = new Container(), objects = new Container();
  const fx = await createSailingFX({water, objects});
  t.after(() => {fx.dispose(); objects.destroy({children: true}); water.destroy({children: true});});
  const islandId = 'isle-55', chart = 'home';
  const boat = {id: 'ice-boat', islandId, ...mapOf(islandId).HARBOR.water, occupant: 'duck'};
  const pose = {...boat, ...placeRigid(chart, islandId, boat)};
  const dock = placeRigid(chart, islandId, boardingPoint(boat), pose);
  const walker = {...dock, id: 'duck', mode: 'walking', islandId};
  fx.duck(walker, false, chart);
  const root = new Container(), sprite = new Sprite();
  root.addChild(sprite);objects.addChild(root);
  fx.boat({root,sprite},pose,false);
  const sailor = {...walker, x: pose.x, y: pose.y, mode: 'sailing', boatId: boat.id};
  fx.duck(sailor,false,chart);
  now+=60;
  const takingOff = fx.duck(sailor,false,chart);
  assert.deepEqual({x:takingOff.x,y:takingOff.y},dock);
});
