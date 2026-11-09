import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mapFor} from '../src/pixi/island-maps.js';
import {canSail,setSailDestination,sailStep} from '../src/pixi/islands.js';
import {deckX} from '../src/pixi/bridge-projection.mjs';
import {shoreOf} from '../src/pixi/surf.js';
const read=p=>JSON.parse(fs.readFileSync(p)),id='isle-251',map=mapFor('library'),report=read('scripts/pagepond-rework/report.json'),ground=read('scripts/pagepond/layout.json'),art=read('public/pixi-art/themes/library/art.json');
function sail(actor,p){assert(canSail(...p,id),'open boat waypoint '+p);assert(setSailDestination(actor,...p),'route to '+p);for(let i=0;i<12000&&(actor.sailTarget||actor.sailRoute?.length);i++){sailStep(actor,1/20,{x:0,y:0});assert(canSail(actor.x,actor.y,id),'boat remains in water');}assert(Math.hypot(actor.x-p[0],actor.y-p[1])<2,'arrives at '+p);}
function sparse(samples){return samples.filter((p,i)=>i%7===0||i===samples.length-1).map(p=>p.slice(0,2));}
test('Pagepond boats enter from sea, circle both complete centre moats and sail back out',()=>{
 for(const [i,tour]of report.boatTours.entries()){
  const ch=ground.channels[i],inbound=sparse(ch.samples).reverse(),start=inbound[0],actor={islandId:id,mode:'sailing',x:start[0],y:start[1],turn:0};
  for(const p of inbound)sail(actor,p);
  let index=0;for(let k=1;k<tour.points.length-1;k++)if(Math.hypot(tour.points[k][0]-actor.x,tour.points[k][1]-actor.y)<Math.hypot(tour.points[index][0]-actor.x,tour.points[index][1]-actor.y))index=k;
  const points=[...tour.points.slice(index,-1),...tour.points.slice(0,index+1)];for(const p of points)sail(actor,p);for(const p of [...inbound].reverse())sail(actor,p);
 }
});
test('Pagepond south river is one clean, wide, sailable route from the sea to the moat and back',()=>{
 const pts=sparse(ground.channels[2].samples),start=pts.at(-1),actor={islandId:id,mode:'sailing',x:start[0],y:start[1],turn:0};for(const p of [...pts].reverse())sail(actor,p);for(const p of pts)sail(actor,p);assert(report.minimumBrookWidth>=180);assert(report.moatWidth>=180);
});
test('Every Pagepond river crossing uses centre arch art, renders over boats, carries walkers and has calm open mouths',()=>{
 const nav=map.nav();for(const c of ground.crossings){const d=art.decks.find(d=>d.id===c.id);assert(d?.overBoats,c.id+' raised deck');assert(fs.readFileSync('public/pixi-art/themes/library/'+d.src,'utf8').includes('data-source="canal-bridge-north"'));assert(map.world.walkways.find(w=>w.id===c.id)?.boatPassUnder);assert(nav.walkable(c.x,c.y),c.id+' walkable');assert(canSail(c.x,c.y,id),c.id+' sails underneath');const a=map.world.arches.find(a=>a.id===c.id);assert.equal(deckX(c.x,c.y,map.world.arches),c.x,'no sideways crown shear');assert.equal(a.r,c.rise,'feet follow the direction-specific artwork crown');}
 for(const d of art.decks.slice(0,5))assert(d.overBoats,'old centre bridge/jetty raised over boats');assert(map.world.riverMouths.length>=5);assert(shoreOf(map.world).length===map.world.shoreRings.length,'surf follows cut banks');
 assert(art.props.filter(p=>p.zone==='outer-meadow'&&p.kind==='tree').length>=90,'authored meadow groves');assert(report.meadowResidents>=10,'approved sleeping duckies in reading clearings');
 const before=read('scripts/pagepond-rework/baseline.json').art.props;for(const p of art.props.filter(p=>p.kind==='building'&&p.hamlet)){const old=before.find(o=>o.id===p.id);assert.equal(p.width,old.width);assert.equal(p.height,old.height);}
});
