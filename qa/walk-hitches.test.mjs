import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Worker as NodeWorker} from 'node:worker_threads';
import {Container, Sprite, Texture, Assets} from 'pixi.js';
import {createFoliagePalette} from '../src/rendering/pixi/environment/foliage-palette.js';
import {createPlantReactions} from '../src/rendering/pixi/environment/plant-reactions.js';
import {createAudio} from '../src/rendering/pixi/audio.js';
import {PixiIsland} from './helpers/pixi-engine.mjs';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const flush=()=>new Promise(setImmediate);
const engine=readFileSync('src/rendering/pixi/engine.js','utf8');

test('plant registration awaits worker colour parsing; walking and island return perform no fetch or parse',async t=>{
  const before={location:globalThis.location,fetch:globalThis.fetch};
  globalThis.location={href:'https://island.test/'};
  globalThis.fetch=()=>assert.fail('no main-thread foliage fetch');
  const messages=[],workers=[];
  const workerURL=new URL('../src/rendering/pixi/environment/foliage-palette.worker.js',import.meta.url).href;
  const loadColour=createFoliagePalette({createWorker:()=>{
    const worker=new NodeWorker(`
      const {parentPort,workerData}=require('node:worker_threads');
      globalThis.self={postMessage:data=>parentPort.postMessage(data)};
      globalThis.fetch=async src=>{parentPort.postMessage({fetch:src});return {ok:true,text:async()=>'<path fill="#e795bd" d="M0 0L50 0L50 50Z"/>'};};
      import(workerData).then(()=>parentPort.on('message',data=>self.onmessage({data})));
    `,{eval:true,workerData:workerURL});
    workers.push(worker);
    const bridge={postMessage:data=>{messages.push(data);worker.postMessage(data);},terminate:()=>worker.terminate()};
    worker.on('message',data=>{if(data.fetch)messages.push(data);else bridge.onmessage({data});});
    worker.on('error',error=>bridge.onerror(error));
    return bridge;
  }});
  const root=new Container(),sprite=new Sprite(Texture.EMPTY),fx=createPlantReactions(root,Texture.EMPTY,{loadColour});
  const props=[{id:'tree',name:'tree',src:'tree.svg',x:0,y:0,width:200,height:280,sprite}];
  const obstacles=[{prop:'tree',x:0,y:-9,rx:31,ry:22}];
  t.after(async()=>{fx.destroy();sprite.destroy();root.destroy();await Promise.all(workers.map(w=>w.terminate()));Object.assign(globalThis,before);});
  let ready=false;
  const registration=fx.register('pink',props,obstacles,'/art/').then(()=>{ready=true;});
  await flush();assert.equal(ready,false,'reveal must wait for colour completion');
  await registration;await fx.prepared();
  const actor={};fx.begin('pink',0);fx.track(actor,-100,-9);fx.begin('pink',.1);fx.track(actor,-50,-9);fx.update(.2);
  assert.equal(root.children.find(s=>s.visible)?.tint,0xe795bd,'worker preserves the painted canopy colour');
  assert.equal(messages.filter(m=>m.fetch).length,1);
  const beforeWalk=messages.length;
  for(let i=0;i<180;i++){fx.begin('pink',i/60);fx.track(actor,-50,-9);fx.update(i/60);}
  fx.unregister('pink');await fx.register('library',props,obstacles,'/art/');await fx.prepared();
  assert.equal(messages.length,beforeWalk,'same source is cached across island registrations');
});

test('deferred Home reactions and every destination finish registration before upload and reveal',()=>{
  assert(engine.includes("if(prepareHome)await settleArtStep(()=>this.plantReactions.register('home'"));
  for(const [start,end]of [['  ensureArt(mapId)','  homeTextureNodes()'],['  ensureHomeArt()','  releasePondDuckies(id)']]){
    const preparation=engine.slice(engine.indexOf(start),engine.indexOf(end));
    const register=preparation.indexOf('.register(');
    const upload=preparation.includes('await uploadIsland(')?preparation.indexOf('await uploadIsland('):preparation.indexOf('await this.uploadHomeArt(');
    assert(register>=0);assert(upload>register);
  }
  const mounted=engine.slice(engine.indexOf('  async mount('),engine.indexOf('  listen('));
  assert(mounted.indexOf('await this.prepareStartupArt()')>=0);
  assert(mounted.indexOf('await this.prepareStartupArt()')<mounted.indexOf('this.ready = true'));
  const startup=engine.slice(engine.indexOf('  async prepareStartupArt('),engine.indexOf('  liveCopies()'));
  assert(startup.includes('this.audio.prepare()'));assert(startup.includes('prepareDuckPortrait(this.player.outfit)'));
  assert(startup.includes('await Promise.all(jobs.map('));
});

