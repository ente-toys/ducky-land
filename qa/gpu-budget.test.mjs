import test from 'node:test';
import assert from 'node:assert/strict';
import {Texture,TextureSource,Sprite,Container} from 'pixi.js';
import sharp from 'sharp';
import {screenResolution,createResolutionBudget,MAX_CANVAS_PIXELS} from '../src/rendering/shared/resolution-budget.js';
import {createArtBudget} from '../src/rendering/pixi/art/art-budget.js';
import {createGroundPool,VIEW_POOL_OPTIONS,tileResolution} from '../src/rendering/pixi/art/ground-stream.js';
import {artResolution} from '../src/rendering/shared/art-resolution.js';
import {createManagedPoolBudget,managedTextureMemory} from '../src/rendering/pixi/texture-memory.js';
import {kiteArtEntries} from '../src/rendering/pixi/environment/home-kites.js';
import sizes from '../src/rendering/shared/art-source-sizes.json' with {type:'json'};
import {homeModel,entries} from './island-sharp-audit.mjs';
import {rasterTiles} from '../src/rendering/pixi/art/theme-raster.js';

const flush=()=>new Promise(setImmediate);
const texture=(width,height,r=1)=>new Texture({source:new TextureSource({width:Math.ceil(width*r)/r,height:Math.ceil(height*r)/r,resolution:r})});
const bytes=t=>Math.ceil(t.source.pixelWidth)*Math.ceil(t.source.pixelHeight)*4;

test('a busy crop pool borrows an idle peer allowance while every allocation obeys one total cap',()=>{
 const budget=createManagedPoolBudget(),a={},b={},root=new Container();budget.configure(100,100,1,2,root);
 const total=budget.limit,first=budget.reserve(100000,{owner:a}),second=budget.reserve(50000,{owner:b}),fixed=budget.reserve(20000,{kind:'static'});
 assert(first&&second&&fixed);
 assert(budget.allowanceFor(a)>budget.allowance,'an idle peer does not force visible crops below screen density');
 const borrowed=budget.reserve(200000,{owner:a});assert(borrowed);
 assert.equal(budget.limit,total);assert.equal(budget.reserve(total,{owner:b}),null,'borrowing never raises or bypasses the cap');
 for(const claim of [first,second,fixed,borrowed])budget.release(claim);
 assert.equal(budget.bytes,0);root.destroy();
});

test('layered visible crops grow the shared cap at DPR2 and free the previous view before allocation',async()=>{
 const budget=createManagedPoolBudget(),root=new Container(),owned=new Map();
 const pools=[0,1].map(i=>createGroundPool({...VIEW_POOL_OPTIONS,poolBudget:budget,
  acquire:async(key,r)=>{const t=texture(512,512,r);owned.set(key,t);return t;},
  release:key=>{owned.get(key)?.destroy(true);owned.delete(key);}}));
 const streams=pools.map((pool,i)=>pool.create(Array.from({length:i?18:36},(_,j)=>({src:`/layer-${i}-${j}.svg`,x:0,y:0,width:512,height:512,screenResolution:true,resolution:4})),root));
 const views=streams.map(stream=>({stream,camera:{x:256,y:256,zoom:.8},width:1512,height:827,tilt:1}));
 const plan=dpr=>{
  const need=pools.reduce((sum,pool)=>sum+pool.prepare(views,dpr),0);
  budget.configure(1512,827,dpr,2,root,0,false,need);
  pools.forEach(pool=>pool.update(views,dpr));return need;
 };
 try{
  plan(1);for(let i=0;i<20;i++)await flush();
  assert(budget.bytes<=150e6-32*1048576);
  const need=plan(2);assert(need>128*1048576,'fixture exceeds the old fixed shared cap');
  assert(budget.limit>=need);assert(budget.limit<=250e6-32*1048576);
  for(let i=0;i<30;i++)await flush();
  for(const stream of streams)for(const tile of stream.entries)assert(tile.sprite.texture.source.resolution>=tileResolution(tile,.8,2));
  for(const pool of pools){assert.equal(pool.stats().missingTiles,0);assert.equal(pool.stats().failedTiles,0);}
  assert(budget.bytes<=budget.limit);
  const stable=plan(2);assert.equal(stable,need,'unchanged views keep the same demand');
  // Cross-pool reclamation happens in prepare(), before the next pool reserves.
  assert.equal(pools[0].prepare([],2),0);assert.equal(pools[0].stats().reservedBytes,0);
  assert(owned.size===streams[1].entries.length,'only the still-visible peer remains allocated');
 }finally{pools.forEach(pool=>pool.destroy());root.destroy({children:true});}
 assert.equal(budget.bytes,0);assert.equal(owned.size,0);
});

