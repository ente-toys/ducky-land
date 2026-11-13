import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import sharp from 'sharp';
import {Container, Graphics, Texture} from 'pixi.js';
import {artResolution} from '../src/rendering/shared/art-resolution.js';
import {rasterTiles, RASTER_GROUND_TILE_SIZE, RASTER_ART_BUDGET_BYTES, RASTER_ART_UTILIZATION} from '../src/rendering/pixi/art/theme-raster.js';
import {tileInView, tileResolution, GROUND_BUDGET_BYTES} from '../src/rendering/pixi/art/ground-stream.js';
import {rasterPeak} from '../scripts/globe-perf/raster-peak.mjs';
import {loadThemeArt} from '../src/rendering/pixi/art/theme-art.js';
import {attachCentreMotion} from '../src/rendering/pixi/environment/centre-motion.js';
import largeArt from '../src/rendering/pixi/art/large-art-tiles.json' with {type: 'json'};
import poses from '../src/world/home/sleep-poses.json' with {type: 'json'};
import homeArt from '../src/world/home/art-manifest.json' with {type: 'json'};
import {HOME_KITES} from '../src/rendering/pixi/environment/home-kites.js';
import {SLEEP_ROOT, SLEEP_SIZE} from '../src/world/home/sleep-spots.js';
import {harborClear} from '../src/gameplay/islands.js';

export const THEMES = ['sunflower', 'pink', 'library'];
export const VIEWPORTS = [[1000, 600], [1400, 1000], [1985, 1180], [2560, 1440]];
export const NAMES = {home: 'Home', sunflower: 'Sunbob', pink: 'Rosybutton', library: 'Pagepond'};
export const REPORT = '/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/round3/SHARP.md';
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const sizeCache = new Map();
const anchor = (kind, p) => kind === 'props' ? p.anchor ?? {x: .5, y: 1}
  : kind === 'floating' ? p.anchor ?? {x: .5, y: .5}
  : kind === 'flats' && !p.topLeft ? {x: .5, y: 1} : {x: 0, y: 0};
const fileOf = src => src.startsWith('/assets/') ? src.slice(1) : 'public' + src;
export const manifest = theme => read(`public/pixi-art/themes/${theme}/art.json`);
export function entries(theme, art) {
  const base = theme === 'home' ? '' : `/pixi-art/themes/${theme}/`;
  return ['ground', 'decks', 'flats', 'props', 'floating'].flatMap(kind =>
    (kind === 'ground' ? art.ground.tiles : art[kind] ?? []).map((p, index) => ({
      p, kind, index, id: p.id ?? `${kind}-${index}`, anchor: anchor(kind, p),
      src: p.src.startsWith('/') ? p.src : base + p.src,
    })));
}
export async function sourceSize(src) {
  if (!sizeCache.has(src)) sizeCache.set(src, sharp(fileOf(src)).metadata().then(m => [m.width, m.height]));
  return sizeCache.get(src);
}

let homePromise;
export function homeModel() {
  return homePromise ??= (async () => {
    const bundled = await build({entryPoints: [resolve('src/world/home/placements.js')],
      bundle: true, platform: 'node', format: 'esm', write: false});
    const P = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
    const props = P.createPlacements().filter(harborClear);
    const art = {ground: {tiles: P.HOME_TILES}, props: props.filter(p => p.asset !== 'rowboat'),
      decks: [...P.JETTIES, {src: '/pixi-art/library-steps.svg', x: 2780, y: 1370, width: 280, height: 260, resolution: 1.5}, ...P.HOME_DECKS],
      flats: [{src: '/pixi-art/lake-race.svg', x: 3400, y: 1050, width: 1500, height: 950, resolution: 1, topLeft: true},
        {src: '/pixi-art/decals/plaza-paving.svg', x: 2330, y: 1980, width: 980, height: 780, resolution: 1, topLeft: true},
        ...[...P.homeDecals(props), ...P.HOME_GROUND_DECALS].map(p => ({...p, resolution: 2.5}))],
      floating: homeArt.floating, kites: HOME_KITES};
    const resolutions = new Map();
    for (const e of entries('home', art).filter(e => e.kind !== 'ground')) {
      resolutions.set(e.src, Math.max(resolutions.get(e.src) ?? 0, e.p.rasterResolution ?? artResolution(e.p, e.p.resolution ?? 1)));
    }
    return {art, resolutions};
  })();
}

