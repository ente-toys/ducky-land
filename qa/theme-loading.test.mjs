import {readyTexture} from './ready-texture.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createGroundPool} from '../src/rendering/pixi/art/ground-stream.js';
import {loadThemeArt} from '../src/rendering/pixi/art/theme-art.js';

const map = {id: 'test', art: '/themes/test/art.json',origin:{x:0,y:0},width:100,height:100};
const manifest = {
  ground: {tiles: [{src: 'shared.svg', x: 0, y: 0, width: 100, height: 100, resolution: 1}]},
  props: [{src: 'shared.svg', x: 50, y: 50, width: 20, height: 40, resolution: 2, shadow: false}],
  flats: [{src: 'other.svg', x: 0, y: 0, width: 10, height: 10}],
};
const mockFetch = t => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => ({ok: true, json: async () => url.endsWith('art.json') ? manifest : {pieces: []}});
  t.after(() => {globalThis.fetch = original;});
};

test('theme art shares source leases at the highest resolution and releases them once', async t => {
  mockFetch(t);
  const acquired = [], released = [];
  const groundPool=createGroundPool({acquire:async()=>readyTexture(),release:()=>{}});
  t.after(()=>groundPool.destroy());
  const art = await loadThemeArt(map, {
    groundPool,
    acquire: async (src, resolution) => {acquired.push([src, resolution]); return readyTexture();},
    release: src => released.push(src),
  });
  assert.deepEqual(acquired.sort(), [['/themes/test/shared.svg', 2], ['/themes/test/other.svg', 2],['/pixi-art/globe/test-ground.svg',1]].sort());
  assert.equal(groundPool.stats().residentTiles,0,'ground is not decoded until visible');
  assert.ok(art.groups.every(group => !group.visible), 'theme layers stay hidden while the caller asynchronously prepares animation and sleepers');
  art.destroy(); art.destroy();
  assert.deepEqual(released.sort(), acquired.map(([src]) => src).sort());
});

test('a transient failed texture retries and releases every acquired lease', async t => {
  mockFetch(t);
  const acquired = [], released = [];
  const groundPool=createGroundPool({acquire:async()=>readyTexture(),release(){}});
  t.after(()=>groundPool.destroy());
  let finish, settled = false, attempts = 0;
  const pending = new Promise(resolve => {finish = () => {settled = true; resolve(readyTexture());};});
  const loading = loadThemeArt(map, {
    groundPool,
    acquire: src => {
      acquired.push(src);
      if (src.endsWith('shared.svg')) return ++attempts === 1 ? Promise.reject(new Error('broken texture')) : readyTexture();
      return pending;
    },
    release: src => released.push(src),
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false);
  assert.equal(attempts, 2, 'failed source is retried');
  finish();
  const art = await loading;
  assert.ok(art.props.length > 0, 'recovered art remains visible');
  art.destroy();
  assert.deepEqual(released.sort(), acquired.sort());
});
