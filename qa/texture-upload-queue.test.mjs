import test from 'node:test';
import assert from 'node:assert/strict';
import {createTextureUploadQueue} from '../src/pixi/texture-upload-queue.js';

test('burst decodes upload at most one shared source per frame before callers expose it',async()=>{
  const frames=[],uploaded=[],resolved=[];
  const queue=createTextureUploadQueue(source=>uploaded.push(source),callback=>frames.push(callback));
  const textures=Array.from({length:12},()=>({source:{}}));
  const promises=textures.map((texture,i)=>queue.enqueue(texture).then(()=>resolved.push(i)));
  const duplicate=queue.enqueue({source:textures[0].source});
  assert.equal(frames.length,1);assert.deepEqual(uploaded,[]);
  for(let i=0;i<12;i++){
    assert.equal(frames.length,1);frames.shift()();await Promise.resolve();
    assert.deepEqual(uploaded,textures.slice(0,i+1).map(t=>t.source));
    assert.deepEqual(resolved,Array.from({length:i+1},(_,k)=>k));
  }
  await Promise.all([...promises,duplicate]);assert.equal(frames.length,0);
  await queue.enqueue(textures[0]);assert.equal(frames.length,0);
  queue.destroy();
});

test('disposing during upload drains waiters without touching a destroyed renderer',async()=>{
  const frames=[];
  const queue=createTextureUploadQueue(()=>{throw Error('disposed renderer');},f=>frames.push(f));
  const ready=queue.enqueue({source:{}});queue.destroy();frames.shift()();await ready;
  await queue.enqueue({source:{}});assert.equal(frames.length,0);
});

test('a failed upload rejects its waiter and can be retried',async()=>{
  const frames=[],texture={source:{}};let fail=true;
  const queue=createTextureUploadQueue(()=>{if(fail)throw Error('upload failed');},f=>frames.push(f));
  const rejected=assert.rejects(queue.enqueue(texture),/upload failed/);frames.shift()();await rejected;
  fail=false;const ready=queue.enqueue(texture);frames.shift()();await ready;queue.destroy();
});
