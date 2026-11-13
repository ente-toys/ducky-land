import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {availableParallelism} from 'node:os';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
// Vite's config runner is closed before build hooks run. Keep these imports
// native, including the in-memory placement bundle, outside that runner.
const nativeImport = new Function('specifier', 'return import(specifier)');

const hash = bytes => createHash('sha256').update(bytes).digest('hex').slice(0, 24);
const DIRECTORY = 'art-prerender';
const VERSION = 1;

// 1x/2x screen density at the preparation zoom, bounded by the same native
// resolution caps as island-budget. Runtime still applies its island-wide
// memory budget, resizing the selected tier during bitmap decode.
export function prerenderSources(entries, sizes, maxZoom = 1.8) {
  const sources = new Map();
  for (const entry of entries) {
    if (!entry.src?.endsWith('.svg')) continue;
    const size = sizes[entry.src];
    if (!size) throw Error(`Prerender needs native dimensions: ${entry.src}`);
    const cap = entry.rasterResolution ?? entry.resolution ?? 2;
    const placed = entry.width && entry.height
      ? Math.max(entry.width / size[0], entry.height / size[1]) * (entry.scale ?? 1) * maxZoom
      : cap / 2;
    const previous = sources.get(entry.src);
    sources.set(entry.src, {w: size[0], h: size[1],
      padding: Math.max(previous?.padding ?? 0, entry.mipmaps === false ? 2 : 0),
      scales: [1, 2].map((density, i) => Math.max(previous?.scales[i] ?? 0, Math.min(cap, placed * density)))});
  }
  return sources;
}

export async function collectPlacedArt(root) {
  // Bundle the actual placement functions, which import JSON without Node's
  // import attributes. This is the same approach as the memory-budget QA.
  const {build} = require('esbuild');
  const bundle = await build({stdin: {resolveDir: root, contents: `
    import raw from './assets/world/world.json';
    import art from './src/world/home/art-manifest.json';
    import {geometry} from './assets/world/island-geometry.mjs';
    import {createPlacements,homeDecals,trimWorld,HOME_TILES,HOME_DECKS,HOME_GROUND_DECALS,JETTIES} from './src/world/home/placements.js';
    import {WORLD_ISLANDS} from './src/world/world-map.js';
    import {mapFor} from './src/world/island-maps.js';
    const world=trimWorld(raw),props=createPlacements(world,geometry({...world,obstacles:[]}).walkable);
    export const themes=[...new Set(WORLD_ISLANDS.map(i=>i.theme??'home'))].map(id=>({id,art:mapFor(id).art}));
    export const entries=[...HOME_TILES.map(e=>({...e,mipmaps:false})),...JETTIES,
      ...HOME_DECKS,...props,...art.floating,
      {src:'/pixi-art/water-texture.svg',resolution:1},
      {src:'/pixi-art/lake-race.svg',width:1500,height:950,resolution:1},
      {src:'/pixi-art/decals/plaza-paving.svg',width:980,height:780,resolution:1},
      ...homeDecals(props).map(e=>({...e,resolution:2.5})),...HOME_GROUND_DECALS.map(e=>({...e,resolution:2.5}))];
  `}, bundle: true, platform: 'node', format: 'esm', write: false});
  const {entries, themes} = await nativeImport('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  for (const theme of themes) {
    entries.push({src: `/pixi-art/globe/${theme.id}-ground.svg`, resolution: 1});
    if (!theme.art) continue;
    const base = theme.art.slice(0, theme.art.lastIndexOf('/') + 1);
    const art = JSON.parse(await readFile(path.join(root, 'public', theme.art), 'utf8'));
    for (const [pieces, resolution, mipmaps] of [[art.ground?.tiles, 1, false], [art.decks, 1.5, true],
      [art.flats, 2, true], [art.props, 2, true], [art.floating, 2, true]]) {
      for (const p of pieces ?? []) entries.push({resolution, mipmaps, ...p, src: p.src.startsWith('/') ? p.src : base + p.src});
    }
  }
  const kites = ['stake', ...['red','yellow','blue','purple','mint','orange'].flatMap(c => ['body','tail-a','tail-b'].map(p => `${c}-${p}`))];
  entries.push(...kites.map(name => ({src: `/pixi-art/home-kites/${name}.svg`, resolution: 2})),
    {src: '/pixi-art/fx/contact-leaf.svg', resolution: 1},
    {src: '/pixi-art/themes/snow/final/buildings/smoke.svg', resolution: 2});
  const ponds = JSON.parse(await readFile(path.join(root, 'src/rendering/pixi/environment/pond-regions.json'), 'utf8'));
  for (const asset of ponds.assets) entries.push({...asset, src: `/pixi-duck/float/parts/${asset.name}-duck.svg`, resolution: 1});
  return entries;
}

