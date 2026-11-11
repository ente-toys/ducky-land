import test from 'node:test';
import assert from 'node:assert/strict';
import {sceneryAhead} from '../src/pixi/scenery-ahead.js';
import {createGroundPool} from '../src/pixi/ground-stream.js';

test('look-ahead follows travel direction, is bounded, and leaves a stationary camera alone',()=>{
 const camera={x:100,y:200,zoom:1};assert.equal(sceneryAhead(camera,null),camera);
 assert.equal(sceneryAhead(camera,{travel:0}),camera);
 assert.deepEqual(sceneryAhead(camera,{x:2,y:2,previousX:1,previousY:2,travel:245}),{x:320.5,y:200,zoom:1});
 assert.equal(sceneryAhead(camera,{x:2,y:2,previousX:1,previousY:2,travel:2000}).x,700);
});

test('approaching scenery reaches full resolution before entry and entering needs no new decode',async()=>{
 const requests=[];const pool=createGroundPool({schedule:null,prefetch:true,progressive:false,makeSprite:()=>({position:{set(){}},destroy(){}}),acquire:async(src,resolution)=>{requests.push([src,resolution]);return {source:{pixelWidth:100*resolution,pixelHeight:100*resolution}};},release(){}});
 const stream=pool.create([0,120].map(x=>({src:`/ahead-${x}.svg`,x,y:0,width:100,height:100,viewMargin:0})),{addChild(){}});
 pool.update([{stream,camera:{x:50,y:50,zoom:1},prefetchCamera:{x:150,y:50,zoom:1},width:100,height:100}]);
 await new Promise(setImmediate);
 assert.equal(requests.find(([src])=>src.startsWith('/ahead-120'))[1],1,'ahead gets full quality instead of half-resolution ring');
 const count=requests.length;
 pool.update([{stream,camera:{x:150,y:50,zoom:1},prefetchCamera:{x:150,y:50,zoom:1},width:100,height:100}]);await new Promise(setImmediate);
 assert.equal(requests.length,count);assert(pool.stats().reservedBytes<=pool.stats().budgetBytes);pool.destroy();
});
