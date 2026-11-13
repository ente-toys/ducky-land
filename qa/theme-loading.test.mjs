import assert from 'node:assert/strict';
import test from 'node:test';
import {Texture} from 'pixi.js';
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
  const groundPool=createGroundPool({acquire:async()=>Texture.EMPTY,release:()=>{}});
  t.after(()=>groundPool.destroy());
  const art = await loadThemeArt(map, {
    groundPool,
    acquire: async (src, resolution) => {acquired.push([src, resolution]); return Texture.WHITE;},
    release: src => released.push(src),
  });
  assert.deepEqual(acquired.sort(), [['/themes/test/shared.svg', 2], ['/themes/test/other.svg', 2],['/pixi-art/globe/test-ground.svg',1]].sort());
  assert.equal(groundPool.stats().residentTiles,0,'ground is not decoded until visible');
  assert.ok(art.groups.every(group => !group.visible), 'theme layers stay hidden while the caller asynchronously prepares animation and sleepers');
  art.destroy(); art.destroy();
  assert.deepEqual(released.sort(), acquired.map(([src]) => src).sort());
});

test('a failed texture retries while other theme textures finish and releases every lease', async t => {
  mockFetch(t);
  const acquired = [], released = [];
  const groundPool=createGroundPool({acquire:async()=>Texture.WHITE,release:()=>{}});
  t.after(()=>groundPool.destroy());
  let finish;
  const pending = new Promise(resolve => {finish = () => resolve(Texture.WHITE);});
  const loading = loadThemeArt(map, {
    groundPool,
    acquire: async src => {
      acquired.push(src);
      if(src.endsWith('shared.svg')&&acquired.filter(key=>key===src).length===1)throw Error('broken texture');
      return pending;
    },
    release: src => released.push(src),
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(released, ['/themes/test/shared.svg']);
  finish();
  const art=await loading;
  assert.equal(art.props[0].sprite.texture,Texture.WHITE);
  art.destroy();
  assert.deepEqual(released.sort(), acquired.sort());
});