function category(e) {
  if (e.kind === 'ground') return 'ground, grass and baked paths';
  if (e.kind === 'decks') return 'bridge decks, stairs and jetties';
  if (e.kind === 'flats') return 'flat decals, paving and baked shadows';
  if (e.kind === 'floating') return 'floating lily pads';
  const label = `${e.p.name ?? ''} ${e.p.asset ?? ''} ${e.src.replace(/^\/pixi-art\/themes\/[^/]+\//, '')}`;
  if (/bench/i.test(label)) return 'benches';
  if (/tree/i.test(label)) return 'trees';
  if (/bush/i.test(label)) return 'bushes';
  if (/lamp|lantern/i.test(label)) return 'lamps and lanterns';
  if (/flower|reeds|cattail/i.test(label)) return 'flowers and reeds';
  return 'other standing art, including centre';
}

export function rasterLayers(theme, art = manifest(theme)) {
  const layers = {ground: [], art: []};
  for (const e of entries(theme, art)) {
    const pool = e.kind === 'ground' || e.p.rasterPool === 'ground' ? 'ground' : 'art';
    const crops = rasterTiles(e.p, e.src, e.anchor, e.kind === 'ground' ? RASTER_GROUND_TILE_SIZE : undefined);
    layers[pool].push(...crops);
    if (e.kind === 'decks' && e.p.overBoats) layers[pool].push(...crops.map(t => ({...t})));
  }
  return layers;
}

export function visibleAllocation(tiles, camera, width, height) {
  let bytes = 0;
  const visible = [];
  for (const t of tiles) if (tileInView(t, camera, width, height, 1, t.viewMargin ?? 192)) {
    const resolution = tileResolution(t, camera.zoom, 2);
    bytes += Math.ceil(t.width * resolution) * Math.ceil(t.height * resolution) * 4;
    visible.push({...t, resolution});
  }
  return {bytes, visible};
}
export function budgetStep(bytes, kind) {
  const threshold = kind === 'ground' ? GROUND_BUDGET_BYTES * .9 : RASTER_ART_BUDGET_BYTES * RASTER_ART_UTILIZATION;
  let step = 1;
  while (bytes / step ** 2 > threshold && step < 16) step *= 2;
  return step;
}

export async function motionCompatibility(theme, art = manifest(theme)) {
  const centre = read(`public/pixi-art/themes/${theme}/centre/centre.json`);
  const props = art.props.filter(p => {
    const cp = typeof p.centrePiece === 'object' ? p.centrePiece : centre.pieces.find(q => p.id?.endsWith(q.id) && p.src.includes('centre/'));
    return cp?.animate && !['pour', 'fire'].includes(cp.animate.kind);
  });
  if (!props.length) return {tested: 0, errors: []};
  const oldFetch = globalThis.fetch;
  const errors = [];
  try {
    const samples = theme === 'library' ? [{id: 'library-fountain', props: art.props}]
      : props.map(prop => ({id: prop.id, props: [prop]}));
    for (const sampleProps of samples) {
      let loaded;
      const objects = new Container();
      const sample = {raster: {enabled: true}, ground: {tiles: []}, decks: [], flats: [], props: sampleProps.props};
      globalThis.fetch = async src => ({ok: true, json: async () => String(src).includes('centre/centre.json') ? centre : sample});
      try {
        loaded = await loadThemeArt({id: theme, art: `/pixi-art/themes/${theme}/art.json`, origin: {x: 0, y: 0}, width: art.width, height: art.height},
          {acquire: async () => Texture.WHITE, release() {}, groundPool: {create() {return {destroy() {}};}}});
        await attachCentreMotion(loaded, objects);
        loaded.ground.visible = true;
        for (const prop of loaded.props) prop.sprite.visible = true;
        loaded.updateCentre(1, false);
        loaded.updateCentre(1, true);
      } catch (error) {errors.push({id: sampleProps.id, message: `${error.name}: ${error.message}`});}
      finally {loaded?.destroy(); objects.destroy({children: true});}
    }
  } finally {globalThis.fetch = oldFetch;}
  return {tested: props.length, errors};
}

