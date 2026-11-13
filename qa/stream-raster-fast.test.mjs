import test from 'node:test';
import assert from 'node:assert/strict';
import {createGroundPool,tileInView} from '../src/rendering/pixi/art/ground-stream.js';
import {rasterLayers} from '../scripts/bigger-cathedral/final-model.mjs';
const flush=()=>new Promise(setImmediate);
const sprite=()=>({position:{set(){}},scale:{x:1},destroy(){}});
const container={addChild(){}};

test('Bellovo 2x walking never exposes an empty visible crop and refines within 18 frames (300ms) after settle',async t=>{
 for(const [kind,tiles] of Object.entries(rasterLayers())){
  let time=0,frame=0;const frames=[],decodes=[];
  const pool=createGroundPool({budget:(kind==='ground'?128:80)*1048576,
   utilization:kind==='ground'?.9:.995,schedule:cb=>frames.push(cb),now:()=>time,makeSprite:sprite,
   acquire:(src,r)=>new Promise(resolve=>decodes.push({at:frame+2,resolve:()=>{
    const crop=new URL(src,'https://test').searchParams.get('rasterCrop').split(',').map(Number);
    resolve({source:{pixelWidth:Math.ceil(crop[4]*r),pixelHeight:Math.ceil(crop[5]*r)}});
   }})),release(){}});
  const stream=pool.create(tiles,container);
  let camera={x:4100,y:2800,zoom:1};
  const tick=async()=>{
   time=++frame*1000/60;
   pool.update([{stream,camera,width:1400,height:1000}],2);
   frames.splice(0).forEach(f=>f());
   for(let i=decodes.length-1;i>=0;i--)if(decodes[i].at<=frame)decodes.splice(i,1)[0].resolve();
   await flush();assert(pool.stats().peakBytes<=pool.stats().budgetBytes,kind+' hard cap');
  };
  const visible=()=>stream.entries.filter(t=>tileInView(t,camera,1400,1000,1,0));
  for(let i=0;i<240;i++){await tick();if(!pool.stats().missingTiles&&!pool.stats().pendingTiles)break;}
  const ring=stream.entries.filter(t=>tileInView(t,camera,1400,1000,1,1000)&&!tileInView(t,camera,1400,1000,1,0));
  assert(ring.length>0&&ring.every(t=>t.sprite.visible),kind+' prefetched viewport ring '+JSON.stringify(pool.stats())+' ringMissing='+ring.filter(t=>!t.sprite.visible).length);
  for(let i=0;i<360;i++){
   camera={...camera,x:4100+i*4};await tick();
   assert(visible().every(t=>t.sprite.visible),kind+' empty walking crop at frame '+frame);
  }
  camera={...camera,zoom:1.8};
  for(let i=0;i<7;i++){await tick();assert(visible().every(t=>t.sprite.visible));}
  let completed;
  for(let i=1;i<=18;i++){
   await tick();assert(visible().every(t=>t.sprite.visible),'no hole during refinement');
   if(visible().every(t=>t.sprite.texture.source.pixelWidth/t.width>=3.6)){completed=i;break;}
  }
  assert(completed,kind+' full-resolution completion exceeded 18 frames');
  t.diagnostic(kind+': full resolution in '+completed+' frames after settle; peak '+(pool.stats().peakBytes/1048576).toFixed(2)+' MiB');
  assert.equal(pool.stats().failedTiles,0);pool.destroy();
  for(const job of decodes)job.resolve();await flush();assert.equal(pool.stats().reservedBytes,0);
 }
});

