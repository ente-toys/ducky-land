import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import data from '../src/features/bog-combat/bog-environment.json' with {type:'json'};
import {makeMap,THEME_OF,mapOf} from '../src/world/island-maps.js';
import {WORLD_ISLANDS,FINISHED_THEMES} from '../src/world/world-map.js';
import {BOG_BLOCKERS,BOG_SOLIDS,bogBlockerPolygons} from '../src/features/bog-combat/bog-blockers.js';
import {installBogEnvironment,BOG_REVIEW_ISLAND,BOG_MAP_ID} from '../src/features/bog-combat/bog-environment.js';
import {inPoly} from '../assets/world/island-geometry.mjs';
const map=makeMap(BOG_MAP_ID,data),nav=map.nav();
const art=JSON.parse(fs.readFileSync('public/pixi-art/themes/bog-arena/art.json'));
test('private Bog registration restores the existing roster and does not add a world destination',()=>{
 const before=mapOf(BOG_REVIEW_ISLAND),count=WORLD_ISLANDS.length,themes=[...FINISHED_THEMES];
 const installed=installBogEnvironment();
 try{assert.equal(mapOf(BOG_REVIEW_ISLAND).id,BOG_MAP_ID);assert.equal(WORLD_ISLANDS.length,count);assert.deepEqual(FINISHED_THEMES,themes);assert.ok(!FINISHED_THEMES.includes(BOG_MAP_ID));}
 finally{installed.restore();}
 assert.equal(mapOf(BOG_REVIEW_ISLAND).id,before.id);assert.equal(THEME_OF.get(BOG_REVIEW_ISLAND),'bog');
});
test('all eight courts and the Home dock connect with the actual padded island navigation',()=>{
 for(const [name,z] of Object.entries(map.world.zones)){
  const [x,y]=z.spawn;assert.ok(nav.walkable(x,y),`${name} spawn`);
  assert.ok(nav.route(map.spawn.x,map.spawn.y,x,y).length,`${name} route`);
 }
 assert.ok(nav.walkable(map.HARBOR.land.x,map.HARBOR.land.y));
 assert.ok(nav.route(map.spawn.x,map.spawn.y,map.HARBOR.land.x,map.HARBOR.land.y).length);
 for(let y=7560;y<=8400;y+=20)assert.equal(map.landAt(4450,y),false,`open sea mouth ${y}`);
});
test('exported building/wall rectangles match movement obstacles exactly',()=>{
 const facades=art.props.filter(p=>p.homeSource?.includes('home-hamlets')&&p.name!=='home-planting-bed');
 assert.equal(facades.length,20);
 for(const p of facades)assert.ok(BOG_SOLIDS.some(b=>b.id===p.id||b.prop===p.id),p.id+' physical footprint');
 assert.equal(BOG_SOLIDS.filter(b=>b.kind==='wall').length,14);
 assert.equal(new Set(BOG_BLOCKERS.map(b=>b.id)).size,BOG_BLOCKERS.length);
 const shapes=bogBlockerPolygons();
 for(const b of BOG_BLOCKERS){
  assert.deepEqual(shapes.find(s=>s.id===b.id).poly,data.world.obstacles.find(s=>s.id===b.id).poly);
  assert.equal(nav.walkable(b.x+b.width/2,b.y+b.height/2),false,`${b.id} solid centre`);
 }
});
test('bridge is continuously walkable over Home water, with dry landings and its original 24-unit crown',()=>{
 const arch=map.world.arches[0];
 for(let x=arch.a[0];x<=arch.b[0];x+=8)assert.ok(nav.walkable(x,arch.a[1]),`bridge ${x}`);
 assert.ok(!map.world.water.some(w=>inPoly(...arch.a,w.poly)));
 assert.ok(!map.world.water.some(w=>inPoly(...arch.b,w.poly)));
 assert.equal(arch.r,24);
 assert.ok(map.world.walkways[0].boatPassUnder);
 assert.equal(nav.walkable(2000,2800),false,'pool away from bridge blocks walking');
});
test('Home plant geometry is kept at source size and every root is on dry land',()=>{
 const sizes={tree:[[260,360],[180,360],[300,380],[200,280],[150,380]],bush:[[130,100],[168,110],[116,104],[140,100]]};
 for(const p of art.props){const m=p.name.match(/^(tree|bush)-(\d)-/);if(!m)continue;
  assert.deepEqual([p.width,p.height],sizes[m[1]][Number(m[2])-1]);assert.ok(inPoly(p.x,p.y,map.world.coast),p.id+' coast');
  assert.ok(!map.world.water.some(w=>inPoly(p.x,p.y,w.poly)),p.id+' dry');
  const original=fs.readFileSync('public'+p.homeSource,'utf8').match(/\bd="[^"]*"/g);
  const recolour=fs.readFileSync('public/pixi-art/themes/bog-arena/'+p.src,'utf8').match(/\bd="[^"]*"/g);
  assert.deepEqual(recolour,original,p.id+' exact Home paths');
 }
 assert.ok(art.props.filter(p=>p.name.startsWith('tree-')).length>=250);
 assert.equal(art.raster.enabled,false);
});
