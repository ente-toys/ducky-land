import {packHomeScene} from '../src/world/home/scene-pack.js';
import {prerenderDetailSheets} from './prerender-detail.mjs';
import {prerenderCache} from './prerender-cache.mjs';
import {detailSources} from './detail-sources.mjs';
import {packDetailFrames,detailSheetBytes} from './detail-layout.mjs';
import {selectIslandTier} from '../src/app/ducky-prefetch.js';
import {foliageColour} from '../src/rendering/pixi/environment/plant-contact.js';
import {planIslandArt,planIslandSheets,plannedSheetTiers,ISLAND_ART_BUDGET} from '../src/rendering/pixi/art/island-budget.js';
import {textureFootprint} from '../src/rendering/pixi/art/texture-footprint.js';
import {readFile, readdir} from 'node:fs/promises';
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
// The player's Duck is drawn on every start: its part list and its outfit frames.
const DUCK_MANIFEST = '/pixi-duck/manifest.json', DUCK_PARTS = '/pixi-duck/frames/';
export const startupPreloads = urls => [...new Set(urls.filter(Boolean))]
  .map(href => ({tag:'link',attrs:{rel:'preload',as:'fetch',href,crossorigin:''},injectTo:'head'}));
const VERSION = 1;
// Bump when placement changes to invalidate sheets from earlier builds.
const SHEET_PACKING_VERSION = 1;

// Uniform screen-density steps keep continuous pieces aligned across sheets.
// Requests above the emitted range retain their exact SVG raster fallback.
// Limit individual encodes to WebP dimensions and a bounded pixel allocation.
export function prerenderSources(entries, sizes) {
  const sources = new Map();
  for (const entry of entries) {
    if (!/\.(svg|png)$/.test(entry.src)) continue;
    const size = sizes[entry.src];
    if (!size) throw Error(`Prerender needs native dimensions: ${entry.src}`);
    const cap = entry.rasterResolution ?? entry.resolution ?? 2;
    const placed = entry.width && entry.height
      ? Math.max((entry.width+(entry.bleed??0)) / size[0], (entry.height+(entry.bleed??0)) / size[1]) * (entry.scale ?? 1)
      : cap;
    const previous = sources.get(entry.src);
    sources.set(entry.src, {w: size[0], h: size[1],
      fixed: (previous?.fixed??true)&&!(entry.width&&entry.height),
      padding: Math.max(previous?.padding ?? 0, entry.mipmaps === false ? 2 : 0),
      scales: [.25,.5,.75,1,1.5,2,.3,.4].map((density,i)=>Math.min(
        16000/Math.max(size[0],size[1]),Math.sqrt(32000000/(size[0]*size[1])),
        Math.max(previous?.scales[i]??0,entry.width&&entry.height?placed*density:cap)))});
  }
  return sources;
}

