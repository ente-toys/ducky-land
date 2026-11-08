import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mapFor,makeMap} from '../src/pixi/island-maps.js';
import {shoreOf} from '../src/pixi/surf.js';
import {boardingPoint,canSail,originOffset,seaBoundsFor,destinationsFor} from '../src/pixi/islands.js';
import {THEME_OF} from '../src/pixi/island-maps.js';
import {geometry,inPoly} from '../rive/web/island-geometry.mjs';
import {resolveSleepSpots,sleepHalfWidths} from '../src/pixi/sleep-spots.js';
import {communities,houses} from '../scripts/bigger-sunflower/communities.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url))),B='scripts/bigger-sunflower/baseline/',D='rive/web/themes/sunflower/';
const old=read(B+'world.json'),originalArt=read(B+'art.json'),art=read('public/pixi-art/themes/sunflower/art.json'),extension=read(D+'bigger-sunflower.json'),map=mapFor('sunflower');

test('bigger Sunflower keeps original centre, props, decals, decks and all 40 sleeper coordinates',()=>{
 assert.deepEqual(art.props.slice(0,originalArt.props.length),originalArt.props);assert.deepEqual(art.flats,originalArt.flats);assert.deepEqual(art.decks.slice(0,originalArt.decks.length),originalArt.decks);
 for(const key of ['sleepSpots','sleepAvoid','centrePlacement','islets','walkways','arches'])assert.deepEqual(map.world[key],old[key],key);
 assert.deepEqual(map.world.water.slice(0,old.water.length),old.water);
 for(const [id,z]of Object.entries(old.zones))assert.deepEqual(map.world.zones[id],z);
 const original=makeMap('sunflower',{world:old,walk:read(B+'walk-world.json'),harbor:read(B+'harbor.json'),sleepers:[]});
 const beds=resolveSleepSpots(original.baseWalk,originalArt.props,geometry(original.baseWalk).walkable,sleepHalfWidths(),{spots:old.sleepSpots,avoid:old.sleepAvoid,warn:false});
 assert.equal(map.sleepers.length,40);assert.deepEqual(map.sleepers.map(b=>[b.pose,b.x,b.y]),beds.map(b=>[b.pose,Math.round(b.x),Math.round(b.y)]));
});
test('Sunflower communities and the coast loop remain reachable across negative origins',()=>{
 assert.deepEqual(map.origin,{x:-2000,y:-1400});const nav=map.nav();
 for(const p of extension.places){assert.ok(nav.walkable(...p.point),p.id);const r=nav.route(map.spawn.x,map.spawn.y,...p.point);assert.deepEqual(r.at(-1),p.point,p.id);let prev=[map.spawn.x,map.spawn.y];for(const next of r){assert.ok(nav.clearLine(prev,next));prev=next}}
 const area=c=>Math.abs(c.reduce((s,p,i)=>{const q=c[(i+1)%c.length];return s+p[0]*q[1]-p[1]*q[0]},0))/2;
 assert.ok(area(map.world.coast)/area(old.coast)>3);assert.equal(shoreOf(map.world).length,1,'surf follows the new sea coast, former islets are inland gardens');
 for(const t of art.ground.tiles){assert.ok(t.width<=1536&&t.height<=1536,t.src)}
});
test('all 23 Sunflower homes have reachable gates and porches, solid foundations and fence rails',()=>{
 const nav=map.nav();assert.equal(communities.length,5);assert.equal(houses.length,23);
 assert.equal(new Set(communities.map(c=>c.kind)).size,5);
 for(const c of communities)assert.ok(c.homes.length>=4,c.id+' has a residential cluster');
 for(const h of houses){
  for(const p of [[h.x,h.y+24],[h.x,h.y+223]]){
   assert.ok(nav.walkable(...p),h.id+' door/gate');
   const r=nav.route(map.spawn.x,map.spawn.y,...p);assert.deepEqual(r.at(-1),p,h.id+' connected');
   let prev=[map.spawn.x,map.spawn.y];for(const q of r){assert.ok(nav.clearLine(prev,q),h.id+' clear route');prev=q;}
  }
  assert.ok(!nav.walkable(h.x,h.y-38),h.id+' foundation');assert.ok(!nav.walkable(h.x-146,h.y+183),h.id+' fence');
 }
 const originalWalk=read(B+'walk-world.json'),before=geometry(originalWalk).walkable,after=geometry(map.baseWalk).walkable;
 for(let y=0;y<5600;y+=37)for(let x=0;x<8000;x+=37){if(inPoly(x,y,originalWalk.coast))assert.equal(after(x,y),before(x,y),'original walking terrain '+x+','+y);}
});
test('bigger Sunflower boats float, board and land through the production registry',()=>{
 const island=[...THEME_OF].find(([,theme])=>theme==='sunflower')[0];
 assert.equal(map.boatSpots().length,10);
 for(const p of map.boatSpots()){assert.ok(canSail(p.x,p.y,island));const b=boardingPoint({...p,islandId:island});assert.ok(map.nav().walkable(b.x,b.y));assert.ok(map.shoreFor(p.x,p.y,300))}
 for(const d of destinationsFor(island)){const m=mapFor(d.map),b=seaBoundsFor(island),o=originOffset(island,d.destination);assert.ok(o.x+m.origin.x>=b.x0&&o.x+m.origin.x+m.width<=b.x1)}
});

test('Sunflower canals block walking, every retained and new crossing spans real water and stays reachable',async()=>{
 const {waterways}=await import('../scripts/bigger-sunflower/water.mjs');
 const {inShape}=await import('../rive/web/island-geometry.mjs');
 const nav=map.nav();
 assert.equal(waterways.courses.length,2);
 for(const w of map.world.water)for(const key of ['x','y','rx','ry'])assert.ok(Number.isFinite(w[key]),'runtime ripple '+key);
 for(const p of [[4300,-450],[0,1500],[400,2860]])assert.ok(!nav.walkable(...p),'open water cannot be walked '+p);
 for(const b of [...waterways.originalCrossings,...waterways.bridges]){
  const p=b.mid??b.a.map((v,i)=>(v+b.b[i])/2);
  assert.ok(map.world.water.some(w=>inShape(...p,w)),b.id+' has actual water beneath deck');
  assert.ok(nav.walkable(...p),b.id+' deck is walkable');
  const route=nav.route(map.spawn.x,map.spawn.y,...p);assert.deepEqual(route.at(-1),p,b.id+' reachable');
  let previous=[map.spawn.x,map.spawn.y];for(const q of route){assert.ok(nav.clearLine(previous,q),b.id+' route clearance');previous=q;}
 }
 // No new dry-land prop is left standing in the canal. Reeds/lilies live in water.
 for(const p of art.props.slice(originalArt.props.length))if(!/pond-reeds|pond-lily/.test(p.id))assert.ok(!map.world.water.slice(old.water.length).some(w=>inShape(p.x,p.y-8,w)),p.id+' has dry footing');
 // Houses vary in physical size as well as roof silhouette, colour and details.
 for(const c of communities){const homes=art.props.filter(p=>p.id.startsWith(c.id+'-home-'));assert.ok(new Set(homes.map(p=>p.width+':'+p.height)).size>=4,c.id+' house sizes');}
});
