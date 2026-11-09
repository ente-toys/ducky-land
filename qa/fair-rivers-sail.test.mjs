import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mapFor} from '../src/pixi/island-maps.js';
import {canSail,setSailDestination,sailStep} from '../src/pixi/islands.js';
const plan=JSON.parse(fs.readFileSync('scripts/bigger-fair/centre-source/sailing.json')),id='isle-170',map=mapFor('fair');
function sail(actor,to){assert.ok(setSailDestination(actor,...to),'route to '+to);for(let i=0;i<15000&&(actor.sailTarget||actor.sailRoute?.length);i++){sailStep(actor,1/20,{x:0,y:0});assert.ok(canSail(actor.x,actor.y,id),'stays afloat');}assert.ok(Math.hypot(actor.x-to[0],actor.y-to[1])<2,'arrives at '+to);}
test('Fair boats sail in from each sea mouth and all the way round the moat',()=>{
 const west=plan.channels[0],east=plan.channels[1],actor={islandId:id,mode:'sailing',x:west.at(-1)[0],y:west.at(-1)[1],turn:0};
 for(const p of west.toReversed())sail(actor,p);
 // Join the ring at its western bank and visit every authored centreline point.
 let start=plan.ring.reduce((best,p,i)=>Math.hypot(p[0]-actor.x,p[1]-actor.y)<Math.hypot(plan.ring[best][0]-actor.x,plan.ring[best][1]-actor.y)?i:best,0);
 const ring=[...plan.ring.slice(start),...plan.ring.slice(0,start),plan.ring[start]];
 for(const p of ring)sail(actor,p);
 for(const p of west)sail(actor,p);
 const other={islandId:id,mode:'sailing',x:east.at(-1)[0],y:east.at(-1)[1],turn:0};for(const p of east.toReversed())sail(other,p);for(const p of east)sail(other,p);
});
test('Fair moat bridges carry walkers, boats fit below, and the castle lagoon stays separate',()=>{
 const nav=map.nav();assert.equal(plan.bridges.length,11);
 for(const br of plan.bridges){const m=br.a.map((v,i)=>(v+br.b[i])/2);assert.ok(nav.walkable(...m),'walkable bridge '+br.id);assert.ok(canSail(...m,id),'sail under '+br.id);assert.ok(nav.route(map.spawn.x,map.spawn.y,...m).length||nav.clearLine([map.spawn.x,map.spawn.y],m),'reachable bridge '+br.id);}
 assert.equal(canSail(3570,1250,id),false);assert.equal(map.world.riverMouths.length,2);
});
// The boss removed flower fields, so residents may now use the open lawns.
test('Fair resolves 40 residents and the castle islet has a walking entrance',()=>{
 assert.equal(map.sleepers.length,40);
 const b=map.world.walkways.find(b=>b.id==='ac2-lagoon-bridge');assert.ok(map.nav().route(map.spawn.x,map.spawn.y,...b.a).length,'castle islet reachable');
});
