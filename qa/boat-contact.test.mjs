import test from 'node:test';
import assert from 'node:assert/strict';
import {BOAT_GAP,SAIL_SPEED,boatSpots,canSail,sailStep} from '../src/gameplay/islands.js';
import {unplaceRigid} from '../src/world/rigid.js';
import {SEA_WIDTH,wrapSea} from '../src/world/flat-layout.js';

const gap=(a,b)=>Math.hypot(wrapSea(a.x-b.x),a.y-b.y);
const sailor=()=>({id:'sailor',boatId:'mine',islandId:'home',mode:'sailing',x:3000,y:11000});

test('glancing manual contact slides along the other boat without overlap or a speed boost',()=>{
  const actor=sailor(),other={id:'other',islandId:'home',x:actor.x+BOAT_GAP+.1,y:actor.y};
  const start={...actor};
  for(let k=0;k<60;k++){
    const before={...actor};
    sailStep(actor,.05,{x:1,y:.6},null,[other]);
    assert.ok(gap(actor,other)>=BOAT_GAP+.1-1e-7,'hulls stay separated');
    assert.ok(gap(actor,before)<=SAIL_SPEED*.05+1e-7,'sliding cannot add speed');
    assert.ok(canSail(actor.x,actor.y,actor.islandId),'sliding stays in water');
  }
  assert.ok(actor.y-start.y>100,'glancing steering keeps moving around the contact');
  assert.deepEqual(other,{id:'other',islandId:'home',x:start.x+BOAT_GAP+.1,y:start.y},'contact never moves the other boat');
});

test('a head-on bump stops, but the sailor can immediately back away',()=>{
  const actor=sailor(),start={...actor},other={id:'other',islandId:'home',x:actor.x+BOAT_GAP+.1,y:actor.y};
  for(let k=0;k<10;k++)sailStep(actor,.05,{x:1,y:0},null,[other]);
  assert.equal(actor.x,start.x);assert.equal(actor.y,start.y);assert.equal(actor.travel,0);
  sailStep(actor,.05,{x:-1,y:0},null,[other]);
  assert.ok(actor.x<start.x-28,'reverse movement is never trapped at contact');
});

test('manual sliding uses the same contact across neighbouring charts and wrapped copies',()=>{
  const origin=sailor(),point={x:origin.x+BOAT_GAP+.1,y:origin.y};
  const variants=[
    {id:'other',islandId:'home',...point,x:point.x+SEA_WIDTH},
    {id:'other',islandId:'home',...point,x:point.x-SEA_WIDTH},
    {id:'other',islandId:'blossom',...unplaceRigid('home','blossom',point)},
  ];
  let expected;
  for(const other of variants){
    const actor=sailor();
    for(let k=0;k<20;k++)sailStep(actor,.05,{x:1,y:.6},null,[other]);
    expected??=actor;
    assert.ok(Math.hypot(actor.x-expected.x,actor.y-expected.y)<1e-6);
    assert.ok(actor.y>origin.y+20);
  }
});

test('contact beside a shore never projects a manual step onto land',()=>{
  for(const start of boatSpots('home'))for(const [x,y]of [[1,1],[1,-1],[-1,1],[-1,-1]]){
    const actor={...sailor(),...start},other={id:'other',islandId:'home',x:start.x+(BOAT_GAP+.1)*x,y:start.y};
    for(let k=0;k<20;k++){
      sailStep(actor,.05,{x,y},null,[other]);
      assert.ok(canSail(actor.x,actor.y,actor.islandId));
      assert.ok(gap(actor,other)>=BOAT_GAP+.1-1e-7);
    }
  }
});
