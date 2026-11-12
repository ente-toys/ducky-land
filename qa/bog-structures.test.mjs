import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import data from '../src/features/bog-combat/bog-environment.json' with {type:'json'};
import {makeMap} from '../src/world/island-maps.js';
import {BOG_BLOCKERS} from '../src/features/bog-combat/bog-blockers.js';
import {views} from '../scripts/bog-environment/arcade-modules.mjs';
const root='public/pixi-art/themes/bog-arena/';
const art=JSON.parse(fs.readFileSync(root+'art.json'));
const layout=JSON.parse(fs.readFileSync('scripts/bog-environment/layout.json'));
const nav=makeMap('bog-structures',data).nav();
test('every upright Home facade has a connected door lane and one contact shadow',()=>{
 const buildings=art.props.filter(p=>p.homeSource?.includes('home-hamlets')&&p.name!=='home-planting-bed');
 assert.equal(buildings.length,20);
 for(const p of buildings){
  assert.ok(!p.rotation&&!p.skew,p.id);
  assert.ok(p.shadow&&p.shadowSize[1]<=25,p.id+' contact');
  const route=layout.routes.find(r=>r.id===p.id+'-door');
  assert.ok(route,p.id+' lane');assert.deepEqual(route.points[0],[p.x,p.y-12]);
  assert.ok(nav.walkable(p.x,p.y+30),p.id+' doorstep');
  assert.ok(nav.route(1900,2090,p.x,p.y+30).length,p.id+' route');
  for(const q of buildings.filter(q=>q.id!==p.id&&Math.hypot(q.x-p.x,q.y-p.y)<700))assert.notEqual(q.homeSource,p.homeSource,p.id+' distinct neighbour');
 }
});
test('fight areas have no benches, names, planters, flowers, sleepers or lane wildlife',()=>{
 const forbidden=/^(bench|flowers|home-planting-bed|sleeping-ducky|sleeping-z|cream-moth|pond-frog|cover-planter)$/;
 assert.deepEqual(art.props.filter(p=>forbidden.test(p.name)||p.id.startsWith('label-')),[]);
 assert.ok(!art.flats.some(p=>p.src.includes('site-bed.svg')));
 assert.ok(!fs.readdirSync(root+'home').some(p=>/^label-.*\.svg$/.test(p)));
 const lamps=art.props.filter(p=>p.name==='lantern');assert.equal(lamps.length,4);
 for(const p of lamps)assert.match(p.id,/^(privacy-nw|google-ne|privacy-sw|google-se)-lamp-0$/);
});
test('arcade uses three independently drawn straight views and exact pier collision',()=>{
 const bays=art.props.filter(p=>p.id.startsWith('site-b-arcade-'));
 assert.equal(new Set(bays.map(p=>p.src)).size,3);
 for(const p of bays){
  const svg=fs.readFileSync(root+p.src,'utf8');assert.ok(svg.includes('data-straight-module'));assert.ok(!/transform=/.test(svg));
  assert.equal(views[p.view][0][1],views[p.view][1][1],p.id+' feet and lintel are horizontal');
  assert.equal((svg.match(/data-contact-shadow=/g)||[]).length,1);assert.equal(p.shadow,false);
  assert.equal(BOG_BLOCKERS.filter(b=>b.id.startsWith(p.id+'-pier-')).length,2);
  assert.ok(nav.walkable(p.x,p.y-25),p.id+' open bay');
 }
});
test('Home bridge retains exact source, source deck width and flush physical endpoints',()=>{
 const p=art.decks.find(p=>p.id==='cove-bridge'),arch=data.world.arches[0];
 assert.equal(fs.readFileSync(root+p.src,'utf8'),fs.readFileSync('public'+p.homeSource,'utf8'));
 assert.equal(p.height,240);assert.ok(!p.rotation&&!p.skew);
 assert.deepEqual([p.x+30*p.width/480,p.y+169.2],[...arch.a]);
 assert.deepEqual([p.x+450*p.width/480,p.y+169.2],[...arch.b]);
 assert.equal(art.raster.enabled,false);
});