test('GPU readback counts unique managed sources and exact mip levels',()=>{
 const a={pixelWidth:8,pixelHeight:4,mipLevelCount:4},b={pixelWidth:10,pixelHeight:10,mipLevelCount:1};
 const renderer={texture:{_managedTextures:{items:{a,alias:a,b,dead:{...b,destroyed:true}}}}};
 assert.deepEqual(managedTextureMemory(renderer),{count:2,bytes:(32+8+2+1+100)*4,MB:572/1e6,largestBytes:400});
});

test('shared admission reserves actual GPU bytes outside its ledger without counting pending CPU sources twice',()=>{
 const actor=new TextureSource({width:4096,height:3072}),art=new TextureSource({width:1024,height:1024});
 const renderer={texture:{_managedTextures:{items:{[actor.uid]:actor,[art.uid]:art}}}},budget=createManagedPoolBudget(renderer);
 try{
  budget.configure(1512,827,2);
  const claim=budget.reserve(1024*1024*4);assert(claim);assert(budget.commit(claim,art));
  const pending=budget.reserve(1024*1024*4);assert(pending);
  budget.configure(1512,827,2,1,undefined,16,false,240e6);
  assert.equal(budget.stats().outsideBytes,4096*3072*4,'actor source is outside; resident art and pending CPU art are not');
  assert.equal(budget.limit,250e6-4096*3072*4);
  budget.release(claim);budget.release(pending);
 }finally{actor.destroy();art.destroy();}
});

test('decodes pending across a larger view use the current allowance and never poison valid crops',async()=>{
 const budget=createManagedPoolBudget(),root=new Container(),jobs=[],owned=new Map();
 const pool=createGroundPool({...VIEW_POOL_OPTIONS,progressive:false,poolBudget:budget,
  acquire:(key,r)=>new Promise(resolve=>jobs.push(()=>{const t=texture(512,512,r);owned.set(key,t);resolve(t);})),
  release:key=>{owned.get(key)?.destroy(true);owned.delete(key);}});
 const stream=pool.create(Array.from({length:16},(_,i)=>({src:`/pending-${i}.svg`,x:i*512,y:0,width:512,height:512,screenResolution:true})),root);
 const plan=(x,width)=>{
  const views=[{stream,camera:{x,y:256,zoom:1},width,height:512}];
  const need=pool.prepare(views);budget.configure(width,512,1,1,root,0,false,need);pool.update(views);
 };
 try{
  plan(256,512);assert(jobs.length>0);const oldLimit=pool.stats().viewBudgetBytes;
  plan(4096,8192);assert(pool.stats().reservedBytes>oldLimit,'new requests exceed the old in-flight ceiling');
  for(let i=0;i<20;i++){jobs.splice(0).forEach(f=>f());await flush();}
  assert.equal(pool.stats().failedTiles,0);assert.equal(pool.stats().missingTiles,0);
  assert(stream.entries.every(tile=>tile.sprite.texture.source.resolution>=1));
 }finally{pool.destroy();root.destroy({children:true});}
 assert.equal(budget.bytes,0);assert.equal(owned.size,0);
});

test('a stationary pool replans a cap change deferred by its frame interval',async()=>{
 const budget=createManagedPoolBudget(),root=new Container(),owned=new Map();let time=0;
 const pool=createGroundPool({...VIEW_POOL_OPTIONS,progressive:false,planInterval:32,now:()=>time,poolBudget:budget,
  acquire:async(key,r)=>{const t=texture(512,512,r);owned.set(key,t);return t;},
  release:key=>{owned.get(key)?.destroy(true);owned.delete(key);}});
 const stream=pool.create(Array.from({length:16},(_,i)=>({src:`/interval-${i}.svg`,x:0,y:0,width:512,height:512,screenResolution:true})),root);
 const views=[{stream,camera:{x:256,y:256,zoom:1},width:512,height:512}];
 try{
  budget.configure(512,512,1);pool.update(views);for(let i=0;i<10;i++)await flush();
  assert(stream.entries.some(tile=>tile.sprite.texture.source.resolution<1));
  time=16;budget.configure(512,512,1,1,root,time,false,pool.prepare(views));pool.update(views);
  time=32;pool.update(views);for(let i=0;i<20;i++)await flush();
  assert(stream.entries.every(tile=>tile.sprite.texture.source.resolution>=1),'deferred growth is applied even though the camera is stationary');
  assert.equal(pool.stats().missingTiles,0);assert.equal(pool.stats().failedTiles,0);
 }finally{pool.destroy();root.destroy({children:true});}
 assert.equal(budget.bytes,0);assert.equal(owned.size,0);
});

