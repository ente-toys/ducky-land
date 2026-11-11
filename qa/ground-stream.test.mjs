import test from 'node:test';
import assert from 'node:assert/strict';
import {createGroundPool,tileInView,tileResolution} from '../src/pixi/ground-stream.js';
const flush=()=>new Promise(r=>setImmediate(r));
const sprite=()=>({position:{set(){}},destroy(){this.destroyed=true;}});
const container={addChild(){}};
const tile=(x=0)=>({src:`/ground-${x}.svg`,x,y:0,width:100,height:100});
const view=(stream,x=50,zoom=1)=>({stream,camera:{x,y:50,zoom},width:100,height:100});

test('ground raster scale reaches the authored resolution up close and culling respects negative origins',()=>{
 assert.equal(tileResolution({resolution:1},1,2),1);
 assert.equal(tileResolution({resolution:.78},2,2),.78);
 assert.equal(tileResolution({},.1,1),.125);
 assert.ok(tileInView({...tile(),x:-100},{x:-50,y:50,zoom:1},100,100,1,0));
 assert.equal(tileInView(tile(1000),{x:0,y:50,zoom:1},100,100,1,0),false);
});
test('the ground pool decodes only visible tiles, releases far textures, and restores full resolution after zoom',async()=>{
 const requests=[],released=[];
 const pool=createGroundPool({makeSprite:sprite,acquire:async(src,resolution)=>{requests.push([src,resolution]);return {source:{pixelWidth:100*resolution,pixelHeight:100*resolution}};},release:src=>released.push(src)});
 const stream=pool.create([tile(),tile(5000)],container);
 assert.equal(requests.length,0);
 pool.update([view(stream)]);await flush();
 assert.deepEqual(requests,[['/ground-0.svg?groundScale=1',1]]);
 pool.update([view(stream,5050,.1)]);await flush();
 assert.deepEqual(released,['/ground-0.svg?groundScale=1']);
 assert.equal(requests.at(-1)[1],.125);
 pool.update([view(stream,5050,1)]);await flush();
 assert.equal(requests.at(-1)[1],1);
 assert.equal(stream.entries[1].sprite.width,100);
 pool.update([]);assert.equal(pool.stats().reservedBytes,0);
 pool.destroy();
});
test('all live islands share the byte limit: an over-budget view steps down in sharpness and still draws every tile',async()=>{
 const completions=[],released=[],sizes=[];
 const pool=createGroundPool({makeSprite:sprite,budget:80000,concurrency:2,acquire:(src,resolution)=>new Promise(r=>completions.push(()=>{sizes.push(resolution);r({source:{pixelWidth:100*resolution,pixelHeight:100*resolution}});})),release:src=>released.push(src)});
 const streams=Array.from({length:13},(_,i)=>pool.create([{...tile(),src:`/island-${i}.svg`}],container));
 pool.update(streams.map(s=>view(s)));
 assert.equal(completions.length,2);assert.ok(pool.stats().reservedBytes<=80000);
 while(completions.length){completions.splice(0).forEach(f=>f());await flush();}
 assert.equal(pool.stats().residentTiles,13);assert.equal(pool.stats().pendingTiles,0);assert.ok(pool.stats().reservedBytes<=80000);
 assert.ok(sizes.every(r=>r<1));
 pool.update([]);assert.equal(pool.stats().reservedBytes,0);assert.equal(released.length,13);
 pool.destroy();
});
test('a decode completed after eviction or disposal releases its lease without touching a destroyed sprite',async()=>{
 let finish;const released=[];
 const pool=createGroundPool({makeSprite:sprite,acquire:src=>new Promise(r=>finish=()=>r({source:{pixelWidth:100,pixelHeight:100}})),release:src=>released.push(src)});
 const stream=pool.create([tile()],container);pool.update([view(stream)]);
 pool.destroy();stream.destroy();assert.ok(stream.entries[0].sprite.destroyed);
 finish();await flush();assert.equal(pool.stats().reservedBytes,0);assert.equal(pool.stats().residentTiles,0);assert.equal(released.length,1);
});
test('failed ground uploads release their lease, keep the terrain fallback, and do not retry every frame',async()=>{
 let calls=0,releases=0;
 const pool=createGroundPool({makeSprite:sprite,acquire:async()=>{calls++;throw Error('offline');},release:()=>releases++});
 const stream=pool.create([tile()],container);pool.update([view(stream)]);await flush();
 for(let k=0;k<100;k++)pool.update([view(stream)]);
 assert.equal(calls,1);assert.equal(releases,1);assert.equal(pool.stats().reservedBytes,0);assert.equal(stream.entries[0].sprite.visible,false);pool.destroy();
});

