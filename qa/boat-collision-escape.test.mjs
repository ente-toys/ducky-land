import test from 'node:test';
import assert from 'node:assert/strict';
import {ISLANDS, BOAT_GAP, SAIL_SPEED, canSail, sailStep, setSailDestination} from '../src/gameplay/islands.js';
import {placeRigid, unplaceRigid} from '../src/world/rigid.js';
import {SEA_WIDTH, wrapSea} from '../src/world/flat-layout.js';
import {makeRoom, addPlayer} from './room-harness.mjs';

const dt=.05, distance=(a,b)=>Math.hypot(wrapSea(a.x-b.x),a.y-b.y);
const sailor=(id,at,islandId='home')=>({id,boatId:id,islandId,mode:'sailing',...at});
const inHome=actor=>actor.islandId==='home'?actor:placeRigid('home',actor.islandId,actor);
function step(actor,boats) {
  const before={...actor};
  sailStep(actor,dt,{x:0,y:0},null,boats);
  assert(distance(before,actor)<=SAIL_SPEED*dt+1e-6,'collision response never jumps beyond one movement step');
  assert(canSail(actor.x,actor.y,actor.islandId),'the hull stays in water');
}

test('a planned route escapes the narrow gap between movement and routing clearance in every chart copy',()=>{
  for(const offset of [0,SEA_WIDTH,-SEA_WIDTH])for(const {id}of ISLANDS){
    const actor=sailor('mine',{x:3000+offset,y:10000});
    // A legal movement stop at 260.5 used to be rejected by the planner's 261 margin.
    const obstacle={id:'other',islandId:id,...unplaceRigid('home',id,{x:actor.x+BOAT_GAP+.5,y:actor.y})};
    const goal={x:2000+offset,y:10000};
    assert.deepEqual(setSailDestination(actor,goal.x,goal.y,[obstacle]),[goal.x,goal.y],`${id}, copy ${offset}`);
    for(let k=0;k<100&&actor.sailTarget;k++){
      step(actor,[obstacle]);
      assert(distance(actor,placeRigid('home',id,obstacle))>=BOAT_GAP+.5-1e-6,'escaping never gets closer to the other boat');
    }
    assert(distance(actor,goal)<1,'the requested water destination remains reachable');
  }
});

test('a close boat may route round its neighbour but cannot cut through its hull',()=>{
  const actor=sailor('mine',{x:3000,y:10000});
  const obstacle={id:'other',islandId:'home',x:3260.5,y:10000},goal={x:4500,y:10000};
  assert.deepEqual(setSailDestination(actor,goal.x,goal.y,[obstacle]),[goal.x,goal.y]);
  for(let k=0;k<300&&actor.sailTarget;k++){
    step(actor,[obstacle]);
    assert(distance(actor,obstacle)>=BOAT_GAP+.1-1e-6,'rerouting preserves the existing collision gap');
  }
  assert(distance(actor,goal)<1);
});

test('the room accepts close-gap manual steering without recovering or teleporting its sailor',async()=>{
  const room=await makeRoom();
  try{
    const {actor,socket}=addPlayer(room,9854,{islandId:'home',mode:'sailing',x:3000,y:10000});
    const boat=room.boats.find(b=>b.id==='home-0'),obstacle=room.boats.find(b=>b.id==='home-1');
    Object.assign(boat,{x:actor.x,y:actor.y,occupant:actor.id});actor.boatId=boat.id;
    Object.assign(obstacle,{x:actor.x+BOAT_GAP+.5,y:actor.y});
    room.webSocketMessage(socket,JSON.stringify({type:'destination',seq:1,x:2000,y:10000}));
    assert.ok(!actor.sailTarget,'the server ignores water destinations');
    room.webSocketMessage(socket,JSON.stringify({type:'input',seq:2,x:-1,y:0}));
    for(let k=0;k<35;k++){
      const before={...actor};room.step();
      assert(distance(before,actor)<=SAIL_SPEED*dt+1e-6,'server recovery does not relocate a legal close-gap sailor');
      assert(distance(actor,obstacle)>=BOAT_GAP+.5-1e-6);
      assert(canSail(actor.x,actor.y,'home'));
      assert.deepEqual([boat.x,boat.y],[actor.x,actor.y],'the authoritative boat follows its sailor exactly');
    }
    assert.equal(actor.mode,'sailing');
    assert(distance(actor,{x:2000,y:10000})<5);
  }finally{clearInterval(room.timer);room.bog?.dispose();}
});

for(const crossing of [false,true])test(`${crossing?'crossing':'head-on'} moving boats replan without freezing, including foreign and wrapped charts`,()=>{
  for(const offset of [0,SEA_WIDTH,-SEA_WIDTH])for(const foreign of [false,true]){
    const first=sailor('a',{x:3000+offset,y:11000});
    const start={x:(crossing?4000:5000)+offset,y:crossing?10000:11000};
    const frame=foreign?'blossom':'home';
    const second=sailor('b',unplaceRigid('home',frame,start),frame),boats=[first,second];
    const goals=[{x:6000+offset,y:11000},{x:(crossing?4000:2000)+offset,y:crossing?13000:11000}];
    for(let i=0;i<boats.length;i++){
      const goal=unplaceRigid('home',boats[i].islandId,goals[i]);
      assert.deepEqual(setSailDestination(boats[i],goal.x,goal.y,boats),[goal.x,goal.y]);
    }
    for(let k=0;k<500&&boats.some(p=>p.sailTarget);k++)for(const actor of boats){
      step(actor,boats);
      assert(distance(inHome(first),inHome(second))>=BOAT_GAP+.1-1e-6,'moving boats remain separated after each individual step');
    }
    for(let i=0;i<boats.length;i++)assert(distance(inHome(boats[i]),goals[i])<1,`boat ${i} reaches its target, foreign ${foreign}, copy ${offset}`);
  }
});
