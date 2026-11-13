import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMAdapter} from 'pixi.js';
import {createRasterLoader} from '../src/rendering/pixi/art/theme-art-stream.js';
import {createRasterWorkQueue,createRasterCache} from '../src/rendering/pixi/art/raster-work.js';
import {createAtlasBuild} from '../src/rendering/pixi/atlas-work.js';
import {Sprite,Texture} from 'pixi.js';
const flush=()=>new Promise(setImmediate);

function clock(){
 let time=0,frame=0;const frames=[];
 const work=createRasterWorkQueue({schedule:cb=>frames.push(cb),now:()=>time});
 return {work,get frame(){return frame;},get time(){return time;},cost(ms){time+=ms;},
  async tick(zoom=1,input=false){time+=16;frame++;work.update(zoom,time,input);frames.splice(0).forEach(cb=>cb(time));await flush();},
  async until(done){for(let i=0;i<200&&!done();i++)await this.tick();assert(done(),'queue finishes');}};
}

test('heavy continuation gets an exclusive frame even when decode completes between frames',async()=>{
 const c=clock(),runs=[];let decode;
 const first=c.work.enqueue(()=>new Promise(resolve=>{decode=resolve;}));
 const continuation=first.then(()=>c.work.enqueue(()=>{runs.push(['raster',c.frame]);c.cost(44);}));
 await c.tick();decode();await flush();
 const other=c.work.enqueue(()=>runs.push(['other heavy',c.frame]));
 const cheap=c.work.enqueue(()=>runs.push(['crop',c.frame]),{},false);
 await c.until(()=>runs.length===3);await Promise.all([continuation,other,cheap]);
 assert.equal(new Set(runs.map(r=>r[1])).size,3,'44ms indivisible job is alone, and two heavy jobs never share a frame');
 assert.equal(c.work.stats().maxHeavyMs,44);c.work.destroy();
});

function fixture(t){
 const c=clock(),adapter=DOMAdapter.get(),previous={fetch:globalThis.fetch,location:globalThis.location};
 const calls=[];let images=0;
 DOMAdapter.set({...adapter,createImage:()=>{images++;return {src:'',decode:async()=>{}};},createCanvas:(width,height)=>({width,height,
  getContext:()=>({drawImage(source){if('src' in source){calls.push(['raster',c.frame]);c.cost(44);}else calls.push(['crop',c.frame]);}})})});
 globalThis.location={href:'https://test/'};globalThis.fetch=async()=>({ok:true,text:async()=>'<svg width="1024" height="512"><rect width="1024" height="512"/></svg>'});
 const cache=createRasterCache({budgetBytes:16*1048576});
 const loader=createRasterLoader({workQueue:c.work,sourceCache:cache});
 t.after(()=>{loader.destroy();cache.destroy();c.work.destroy();DOMAdapter.set(adapter);Object.assign(globalThis,previous);});
 const key=(x,r=1,src='walk',y=0)=>`/${src}.svg?rasterCrop=1024,512,${x},${y},64,64&groundScale=${r}`;
 const load=async keys=>{let ready=false;const result=Promise.all(keys.map(k=>loader.acquire(k,Number(new URL(k,'https://test').searchParams.get('groundScale'))))).then(v=>{ready=true;return v;});await flush();await c.until(()=>ready);return result;};
 return {c,cache,loader,calls,key,load,get images(){return images;}};
}

test('walking and returning to recent ground rasterize each source once per density, with shared crops',async t=>{
 const f=fixture(t);
 for(const src of ['home-ground','theme-ground']){
  const keys=Array.from({length:12},(_,i)=>f.key(i*64,1,src));
  await f.load(keys);keys.forEach(f.loader.release);
  await f.load(keys.toReversed());keys.forEach(f.loader.release);
 }
 assert.equal(f.images,2,'two sources, one SVG decode/raster each, independent of crop count and revisit');
 assert.equal(f.calls.filter(c=>c[0]==='raster').length,2);
 assert(f.cache.stats().hits>=46);assert(f.cache.stats().peakBytes<=f.cache.budgetBytes);
 for(const [kind,frame]of f.calls)if(kind==='raster')assert.equal(f.calls.filter(c=>c[1]===frame).length,1,'heavy raster frame has no other work');
});

test('70 crop requests during a continuous wheel/pinch zoom rasterize zero sources until 320ms after all motion',async t=>{
 const f=fixture(t);await f.load([f.key(0)]);f.loader.release(f.key(0));
 const before=f.images;let ready=false;
 await f.c.tick(1,true);
 const keys=Array.from({length:70},(_,i)=>f.key(i%16*64,2,'walk',Math.floor(i/16)*64));
 assert.equal(new Set(keys).size,70,'70 distinct crop requests share a single source raster');
 const pending=Promise.all(keys.map(k=>f.loader.acquire(k,2))).then(()=>{ready=true;});await flush();
 for(let i=0;i<180;i++)await f.c.tick(1+i/180,true);
 assert.equal(f.images,before,'zero new SVG rasterizations throughout 3 seconds of active zoom');
 assert.equal(ready,false);
 for(let i=0;i<19;i++)await f.c.tick(2,false);
 assert.equal(f.images,before,'settling includes continuous camera easing');
 await f.c.until(()=>ready);await pending;
 assert.equal(f.images,before+1,'70 crops share one raster at the final density');
 keys.forEach(f.loader.release);
});

