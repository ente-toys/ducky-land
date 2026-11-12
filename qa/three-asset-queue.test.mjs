import test from 'node:test';
import assert from 'node:assert/strict';
import {loadWorldAssets} from '../src/rendering/three/three-asset-queue.js';
test('world previews yield and load at bounded concurrency, recovering from a failed preview',async()=>{
 let active=0,max=0,yields=0;const loaded=[],errors=[];
 const tasks=Array.from({length:8},(_,i)=>async()=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,1));active--;if(i===3)throw Error('preview');return i;});
 await loadWorldAssets(tasks,{yieldFrame:async()=>{yields++;},onLoaded:i=>loaded.push(i),onError:(e,i)=>errors.push(i)});
 assert.equal(max,2);assert.equal(yields,8);assert.deepEqual(errors,[3]);assert.equal(loaded.length,7);
});
test('destroying the world stops queued previews and suppresses late completion callbacks',async()=>{
 let stopped=false,started=0,callbacks=0;
 await loadWorldAssets(Array.from({length:9},()=>async()=>{started++;stopped=true;}),{concurrency:1,stopped:()=>stopped,yieldFrame:async()=>{},onLoaded:()=>callbacks++});
 assert.equal(started,1);assert.equal(callbacks,0);
});