test('screen pixels follow DPR and the 4K pixel cap; explicit resolution stays fixed',()=>{
 for(const [w,h,dpr] of [[1920,1080,1],[1366,768,1.25],[1512,827,2],[3840,2160,2]]){
  const r=screenResolution(w,h,dpr);assert(r<=dpr);assert(w*h*r*r<=MAX_CANVAS_PIXELS+.01);
 }
 assert.equal(screenResolution(1280,720,2),2);
 assert.equal(screenResolution(1512,827,2),2,'the boss laptop retains full DPR2');
 assert.equal(screenResolution(1920,1080,1),1);
 const fixed=createResolutionBudget({dpr:2,override:1.25});fixed.resize(4000,2000);
 for(let now=30;now<30000;now+=30)assert.equal(fixed.sample(now,30),1.25);
 assert.equal(fixed.resize(100,100,1),1.25);
 for(const dpr of [1,1.25,1.5])for(const zoom of [.1,.8,1.8]){
  const tile={width:100,height:100,screenResolution:true,screenLimited:true,resolution:4,rasterDensity:4};
  assert(tileResolution(tile,zoom,dpr)<=zoom*dpr*1.5);
 }
});

test('authored tile ceilings bound density only when they are below screen demand',()=>{
 const tile={src:'/native.svg',width:512,height:512,screenResolution:true,resolution:1};
 assert.equal(tileResolution(tile,.8,screenResolution(1512,827,2)),1);
 tile.resolution=4;
 assert(tileResolution(tile,.8,screenResolution(1512,827,2))>=1.6);
});

test('sustained p90 downshifts, ten-second fast hysteresis, pause rejection and DPR1 floor',()=>{
 const budget=createResolutionBudget({dpr:2});budget.resize(1280,720);
 let now=1;
 // GPU load shows as uneven frame times; a steady cadence is a frame-rate cap.
 const loaded=[17,20,25,30,34];
 const run=(duration,ms)=>{const end=now+duration;for(let i=0;now<end;i++){const d=ms==='load'?loaded[i%loaded.length]:ms;now+=d;budget.sample(now,d);}};
 run(2100,'load');assert.equal(budget.resolution,2,'one burst cannot lower resolution');
 run(2100,'load');assert.equal(budget.resolution,1.5);
 run(4100,'load');assert.equal(budget.resolution,1.25);
 run(4100,'load');assert.equal(budget.resolution,1);
 run(9500,8);assert.equal(budget.resolution,1,'never oscillates immediately after a downshift');
 run(5000,8);assert.equal(budget.resolution,1.25);
 budget.sample(now+30000,30000);assert.equal(budget.resolution,1.25);
 const normal=createResolutionBudget({dpr:1});normal.resize(1920,1080);
 for(let i=0,t=0;t<10000;i++){const d=loaded[i%loaded.length];t+=d;normal.sample(t,d);}
 assert.equal(normal.resolution,.75);
});

test('a steady 30 fps cap (battery saver) never lowers sharpness',()=>{
 const budget=createResolutionBudget({dpr:2});budget.resize(1512,827);
 for(let now=0;now<30000;now+=33.3)budget.sample(now,33.3);
 assert.equal(budget.resolution,2);
});

test('art density swaps the shared GPU source atomically without changing sprite layout',async()=>{
 const requests=[],released=[];
 const entry={src:'/pixi-art/lake-race.svg',width:1500,height:950,resolution:4};
 const bank=createArtBudget([entry],{zoom:.8,dpr:2,acquire:async(key,r)=>{requests.push(key);return texture(1500,950,r);},release:key=>released.push(key)});
 const t=await bank.acquire(entry),sprite=new Sprite(t);sprite.width=750;sprite.height=475;sprite.anchor.set(.5,1);
 const old=t.source;
 assert(t.source.resolution>=.8*2,'density buckets round up to screen demand');
 bank.update(.8,1,250);bank.update(.8,1,500);await flush();
 assert.notEqual(t.source,old);assert.equal(sprite.texture,t);assert.equal(sprite.width,750);assert.equal(sprite.height,475);
 assert.equal(sprite.anchor.x,.5);assert.equal(sprite.anchor.y,1);assert.equal(released.length,1);
 assert(t.source.resolution>=.8,'DPR1 never rounds below screen demand');
 const count=requests.length;
 for(let i=0;i<1000;i++)bank.update(.8,1,501+i*.1);
 assert.equal(requests.length,count,'stationary frames acquire nothing');
 assert(t.source.pixelWidth/750<=1.5*(.8*1500/750),'normal screen has bounded sampling');
 bank.destroy();bank.destroy();assert.equal(released.length,requests.length);sprite.destroy();
});