test('CPU cache LRU is byte bounded, pins pending reads, retries failures, and closes all resources',async()=>{
 const cache=createRasterCache({budgetBytes:32});const closed=[];
 const make=id=>async()=>({width:2,height:2,close(){closed.push(id);}}),read=x=>x;
 await cache.use('a',16,make('a'),read);await cache.use('b',16,make('b'),read);
 await cache.use('a',16,()=>{throw Error('cache missed');},read);
 await cache.use('c',16,make('c'),read);assert.deepEqual(closed,['b']);
 let unpin;const pinned=cache.use('a',16,make('a'),()=>new Promise(resolve=>{unpin=resolve;}));await flush();
 let created=false;const next=cache.use('d',32,async()=>{created=true;return make('d')();},read);await flush();assert.equal(created,false);
 unpin();await pinned;await next;assert.equal(cache.stats().bytes,32);assert.equal(cache.stats().peakBytes,32);
 await assert.rejects(cache.use('broken',32,async()=>{throw Error('decode failed');},read),/decode failed/);
 await cache.use('broken',32,make('retry'),read);assert.equal(cache.stats().bytes,32);
 cache.destroy();assert.equal(cache.stats().bytes,0);assert.equal(closed.filter(s=>s==='retry').length,1);
});

test('large SVGs use bounded bands and share a band across neighboring crop requests',async t=>{
 const f=fixture(t);let ready=false;
 const keys=[0,64,128,6000].map(x=>`/large.svg?rasterCrop=8000,2000,${x},0,64,64&groundScale=1`);
 const results=Promise.all(keys.map(k=>f.loader.acquire(k,1))).then(()=>{ready=true;});await flush();await f.c.until(()=>ready);await results;
 assert.equal(f.images,2,'two necessary large bands, not four full-source rasters');
 assert(f.cache.stats().peakBytes<=f.cache.budgetBytes);keys.forEach(f.loader.release);
});

test('globe atlas copies one cell per exclusive frame, even during zoom, and cancels before rendering freed targets',async()=>{
 const c=clock(),renders=[];let live=true;
 const renderer={render:({target,clear})=>{assert(!target.destroyed);renders.push([c.frame,clear]);}};
 const build=createAtlasBuild(renderer,{width:16,height:16,items:[0,1,2],workQueue:c.work,valid:()=>live,draw:()=>new Sprite(Texture.EMPTY)});
 let done=false;const ready=build.ready.then(()=>{done=true;});
 for(let i=0;i<10&&!done;i++)await c.tick(i+1,true);
 await ready;assert.deepEqual(renders.map(r=>r[1]),[true,false,false]);assert.equal(new Set(renders.map(r=>r[0])).size,3);
 const count=renders.length,refresh=createAtlasBuild(renderer,{width:16,height:16,texture:build.texture,items:[0,1],workQueue:c.work,valid:()=>live,draw:()=>new Sprite(Texture.EMPTY)});
 let refreshed=false;const refreshReady=refresh.ready.then(()=>{refreshed=true;});await c.until(()=>refreshed);await refreshReady;
 assert(renders.slice(count).every(r=>!r[1]),'refresh retains other cells until their replacement is ready');
 const cancelled=createAtlasBuild(renderer,{width:16,height:16,items:[0,1],workQueue:c.work,valid:()=>live,draw:()=>new Sprite(Texture.EMPTY)});
 const rejection=assert.rejects(cancelled.ready,/cancelled/);live=false;cancelled.texture.destroy(true);await c.tick();await rejection;
 build.texture.destroy(true);c.work.destroy();
});

test('static Assets SVG parser also gates a decode already pending when zoom starts',async t=>{
 const {queuedSVGParser}=await import('../src/rendering/pixi/art/queued-svg.js');
 const c=clock(),adapter=DOMAdapter.get();let decoded,rasterized=0,done=false;
 DOMAdapter.set({...adapter,fetch:async()=>({ok:true,text:async()=>'<svg width="20" height="20"/>'}),
  createImage:()=>({src:'',width:20,height:20,decode:()=>new Promise(resolve=>{decoded=resolve;})}),
  createCanvas:(width,height)=>({width,height,getContext:(_kind,options)=>{assert.equal(options.willReadFrequently,true);return {drawImage(){rasterized++;}};}})});
 t.after(()=>{DOMAdapter.set(adapter);c.work.destroy();});
 let texture;const load=queuedSVGParser.load('https://test/static.svg',{data:{workQueue:c.work,resolution:2,autoGenerateMipmaps:true}}).then(t=>{texture=t;done=true;});
 await flush();await c.tick();assert(decoded);await c.tick(1,true);decoded();await flush();
 for(let i=0;i<180;i++)await c.tick(1+i/180,true);
 assert.equal(rasterized,0,'stock Pixi promise continuation is replaced for static art and globe previews');
 await c.until(()=>done);await load;assert.equal(rasterized,1);assert.equal(texture.source.pixelWidth,40);assert(texture.source.autoGenerateMipmaps);
 queuedSVGParser.unload(texture);
});

