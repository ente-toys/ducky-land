import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createCanvas, Path2D} from '@napi-rs/canvas';
import {JSDOM} from 'jsdom';
import {DOMAdapter} from 'pixi.js';
import sharp from 'sharp';
import {createHomeGroundLoader} from '../src/rendering/pixi/art/home-ground.js';
import {cropSVG} from '../src/rendering/pixi/art/theme-raster.js';

test('Home rasterizes several tiles from one parsed SVG with the original artwork and gutters', async t => {
  const asset = '/pixi-art/home-expansion-g/ground-0-0.svg';
  const svg = readFileSync(new URL(`../public${asset}`, import.meta.url), 'utf8');
  const {window} = new JSDOM();
  let fetched = 0, parsed = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url, `https://ducky.test${asset}`);
    fetched++;
    return new Response(svg);
  });
  t.mock.method(URL, 'createObjectURL', () => assert.fail('Home ground should not create blob URLs'));
  const originalGlobals = {location: globalThis.location, DOMParser: globalThis.DOMParser,
    Path2D: globalThis.Path2D, createImageBitmap: globalThis.createImageBitmap};
  const adapter = DOMAdapter.get();
  globalThis.location = {href: 'https://ducky.test/'};
  globalThis.DOMParser = class extends window.DOMParser {
    parseFromString(...args) { parsed++; return super.parseFromString(...args); }
  };
  globalThis.Path2D = Path2D;
  globalThis.createImageBitmap = () => assert.fail('Home tiles draw directly onto a canvas');
  DOMAdapter.set({...adapter, createCanvas});
  const loader = createHomeGroundLoader();
  t.after(() => {
    loader.destroy();
    DOMAdapter.set(adapter);
    Object.assign(globalThis, originalGlobals);
    window.close();
  });

  for (const [x, y, resolution] of [[5503, 4031, 3.625], [2000, 1800, 1], [5503, 3903, 2], [-1, -1, 1]]) {
    const crop = [11000, 8250, x, y, 130, 130];
    const key = `${asset}?rasterCrop=${crop.join(',')}&groundScale=${resolution}`;
    const tile = await loader.acquire(key, resolution);
    const canvas = tile.source.resource;
    const size = Math.ceil(130 * resolution);
    assert.equal(canvas.width, size);
    assert.equal(canvas.height, size);
    assert.deepEqual([tile.frame.x, tile.frame.y, tile.frame.width, tile.frame.height], [1, 1, 128, 128]);

    const actual = canvas.getContext('2d').getImageData(0, 0, size, size).data;
    const expected = await sharp(Buffer.from(cropSVG(svg, crop, resolution))).ensureAlpha().raw().toBuffer();
    let difference = 0;
    for (let i = 0; i < actual.length; i += 4) {
      const a = actual[i + 3], b = expected[i + 3];
      const red = Math.abs(actual[i] * a - expected[i] * b) / 255;
      const green = Math.abs(actual[i + 1] * a - expected[i + 1] * b) / 255;
      const blue = Math.abs(actual[i + 2] * a - expected[i + 2] * b) / 255;
      difference += Math.max(red, green, blue, Math.abs(a - b));
    }
    assert(difference / (size * size) < 1, `Tile ${x},${y} at ${resolution}x should match the SVG crop`);
    loader.release(key);
    await new Promise(setImmediate);
    assert(tile.destroyed);
  }
  assert.equal(fetched, 1);
  assert.equal(parsed, 1);
});
