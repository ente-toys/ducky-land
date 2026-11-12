import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeMap} from '../src/world/island-maps.js';
import {checkTheme} from '../scripts/theme-index.mjs';
import {VILLAGE_REST} from '../scripts/bigger-cathedral/villages-data.mjs';
import {REST} from '../scripts/bigger-cathedral/centre-data.mjs';
import {inPoly,inShape} from '../assets/world/island-geometry.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const A='public/pixi-art/themes/cathedral/',D='assets/world/themes/cathedral/',B='scripts/bigger-cathedral/baseline/';
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),harbor=read(D+'harbor.json');
const before=read(B+'world.json'),oldArt=read(B+'art.json'),oldWalk=read(B+'walk-world.json'),plan=read('scripts/bigger-cathedral/plan.json');
const m=makeMap('cathedral',{world,walk,harbor}),nav=m.nav();
test('Cathedral retains communities and sea access with the approved new centre and 120 sleepers',()=>{
 for(const id of ['cathedral-hall','campanile','cloister-olive-well'])assert.ok(art.props.some(p=>p.id===id));
 assert.ok(!art.props.some(p=>['cathedral-2','cathedral-3'].includes(p.id)));
 assert.equal(art.props.filter(p=>p.id.startsWith('centre-colonnade-')).length,6);
 assert.equal(art.decks.filter(p=>p.overBoats).length,13);
 assert.deepEqual(world.centrePlacement,before.centrePlacement);
 assert.equal(world.riverMouths.length,2);
 for(const [x,y]of before.islets)assert.ok(m.landAt(x,y));
 assert.equal(m.sleepers.length,120);
 assert.equal(new Set(m.sleepers.map(s=>s.pose)).size,8);
 for(const s of m.sleepers)assert.ok(m.landAt(s.x,s.y));
});
test('Every community square, front door and workplace connects to the piazza',()=>{
 const destinations=[];
 for(const c of world.communities){
  assert.equal(c.homes,3);
  destinations.push([c.name,c.square[0]+320,c.square[1]+120]);
  for(const p of art.props.filter(p=>p.id.startsWith(c.id+'-')&&/house-|foundry|olive-workshop|mosaic-workshop|bakery/.test(p.id)))destinations.push([p.id,p.x,p.y+40]);
 }
 for(const [label,x,y]of destinations){assert.ok(nav.walkable(x,y),label+' has clear ground');const route=nav.route(m.spawn.x,m.spawn.y,x,y);assert.deepEqual(route.at(-1),[x,y],label+' is reachable');let a=[m.spawn.x,m.spawn.y];for(const b of route){assert.ok(nav.clearLine(a,b),label+' route avoids solids');a=b;}}
 for(const p of art.props.filter(p=>/-house-|foundry|olive-workshop|mosaic-workshop|bakery/.test(p.id)))assert.ok(!nav.walkable(p.x,p.y-35),p.id+' has a matching solid base');
});
test('Cathedral arrival harbour, moorings, expanded bounds and texture budget are valid',()=>{
 const check=checkTheme('cathedral');assert.equal(check.ready,true,check.problems.join('; '));
 assert.ok(world.origin.x<0&&world.origin.y<0);
 assert.deepEqual(nav.route(m.HARBOR.land.x,m.HARBOR.land.y,m.spawn.x,m.spawn.y).at(-1),[m.spawn.x,m.spawn.y]);
 for(const b of m.boatSpots()){assert.ok(!m.landAt(b.x,b.y));assert.ok(m.shoreFor(b.x,b.y,260));}
 for(const t of art.ground.tiles)assert.ok(t.width<=1536&&t.height<=1536,t.src);
 const metrics=read('scripts/bigger-cathedral/metrics.json');assert.ok(metrics.areaRatio>3&&metrics.areaRatio<3.6);assert.ok(metrics.newGroundMiB<300);
});
test('New road and lane centrelines have no obstructing buildings, garden walls or furniture',()=>{
 for(const [i,road]of world.paths.entries()){
  if(i<before.paths.length)continue;
  for(const [x,y]of road){if(inPoly(x,y,before.coast)||world.water.some(w=>inShape(x,y,w,20)))continue;assert.ok(nav.walkable(x,y),`${plan.roads[i-before.paths.length]?.id??'centre lane '+i} blocked at ${x},${y}`);}
 }
});