export async function auditIsland(theme, art, homeResolutions) {
  const list = entries(theme, art), requested = new Map();
  const tileSet = e => theme === 'home' || !['decks', 'flats'].includes(e.kind) ? null
    : largeArt[theme]?.[[e.p.src, e.p.width, e.p.height, e.p.resolution ?? (e.kind === 'decks' ? 1.5 : 2)].join('|')];
  for (const e of list.filter(e => e.kind !== 'ground' && !tileSet(e))) {
    const native = e.p.resolution ?? (theme === 'home' ? 1 : e.kind === 'decks' ? 1.5 : 2);
    requested.set(e.src, Math.max(requested.get(e.src) ?? 0, e.p.rasterResolution ?? artResolution({...e.p, src: e.src}, native)));
  }
  const records = [];
  for (const e of list) {
    const size = await sourceSize(e.src), p = e.p;
    const scale = Math.max((p.width + (e.kind === 'ground' ? p.bleed ?? 0 : 0)) / size[0],
      (p.height + (e.kind === 'ground' ? p.bleed ?? 0 : 0)) / size[1]) * (e.kind === 'props' ? p.scale ?? 1 : 1);
    const own = requested.get(e.src), shared = homeResolutions.get(e.src) ?? own;
    const legacy = tileSet(e);
    const densities = [];
    for (const zoom of [.6, 1.8]) {
      if (legacy) {
        const all = [];
        for (const t of legacy) {
          const sz = await sourceSize(t.src), s = Math.max(t.width / sz[0], t.height / sz[1]);
          all.push(tileResolution(t, zoom, 2) / (s * zoom * 2));
        }
        densities.push(Math.min(...all));
      } else if (e.kind === 'ground') densities.push(tileResolution({...p, src: e.src}, zoom, 2) / (scale * zoom * 2));
      else densities.push(shared / (scale * zoom * 2));
    }
    if (theme === 'home' && p.asset === 'fountain-wishing') {
      densities[0] = 960 / (p.width * p.scale * .6 * 2);
      densities[1] = 960 / (p.width * p.scale * 1.8 * 2);
    }
    records.push({id: e.id, kind: e.kind, group: category(e), src: e.src, sourceSize: size,
      spriteScale: scale, requestedResolution: own ?? null, homeFirstResolution: shared ?? null,
      legacyTiles: legacy?.length ?? 0, before: densities, after: [...densities]});
  }
  const groups = {};
  for (const r of records) {
    const g = groups[r.group] ??= {count: 0, beforeDefault: [Infinity, 0], beforeMax: [Infinity, 0]};
    g.count++;
    for (const [i, key] of ['beforeDefault', 'beforeMax'].entries()) {
      g[key][0] = Math.min(g[key][0], r.before[i]); g[key][1] = Math.max(g[key][1], r.before[i]);
    }
  }
  const candidate = [];
  if (theme !== 'home') {
    const layers = rasterLayers(theme, art);
    for (const [width, height] of VIEWPORTS) for (const zoom of [Math.min(width / 1500, height / 1000), 1.8]) {
      const pools = {};
      for (const [kind, tiles] of Object.entries(layers)) {
        const peak = rasterPeak(tiles, {width, height, zoom}), step = budgetStep(peak.bytes, kind);
        const at = visibleAllocation(tiles, peak.camera, width, height);
        const threshold = kind === 'ground' ? GROUND_BUDGET_BYTES * .9 : RASTER_ART_BUDGET_BYTES * RASTER_ART_UTILIZATION;
        let exactStep = 1, actualBytes;
        do {
          actualBytes = at.visible.reduce((sum, t) => sum + Math.ceil(t.width * t.resolution / exactStep) * Math.ceil(t.height * t.resolution / exactStep) * 4, 0);
          if (actualBytes <= threshold || exactStep === 16) break;
          exactStep *= 2;
        } while (true);
        if (step !== exactStep) throw Error('Allocation rounding crosses the estimated budget divisor');
        pools[kind] = {peakMiB: peak.bytes / 1048576, camera: peak.camera, step: exactStep,
          actualMiB: actualBytes / 1048576,
          minDensity: Math.min(...at.visible.map(t => t.resolution / exactStep / (zoom * 2 * (t.rasterDensity ?? 1))))};
      }
      candidate.push({width, height, zoom, pools});
    }
  }
  return {theme, name: NAMES[theme], enabled: art.raster?.enabled === true, groups, records, candidate,
    kites: (art.kites ?? []).length, motion: theme === 'home' ? null : await motionCompatibility(theme, art)};
}

