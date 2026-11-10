import test from 'node:test';
import assert from 'node:assert/strict';
import {retainDetailArt} from '../src/pixi/three-game-budget.js';

test('visiting all themes retains Home and only the visible live island, releasing ready GPU art',()=>{
 const destroyed=[],game={arts:new Map([['home',{ready:true}]]),freeArt(id){destroyed.push(id);this.arts.delete(id);}};
 for(const id of ['sunflower','pink','library','community','fair','cathedral','bog','snow']){
  game.arts.set(id,{ready:true});retainDetailArt(game,id);
  assert.deepEqual([...game.arts.keys()],['home',id]);assert.deepEqual([...game.wantedArts],['home',id]);
 }
 assert.equal(destroyed.length,7);
 retainDetailArt(game);assert.deepEqual([...game.arts.keys()],['home']);assert.equal(destroyed.length,8);
});

test('a pending old island is no longer wanted when it completes; active and base art remain retained',()=>{
 const game={arts:new Map([['snow',{ready:false}],['fair',{ready:true}],['library',{ready:true}]]),freeArt(id){this.arts.delete(id);}};
 retainDetailArt(game,'fair');assert.ok(!game.wantedArts.has('snow'));assert.ok(game.wantedArts.has('fair'));assert.ok(game.wantedArts.has('home'));
 assert.ok(!game.arts.has('library'));assert.ok(game.arts.has('snow'),'the existing async loader owns pending disposal');
});

test('the real engine keeps authoritative simulation stepping while offscreen GPU rendering and streaming are skipped',async()=>{
 const {build}=await import('esbuild');
 const {fileURLToPath}=await import('node:url');
 const {outputFiles:[bundle]}=await build({entryPoints:[fileURLToPath(new URL('../src/pixi/engine.js',import.meta.url))],bundle:true,packages:'external',platform:'node',format:'esm',write:false,define:{'import.meta.env.DEV':'false','import.meta.url':JSON.stringify(new URL('../src/pixi/engine.js',import.meta.url).href)}});
 // Vite's asset catalogue is irrelevant to the offscreen simulation path.
 let code=bundle.text.replaceAll('import.meta.glob(', '(()=>({}))(');
 for(const name of ['pixi.js','@rive-app/webgl2-advanced'])code=code.replaceAll(JSON.stringify(name),JSON.stringify(import.meta.resolve(name)));
 let Engine;
 try{Engine=(await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).PixiIsland;}catch(error){throw new Error('Engine import: '+error.message);}
 const prior={document:globalThis.document,requestAnimationFrame:globalThis.requestAnimationFrame};
 let localSteps=0,roomSteps=0,scheduled=0;
 globalThis.document={hidden:false};globalThis.requestAnimationFrame=()=>{scheduled++;return 42;};
 const game={disposed:false,lastFrame:0,frame:0,frameTimes:[],accumulator:0,islandId:'home',travelMode:'walking',keys:new Set(['d']),touchInput:{x:0,y:0},
  sim:{step(){localSteps++;}},room:{islandId:'home',mode:'walking',step(dt,input){roomSteps++;assert.equal(input.x,1);},setAlpha(){}},player:null,hadPlayer:false,
  externalOverview:true,externalDetailVisible:false,get motion(){throw new Error('Hidden renderer entered visual work');},tick(){}};
 try{
  try{Engine.prototype.tick.call(game,100);}catch(error){throw new Error('Background tick: '+error.message);}
  assert.ok(roomSteps>=5,'authoritative prediction still advances every fixed step');assert.equal(roomSteps,localSteps);assert.equal(scheduled,1);assert.equal(game.raf,42);
 }finally{globalThis.document=prior.document;globalThis.requestAnimationFrame=prior.requestAnimationFrame;}
});
