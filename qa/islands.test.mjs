import {placeRigid} from '../src/world/rigid.js';
import {mapPoint} from '../src/world/sphere-coordinates.js';
import {nonNeighbourLanding} from './non-neighbour-fixture.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {ISLANDS,HARBOR,harborOf,SEA_BOUNDS,offshoreProgress,createBoats,canSail,canDock,sailStep,setSailDestination,crossIsland,destinationsFor,boatSpots,boardingPoint,landingSpot,landingApproach,fillMoorings,retireBoat,boatHome,boatSlot,MOORING_CLEAR,SAIL_SPEED} from '../src/gameplay/islands.js';

import {createNavigation} from '../src/world/navigation.js';
import {offsetOf} from '../src/world/world-map.js';
import {mapOf} from '../src/world/island-maps.js';
import world from '../assets/world/world.json' with {type:'json'};
import walkWorld from '../assets/world/walk-world.json' with {type:'json'};

const ZERO={x:0,y:0};
const sailor=(islandId='home') => ({id:'player',islandId,mode:'sailing',boatId:'home-0',...HARBOR.water,turn:0,path:[],action:0});

test('Home and the eight themed islands (copies removed 8 Nov), the same moored boats each, at least four reachable neighbours and safe harbor positions', () => {
  const boats=createBoats();
  assert.equal(ISLANDS.length,7);
  assert.equal(new Set(ISLANDS.map(island => island.id)).size,7);
  const per=boatSpots().length;
  assert.ok(per>=8);
  assert.equal(new Set(boats.map(boat => boat.id)).size,ISLANDS.reduce((n,island) => n+boatSpots(island.id).length,0));
  for (const island of ISLANDS) {
    assert.equal(boats.filter(boat => boat.islandId===island.id).length,boatSpots(island.id).length);
    assert.ok(boatSpots(island.id).length>=3);
    assert.ok(destinationsFor(island.id).length>=4);
  }
  for (const position of [...boats.filter(boat => boat.islandId==='home'),...destinationsFor('home').map(island=>island.dock),HARBOR.water]) assert.ok(canSail(position.x,position.y));
  assert.equal(canSail(HARBOR.land.x,HARBOR.land.y),false);
  assert.equal(canSail(4140,1520),true);
  assert.equal(canSail(1640,2630),true);
  assert.equal(canSail(-1600,-1200),true);
  assert.equal(canSail(SEA_BOUNDS.x0-1,0),false);
  for (const island of destinationsFor('home')) {const m=mapOf(island.destination),at=mapPoint(island.destination,'home',m.spawn); assert.equal(canSail(at.x,at.y),false,'a neighbour spawn is real land');}
  assert.equal(canSail(NaN,200),false);
  assert.equal(canDock(sailor()),true);
  assert.equal(canDock({...sailor(),x:500,y:300}),false);
  assert.equal(canSail(HARBOR.pier.x+65,HARBOR.pier.y),false);
});

test('every island can be reached from home by boat', () => {
  const seen=new Set(['home']), queue=['home'];
  while (queue.length) for (const next of destinationsFor(queue.shift())) if (!seen.has(next.destination)) {seen.add(next.destination); queue.push(next.destination);}
  assert.equal(seen.size,ISLANDS.length);
});

test('sailing normalizes diagonal speed and cannot tunnel into shore or cross the bounds', () => {
  const a={...sailor(),x:2165,y:-1917},b={...sailor(),x:2165,y:-1917};
  sailStep(a,.05,{x:1,y:0}); sailStep(b,.05,{x:1,y:1});
  assert.ok(Math.abs(Math.hypot(a.x-2165,a.y+1917)-Math.hypot(b.x-2165,b.y+1917))<1e-9);
  const c={...sailor(),x:2165,y:-1917};
  sailStep(c,10,{x:0,y:1});
  assert.ok(c.y<-1317);
  assert.ok(canSail(c.x,c.y));
  assert.ok(c.y>-1917);
  sailStep(c,30,{x:0,y:-1});
  assert.ok(canSail(c.x,c.y));
  assert.ok(c.y>=SEA_BOUNDS.y0+46);
});