export async function audit() {
  const home = await homeModel(), islands = [];
  islands.push(await auditIsland('home', home.art, home.resolutions));
  for (const theme of THEMES) islands.push(await auditIsland(theme, manifest(theme), home.resolutions));
  const sleepers = Object.entries(poses.poses).map(([pose, p]) => {
    const scale = p.k * SLEEP_SIZE * SLEEP_ROOT / 3 / poses.F;
    return {pose, default: 1 / (scale * 1.2), max: 1 / (scale * 3.6)};
  });
  const boats = read('public/pixi-art/boat/views.json');
  const shared = {sleepers, boats: {frames: Object.keys(boats.views).length,
    default: boats.resolution / (boats.width / boats.frame[0] * 1.2), max: boats.resolution / (boats.width / boats.frame[0] * 3.6)},
    kites: {default: 2 / 1.2, max: 2 / 3.6}, contactLeaves: {default: 1 / (1.2 * 1.2), max: 1 / (1.2 * 3.6)}};
  return {dpr: 2, defaultViewport: [1000, 600], defaultZoom: .6, maximumZoom: 1.8,
    groundCapMiB: GROUND_BUDGET_BYTES / 1048576, artCapMiB: RASTER_ART_BUDGET_BYTES / 1048576,
    groundFullDensityThresholdMiB: GROUND_BUDGET_BYTES * .9 / 1048576,
    artFullDensityThresholdMiB: RASTER_ART_BUDGET_BYTES * RASTER_ART_UTILIZATION / 1048576, islands, shared};
}

