import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
import {makeMap} from '../src/pixi/island-maps.js';
import {checkTheme} from '../scripts/theme-index.mjs';
import {geometry,inPoly,inShape} from '../rive/web/island-geometry.mjs';
import {communities,bridges,rivers,coast,roads} from '../scripts/bigger-snow/plan.mjs';
const j=p=>JSON.parse(readFileSync(p));
const art=j('public/pixi-art/themes/snow/art.json'),world=j('rive/web/themes/snow/world.json'),walk=j('rive/web/themes/snow/walk-world.json'),harbor=j('rive/web/themes/snow/harbor.json');
const old=j('scripts/bigger-snow/baseline/art.json'),oldWorld=j('scripts/bigger-snow/baseline/world.json');
const ready=checkTheme('snow'),map=makeMap('snow',{world,walk,harbor,sleepers:ready.sleepers}),nav=map.nav();
const route=(x,y)=>nav.walkable(x,y)&&(nav.clearLine([map.spawn.x,map.spawn.y],[x,y])||nav.route(map.spawn.x,map.spawn.y,x,y).length>0);
test('snow communities preserve every original prop, ground tile, decal, path, solid and sleeping position',()=>{
 assert.deepEqual(art.props.slice(0,old.props.length),old.props);assert.deepEqual(art.flats.slice(0,old.flats.length),old.flats);assert.deepEqual(art.ground.tiles.slice(-old.ground.tiles.length),old.ground.tiles);assert.deepEqual(world.sleepSpots,oldWorld.sleepSpots);assert.deepEqual(world.paths.slice(0,oldWorld.paths.length),oldWorld.paths);assert.deepEqual(world.obstacles.slice(0,oldWorld.obstacles.length),oldWorld.obstacles);assert.deepEqual(harbor.spawn,j('scripts/bigger-snow/baseline/harbor.json').spawn);
});
test('snow has four lived-in communities, 21 homes, reachable homes and workplaces',()=>{
 assert.equal(communities.length,4);assert.equal(communities.reduce((n,c)=>n+c.homes.length,0),21);
 for(const c of communities){assert.ok(route(...c.spawn),c.name+' court');for(const[type,x,y]of [...c.homes,...c.work])assert.ok(route(x,y+65),c.name+' '+type+' front door '+x+','+y)}
 for(const p of art.props.filter(p=>p.id?.startsWith('snow-community'))){assert.ok(inPoly(p.x,p.y,coast),'offshore '+p.id);assert.ok(!world.water.some(o=>inShape(p.x,p.y,o,20)),'prop in river '+p.id);const o=world.obstacles.find(o=>o.prop===p.id);if(o)assert.ok(!geometry(walk).walkable(o.x,o.y),'solid prop must block '+p.id)}
});
test('snow rivers are real unwalkable water; every bridge crosses water and connects both banks',()=>{
 for(const b of bridges){assert.ok(world.water.some(o=>inShape(b.x,b.y,o)),b.id+' must span water');assert.ok(nav.walkable(b.x,b.y),b.id+' deck');assert.ok(route(b.x,b.y),b.id+' reachable');const off=b.axis==='h'?[b.w/2+50,0]:[0,b.h/2+50];for(const side of [-1,1])assert.ok(route(b.x+off[0]*side,b.y+off[1]*side),b.id+' bank '+side)}
 for(const p of art.flats.filter(p=>p.community))assert.ok(!world.water.some(o=>inShape(p.x+p.width/2,p.y+p.height/2,o,20)),'garden in river');
 for(const r of roads)for(const[x,y]of r.line)if(world.water.some(o=>inShape(x,y,o,20)))assert.ok(nav.walkable(x,y),'road must cross on a real bridge '+r.id);
 for(const r of rivers){let wet=0;for(const[x,y]of r.line){if(!inPoly(x,y,coast)||world.bridges.some(b=>Math.abs(x-b.x)<b.w/2+20&&Math.abs(y-b.y)<b.h/2+20))continue;assert.ok(!nav.walkable(x,y),r.id+' water '+x+','+y);assert.ok(map.landAt(x,y),'boats stay out of inland streams');wet++}assert.ok(wet>20,r.id+' flowing channel')}
});
test('snow keeps 40 sleepers on land, a sea harbour and GPU-safe texture tiles',()=>{
 assert.ok(ready.ready,ready.problems.join('\n'));assert.equal(ready.sleepers.length,40);for(const b of ready.sleepers)assert.ok(map.landAt(b.x,b.y));assert.ok(route(map.HARBOR.land.x,map.HARBOR.land.y));for(const b of map.boatSpots()){assert.ok(!map.landAt(b.x,b.y),'boat afloat');for(let i=0;i<16;i++){const a=i*Math.PI/8;assert.ok(!map.landAt(b.x+46*Math.cos(a),b.y+46*Math.sin(a)),'boat hull afloat')}}for(const t of art.ground.tiles){assert.ok(Math.max(t.width,t.height)*(t.resolution??1)<=1536);assert.ok(existsSync('public/pixi-art/themes/snow/'+t.src))}
});