test('pending art swaps release after disposal and kites follow the normal-screen density',async()=>{
 const entries=kiteArtEntries(),released=[];let finish;
 const bank=createArtBudget(entries,{zoom:.8,dpr:1,acquire:(key,r)=>new Promise(resolve=>finish=()=>{
  const src=key.split('?')[0],size=sizes[src],entry=entries.find(e=>e.src===src);
  assert(r<=.8*1.5*entry.scale);resolve(texture(...size,r));
 }),release:key=>released.push(key)});
 const pending=bank.acquire(entries[0]);bank.destroy();finish();await pending;
 assert.equal(released.length,1,'late completion never retains a disposed GPU source');
});

test('view pools free off-screen and invisible-island sources, and retain no old versions',async()=>{
 const managed=new Map(),frames=[];let time=0;
 const pool=createGroundPool({...VIEW_POOL_OPTIONS,schedule:cb=>frames.push(cb),now:()=>time,settleMs:0,planInterval:0,
  acquire:async(key,r)=>{const t=texture(512,512,r);managed.set(key,t);return t;},release:key=>{managed.get(key)?.destroy(true);managed.delete(key);}});
 const root=new Container(),tiles=Array.from({length:20},(_,i)=>({src:'/tile'+i+'.svg',x:i*512,y:0,width:512,height:512,screenResolution:true,resolution:4}));
 const stream=pool.create(tiles,root),other=pool.create([{...tiles[0],src:'/other.svg'}],root);
 const view=(s,x=256)=>({stream:s,camera:{x,y:256,zoom:.8},width:800,height:600});
 const drain=async()=>{for(let i=0;i<40;i++){time+=16;frames.splice(0).forEach(f=>f());await flush();}};
 pool.update([view(stream)],2);await drain();
 assert.equal(pool.stats().missingTiles,0);assert.equal(pool.stats().cachedTiles,0);
 assert(pool.stats().reservedBytes<=800*600*4*4*6);
 const sources=[...managed.keys()];
 pool.update([view(other)],1);await drain();
 assert(sources.every(key=>!managed.has(key)),'previous island GPU sources are destroyed');
 pool.update([]);await drain();assert.equal(managed.size,0);assert.equal(pool.stats().reservedBytes,0);
 pool.destroy();root.destroy({children:true});
});

test('pool downshift completes without a budget deadlock and stationary frames skip planning',async()=>{
 const frames=[];let now=0;
 const pool=createGroundPool({...VIEW_POOL_OPTIONS,schedule:cb=>frames.push(cb),now:()=>now,settleMs:0,planInterval:0,
  acquire:async(key,r)=>texture(1024,1024,r),release(){}});
 const root=new Container(),stream=pool.create([{src:'/down.svg',x:0,y:0,width:1024,height:1024,screenResolution:true,resolution:4}],root);
 const view={stream,camera:{x:512,y:512,zoom:1},width:1024,height:1024};
 const drain=async()=>{for(let i=0;i<20;i++){now+=16;frames.splice(0).forEach(f=>f());await flush();}};
 pool.update([view],2);await drain();const original=pool.stats().reservedBytes;
 pool.update([view],1);await drain();assert(pool.stats().reservedBytes<original);assert.equal(pool.stats().missingTiles,0);
 const plans=pool.stats().plans;for(let i=0;i<1000;i++){now+=16;pool.update([view],1);}
 assert.equal(pool.stats().plans,plans);assert.equal(frames.length,0,'no idle pump each frame');
 pool.destroy();root.destroy({children:true});
});

