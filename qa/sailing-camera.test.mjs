import test from 'node:test';
import assert from 'node:assert/strict';
import {Container,Matrix} from 'pixi.js';
import {createSailingCamera,SAIL_TURN_SPEED,SAIL_TURN_ACCELERATION} from '../src/rendering/shared/sailing-camera.js';
import {sailingUpright} from '../src/rendering/pixi/sailing-upright.js';
import {WORLD_ISLANDS} from '../src/world/world-map.js';
import {ISLETS} from '../src/world/islets.js';
import {mapOf} from '../src/world/island-maps.js';
import {placeRigid,flatRigid} from '../src/world/rigid.js';
import {isletPlacement,placeIslet,isletLandingFrame} from '../src/world/islet-placement.js';
import {cameraMatrix,rigidLandingBasis} from '../src/rendering/shared/sphere-camera.js';
import {withRigidVisitors} from '../src/rendering/shared/rigid-visitors.js';
import {rollBasis} from '../src/rendering/shared/globe-look.js';
import {cameraGame} from './helpers/pixi-engine.mjs';
const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

const DEG=Math.PI/180;
const LEVEL=.5*DEG;

// Reuse the actor just as the engine does. Routes finish at the exact first
// dock-reach sample, not a frame later (which could hide a late camera turn).
function approach(from,to){
 const islet=!!to.jetty,map=islet?null:mapOf(to.id);
 const a=islet?{x:to.jetty.foot[0],y:to.jetty.foot[1]}:map.JETTY.foot;
 const b=islet?{x:to.jetty.water[0],y:to.jetty.water[1]}:map.JETTY.tip;
 const dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy);
 const r=islet?isletPlacement(from,to):flatRigid(from,to.id),co=islet?r.cos:r.a,si=islet?r.sin:r.b;
 const boat={x:0,y:0,turn:Math.atan2(-co*dx+si*dy,-si*dx-co*dy),travel:380};
 return {boat,at(d){
  const p=islet?placeIslet(from,to,[b.x+dx/l*d,b.y+dy/l*d]):placeRigid(from,to.id,{x:b.x+dx/l*d,y:b.y+dy/l*d});
  boat.x=p.x;boat.y=p.y;return boat;
 },landing:cam=>rigidLandingBasis(from,islet?to.home:to.id,cam.basis,islet?isletLandingFrame(from,to.home,to):undefined).angle};
}

function checkStep(cam,before,velocity,dt,label){
 assert.ok(Math.abs(cam.velocity)<=SAIL_TURN_SPEED+1e-12,`${label}: speed`);
 assert.ok(Math.abs(cam.velocity-velocity)<=SAIL_TURN_ACCELERATION*dt+1e-12,`${label}: acceleration`);
 assert.ok(Math.abs(cam.angle-before)<=SAIL_TURN_SPEED*dt+1e-12,`${label}: visible speed`);
 if(Math.abs(dt-1/60)<1e-10)assert.ok(Math.abs(cam.velocity-velocity)<DEG,`${label}: no velocity step > 1 deg/s`);
}

for(const [name,destinations]of [['81 main-island frames',WORLD_ISLANDS],['99 islet frames',ISLETS]]){
 test(`${name} level by Dock, under speed/acceleration caps, with matching 30/60/144 Hz paths`,()=>{
  let worstDock=0,worstPath=0,worstAcceleration=0;
  for(const reduced of [false,true])for(const from of WORLD_ISLANDS)for(const to of destinations){
   const paths=[];
   for(const hz of [30,60,144]){
    const route=approach(from.id,to),cam=createSailingCamera(),samples=[];
    const label=`${from.id}/${to.id}/${hz}/${reduced}`,duration=(8000-420)/380;
    cam.update(from.id,route.at(8000),0,reduced);
    let previousVisible=0,previousDt=1/hz;
    for(let k=1;k<=Math.ceil(duration*hz);k++){
     const time=Math.min(k/hz,duration),dt=time-Math.min((k-1)/hz,duration);
     const before=cam.angle,velocity=cam.velocity;
     assert.equal(cam.update(from.id,route.at(8000-time*380),dt,reduced),cam.basis,'reuse one basis');
     checkStep(cam,before,velocity,dt,label);
     const visible=(cam.angle-before)/dt;
     assert.ok(Math.abs(visible-previousVisible)<=SAIL_TURN_ACCELERATION*(dt+previousDt)/2+1e-10,`${label}: visible acceleration`);
     if(hz===60)assert.ok(Math.abs(visible-previousVisible)<DEG,`${label}: visible velocity continuity`);
     previousVisible=visible;previousDt=dt;
     worstAcceleration=Math.max(worstAcceleration,Math.abs(cam.velocity-velocity)/dt);
     if(k%(hz/6)===0)samples.push(cam.angle);
    }
    assert.equal(cam.targetId,to.home??to.id,label);
    assert.equal(cam.islet,to.jetty?to.id:null,label);
    worstDock=Math.max(worstDock,Math.abs(route.landing(cam)));
    assert.ok(Math.abs(route.landing(cam))<LEVEL,`${label}: dock error ${route.landing(cam)/DEG} deg`);
    paths.push(samples);
    // Staying aboard after Dock appears must not introduce another turn.
    for(let k=1;k<=Math.ceil(420/380*hz);k++){
     const d=Math.max(0,420-k*380/hz),before=cam.angle,velocity=cam.velocity;
     cam.update(from.id,route.at(d),1/hz,reduced);checkStep(cam,before,velocity,1/hz,label);
     assert.ok(Math.abs(route.landing(cam))<LEVEL,`${label}: stays level inside dock reach at ${d}`);
    }
   }
   for(let j=0;j<paths[0].length;j++)for(let h=1;h<paths.length;h++){
    const error=Math.abs(delta(paths[0][j],paths[h][j]));worstPath=Math.max(worstPath,error);
    assert.ok(error<LEVEL,`${from.id}/${to.id}: path mismatch ${error/DEG} deg at ${j/6}s`);
   }
  }
  console.log(`${name}: worst Dock ${(worstDock/DEG).toFixed(4)} deg; path ${(worstPath/DEG).toFixed(4)} deg; acceleration ${(worstAcceleration/DEG).toFixed(4)} deg/s²`);
 });
}

