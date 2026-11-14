import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {bakeHomeScene} from '../scripts/vite-prerender-art.mjs';
import {segmentGrid} from '../src/world/home/segment-grid.js';
import {createManifestParts} from '../src/rendering/pixi/art/manifest-parts.js';
import {preparationFrame,markArtActivity} from '../src/rendering/pixi/art/island-preparation.js';

test('baked Home props, decals, beds and walk data equal the runtime computation exactly',async()=>{
 const baked=JSON.parse(JSON.stringify(await bakeHomeScene(process.cwd())));
 const code=await build({stdin:{resolveDir:process.cwd(),contents:`
 import raw from './assets/world/world.json';
 import {createPlacements,homeDecals,HOME_GROUND_DECALS,trimWorld,walkWorld,sleepSpots,sleeperFootprint} from './src/world/home/placements.js';
 import {harborClear,harborWorld} from './src/gameplay/islands.js';
 import {geometry} from './assets/world/island-geometry.mjs';
 import {sleepHalfWidths} from './src/rendering/pixi/environment/sleeper.js';
 export const scenes=[false,true].map(room=>{
 const props=createPlacements().filter(p=>!room||harborClear(p));
 const local=room?harborWorld(walkWorld(trimWorld(raw),props)):walkWorld(trimWorld(raw),props);
 const beds=sleepSpots(local,props,geometry(local).walkable,sleepHalfWidths(.88*.24*3));
 return {props,beds,dropped:beds.bad,decals:homeDecals(props),groundDecals:HOME_GROUND_DECALS,walk:{...local,obstacles:[...local.obstacles,...beds.map(sleeperFootprint)]}};
 });`},bundle:true,platform:'node',format:'esm',write:false});
 const {scenes}=await import('data:text/javascript;base64,'+Buffer.from(code.outputFiles[0].text).toString('base64'));
 assert.deepEqual(baked.solo.props,scenes[0].props);
 assert.deepEqual(baked.room.props,scenes[1].props);
 assert.deepEqual(baked.solo,JSON.parse(JSON.stringify(scenes[0])));
 assert.deepEqual(baked.room,JSON.parse(JSON.stringify(scenes[1])));
 if(process.env.ART_MANIFEST){
  const {readdir}=await import('node:fs/promises');
  const name=(await readdir('dist/art-prerender')).find(n=>/^home-.*json$/.test(n));
  assert.deepEqual(JSON.parse(await readFile('dist/art-prerender/'+name)),baked);
 }
});

test('spatial queries match exhaustive segment distance including route widths and outside points',()=>{
 const segments=Array.from({length:120},(_,i)=>({a:[i*17%831,i*29%643],b:[(i*17+140)%831,(i*29+90)%643],radius:i%31}));
 const grid=segmentGrid(segments,96);
 for(let i=0;i<600;i++){
  const x=(i*137%2300)-600,y=(i*97%1900)-500;
  const expected=Math.min(...segments.map(({a,b,radius})=>{
   const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));
   return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)-radius;
  }));assert.equal(grid(x,y),expected);
 }
 assert.equal(segmentGrid([])(0,0),Infinity);
});

test('manifest shards fetch together, dedupe, retry, and preserve the planning object',async()=>{
 const calls=[],finish=[];let fail=true;
 const read=createManifestParts('/catalog',{fetchJSON:async url=>{
  calls.push(url);if(url==='/catalog')return {parts:{'/a/':'/part-a','/b/':'/part-b'}};
  if(url==='/bad'&&fail){fail=false;throw Error('retry');}
  return new Promise(resolve=>finish.push(()=>resolve({[url]:{tiers:[]}})));
 }});
 const first=read(['/a/a.svg','/b/b.svg']);
 while(finish.length<2)await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(calls,['/catalog','/part-a','/part-b']);finish.splice(0).forEach(f=>f());
 const manifest=await first;assert.equal(await read(['/a/z.svg']),manifest);assert.equal(calls.length,3);
 await assert.rejects(read([],'/bad'),/retry/);
 const retry=read([],'/bad');finish.splice(0).forEach(f=>f());assert.equal(await retry,manifest);
});

test('readiness frames progress during continuous input activity',async t=>{
 const previous=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=fn=>fn();
 t.after(()=>{globalThis.requestAnimationFrame=previous;});
 markArtActivity(10000);await preparationFrame();markArtActivity(0);
});

test('production spatial transform keeps authored placements and runtime ground queries unchanged',async()=>{
 const {indexHomeGeometry}=await import('../scripts/vite-prerender-art.mjs');
 const original=await readFile('src/world/home/placements.js','utf8'),indexed=indexHomeGeometry(original);
 assert(!indexed.includes('Math.min(...footpaths'));
 assert(!indexed.includes('Math.min(...coast.map'));
 const compile=async optimize=>{
  const bundle=await build({stdin:{resolveDir:process.cwd(),contents:`
    import {createPlacements,homeDecals,groundAt,trimWorld} from './src/world/home/placements.js';
    import raw from './assets/world/world.json';
    const props=createPlacements();export const result={props,decals:homeDecals(props),
      ground:Array.from({length:600},(_,i)=>groundAt((i*137)%6000,(i*97)%4500,trimWorld(raw)))};
  `},bundle:true,platform:'node',format:'esm',write:false,
  plugins:optimize?[{name:'index-test',setup(build){build.onLoad({filter:/world\/home\/placements\.js$/},()=>({contents:indexed,loader:'js'}));}}]:[]});
  return (await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))).result;
 };
 assert.deepEqual(await compile(true),await compile(false));
});

test('baked foliage colour avoids refetching and reparsing a tree SVG during reveal',async()=>{
 const {createFoliagePalette}=await import('../src/rendering/pixi/environment/foliage-palette.js');
 let reads=0;
 const load=createFoliagePalette({getBaked:async src=>{reads++;assert.equal(src,'/tree.svg');return 0x315c32;},createWorker:()=>assert.fail('baked canopy needs no worker fetch')});
 assert.equal(await load('/tree.svg'),0x315c32);
 assert.equal(await load('/tree.svg'),0x315c32);assert.equal(reads,1);
});

test('built manifests retain exact foliage colours and omit AVIF assets',async t=>{
 if(!process.env.ART_MANIFEST)return t.skip('requires the production manifest');
 const {foliageColour}=await import('../src/rendering/pixi/environment/plant-contact.js');
 const {readdir}=await import('node:fs/promises');
 const manifest=JSON.parse(await readFile(process.env.ART_MANIFEST));
 const trees=Object.keys(manifest).filter(src=>/tree/i.test(src)).slice(0,8);
 assert(trees.length);
 for(const src of trees)assert.equal(manifest[src].foliageColour,foliageColour(await readFile('public'+src,'utf8')));
 assert(Object.values(manifest).every(e=>e.tiers.every(t=>!t.avif)));
 assert(!(await readdir('dist/art-prerender')).some(n=>n.endsWith('.avif')));
});
