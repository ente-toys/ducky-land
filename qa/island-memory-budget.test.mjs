import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planIslandArt,ISLAND_ART_BUDGET,SHARED_TEXTURE_ALLOWANCE} from '../src/rendering/pixi/art/island-budget.js';
import {textureFootprint} from '../src/rendering/pixi/art/texture-footprint.js';
import {createWholeSVGLoader} from '../src/rendering/pixi/art/whole-svg-loader.js';
import {DOMAdapter} from 'pixi.js';
import {createCanvas} from '@napi-rs/canvas';
import sizes from '../src/rendering/shared/art-source-sizes.json' with {type:'json'};
import {createGroundPool} from '../src/rendering/pixi/art/ground-stream.js';
import {Container,Sprite} from 'pixi.js';
import {loadThemeArt} from '../src/rendering/pixi/art/theme-art.js';
const MiB=1048576;
import {home} from './island-art-fixtures.mjs';
DOMAdapter.set({...DOMAdapter.get(),createCanvas});
const loader=createWholeSVGLoader({canDecodeBitmap:()=>true,
 getManifest:async()=>Object.fromEntries(Object.entries(sizes).map(([src,[w,h]])=>[src,{w,h,padding:2,tiers:[{scale:100,url:src,width:w*100,height:h*100}]}])),
 fetchBlob:async()=>new Blob(),
 decode:async()=>createCanvas(64,64),
 decodeBitmap:async(blob,o)=>({width:o.resizeWidth??o.crop[2],height:o.resizeHeight??o.crop[3],close(){}}),
});
const load=(src,r,mipmaps)=>loader.load(src,{src,data:{resolution:r,...(mipmaps?{autoGenerateMipmaps:true}:{groundPadding:2})}});

test('Home preparation holds one fixed resolution per source and fits the 350 MiB total allowance at default walking zoom on DPR 2',async()=>{
 const entries=[...home.entries,...home.tiles.map(t=>({...t,mipmaps:false}))];
 for(const e of entries)assert(sizes[e.src],`budget needs native dimensions for ${e.src}`);
 const plan=planIslandArt(entries,{dpr:2});
 let actual=0;const requested=new Set();
 const acquire=async(src,r)=>{
   assert(!requested.has(src));requested.add(src);
   const mipmaps=home.entries.some(e=>e.src===src),texture=await load(src,r,mipmaps);
   actual+=texture.source.pixelWidth*texture.source.pixelHeight*4*(mipmaps?4/3:1);
   return texture;
 };
 const root=new Container(),pool=createGroundPool({acquire,release(){}}),stream=pool.create(home.tiles,root);
 // Props and ground use the same island-wide plan, including repeated sources.
 for(const src of new Set(home.entries.map(e=>e.src)))await acquire(src,plan.resolutions.get(src));
 await stream.prepare({dpr:2,resolutions:plan.resolutions});
 assert(actual<=ISLAND_ART_BUDGET,`Home island art ${(actual/MiB).toFixed(1)} MiB`);
 assert(Math.abs(actual-plan.bytes)<1e-6);
 assert(actual+SHARED_TEXTURE_ALLOWANCE<=350*MiB,'100 MiB reserved for rigs, water, effects and the runtime boat atlas');
 const before=requested.size;
 for(const zoom of [.25,.7,1,1.8,.7])pool.update([{stream,camera:{x:3000,y:2000,zoom},width:1440,height:900}],2,true);
 assert.equal(requested.size,before);
 stream.destroy();pool.destroy();root.destroy();
});

test('biggest themed-island preparation uses whole pictures within the same memory allowance',async t=>{
 const old=globalThis.fetch;t.after(()=>globalThis.fetch=old);
 const manifests=[...new Set(home.WORLD_ISLANDS.map(i=>home.mapFor(i.theme??'home').art).filter(Boolean))].map(path=>({id:path.split('/')[3],path,art:JSON.parse(readFileSync('public'+path))}));
 // Exercise every manifest, including the largest island, through the real loader.
 for(const {id,art} of manifests){
  globalThis.fetch=async src=>({ok:true,json:async()=>src.endsWith('/art.json')?art:{pieces:[]}});
  const resolutions=new Map(),textures=new Map();let actual=0;
  const acquire=async(src,r=1)=>{
   assert(!src.includes('rasterCrop='),'prepared scenes never subdivide art');
   if(resolutions.has(src)){assert.equal(r,resolutions.get(src));return textures.get(src);}
   resolutions.set(src,r);
   const mipmaps=!(art.ground?.tiles??[]).some(e=>(e.src.startsWith('/')?e.src:`/pixi-art/themes/${id}/${e.src}`)===src);
   const texture=await load(src,r,mipmaps);
   if(sizes[src])actual+=texture.source.pixelWidth*texture.source.pixelHeight*4*(mipmaps?4/3:1);
   textures.set(src,texture);return texture;
  };
  const pool=createGroundPool({acquire,release(){}});
  const loaded=await loadThemeArt({id,art:`/pixi-art/themes/${id}/art.json`,origin:{x:0,y:0},width:11000,height:10000},{groundPool:pool,acquire,release(){},prepare:true,dpr:2});
  for(const src of loaded.artPlan.resolutions.keys())assert(sizes[src],`${id}: native dimensions required for ${src}`);
  assert(actual+SHARED_TEXTURE_ALLOWANCE<=350*MiB,`${id}: ${(actual/MiB).toFixed(1)} MiB plus shared allowance`);
  assert(loaded.props.every(p=>p.sprite instanceof Sprite),'prepared props are whole-picture Sprites');
  assert(!loaded.rasterPool);
  loaded.destroy();pool.destroy();
  for(const texture of textures.values())texture.destroy(true);
 }
});

test('device density changes the fixed plan, while a generous budget avoids needless downsampling',()=>{
 const entries=[{src:'art.svg',width:100,height:50,resolution:4}],sourceSizes={'art.svg':[400,200]};
 const a=planIslandArt(entries,{dpr:1,sourceSizes}),b=planIslandArt(entries,{dpr:2,sourceSizes});
 assert(Math.abs(a.resolutions.get('art.svg')-.45)<1e-10);assert(Math.abs(b.resolutions.get('art.svg')-.9)<1e-10);
});
