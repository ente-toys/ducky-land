import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Assets,Texture} from 'pixi.js';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const {outputFiles:[bundle]}=await build({entryPoints:[fileURLToPath(new URL('../src/pixi/duck.js',import.meta.url))],bundle:true,packages:'external',format:'esm',write:false});
const code=bundle.text.replaceAll('"pixi.js"',JSON.stringify(import.meta.resolve('pixi.js')));
const {createDuck,disposeDuckAssets}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('Bench sitting lifts the feet and removes the floating Ducky shadow, then standing restores both',async()=>{
 const original={fetch:globalThis.fetch,load:Assets.load,get:Assets.get,unload:Assets.unload};
 globalThis.fetch=async()=>({ok:true,json:async()=>JSON.parse(readFileSync('public/pixi-duck/manifest.json'))});
 Assets.load=async()=>Texture.EMPTY;Assets.get=()=>Texture.EMPTY;Assets.unload=async()=>{};
 let rig;
 try{
  rig=await createDuck({outfit:{},seed:33});
  const descendants=n=>[n,...n.children.flatMap(descendants)];
  const nodes=()=>descendants(rig.root);
  rig.update(0,{action:0,time:3,reducedMotion:true});
  const direction=nodes().find(n=>n.label?.startsWith('Direction '));
  const shadow=direction.children[0];
  const feet=nodes().filter(n=>/^foot-/.test(n.label??''));
  assert.ok(shadow,'ground shadow');assert.equal(feet.length,2);
  const before=feet.map(n=>n.y);const alpha=shadow.alpha;
  rig.update(0,{action:0,time:3,reducedMotion:true,seated:true});
  assert.equal(shadow.alpha,0);assert.deepEqual(feet.map(n=>n.y),before.map(y=>y-12));
  rig.update(0,{action:0,time:3,reducedMotion:true});
  assert.equal(shadow.alpha,alpha);assert.deepEqual(feet.map(n=>n.y),before);
 }finally{rig?.dispose();await disposeDuckAssets();Object.assign(globalThis,{fetch:original.fetch});Assets.load=original.load;Assets.get=original.get;Assets.unload=original.unload;}
});
