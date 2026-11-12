import test from 'node:test';
import assert from 'node:assert/strict';
import {retainDetailArt} from '../src/pixi/three-game-budget.js';
import {Container} from 'pixi.js';
import {createSnowfall,SNOW_POOL_SIZE,SNOW_PHONE_COUNT} from '../src/pixi/snowfall.js';

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
 for(const name of ['pixi.js'])code=code.replaceAll(JSON.stringify(name),JSON.stringify(import.meta.resolve(name)));
 let Engine;
 try{Engine=(await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).PixiIsland;}catch(error){throw new Error('Engine import: '+error.message);}
 const prior={document:globalThis.document,requestAnimationFrame:globalThis.requestAnimationFrame};
 let localSteps=0,roomSteps=0,scheduled=0;
 globalThis.document={hidden:false};globalThis.requestAnimationFrame=()=>{scheduled++;return 42;};
 const game={disposed:false,lastFrame:0,frame:0,frameTimes:[],accumulator:0,islandId:'home',travelMode:'walking',keys:new Set(['d']),touchInput:{x:0,y:0},
  sim:{step(){localSteps++;}},room:{islandId:'home',mode:'walking',step(dt,input){roomSteps++;assert.equal(input.x,1);},setAlpha(){}},player:null,hadPlayer:false,
  externalOverview:true,externalDetailVisible:false,motion:{matches:false},camera:{get x(){throw new Error('Hidden renderer entered visual work');}},tick(){}};
 try{
  try{Engine.prototype.tick.call(game,100);}catch(error){throw new Error('Background tick: '+error.message);}
  assert.ok(roomSteps>=5,'authoritative prediction still advances every fixed step');assert.equal(roomSteps,localSteps);assert.equal(scheduled,1);assert.equal(game.raf,42);
  globalThis.document.hidden=true;
  const before=roomSteps;
  Engine.prototype.tick.call(game,200);assert.equal(roomSteps,before,'background RAF stays paused');
  Engine.prototype.tick.call(game,200,{forceRender:true});assert.ok(roomSteps>before,'initial paint can prepare a hidden pane before focus');
  globalThis.document.hidden=false;
  // The same real tick must reach screen-space snow once the bridge exposes
  // Iceland detail. Stop at that call so later GPU work needs no mock renderer.
  const reachedSnow=new Error('reached snowfall'),snowCalls=[];

  Object.assign(game,{externalDetailVisible:true,artShown:'snow',sim:{time:2,step(){}},room:null,
    camera:{x:0,y:0,zoom:1},target:{x:0,y:0,zoom:1},zoomMotion:{velocity:0},minZoom:.1,
    width:1200,height:800,gestures:{pointers:new Map()},globeT:0,arts:new Map(),
    scene:{setFromMatrix(){}},upright:{update(){}},ocean:{position:{set(){}},tilePosition:{set(){}}},
    weather:{update(){}},snowfall:{update(...args){snowCalls.push(args);throw reachedSnow;}}});
  for(const externalOverview of [true,false]){
    game.externalOverview=externalOverview;
    let caught;try{Engine.prototype.tick.call(game,externalOverview?208:216);}catch(error){caught=error;}
    assert.equal(caught===reachedSnow,true,'visible tick reaches snowfall: '+(caught?.message??'no call'));
  }
  assert.equal(snowCalls.length,2);
  for(const [i,[time,...args]] of snowCalls.entries()){
    assert.ok(Math.abs(time-(2+.008*(i+1)))<1e-9,'visual time advances between fixed simulation steps');
    assert.deepEqual(args,[false,'snow',1200,800,true]);
  }

 }finally{globalThis.document=prior.document;globalThis.requestAnimationFrame=prior.requestAnimationFrame;}
});

test('Iceland weather budget reuses 180 Graphics, exposes 90 on phone and hides for overview',()=>{
 const stage=new Container(),snow=createSnowfall(stage),pool=[...snow.root.children];
 const contexts=[...new Set(pool.map(f=>f.context))];
 assert.equal(contexts.length,6);
 let redraws=0;for(const context of contexts)context.on('update',()=>redraws++);
 assert.equal(SNOW_POOL_SIZE,180);assert.equal(SNOW_PHONE_COUNT,90);
 for(const [width,count]of [[1440,180],[390,90],[1200,180]]){
  snow.update(100,false,'snow',width,844,true);
  assert.equal(snow.root.children.filter(f=>f.visible).length,count);
  assert.deepEqual(snow.root.children,pool);
  assert.ok(pool.every(f=>contexts.includes(f.context)));
 }
 assert.equal(redraws,0,'pooled geometry is never redrawn');
 snow.update(101,false,'snow',1440,844,false);assert.equal(snow.root.visible,false);
 snow.destroy();assert.ok(pool.every(f=>f.destroyed));assert.ok(contexts.every(c=>c.destroyed));stage.destroy();
});
