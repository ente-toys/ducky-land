import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
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
 assert.equal(art.props.filter(p=>p.name.startsWith('tree-')).length,20);
 assert.equal(art.raster.enabled,false);
});

test('twenty perimeter trees leave fighting lanes clear and preserve the original scenery alongside new field cover',()=>{
 const isTree=p=>/^home\/tree-[1-5]-[a-z]+\.svg$/.test(p.src);
 const trees=art.props.filter(isTree);
 const trunkId=p=>p.id.replace('-tree-','-trunk-');
 const trunks=new Set(trees.map(trunkId));
 const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 assert.equal(trees.length,20);
 assert.equal(art.props.length,474);
 assert.equal(BOG_BLOCKERS.length,328);
 // These fingerprints lock all bushes, walls, ruins, buildings, reeds and
 // unrelated collision to their values before the tree removal. New field cover
 // is verified separately by the field-cover layout checks.
 assert.equal(hash(art.props.filter(p=>!isTree(p)&&!p.id.startsWith('field-cover-'))),'12ca34e77acf855fc150c4f4ecb7a2334bbfff90e8f9756425c9f0a960bfedcd');
 assert.equal(hash(BOG_BLOCKERS.filter(b=>!trunks.has(b.id)&&!b.id.startsWith('field-cover-'))),'2d97acdcc19849969075a4af042b956e792a44768486267195506323b533da43');
 for(const p of trees){
  assert.ok(p.x<1400||p.x>6800||p.y<1300||p.y>6300,p.id+' outside fighting lanes');
  assert.ok(BOG_BLOCKERS.some(b=>b.id===trunkId(p)),p.id+' retained trunk');
 }
 for(const edge of [p=>p.y<1300,p=>p.x<1400,p=>p.x>6800,p=>p.y>6300])
  assert.ok(trees.filter(edge).length>=4,'scenery on every outer edge');
 const layout=JSON.parse(fs.readFileSync('scripts/bog-environment/layout.json'));
 assert.deepEqual(layout.props.map(p=>p.id),art.props.map(p=>p.id));
 assert.deepEqual(layout.props.filter(isTree),trees);
 assert.deepEqual(layout.blockers,JSON.parse(fs.readFileSync('src/features/bog-combat/bog-blockers.json')));
 assert.deepEqual(data.world.obstacles.map(p=>p.id),BOG_BLOCKERS.map(b=>b.id));
});
