import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeMap,mapFor} from '../src/pixi/island-maps.js';
import {geometry,inShape} from '../assets/world/island-geometry.mjs';
import {resolveSleepSpots,sleepHalfWidths,sleepShapeProblems} from '../src/pixi/sleep-spots.js';
import {BENCHES} from '../scripts/bigger-cathedral/life-data.mjs';
import {benchSeatAt} from '../src/pixi/bench-seat.js';
const read=p=>JSON.parse(fs.readFileSync(p)),A='public/pixi-art/themes/cathedral/',D='assets/world/themes/cathedral/';
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),harbor=read(D+'harbor.json');
const map=makeMap('cathedral',{world,walk,harbor,sleepers:[]}),plants=art.props.filter(p=>p.autumn);
const seg=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);};
const pathEdge=(x,y)=>Math.min(...world.paths.map((p,i)=>Math.min(...p.slice(1).map((b,j)=>seg(x,y,p[j],b)))-(world.pathWidths?.[i]??128)/2));
const plantFile=p=>fs.readFileSync(A+p.src,'utf8');
test('Bellovo has Fair-level Home autumn groves, all five trees and four bushes, without wet roots or blocked lanes',()=>{
 assert.ok(plants.filter(p=>p.autumn.kind==='tree').length>=246);
 assert.ok(plants.filter(p=>p.autumn.kind==='bush').length>=286);
 const variants=new Set(plants.map(p=>p.src.match(/(tree-\d|bush-\d)/)[1]));
 assert.equal(variants.size,9);
 const tones=new Set(plants.map(p=>p.autumn.tone));assert.equal(tones.size,4);
 for(const p of plants){
  assert.ok(map.landAt(p.x,p.y),p.id+' on land');
  assert.ok(!walk.water.some(w=>inShape(p.x,p.y,w)),p.id+' dry');
  assert.ok(pathEdge(p.x,p.y)>(p.autumn.kind==='bush'?80:30),p.id+' off paths');
  assert.ok(!world.walkways.some(w=>seg(p.x,p.y,w.a,w.b)<w.w/2+60),p.id+' clear bridge');
  assert.equal(p.wind,false);assert.equal(p.shadow,false);
  assert.equal(art.flats.filter(f=>f.id==='life-'+p.id+'-shadow').length,1,p.id+' one shadow');
  const svg=plantFile(p);assert.doesNotMatch(svg,/<(?:image|linearGradient|radialGradient)\b/);
  // Paths, not just the silhouette, must be the exact approved Home source.
  const home=fs.readFileSync('public/pixi-art/plants/'+p.src.match(/(tree-\d|bush-\d)/)[1]+'.svg','utf8');
  assert.deepEqual([...svg.matchAll(/\bd="([^"]+)"/g)].map(m=>m[1]),[...home.matchAll(/\bd="([^"]+)"/g)].map(m=>m[1]));
  const box=svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);assert.ok(box[2]>=p.width&&box[3]>=p.height);
 }
 const trees=plants.filter(p=>p.autumn.kind==='tree');
 for(const p of trees.filter(p=>p.grove))assert.ok(trees.some(q=>q!==p&&Math.hypot(q.x-p.x,q.y-p.y)<500),p.id+' grove neighbour');
 assert.ok(!trees.some(p=>p.x>3230&&p.x<5050&&p.y>700&&p.y<3620),'cathedral sightline');
 assert.ok(art.flats.filter(p=>p.id?.startsWith('life-litter-')).length>=20);
});
test('Exactly 120 valid client/server sleepers replace displaced original beds and every approved pose',()=>{
 const base=map.baseWalk,beds=resolveSleepSpots(base,art.props,geometry(base).walkable,sleepHalfWidths(),{spots:world.sleepSpots,warn:false});
 assert.equal(world.sleepTotal,120);assert.equal(beds.length,120);assert.deepEqual(beds.bad,[]);
 assert.deepEqual(sleepShapeProblems(world.sleepSpots,120),[]);
 assert.equal(mapFor('cathedral').sleepers.length,120,'production registry count');
 for(const bed of beds){assert.ok(map.landAt(bed.x,bed.y));assert.ok(!walk.water.some(w=>inShape(bed.x,bed.y,w)));}
 const before=read('scripts/bigger-cathedral/life-source/world.json').sleepSpots;
 const retired=new Set(['4580,1490','2990,2860','5621,2801','3020,2200']);
 for(const [pose,spots]of Object.entries(before))for(const spot of spots)if(!retired.has(spot.slice(0,2).join(',')))assert.ok(world.sleepSpots[pose].some(s=>JSON.stringify(s)===JSON.stringify(spot)),pose+' original bed');
});
test('All sixteen Home benches face their view, have one shadow, paving, and a reachable seat',()=>{
 const benches=art.props.filter(p=>p.sittable),nav=map.nav();assert.equal(benches.length,16);
 for(const [id,x,y,view,target]of BENCHES){
  const p=benches.find(p=>p.id===id);assert.ok(p);assert.equal(p.shadow,true);assert.equal(p.wind,false);assert.equal(p.flip,false);assert.equal(p.rotation??0,0);
  assert.deepEqual([p.x,p.y],[x,y]);assert.equal(p.bench.view,view);assert.deepEqual(p.bench.target,target);
  const svg=plantFile(p);assert.doesNotMatch(svg,/(?:rotate|skew|matrix)\(/);assert.doesNotMatch(svg,/opacity=/);
  assert.equal(art.flats.filter(f=>f.id===id+'-shadow').length,0);
  const onPaving=(px,py)=>id.startsWith('cloister')?((px-4100)/1160)**2+((py-2490)/850)**2<1:id.startsWith('b2')?Math.hypot(px-4100,py-4250)<390:art.flats.some(f=>/square/.test(f.id??'')&&px>f.x&&px<f.x+f.width&&py>f.y&&py<f.y+f.height);
  for(const [dx,dy]of [[0,0],[-p.width*.35,0],[p.width*.35,0],[0,-25]])assert.ok(onPaving(x+dx,y+dy),id+' paving');
  const s=p.bench.seat;assert.ok(nav.walkable(s.x,s.y),id+' open seat');
  assert.ok(nav.route(map.spawn.x,map.spawn.y,s.x,s.y).length,id+' reachable seat');
  const pose={x:s.x,y:s.y,action:0,travel:0,jumpLeft:0};assert.equal(benchSeatAt(benches,pose)?.bench,id);
  assert.equal(benchSeatAt(benches,{...pose,action:1,travel:130}),null,'walk to stand');
  assert.equal(benchSeatAt(benches,{...pose,mode:'sailing'}),null);
 }
});