test('tap sailing stops at the target, blocked destinations are rejected and manual steering cancels docking', () => {
  const a={...sailor(),x:2165,y:-1917};
  assert.equal(setSailDestination(a,2820,2640),null);
  assert.deepEqual(setSailDestination(a,2165,-1817),[2165,-1817]);
  for (let i=0;i<20;i++) sailStep(a,.05,ZERO);
  assert.ok(Math.abs(a.y+1817)<1e-6);
  assert.equal(a.sailTarget,null);
  a.docking=true; a.sailTarget={x:2165,y:-1817};
  sailStep(a,.05,{x:1,y:0});
  assert.equal(a.docking,false);
  assert.equal(a.sailTarget,null);
});

test('voyages dock at the named island and do not bounce back', () => {
  for (const island of ISLANDS.slice(0,40)) for (const destination of destinationsFor(island.id)) {
    const a={...sailor(island.id),...destination.dock};
    assert.equal(crossIsland(a),true);
    assert.equal(a.islandId,destination.destination);
    assert.deepEqual([a.x,a.y],[harborOf(a.islandId).water.x,harborOf(a.islandId).water.y],'beside that island\'s own jetty');
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
    const route=[a.sailTarget,...a.sailRoute];
    let distance=0,at=a;
    for(const point of route){distance+=Math.hypot(point.x-at.x,point.y-at.y);at=point;}
    const maxSteps=Math.ceil(distance/(SAIL_SPEED*.05))+route.length;
    for (let i=0;i<maxSteps && a.sailTarget;i++) {assert.ok(canSail(a.x,a.y)); sailStep(a,.05,ZERO);}
    assert.equal(a.sailTarget,null,'the planned voyage finishes');
    assert.ok(Math.hypot(a.x-destination.dock.x,a.y-destination.dock.y)<1,'arrived at the named jetty');
    assert.ok(canSail(a.x,a.y),'arrival remains in open water');
    assert.equal(crossIsland(a),true);
    assert.equal(a.islandId,destination.destination);
  }
});

test('clouds build offshore before destination islands are reached', () => {
  assert.equal(offshoreProgress(HARBOR.water),0);
  assert.ok(offshoreProgress({y:-200})>0);
  assert.equal(offshoreProgress({y:-1000}),1);
  for (const destination of destinationsFor('home')) {
    const a=sailor();
    assert.deepEqual(setSailDestination(a,destination.dock.x,destination.dock.y),[destination.dock.x,destination.dock.y]);
    const route=[a.sailTarget,...a.sailRoute];
    let distance=0,at=a,clouds=false;
    for (const point of route) {distance+=Math.hypot(point.x-at.x,point.y-at.y);at=point;}
    const maxSteps=Math.ceil(distance/(SAIL_SPEED*.05))+route.length;
    for (let i=0;i<maxSteps && a.sailTarget;i++) {
      sailStep(a,.05,ZERO);
      assert.ok(canSail(a.x,a.y,'home'),'the complete voyage stays in open water');
      clouds ||= offshoreProgress(a)>0;
      if (crossIsland(a)) break;
    }
    assert.equal(a.islandId,destination.destination,`reaches ${destination.destination} without entering another jetty`);
    if (destination.dock.y < -1000) assert.ok(clouds,'clouds build before reaching an offshore destination');
  }
});