test('snow review audits every rendered bridge and both river mouths', async()=>{
 const {commons}=await import('../scripts/bigger-snow/plan.mjs');
 assert.equal(art.decks.length,bridges.length,'no unaudited bridge or boardwalk layer');
 for(const b of bridges){
  assert.ok(art.decks.some(p=>p.id==='snow-'+b.id));
  // A centre-only check can miss a bridge perched along the edge of a river.
  // Sample across the full usable deck width, perpendicular to the crossing.
  for(const k of [-.28,-.14,0,.14,.28]){
   const x=b.x+(b.axis==='v'?b.w*k:0),y=b.y+(b.axis==='h'?b.h*k:0);
   assert.ok(world.water.some(o=>inShape(x,y,o)),b.id+' deck width over water at '+k);
  }
 }
 for(const r of rivers)for(const p of [r.line[0],r.line.at(-1)])assert.ok(!inPoly(...p,coast),r.id+' mouth must reach sea');
 const homes=art.props.filter(p=>/-home-\d\.svg$/.test(p.src));assert.equal(homes.length,21);assert.equal(new Set(homes.map(p=>p.src)).size,21);
 assert.equal(commons.length,4);
 for(const c of commons){assert.ok(route(...c.at),c.name+' clearing reachable');assert.ok(art.flats.some(p=>p.common===c.id),c.name+' planted beds');}
 for(const p of art.props.filter(p=>p.id?.startsWith('snow-common-'))){assert.ok(inPoly(p.x,p.y,coast),p.id+' land');assert.ok(!world.water.some(o=>inShape(p.x,p.y,o,20)),p.id+' dry base');const o=world.obstacles.find(o=>o.prop===p.id);assert.ok(o&&!nav.walkable(o.x,o.y),p.id+' matching solid footprint');}
});

test('snow dense streets keep clear walking lines and preserve the river crossings',()=>{
 const before=j('scripts/bigger-snow/dense-before.json');
 assert.deepEqual(coast,before.coast);
 assert.deepEqual(rivers,before.rivers);
 assert.deepEqual(bridges,before.bridges);
 assert.deepEqual(communities.map(c=>[c.id,c.name,c.at,c.spawn]),before.communities.map(c=>[c.id,c.name,c.at,c.spawn]));
 assert.equal(roads[0].w,122);
 for(const r of roads.slice(1))assert.ok(r.w<roads[0].w,r.id+' is a narrow lane');
 for(const r of roads)for(let i=1;i<r.line.length;i++){
  const a=r.line[i-1],b=r.line[i],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/10);
  for(let k=0;k<=steps;k++){
   const x=a[0]+(b[0]-a[0])*k/steps,y=a[1]+(b[1]-a[1])*k/steps;
   if(inPoly(x,y,oldWorld.coast))continue;
   assert.ok(nav.walkable(x,y),r.id+' obstructed at '+x+','+y);
  }
 }
});
