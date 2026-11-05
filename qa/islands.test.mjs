import assert from 'node:assert/strict';
import test from 'node:test';
import {ISLANDS,HARBOR,SEA_BOUNDS,offshoreProgress,createBoats,canSail,canDock,sailStep,setSailDestination,crossIsland,destinationsFor,boatSpots,boardingPoint,landingSpot,landingApproach,fillMoorings,retireBoat,boatHome,boatSlot,MOORING_CLEAR} from '../src/pixi/islands.js';

import {createNavigation} from '../src/pixi/navigation.js';
import {offsetOf} from '../src/pixi/world-map.js';
import world from '../rive/web/world.json' with {type:'json'};
import walkWorld from '../rive/web/walk-world.json' with {type:'json'};

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

test('you can dock at ANY island whose shore you are beside, not only the listed neighbours', () => {
  // boss 6 Nov: sailing off isle-250, right beside isle-176's beach (drawn on screen, but not one of 250's jetty neighbours),
  // there was no Dock button. Now any island in the sea counts, and the hop lands you on that island's own sand.
  const boat={...sailor('isle-250'),x:9437.2,y:-8174.4};
  assert.ok(!destinationsFor('isle-250').some(d => d.destination==='isle-176'),'isle-176 is not a jetty neighbour of isle-250');
  assert.ok(canSail(boat.x,boat.y,'isle-250'),'the boat is afloat there');
  const spot=landingSpot(boat);
  assert.ok(spot,'the Dock button shows');
  assert.equal(spot.islandId,'isle-176');
  assert.ok(createNavigation({...world,...walkWorld}).walkable(spot.x,spot.y),'the hop lands on isle-176\'s walkable sand (its own local coordinates)');
  spot.approach=landingApproach(boat,spot);
  assert.ok(canSail(spot.approach.x,spot.approach.y,'isle-250'),'the approach is open water');
  if (Math.hypot(spot.approach.x-boat.x,spot.approach.y-boat.y)>14) {
    assert.ok(setSailDestination(boat,spot.approach.x,spot.approach.y),'and the boat has a route in');
    for (let k=0;boat.sailTarget && k<400;k++) sailStep(boat,.05,ZERO);
    assert.ok(Math.hypot(boat.x-spot.approach.x,boat.y-spot.approach.y)<=14,'the boat arrives beside the shore');
  }
  // and every island drawn in a sea is solid: the boat cannot sail across isle-176's middle
  const o=offsetOf('isle-250','isle-176');
  assert.equal(canSail(o.x+world.width/2,o.y+world.height/2,'isle-250'),false,'isle-176 is land, not sea');
});

test('docking off a beach sails in to the water beside the sand, and every approach is one the boat can reach', () => {
  // boss 5 Nov ("dock fix"): the boat sails right up to the shore before the Ducky hops out
  const boat={...sailor(),x:220,y:1960}, spot=landingSpot(boat); spot.approach=landingApproach(boat,spot); const sand={x:spot.x+spot.offset.x,y:spot.y+spot.offset.y};
  assert.equal(canDock(boat),false,'a beach, not the harbor');
  assert.ok(Math.hypot(spot.approach.x-boat.x,spot.approach.y-boat.y)>200,'the boat starts well out');
  assert.ok(Math.hypot(spot.approach.x-sand.x,spot.approach.y-sand.y)<150,'the approach is the water right beside the sand');
  assert.ok(setSailDestination(boat,spot.approach.x,spot.approach.y));
  for (let k=0;boat.sailTarget && k<400;k++) sailStep(boat,.05,ZERO);
  assert.ok(Math.hypot(boat.x-spot.approach.x,boat.y-spot.approach.y)<=14,'the boat arrives beside the shore');
  // a narrow cove: the first open water by the sand has no route in, so the approach backs off to water the boat can reach
  const cove={...sailor(),x:400,y:1240}, inlet=landingSpot(cove); inlet.approach=landingApproach(cove,inlet);
  assert.ok(canSail(inlet.approach.x,inlet.approach.y),'the approach is open water');
  assert.ok(setSailDestination({...cove},inlet.approach.x,inlet.approach.y) || Math.hypot(inlet.approach.x-cove.x,inlet.approach.y-cove.y)<=14,'and reachable');
  // anywhere off a shore: either the boat is already beside the sand (it lands at once) or it has a route in
  for (let x=-500;x<6500;x+=60) for (let y=-500;y<4800;y+=60) {
    const here={...sailor(),x,y};
    if (!canSail(x,y) || canDock(here)) continue;
    const at=landingSpot(here);
    if (at) at.approach=landingApproach(here,at);
    if (at && Math.hypot(at.approach.x-x,at.approach.y-y)>14) assert.ok(setSailDestination({...here},at.approach.x,at.approach.y),`${x},${y} can sail to its approach`);
  }
});