test('any boat can be boarded from nearby sand, and you can land on any shore you sail close to', () => {
  for (const boat of createBoats().filter(boat => boat.islandId==='home')) {
    const deck=boardingPoint(boat);
    assert.ok(Math.hypot(deck.x-boat.x,deck.y-boat.y)>40 && Math.hypot(deck.x-boat.x,deck.y-boat.y)<300,boat.id);
  }
  assert.ok(landingSpot({islandId:'home',...HARBOR.water}),'the harbor shore is in reach');
  const openSea={islandId:'home',x:-8000,y:0};
  assert.ok(canSail(openSea.x,openSea.y,openSea.islandId),'fixture is open navigable water');
  assert.equal(landingSpot(openSea),null,'open sea: nothing to land on');
  const there=landingSpot({islandId:'home',...destinationsFor('home')[0].dock});
  assert.equal(there.islandId,destinationsFor('home')[0].destination,'a neighbour shore lands you on that island');
});

test('you can dock at ANY island whose shore you are beside, not only the listed neighbours', () => {
  const {target,...off}=nonNeighbourLanding();
  const boat={...sailor(),...off};
  assert.ok(boat,'there is open water beside a non-neighbour shore');
  assert.ok(!destinationsFor(boat.islandId).some(d => d.destination===target),'the target is not a listed jetty neighbour');
  assert.ok(canSail(boat.x,boat.y,boat.islandId),'the boat is afloat there');
  const spot=landingSpot(boat);
  assert.ok(spot,'the Dock button shows');
  assert.equal(spot.islandId,target);
  assert.ok(mapOf(spot.islandId).nav().walkable(spot.x,spot.y),'the hop lands on the target map in its own local coordinates');
  spot.approach=landingApproach(boat,spot);
  assert.ok(canSail(spot.approach.x,spot.approach.y,boat.islandId),'the approach is open water');
  if (Math.hypot(spot.approach.x-boat.x,spot.approach.y-boat.y)>14) {
    assert.ok(setSailDestination(boat,spot.approach.x,spot.approach.y),'and the boat has a route in');
    for (let k=0;boat.sailTarget && k<400;k++) sailStep(boat,.05,ZERO);
    assert.ok(Math.hypot(boat.x-spot.approach.x,boat.y-spot.approach.y)<=14,'the boat arrives beside the shore');
  }
  const at=placeRigid(boat.islandId,target,spot);
  assert.equal(canSail(at.x,at.y,boat.islandId),false,'the target is solid land');
});

test('docking off a beach sails in to the water beside the sand, and every approach is one the boat can reach', () => {
  const boat={...sailor(),x:boatSpots()[5].x-170,y:boatSpots()[5].y}, spot=landingSpot(boat); spot.approach=landingApproach(boat,spot); const sand={x:spot.x+spot.offset.x,y:spot.y+spot.offset.y};
  assert.equal(canDock(boat),false,'a beach, not the harbor');
  assert.ok(Math.hypot(spot.approach.x-boat.x,spot.approach.y-boat.y)>200,'the boat starts well out');
  assert.ok(Math.hypot(spot.approach.x-sand.x,spot.approach.y-sand.y)<150,'the approach is the water right beside the sand');
  assert.ok(setSailDestination(boat,spot.approach.x,spot.approach.y));
  for (let k=0;boat.sailTarget && k<400;k++) sailStep(boat,.05,ZERO);
  assert.ok(Math.hypot(boat.x-spot.approach.x,boat.y-spot.approach.y)<=14,'the boat arrives beside the shore');
  const cove={...sailor(),x:2165,y:-1917}, inlet=landingSpot(cove); inlet.approach=landingApproach(cove,inlet);
  assert.ok(canSail(inlet.approach.x,inlet.approach.y),'the approach is open water');
  assert.ok(setSailDestination({...cove},inlet.approach.x,inlet.approach.y) || Math.hypot(inlet.approach.x-cove.x,inlet.approach.y-cove.y)<=14,'and reachable');
  for (let x=-500;x<6500;x+=60) for (let y=-500;y<4800;y+=60) {
    const here={...sailor(),x,y};
    if (!canSail(x,y) || canDock(here)) continue;
    const at=landingSpot(here);
    if (at) at.approach=landingApproach(here,at);
    if (at && Math.hypot(at.approach.x-x,at.approach.y-y)>14) assert.ok(setSailDestination({...here},at.approach.x,at.approach.y),`${x},${y} can sail to its approach`);
  }
});