test('Assets resolves the explicit queued SVG parser and can unload and reacquire its texture',async t=>{
 const {Assets}=await import('pixi.js');await import('../src/rendering/pixi/art/queued-svg.js');
 const c=clock(),adapter=DOMAdapter.get();let rasterized=0;
 DOMAdapter.set({...adapter,getBaseUrl:()=> 'https://test/',fetch:async()=>({ok:true,text:async()=>'<svg width="20" height="20"/>'}),
  createImage:()=>({src:'',width:20,height:20,decode:async()=>{}}),
  createCanvas:(width,height)=>({width,height,getContext:()=>({drawImage(){rasterized++;}})})});
 await Assets.init({skipDetections:true});
 t.after(()=>{Assets.reset();DOMAdapter.set(adapter);c.work.destroy();});
 const load=async()=>{let texture;const pending=Assets.load({src:'https://test/queued-parser.svg',parser:'ducky-raster-svg',data:{workQueue:c.work,resolution:2}}).then(t=>{texture=t;});await flush();await c.until(()=>texture);await pending;return texture;};
 const first=await load();assert.equal(first.source.pixelWidth,40);await Assets.unload('https://test/queued-parser.svg');assert(first.destroyed);
 const second=await load();assert.notEqual(first,second);assert.equal(rasterized,2);await Assets.unload('https://test/queued-parser.svg');
});

test('a quick remount retries a shared pending Assets SVG on the new engine queue',async t=>{
 const {Assets}=await import('pixi.js');const {loadQueuedTexture}=await import('../src/rendering/pixi/art/queued-svg.js');
 const {createTextureLeases}=await import('../src/rendering/pixi/art/texture-leases.js');
 const old=clock(),next=clock(),adapter=DOMAdapter.get();let loads=0;
 DOMAdapter.set({...adapter,getBaseUrl:()=> 'https://test/',fetch:async()=>({ok:true,text:async()=>'<svg width="20" height="20"/>'}),
  createImage:()=>({src:'',width:20,height:20,decode:async()=>{}}),createCanvas:(width,height)=>({width,height,getContext:()=>({drawImage(){}})})});
 await Assets.init({skipDetections:true});
 const leases=createTextureLeases({load:(src,resolution,{workQueue})=>{loads++;return loadQueuedTexture(src,resolution,{},workQueue);},unload:src=>Assets.unload(src)});
 t.after(()=>{Assets.reset();DOMAdapter.set(adapter);old.work.destroy();next.work.destroy();});
 const src='https://test/remount.svg',first=leases.acquire(src,1,{workQueue:old.work});
 const rejection=assert.rejects(first,/disposed/);await flush();
 leases.release(src);old.work.destroy();
 let texture;const second=leases.acquire(src,1,{workQueue:next.work}).then(t=>{texture=t;});
 await rejection;await flush();await next.until(()=>texture);await second;
 assert.equal(loads,2,'the new owner does not inherit a disposed queue rejection');assert(!texture.destroyed);leases.release(src);await flush();assert(texture.destroyed);
});

test('releasing a remount retry before the old rejection settles retires its eventual texture',async()=>{
 const {createTextureLeases}=await import('../src/rendering/pixi/art/texture-leases.js');
 let rejectOld,resolveNew,loads=0,unloads=0;
 const old={disposed:false},next={disposed:false};
 const leases=createTextureLeases({load:()=>++loads===1?new Promise((_resolve,reject)=>{rejectOld=reject;}):new Promise(resolve=>{resolveNew=resolve;}),unload:async()=>{unloads++;}});
 const first=leases.acquire('/pending.svg',1,{workQueue:old}),rejection=assert.rejects(first,/disposed/);
 leases.release('/pending.svg');old.disposed=true;
 const second=leases.acquire('/pending.svg',1,{workQueue:next});leases.release('/pending.svg');
 rejectOld(Error('queue disposed'));await rejection;await flush();
 const texture=new Texture();resolveNew(texture);await second;await flush();
 assert.equal(loads,2);assert.equal(unloads,1);assert(texture.destroyed,'the old promise cannot orphan the successful retry');
});

test('GPU admission waits without a busy rAF and cancellation still wakes a blocked allocation',async()=>{
 const c=clock();let available=false,live=true,ran=0;
 const pending=c.work.enqueue(()=>ran++,{},true,()=>live,true,()=>available);
 for(let i=0;i<5;i++)await c.tick(.1,true);
 assert.equal(ran,0);assert.equal(c.work.stats().frame,0,'a closed admission gate does not spin queue callbacks');
 available=true;await c.tick(.09,true);await pending;assert.equal(ran,1);
 available=false;
 const cancelled=c.work.enqueue(()=>ran++,{},true,()=>live,true,()=>available);
 const rejection=assert.rejects(cancelled,/cancelled/);live=false;await c.tick(.08,true);await rejection;
 assert.equal(ran,1);c.work.destroy();
});