test('a boat out in a neighbour\'s waters is drawn in that neighbour\'s copy, never under it', async () => {
  const {copyHolding,WORLD_ISLANDS,offsetOf} = await import('../src/pixi/world-map.js');
  const world=(await import('../rive/web/world.json',{with:{type:'json'}})).default;
  const cx=world.width/2, cy=world.height/2;
  // the copies drawn round home, placed the way archipelago.js places them
  const copies=WORLD_ISLANDS.filter(island => island.id!=='home').map(island => ({id:island.id,x:cx+offsetOf('home',island.id).x,y:cy+offsetOf('home',island.id).y}));
  for (const d of destinationsFor('home')) {
    assert.equal(copyHolding(d.dock.x,d.dock.y,copies)?.id,d.destination,`at ${d.destination}'s jetty`);
    assert.equal(copyHolding(d.dock.x-100,d.dock.y+60,copies)?.id,d.destination,`beside ${d.destination}'s jetty`);
  }
  for (const p of [HARBOR.water,HARBOR.land,{x:cx,y:cy},...boatSpots()]) assert.equal(copyHolding(p.x,p.y,copies),null,'on the real island nothing is lifted');
});

// boss 6 Nov: "I took the boat already. Every island should have all the boats."
const mooredAt=(boats,islandId) => boatSpots().map((spot,slot) => boats.some(boat => !boat.occupant && boat.islandId===islandId && boatHome(boat)===islandId && boatSlot(boat)===slot && boat.x===spot.x && boat.y===spot.y));
const countOn=(boats,islandId) => boats.filter(boat => boat.islandId===islandId).length;

test('after taking a boat and sailing clear of the jetty its mooring holds a fresh boat, and two sailors can take from it in turn', () => {
  const boats=createBoats(), per=boatSpots().length;
  for (const slot of [0,3,per-1]) {   // a harbor berth, an islet and a beach mooring
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

test('docking at another island leaves its moorings full; the boat you arrived in drifts off and nothing piles up', () => {
  const boats=createBoats(), per=boatSpots().length, there=destinationsFor('home')[0].destination;
  const boat=boats.find(boat => boat.id==='home-3');
  let lowest=Infinity;
  const check=() => {fillMoorings(boats); lowest=Math.min(lowest,...ISLANDS.map(island => countOn(boats,island.id)));};
  boat.occupant='duck';
  check();
  for (let step=1;step<=8;step++) {Object.assign(boat,{x:boat.x-step*60}); check();}   // sails clear of the islet
  Object.assign(boat,{islandId:there,x:2400,y:300}); check();   // crosses into the neighbour's waters
  assert.equal(countOn(boats,there),per+1,'the neighbour shows its own boats plus yours');
  retireBoat(boats,boat); check();   // hops out on the neighbour's shore
  assert.equal(boats.includes(boat),false,'the boat you arrived in is gone (it fades out)');
  assert.ok(mooredAt(boats,there).every(Boolean),`all ${per} of ${there}'s moorings are full`);
  assert.ok(mooredAt(boats,'home').every(Boolean),'and home is full too');
  assert.equal(boats.length,ISLANDS.length*per,'nothing piled up anywhere');
  assert.ok(lowest>=per,`no island ever showed fewer than ${per} boats (lowest ${lowest})`);
  // stepping straight back off beside your own empty mooring ties the same boat back up
  const quick=boats.find(boat => boat.id==='home-0');
  quick.occupant='duck'; quick.x+=30; retireBoat(boats,quick);
  assert.ok(boats.includes(quick) && quick.x===boatSpots()[0].x && mooredAt(boats,'home')[0]);
  assert.equal(boats.length,ISLANDS.length*per);
});

test('every island has its full mooring list, even from an old save that only knew a few islands or left boats stranded', () => {
  const per=boatSpots().length;
  const saved=createBoats().filter(boat => boat.islandId==='home');
  Object.assign(saved[2],{x:900,y:1700});   // the old "moored where you left it" boat, off its mooring
  saved.push({...saved[2],id:'home-2~old'});   // and a spare
  saved.push({id:'nowhere-1',islandId:'nowhere',x:0,y:0,occupant:null});
  fillMoorings(saved);
  assert.equal(saved.length,ISLANDS.length*per);
  for (const island of ISLANDS) assert.ok(mooredAt(saved,island.id).every(Boolean),`${island.id} has all ${per} boats`);
  assert.equal(fillMoorings(saved),false,'a full set is left alone');
});