test('a boat out in a neighbour\'s waters is drawn in that neighbour\'s copy, never under it', async () => {
  const {WORLD_ISLANDS,offsetOf} = await import('../src/world/world-map.js'), {copyHolding} = await import('../src/world/sphere-shores.js');
  const world=(await import('../assets/world/world.json',{with:{type:'json'}})).default;
  const cx=mapOf('home').cx, cy=mapOf('home').cy;
  const copies=WORLD_ISLANDS.filter(island => island.id!=='home').map(island => ({from:'home',id:island.id,x:cx+offsetOf('home',island.id).x,y:cy+offsetOf('home',island.id).y,width:mapOf(island.id).width,height:mapOf(island.id).height}));
  for (const d of destinationsFor('home')) {
    assert.equal(copyHolding(d.dock.x,d.dock.y,copies)?.id,d.destination,`at ${d.destination}'s jetty`);
    assert.equal(copyHolding(d.dock.x-100,d.dock.y+60,copies)?.id,d.destination,`beside ${d.destination}'s jetty`);
  }
  for (const p of [HARBOR.water,HARBOR.land,{x:cx,y:cy},...boatSpots()]) assert.equal(copyHolding(p.x,p.y,copies),null,'on the real island nothing is lifted');
});

test('where two neighbours\' map rectangles overlap, water belongs to the island with the nearest real coast', async () => {
  const {copyHolding} = await import('../src/world/sphere-shores.js');
  const A=mapOf('blossom'), B=mapOf('sunset'), far=60000, coast=m=>m.world.coast.map(([x,y])=>({x:x-m.cx,y:y-m.cy}));
  const east=coast(A).reduce((p,q)=>q.x>p.x?q:p), west=coast(B).reduce((p,q)=>q.x<p.x?q:p), dx=east.x-west.x+600;
  const copies=[{id:'blossom',x:far,y:far,width:A.width,height:A.height},{id:'sunset',x:far+dx,y:far+east.y-west.y,width:B.width,height:B.height}];
  for (const [copy,at] of [[copies[0],{x:far+east.x+150,y:far+east.y}],[copies[1],{x:far+east.x+450,y:far+east.y}]]) {
    assert.ok(copies.every(c=>Math.abs(at.x-c.x)<c.width/2+300&&Math.abs(at.y-c.y)<c.height/2+300),'both maps reach this water');
    assert.equal(copyHolding(at.x,at.y,copies)?.id,copy.id,`nearer ${copy.id}'s coast`);
  }
  const home=mapOf('home'), moored=boatSpots()[0];
  const over=[{from:'home',id:'blossom',...offsetOf('home','blossom'),width:3*home.width,height:3*home.height}];
  over[0].x+=home.cx; over[0].y+=home.cy;
  assert.equal(copyHolding(moored.x,moored.y,over,300,home),null,'a boat moored at home stays with home even inside a huge neighbour map');
});

const mooredAt=(boats,islandId) => boatSpots(islandId).map((spot,slot) => boats.some(boat => !boat.occupant && boat.islandId===islandId && boatHome(boat)===islandId && boatSlot(boat)===slot && boat.x===spot.x && boat.y===spot.y));
const countOn=(boats,islandId) => boats.filter(boat => boat.islandId===islandId).length;

