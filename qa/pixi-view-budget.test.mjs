import test from 'node:test';
import assert from 'node:assert/strict';
import {Container} from 'pixi.js';
import {createSnowfall,SNOW_POOL_SIZE,SNOW_PHONE_COUNT} from '../src/rendering/pixi/environment/snowfall.js';

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

import {cameraGame} from './helpers/pixi-engine.mjs';

test('a slow crowded view reduces draw resolution and restores it for a photo', () => {
 const game=cameraGame(), scales=[];
 game.baseRenderResolution=2;game.frame=60;game.frameTimes=Array(60).fill(42);
 game.app={renderer:{resize:(width,height,resolution)=>scales.push([width,height,resolution])}};
 game.updateCrowdResolution(47);
 game.updateCrowdResolution(48);
 game.updateCrowdResolution(40);
 game.pendingPhoto={};game.frame++;game.updateCrowdResolution(40);
 assert.deepEqual(scales,[[1440,900,1.5],[1440,900,2]]);
});

test('crowd animation keeps nearby rigs current and moves every duck each frame', () => {
 const game=cameraGame();
 game.chatBubbles=new Map();game.arches=[];game.arrivalLift=()=>0;
 const outfit={cap:1,shades:0,acc:0,shoes:0};
 const poses=Array.from({length:28},(_,i)=>({id:i.toString(16).padStart(8,'0'),
  player:i===27,x:i,y:0,mode:'walking',action:1,travel:245,turn:0,emoteVersion:0,outfit}));
 const updates=poses.map(()=>[]);
 for(const [i,pose] of poses.entries()){
  game.liveRigs.set(pose.id,{isPlayer:pose.player,outfit,rig:{root:new Container(),update:(dt,options)=>updates[i].push({dt,...options})}});
 }
 game.renderLiveDucks(poses,.016,0,false,()=>true,0);
 poses[25].x+=1;
 game.renderLiveDucks(poses,.016,.016,false,()=>true,16);
 assert.equal(updates[0].length,2);
 assert.equal(updates[0][1].simpleTurns,false);
 assert.equal(updates[27].length,2);
 assert.equal(updates[25].length,1);
 assert.equal(updates[25][0].simpleTurns,true);
 assert.equal(game.liveRigs.get(poses[25].id).rig.root.x,poses[25].x);
 game.renderLiveDucks(poses,.05,.066,false,()=>true,66);
 assert.ok(updates[25][1].dt>.05);
});

test('walking and zoom only use prepared current art and cannot trigger neighbour acquisitions',()=>{
 const game=cameraGame();let acquired=0,released=0;
 game.ensureArt=()=>acquired++;game.freeArt=()=>released++;
 for(const id of ['sunflower','pink','library','community','bog','snow']){
  game.artShown=id;game.arts.set(id,{ready:true});
  for(const zoom of [.05,.6,1.8]){game.camera.zoom=zoom;assert.deepEqual(game.liveCopies(),[]);}
 }
 assert.equal(acquired,0);assert.equal(released,0,'landing owns eviction, camera movement cannot release island art');
});

test('native tick steps prediction before rendering, pauses when hidden, and delivers snow between simulation steps',t=>{
 const old=globalThis.document;globalThis.document={hidden:false};t.after(()=>globalThis.document=old);
 const game=cameraGame();let local=0,network=0,snowCalls=0;
 game.sim.step=()=>local++;game.keys.add('d');game.room={islandId:'home',mode:'walking',step(dt,input){network++;assert.equal(input.x,1);},setAlpha(){}};
 game.frameAt(100);assert.ok(network>=5);assert.equal(network,local);
 globalThis.document.hidden=true;game.tick(200);assert.equal(network,local);const before=network;
 globalThis.document.hidden=false;game.frameAt(200);assert.ok(network>before);
 game.room=null;game.artShown='snow';game.snowfall.update=(time,reduced,art,width,height,visible)=>{assert.equal(art,'snow');assert.equal(visible,true);assert.ok(time>2);snowCalls++;};
 const complete=game.snowfall.update;
 // The standard fixture stops here after capturing the actual snowfall arguments.
 const sentinel=new Error('done');game.snowfall.update=(...args)=>{complete(...args);throw sentinel;};
 for(const now of [208,216]){assert.throws(()=>game.tick(now),error=>error===sentinel);}
 assert.equal(snowCalls,2);
});
