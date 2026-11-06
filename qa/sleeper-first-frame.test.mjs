import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Assets,Texture} from 'pixi.js';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const {outputFiles:[bundle]}=await build({entryPoints:[fileURLToPath(new URL('../src/pixi/duck.js',import.meta.url))],bundle:true,packages:'external',format:'esm',write:false});
const code=bundle.text.replaceAll('"pixi.js"',JSON.stringify(import.meta.resolve('pixi.js')));
const {createDuck,disposeDuckAssets}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));

test('themed sleepers are asleep before their first rendered frame or snapshot',async()=>{
  const originals={fetch:globalThis.fetch,load:Assets.load,get:Assets.get,unload:Assets.unload};
  globalThis.fetch=async()=>({ok:true,json:async()=>JSON.parse(readFileSync('public/pixi-duck/manifest.json'))});
  Assets.load=async()=>Texture.EMPTY;Assets.get=()=>Texture.EMPTY;Assets.unload=async()=>{};
  let rig;
  try {
    rig=await createDuck({sleep:{pose:'wing',flip:false},outfit:{},seed:101});
    const children=node=>[node,...node.children.flatMap(children)];
    const nodes=children(rig.root);
    assert.equal(nodes.find(n=>n.label==='Sleeping Ducky (wing)').visible,true);
    assert.ok(nodes.filter(n=>n.label?.startsWith('Direction ')).every(n=>!n.visible),'no standing direction is visible in a fresh snapshot');
    rig.update(0,{action:7,persistentSleep:true,time:10});
    assert.equal(nodes.find(n=>n.label==='Sleeping Ducky (wing)').visible,true);
  } finally {
    rig?.dispose();await disposeDuckAssets();
    globalThis.fetch=originals.fetch;Assets.load=originals.load;Assets.get=originals.get;Assets.unload=originals.unload;
  }
});