export function prerenderArt() {
  let config, manifestURL;
  return {
    name: 'prerender-island-art', apply: 'build',
    configResolved(value) {config = value;},
    async buildStart() {
      const start = performance.now(), root = config.root;
      const sharp = require('sharp');
      const sizes = JSON.parse(await readFile(path.join(root, 'src/rendering/shared/art-source-sizes.json'), 'utf8'));
      const entries = await collectPlacedArt(root);
      for (const src of new Set(entries.map(e => e.src).filter(src => src?.endsWith('.svg') && !sizes[src]))) {
        const {width, height} = await sharp(path.join(config.publicDir, src)).metadata();
        sizes[src] = [width, height];
      }
      const sources = prerenderSources(entries, sizes);
      const manifest = {}, jobs = [];
      for (const [src, source] of [...sources].sort(([a], [b]) => a.localeCompare(b))) {
        manifest[src] = {w: source.w, h: source.h, padding: source.padding, tiers: []};
        for (const scale of source.scales) jobs.push({src, ...source, scale});
      }
      // Keep all caching in dist. Vite clears it after buildStart, so read any
      // unchanged content-addressed files here and re-emit them with the build.
      const output = path.resolve(root, config.build.outDir), emitted = new Map();
      let cursor = 0, rendered = 0, reused = 0;
      const inputs = new Map();
      const inputFor = src => {
        if (!inputs.has(src)) inputs.set(src, readFile(path.join(config.publicDir, src)));
        return inputs.get(src);
      };
      const concurrency = Math.min(4, availableParallelism());
      await Promise.all(Array.from({length: concurrency}, async () => {
        while (cursor < jobs.length) {
          const job = jobs[cursor++], input = await inputFor(job.src);
          const width = Math.ceil(job.w * job.scale), height = Math.ceil(job.h * job.scale);
          const density = Math.max(1, 72 * Math.max(width / job.w, height / job.h));
          const digest = hash(Buffer.concat([input, Buffer.from(JSON.stringify({VERSION, width, height,
            density, padding: job.padding, sharp: sharp.versions, quality: 92, lossless: job.padding > 0, effort: 0}))]));
          const fileName = `${DIRECTORY}/${digest}.webp`;
          // Identical tiers/sources share one output and one render.
          if (!emitted.has(fileName)) emitted.set(fileName, (async () => {
            let bytes;
            try {await stat(path.join(output, fileName)); bytes = await readFile(path.join(output, fileName)); reused++;}
            catch (error) {
              if (error.code !== 'ENOENT') throw error;
              let image = sharp(input, {density}).resize(width, height, {fit: 'fill'});
              if (job.padding) image = image.extend({top: 2, bottom: 2, left: 2, right: 2, extendWith: 'copy'});
              // Lossless ground avoids independent WebP blocks giving the two
              // sides of a continuous join slightly different colours.
              bytes = await image.webp({quality: 92, lossless: job.padding > 0, alphaQuality: 100, effort: 0}).toBuffer(); rendered++;
            }
            this.emitFile({type: 'asset', fileName, source: bytes});
            return bytes.length;
          })());
          await emitted.get(fileName);
          manifest[job.src].tiers.push({scale: job.scale, url: config.base + fileName, width, height});
        }
      }));
      for (const entry of Object.values(manifest)) entry.tiers.sort((a, b) => a.scale - b.scale);
      const json = JSON.stringify(manifest), fileName = `${DIRECTORY}/manifest-${hash(json)}.json`;
      this.emitFile({type: 'asset', fileName, source: json});
      manifestURL = config.base + fileName;
      const bytes = (await Promise.all(emitted.values())).reduce((a, b) => a + b, Buffer.byteLength(json));
      config.logger.info(`Prerender art: ${sources.size} sources, ${emitted.size} WebP (${rendered} rendered, ${reused} reused), ${(bytes / 1048576).toFixed(2)} MiB, ${((performance.now() - start) / 1000).toFixed(2)} s`);
    },
    transform(code, id) {
      if (id.endsWith('/art/whole-svg-loader.js')) return {code: code.replaceAll('__PRERENDER_ART_MANIFEST__', JSON.stringify(manifestURL)), map: null};
    },
  };
}
