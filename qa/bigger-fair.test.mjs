import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeMap,THEME_OF} from '../src/pixi/island-maps.js';
import {checkTheme} from '../scripts/theme-index.mjs';
import {canSail,boardingPoint,landingSpot} from '../src/pixi/islands.js';
const read=p=>JSON.parse(fs.readFileSync(p));
const S='scripts/bigger-fair/',D='rive/web/themes/fair/',w=read(D+'world.json'),walk=read(D+'walk-world.json'),h=read(D+'harbor.json'),a=read('public/pixi-art/themes/fair/art.json'),e=read(S+'expansion.json');
const checked=checkTheme('fair'),map=makeMap('fair',{world:w,walk,harbor:h,sleepers:checked.sleepers}),nav=map.nav();
test('bigger Fair preserves its original props, decals, sleepers, centre and collision geometry',()=>{
 const old=read(S+'original-art.json'),ow=read(S+'original-world.json'),oldWalk=read(S+'original-walk-world.json');
 for(const key of ['props','flats','decks'])assert.deepEqual(a[key].slice(0,old[key].length),old[key]);
 for(const [id,z]of Object.entries(ow.zones))assert.deepEqual(w.zones[id],z);
 assert.deepEqual(w.sleepSpots,ow.sleepSpots);assert.deepEqual(w.sleepAvoid,ow.sleepAvoid);
 assert.deepEqual(walk.obstacles.slice(0,oldWalk.obstacles.length),oldWalk.obstacles);
 assert.deepEqual(w.water.slice(0,ow.water.length),ow.water);assert.deepEqual(w.bridges.slice(0,ow.bridges.length),ow.bridges);assert.deepEqual(walk.walkways,oldWalk.walkways);
 assert(checked.ready,checked.problems.join('\n'));assert.equal(checked.sleepers.length,40);
});
test('all four Fair communities, home doors and the full coast loop connect to the original plaza',()=>{
 for(const p of [...e.places.map(p=>p.point),...read(S+'communities.json').homes.map(h=>h.door),...e.paths.flatMap(p=>p.line)]){
  assert(nav.walkable(...p),p.join(',')+' blocked');const route=nav.route(map.spawn.x,map.spawn.y,...p);
  assert(route.length||nav.clearLine([map.spawn.x,map.spawn.y],p),p.join(',')+' unreachable');
  let prev=[map.spawn.x,map.spawn.y];for(const q of route){assert(nav.clearLine(prev,q));prev=q;}
 }
 for(const p of e.newProps)for(const f of p.footprints)assert(!nav.walkable(f.x,f.y),'missing footprint '+p.id);
});
test('expanded Fair has GPU-safe ground tiles, ten usable boats and a sea-facing harbour',()=>{
 assert(w.origin.x<0&&w.origin.y<0);for(const t of a.ground.tiles)assert(t.width<=1536&&t.height<=1536);
 assert.equal(a.ground.tiles.reduce((s,t)=>s+t.width*t.height,0),w.width*w.height);
 const id=[...THEME_OF].find(([,theme])=>theme==='fair')[0];assert.equal(map.boatSpots().length,10);
 for(const b of map.boatSpots()){
  assert(canSail(b.x,b.y,id),'boat afloat '+JSON.stringify(b));
  const p=boardingPoint({...b,islandId:id});assert(nav.walkable(p.x,p.y),'boat has walkable boarding point');
  assert(landingSpot({...b,islandId:id}),'boat docks at beach or jetty');
 }
 const water=map.HARBOR.water;assert(canSail(water.x,water.y,id));
});

test('Fair communities have inhabited homes and theme-specific workplaces outside the preserved heart',()=>{
 const c=read(S+'communities.json');assert.equal(c.communities.length,4);assert.equal(c.homes.length,22);
 for(const z of c.communities){
  const homes=e.newProps.filter(p=>p.community===z.id&&p.role==='home');assert(homes.length>=5,z.id+' lacks homes');
  assert(e.newProps.some(p=>p.community===z.id&&/sewing table|balloon workbench|prop rack|bread oven/.test(p.name)),z.id+' lacks workplace');
  assert(z.people&&z.work);
 }
 const tiles=a.ground.tiles;for(const t of tiles){const old=read(S+'original-art.json').ground.tiles.find(o=>o.x===t.x&&o.y===t.y);if(old)assert.equal(t.resolution??1,1);}
});

test('Fair inland decks cross actual blocked water and connect to the heart',async()=>{
 const {inShape}=await import('../rive/web/island-geometry.mjs');
 const wet=(x,y)=>w.water.some(shape=>inShape(x,y,shape));
 assert.equal(a.decks.length,16);
 for(const b of w.bridges){
  assert(wet(b.x,b.y),b.id+' has no water beneath its deck');
  assert(nav.walkable(b.x,b.y),b.id+' deck is blocked');
  assert(nav.route(map.spawn.x,map.spawn.y,b.x,b.y).length||nav.clearLine([map.spawn.x,map.spawn.y],[b.x,b.y]),b.id+' unreachable');
 }
 for(const point of [[-800,3500],[8240,1810],[950,-310],[5200,4100]]){
  assert(wet(...point),'missing water at '+point);
  assert(!nav.walkable(...point),'ducks can walk on water at '+point);
  assert(map.landAt(...point),'inland water must remain outside the sailing sea');
 }
 // Walk across each restored original deck, not only onto its centre.
 for(const deck of read(S+'original-walk-world.json').walkways){
  for(let t=.2;t<=.8;t+=.2){const x=deck.a[0]+(deck.b[0]-deck.a[0])*t,y=deck.a[1]+(deck.b[1]-deck.a[1])*t;assert(nav.walkable(x,y),'restored deck discontinuity');}
 }
});

test('Fair neighbours have distinct home sizes, roofs and domestic details',()=>{
 const homes=e.newProps.filter(p=>p.role==='home');
 for(const z of read(S+'communities.json').communities){
  const neighbourhood=homes.filter(p=>p.community===z.id);
  assert.equal(new Set(neighbourhood.map(p=>p.src)).size,neighbourhood.length);
  assert.equal(new Set(neighbourhood.map(p=>`${p.width},${p.height}`)).size,neighbourhood.length);
 }
 assert(e.newProps.filter(p=>p.community==='commons').length>=35);
});
