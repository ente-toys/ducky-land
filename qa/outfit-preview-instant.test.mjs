import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Assets, Texture} from 'pixi.js';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';

const {outputFiles: [bundle]} = await build({entryPoints: [fileURLToPath(new URL('../src/rendering/pixi/duck.js', import.meta.url))],
  bundle: true, packages: 'external', format: 'esm', write: false});
const code = bundle.text.replaceAll('"pixi.js"', JSON.stringify(import.meta.resolve('pixi.js')));
const {createDuck, disposeDuckAssets, preloadOutfitFrames} = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const manifest = JSON.parse(readFileSync('public/pixi-duck/manifest.json'));
const frameURL = url => url.includes('/pixi-duck/frames/');
const nodes = n => [n, ...n.children.flatMap(nodes)];
const item = (slot, index) => manifest.wardrobe.find(e => e.slot === slot && e.index === index);
const wears = (rig, entry) => nodes(rig.root).some(n => n.label === entry.id);
const pictures = (entries, angle) => new Set(entries.flatMap(e => Object.entries(e.frames)
  .filter(([a]) => angle === undefined || a === angle).flatMap(([, f]) => f)).filter(f => f.visible).map(f => f.url));

async function withTextures(fn) {
  const old = {fetch: globalThis.fetch, load: Assets.load, get: Assets.get, unload: Assets.unload, has: Assets.cache.has};
  const cached = new Set(), loads = [];
  globalThis.fetch = async () => ({ok: true, json: async () => structuredClone(manifest)});
  Assets.load = async ({src}) => {loads.push(src); await new Promise(r => setTimeout(r, 5)); cached.add(src); return Texture.EMPTY;};
  Assets.get = () => Texture.EMPTY; Assets.unload = async url => {cached.delete(url);};
  Assets.cache.has = url => cached.has(url);
  try {await fn({loads, cached});} finally {
    await disposeDuckAssets();
    globalThis.fetch = old.fetch; Assets.load = old.load; Assets.get = old.get; Assets.unload = old.unload; Assets.cache.has = old.has;
  }
}

test('the outfit editor duck loads only its front picture per item, not all nine angles', async () => {
  await withTextures(async ({loads}) => {
    const rig = await createDuck({outfit: {cap: 8, shades: 1, acc: 0, shoes: 2}, angles: ['0']});
    const frames = new Set(loads.filter(frameURL));
    assert.deepEqual(frames, pictures([item('cap', 8), item('shades', 1), item('shoes', 2)], '0'));
    // the hidden views stay bare, the front view wears the outfit, and drawing it never reaches for a missing angle
    assert.ok(wears(rig, item('cap', 8)));
    for (let i = 0; i < 30; i++) rig.update(1 / 60, {action: 0, turn: 0});
    rig.dispose();
  });
});

test('a pick whose pictures are warm shows in the same call, with no fetch and no await', async () => {
  await withTextures(async ({loads}) => {
    const rig = await createDuck({outfit: {cap: 8, shades: 1, acc: 0, shoes: 2}, angles: ['0']});
    const items = ['cap', 'shades', 'shoes'].flatMap(slot => manifest.wardrobe.filter(e => e.slot === slot));
    await preloadOutfitFrames(items, {angles: ['0']});
    const before = loads.length;
    for (const [slot, index] of [['cap', 4], ['shades', 2], ['shoes', 7], ['cap', 0]]) {
      const entry = index && item(slot, index);
      rig.setOutfit({cap: slot === 'cap' ? index : 8, shades: slot === 'shades' ? index : 1, acc: 0, shoes: slot === 'shoes' ? index : 2});
      if (entry) assert.ok(wears(rig, entry), `${entry.id} drawn synchronously`);
      else assert.ok(!wears(rig, item('cap', 8)), 'removing the hat is synchronous too');
    }
    assert.equal(loads.length, before, 'no texture loads once the front pictures are warm');
    rig.dispose();
  });
});

test('warming the editor costs one picture per item; the world duck still gets every angle', async () => {
  await withTextures(async ({loads}) => {
    const items = manifest.wardrobe.filter(e => e.slot !== 'acc');
    await preloadOutfitFrames(items, {angles: ['0']});
    assert.deepEqual(new Set(loads.filter(frameURL)), pictures(items, '0'));
    loads.length = 0;
    const world = await createDuck({outfit: {cap: 4, shades: 0, acc: 0, shoes: 0}});
    const front = pictures([item('cap', 4)], '0');
    assert.deepEqual(new Set(loads.filter(frameURL)), new Set([...pictures([item('cap', 4)])].filter(url => !front.has(url))),
      'the world duck fetches the other angles, reusing the warm front picture');
    world.dispose();
  });
});

test('an urgent picture (an outfit pick) jumps ahead of queued background island art', async () => {
  const {createArtQueue} = await import('../src/rendering/pixi/art/island-preparation.js');
  const queue = createArtQueue({concurrency: 1, yieldFrame: () => Promise.resolve()});
  const order = [], gate = Promise.withResolvers();
  const first = queue.run(() => gate.promise.then(() => order.push('running')));
  const background = Array.from({length: 5}, (_, i) => queue.run(async () => {order.push(`island ${i}`);}));
  const pick = queue.run(async () => {order.push('outfit');}, {urgent: true});
  gate.resolve();
  await Promise.all([first, pick, ...background]);
  assert.deepEqual(order.slice(0, 2), ['running', 'outfit']);
  const rasters = [];
  await Promise.all([queue.raster(() => rasters.push('island')), queue.raster(() => rasters.push('outfit'), {urgent: true})]);
  assert.deepEqual(rasters, ['outfit', 'island']);
});
