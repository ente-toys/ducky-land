import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import data from '../src/pixi/bog-environment.json' with {type:'json'};
import {makeMap} from '../src/pixi/island-maps.js';
import {inPoly} from '../assets/world/island-geometry.mjs';
const art=JSON.parse(fs.readFileSync('public/pixi-art/themes/bog-arena/art.json'));
const nav=makeMap('bog-sites-check',data).nav();
test('both landmark courts retain open fighting space and reachable Home doors',()=>{
 for(const [x,y]of [[2050,3840],[1860,3740],[2250,3740],[6350,3840],[6350,3660],[6350,3950]]){
  assert.ok(nav.walkable(x,y),`court floor ${x},${y}`);
  assert.ok(nav.route(1900,2090,x,y).length,`court approach ${x},${y}`);
 }
 for(const id of ['site-a-apothecary','site-a-cottage','site-b-shrine','site-b-cottage']){
  const p=art.props.find(p=>p.id===id);assert.ok(p.homeSource.includes('home-hamlets'));
  assert.ok(nav.walkable(p.x,p.y+30),id+' doorstep');
  assert.ok(nav.route(1900,2090,p.x,p.y+30).length,id+' connected');
 }
});
test('willow pool is real water with dry tree feet and open arcade bays',()=>{
 for(const p of art.props.filter(p=>p.id.startsWith('site-b-willow-'))){
  assert.ok(!data.world.water.some(w=>inPoly(p.x,p.y,w.poly)),p.id+' dry bank');
 }
 assert.equal(nav.walkable(5800,3510),false,'pool blocks walking');
 for(const p of art.props.filter(p=>p.id.startsWith('site-b-arcade-'))){
  assert.ok(nav.walkable(p.x,p.y-25),p.id+' open between columns');
 }
});
