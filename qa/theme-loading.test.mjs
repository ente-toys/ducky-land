import assert from 'node:assert/strict';
import test from 'node:test';
import {Texture} from 'pixi.js';
import {loadThemeArt} from '../src/pixi/theme-art.js';

const map = {id: 'test', art: '/themes/test/art.json'};
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
  const art = await loadThemeArt(map, {
    acquire: async (src, resolution) => {acquired.push([src, resolution]); return Texture.EMPTY;},
    release: src => released.push(src),
  });
  assert.deepEqual(acquired, [['/themes/test/shared.svg', 2], ['/themes/test/other.svg', 2]]);
  assert.equal(art.ground.children[0].texture, art.props[0].sprite.texture);
  assert.ok(art.groups.every(group => !group.visible), 'theme layers stay hidden while the caller asynchronously prepares animation and sleepers');
  art.destroy(); art.destroy();
  assert.deepEqual(released, acquired.map(([src]) => src));
});

test('a failed texture releases every lease after pending textures settle', async t => {
  mockFetch(t);
  const released = [];
  let finish, settled = false;
  const pending = new Promise(resolve => {finish = () => {settled = true; resolve(Texture.EMPTY);};});
  const loading = loadThemeArt(map, {
    acquire: src => src.endsWith('shared.svg') ? Promise.reject(new Error('broken texture')) : pending,
    release: src => {assert.ok(settled); released.push(src);},
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(released.length, 0);
  finish();
  await assert.rejects(loading, /broken texture/);
  assert.deepEqual(released, ['/themes/test/shared.svg', '/themes/test/other.svg']);
});