// One extra close-view tier covers main's actual per-piece choices, including
// DPR 3. Keep the small landing tiers and their cache keys unchanged.
export function addMainDetailTiers(entries,sizes,sources) {
  const required=new Map();
  for(const island of entries.islands??[{theme:'home'}]) {
    const own=entries.filter(e=>e.theme===island.theme);
    for(const dpr of [1,2,3])for(const defaultZoom of [.06,.08,.1,.12,.16,.2,.26,.32,.39,.5,.65,.72,.784,.9,1.08,1.44,1.8]) {
      const plan=planIslandArt(own,{dpr,defaultZoom,sourceSizes:sizes});
      for(const [src,r]of plan.resolutions)required.set(src,Math.max(required.get(src)??0,r));
    }
  }
  // Group members have the same tier indices. Entries already dense enough
  // repeat their top tier rather than changing the landing group's indices.
  for(const [src,source]of sources)if(!source.fixed&&required.has(src))
    source.scales.push(Math.max(...source.scales,required.get(src)));
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
    export const islands=WORLD_ISLANDS.map(i=>({id:i.id,theme:i.theme??'home'}));
    export const themes=[...new Set(WORLD_ISLANDS.map(i=>i.theme??'home'))].map(id=>({id,art:mapFor(id).art}));
    export const entries=[...JETTIES.map(e=>({...e,lossless:true})),
      ...HOME_DECKS.map(e=>({...e,lossless:true})),...props,...art.floating,
      {src:'/pixi-art/water-texture.svg',resolution:1},
      {src:'/pixi-art/lake-race.svg',width:1500,height:950,resolution:1,ground:true},
      {src:'/pixi-art/decals/plaza-paving.svg',width:980,height:780,resolution:1,ground:true},
      ...homeDecals(props).map(e=>({...e,resolution:2.5,ground:true})),...HOME_GROUND_DECALS.map(e=>({...e,resolution:2.5,ground:true}))];
  `}, bundle: true, platform: 'node', format: 'esm', write: false});
  const collected = await nativeImport('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  // The data module is cached across calls; never append to its exported array.
  const entries=collected.entries.map(e=>({...e})),themes=collected.themes;
  for (const e of entries) e.theme='home';
  for (const theme of themes) {
    entries.push({src: `/pixi-art/globe/${theme.id}-ground.svg`, resolution: 1, theme:'world'});
    if (!theme.art) continue;
    const base = theme.art.slice(0, theme.art.lastIndexOf('/') + 1);
    const art = JSON.parse(await readFile(path.join(root, 'public', theme.art), 'utf8'));
    for (const [pieces, resolution, mipmaps] of [[art.ground?.tiles?.filter(p=>!p.src.endsWith('.svg')), 1, false], [art.decks, 1.5, true],
      [art.flats, 2, true], [art.props, 2, true], [art.floating, 2, true]]) {
      for (const p of pieces ?? []) entries.push({resolution, mipmaps, ground:pieces===art.flats, lossless:pieces===art.decks||pieces===art.flats, ...p, theme:theme.id, src: p.src.startsWith('/') ? p.src : base + p.src});
    }
  }
  const legacyBog=JSON.parse(await readFile(path.join(root,'public/pixi-art/themes/bog/art.json'),'utf8'));
  for(const p of legacyBog.ground.tiles.filter(p=>p.src.endsWith('.png')))
    entries.push({...p,mipmaps:false,theme:'legacy-bog',src:'/pixi-art/themes/bog/'+p.src});
  const kites = ['stake', ...['red','yellow','blue','purple','mint','orange'].flatMap(c => ['body','tail-a','tail-b'].map(p => `${c}-${p}`))];
  entries.push(...kites.map(name => ({src: `/pixi-art/home-kites/${name}.svg`, resolution: 2})),
    {src: '/pixi-art/fx/contact-leaf.svg', resolution: 1},
    {src: '/pixi-art/themes/snow/final/buildings/smoke.svg', resolution: 2});
  const ponds = JSON.parse(await readFile(path.join(root, 'src/rendering/pixi/environment/pond-regions.json'), 'utf8'));
  for (const asset of ponds.assets) entries.push({...asset, src: `/pixi-duck/float/parts/${asset.name}-duck.svg`, resolution: 1});
  const startup = [];
  // One Ducky wearing an outfit uploads that outfit's whole sheet, so a sheet
  // holds only the frames the Ducky manifest can ask for. Older drawings of
  // the same angles stay on disk and were about half of several cap sheets.
  const worn = new Set(JSON.parse(await readFile(path.join(root,'public/pixi-duck/manifest.json'),'utf8')).wardrobe
    .flatMap(item => Object.values(item.frames).flat().map(frame => frame.url)));
  for (const dir of ['/pixi-duck','/pixi-art/boat/spin','/pixi-art/boat-build']) {
    for (const file of await readdir(path.join(root,'public',dir),{recursive:true})) {
      if (!file.endsWith('.svg') || dir==='/pixi-duck' && file.startsWith('float/')) continue;
      const outfit=/^(?:frames\/)?(cap-\d+|shoes-(?:fit-)?\d+|acc-\d+|shades-\d+)/.exec(file);
      if (outfit && !worn.has(dir+'/'+file)) continue;
      startup.push({src:dir+'/'+file,resolution:dir.includes('/boat/')?1.25:dir.includes('boat-build')?(file==='build.svg'?1:4):1,
        theme:outfit?'wardrobe-'+outfit[1]:dir.includes('/boat/')&&!/boat-(00|24)\.svg$/.test(file)?'boat-spin':dir.includes('boat-build')&&file==='build.svg'?'boat-burst':'startup',lossless:true});
    }
  }
  startup.push({src:'/pixi-art/karma/golden-feather.svg',resolution:1,theme:'startup',lossless:true});
  entries.push(...startup);
  Object.defineProperty(entries,'islands',{value:collected.islands});
  return entries;
}

export function prerenderArt() {
  let config, manifestURL, manifest, entries, sheetBytes, homeURL, pinkURL, libraryURL, bogURL, communityURL, snowURL, duckPartsURL, islandsURL;
  let artCache;
  const previousDetail=new Map();
  return {
    name: 'prerender-island-art', apply: 'build',
    configResolved(value) {config = value;},
    // Every start reads these small files one after another once the page code runs.
    // Fetch them with the page instead. The HTML is written after generateBundle,
    // so the island index name is known here.
    transformIndexHtml() {return startupPreloads([homeURL,islandsURL,manifestURL,duckPartsURL,manifestURL&&DUCK_MANIFEST]);},

    async buildStart() {
      const start = performance.now(), root = config.root;
      const sharp = require('sharp');
      if (process.env.CF_PAGES === '1' || process.env.DUCKY_ART_CACHE_DIR) {
        // A renderer or encoder change can affect all outputs. Individual
        // raster keys below also include the inputs that affect each image.
        const renderer = await Promise.all(['vite-prerender-art.mjs', 'prerender-detail.mjs']
          .map(file => readFile(path.join(root, 'scripts', file))));
        const fingerprint = hash(Buffer.concat([...renderer, Buffer.from(JSON.stringify([config.base, sharp.versions]))]));
        artCache = prerenderCache(root, fingerprint, config.logger);
      }
      const priorDir=path.resolve(root,config.build.outDir,DIRECTORY);
      for(const name of await readdir(priorDir).catch(()=>[]))if(/^detail-.*\.webp$/.test(name))previousDetail.set(`${DIRECTORY}/${name}`,await readFile(path.join(priorDir,name)));
      const sizes = JSON.parse(await readFile(path.join(root, 'src/rendering/shared/art-source-sizes.json'), 'utf8'));
      entries = await collectPlacedArt(root);
      const home = JSON.stringify(packHomeScene(await bakeHomeScene(root)));
      homeURL = config.base + `${DIRECTORY}/home-${hash(home)}.json`;
      this.emitFile({type:'asset',fileName:homeURL.slice(config.base.length),source:home});
      // The source packs store serialized JSON. Emit the original bytes so browser
      // fetches, content hashes and decoding stay identical.
      const community=JSON.parse(await readFile(path.join(root,'assets/world/themes/community/scene-pack.json'),'utf8'));
      communityURL=config.base+`${DIRECTORY}/community-${hash(community)}.json`;
      this.emitFile({type:'asset',fileName:communityURL.slice(config.base.length),source:community});
      const pink=JSON.parse(await readFile(path.join(root,'assets/world/themes/pink/scene-pack.json'),'utf8'));
      pinkURL=config.base+`${DIRECTORY}/pink-${hash(pink)}.json`;
      this.emitFile({type:'asset',fileName:pinkURL.slice(config.base.length),source:pink});
      const bog=JSON.parse(await readFile(path.join(root,'assets/world/themes/bog-arena/scene-pack.json'),'utf8'));
      bogURL=config.base+`${DIRECTORY}/bog-${hash(bog)}.json`;
      this.emitFile({type:'asset',fileName:bogURL.slice(config.base.length),source:bog});
      const library=JSON.parse(await readFile(path.join(root,'assets/world/themes/library/scene-pack.json'),'utf8'));
      libraryURL=config.base+`${DIRECTORY}/library-${hash(library)}.json`;
      this.emitFile({type:'asset',fileName:libraryURL.slice(config.base.length),source:library});
      const snow=JSON.parse(await readFile(path.join(root,'assets/world/themes/snow/scene-pack.json'),'utf8'));
      snowURL=config.base+`${DIRECTORY}/snow-${hash(snow)}.json`;
      this.emitFile({type:'asset',fileName:snowURL.slice(config.base.length),source:snow});
      for (const src of new Set(entries.map(e => e.src).filter(src => /\.(svg|png)$/.test(src) && !sizes[src]))) {
        const {width, height} = await sharp(path.join(config.publicDir, src)).metadata();
        sizes[src] = [width, height];
      }
      const opaqueGround=new Set();
      for(const src of new Set(entries.filter(e=>e.src.endsWith('.png')).map(e=>e.src)))
        if((await sharp(path.join(config.publicDir,src)).stats()).isOpaque)opaqueGround.add(src);
      const sources = prerenderSources(entries, sizes);
      // Landing tiers stay small; close-view sheets are emitted from main's per-piece plan below.
      const owners=new Map();
      for(const e of entries){const set=owners.get(e.src)??new Set();set.add(e.theme??'shared');owners.set(e.src,set);}
      manifest = {}; const jobs = []; sheetBytes=new Map();
      for (const [src, source] of [...sources].sort(([a], [b]) => a.localeCompare(b))) {
        manifest[src] = {w: source.w, h: source.h, padding: source.padding, fixed:source.fixed, tiers: []};
        for (const [tier,scale] of (owners.get(src)?.has('boat-spin')?[.25,1.25]:entries.some(e=>e.src===src&&e.lossless&&/^(startup|wardrobe-|boat-)/.test(e.theme))?[Math.max(...entries.filter(e=>e.src===src).map(e=>e.resolution??1))]:source.fixed?source.scales.slice(0,6):source.scales).entries()) jobs.push({src, ...source, scale,tier,quality:opaqueGround.has(src)?90:92,lossless:entries.some(e=>e.src===src&&e.lossless)||source.padding>0&&!opaqueGround.has(src)});
      }
      // Read unchanged content-addressed files from the persistent cache or
      // the previous local output, before Vite clears it for this build.
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
          if(!('foliageColour' in manifest[job.src]))manifest[job.src].foliageColour=foliageColour(input.toString('utf8'));
          const width = Math.ceil(job.w * job.scale), height = Math.ceil(job.h * job.scale);
          const density = Math.max(1, 72 * Math.max(width / job.w, height / job.h));
          const digest = hash(Buffer.concat([input, Buffer.from(JSON.stringify({VERSION, width, height,
            density, padding: job.padding, sharp: sharp.versions, quality: job.quality, lossless: job.lossless, effort: 0}))]));
          const fileName = `${DIRECTORY}/${digest}.webp`;
          // Identical tiers/sources share one output and one render.
          if (!emitted.has(fileName)) emitted.set(fileName, (async () => {
            let bytes = await artCache?.read(fileName);
            if (!bytes) {
              bytes = await readFile(path.join(output, fileName)).catch(error => {
                if (error.code !== 'ENOENT') throw error;
              });
              if (bytes) await artCache?.write(fileName, bytes);
            }
            if (bytes) reused++;
            else {
              let image = sharp(input, {density}).resize(width, height, {fit: 'fill'});
              if (job.padding) image = image.extend({top: 2, bottom: 2, left: 2, right: 2, extendWith: 'copy'});
              // Lossless ground avoids independent WebP blocks giving the two
              // sides of a continuous join slightly different colours.
              bytes = await image.webp({quality: job.quality, lossless: job.lossless, alphaQuality: 100, effort: 0}).toBuffer(); rendered++;
              await artCache?.write(fileName, bytes);
            }
            sheetBytes.set(config.base+fileName,bytes.length);
            return bytes;
          })());
          await emitted.get(fileName);
          manifest[job.src].tiers[job.tier]={scale: job.scale, url: config.base + fileName, width, height,sourceQuality:job.quality,sourceLossless:job.lossless};
        }
      }));
      const groups=new Map();
      for(const [src,entry] of Object.entries(manifest)){
        const owner=owners.get(src),theme=owner.size===1?[...owner][0]:'shared';
        for(const [index,tier] of entry.tiers.entries()){
          const group=`${theme}/${entry.padding?'ground'+(opaqueGround.has(src)?'/opaque':''):entry.fixed?'fixed':'props'}/${index}`;tier.group=group;
          const list=groups.get(group)??[];groups.set(group,list);
          list.push({src,entry,tier});
        }
      }
      let previous={};
      try{
        const cached = await artCache?.read('manifest.json');
        if(cached)previous=JSON.parse(cached);
        else {
          const name=(await readdir(path.join(output,DIRECTORY))).find(n=>/^manifest-.*\.json$/.test(n));
          if(name)previous=JSON.parse(await readFile(path.join(output,DIRECTORY,name),'utf8'));
        }
      }catch(error){if(error.code!=='ENOENT')throw error;}
      const previousGroups=new Map();
      for(const [src,e]of Object.entries(previous))for(const tier of e.tiers){
        if(tier.sheet&&tier.group.endsWith('/8')&&e.tiers.some(t=>t!==tier&&!t.group.endsWith('/8')&&t.url===tier.url&&t.sheet===tier.sheet))continue;
        const members=previousGroups.get(tier.group)??new Set();
        members.add(src+'\0'+tier.url);previousGroups.set(tier.group,members);
      }
      // Groups are independent, so several are packed at once. A main-detail
      // group (/8) reads the sheets of its sibling groups, so those run after.
      const packGroup=async([group,allPieces])=>{
        // A main-detail tier often repeats the old top density. Reuse that
        // exact frame instead of encoding another copy of its entire sheet.
        const pieces=allPieces.filter(p=>{
          if(!group.endsWith('/8'))return true;
          const same=p.entry.tiers.find(t=>t!==p.tier&&t.scale===p.tier.scale&&t.sheet);
          if(!same)return true;
          Object.assign(p.tier,same,{group});return false;
        });
        if(!pieces.length)return;
        const members=previousGroups.get(group);
        const sameMembers=members?.size===pieces.length&&pieces.every(p=>members.has(p.src+'\0'+p.tier.url));
        const lossless=!group.includes('/ground/opaque/'),quality=lossless?92:90;
        const old=pieces.map(p=>sameMembers&&previous[p.src]?.tiers.find(t=>
          (t.group===group||!t.group&&t.atlasFallback==='oversized')&&t.url===p.tier.url&&t.sheetLimit===4096&&(
            t.atlasFallback==='oversized'||t.sheet&&t.sheetPackingVersion===SHEET_PACKING_VERSION&&
            t.sheetWidth<=4096&&t.sheetHeight<=4096&&t.lossless===lossless&&
            (quality===92||t.sheetQuality===quality)&&t.sheetEffort===4)));
        if(old.every(Boolean)){
          const urls=[...new Set(old.flatMap(t=>[t.sheet]).filter(Boolean))];
          const files=await Promise.all(urls.map(async url=>{
            const name=url.slice(config.base.length);
            let bytes=await artCache?.read(name);
            if(!bytes){
              bytes=await readFile(path.join(output,name)).catch(error=>{if(error.code!=='ENOENT')throw error;});
              if(bytes)await artCache?.write(name,bytes);
            }
            return [url,bytes];
          }));
          if(files.every(([,bytes])=>bytes)){
            for(const [url,bytes]of files){this.emitFile({type:'asset',fileName:url.slice(config.base.length),source:bytes});sheetBytes.set(url,bytes.length);}
            pieces.forEach((p,i)=>{Object.assign(p.tier,old[i]);});
            config.logger.info(`Art sheets ${group}: ${files.length} reused`);
            return;
          }
        }
        for(const p of pieces){
          p.bytes=await emitted.get(p.tier.url.slice(config.base.length));
          // Opaque ground sheets get one lossy encode, directly from the PNG pixels.
          if(opaqueGround.has(p.src))p.bytes=await sharp(await inputFor(p.src)).resize(p.tier.width,p.tier.height,{fit:'fill'})
            .extend({top:2,bottom:2,left:2,right:2,extendWith:'copy'}).png().toBuffer();
        }
        const sheets=await packArtSheets(pieces,4096,{lossless,quality});
        for(const sheet of sheets){
          const name=`${DIRECTORY}/sheet-${hash(sheet.bytes)}.webp`;
          await artCache?.write(name, sheet.bytes);
          this.emitFile({type:'asset',fileName:name,source:sheet.bytes});
          sheetBytes.set(config.base+name,sheet.bytes.length);
          for(const frame of sheet.frames) Object.assign(frame.piece.tier,{sheet:config.base+name,
            lossless:sheet.lossless,x:frame.x,y:frame.y,frameWidth:frame.width,frameHeight:frame.height,
            offsetX:frame.offsetX,offsetY:frame.offsetY,sheetWidth:sheet.width,sheetHeight:sheet.height,
            group,gutter:2,sheetLimit:4096,sheetEffort:4,sheetQuality:quality,sheetPackingVersion:SHEET_PACKING_VERSION});
        }
        config.logger.info(`Art sheets ${group}: ${sheets.length}, ${pieces.filter(p=>p.tier.atlasFallback).length} oversized fallbacks, ${(sheets.reduce((n,s)=>n+s.bytes.length,0)/1048576).toFixed(2)} MiB, ${sheets.map(s=>`${s.width}x${s.height}`).join(' ')}`);
      };
      const packGroups=async list=>{
        let next=0;
        await Promise.all(Array.from({length:Math.min(concurrency,list.length)},async()=>{while(next<list.length)await packGroup(list[next++]);}));
      };
      await packGroups([...groups].filter(([group])=>!group.endsWith('/8')));
      await packGroups([...groups].filter(([group])=>group.endsWith('/8')));
      // Extra landing densities append to stable packing group IDs so old
      // sheets remain reusable. Restore nominal order for group tier planning,
      // even where native-size caps make several scales numerically equal.
      const tierOrder=[0,6,7,1,2,3,4,5,8];
      for(const e of Object.values(manifest))e.tiers.sort((a,b)=>tierOrder.indexOf(Number(a.group.split('/').at(-1)))-tierOrder.indexOf(Number(b.group.split('/').at(-1))));
      // Ship a single-piece WebP only where no sheet frame covers that tier
      // (oversized pieces). Sheets cover everything else; emitting every piece
      // would push the deploy past the host's file-count limit.
      const pieceFiles=new Set();
      for(const e of Object.values(manifest))for(const t of e.tiers)if(!t.sheet&&t.url)pieceFiles.add(t.url.slice(config.base.length));
      for(const fileName of pieceFiles){const bytes=await emitted.get(fileName);if(bytes)this.emitFile({type:'asset',fileName,source:bytes});}
      config.logger.info(`Prerender art: ${pieceFiles.size} single-piece WebP kept (no sheet frame)`);
      for(const [src,e] of Object.entries(manifest))if(/^\/pixi-duck\/view-.*-body-/.test(src))e.svgText=await readFile(path.join(config.publicDir,src),'utf8');
      const json = JSON.stringify(manifest), fileName = `${DIRECTORY}/manifest-${hash(json)}.json`;
      await artCache?.write('manifest.json', json);
      this.emitFile({type: 'asset', fileName, source: json});
      // Directory shards keep startup from parsing every island and outfit.
      const parts = {};
      const buckets = new Map();
      for(const [src,e] of Object.entries(manifest)){
        const dir=src.slice(0,src.lastIndexOf('/')+1);
        if(!buckets.has(dir))buckets.set(dir,{});
        buckets.get(dir)[src]=e;
      }
      for(const [dir,part]of buckets){
        const source=JSON.stringify(part),name=`${DIRECTORY}/part-${hash(source)}.json`;
        this.emitFile({type:'asset',fileName:name,source});parts[dir]=config.base+name;
      }
      const catalog=JSON.stringify({parts}),catalogName=`${DIRECTORY}/catalog-${hash(catalog)}.json`;
      duckPartsURL=parts[DUCK_PARTS];
      this.emitFile({type:'asset',fileName:catalogName,source:catalog});
      manifestURL = config.base + catalogName;
      const bytes = (await Promise.all(emitted.values())).reduce((a, b) => a + b.length, Buffer.byteLength(json));
      config.logger.info(`Prerender art: ${sources.size} sources, ${emitted.size} WebP (${rendered} rendered, ${reused} reused), ${(bytes / 1048576).toFixed(2)} MiB, ${((performance.now() - start) / 1000).toFixed(2)} s`);
    },
    async generateBundle(_options,bundle) {
      const main=Object.values(bundle).find(b=>b.type==='chunk'&&b.isEntry&&b.facadeModuleId?.endsWith('/index.html'))
        ??Object.values(bundle).find(b=>b.type==='chunk'&&b.isEntry);
      if(!main)throw Error('Missing main JS entry');
      const prefetch=await require('esbuild').transform(await readFile(path.join(config.root,'src/app/ducky-prefetch.js'),'utf8'),{minify:true,format:'esm'});
      if(Buffer.byteLength(prefetch.code)>=2048)throw Error('Intro prefetch module must be under 2 KB');
      this.emitFile({type:'asset',fileName:'ducky-prefetch.js',source:prefetch.code});
      const index=buildIslandIndex(entries,manifest,config.base+main.fileName,sheetBytes);
      const groundAsset=Object.values(bundle).find(a=>/^art-prerender\/ground-manifest-.*\.json$/.test(a.fileName));
      if(!groundAsset)throw Error('Island landing sets require the ground mesh manifest');
      const groundManifest=JSON.parse(String(groundAsset.source));
      const svgBundles=new Map(),detailCache=new Map();
      for(const island of entries.islands){
        if(svgBundles.has(island.theme))continue;
        // The tiled ocean is already live at density 1 and belongs to the shared
        // allowance. Keep it out of island swaps so a fitted plan cannot soften it.
        const own=entries.filter(e=>e.theme===island.theme&&e.src!=='/pixi-art/water-texture.svg');
        const pieces=await detailSources(own,config.publicDir);
        svgBundles.set(island.theme,{pieces,own});
      }
      for(const [id,tiers]of Object.entries(index.islands)){
        const theme=entries.islands.find(i=>i.id===id).theme;
        const keys=new Set(entries.filter(e=>e.theme===theme||!e.theme||e.theme==='shared'||e.theme==='startup').map(e=>e.src));
        const source=JSON.stringify(Object.fromEntries([...keys].filter(src=>manifest[src]).map(src=>[src,manifest[src]])));
        const name=`${DIRECTORY}/island-${hash(source)}.json`;
        this.emitFile({type:'asset',fileName:name,source});
        const svg=svgBundles.get(theme);
        const ground=groundManifest[theme==='bog'&&svg.own.some(e=>e.src.startsWith('/pixi-art/themes/bog-arena/'))?'bog-arena':theme];
        if(!ground)throw Error(`Missing ground mesh for ${theme}`);
        const groundURLs=[groundAsset.fileName,ground.url.slice(config.base.length),...(ground.waterMask?[ground.waterMask.url.slice(config.base.length)]:[])];
        const groundBytes=groundURLs.reduce((n,url)=>n+Buffer.byteLength(bundle[url].source),0);
        for(const tier of Object.values(tiers)){
          tier.manifest=config.base+name;
          tier.ground=groundURLs.map(url=>config.base+url);
          tier.groundBytes=groundBytes;
          tier.groundGPUBytes=ground.strokeMaskGPUBytes??0;
          for(const view of tier.views){view.sheetBytes=view.bytes;view.bytes+=groundBytes;}
        }
        for(const [dpr,tier]of Object.entries(tiers))for(const view of tier.views){
          const own=svg.own.filter(e=>e.theme===theme);
          const groundGPUBytes=ground.strokeMaskGPUBytes??0;
          const plan=planIslandArt(own,{dpr:Number(dpr),defaultZoom:view.zoom,budget:ISLAND_ART_BUDGET-groundGPUBytes});
          const landing=new Set(view.webp),pieces=[];
          for(const [src,r]of plan.resolutions){
            const e=manifest[src];if(!e||!svg.pieces[src])continue;
            const scale=r,padding=e.padding??0;
            pieces.push({drawing:svg.pieces[src].drawing,viewBox:svg.pieces[src].viewBox,src,w:e.w,h:e.h,scale,padding,ground:padding>0,
              f:textureFootprint(src,scale,padding,{[src]:[e.w,e.h]})});
          }
          // Main keeps its minimum densities even when a very wide viewport
          // exceeds the nominal allowance. Retain that same floor and zoom
          // range, while reporting the excess instead of silently capping zoom.
          const detailBudget=Math.max(plan.budget,plan.bytes);
          let sheets=[],gpuBytes=Infinity;
          try{sheets=packDetailFrames(pieces,2048,detailBudget);gpuBytes=detailSheetBytes(sheets);}catch{}
          const source=JSON.stringify({sheets}),file=`${DIRECTORY}/svg-plan-${hash(source)}.json`;
          this.emitFile({type:'asset',fileName:file,source});
          const landingGPU=new Map();
          for(const e of Object.values(manifest))for(const t of e.tiers)if(landing.has(t.sheet??t.url))
            landingGPU.set(t.sheet??t.url,(t.sheetWidth??t.width)*(t.sheetHeight??t.height)*4*(e.padding?1:4/3));
          view.landingGPUBytes=groundGPUBytes+[...landingGPU.values()].reduce((a,b)=>a+b,0);
          view.rasterDetail={plan:config.base+file,
            gpuBytes:Number.isFinite(gpuBytes)?gpuBytes+groundGPUBytes:null,propsGPUBytes:Number.isFinite(gpuBytes)?gpuBytes:null,groundGPUBytes,
            budget:detailBudget+groundGPUBytes,exceedsNominalBudget:gpuBytes>plan.budget+1e-6,
            overBudget:gpuBytes>detailBudget+1e-6};
          let planBytes=Buffer.byteLength(source);
          if(view.rasterDetail.overBudget)throw Error(`Detail sheets exceed budget: ${id} DPR ${dpr} zoom ${view.zoom}`);
          {
            const raster=await prerenderDetailSheets(sheets,{root:config.publicDir,output:path.resolve(config.root,config.build.outDir),base:config.base,cache:detailCache,previous:previousDetail,artCache,
              emit:(fileName,source)=>this.emitFile({type:'asset',fileName,source})});
            view.rasterDetail={...view.rasterDetail,...raster,kind:'webp'};
            if(raster.rasterPack){
              // Keep hundreds of content hashes out of the startup island index.
              const packedPlan=JSON.stringify({sheets,raster:raster.raster}),packedFile=`${DIRECTORY}/svg-plan-${hash(packedPlan)}.json`;
              this.emitFile({type:'asset',fileName:packedFile,source:packedPlan});
              view.rasterDetail.plan=config.base+packedFile;delete view.rasterDetail.raster;planBytes=Buffer.byteLength(packedPlan);
            }
            config.logger.info(`Detail ${id} DPR ${dpr} zoom ${view.zoom}: ${raster.rasterBytes} bytes, ${raster.raster.length} sheets`);
          }
          view.detail=[];view.detailBytes=view.rasterDetail.rasterBytes+planBytes;view.detailSharpZoom=1.8;
        }
      }
      if(artCache)config.logger.info(`Detail artwork cache: ${detailCache.reused??0} sheets reused, ${detailCache.rendered??0} rendered`);
      const {json,fileName}=serializeIslandIndex(index);
      this.emitFile({type:'asset',fileName,source:json});
      this.emitFile({type:'asset',fileName:`${DIRECTORY}/islands.json`,source:JSON.stringify({url:config.base+fileName})});
      islandsURL=config.base+fileName;
      const headers=bundle['_headers'];
      const text=String(headers?.source??await readFile(path.join(config.publicDir,'_headers'),'utf8').catch(error=>{if(error.code==='ENOENT')return '';throw error;}));
      const source=text+'\n/art-prerender/islands.json\n  ! Cache-Control\n  Cache-Control: no-cache\n';
      if(headers)headers.source=source;else this.emitFile({type:'asset',fileName:'_headers',source});
      for(const [id,island]of Object.entries(index.islands))for(const [dpr,tier]of Object.entries(island)){
        const landing=selectIslandTier(index,id,Number(dpr),1440,900);
        config.logger.info(`Island ${id} DPR ${dpr}: ${landing.webp.length} landing files, zoom ${landing.zoom}, sharp limit ${landing.sharpZoom.toFixed(3)}, landing ${landing.bytes} bytes, detail ${landing.detailBytes} bytes, detail sharp limit ${landing.detailSharpZoom.toFixed(3)}`);
      }
    },
    async writeBundle() {await artCache?.prune();},
    transform(code, id) {
      if(id.endsWith('/world/prop-outlines/bog-scene.js'))return {code:lazyPinkScene(code,bogURL),map:null};
      if(id.endsWith('/world/prop-outlines/snow-scene.js'))return {code:lazyPinkScene(code,snowURL),map:null};
      if(id.endsWith('/world/prop-outlines/library-scene.js'))return {code:lazyPinkScene(code,libraryURL),map:null};
      if(id.endsWith('/world/prop-outlines/community-scene.js'))return {code:lazyPinkScene(code,communityURL),map:null};
      if(id.endsWith('/world/prop-outlines/pink-scene.js'))return {code:lazyPinkScene(code,pinkURL),map:null};
      if(id.endsWith('/world/home/placements.js'))return {code:indexHomeGeometry(code),map:null};
      if(id.endsWith('/app/home-head-start.js'))return {code:code.replaceAll('__HOME_SCENE_URL__',JSON.stringify(homeURL)),map:null};
      if(id.endsWith('/world/home/startup-scene.js'))return {code:`import {headStartJSON,headStartScene,homeHeadStartActive} from '../../app/home-head-start.js';import {arrivalPending} from '../../app/arrival.js';const get=()=>(async()=>{return headStartJSON(${JSON.stringify(homeURL)});})().catch(error=>{pending=undefined;throw error;});let pending=homeHeadStartActive()||arrivalPending()?undefined:get();export const homeSceneData=()=>pending??=get();export async function loadHomeScene(room){const scene=await headStartScene(${JSON.stringify(homeURL)},room);scene.beds.bad=scene.dropped;return scene;}`,map:null};
      if (id.endsWith('/art/whole-svg-loader.js')) return {code: code.replaceAll('__PRERENDER_ART_MANIFEST__', JSON.stringify(manifestURL)), map: null};
      if(id.endsWith('/assets/world/walk-world.json'))return shareHomeWalkOutlines(config.root,id);
    },
  };
}

export function lazyPinkScene(code,url){
  const deferred=code.replace(/(?:const|let|var)\s+readPacked\s*=\s*async\s*\(\s*\)\s*=>\s*packed\s*;?/,`const readPacked=async signal=>{const response=await fetch(${JSON.stringify(url)},{signal});if(!response.ok)throw Error('Island layout unavailable (HTTP '+response.status+')');return response.json();};`);
  if(deferred===code)throw Error('Rosybutton scene loader transform did not match');
  return deferred.replace(/import\s+packed\s+from\s+[^;]+;/,'const packed=null;');
}

export function serializeIslandIndex(index){
  const json=JSON.stringify(index);
  return {json,fileName:`${DIRECTORY}/islands-${hash(json)}.json`};
}

// Ground and rig sheets preserve decoded pixels. Prop groups opt into
// quality-92 WebP, with opaque edge extrusion around every frame.
export async function packArtSheets(pieces, limit=4096, {lossless=true,quality=92}={}) {
  const sharp=require('sharp');
  const frames=[],images=new Map();
  for(const piece of pieces){
    const {entry,tier}=piece,pad=entry.padding??0;
    const f=textureFootprint(piece.src,tier.scale,pad,{[piece.src]:[entry.w,entry.h]});
    if(f.width+4>limit||f.height+4>limit){piece.tier.atlasFallback='oversized';piece.tier.sheetLimit=limit;continue;}
    const image=await sharp(piece.bytes).extract({left:f.x,top:f.y,width:f.width,height:f.height})
      .extend({top:2,bottom:2,left:2,right:2,extendWith:'copy'}).png().toBuffer();
    const frame={piece,width:f.width,height:f.height,offsetX:f.x,offsetY:f.y,image,aliases:[]};
    const digest=hash(image),same=images.get(digest);
    if(same){delete frame.image;same.aliases.push(frame);}
    else{images.set(digest,frame);frames.push(frame);}
  }
  frames.sort((a,b)=>Math.max(b.width,b.height)-Math.max(a.width,a.height)||b.width*b.height-a.width*a.height);
  // Least leftover area alone can stack equal frames down one narrow column and
  // leave most of the sheet empty (16 cap frames took 4008x3856). Also try the
  // rectangle that grows the sheet least, and keep whichever has fewer texels.
  const place=tight=>{
    const sheets=[];
    for(const frame of frames){
      const w=frame.width+4,h=frame.height+4;
      let best;
      for(const sheet of sheets)for(const [i,r]of sheet.free.entries())if(w<=r.w&&h<=r.h){
        const score=r.w*r.h-w*h,growth=tight?Math.max(sheet.width,r.x+w)*Math.max(sheet.height,r.y+h)-sheet.width*sheet.height:0;
        if(!best||growth<best.growth||growth===best.growth&&score<best.score)best={sheet,i,r,score,growth};
      }
      if(!best){const sheet={free:[{x:0,y:0,w:limit,h:limit}],frames:[],width:0,height:0};sheets.push(sheet);best={sheet,i:0,r:sheet.free[0]};}
      const {sheet,i,r}=best;sheet.free.splice(i,1);
      // Guillotine split, retaining disjoint free rectangles.
      if(r.w-w>r.h-h){
        if(r.w>w)sheet.free.push({x:r.x+w,y:r.y,w:r.w-w,h:r.h});
        if(r.h>h)sheet.free.push({x:r.x,y:r.y+h,w,h:r.h-h});
      }else{
        if(r.w>w)sheet.free.push({x:r.x+w,y:r.y,w:r.w-w,h});
        if(r.h>h)sheet.free.push({x:r.x,y:r.y+h,w:r.w,h:r.h-h});
      }
      sheet.frames.push({frame,x:r.x+2,y:r.y+2});
      sheet.width=Math.max(sheet.width,r.x+w);sheet.height=Math.max(sheet.height,r.y+h);
    }
    return sheets;
  };
  const texels=list=>list.reduce((n,s)=>n+s.width*s.height,0);
  const loose=place(false),tight=place(true),sheets=texels(tight)<texels(loose)?tight:loose;
  for(const sheet of sheets)sheet.frames=sheet.frames.map(({frame,x,y})=>Object.assign(frame,{x,y}));
  for(const sheet of sheets){
    const pixels=Buffer.alloc(sheet.width*sheet.height*4);
    for(const f of sheet.frames){
      const raw=await sharp(f.image).ensureAlpha().raw().toBuffer(),w=f.width+4;
      for(let y=0;y<f.height+4;y++)raw.copy(pixels,((f.y-2+y)*sheet.width+f.x-2)*4,y*w*4,(y+1)*w*4);
    }
    sheet.bytes=await sharp(pixels,{raw:{width:sheet.width,height:sheet.height,channels:4}})
      .webp({lossless,quality,alphaQuality:100,effort:4}).toBuffer();
    sheet.lossless=lossless;
    delete sheet.free;
    for(const f of [...sheet.frames]){
      delete f.image;
      for(const alias of f.aliases){alias.x=f.x;alias.y=f.y;delete alias.aliases;sheet.frames.push(alias);}
      delete f.aliases;
    }
  }
  return sheets;
}

export function buildIslandIndex(entries,manifest,entryURL,sheetBytes=new Map()) {
  const islands={};
  for(const island of entries.islands??[{id:'home',theme:'home'}]){
    islands[island.id]={};
    const placed=entries.filter(e=>e.theme===island.theme||!e.theme||e.theme==='shared'||e.theme==='startup');
    for(const dpr of [1,2,3]){
      const own=placed.filter(e=>e.theme===island.theme);
      const shared=planIslandArt(placed.filter(e=>e.theme!==island.theme),{dpr});
      const ratioFor=e=>{
        const source=manifest[e.src];
        return source&&e.width&&e.height?Math.max((e.width+(e.bleed??0))/source.w,(e.height+(e.bleed??0))/source.h)*(e.scale??1):0;
      };
      const ratios=new Map();
      for(const e of own)ratios.set(e.src,Math.max(ratios.get(e.src)??0,ratioFor(e)));
      const urlsFor=plan=>{
        const selected=plannedSheetTiers.get(manifest),webp=new Set();
        for(const [src]of plan.resolutions){const t=selected?.get(src);if(t)webp.add(t.sheet??t.url);}
        return [...webp];
      };
      const plans=[];
      const views=[.06,.08,.1,.12,.16,.2,.26,.32,.39,.5,.65,.72,.784,.9,1.08,1.44,1.8].map(zoom=>{
        const baseline=planIslandArt(own,{dpr,defaultZoom:zoom});
        for(const [src,r]of shared.resolutions)baseline.resolutions.set(src,Math.max(r,baseline.resolutions.get(src)??0));
        const mainSelected=new Map(baseline.resolutions);
        const detailPlan=planIslandSheets(baseline,manifest);
        // Unlike the legacy density budget, landing never undersamples even
        // ground. The camera stays within this set's actual texel limit.
        const resolutions=new Map(baseline.resolutions);
        for(const [src,ratio]of ratios)if(ratio)resolutions.set(src,ratio*zoom*dpr*2);
        const plan=planIslandSheets({...baseline,resolutions},manifest);
        const webp=urlsFor(plan),selected=new Map(plannedSheetTiers.get(manifest));
        plans.push({landing:selected,main:mainSelected});
        let sharpZoom=Infinity;
        for(const [src,ratio]of ratios)if(ratio){
          const t=selected.get(src);
          sharpZoom=Math.min(sharpZoom,(t?.scale??0)/ratio/dpr);
        }
        // Detail must never replace a landing piece with a lower density.
        const detailResolutions=new Map(detailPlan.resolutions);
        for(const [src,r]of plan.resolutions)detailResolutions.set(src,Math.max(r,detailResolutions.get(src)??0));
        // Landing's 1:1 target can exceed main's accepted close-view density.
        // The emitted top tier covers main (addMainDetailTiers); use it instead
        // of requesting an unsupported landing oversample via SVG fallback.
        for(const [src,r]of detailResolutions){
          const highest=Math.max(...(manifest[src]?.tiers.map(t=>t.scale)??[]));
          if(highest>0)detailResolutions.set(src,Math.min(r,highest));
        }
        const finalDetail=planIslandSheets({...baseline,resolutions:detailResolutions},manifest);
        const detail=urlsFor(finalDetail);
        const detailSelected=plannedSheetTiers.get(manifest);
        let detailSharpZoom=Infinity;
        for(const [src,ratio]of ratios)if(ratio)detailSharpZoom=Math.min(detailSharpZoom,(detailSelected.get(src)?.scale??0)/ratio/dpr);
        const bytes=urls=>urls.reduce((n,u)=>n+(sheetBytes.get(u)??0),0);
        return {zoom,sharpZoom,webp,bytes:bytes(webp),detail,detailBytes:bytes(detail),detailSharpZoom};
      });
      // A piece already matching main may stretch exactly as main does. Only
      // lower-detail pieces need a 1:1 constraint. Each viewport's main plan
      // has its own limit because its texture budget can select different tiers.
      views.forEach((view,i)=>{view.limits=plans.map(({main})=>{
        let limit=1.8;
        for(const [src,ratio]of ratios)if(ratio){
          const low=plans[i].landing.get(src),high=main.get(src);
          if(!low){limit=0;break;}
          if(high&&low.scale+1e-10<high)limit=Math.min(limit,low.scale/ratio/dpr);
        }
        return limit;
      });});
      islands[island.id][dpr]={webp:views.find(v=>v.zoom===.65).webp,views};
    }
  }
  return {version:2,entry:entryURL,islands};
}

// The page code carried the Home walk outlines (5.7 MB) although the Home scene
// file it always fetches holds the same outlines. Read them from that file.
// The page code waits for it, so every reader still sees the complete data.
// Only done when both copies are equal, value for value.
export async function shareHomeWalkOutlines(root,id) {
  const walk=JSON.parse(await readFile(id,'utf8')),scene=JSON.parse(JSON.stringify(await bakeHomeScene(root)));
  if(!Array.isArray(walk.obstacles)||JSON.stringify(walk.obstacles)!==JSON.stringify(scene.room.walk.obstacles))return;
  const home=path.join(root,'src/world/home/');
  return {code:`import {homeSceneData} from ${JSON.stringify(home+'startup-scene.js')};import {unpackHomeScene} from ${JSON.stringify(home+'scene-pack.js')};
const obstacles=[],fill=data=>{if(!obstacles.length)obstacles.push(...unpackHomeScene(data,'room').walk.obstacles);};
try{fill(await homeSceneData());}catch{homeSceneData().then(fill,()=>{});}
export default {${Object.entries(walk).map(([key,value])=>JSON.stringify(key)+':'+(key==='obstacles'?'obstacles':JSON.stringify(value))).join(',')}};`,map:null};
}

// Evaluate the same dev/test implementation once in Node, before bundling.
export async function bakeHomeScene(root) {
  const result=await require('esbuild').build({stdin:{resolveDir:root,contents:`
    import {computeHomeScene} from './src/world/home/startup-scene.js';
    export const data={solo:computeHomeScene(false),room:computeHomeScene(true)};
  `},bundle:true,platform:'node',format:'esm',write:false});
  const module=await nativeImport('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
  return module.data;
}

export function indexHomeGeometry(code) {
  code="import {segmentGrid} from './segment-grid.js';\n"+code;
  code=code.replaceAll("const reviewPathClear = (x,y,pad=0) => !homeRoutes.some(r => r.samples.slice(1).some((b,i)=>segDist(x,y,r.samples[i],b)<r.width/2+pad));\nconst pathDist = (x, y) => Math.min(...footpaths.flatMap(l => l.slice(1).map((b, i) => segDist(x, y, l[i], b))));\n","const routeDist=segmentGrid(homeRoutes.flatMap(r=>r.samples.slice(1).map((b,i)=>({a:r.samples[i],b,radius:r.width/2}))));\nconst reviewPathClear = (x,y,pad=0) => routeDist(x,y)>=pad;\nconst pathDist=segmentGrid(footpaths.flatMap(l=>l.slice(1).map((b,i)=>({a:l[i],b}))));\n");
  code=code.replaceAll("  const coast = world.coast, coastDist = (x, y) => Math.min(...coast.map((a, i) => segDist(x, y, a, coast[(i + 1) % coast.length])));\n","  const coast = world.coast, coastDist = segmentGrid(coast.map((a,i)=>({a,b:coast[(i+1)%coast.length]})));\n");
  code=code.replaceAll("    pathDist: (x,y) => Math.min(...homeRoutes.map(r => Math.min(...r.samples.slice(1).map((b,i) => segDist(x,y,r.samples[i],b))) - r.width/2)),\n","    pathDist: routeDist,\n");
  return code;
}
