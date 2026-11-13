import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMAdapter, Texture} from 'pixi.js';
import {createCanvas} from '@napi-rs/canvas';
import {recoverArt,isArtPlaceholder} from '../src/rendering/pixi/art/art-recovery.js';
import {createWholeSVGLoader} from '../src/rendering/pixi/art/whole-svg-loader.js';
import {uploadIsland} from '../src/rendering/pixi/art/island-preparation.js';

const flush=()=>new Promise(setImmediate);
function warnings(t){
  const saved=console.warn,seen=[];console.warn=(...args)=>seen.push(args);
  t.after(()=>console.warn=saved);return seen;
}

test('a synchronous art failure retries once and resolves a fallback at its deadline',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});const seen=warnings(t);let attempts=0;
  const pending=recoverArt(()=>{attempts++;throw Error('decode failed');},{fallback:()=>42});
  await flush();assert.equal(attempts,2);
  t.mock.timers.tick(3999);await flush();assert.equal(seen.length,0);
  t.mock.timers.tick(1);assert.equal(await pending,42);assert.equal(seen.length,1);
});

test('late texture work cannot replace a timed-out result',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});warnings(t);
  const finish=[],late=[];
  const pending=recoverArt(()=>new Promise(resolve=>finish.push(resolve)),{fallback:()=>0,late:value=>late.push(value)});
  t.mock.timers.tick(2000);await flush();assert.equal(finish.length,2);
  t.mock.timers.tick(2000);assert.equal(await pending,0);
  finish[0](1);finish[1](2);await flush();assert.deepEqual(late,[1,2]);
});

test('retrying the same in-flight job never destroys its accepted result',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});let finish;
  const work=new Promise(resolve=>finish=resolve),art={destroyed:false};
  const pending=recoverArt(()=>work,{late:value=>value.destroyed=true});
  t.mock.timers.tick(2000);finish(art);assert.equal(await pending,art);
  await flush();assert.equal(art.destroyed,false);
});

test('a failed GPU upload retries once and still releases readiness',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});const seen=warnings(t);
  let uploads=0;
  const pending=uploadIsland({texture:{bindSource(){uploads++;throw Error('GPU upload failed');}}},[],
    {sources:[Texture.WHITE.source],yieldFrame:async()=>{}});
  await flush();assert.equal(uploads,2);t.mock.timers.tick(4000);await pending;
  assert.equal(seen.length,1);assert(!Texture.WHITE.destroyed);
});

for(const kind of ['rejecting','hung'])test(`${kind} prerender manifest falls back to authored SVG`,async t=>{
  t.mock.timers.enable({apis:['setTimeout']});warnings(t);
  const old=DOMAdapter.get();DOMAdapter.set({...old,createCanvas});t.after(()=>DOMAdapter.set(old));
  let svgs=0;
  const loader=createWholeSVGLoader({queue:{run:job=>job(),raster:async job=>job()},canDecodeBitmap:()=>true,
    getManifest:()=>kind==='hung'?new Promise(()=>{}):Promise.reject(Error('manifest unavailable')),
    fetchBlob:async src=>{assert.equal(src,'/dynamic-map.svg');svgs++;return new Blob();},
    decode:async()=>createCanvas(20,10),decodeBitmap:()=>assert.fail('no build tier for dynamic map'),
  });
  const pending=loader.load('/dynamic-map.svg');await flush();t.mock.timers.tick(1000);await flush();
  const texture=await pending;assert.equal(svgs,1);assert(!isArtPlaceholder(texture));assert.equal(texture.width,20);
  loader.unload(texture);
});
