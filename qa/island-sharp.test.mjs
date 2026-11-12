import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Container, DOMAdapter} from 'pixi.js';
import {createCanvas, Image} from '@napi-rs/canvas';
import {audit, entries, manifest, rasterLayers, sourceSize, visibleAllocation, THEMES} from './island-sharp-audit.mjs';
import {createGroundPool, GROUND_BUDGET_BYTES, tileResolution} from '../src/pixi/ground-stream.js';
import {createRasterLoader} from '../src/pixi/theme-art-stream.js';
import {cropSVG, RASTER_ART_BUDGET_BYTES, RASTER_ART_UTILIZATION} from '../src/pixi/theme-raster.js';

const report = await audit();
const flush = () => new Promise(setImmediate);
const counts = {home: [60, 12, 3257, 827, 11], sunflower: [72, 15, 423, 1643, 0],
  pink: [176, 6, 1321, 1007, 0], library: [104, 19, 3146, 1786, 3]};

test('sharpness audit visits every live static layer, including generated Home decals and floating pads', () => {
  for (const island of report.islands) {
    assert.deepEqual(['ground', 'decks', 'flats', 'props', 'floating'].map(kind => island.records.filter(r => r.kind === kind).length), counts[island.theme]);
    assert.equal(Object.values(island.groups).reduce((n, g) => n + g.count, 0), island.records.length);
    for (const r of island.records) {
      assert(r.sourceSize.every(n => n > 0));
      assert(r.before.every(n => Number.isFinite(n) && n > 0), r.src);
      assert.deepEqual(r.after, r.before, 'retained paths must not be misreported as fixed');
    }
    assert(island.records.some(r => r.before[1] < 1), island.name + ' must not receive a false sharpness pass');
  }
});

test('before density includes intrinsic SVG dimensions, placement scale, shared lease resolution and legacy tiles', async () => {
  const island = report.islands.find(i => i.theme === 'sunflower');
  const e = entries('sunflower', manifest('sunflower')).find(e => e.p.id === 'red-barn-1');
  const size = await sourceSize(e.src), scale = Math.max(e.p.width / size[0], e.p.height / size[1]) * e.p.scale;
  const r = island.records.find(r => r.id === e.id);
  assert.equal(r.spriteScale, scale);
  assert.equal(r.before[1], r.homeFirstResolution / (scale * 1.8 * 2));
  const legacyCounts = Object.fromEntries(report.islands.filter(i => THEMES.includes(i.theme))
    .map(i => [i.theme, i.records.filter(r => r.legacyTiles > 0).length]));
  assert.deepEqual(legacyCounts, {sunflower: 0, pink: 3, library: 4});
  for (const theme of ['pink', 'library']) {
    for (const r of report.islands.find(i => i.theme === theme).records.filter(r => r.legacyTiles)) {
      assert(r.before[1] < 1, theme + ' legacy streaming cap still undersamples at maximum zoom');
    }
  }
});

test('world-unit crops reach the 2x density floor before budget reduction for all audited viewports', () => {
  for (const theme of THEMES) {
    const art = manifest(theme), layers = rasterLayers(theme, art);
    const island = report.islands.find(i => i.theme === theme);
    for (const {zoom} of island.candidate) for (const tiles of Object.values(layers)) for (const t of tiles) {
      assert(tileResolution(t, zoom, 2) / (zoom * 2 * t.rasterDensity) >= 1, theme + ' crop density');
      assert(t.width <= 128.5 && t.height <= 128.5);
    }
    assert.deepEqual(Object.keys(art).filter(k => k === 'raster'), [], 'audit does not silently opt in an incompatible island');
  }
});

test('production manifest opt-in stays gated by real centre animation and existing memory thresholds', () => {
  assert.equal(report.groundCapMiB, 128);
  assert.equal(report.artCapMiB, 80);
  for (const island of report.islands.filter(i => i.candidate.length)) {
    const overBudget = island.candidate.some(v => Object.values(v.pools).some(p => p.step > 1));
    assert(overBudget, island.name + ' candidate is over budget at an audited view');
    if (overBudget || island.motion.errors.length) assert.equal(island.enabled, false, island.name + ' unsafe opt-in');
    if (['sunflower', 'pink'].includes(island.theme)) {
      assert.equal(island.motion.tested, 2);
      assert.equal(island.motion.errors.length, 2);
      assert(island.motion.errors.every(e => /^TypeError:/.test(e.message)), 'actual loader/centre update reproduces the incompatible Container');
    } else {
      assert.equal(island.motion.tested, 4, 'Pagepond checks its four procedural fountain jets');
      assert.deepEqual(island.motion.errors, [], 'Pagepond generic containers retain normal and reduced fountain motion');
    }
  }
  const pink = report.islands.find(i => i.theme === 'pink').candidate.find(v => v.width === 1000 && v.zoom === 1.8);
  const library = report.islands.find(i => i.theme === 'library').candidate.find(v => v.width === 1000 && v.zoom === 1.8);
  assert(pink.pools.ground.peakMiB > 128);
  assert(library.pools.art.peakMiB > 80);
  assert(pink.pools.ground.minDensity < 1 && library.pools.art.minDensity < 1);
});

