import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sleeperFootprint} from '../src/world/home/sleep-spots.js';
import {makeMap} from '../src/world/island-maps.js';
import {inPoly} from '../assets/world/island-geometry.mjs';
import {CLUMPS,FEATURES,LANES,NOD_COMPANIONS} from '../scripts/bigger-cathedral/centre-data.mjs';
const A='public/pixi-art/themes/cathedral/',D='assets/world/themes/cathedral/',read=p=>JSON.parse(fs.readFileSync(p));
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),harbor=read(D+'harbor.json');
const before=read('scripts/bigger-cathedral/centre-source/art.json'),ring=read('scripts/bigger-cathedral/water-geometry.json').ring;
const map=makeMap('cathedral',{world,walk,harbor}),inside=p=>inPoly(p.x,p.y,ring);
const segmentDistance=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);};
test('B2 keeps the approved garden objects after the village replacement',()=>{
 for(const [id]of FEATURES.filter(([id])=>!id.startsWith('balustrade')))assert.ok(art.props.some(p=>p.id==='b2-'+id),id);
 assert.equal(art.props.filter(p=>p.id?.startsWith('b2-parterre')).length,4);
 for(const p of art.props.filter(p=>inside(p)&&/tree|bush/i.test(p.name)&&p.id!=='cloister-olive-well'))assert.match(p.src,/^autumn\/(tree-[1-5]|bush-[1-4])-(amber|rust|mustard|green)\.svg$/);
 for(const p of art.props.filter(p=>p.id?.startsWith('b2-')))assert.doesNotMatch(fs.readFileSync(p.src.startsWith('/')?'public'+p.src:A+p.src,'utf8'),/<image\b|<(?:linear|radial)Gradient\b|data:image/i,p.id);
});
test('Home clump roots stay dry, clear of paths, and use solid shallow trunks',()=>{
 for(const [i,c]of CLUMPS.entries()){
  assert.ok(c.filter(p=>typeof p[2]==='number').length>=2,'clump '+i);
  assert.ok(c.filter(p=>typeof p[2]==='number').length<=7,'clump '+i);
  assert.ok(c.filter(p=>typeof p[2]==='string').length>=1,'bush feet '+i);
 }
 for(const c of NOD_COMPANIONS)assert.equal(c.length,2,'one companion tree and bush beside each sleeper trunk');
 for(const p of art.props.filter(p=>/^b2-(clump|nod)/.test(p.id))){
  assert.ok(map.landAt(p.x,p.y),p.id+' dry');
  if(p.name!=='Home garden tree')continue;
  const fixedThroat=world.walkways.some(b=>b.id==='east-main-1'&&[b.a,b.b].some(q=>Math.hypot(p.x-q[0],p.y-q[1])<200));
  for(const [i,line]of world.paths.entries())for(let j=1;j<line.length;j++)assert.ok(segmentDistance(p.x,p.y,line[j-1],line[j])>(world.pathWidths[i]/2+(fixedThroat?24:40)),p.id+' clears lane '+i);
  assert.ok(walk.obstacles.some(o=>o.id===p.id&&o.rx===18&&o.ry===12),'trunk '+p.id);
 }
});
test('Every drawn inner curve supports walking, including the fountain plaza arrivals and pond approach',()=>{
 for(const [i,line]of world.paths.entries())if(i>=10&&i<24)for(const [x,y]of line)assert.ok(map.nav().walkable(x,y),'lane '+i+' '+x+','+y);
 assert.deepEqual(walk.paths,world.paths);
 assert.equal(map.sleepers.length,120);
});
test('All thirteen bridge sprites retain sailing geometry with the Home family',()=>{
 const geo=read('scripts/bigger-cathedral/water-geometry.json');
 for(const b of geo.bridges){const p=art.decks.find(p=>p.id==='bellovo-'+b.id);assert.ok(p.overBoats);assert.match(p.src,/^bridges\/home-/);assert.ok(['ns','ew','ne','nw'].includes(p.homeBridge));assert.deepEqual(world.walkways.find(w=>w.id===b.id),{...b,boatPassUnder:true});}
});

test('Garden fits the duck scale brief and all residents rest off the beds and fountain plaza',()=>{
 const prop=id=>art.props.find(p=>p.id==='b2-'+id);
 for(const id of ['parterre-nw','parterre-ne','parterre-sw','parterre-se'])assert.deepEqual([prop(id).width,prop(id).height],[560,230]);
 for(const [id,size]of [['fountain',[300,320]],['lemon-nw',[110,160]],['arbour',[300,320]],['gazebo',[380,400]]])assert.deepEqual([prop(id).width,prop(id).height],size);
 assert.equal(art.props.filter(p=>/^b2-bench-/.test(p.id)).length,4);
 assert.equal(art.props.filter(p=>/^b2-lamp-/.test(p.id)).length,2);
 for(const p of art.props.filter(p=>/^b2-(parterre|fountain|lemon|arbour|gazebo)/.test(p.id))){
  const svg=fs.readFileSync(A+p.src,'utf8'),root=svg.match(/<svg\b[^>]*>/)[0];
  assert.ok(+root.match(/\bwidth="([\d.]+)"/)[1]>=p.width-.01,p.id+' intrinsic width');
  assert.ok(+root.match(/\bheight="([\d.]+)"/)[1]>=p.height-.01,p.id+' intrinsic height');
 }
 for(const bed of map.sleepers){
  const foot=sleeperFootprint(bed);
  assert.ok(Math.hypot(bed.x-4100,bed.y-4250)>390+bed.r,'resident off plaza');
  for(const p of art.props.filter(p=>/^b2-parterre/.test(p.id)))assert.ok(Math.abs(bed.x-p.x)>p.width/2+bed.r||foot.y+foot.ry<p.y-p.height||foot.y-foot.ry>p.y,'resident off '+p.id);
 }
 for(const [x,y]of [[4100,3910],[4100,4590],[3760,4250],[4440,4250],[3950,4120],[4250,4120],[3950,4410],[4250,4410]])assert.ok(map.nav().walkable(x,y),'plaza walking '+x+','+y);
});
