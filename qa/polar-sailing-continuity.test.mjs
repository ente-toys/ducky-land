import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRoom,addPlayer} from './room-harness.mjs';
import {mapOf} from '../src/world/island-maps.js';
import {FLAT_POSITIONS} from '../src/world/flat-layout.js';
import {canSail,SAIL_SPEED,setSailDestination} from '../src/gameplay/islands.js';
import {seaPosition} from '../src/world/sphere-coordinates.js';

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
