import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mapFor} from '../src/pixi/island-maps.js';
import {inPoly,inShape,geometry} from '../rive/web/island-geometry.mjs';
import {checkTheme} from '../scripts/theme-index.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const original=read('scripts/bigger-pink/original-art.json'),oldWorld=read('scripts/bigger-pink/original-world.json'),oldWalk=read('scripts/bigger-pink/original-walk.json');
const art=read('public/pixi-art/themes/pink/art.json'),layout=read('scripts/bigger-pink/layout.json'),map=mapFor('pink');

test('bigger Pink keeps its original composition, centre, sleepers and collision geometry in place',()=>{
 assert.deepEqual(art.props.slice(0,original.props.length),original.props);
 assert.deepEqual(art.flats,original.flats);
 assert.deepEqual(art.decks.slice(0,original.decks.length),original.decks);
 assert.deepEqual(map.world.water.slice(0,oldWorld.water.length),oldWorld.water);
 assert.deepEqual(map.world.bridges.slice(0,oldWorld.bridges.length),oldWorld.bridges);
 for(const key of ['sleepSpots','sleepAvoid','centrePlacement','islets','walkways','arches'])assert.deepEqual(map.world[key],oldWorld[key],key);
 assert.deepEqual(map.world.obstacles.slice(0,oldWorld.obstacles.length),oldWorld.obstacles);
 assert.deepEqual(map.baseWalk.obstacles.slice(0,oldWalk.obstacles.length),oldWalk.obstacles);
 for(const [key,zone] of Object.entries(oldWorld.zones))assert.deepEqual(map.world.zones[key],zone);
 assert.deepEqual(map.spawn,{x:4000,y:3224.62});
 assert.equal(map.sleepers.length,40);
 for(const bed of map.sleepers)assert.ok(map.landAt(bed.x,bed.y));
});

test('bigger Pink reaches every new court and completes both promenade loops with a negative origin',()=>{
 assert.deepEqual(map.origin,{x:-2600,y:-1900});
 assert.equal(map.width,13200);assert.equal(map.height,9800);
 const nav=map.nav(),from=map.spawn;
 for(const p of layout.places){const point=map.world.zones['bigger-'+p.id].spawn;assert.ok(nav.walkable(...point),p.id+' arrival');assert.ok(nav.route(from.x,from.y,...point).length,p.id+' route');}
 // Sample the complete authored loops, including their negative-coordinate edges.
 for(const [name,loop] of [['coast',layout.shoreWalk],['promenade',layout.paths[0]]])for(let i=0;i<loop.length;i++){
  const p=loop[i],q=loop[(i+1)%loop.length];
  for(const k of [0,.25,.5,.75]){const x=p[0]+(q[0]-p[0])*k,y=p[1]+(q[1]-p[1])*k,near=nav.nearest(x,y,170);assert.ok(near,name+' is open near '+x+','+y);assert.ok(nav.route(from.x,from.y,...near).length,name+' connected');}
 }
 for(const prop of layout.props){
  assert.ok(inPoly(prop.x,prop.y,layout.coast),prop.id+' on land');
  const w=prop.width*prop.scale,h=prop.height*prop.scale,a=prop.anchor??{x:.5,y:1};
  for(let y=0;y<=6;y++)for(let x=0;x<=6;x++){
   const px=prop.x-a.x*w+w*x/6,py=prop.y-a.y*h+h*y/6;
   const protectedLand=inPoly(px,py,oldWorld.coast)||oldWorld.islets.some(([cx,cy,rx,ry])=>((px-cx)/rx)**2+((py-cy)/ry)**2<1);
   assert.ok(!protectedLand,prop.id+' keeps original mainland and islets clear');
  }
 }
});

test('bigger Pink has GPU-safe ground tiles, visible solids and working refitted moorings',()=>{
 const report=checkTheme('pink');assert.deepEqual(report.problems,[]);
 for(const t of art.ground.tiles){const text=readFileSync(new URL('../public/pixi-art/themes/pink/'+t.src,import.meta.url),'utf8');const m=text.match(/width="([\d.]+)" height="([\d.]+)"/);assert.ok(+m[1]<=1536&&+m[2]<=1536,t.src);}
 const ids=new Set(layout.props.map(p=>p.id));
 for(const o of layout.obstacles){assert.ok(o.name&&(ids.has(o.name)||/post|planter|leg/.test(o.name)),o.name+' visible source');assert.equal(map.nav().walkable(o.x,o.y),false,o.name+' blocks its base');}
 for(const b of map.boatSpots()){assert.equal(map.landAt(b.x,b.y),false);assert.ok(map.shoreFor(b.x,b.y,260),'boardable berth');}
 assert.ok(map.nav().route(map.HARBOR.land.x,map.HARBOR.land.y,map.spawn.x,map.spawn.y).length,'marina to plaza');
});