test('fixed targets start and stop at rest without overshoot, including wrap and reduced motion',()=>{
 for(const hz of [30,60,144])for(const reduced of [false,true])for(const start of [-179,-57,-1,1,57,179]){
  const cam=createSailingCamera(),map=mapOf('blossom'),point=placeRigid('home','blossom',{x:map.cx,y:map.cy});
  const boat={...point,travel:0};cam.update('home',boat,0,reduced,rollBasis(start*DEG));
  assert.equal(cam.velocity,0);
  const target=cam.targetAngle,sign=Math.sign(delta(target,cam.angle));
  for(let k=0;k<35*hz;k++){
   const before=cam.angle,error=delta(target,before),velocity=cam.velocity;
   cam.update('home',boat,1/hz,reduced);checkStep(cam,before,velocity,1/hz,`${start}/${hz}`);
   assert.ok(sign*delta(target,cam.angle)>=-1e-11,'never pass the fixed target');
   assert.ok(Math.abs(delta(target,cam.angle))<=Math.abs(error)+1e-11,'error decreases');
  }
  assert.ok(Math.abs(delta(target,cam.angle))<1e-8);
  assert.ok(Math.abs(cam.velocity)<1e-8,'stops at zero velocity');
  const before=cam.angle,velocity=cam.velocity;cam.update('home',boat,0,reduced);
  assert.equal(cam.angle,before);assert.equal(cam.velocity,velocity);
 }
});

test('interrupted turns retain velocity and obey both caps while braking and reversing',()=>{
 for(const reduced of [false,true]){
  const cam=createSailingCamera(),first=approach('home',WORLD_ISLANDS[1]),second=approach('home',WORLD_ISLANDS[2]);
  for(let k=0;k<1800;k++){
   const route=k<120?first:second,boat=route.at(1200),before=cam.angle,velocity=cam.velocity;
   cam.update('home',boat,1/60,reduced);checkStep(cam,before,velocity,1/60,'interruption');
  }
  assert.ok(Math.abs(delta(cam.targetAngle,cam.angle))<1e-8);
  cam.active=false;cam.update('home',second.boat,0,reduced,rollBasis(.2));
  assert.ok(Math.abs(cam.angle-.2)<1e-12);assert.equal(cam.velocity,0,'a new voyage starts at rest');
 }
});

test('target field is continuous across nearest-shore and heading changes, independent of reduced motion',()=>{
 const normal=createSailingCamera(),reduced=createSailingCamera();
 const a=placeRigid('home','home',{x:mapOf('home').cx,y:mapOf('home').cy});
 const b=placeRigid('home','isle-249',{x:mapOf('isle-249').cx,y:mapOf('isle-249').cy});
 const boat={x:0,y:0,turn:0,travel:380};
 let previous=0,changes=0,lastId=null;
 for(let k=0;k<=6000;k++){
  const u=k/6000;boat.x=a.x+(b.x-a.x)*u;boat.y=a.y+(b.y-a.y)*u;boat.turn=.15*Math.sin(k/300);
  normal.update('home',boat,1/60);reduced.update('home',boat,1/60,true);
  assert.equal(normal.targetAngle,reduced.targetAngle,'same target path');
  if(k>0)assert.ok(Math.abs(delta(normal.targetAngle,previous))<2*DEG,'no target selection jump');
  if(lastId!==normal.targetId)changes++;
  lastId=normal.targetId;previous=normal.targetAngle;
 }
 assert.ok(changes>=2,'cross a shore ownership boundary');
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

test('the real engine applies the turn while sailing and adds no post-landing animation',t=>{
 const prior=globalThis.document;globalThis.document={hidden:false};t.after(()=>globalThis.document=prior);
 const player={id:'me',mode:'sailing',...placeRigid('home','blossom',mapOf('blossom').JETTY.tip),travel:0};
 const game=cameraGame(player);Object.assign(game.camera,player);Object.assign(game.target,game.camera);
 for(let k=1;k<=600;k++)game.frameAt(k*1000/60);
 assert.ok(game.sailingCamera.active);assert.ok(Math.abs(game.camera.basis.b)>.01);
 const priorBasis={...game.camera.basis};player.mode='walking';game.switchIsland('blossom');
 assert.ok(Math.abs(rigidLandingBasis('home','blossom',priorBasis).angle)<.001);
 assert.equal(game.landingView,null);assert.equal(game.camera.basis,undefined);
 for(let k=601;k<=660;k++){game.frameAt(k*1000/60);assert.equal(game.camera.basis,undefined);assert.equal(game.landingView,null);}
});