test('resolution plateaus do not restart settling, sufficient textures do not decode again, and cached crops return without decode',async()=>{
 let time=0;const frames=[],requests=[];
 const pool=createGroundPool({schedule:cb=>frames.push(cb),now:()=>time,makeSprite:sprite,
  acquire:async(src,r)=>{requests.push([src,r]);return {source:{pixelWidth:64*r,pixelHeight:64*r}};},release(){}});
 const stream=pool.create([{src:'/cache.svg',x:0,y:0,width:64,height:64,screenResolution:true,resolution:4}],container);
 const tick=async(x,zoom)=>{time+=16;pool.update([{stream,camera:{x,y:32,zoom},width:100,height:100}],2);frames.splice(0).forEach(f=>f());await flush();};
 for(let i=0;i<4;i++)await tick(32,1);
 assert.deepEqual(requests.map(r=>r[1]),[.5,2]);
 for(let i=0;i<10;i++)await tick(32,1.1+i*.0001);
 assert.equal(requests.at(-1)[1],2.25,'jitter within one step did not reset settle');
 const count=requests.length;
 for(let i=0;i<12;i++)await tick(32,.8);
 assert.equal(requests.length,count,'higher resolution reused');
 await tick(10000,.8);assert.equal(stream.entries[0].sprite.visible,false);
 await tick(32,.8);await tick(32,.8);assert(stream.entries[0].sprite.visible);assert.equal(requests.length,count,'decoded crop cache hit');
 pool.destroy();assert.equal(pool.stats().reservedBytes,0);
});

test('SVG loader budgets actual preparation per frame and allows concurrent async decodes without idle',async t=>{
 const {DOMAdapter}=await import('pixi.js');
 const {createRasterLoader}=await import('../src/rendering/pixi/art/theme-art-stream.js');
 const adapter=DOMAdapter.get(),old=Object.fromEntries(['fetch','location','createImageBitmap','requestIdleCallback'].map(k=>[k,globalThis[k]]));
 t.after(()=>{DOMAdapter.set(adapter);Object.assign(globalThis,old);});
 const frames=[],decodes=[];let cost=0,started=0,closed=0;
 DOMAdapter.set({...adapter,createImage:()=>{cost+=2;started++;return {src:'',decode:()=>new Promise(resolve=>decodes.push(resolve))};}});
 globalThis.location={href:'https://test/'};
 globalThis.fetch=async()=>({ok:true,text:async()=>'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20"/></svg>'});
 globalThis.requestIdleCallback=()=>{throw Error('idle must not gate raster work');};
 globalThis.createImageBitmap=async()=>({width:20,height:20,close(){closed++;}});
 const loader=createRasterLoader({schedule:cb=>frames.push(cb),now:()=>cost,concurrency:4});
 const keys=Array.from({length:8},(_,i)=>'/budget.svg?rasterCrop=100,20,'+i+',0,20,20&groundScale=1');
 const results=keys.map(key=>loader.acquire(key,1));await flush();
 cost=0;frames.splice(0).forEach(f=>f());assert.equal(started,3,'5ms allows three 2ms submissions, including last indivisible task');
 cost=0;frames.splice(0).forEach(f=>f());assert.equal(started,4,'four decodes remain in flight');
 for(let i=0;i<8;i++){decodes.splice(0).forEach(resolve=>resolve());await flush();cost=0;frames.splice(0).forEach(f=>f());}
 await Promise.all(results);assert.equal(started,8);
 keys.forEach(key=>loader.release(key));await flush();assert.equal(closed,8);loader.destroy();
});


test('raster scheduler skips obsolete queued jobs and spreads a burst over frames',async t=>{
 const {createRasterLoader}=await import('../src/rendering/pixi/art/theme-art-stream.js');
 const old={fetch:globalThis.fetch,location:globalThis.location};t.after(()=>Object.assign(globalThis,old));
 globalThis.location={href:'https://test/'};globalThis.fetch=async()=>({ok:true,text:async()=>'<svg/>'});
 const frames=[],finish=[],started=[];let needed=true,delivered=0;
 const loader=createRasterLoader({concurrency:16,schedule:cb=>frames.push(cb),rasterize:async(_svg,crop)=>{started.push(crop[2]);await new Promise(resolve=>finish.push(resolve));return {width:20,height:20};}});
 const keys=Array.from({length:13},(_,i)=>'/burst.svg?rasterCrop=20,20,'+i+',0,20,20');
 const results=keys.map((key,i)=>loader.acquire(key,1,{isNeeded:()=>i!==0||needed}).then(()=>{delivered++;},error=>assert.equal(error.name,'AbortError')));
 await flush();needed=false;frames.splice(0).forEach(f=>f());await flush();
 assert(!started.includes(0),'obsolete job never rasterized');assert.equal(started.length,12);
 finish.forEach(f=>f());await flush();assert.equal(delivered,8);
 frames.splice(0).forEach(f=>f());await flush();assert.equal(delivered,12);
 await Promise.all(results);keys.forEach(key=>loader.release(key));await flush();loader.destroy();
});

