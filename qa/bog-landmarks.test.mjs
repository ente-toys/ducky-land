import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import data from '../src/pixi/bog-environment.json' with {type:'json'};
import {makeMap} from '../src/pixi/island-maps.js';
import {BOG_BLOCKERS} from '../src/pixi/bog-blockers.js';
import {BOG_AREAS} from '../src/pixi/bog-environment.js';
import {getBogBlockers} from '../src/pixi/bog-combat/blockers.js';
import {traceShot} from '../src/pixi/bog-combat/physics.js';
import {createPickupSpots} from '../src/pixi/bog-combat/pickups.js';

const root='public/pixi-art/themes/bog-arena/';
const art=JSON.parse(fs.readFileSync(root+'art.json'));
const nav=makeMap('bog-landmark-check',data).nav();
const combat=getBogBlockers();
const owner='pass2-landmarks';
const prop=id=>art.props.find(p=>p.id===id);
function reachable(x,y,from=[4200,2800]){
 assert.ok(nav.walkable(x,y),`clear floor ${x},${y}`);
 assert.ok(nav.route(...from,x,y).length,`connected floor ${x},${y}`);
}

test('landmark feet match rendered pieces, walking obstacles and authoritative paint collision',()=>{
 const pieces=art.props.filter(p=>p.coverFootprints&&p.author!=='warzone');
 assert.equal(pieces.length,28);
 for(const p of pieces){
  const feet=BOG_BLOCKERS.filter(b=>b.author===owner&&b.prop===p.id);
  assert.equal(feet.length,p.coverFootprints.length,p.id);
  for(const [i,[x,y,w,h]] of p.coverFootprints.entries()){
   const b=feet[i];
   assert.deepEqual([b.x,b.y,b.width,b.height],[p.x-p.width/2+x,p.y-p.height+y,w,h],b.id);
   assert.ok(!nav.walkable(b.x+w/2,b.y+h/2),b.id+' stops walking');
   const hit=traceShot({x:b.x+w/2,y:b.y-2},{x:b.x+w/2,y:b.y+h+2},combat);
   assert.equal(hit.blocker?.id,b.id,b.id+' stops paint');
  }
 }
 assert.equal(BOG_BLOCKERS.filter(b=>b.author===owner).length,54);
});

test('four unchanged base pads reach the front gate and both flank exits',()=>{
 for(const id of ['privacy-nw','google-ne','privacy-sw','google-se']){
  const {x,y}=BOG_AREAS[id],pad=[x,y+240];
  for(const [dx,dy] of [[0,240],[0,420],[0,520],[-520,420],[520,420]])reachable(x+dx,y+dy,pad);
  assert.equal(traceShot({x,y:y+370},{x,y:y+490},combat).blocker,null,id+' gate opening');
  const hall=prop(id+'-hall');assert.equal(hall.width,640);assert.equal(hall.height,420);
  assert.equal(prop('label-'+id),undefined,id+' has no name sign');
 }
 assert.deepEqual(createPickupSpots(nav).map(({id,x,y})=>[id,x,y]),[
  ['mid',4200,2280],['site-a',2230,3970],['site-b',6170,3970],['west-lane',3000,4400],['east-lane',5400,2900],
 ]);
});

test('both Mid wings have three traversable shooting bays with independent piers',()=>{
 for(const id of ['mid-west','mid-east']){
  const p=prop(id),left=p.x-p.width/2;
  assert.ok(!BOG_BLOCKERS.some(b=>b.id===id),id+' no invisible facade');
  for(const dx of [100,250,400]){
   const x=left+dx,y=p.y-18;
   reachable(x,y);
   assert.ok(nav.clearLine([x,y-55],[x,y+55]),id+' can cross bay');
   assert.equal(traceShot({x,y:y-55},{x,y:y+55},combat).blocker,null,id+' can shoot through bay');
  }
 }
});

test('Site A rail entrances and staggered graveyard lanes retain connected fighting floor',()=>{
 for(const point of [[2050,3315],[1680,3650],[2420,3650],[2050,3840],
  [6350,3735],[6060,3770],[6650,3770],[6350,3950],[6170,3970]])reachable(...point);
 assert.equal(prop('bench-11'),undefined,'the shooting court has no bench');
 for(const p of art.props.filter(p=>p.id.startsWith('site-b-arcade-')))reachable(p.x,p.y-25);
});

test('rear pond shares the runtime bottom anchor and blocks only its painted water',()=>{
 const pond=art.flats.find(p=>p.id==='site-a-rear-pond');
 const water=data.world.water.find(w=>w.id===pond.id);
 assert.deepEqual(pond.anchor,{x:.5,y:1});
 assert.deepEqual(water.poly[0],[pond.x-pond.width/2+27,pond.y-pond.height+109]);
 assert.equal(nav.walkable(pond.x,pond.y-100),false,'painted pond centre');
 reachable(pond.x,pond.y+35);
});
