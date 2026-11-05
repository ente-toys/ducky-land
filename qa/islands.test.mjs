import assert from 'node:assert/strict';
import test from 'node:test';
import {ISLANDS,HARBOR,EXITS,arrivalFor,createBoats,canSail,canDock,sailStep,setSailDestination,crossIsland,exitsFor} from '../src/pixi/islands.js';

const ZERO={x:0,y:0};
const sailor=(islandId='home') => ({id:'player',islandId,mode:'sailing',boatId:'home-0',x:1800,y:430,turn:0,path:[],action:0});

test('three islands have nine unique boats, reachable ocean exits and safe harbor positions', () => {
  const boats=createBoats();
  assert.equal(new Set(boats.map(boat => boat.id)).size,9);
  for (const island of ISLANDS) {
    assert.equal(boats.filter(boat => boat.islandId===island.id).length,3);
    assert.equal(exitsFor(island.id).length,2);
  }
  for (const position of [...boats,...EXITS,HARBOR.water,...boats.map(boat => arrivalFor(boat.id))]) assert.ok(canSail(position.x,position.y));
  assert.equal(canSail(HARBOR.land.x,HARBOR.land.y),false);
  assert.equal(canSail(4140,1520),false);
  assert.equal(canSail(1640,2630),false);
  assert.equal(canSail(0,0),false);
  assert.equal(canSail(NaN,200),false);
  assert.equal(canDock(sailor()),true);
  assert.equal(canDock({...sailor(),x:500,y:300}),false);
  assert.equal(canSail(HARBOR.pier.x+65,HARBOR.pier.y),false);
});

test('sailing normalizes diagonal speed and cannot tunnel into shore or cross the bounds', () => {
  const a=sailor(),b=sailor();
  sailStep(a,.05,{x:1,y:0}); sailStep(b,.05,{x:1,y:1});
  assert.ok(Math.abs(Math.hypot(a.x-1800,a.y-430)-Math.hypot(b.x-1800,b.y-430))<1e-9);
  const c=sailor();
  sailStep(c,10,{x:0,y:1});
  assert.ok(c.y<800);
  assert.ok(canSail(c.x,c.y));
  assert.ok(c.y>430);
  sailStep(c,30,{x:0,y:-1});
  assert.ok(canSail(c.x,c.y));
  assert.ok(c.y>=106);
});

test('tap sailing stops at the target, blocked destinations are rejected and manual steering cancels docking', () => {
  const a=sailor();
  assert.equal(setSailDestination(a,1800,950),null);
  assert.deepEqual(setSailDestination(a,1800,600),[1800,600]);
  for (let i=0;i<20;i++) sailStep(a,.05,ZERO);
  assert.ok(Math.abs(a.y-600)<1e-6);
  assert.equal(a.sailTarget,null);
  a.docking=true; a.sailTarget={x:1800,y:660};
  sailStep(a,.05,{x:1,y:0});
  assert.equal(a.docking,false);
  assert.equal(a.sailTarget,null);
});

test('all six crossings have safe arrival positions and require leaving the arrival area', () => {
  for (const island of ISLANDS) for (const exit of exitsFor(island.id)) {
    const a={...sailor(island.id),x:exit.x,y:exit.y};
    assert.equal(crossIsland(a),true);
    assert.equal(a.islandId,exit.destination);
    assert.ok(canSail(a.x,a.y));
    assert.equal(a.exitLocked,true);
    assert.equal(crossIsland(a),false);
    const returnExit=exitsFor(a.islandId).find(candidate => candidate.destination===island.id);
    Object.assign(a,{x:returnExit.x,y:returnExit.y});
    assert.equal(crossIsland(a),false);
    assert.equal(a.exitLocked,false);
    assert.equal(crossIsland(a),true);
    assert.equal(a.islandId,island.id);
  }
});
