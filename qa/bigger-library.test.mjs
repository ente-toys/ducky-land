import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {makeMap} from '../src/pixi/island-maps.js';import {geometry,inPoly,inShape} from '../rive/web/island-geometry.mjs';import {checkTheme} from '../scripts/theme-index.mjs';
const read=f=>JSON.parse(fs.readFileSync(f));const d='rive/web/themes/library/',a='public/pixi-art/themes/library/',base='scripts/bigger-library/original/';
const world=read(d+'world.json'),walk=read(d+'walk-world.json'),art=read(a+'art.json'),harbor=read(d+'harbor.json'),old=read(base+'world.json'),oldArt=read(base+'art.json'),plan=read('scripts/bigger-library/plan.json');
const checked=checkTheme('library'),map=makeMap('library',{world,walk,harbor,sleepers:checked.sleepers}),geo=geometry(map.walk);
test('bigger library preserves original composition, canal, sleepers and dry-land geometry',()=>{
 assert(checked.ready,checked.problems.join('\n'));assert.equal(checked.sleepers.length,40);assert.deepEqual(world.sleepSpots,old.sleepSpots);assert.deepEqual(art.props.slice(0,oldArt.props.length),oldArt.props);for(const k of ['flats','decks','floating'])assert.deepEqual(art[k],oldArt[k]);assert.deepEqual(world.obstacles.slice(0,old.obstacles.length),old.obstacles);assert.deepEqual(world.water.slice(0,old.water.length),old.water);assert.deepEqual(world.walkways,old.walkways);assert.deepEqual(world.paths,old.paths);
 const oldGeo=geometry({...old,obstacles:[]}),newGeo=geometry({...world,obstacles:[]});for(let y=450;y<5150;y+=29)for(let x=450;x<7550;x+=29)if(oldGeo.walkable(x,y))assert(newGeo.walkable(x,y),`original land lost ${x},${y}`);
 for(let y=1100;y<4800;y+=170)for(let x=3900;x<4250;x+=29)if(!inPoly(x,y,old.coast))assert(!inPoly(x,y,world.coast),`canal filled ${x},${y}`);
});
test('bigger library destinations, coast walks and moorings are reachable with visible matched solids',()=>{
 const nav=map.nav();for(const z of plan.places){assert(geo.walkable(...z.spawn),z.id+' spawn');assert(nav.route(map.spawn.x,map.spawn.y,...z.spawn).length,z.id+' route');}
 for(const p of art.props.slice(oldArt.props.length)){assert(inPoly(p.x,p.y,world.coast),p.id+' off land');const o=world.obstacles.find(o=>o.name===p.id);if(o)assert(!geo.walkable(o.x,o.y),p.id+' solid');}
 for(const b of map.boatSpots()){assert(!map.landAt(b.x,b.y),'boat in water');const shore=nav.nearest(b.x,b.y,280);assert(shore,`no boarding land ${b.x},${b.y}`);assert(nav.route(map.spawn.x,map.spawn.y,...shore).length,'mooring reachable');}
 assert(nav.route(map.spawn.x,map.spawn.y,map.HARBOR.land.x,map.HARBOR.land.y).length,'jetty route');
});
test('bigger library has about three times the land and GPU-safe, budgeted textures',()=>{
 const area=p=>Math.abs(p.reduce((s,a,i)=>{let b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0]},0)/2),ratio=world.coastRings.reduce((s,r)=>s+area(r),0)/old.coastRings.reduce((s,r)=>s+area(r),0);assert(ratio>=2.8&&ratio<=3.6,ratio);
 let bytes=0;for(const t of art.ground.tiles){const svg=fs.readFileSync(a+t.src,'utf8'),m=svg.match(/<svg[^>]*width="([\d.]+)" height="([\d.]+)"/),w=+m[1],h=+m[2];assert(w<=1536&&h<=1536,t.src);bytes+=w*h*4;}assert(bytes<350e6,'ground base allocation <350 MB');
});
test('library communities have distinct homes, shared squares and accessible front gates',()=>{
 assert.equal(plan.places.length,4);
 assert.equal(plan.homes.length,28);
 assert.equal(new Set(plan.homes.map(h=>h.type)).size,4);
 const nav=map.nav();
 for(const community of plan.places){
  assert.equal(plan.homes.filter(h=>h.zone===community.id).length,7,community.name+' homes');
  const workplace={quillwick:'mapmakers-table',inkleaf:'binding-press',bedtime:'story-puppet-house',paperboat:'book-freight'}[community.id];
  assert(art.props.some(p=>p.zone===community.id&&p.name===workplace),community.name+' workplace');
 }
 for(const home of plan.homes){
  assert(geo.walkable(...home.gate),home.id+' open gate');
  assert(nav.route(map.spawn.x,map.spawn.y,...home.gate).length,home.id+' front gate reachable');
  const p=art.props.find(p=>p.name==='home-'+home.id),o=world.obstacles.find(o=>o.name===p.id);
  assert(o&&o.rx>180&&o.ry>60,home.id+' physical house footprint');
 }
 assert(geo.walkable(-850,550),'shelf arch doorway open');
 assert(!geo.walkable(-995,550),'shelf arch west post solid');
 assert(!geo.walkable(-705,550),'shelf arch east post solid');
 // The drying line has two visible posts rather than an invisible solid wall.
 assert(geo.walkable(8090,1780),'walk under sheets');
 assert(!geo.walkable(7860,1780),'drying line west post solid');
 assert(!geo.walkable(8320,1780),'drying line east post solid');
 for(const road of [...plan.roads,...plan.coastRoads])for(const [x,y]of road.points){
  assert(nav.nearest(x,y,110),road.id+' traversable road station');
 }
});

test('library rivers carry every crossing and prevent walking through open water',()=>{
 assert.equal(world.water.length,old.water.length+3);
 assert.deepEqual(walk.water,world.water);
 for(const [x,y]of [[760,1000],[7190,1010],[6732,5060]])assert(world.water.some(w=>inShape(x,y,w)),`old jetty water ${x},${y}`);
 for(const c of plan.crossings){assert(world.water.some(w=>inShape(c.x,c.y,w)),c.id+' wet');assert(geo.walkable(c.x,c.y),c.id+' deck');assert(map.nav().route(map.spawn.x,map.spawn.y,c.x,c.y).length,c.id+' accessible');}
 assert(geo.walkable(-490,2502),'stepping stone in river');assert(map.nav().route(map.spawn.x,map.spawn.y,-490,2502).length,'stepping stones accessible');
 for(const [x,y]of [[-650,2520],[8600,2900],[6000,5160]])assert(!geo.walkable(x,y),'river blocks '+x+','+y);
 const wetless=geometry({...world,obstacles:[]});for(let y=450;y<5150;y+=20)for(let x=450;x<7550;x+=20)if(geometryOld.walkable(x,y))assert(wetless.walkable(x,y),'original ground/deck '+x+','+y);
 for(const community of plan.places){const homes=plan.homes.filter(h=>h.zone===community.id);assert(new Set(homes.map(h=>h.size)).size>=5);assert(new Set(homes.map(h=>h.wall)).size>=5);assert.equal(new Set(homes.map(h=>h.detail)).size,3);assert(new Set(homes.map(h=>h.roofType)).size>=3);}
});
const geometryOld=geometry({...old,obstacles:[]});
