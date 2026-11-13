import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {build} from 'esbuild';
import {planIslandArt,ISLAND_ART_BUDGET} from '../src/rendering/pixi/art/island-budget.js';
import sizes from '../src/rendering/shared/art-source-sizes.json' with {type:'json'};
import {createGroundPool} from '../src/rendering/pixi/art/ground-stream.js';
import {Container,ImageSource,Sprite,Texture} from 'pixi.js';
import {loadThemeArt} from '../src/rendering/pixi/art/theme-art.js';
const MiB=1048576;
const entry=`
import raw from './assets/world/world.json';
import art from './src/world/home/art-manifest.json';
import {geometry} from './assets/world/island-geometry.mjs';
import {createPlacements,homeDecals,trimWorld,HOME_TILES,HOME_DECKS,HOME_GROUND_DECALS,JETTIES} from './src/world/home/placements.js';
const world=trimWorld(raw),props=createPlacements(world,geometry({...world,obstacles:[]}).walkable);
export const tiles=HOME_TILES;
export const entries=[...JETTIES,{src:'/pixi-art/library-steps.svg',width:280,height:260,resolution:1.5},...HOME_DECKS,...props,...art.floating,{src:'/pixi-art/water-texture.svg'},
{src:'/pixi-art/lake-race.svg',width:1500,height:950,resolution:1},{src:'/pixi-art/decals/plaza-paving.svg',width:980,height:780,resolution:1},...homeDecals(props).map(d=>({...d,resolution:2.5})),...HOME_GROUND_DECALS.map(d=>({...d,resolution:2.5}))];`;
const bundled=await build({stdin:{contents:entry,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false});
const home=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const cost=(size,r,mipmaps)=>(Math.ceil(size[0]*r)+(mipmaps?0:4))*(Math.ceil(size[1]*r)+(mipmaps?0:4))*4*(mipmaps?4/3:1);

test('Home preparation holds one fixed resolution per source and fits the 340 MiB total allowance at 1440x900@2x',async()=>{
 const entries=[...home.entries,...home.tiles.map(t=>({...t,mipmaps:false}))];
 for(const e of entries)assert(sizes[e.src],`budget needs native dimensions for ${e.src}`);
 const plan=planIslandArt(entries,{dpr:2});
 let actual=0;const requested=new Set();
 const acquire=async(src,r)=>{
   assert(!requested.has(src));requested.add(src);
   const size=sizes[src];actual+=cost(size,r,home.entries.some(e=>e.src===src));
   return new Texture({source:new ImageSource({width:size[0],height:size[1],resolution:r})});
 };
 const root=new Container(),pool=createGroundPool({acquire,release(){}}),stream=pool.create(home.tiles,root);
 // Props and ground use the same island-wide plan, including repeated sources.
 for(const src of new Set(home.entries.map(e=>e.src)))await acquire(src,plan.resolutions.get(src));
 await stream.prepare({dpr:2,resolutions:plan.resolutions});
 assert(actual<=ISLAND_ART_BUDGET,`Home island art ${(actual/MiB).toFixed(1)} MiB`);
 assert(actual+100*MiB<=340*MiB,'100 MiB reserved for rigs, water, effects and the runtime boat atlas');
 const before=requested.size;
 for(const zoom of [.25,.7,1,1.8,.7])pool.update([{stream,camera:{x:3000,y:2000,zoom},width:1440,height:900}],2,true);
 assert.equal(requested.size,before);
 stream.destroy();pool.destroy();root.destroy();
});

test('biggest themed-island preparation uses whole pictures within the same memory allowance',async t=>{
 const old=globalThis.fetch;t.after(()=>globalThis.fetch=old);
 const manifests=readdirSync('public/pixi-art/themes').flatMap(id=>{
   try{return [{id,art:JSON.parse(readFileSync(`public/pixi-art/themes/${id}/art.json`))}];}catch{return [];}
 });
 // Exercise every manifest, including the largest island, through the real loader.
 for(const {id,art} of manifests){
  globalThis.fetch=async src=>({ok:true,json:async()=>src.endsWith('/art.json')?art:{pieces:[]}});
  const resolutions=new Map();let actual=0;
  const acquire=async(src,r=1)=>{
   assert(!src.includes('rasterCrop='),'prepared scenes never subdivide art');
   if(resolutions.has(src)){assert.equal(r,resolutions.get(src));return Texture.EMPTY;}
   resolutions.set(src,r);
   const size=sizes[src]??[512,512];actual+=cost(size,r,!(art.ground?.tiles??[]).some(e=>(e.src.startsWith('/')?e.src:`/pixi-art/themes/${id}/${e.src}`)===src));
   return Texture.EMPTY;
  };
  const pool=createGroundPool({acquire,release(){}});
  const loaded=await loadThemeArt({id,art:`/pixi-art/themes/${id}/art.json`,origin:{x:0,y:0},width:11000,height:10000},{groundPool:pool,acquire,release(){},prepare:true,dpr:2});
  for(const src of loaded.artPlan.resolutions.keys())assert(sizes[src],`${id}: native dimensions required for ${src}`);
  assert(actual+90*MiB<=340*MiB,`${id}: ${(actual/MiB).toFixed(1)} MiB plus shared allowance`);
  assert(loaded.props.every(p=>p.sprite instanceof Sprite),'prepared props are whole-picture Sprites');
  assert(!loaded.rasterPool);
  loaded.destroy();pool.destroy();
 }
});

test('device density changes the fixed plan, while a generous budget avoids needless downsampling',()=>{
 const entries=[{src:'art.svg',width:100,height:50,resolution:4}],sourceSizes={'art.svg':[400,200]};
 const a=planIslandArt(entries,{dpr:1,sourceSizes}),b=planIslandArt(entries,{dpr:2,sourceSizes});
 assert.equal(a.resolutions.get('art.svg'),.45);assert.equal(b.resolutions.get('art.svg'),.9);
});
