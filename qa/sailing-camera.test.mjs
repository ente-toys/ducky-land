import test from 'node:test';
import assert from 'node:assert/strict';
import {Container,Matrix} from 'pixi.js';
import {createSailingCamera} from '../src/rendering/shared/sailing-camera.js';
import {sailingUpright} from '../src/rendering/pixi/sailing-upright.js';
import {WORLD_ISLANDS} from '../src/world/world-map.js';
import {ISLETS} from '../src/world/islets.js';
import {mapOf} from '../src/world/island-maps.js';
import {placeRigid,flatRigid} from '../src/world/rigid.js';
import {placeIslet} from '../src/world/islet-placement.js';
import {cameraMatrix,rigidLandingBasis} from '../src/rendering/shared/sphere-camera.js';
import {withRigidVisitors} from '../src/rendering/shared/rigid-visitors.js';
import {rollBasis} from '../src/rendering/shared/globe-look.js';
import {cameraGame} from './helpers/pixi-engine.mjs';

test('sailing remains north-up near every island and islet in every chart',()=>{
 for(const from of WORLD_ISLANDS){
  const cam=createSailingCamera();
  const docks=[...WORLD_ISLANDS.map(i=>placeRigid(from.id,i.id,mapOf(i.id).HARBOR.water)),...ISLETS.map(i=>placeIslet(from.id,i,i.landing.water))];
  for(const p of docks)for(const dt of [0,1/144,1/60,1/30,.2])for(const reduced of [false,true]){
   assert.equal(cam.update(from.id,p,dt,reduced,rollBasis(1)),cam.basis);
   assert.deepEqual(cam.basis,{a:1,b:0,c:0,d:1});
   assert.equal(rigidLandingBasis(from.id,'home',rollBasis(1)).angle,0);
  }
 }
});

test('boat, sail front and rider keep their normal screen shape in every neighbour copy, including optional tilt',()=>{
 for(const from of WORLD_ISLANDS)for(const to of WORLD_ISLANDS)for(const tilt of [1,.65]){
  const basis=rollBasis(.9),boat=new Container(),front=new Container(),rider=new Container();
  for(const [i,sprite]of [boat,front,rider].entries()){
   sprite.position.set(12000,4000-i*10);sprite.scale.set(.7,1.2/tilt);sprite.rotation=.027;sprite.updateLocalTransform();
   const original=sprite.localTransform.clone();sailingUpright(sprite,basis,tilt);
   const r=flatRigid(from.id,to.id),copy=new Matrix(r.a,r.b,r.c,r.d,0,0);
   withRigidVisitors(from.id,to.id,[sprite],()=>{
    sprite.updateLocalTransform();const drawn=Object.assign(new Matrix(),cameraMatrix({x:0,y:0,zoom:1,basis},1440,900,tilt)).append(copy).append(sprite.localTransform);
    const expected=new Matrix(1,0,0,tilt,0,0).append(original);
    for(const key of ['a','b','c','d'])assert.ok(Math.abs(drawn[key]-expected[key])<1e-9,key);
   });sprite.destroy();
  }
 }
});

test('the real engine stays north-up sailing and landing, and returns from the globe to the flat player',t=>{
 const prior=globalThis.document;globalThis.document={hidden:false};t.after(()=>globalThis.document=prior);
 const player={id:'me',mode:'sailing',...placeRigid('home','blossom',mapOf('blossom').HARBOR.water),travel:0};
 const game=cameraGame(player);Object.assign(game.camera,player);Object.assign(game.target,game.camera);
 for(let k=1;k<=60;k++)game.frameAt(k*1000/60);
 assert.ok(game.sailingCamera.active);assert.deepEqual(game.camera.basis,{a:1,b:0,c:0,d:1});
 game.globeOpen=true;game.camera.x=1e6;game.camera.y=-1e6;
 game.closeGlobe();assert.equal(game.camera.x,player.x);assert.equal(game.camera.y,player.y-90);
 player.mode='walking';game.switchIsland('blossom');
 assert.equal(game.landingView,null);assert.equal(game.camera.basis,undefined);
 for(let k=61;k<=120;k++){game.frameAt(k*1000/60);assert.equal(game.camera.basis,undefined);assert.equal(game.landingView,null);}
});