test('a raster that becomes obsolete during decode closes its bitmap without uploading it',async t=>{
 const {createRasterLoader}=await import('../src/rendering/pixi/art/theme-art-stream.js');
 const old={fetch:globalThis.fetch,location:globalThis.location};t.after(()=>Object.assign(globalThis,old));
 globalThis.location={href:'https://test/'};globalThis.fetch=async()=>({ok:true,text:async()=>'<svg/>'});
 let needed=true,finish,closed=0;
 const loader=createRasterLoader({schedule:null,rasterize:()=>new Promise(resolve=>finish=()=>resolve({close(){closed++;}}))});
 const key='/late.svg?rasterCrop=20,20,0,0,20,20';
 const result=loader.acquire(key,1,{isNeeded:()=>needed});const rejected=assert.rejects(result,{name:'AbortError'});
 await flush();needed=false;finish();await rejected;
 assert.equal(closed,1);loader.release(key);await flush();loader.destroy();
});


test('disposing an island with queued rasters releases reservations without poisoning the shared pool',async t=>{
 const {createRasterLoader}=await import('../src/rendering/pixi/art/theme-art-stream.js');
 const old={fetch:globalThis.fetch,location:globalThis.location};t.after(()=>Object.assign(globalThis,old));
 globalThis.location={href:'https://test/'};globalThis.fetch=async()=>({ok:true,text:async()=>'<svg/>'});
 const frames=[],loader=createRasterLoader({schedule:cb=>frames.push(cb)});
 const pool=createGroundPool({makeSprite:sprite});
 const stream=pool.create([{src:'/disposed.svg?rasterCrop=20,20,0,0,20,20',x:0,y:0,width:20,height:20}],container,undefined,loader);
 pool.update([{stream,camera:{x:10,y:10,zoom:1},width:100,height:100}]);await flush();
 assert.equal(pool.stats().pendingTiles,1);stream.destroy();loader.destroy();await flush();
 assert.equal(pool.stats().pendingTiles,0);assert.equal(pool.stats().reservedBytes,0);assert.equal(pool.stats().failedTiles,0);pool.destroy();
});

test('disposing a completion backlog settles every lease and closes each bitmap once',async t=>{
 const {createRasterLoader}=await import('../src/rendering/pixi/art/theme-art-stream.js');
 const old={fetch:globalThis.fetch,location:globalThis.location};t.after(()=>Object.assign(globalThis,old));
 globalThis.location={href:'https://test/'};globalThis.fetch=async()=>({ok:true,text:async()=>'<svg/>'});
 const frames=[];let closed=0,delivered=0;
 const loader=createRasterLoader({concurrency:16,schedule:cb=>frames.push(cb),rasterize:async()=>({width:20,height:20,close(){closed++;}})});
 const keys=Array.from({length:12},(_,i)=>'/dispose-burst.svg?rasterCrop=20,20,'+i+',0,20,20');
 const results=keys.map(key=>loader.acquire(key,1).then(()=>{delivered++;}));
 await flush();frames.splice(0).forEach(f=>f());await flush();assert.equal(delivered,8);
 keys.forEach(key=>loader.release(key));loader.destroy();await Promise.all(results);await flush();
 assert.equal(delivered,12);assert.equal(closed,12);await assert.rejects(loader.acquire(keys[0],1),{name:'AbortError'});
 frames.splice(0).forEach(f=>f());assert.equal(closed,12);
});
