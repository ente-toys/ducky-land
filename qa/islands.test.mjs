import assert from 'node:assert/strict';
import test from 'node:test';
import {ISLANDS,HARBOR,SEA_BOUNDS,offshoreProgress,createBoats,canSail,canDock,sailStep,setSailDestination,crossIsland,destinationsFor,boatSpots,boardingPoint,landingSpot} from '../src/pixi/islands.js';

const ZERO={x:0,y:0};
const sailor=(islandId='home') => ({id:'player',islandId,mode:'sailing',boatId:'home-0',x:1800,y:430,turn:0,path:[],action:0});

test('300 island copies, the same moored boats each, at least four reachable neighbours and safe harbor positions', () => {
  const boats=createBoats();
  assert.equal(ISLANDS.length,300);
  assert.equal(new Set(ISLANDS.map(island => island.id)).size,300);
  const per=boatSpots().length;
  assert.ok(per>=8);
  assert.equal(new Set(boats.map(boat => boat.id)).size,300*per);
  for (const island of ISLANDS) {
    assert.equal(boats.filter(boat => boat.islandId===island.id).length,per);
    assert.ok(destinationsFor(island.id).length>=4);
  }
  for (const position of [...boats.filter(boat => boat.islandId==='home'),...destinationsFor('home').map(island=>island.dock),HARBOR.water]) assert.ok(canSail(position.x,position.y));
  assert.equal(canSail(HARBOR.land.x,HARBOR.land.y),false);
  assert.equal(canSail(4140,1520),false);
  assert.equal(canSail(1640,2630),false);
  assert.equal(canSail(0,0),true);
  assert.equal(canSail(SEA_BOUNDS.x0-1,0),false);
  for (const island of destinationsFor('home')) assert.equal(canSail(island.x,island.y),false,'a neighbour is real land');
  assert.equal(canSail(NaN,200),false);
  assert.equal(canDock(sailor()),true);
  assert.equal(canDock({...sailor(),x:500,y:300}),false);
  assert.equal(canSail(HARBOR.pier.x+65,HARBOR.pier.y),false);
});

test('every island can be reached from home by boat', () => {
  const seen=new Set(['home']), queue=['home'];
  while (queue.length) for (const next of destinationsFor(queue.shift())) if (!seen.has(next.destination)) {seen.add(next.destination); queue.push(next.destination);}
  assert.equal(seen.size,300);
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
  assert.ok(c.y>=SEA_BOUNDS.y0+46);
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

test('voyages dock at the named island and do not bounce back', () => {
  for (const island of ISLANDS.slice(0,40)) for (const destination of destinationsFor(island.id)) {
    const a={...sailor(island.id),...destination.dock};
    assert.equal(crossIsland(a),true);
    assert.equal(a.islandId,destination.destination);
    assert.deepEqual([a.x,a.y],[HARBOR.water.x,HARBOR.water.y]);
    assert.equal(a.docking,true);
    assert.equal(crossIsland(a),false);
    const returning=destinationsFor(a.islandId).find(candidate => candidate.destination===island.id);
    Object.assign(a,returning.dock);
    assert.equal(crossIsland(a),true);
    assert.equal(a.islandId,island.id);
    a.mode='walking';
    Object.assign(a,returning.dock);
    assert.equal(crossIsland(a),false);
  }
});

test('a tapped neighbour is reached by sailing round the coasts', () => {
  for (const destination of destinationsFor('home')) {
    const a={...sailor(),...HARBOR.water};
    assert.deepEqual(setSailDestination(a,destination.dock.x,destination.dock.y),[destination.dock.x,destination.dock.y]);
    for (let i=0;i<3000 && a.sailTarget;i++) {assert.ok(canSail(a.x,a.y)); sailStep(a,.05,ZERO);}
    assert.equal(crossIsland(a),true);
    assert.equal(a.islandId,destination.destination);
  }
});

test('clouds build offshore before destination islands are reached', () => {
  assert.equal(offshoreProgress(HARBOR.water),0);
  assert.ok(offshoreProgress({y:-200})>0);
  assert.equal(offshoreProgress({y:-1000}),1);
  const a=sailor();
  const destination=destinationsFor(a.islandId)[0];
  assert.ok(Math.hypot(a.x-destination.dock.x,a.y-destination.dock.y)>1800);
  assert.deepEqual(setSailDestination(a,destination.dock.x,destination.dock.y),[destination.dock.x,destination.dock.y]);
  for (let i=0;i<3000;i++) {
    sailStep(a,.05,ZERO);
    if (crossIsland(a)) break;
  }
  assert.equal(a.islandId,destination.destination);
});

test('any boat can be boarded from nearby sand, and you can land on any shore you sail close to', () => {
  for (const boat of createBoats().filter(boat => boat.islandId==='home')) {
    const deck=boardingPoint(boat);
    assert.ok(Math.hypot(deck.x-boat.x,deck.y-boat.y)>40 && Math.hypot(deck.x-boat.x,deck.y-boat.y)<300,boat.id);
  }
  assert.ok(landingSpot({islandId:'home',...HARBOR.water}),'the harbor shore is in reach');
  assert.equal(landingSpot({islandId:'home',x:-1500,y:-1500}),null,'open sea: nothing to land on');
  const off=destinationsFor('home')[0].offset, there=landingSpot({islandId:'home',x:HARBOR.water.x+off.x,y:HARBOR.water.y+off.y});
  assert.equal(there.islandId,destinationsFor('home')[0].destination,'a neighbour shore lands you on that island');
});
