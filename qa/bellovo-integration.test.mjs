import test from 'node:test';
import assert from 'node:assert/strict';
import {A,D,read} from '../scripts/bigger-cathedral/final-model.mjs';
import {makeMap,mapFor} from '../src/pixi/island-maps.js';
import {inShape} from '../rive/web/island-geometry.mjs';
import {sleeperFootprint} from '../src/pixi/sleep-spots.js';
import {LEFT,RIGHT,PIAZZA} from '../scripts/bigger-cathedral/centre-art-data.mjs';
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json');
const map=makeMap('cathedral',{world,walk,harbor:read(D+'harbor.json')});
const seg=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);};
const edge=(x,y)=>Math.min(...world.paths.map((line,i)=>Math.min(...line.slice(1).map((b,j)=>seg(x,y,line[j],b)))-world.pathWidths[i]/2));
test('All 120 resident contact footprints are dry, off lanes and outside new architecture',()=>{
 assert.equal(map.sleepers.length,120);
 const registered=mapFor('cathedral').sleepers;assert.equal(registered.length,120);
 for(const [i,b]of map.sleepers.entries()){const s=registered[i];assert.deepEqual([s.pose,s.flip,s.tree],[b.pose,b.flip,b.tree]);assert.ok(Math.abs(s.x-b.x)<=.5&&Math.abs(s.y-b.y)<=.5&&Math.abs(s.r-b.r)<=.05,'registry quantization only');}
 const solids=walk.obstacles.filter(o=>o.id?.startsWith('centre-'));
 for(const bed of map.sleepers){
  const f=sleeperFootprint(bed);
  for(let i=0;i<24;i++){
   const a=i*Math.PI/12,x=f.x+f.rx*Math.cos(a),y=f.y+f.ry*Math.sin(a);
   assert.ok(map.landAt(x,y),`${bed.pose} ${bed.x},${bed.y}: dry contact`);
   assert.ok(!walk.water.some(w=>inShape(x,y,w)),`${bed.pose} ${bed.x},${bed.y}: no water contact`);
   assert.ok(edge(x,y)>0,`${bed.pose} ${bed.x},${bed.y}: off lane`);
   assert.ok(!solids.some(o=>inShape(x,y,o,8)),`${bed.pose} ${bed.x},${bed.y}: centre footprint`);
  }
  assert.ok(![LEFT,RIGHT].some(line=>line.slice(1).some((b,j)=>seg(bed.x,bed.y,line[j],b)<150)),`${bed.pose}: no bed in a colonnade portal`);
 }
});
test('Autumn roots, benches and doors remain clear of the new centre and each complete lane',()=>{
 const solids=walk.obstacles.filter(o=>o.id?.startsWith('centre-'));
 for(const p of art.props.filter(p=>p.autumn)){
  assert.ok(!solids.some(o=>inShape(p.x,p.y,o,65)),p.id+' centre footprint');
  assert.ok(edge(p.x,p.y)>(p.autumn.kind==='bush'?p.width*.4:25),p.id+' planted outside lane');
 }
 for(const p of art.props.filter(p=>p.sittable)){
  assert.ok(!solids.some(o=>inShape(p.x,p.y,o,65)),p.id+' centre footprint');
  assert.ok(map.nav().walkable(p.bench.seat.x,p.bench.seat.y),p.id+' usable');
 }
 for(const door of read('scripts/bigger-cathedral/buildings-doors.json')){
  const p=art.props.find(p=>p.id===door.id);
  assert.deepEqual(p.door,door.door);
  const route=world.paths[world.pathSystem.routes.findIndex(r=>r.id===door.id+'-door')];
  assert.deepEqual(route[0],door.door);
 }
});
test('Piazza entrances land in its actual ellipse, with the olive on the raised fountain island',()=>{
 const tree=art.props.find(p=>p.id==='cloister-olive-well');assert.deepEqual([tree.x,tree.y],[4100,2700]);
 assert.deepEqual([tree.x-tree.width*tree.anchor.x+tree.trunk[0],tree.y-tree.height*tree.anchor.y+tree.trunk[1]],[4100,2700],'drawn trunk, including SVG gutter, is exactly centred');
 assert.ok(!art.props.some(p=>p.id==='centre-wishing-well'));
 assert.ok(art.props.some(p=>p.id==='centre-A-fountain'));
 const court=read('scripts/bigger-cathedral/paths-input.json').courts.find(c=>c.id==='centre-piazza');
 assert.deepEqual([court.x,court.y,court.rx,court.ry],[PIAZZA.x,PIAZZA.y,PIAZZA.rx,PIAZZA.ry]);
 for(const name of ['olive-piazza','west-piazza','east-piazza','northeast-piazza']){
  const end=world.paths[world.pathSystem.routes.findIndex(r=>r.id===name)].at(-1);
  assert.ok(((end[0]-court.x)/court.rx)**2+((end[1]-court.y)/court.ry)**2<1,name+' flush piazza arrival');
 }
});

test('Every Honeywood crossing uses the matching 24-unit Home crown in client and authority',()=>{
 assert.deepEqual(world.arches,walk.arches);assert.equal(world.arches.length,13);
 for(const a of world.arches){assert.equal(a.r,24);const b=world.walkways.find(w=>w.id===a.id);assert.deepEqual([a.a,a.b,a.w],[b.a,b.b,b.w]);assert.equal(b.boatPassUnder,true);}
});
