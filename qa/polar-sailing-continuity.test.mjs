import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRoom,addPlayer} from './room-harness.mjs';
import {mapOf} from '../src/world/island-maps.js';
import {FLAT_POSITIONS,SEA_WIDTH} from '../src/world/flat-layout.js';
import {boatRoom,canSail,SAIL_SPEED,sailStep,setSailDestination} from '../src/gameplay/islands.js';
import {seaFrame,seaPosition} from '../src/world/sphere-coordinates.js';
import {seaViewPose} from '../src/world/sea-view.js';

test('worker preserves manual polar sailing and keeps the boat aligned in every departure frame',async()=>{
 const room=await makeRoom();
 try{
  let n=20000;
  for(const id of Object.keys(FLAT_POSITIONS))for(const sign of [-1,1]){
   room.connections.clear();room.boats=[];
   const m=mapOf(id),c=FLAT_POSITIONS[id],x=m.cx+12000-c.x,y=m.cy+sign*19990-c.y;
   assert.ok(canSail(x,y,id));
   const p=addPlayer(room,++n,{islandId:id,mode:'sailing',x,y});
   const boat={id:`${id}-0`,islandId:id,x,y,occupant:p.actor.id,turn:0};
   room.boats.push(boat);p.actor.boatId=boat.id;
   const info=room.connections.get(p.socket);info.input={x:0,y:sign};info.inputExpires=Infinity;
   for(let step=0;step<30;step++){
    const before={x:p.actor.x,y:p.actor.y};room.step();
    assert.equal(p.actor.islandId,id);assert.equal(p.actor.mode,'sailing');
    assert.ok(Math.abs(p.actor.y-before.y-sign*SAIL_SPEED*.05)<1e-6);
    assert.equal(p.actor.x,before.x);assert.equal(boat.x,p.actor.x);assert.equal(boat.y,p.actor.y);
   }
  }
 }finally{clearInterval(room.timer);}
});

test('click routes beyond either polar latitude reach their chosen water point in the worker',async()=>{
 const room=await makeRoom();
 try{
  for(const sign of [-1,1]){
   room.connections.clear();room.boats=[];
   const m=mapOf('home'),p=addPlayer(room,21000+sign,{islandId:'home',mode:'sailing',x:m.cx+12000,y:m.cy+sign*19900});
   const boat={id:'home-0',islandId:'home',x:p.actor.x,y:p.actor.y,occupant:p.actor.id,turn:0};
   room.boats.push(boat);p.actor.boatId=boat.id;
   const goal={x:p.actor.x+400,y:p.actor.y+sign*1000};assert.ok(setSailDestination(p.actor,goal.x,goal.y,room.boats));
   for(let step=0;step<200&&p.actor.sailTarget;step++)room.step();
   assert.equal(p.actor.islandId,'home');assert.equal(p.actor.mode,'sailing');
   assert.ok(Math.hypot(p.actor.x-goal.x,p.actor.y-goal.y)<1);
   assert.equal(boat.x,p.actor.x);assert.equal(boat.y,p.actor.y);
   assert.ok(Math.abs(seaPosition('home',p.actor).y)>20000);
  }
 }finally{clearInterval(room.timer);}
});

test('sailing through either pole continues along the opposite meridian past the former limit',()=>{
 const m=mapOf('home');
 for(const sign of [-1,1]){
  const start={x:m.cx+15000,y:m.cy+sign*19990};
  const actor={...start,islandId:'home',mode:'sailing'};
  const before=seaFrame('home',actor);
  sailStep(actor,.05,{x:0,y:sign});
  const after=seaFrame('home',actor);
  assert.equal(actor.x,start.x);
  assert.ok(Math.abs(actor.y-start.y-sign*SAIL_SPEED*.05)<1e-8);
  assert.ok(Math.abs(Math.abs(after.lon-before.lon)-Math.PI)<1e-10);
  assert.ok(Math.abs(after.lat)<Math.PI/2);
  assert.ok(Math.hypot(...after.center.map((value,k)=>value-before.center[k]))<.01);
  actor.y=start.y;
  const passage=12_000,elapsed=passage/SAIL_SPEED;
  for(let t=0;t<elapsed;t+=.1)sailStep(actor,Math.min(.1,elapsed-t),{x:0,y:sign});
  assert.ok(Math.abs(actor.y-start.y-sign*passage)<1e-6);
  const end=seaFrame('home',actor);
  const nextLap=seaFrame('home',{...actor,y:actor.y+sign*SEA_WIDTH});
  assert.ok(Math.hypot(...end.center.map((value,k)=>value-nextLap.center[k]))<1e-8);
 }
});

test('boats and coastlines share the reflected chart across the poles',()=>{
 const home=mapOf('home');
 const viewer={islandId:'home',x:home.cx+55000,y:home.cy-31000};
 const peer={islandId:'home',x:home.cx+15000,y:home.cy-9000,turn:Math.PI};
 const image=seaViewPose(viewer,peer);
 assert.equal(image.x,viewer.x);
 assert.equal(image.y,viewer.y);
 assert.ok(Math.abs(image.turn)<1e-12);
 assert.equal(boatRoom(viewer,[{...peer,id:'peer'}]),false);
 const spawn=mapOf('home').spawn;
 assert.equal(canSail(spawn.x+SEA_WIDTH/2,2*home.cy-SEA_WIDTH/2-spawn.y,'home'),false);
});