// Both sides of the Iceland/main merge use this API: Iceland overrides a tile's
// margin, while main prefetches a viewport-sized rectangle on each axis.
test('ground culling combines per-tile overrides with rectangular prefetch margins',()=>{
 const camera={x:0,y:0,zoom:1};
 assert.equal(tileInView({...tile(),x:120},{...camera},100,100,1,{x:80,y:10}),true);
 assert.equal(tileInView({...tile(),x:0,y:120},camera,100,100,1,{x:80,y:10}),false);
 assert.equal(tileInView({...tile(),x:120,margin:0},camera,100,100,1,{x:80,y:10}),false);
 assert.equal(tileInView({...tile(),x:120,margin:80},camera,100,100,1,0),true);
 assert.equal(tileInView({...tile(),x:0,y:120,margin:{x:10,y:80}},camera,100,100,1,0),true);
});

test('fast zoom fills visible holes and resumes refinement and prefetch after settling',async()=>{
 const frames=[],requests=[];
 const pool=createGroundPool({makeSprite:sprite,schedule:fn=>frames.push(fn),settleMs:0,planInterval:0,
  acquire:async(src,resolution)=>{requests.push(src);return {source:{pixelWidth:100*resolution,pixelHeight:100*resolution}};},release(){}});
 const stream=pool.create([{...tile(),viewMargin:0},{...tile(160),viewMargin:0}],container);
 const step=async()=>{frames.splice(0).forEach(fn=>fn());await flush();};
 pool.update([view(stream)],1,true);
 await step();await step();
 assert.deepEqual(requests,['/ground-0.svg?groundScale=0.5']);
 assert.equal(stream.entries[0].sprite.visible,true);
 pool.update([view(stream)],1,false);
 await step();await step();
 assert.ok(requests.includes('/ground-0.svg?groundScale=1'));
 assert.ok(requests.some(src=>src.startsWith('/ground-160.svg?')));
 pool.destroy();
});

test('zoom throttling retains shared source leases, priority and distance through refinement',async()=>{
 const frames=[],requests=[],released=[];
 const pool=createGroundPool({makeSprite:sprite,budget:100000,schedule:fn=>frames.push(fn),settleMs:0,planInterval:0,
  acquire:async(src,resolution,options)=>{requests.push({src,resolution,options});return {source:{pixelWidth:100*resolution,pixelHeight:100*resolution}};},
  release:src=>released.push(src)});
 const stream=pool.create(Array.from({length:8},(_,i)=>({...tile(i),src:i<2?'/hut.svg':'/pine.svg',priority:i<2?9:5,viewMargin:0})),container);
 const step=async()=>{frames.splice(0).forEach(fn=>fn());await flush();};
 pool.update([view(stream)],1,true);
 await step();
 assert.equal(requests.length,1,'duplicate placements share the pending decode');
 assert.equal(requests[0].src,'/hut.svg?groundScale=0.5');
 assert.deepEqual(requests[0].options,{visible:true,priority:9,distance:0});
 for(let i=0;i<8;i++)await step();
 assert.equal(pool.stats().residentTiles,8);
 assert.equal(pool.stats().sharedSources,2);
 assert.equal(pool.stats().reservedBytes,20000);
 assert(requests.every(r=>r.resolution===.5),'zoom fills holes without refining');
 pool.update([view(stream)],1,false);
 for(let i=0;i<8;i++)await step();
 assert.equal(pool.stats().refiningTiles,0);
 assert.equal(requests.length,4,'two previews and two full-resolution sources');
 assert.equal(pool.stats().reservedBytes,100000,'cached and resident shared sources count once');
 assert(pool.stats().peakBytes<=100000);
 pool.destroy();
 assert.equal(pool.stats().reservedBytes,0);
 assert.deepEqual(released.sort(),requests.map(r=>r.src).sort(),'each shared lease releases once');
});