test('Home view-resident static art plus device-density ground crops fit both texture budgets at zoom .8',async t=>{
 const {art}=await homeModel(),staticEntries=[...entries('home',art).filter(e=>e.kind!=='ground').map(e=>e.p),...kiteArtEntries()];
 for(const [dpr,override,width,height] of [[1,undefined,1512,827],[1,undefined,1920,1080],[1.25,undefined,1366,768],[2,undefined,1512,827],[2,2,1512,827]]){
  const managed=new Map(),r=screenResolution(width,height,dpr,override);
  const camera={x:2820,y:2410,zoom:.8};
  const bank=createArtBudget(staticEntries,{zoom:.8,dpr:r,views:[{camera,width,height}],acquire:async(key,density)=>{
   const src=key.split('?')[0],size=sizes[src];assert(size,src+' must have intrinsic sizing');
   const tex=texture(...size,density);managed.set(key,{tex,mips:true});return tex;
  },release:key=>{managed.get(key)?.tex.destroy(true);managed.delete(key);}});
  await Promise.all(staticEntries.map(e=>bank.acquire(e)));
  const pool=createGroundPool({...VIEW_POOL_OPTIONS,acquire:async(key,density)=>{
   const crop=new URL(key,'https://test').searchParams.get('rasterCrop').split(',').map(Number),tex=texture(crop[4],crop[5],density);managed.set(key,{tex,mips:false});return tex;
  },release:key=>{managed.get(key)?.tex.destroy(true);managed.delete(key);}});
  const root=new Container(),stream=pool.create(art.ground.tiles.flatMap(p=>rasterTiles({...p,width:p.width+(p.bleed??0),height:p.height+(p.bleed??0)},p.src,undefined,512)),root);
  const views=[{stream,camera,width,height}];
  pool.update(views,r);for(let i=0;i<200&&pool.stats().pendingTiles;i++)await flush();
  assert.equal(pool.stats().missingTiles,0);assert.equal(pool.stats().failedTiles,0);
  let total=0;for(const {tex,mips} of managed.values())total+=bytes(tex)*(mips?4/3:1);
  // Reserve 32 MiB beyond these actual pool allocations for ducks, water,
  // authored previews and other small runtime textures. No globe atlas remains.
  const allowance=32*1048576,limit=(dpr===2?250:150)*1e6;
  assert(total+allowance<=limit,`DPR${dpr}: ${(total+allowance)/1e6} MB including runtime allowance`);
  t.diagnostic(JSON.stringify({dpr,override,width,height,rendererResolution:r,managedSources:managed.size,managedStaticAndGroundMB:total/1e6,withRuntimeAllowanceMB:(total+allowance)/1e6,groundMB:pool.stats().reservedBytes/1e6}));
  pool.update([]);assert.equal(pool.stats().reservedBytes,0);pool.destroy();bank.destroy();assert.equal(managed.size,0);root.destroy({children:true});
 }
});

test('Retina raster budget preserves representative rendered art at gameplay size',async t=>{
 const {art}=await homeModel();
 const specimens=['tree-round','bush-round','flower','library','bridge'];
 for(const kind of specimens){
  const entry=entries('home',art).find(e=>e.kind!=='ground'&&e.p.width>0&&(e.src.includes(kind)||e.p.asset?.includes(kind)));
  if(!entry)continue;
  const p=entry.p,src='public'+entry.src,size=sizes[entry.src],dpr=2,zoom=.8;
  const width=Math.ceil(p.width*(p.scale??1)*zoom*dpr),height=Math.ceil(p.height*(p.scale??1)*zoom*dpr);
  const old=artResolution(p,p.resolution??1),next=artResolution(p,p.resolution??1,undefined,{zoom,dpr});
  const raster=async r=>sharp(await sharp(src,{density:72*r}).resize(Math.ceil(size[0]*r),Math.ceil(size[1]*r)).png().toBuffer()).resize(width,height).ensureAlpha().raw().toBuffer();
  const a=await raster(old),b=await raster(next);let error=0;
  for(let i=0;i<a.length;i+=4)for(let k=0;k<3;k++)error+=Math.abs(a[i+k]*a[i+3]/255-b[i+k]*b[i+3]/255);
  const mean=error/(a.length/4*3);assert(mean<3,`${kind}: premultiplied RGB mean error ${mean}`);
  t.diagnostic(`${entry.src}: DPR2 mean RGB error ${mean.toFixed(3)}/255`);
 }
});

test('a density change during initial art decode resolves to the current live source',async()=>{
 const entry={src:'/pixi-art/lake-race.svg',width:1500,height:950,resolution:4},jobs=[],owned=new Map();
 const bank=createArtBudget([entry],{zoom:.8,dpr:1,acquire:(key,r)=>new Promise(resolve=>jobs.push(()=>{
  const tex=texture(1500,950,r);owned.set(key,tex);resolve(tex);
 })),release:key=>{owned.get(key)?.destroy(true);owned.delete(key);}});
 const first=bank.acquire(entry);bank.update(.8,2,250);bank.update(.8,2,500);
 jobs.shift()();await flush();assert.equal(owned.size,0,'stale completion is destroyed before upload');
 jobs.shift()();const result=await first;
 assert(result.source&&!result.source.destroyed,'initial caller receives the replacement, never a destroyed source');
 const count=owned.size;bank.update(.801,2,750);bank.update(.801,2,1000);await flush();
 assert.equal(owned.size,count);assert.equal(jobs.length,0,'small density changes stay in their bucket');
 bank.destroy();assert.equal(owned.size,0);
});
