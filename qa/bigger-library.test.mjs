import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {makeMap} from '../src/pixi/island-maps.js';import {geometry,inPoly,inShape} from '../rive/web/island-geometry.mjs';import {checkTheme} from '../scripts/theme-index.mjs';
const read=f=>JSON.parse(fs.readFileSync(f));const d='rive/web/themes/library/',a='public/pixi-art/themes/library/',base='scripts/bigger-library/original/';
const world=read(d+'world.json'),walk=read(d+'walk-world.json'),art=read(a+'art.json'),harbor=read(d+'harbor.json'),old=read(base+'world.json'),oldArt=read(base+'art.json'),plan=read('scripts/bigger-library/plan.json');
const checked=checkTheme('library'),map=makeMap('library',{world,walk,harbor,sleepers:checked.sleepers}),geo=geometry(map.walk);
test('bigger library preserves original composition, canal, sleepers and dry-land geometry',()=>{
 assert(checked.ready,checked.problems.join('\n'));assert.equal(checked.sleepers.length,40);assert.deepEqual(art.props.slice(0,oldArt.props.length),oldArt.props);for(const k of ['flats','floating'])assert.deepEqual(art[k],oldArt[k]);assert.deepEqual(art.decks.slice(0,oldArt.decks.length).map(({overBoats,...p})=>p),oldArt.decks);assert.deepEqual(world.obstacles.slice(0,old.obstacles.length),old.obstacles);assert.deepEqual(world.water.slice(0,old.water.length),old.water);assert.deepEqual(world.walkways.slice(0,old.walkways.length).map(({boatPassUnder,...p})=>p),old.walkways);assert.deepEqual(world.paths,old.paths);
 const oldGeo=geometry({...old,obstacles:[]}),newGeo=geometry({...world,obstacles:[]});for(let y=450;y<5150;y+=29)for(let x=450;x<7550;x+=29)if(oldGeo.walkable(x,y))assert(newGeo.walkable(x,y),`original land lost ${x},${y}`);
 for(let y=1100;y<4800;y+=170)for(let x=3900;x<4250;x+=29)if(!inPoly(x,y,old.coast))assert(!inPoly(x,y,world.coast),`canal filled ${x},${y}`);
});
test('bigger library destinations, coast walks and moorings are reachable with visible matched solids',()=>{
 const nav=map.nav();for(const z of plan.places){assert(geo.walkable(...z.spawn),z.id+' spawn');assert(nav.route(map.spawn.x,map.spawn.y,...z.spawn).length,z.id+' route');}
 for(const p of art.props.slice(oldArt.props.length)){assert(p.kind==='boat'||p.parent==='hamlet-paperboat-south-jetty'?!map.landAt(p.x,p.y):inPoly(p.x,p.y,world.coast),p.id+' correct land/water placement');const o=world.obstacles.find(o=>o.name===p.id);if(o)assert(!geo.walkable(o.x,o.y),p.id+' solid');}
 for(const b of map.boatSpots()){assert(!map.landAt(b.x,b.y),'boat in water');const shore=nav.nearest(b.x,b.y,280);assert(shore,`no boarding land ${b.x},${b.y}`);assert(nav.route(map.spawn.x,map.spawn.y,...shore).length,'mooring reachable');}
 assert(nav.route(map.spawn.x,map.spawn.y,map.HARBOR.land.x,map.HARBOR.land.y).length,'jetty route');
});
test('bigger library has about three times the land and GPU-safe, budgeted textures',()=>{
 const area=p=>Math.abs(p.reduce((s,a,i)=>{let b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0]},0)/2),ratio=world.coastRings.reduce((s,r)=>s+area(r),0)/old.coastRings.reduce((s,r)=>s+area(r),0);assert(ratio>=2.8&&ratio<=3.6,ratio);
 let bytes=0;for(const t of art.ground.tiles){const svg=fs.readFileSync(a+t.src,'utf8'),m=svg.match(/<svg[^>]*width="([\d.]+)" height="([\d.]+)"/),w=+m[1],h=+m[2];assert(w<=1536&&h<=1536,t.src);bytes+=w*h*4;}assert(bytes<350e6,'ground base allocation <350 MB');
});
test('Pagepond clears old villages and spurs while retaining connected main routes',()=>{
 assert.equal(plan.places.length,4);
 assert.equal(plan.homes.length,0,'old homes retired for the approved hamlets');
 assert(!art.props.some(p=>p.id.startsWith('bigger-')),'no old outer houses, workplaces, stalls, benches or trees');
 assert(!world.obstacles.some(o=>o.name?.startsWith('bigger-')),'no invisible old village solids');
 assert.deepEqual(plan.roads.map(r=>r.id),['west-spine','east-spine','west-north-heart','west-south-heart','east-north-heart','east-south-heart','harbour','east-south-return']);
 const nav=map.nav();for(const road of plan.roads){let last=null;for(const [i,[x,y]]of road.points.entries()){if(i&&i<road.points.length-1&&last&&Math.hypot(x-last[0],y-last[1])<160)continue;last=[x,y];
  assert(nav.nearest(x,y,110),road.id+' traversable station');
  assert(nav.route(map.spawn.x,map.spawn.y,x,y).length,road.id+' connected station');
 }}
});

test('library rivers carry every crossing and prevent walking through open water',()=>{
 assert(world.water.length>old.water.length,'sea-connected moats and open river pieces');
 assert.deepEqual(walk.water,world.water);
 for(const [x,y]of [[760,1000],[7190,1010],[6732,5060]])assert(world.water.some(w=>inShape(x,y,w)),`old jetty water ${x},${y}`);
 for(const c of plan.crossings){assert(world.water.some(w=>inShape(c.x,c.y,w)),c.id+' wet');assert(geo.walkable(c.x,c.y),c.id+' deck');assert(map.nav().route(map.spawn.x,map.spawn.y,c.x,c.y).length,c.id+' accessible');}
 assert(!geo.walkable(-490,2502),'retired stepping stones are open water');
 for(const [x,y]of [[-650,2520],[8600,2900],[5900,5380]])assert(!geo.walkable(x,y),'river blocks '+x+','+y);
 const wetless=geometry({...world,obstacles:[]});for(let y=450;y<5150;y+=20)for(let x=450;x<7550;x+=20)if(geometryOld.walkable(x,y))assert(wetless.walkable(x,y),'original ground/deck '+x+','+y);

});
const geometryOld=geometry({...old,obstacles:[]});