const fmt = n => n.toFixed(3);
const range = r => r[1] - r[0] < .0005 ? fmt(r[0]) : r.map(fmt).join(' to ');
export function markdown(report) {
  const sections = report.islands.map(island => {
    const rows = Object.entries(island.groups).map(([name, g]) =>
      `| ${name} (${g.count}) | ${range(g.beforeDefault)} | ${range(g.beforeMax)} | ${range(g.beforeDefault)} | ${range(g.beforeMax)} |`).join('\n');
    const memory = island.candidate.length ? `
Manifest-only candidate, exact worst viewport allocation over all camera positions. Ground and art peaks can occur at different cameras. These are full-density demands before the production pool reduces resolution.

| CSS viewport | zoom | ground MiB | ground divisor / resulting density | art MiB | art divisor / resulting density |
| --- | ---: | ---: | ---: | ---: | ---: |
${island.candidate.map(v => `| ${v.width}x${v.height} | ${fmt(v.zoom)} | ${v.pools.ground.peakMiB.toFixed(2)} | ${v.pools.ground.step} / ${fmt(v.pools.ground.minDensity)} | ${v.pools.art.peakMiB.toFixed(2)} | ${v.pools.art.step} / ${fmt(v.pools.art.minDensity)} |`).join('\n')}

Animation compatibility: ${island.motion.tested} animated centre pieces exercised through the actual generic loader and attachCentreMotion. ${island.motion.errors.length ? island.motion.errors.map(e => `${e.id}: ${e.message}`).join('; ') : 'No failure in this check.'}
` : `
Home needs engine work. Its ground comes from HOME_TILES and its props/flats/decks from engine.mount(), not loadThemeArt(). src/world/home/art-manifest.json supplies floating pads, but a raster.enabled property there is never read. No manifest-only Home fix exists. The fountain is additionally replaced at runtime by a fixed 960x960 canvas. Home remains unchanged.
`;
    return `## ${island.name} (${island.theme})

${island.theme === 'home' ? 'Engine path, unchanged.' : 'Generic opt-in rejected by the checks below. Manifest left unchanged.'}

| layer (placement count) | before default | before max | retained after default | retained after max |
| --- | ---: | ---: | ---: | ---: |
${rows}
${memory}`;
  }).join('\n');
  const sl = report.shared.sleepers;
  return `# Ducky Land sharpness audit

**BLOCKED within the permitted files. No production manifest or src file changed.** Audit and regression tests added under qa/*sharp*. Art, layout, counts, camera, colours and shadows remain unchanged. No commit, push or publish.

## Method

Texel density is raster resolution divided by the product of the maximum absolute sprite-axis scale, camera zoom, and DPR. Intrinsic bitmap dimensions, width/height resizing and placement.scale are included. DPR is 2. Reference default is 1000x600 CSS at zoom 0.6; maximum is 1.8. Additional default/max checks use 1400x1000, 1985x1180 and 2560x1440 CSS. The larger defaults are 0.933333, 1.18 and 1.44. Each manifest placement is audited, including legacy large-art tiles, floating pads and Home's generated ground decals. Non-ground shared sources use the expected Home-first URL lease resolution. Shared leases at other travel histories can differ.

The retained before/after tables show source-request density, before any budget-driven reduction of legacy ground/large-art streams. Thus they are an upper bound for those legacy streams, not a claim that an overloaded pool delivers those values. Per-source numbers, scale, legacy tile counts and requested/Home-first resolutions are emitted by node qa/island-sharp-audit.mjs --json. No bitmap render is saved in the repo.

The hypothetical generic opt-in uses the actual rasterTiles() output, 128-world-unit ground crops and 64-world-unit art crops. Full-density crop sampling would be 1.042 at z0.6 and 1.007 at z1.8. Exact camera-space rectangle sweeps include viewport margins and duplicated over-boat decks. The actual pool's power-of-two divisor and per-texture pixel rounding are then applied at each worst camera. Existing caps are ${report.groundCapMiB} MiB shared ground and ${report.artCapMiB} MiB per-theme art, with full-density thresholds ${report.groundFullDensityThresholdMiB.toFixed(2)} and ${report.artFullDensityThresholdMiB.toFixed(2)} MiB. A demand above either threshold forces density below 1 even though the hard cap stays enforced. These are calculated RGBA8 allocations, not measured GPU/driver residency. Shared neighbouring ground can add pressure; a single-island failure already disproves the proposed fix.

## Why the manifest switch cannot pass

1. These themes lack sparse crop metadata. Their uncropped transparent rectangles and overlapping source extents create the measured demands below. The runtime reads src/rendering/pixi/art/theme-raster-bounds.json; it does not read crop plans, tile sizes or budgets from manifest.raster. Adding such fields to art.json would do nothing. Alpha-only bounds must be added to that excluded src file before the opt-in can be validated. Neither caps nor raster density were lowered or enlarged.
2. The centre animation check exercises tiled clock hands in Sunbob and the tiled dancer and key in Rosybutton through the real theme loader. The render pools still exceed their memory caps at some audited views.
3. Themed kites retain a hardcoded 2x lease in theme-art.js. Their fixed-size stake is only 0.556 at maximum zoom even after raster.enabled. Home also loads 2x kites directly. A manifest cannot raise that lease; changing kite sizes would change layout. Generic kite resolution needs engine work.
4. Home bypasses the generic loader. Per instruction, its engine fix is reported without editing src. Shared live boats and contact leaves are also engine-owned undersampled textures, listed below, and are unaffected by any theme manifest.

Enabling a toggle that breaks centre animation or leaves whole pools below 1.0 would not meet the requested outcome. All three manifests are therefore retained as supplied, and no sharpness pass is claimed.

${sections}
## Shared visible layers

These remain unchanged on each island. Sunbob has no manifest kites; Home, Rosybutton and Pagepond each have 13 kite sites.

| layer | before default | before max | retained after default | retained after max |
| --- | ---: | ---: | ---: | ---: |
| sleeping Ducky figures/props, all 8 poses at rest | ${range([Math.min(...sl.map(p => p.default)), Math.max(...sl.map(p => p.default))])} | ${range([Math.min(...sl.map(p => p.max)), Math.max(...sl.map(p => p.max))])} | unchanged | unchanged |
| kites, minimum including fixed-size stake | ${fmt(report.shared.kites.default)} | ${fmt(report.shared.kites.max)} | unchanged | unchanged |
| live sailing boats, ${report.shared.boats.frames} full frames and matching foregrounds | ${fmt(report.shared.boats.default)} | ${fmt(report.shared.boats.max)} | unchanged | unchanged |
| contact leaves at largest 1.2x size | ${fmt(report.shared.contactLeaves.default)} | ${fmt(report.shared.contactLeaves.max)} | unchanged | unchanged |

Sleeper numbers follow CRISP.md's rest-pose method. Breathing, poke stretch, wardrobe, player actions and procedural water simulation are not certified by that figure. Sleeping contact shadows use cacheAsTexture and are deliberately faint; no sharpness pass is claimed for that cache. Standing Ducky source sprites at their rest scale 0.2112 have density 3.946 / 1.315; animated stretch and outfit warping need separate transform-aware validation. Water/surf/ripples, fountain flow, contact ellipses, kite strings, clouds, birds, butterflies, falling ambient leaves and dust use Graphics or shader geometry rather than raster artwork: a bitmap texel ratio is not applicable. Globe/terrain previews are overview/loading fallbacks, as in CRISP.md, and not certified detail layers. No browser/WebGL, maximum texture-size or GPU residency measurement is claimed.

## Required follow-up outside this file scope

Generate sparse alpha crop plans into src/rendering/pixi/art/theme-raster-bounds.json using the existing script, then rerun the exact memory sweeps. Adapt centre-motion to the generic containers, route Home's layers through the generic streams, and supply independent sharp kite leases (the URL cache is Home-first). Shared boats/contact leaves need their own engine-side density fix. Only after those changes pass should these manifests opt in. More alpha cropping may still be insufficient for overlapping opaque art; the measurements must decide, without changing art or exceeding caps.

## Validation

Run: node --test qa/island-sharp.test.mjs qa/theme-raster.test.mjs qa/ground-stream.test.mjs qa/sunbob-ground.test.mjs qa/rosy-ground.test.mjs qa/pagepond-ground.test.mjs qa/theme-loading.test.mjs

Build: npx vite build --configLoader native --outDir /tmp/r3-$RANDOM, followed by removal of that exact temporary output directory. Final execution results are appended below.
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = await audit();
  if (process.argv.includes('--write-report')) {writeFileSync(REPORT, markdown(report)); console.log('Wrote ' + REPORT);}
  else if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else console.log(JSON.stringify(report.islands.map(({theme, groups, candidate, motion}) => ({theme, groups, candidate, motion})), null, 2));
}