test('exact viewport sweep matches actual culling, and real pools lower density without exceeding hard caps', async () => {
  for (const theme of THEMES) {
    const island = report.islands.find(i => i.theme === theme);
    const view = island.candidate.find(v => v.width === 2560 && v.zoom === 1.8);
    for (const [kind, tiles] of Object.entries(rasterLayers(theme))) {
      const peak = view.pools[kind], allocation = visibleAllocation(tiles, peak.camera, view.width, view.height);
      assert.equal(allocation.bytes / 1048576, peak.peakMiB, theme + ' ' + kind + ' sweep witness');
      const requested = [], released = [], budget = kind === 'ground' ? GROUND_BUDGET_BYTES : RASTER_ART_BUDGET_BYTES;
      const sources = [...new Map(allocation.visible.map(t => [t.src, t])).values()];
      const threshold = budget * (kind === 'ground' ? .9 : RASTER_ART_UTILIZATION);
      let step = 1, sharedBytes;
      do {
        sharedBytes = sources.reduce((sum, t) => sum + Math.ceil(t.width * t.resolution / step) * Math.ceil(t.height * t.resolution / step) * 4, 0);
        if (sharedBytes <= threshold || step === 16) break;
        step *= 2;
      } while (true);
      const pool = createGroundPool({budget, utilization: kind === 'ground' ? .9 : RASTER_ART_UTILIZATION, concurrency: 256,
        makeSprite: () => ({position: {set() {}}, scale: {x: 1}, destroy() {}}),
        acquire: async (src, resolution) => {
          const crop = new URL(src, 'http://sharp.test').searchParams.get('rasterCrop').split(',').map(Number);
          requested.push({src, resolution});
          return {source: {pixelWidth: Math.ceil(crop[4] * resolution), pixelHeight: Math.ceil(crop[5] * resolution)}};
        }, release: src => released.push(src)});
      try {
        const stream = pool.create(tiles, {addChild() {}});
        pool.update([{stream, camera: peak.camera, width: view.width, height: view.height}], 2);
        for (let ticks = 0; pool.stats().pendingTiles && ticks < 1000; ticks++) await flush();
        assert.equal(pool.stats().pendingTiles, 0);
        assert.equal(pool.stats().failedTiles, 0);
        assert.equal(pool.stats().residentTiles, allocation.visible.length);
        assert.equal(pool.stats().reservedBytes, sharedBytes);
        assert.equal(pool.stats().sharedSources, sources.length);
        assert.equal(requested.length, sources.length);
        assert(pool.stats().peakBytes <= budget);
        assert(requested.every(r => r.resolution === 3.625 / step), theme + ' actual downsampling divisor');
      } finally {pool.destroy();}
      assert.equal(pool.stats().reservedBytes, 0);
      assert.equal(requested.length, released.length);
    }
  }
});

test('generic loader rasterises the original live SVG crop at device size without saving bitmap files', async () => {
  const prop = manifest('sunflower').props.find(p => p.id === 'red-barn-1');
  const src = '/pixi-art/themes/sunflower/' + prop.src;
  const tile = rasterLayers('sunflower', {ground: {tiles: []}, props: [prop]}).art[0];
  const oldAdapter = DOMAdapter.get(), oldFetch = globalThis.fetch, oldLocation = globalThis.location;
  DOMAdapter.set({...oldAdapter, createCanvas, createImage: () => new Image()});
  globalThis.location = {href: 'http://sharp.test/'};
  globalThis.fetch = async () => ({ok: true, text: async () => readFileSync('public' + src, 'utf8')});
  const loader = createRasterLoader();
  const key = tile.src + '&groundScale=3.625';
  try {
    const texture = await loader.acquire(key, 3.625);
    assert.equal(texture.source.pixelWidth, Math.ceil(tile.width * 3.625));
    assert.equal(texture.source.pixelHeight, Math.ceil(tile.height * 3.625));
    assert(texture.source.pixelWidth / (tile.width * 1.8 * 2) >= 1);
    const original = readFileSync('public' + src, 'utf8');
    const crop = new URL(tile.src, 'http://sharp.test').searchParams.get('rasterCrop').split(',').map(Number);
    const svg = cropSVG(original, crop, 3.625);
    assert(svg.includes(original.slice(original.indexOf('>') + 1, original.lastIndexOf('</svg>'))), 'unchanged vector geometry inside crop');
    loader.release(key); await flush(); assert.equal(texture.destroyed, true);
  } finally {loader.destroy(); DOMAdapter.set(oldAdapter); globalThis.fetch = oldFetch; globalThis.location = oldLocation;}
});

test('engine-owned kite stakes, boats and contact leaves remain explicit sharpness blockers', () => {
  assert.equal(report.shared.kites.max, 2 / 3.6);
  assert(report.shared.boats.max < 1);
  assert.equal(report.shared.contactLeaves.max, 1 / (1.2 * 3.6));
  assert(report.shared.sleepers.every(p => p.max >= 1), 'rest-pose result from CRISP.md retained');
  const engine = readFileSync('src/pixi/engine.js', 'utf8');
  assert(engine.includes('this.homeGroundStream=this.groundPool.create(tiles,this.homeGround)'));
  assert(!engine.includes('art.raster?.enabled'), 'Home manifest opt-in is not implemented');
  assert.equal(new Container().anchor, undefined, 'generic containers have no Sprite anchor metadata');
});
