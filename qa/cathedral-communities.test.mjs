import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeMap} from '../src/pixi/island-maps.js';
import {checkTheme} from '../scripts/theme-index.mjs';
import {inPoly} from '../rive/web/island-geometry.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const A='public/pixi-art/themes/cathedral/',D='rive/web/themes/cathedral/',B='scripts/bigger-cathedral/baseline/';
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),harbor=read(D+'harbor.json');
const before=read(B+'world.json'),oldArt=read(B+'art.json'),oldWalk=read(B+'walk-world.json'),plan=read('scripts/bigger-cathedral/plan.json');
const m=makeMap('cathedral',{world,walk,harbor}),nav=m.nav();
test('Cathedral communities preserve the complete original composition and all 40 sleepers',()=>{
 assert.deepEqual(art.props.slice(0,oldArt.props.length),oldArt.props);
 assert.deepEqual(art.flats.slice(0,oldArt.flats.length),oldArt.flats);
 assert.deepEqual(art.decks.slice(0,oldArt.decks.length),oldArt.decks);
 assert.ok(art.decks.some(p=>p.src==='deck-jetty-0.svg'),'original arrival pier stays drawn');
 assert.deepEqual(world.sleepSpots,before.sleepSpots);
 assert.deepEqual(walk.obstacles.slice(0,oldWalk.obstacles.length),oldWalk.obstacles);
 for(const key of ['arches','walkways','centrePlacement'])assert.deepEqual(world[key],before[key]);
 for(const key of ['water','bridges'])assert.deepEqual(world[key].slice(0,before[key].length),before[key]);
 for(const [x,y]of before.islets)assert.ok(m.landAt(x,y),'former islet remains land');
 assert.equal(m.sleepers.length,40);
 assert.deepEqual(m.sleepers,makeMap('cathedral',{world:before,walk:oldWalk,harbor:read(B+'harbor.json')}).sleepers);
 for(const s of m.sleepers)assert.ok(m.landAt(s.x,s.y));
});
test('Every community square, front door and workplace connects to the piazza',()=>{
 const destinations=[];
 for(const c of plan.communities){
  assert.equal(c.homes.length,5);
  destinations.push([c.name,c.x+70,c.y+100],...c.homes.map(([x,y],i)=>[c.id+' door '+i,x,y+40]));
  const [x,y]=c.work.flat();destinations.push([c.id+' workplace',x,y+70]);
 }
 for(const [label,x,y]of destinations){assert.ok(nav.walkable(x,y),label+' has clear ground');const route=nav.route(m.spawn.x,m.spawn.y,x,y);assert.deepEqual(route.at(-1),[x,y],label+' is reachable');let a=[m.spawn.x,m.spawn.y];for(const b of route){assert.ok(nav.clearLine(a,b),label+' route avoids solids');a=b;}}
 for(const p of art.props.filter(p=>/-home-\d$|-workplace$/.test(p.id)))assert.ok(!nav.walkable(p.x,p.y-35),p.id+' has a matching solid base');
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
  for(const [x,y]of road){if(inPoly(x,y,before.coast))continue;assert.ok(nav.walkable(x,y),`${plan.roads[i-before.paths.length].id} blocked at ${x},${y}`);}
 }
});