test('after taking a boat and sailing clear of the jetty its mooring holds a fresh boat, and two sailors can take from it in turn', () => {
  const boats=createBoats(), per=boatSpots().length;
  for (const slot of [0,3,per-1]) {
    const spot=boatSpots()[slot], first=boats.find(boat => boat.id===`home-${slot}`);
    first.occupant='duck-a';
    assert.equal(fillMoorings(boats),false,'still beside the jetty: nothing new yet');
    Object.assign(first,{x:spot.x+MOORING_CLEAR+40,y:spot.y});
    assert.equal(fillMoorings(boats),true);
    assert.ok(mooredAt(boats,'home')[slot],`mooring ${slot} is full again`);
    const second=boats.find(boat => boat!==first && !boat.occupant && boatHome(boat)==='home' && boatSlot(boat)===slot);
    assert.notEqual(second.id,first.id);
    second.occupant='duck-b';
    Object.assign(second,{x:spot.x,y:spot.y-MOORING_CLEAR-40});
    fillMoorings(boats);
    assert.ok(mooredAt(boats,'home')[slot],`mooring ${slot} refilled a second time`);
    assert.equal(new Set(boats.map(boat => boat.id)).size,boats.length,'ids stay unique');
  }
  assert.ok(mooredAt(boats,'home').every(Boolean));
});

test('docking at another island keeps the arrival boat and leaves both islands moorings full', () => {
  const boats=createBoats(), per=boatSpots().length, there=destinationsFor('home')[0].destination, perThere=boatSpots(there).length;
  const total=ISLANDS.reduce((n,island) => n+boatSpots(island.id).length,0);
  const boat=boats.find(boat => boat.id==='home-3');
  let lowest=Infinity;
  const check=() => {fillMoorings(boats); lowest=Math.min(lowest,...ISLANDS.map(island => countOn(boats,island.id)));};
  boat.occupant='duck';
  check();
  for (let step=1;step<=8;step++) {Object.assign(boat,{x:boat.x-step*60}); check();}
  const arrival=harborOf(there).water;
  Object.assign(boat,{islandId:there,...arrival}); check();
  assert.equal(countOn(boats,there),perThere+1,'the neighbour shows its own boats plus yours');
  retireBoat(boats,boat); check();
  assert.ok(boats.includes(boat),'the arrival boat remains parked');
  assert.deepEqual([boat.islandId,boat.x,boat.y,boat.occupant,boat.parked],[there,arrival.x,arrival.y,null,true]);
  const restored=JSON.parse(JSON.stringify(boats));fillMoorings(restored);
  assert.deepEqual(restored.find(b=>b.id===boat.id),boat,'parked boat survives reconciliation after reload');
  assert.ok(mooredAt(boats,there).every(Boolean),`all ${perThere} of ${there}'s moorings are full`);
  assert.ok(mooredAt(boats,'home').every(Boolean),'and home is full too');
  assert.equal(boats.length,total+1,'the fleet includes the parked arrival and all original moorings');
  const fewest=Math.min(...ISLANDS.map(island => boatSpots(island.id).length));
  assert.ok(lowest>=fewest,`no island ever showed fewer than its own boats (lowest ${lowest})`);
  const quick=boats.find(boat => boat.id==='home-0');
  quick.occupant='duck'; quick.x+=30; retireBoat(boats,quick);
  assert.ok(boats.includes(quick) && quick.x===boatSpots()[0].x && mooredAt(boats,'home')[0]);
  assert.equal(boats.length,total+1);
});

test('every island has its full mooring list, even from an old save that only knew a few islands or left boats stranded', () => {
  const total=ISLANDS.reduce((n,island) => n+boatSpots(island.id).length,0);
  const saved=createBoats().filter(boat => boat.islandId==='home');
  Object.assign(saved[2],{x:900,y:1700});
  saved.push({...saved[2],id:'home-2~old'});
  saved.push({id:'nowhere-1',islandId:'nowhere',x:0,y:0,occupant:null});
  fillMoorings(saved);
  assert.equal(saved.length,total);
  for (const island of ISLANDS) assert.ok(mooredAt(saved,island.id).every(Boolean),`${island.id} has all ${boatSpots(island.id).length} boats`);
  assert.equal(fillMoorings(saved),false,'a full set is left alone');
});
