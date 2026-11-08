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
test('all live islands share the byte limit, and pending decodes count against it',async()=>{
 const completions=[],released=[];
 const pool=createGroundPool({makeSprite:sprite,budget:80000,concurrency:2,acquire:src=>new Promise(r=>completions.push(()=>r({source:{pixelWidth:100,pixelHeight:100}}))),release:src=>released.push(src)});
 const streams=Array.from({length:13},()=>pool.create([tile()],container));
 pool.update(streams.map(s=>view(s)));
 assert.equal(completions.length,2);assert.equal(pool.stats().reservedBytes,80000);
 completions.splice(0).forEach(f=>f());await flush();
 assert.equal(pool.stats().residentTiles,2);assert.equal(pool.stats().pendingTiles,0);
 pool.update([]);assert.equal(pool.stats().reservedBytes,0);assert.equal(released.length,2);
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