test('Pink communities have accessible household gates, distinct workplaces and linked residential lanes',()=>{
 const nav=map.nav();
 assert.equal(layout.places.length,5);
 const workplaces={ribbonwick:'expansion/ribbon-worktable.svg',melody:'expansion/ribbon-stage.svg',quay:'detail/teacup-cafe.svg',petalpatch:'expansion/rose-glasshouse.svg',tutu:'expansion/ribbon-stage.svg'};
 for(const p of layout.places){
  const houses=layout.props.filter(h=>h.zone===p.id&&h.household);
  assert.ok(houses.length>=5,p.name+' is a neighbourhood');
  assert.ok(layout.props.some(h=>h.zone===p.id&&h.src===workplaces[p.id]),p.name+' workplace');
  for(const h of houses){
   const gate=[h.x,h.y+220];
   assert.ok(nav.walkable(...gate),h.id+' open front gate');
   assert.ok(nav.route(map.spawn.x,map.spawn.y,...gate).length,h.id+' connected household');
  }
 }
 for(const p of layout.props.filter(p=>/worktable|potting-bench|music-rack|tea-table/.test(p.src))){
  const near=nav.nearest(p.x,p.y+100,80);
  assert.ok(near,p.id+' workplace approach');
  assert.ok(nav.route(map.spawn.x,map.spawn.y,...near).length,p.id+' workplace reachable');
 }
});

test('Pink canal and streams are real blocked water with usable timber crossings',()=>{
 const raw=geometry({...map.walk,bridges:[]}),nav=map.nav();
 assert.equal(layout.bridgeAudit.length,6);
 for(const d of layout.bridgeAudit){assert.ok(d.waterUnder,d.name+' restored over the canal');assert.ok(map.world.water.some(o=>inShape(...d.sample,o)),d.name+' wet midspan');assert.ok(nav.walkable(...d.sample),d.name+' usable planks');}
 for(const p of layout.props)assert.ok(!map.world.water.slice(oldWorld.water.length).some(o=>inShape(p.x,p.y,o)),p.id+' dry bank placement');
 for(const c of layout.riverCrossings){
  assert.ok(map.world.water.some(o=>inShape(...c.mid,o)),c.name+' water below planks');
  assert.equal(raw.walkable(...c.mid),false,c.name+' water blocks without deck');
  assert.ok(nav.walkable(...c.mid),c.name+' deck supports walking');
  const near=nav.nearest(...c.mid,50);assert.ok(near,c.name+' on navigation grid');
  assert.ok(nav.route(map.spawn.x,map.spawn.y,...near).length,c.name+' connected to heart');
 }
 for(const s of layout.streams){
  const pts=s.points.filter(([x,y])=>map.world.water.some(o=>inShape(x,y,o)));
  assert.ok(pts.length>=4,s.name+' runs through the new land');
  assert.ok(pts.some(([x,y])=>!nav.walkable(x,y)),s.name+' unbridged water blocks ducks');
 }
 const homes=layout.props.filter(p=>p.household);
 assert.equal(new Set(homes.map(p=>p.src)).size,29,'individually varied household facades');
});

test('Pink densification preserves its river system and keeps one narrow main road loop',()=>{
 const before=read('scripts/bigger-pink/dense-before-layout.json');
 for(const key of ['coast','places','water','bridges','decks','riverCrossings','bridgeAudit','streams'])assert.deepEqual(layout[key],before[key],key);
 const closed=layout.paths.filter(p=>p[0][0]===p.at(-1)[0]&&p[0][1]===p.at(-1)[1]);
 assert.equal(closed.length,1,'one main loop, with open local lanes');
 assert.equal(layout.pathWidths[0]-32,160,'sand width matches the original paths');
 assert.ok(layout.pathWidths.slice(1).every(w=>w<=104),'residential lanes stay narrower');
 assert.equal(layout.props.filter(p=>p.household).length,29);
 for(const c of layout.roadArt.densityMetrics.communities)assert.ok(c.meanDistanceToGreenAfter<c.meanDistanceToGreenBefore,c.name+' households closer to green');
});
