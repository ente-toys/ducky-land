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
    assert.equal(nodes.filter(n=>n.label?.startsWith('Direction ')).length, 0, 'permanent sleepers allocate no standing views');
    rig.update(0,{action:7,persistentSleep:true,time:10});
    assert.equal(nodes.find(n=>n.label==='Sleeping Ducky (wing)').visible,true);
  } finally {
    rig?.dispose();await disposeDuckAssets();
    globalThis.fetch=originals.fetch;Assets.load=originals.load;Assets.get=originals.get;Assets.unload=originals.unload;
  }
});

test('standing ducks attach only their current direction and dispose cached directions after turning', async () => {
  const originals = {fetch: globalThis.fetch, load: Assets.load, get: Assets.get, unload: Assets.unload};
  globalThis.fetch = async () => ({ok: true, json: async () => JSON.parse(readFileSync('public/pixi-duck/manifest.json'))});
  Assets.load = async () => Texture.EMPTY; Assets.get = () => Texture.EMPTY; Assets.unload = async () => {};
  let rig;
  const directions = new Set();
  try {
    rig = await createDuck({outfit: {}, seed: 7});
    const art = rig.root.children.find(child => child.label === 'Original SVG rig');
    for (let angle = 0; angle <= Math.PI * 2; angle += Math.PI / 4) {
      for (let frame = 0; frame < 100; frame++) rig.update(1 / 60, {action: 1, speed: 165, turn: angle});
      const attached = art.children.filter(child => child.label?.startsWith('Direction '));
      assert.equal(attached.length, 1);
      directions.add(attached[0]);
    }
    assert.equal(directions.size, 8);
    rig.dispose();
    assert.ok([...directions].every(direction => direction.destroyed));
  } finally {
    rig?.dispose(); await disposeDuckAssets();
    globalThis.fetch = originals.fetch; Assets.load = originals.load; Assets.get = originals.get; Assets.unload = originals.unload;
  }
});

test('steady walking reuses body geometry and turning invalidates it', async () => {
  const originals = {fetch: globalThis.fetch, document: globalThis.document, DOMParser: globalThis.DOMParser,
    load: Assets.load, get: Assets.get, unload: Assets.unload};
  // A circular SVG outline makes sampling deterministic without a browser layout engine.
  globalThis.document = {
    body: {appendChild() {}},
    createElementNS() {return {style: {}, appendChild() {}, remove() {}, setAttribute() {},
      getTotalLength: () => 360,
      getPointAtLength: length => ({x: 100 * Math.cos(length * Math.PI / 180), y: 100 * Math.sin(length * Math.PI / 180)}),
    };},
  };
  globalThis.DOMParser = class {
    parseFromString() {return {querySelectorAll: () => ['#ffd525', '#ffe161', 'white'].map(color => ({
      getAttribute: name => name === 'fill' ? color : 'M0 0 L1 0 L0 1Z',
    }))};}
  };
  globalThis.fetch = async () => ({ok: true, text: async () => '<svg/>',
    json: async () => JSON.parse(readFileSync('public/pixi-duck/manifest.json'))});
  Assets.load = async () => Texture.EMPTY; Assets.get = () => Texture.EMPTY; Assets.unload = async () => {};
  let rig;
  try {
    rig = await createDuck({outfit: {}, seed: 9});
    const descendants = node => [node, ...node.children.flatMap(descendants)];
    const body = descendants(rig.root).find(node => node.label?.startsWith('body-'));
    const morph = body.children.find(node => node.context);
    assert.ok(morph);
    let updates = 0;
    morph.context.on('update', () => updates++);
    for (let i = 0; i < 100; i++) rig.update(1 / 60, {action: 1, speed: 165, turn: 0});
    assert.equal(updates, 0, 'breathing and walking animate transforms without tessellating the body again');
    rig.update(1 / 60, {action: 1, speed: 165, turn: Math.PI / 2});
    assert.ok(updates > 0, 'a changed turn redraws the outline');
  } finally {
    rig?.dispose(); await disposeDuckAssets();
    globalThis.fetch = originals.fetch; globalThis.document = originals.document; globalThis.DOMParser = originals.DOMParser;
    Assets.load = originals.load; Assets.get = originals.get; Assets.unload = originals.unload;
  }
});
