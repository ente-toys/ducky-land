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

test('native live copies retain Home and current theme and release old GPU art, including pending loads',()=>{
 const game=cameraGame();game.arts=new Map([['home',{ready:true}]]);const released=[];
 game.freeArt=id=>{released.push(id);game.arts.delete(id);};
 for(const id of ['sunflower','pink','library','community','bog','snow']){
  game.artShown=id;game.arts.set(id,{ready:true});game.liveCopies();
  assert.deepEqual([...game.arts.keys()],['home',id]);assert.deepEqual([...game.wantedArts],['home',id]);
 }
 assert.equal(released.length,5);
 game.arts.set('pending',{ready:false});game.artShown='home';game.liveCopies();
 assert.deepEqual([...game.wantedArts],['home']);assert.ok(game.arts.has('pending'),'loader owns pending disposal');assert.equal(released.length,6);
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