test('first real movement keydown only resumes prepared audio and performs no asset, texture or sample work',async t=>{
  const originals=Object.fromEntries(['AudioContext','fetch','window','document'].map(k=>[k,globalThis[k]]));
  const work={contexts:0,fetches:0,decodes:0,samples:0,resumes:0};
  class Context {
    constructor(){work.contexts++;this.state='suspended';}
    async resume(){work.resumes++;this.state='running';}
    async decodeAudioData(){work.decodes++;return {};}
    async close(){}
  }
  Object.assign(globalThis,{AudioContext:Context,fetch:async()=>{work.fetches++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};},window:{},document:{}});
  const audio=createAudio();t.after(()=>{audio.dispose();Object.assign(globalThis,originals);});
  audio.register('prepared-sound',()=>{work.samples++;return {};});
  await audio.prepare();
  assert.deepEqual(work,{contexts:1,fetches:4,decodes:4,samples:1,resumes:0});
  const handlers=new Map();
  const game=Object.assign(Object.create(PixiIsland.prototype),{canvas:{},keys:new Set(),audio,globeBusy:()=>false,
    listen(target,type,fn){if(target===window)handlers.set(type,fn);}});
  game.bindInput();
  const prepared={...work};
  t.mock.method(Assets,'load',()=>assert.fail('first keydown cannot load textures'));
  for(const key of ['w','a','s','d'])handlers.get('keydown')({key,target:{tagName:'CANVAS'},preventDefault(){}});
  await flush();
  assert.deepEqual({...work,resumes:0},{...prepared,resumes:0});assert.equal(work.resumes,1);
  assert.equal(game.keys.size,4);
});

// Keep the real portrait cache and renderer flow, replacing only the GPU/rig boundary.
const {outputFiles:[portraitBundle]}=await build({entryPoints:[fileURLToPath(new URL('../src/rendering/pixi/duck-portrait.js',import.meta.url))],
  bundle:true,format:'esm',write:false,plugins:[{name:'portrait-gpu',setup(b){
    b.onResolve({filter:/^pixi\.js$/},()=>({path:'pixi',namespace:'mock'}));
    b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:`
      export class Rectangle {constructor(...args){this.args=args;}}
      export class Application {
        constructor(){globalThis.portraitApps++;this.stage={addChild(){}};this.renderer={extract:{base64:async()=>'portrait:'+globalThis.portraitApps}};}
        async init(){} render(){} destroy(){globalThis.portraitDestroyed++;}
      }`}));
    b.onLoad({filter:/\/duck\.js$/},()=>({contents:`export async function createDuck({outfit}){if(outfit.cap===99)throw Error('asset failed');return {root:{position:{set(){}},getLocalBounds:()=>({height:100}),getBounds:()=>({y:0})},update(){},dispose(){}};}`}));
  }}]});
const {prepareDuckPortrait,sameOutfit}=await import('data:text/javascript;base64,'+Buffer.from(portraitBundle.text).toString('base64'));
test('profile reuses its pre-reveal portrait across equal snapshots and compares outfit slots without serialization',async t=>{
  const old={portraitApps:globalThis.portraitApps,portraitDestroyed:globalThis.portraitDestroyed};
  globalThis.portraitApps=0;globalThis.portraitDestroyed=0;t.after(()=>Object.assign(globalThis,old));
  const outfit={cap:8,shades:1,acc:0,shoes:2,toJSON(){assert.fail('no outfit serialization');}};
  const prepared=await prepareDuckPortrait(outfit);assert.equal(globalThis.portraitApps,1);
  for(let i=0;i<100;i++){
    assert(sameOutfit(outfit,{...outfit}));assert.equal(await prepareDuckPortrait({...outfit}),prepared);
  }
  assert.equal(globalThis.portraitApps,1,'polling cannot create another renderer');
  assert(!sameOutfit(outfit,{...outfit,cap:1}));
  assert.notEqual(await prepareDuckPortrait({...outfit,cap:1}),prepared);assert.equal(globalThis.portraitApps,2);
  const disposed=globalThis.portraitDestroyed;
  await assert.rejects(prepareDuckPortrait({...outfit,cap:99}),/asset failed/);
  assert.equal(globalThis.portraitDestroyed,disposed+1,'failed preparation releases its renderer');
  const profile=readFileSync('src/app/IslandProfile.jsx','utf8');
  assert(!profile.includes('JSON.stringify'));assert(profile.includes('sameOutfit(current,previous) ? previous'));
  assert(profile.includes('if (!island.current?.ready) return;'));
});
