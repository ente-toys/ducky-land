import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DOMParser} from '@xmldom/xmldom';
import {mapFor} from '../src/pixi/island-maps.js';
import {canSail} from '../src/pixi/islands.js';
// placements.js imports browser-only Home JSON. Execute its actual deckY
// implementation without loading the unrelated browser asset pipeline.
const deckY=Function('return '+fs.readFileSync('src/pixi/placements.js','utf8').match(/export (function deckY[\s\S]*?\n})/)[1])();
const A='public/pixi-art/themes/community/',D='rive/web/themes/community/';
const read=p=>JSON.parse(fs.readFileSync(p)),art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json');
const bridges=art.decks.filter(d=>d.homeSource),xml=s=>new DOMParser().parseFromString(s,'image/svg+xml');
const paths=root=>Array.from(root.getElementsByTagName('path'));
const subs=p=>p.getAttribute('d').match(/M[^M]+/g);
const coords=d=>(d.match(/[-+]?(?:\d*\.\d+|\d+)/g)??[]).map(Number);
const close=(a,b,label)=>{assert.equal(a.length,b.length,label);a.forEach((v,i)=>assert(Math.abs(v-b[i])<.00002,label+`: ${a} != ${b}`));};
const sourcePaths=d=>paths(xml(fs.readFileSync('public'+d.homeSource,'utf8')));

test('all twelve Campfire crossings use recoloured Home Honeywood vectors at native size with unchanged ink',()=>{
 assert.equal(art.raster.enabled,false);
 assert.equal(bridges.length,12);
 assert.deepEqual(new Set(bridges.map(d=>d.homeBridge)),new Set(['ew','ns','ne','nw']));
 assert.equal(art.decks.filter(d=>!d.homeSource).length,2,'only the pond and harbour docks are retained');
 for(const d of bridges){
  const svg=fs.readFileSync(A+d.src,'utf8'),root=xml(svg).documentElement;
  assert.equal(d.homeSource,`/pixi-art/home-expansion-c/bridges/bridge-${d.homeBridge}.svg`);
  assert.equal(root.getAttribute('data-home-source'),d.homeSource);
  assert.doesNotMatch(svg,/transform=|<(?:image|linearGradient|radialGradient|filter)\b|data:|\.png\b/i);
  for(const key of ['rotation','skew','skewX','skewY','scale','scaleX','scaleY','flip'])assert.equal(d[key],undefined,d.id+' untransformed placement');
  const vb=coords(root.getAttribute('viewBox'));
  close([d.width,d.height],[vb[2],vb[3]],d.id+' one SVG unit per world unit');
  assert.equal(root.getElementsByTagName('g')[0].getAttribute('stroke'),'#39472d');
  assert.equal(root.getElementsByTagName('g')[0].getAttribute('stroke-width'),'1.15');
  assert.deepEqual(new Set(paths(root).map(p=>p.getAttribute('fill')).filter(v=>v&&v!=='none')),new Set(['#C9C3F2','#6F78D8']));
  const actual=paths(root),source=sourcePaths(d);
  assert.equal(actual.length,source.length-2,'only obstructing source end sills are removed');
  actual.forEach((p,i)=>{
   assert.equal(+p.getAttribute('data-home-path'),i+2);
   assert.equal(p.getAttribute('d').replace(/[-+]?(?:\d*\.\d+|\d+)/g,''),source[i+2].getAttribute('d').replace(/[-+]?(?:\d*\.\d+|\d+)/g,''),d.id+' original source path commands');
   assert.equal(p.getAttribute('stroke-width'),source[i+2].getAttribute('stroke-width'),d.id+' source line weights');
  });
 }
});

test('Campfire source posts, cross-planks, grain and pins translate rigidly while only the span stations change',()=>{
 for(const d of bridges){
  const actual=paths(xml(fs.readFileSync(A+d.src,'utf8'))),source=sourcePaths(d),byIndex=i=>actual.find(p=>+p.getAttribute('data-home-path')===i);
  const indices=d.homeBridge==='ns'?[4,5,8,9,12,13]:d.homeBridge==='ew'?[2,7,8,11,14,15]:[2,7,8,12,13,16,17];
  for(const index of indices){
   const a=subs(byIndex(index)),b=subs(source[index]);assert.equal(a.length,b.length);
   a.forEach((sub,i)=>{
    const aa=coords(sub),bb=coords(b[i]),shift=[aa[0]-bb[0],aa[1]-bb[1]];
    close(aa.map((v,k)=>v-bb[k]),aa.map((_,k)=>shift[k%2]),d.id+' rigid source part '+index+'/'+i);
   });
  }
 }
});

test('all 24 physical deck ends meet the original Campfire path anchors with unchanged cross-deck widths',()=>{
 const baseline=read('scripts/campfire-hamlets/baseline/world.json'),newCrossings=read('scripts/campfire-hamlets/placement.json').crossings;
 const anchors=[...baseline.walkways.slice(0,5),...newCrossings];
 for(const d of bridges){
  assert(anchors.some(b=>JSON.stringify([b.a,b.b])===JSON.stringify([d.a,d.b])),d.id+' unchanged path anchors');
  const root=xml(fs.readFileSync(A+d.src,'utf8')).documentElement,vb=coords(root.getAttribute('viewBox'));
  const index=d.homeBridge==='ns'?3:6,path=paths(root).find(p=>+p.getAttribute('data-home-path')===index);
  const commands=path.getAttribute('d').match(/[MLQZ][^MLQZ]*/g).map(c=>coords(c));
  const [m,q,l,q2]=commands,ends=[[m,q2.slice(-2)],[q.slice(-2),l]];
  const offset=[d.x-vb[0],d.y-vb[1]];
  const positions=ends.map(([a,b])=>a.map((n,k)=>(n+b[k])/2+offset[k]));
  for(const p of [d.a,d.b])assert(positions.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<.00002),d.id+' flush physical deck endpoint '+p);
  const before=sourcePaths(d)[index].getAttribute('d').match(/[MLQZ][^MLQZ]*/g).map(c=>coords(c));
  const sourceEnds=[[before[0],before[3].slice(-2)],[before[1].slice(-2),before[2]]];
  ends.forEach(([a,b],i)=>close(a.map((v,k)=>b[k]-v),sourceEnds[i][0].map((v,k)=>sourceEnds[i][1][k]-v),d.id+' source cross-deck width'));
 }
});

test('all Campfire bridge collision is shared by client and server, follows the source crown, and permits real boat transit',()=>{
 const map=mapFor('community'),nav=map.nav();
 for(const key of ['walkways','bridges','arches'])assert.deepEqual(world[key],walk[key],key+' authoritative collision');
 assert.equal(world.arches.length,12);assert.equal(world.bridges.length,13);
 // The older diagonal anchors are asymmetric about the river spine. These
 // stations follow the actual wet channel, preserving both fixed landings.
 const stations={'campfire-west-islet':.35,'campfire-east-islet':.35,'campfire-northwest':.6,'campfire-northeast':.55,'campfire-east':.575,'arched-0':.275,'arched-1':.275,'arched-2':.425,'arched-3':.425,'arched-4':.4,'arched-5':.45,'arched-6':.425};
 for(const d of bridges){
  const way=world.walkways.find(w=>w.id===d.id),arch=world.arches.find(w=>w.id===d.id);
  assert.equal(way.boatPassUnder,true);assert.equal(d.overBoats,true);
  assert.deepEqual([way.a,way.b],[d.a,d.b]);assert.deepEqual([arch.a,arch.b],[d.a,d.b]);assert.equal(arch.r,24);
  const dx=d.b[0]-d.a[0],dy=d.b[1]-d.a[1],len=Math.hypot(dx,dy),mid=d.a.map((v,k)=>(v+d.b[k])/2);
  assert.equal(deckY(...mid,world.arches),mid[1]-24,d.id+' walker follows the Home crown');
  for(let i=0;i<=40;i++)assert(nav.walkable(d.a[0]+dx*i/40,d.a[1]+dy*i/40),d.id+' continuous walkable span');
  for(const p of [d.a,d.b])assert.deepEqual(nav.route(map.spawn.x,map.spawn.y,...p).at(-1),p,d.id+' connected landing');
  for(let s=-110;s<=110;s+=5)assert(canSail(d.a[0]+dx*stations[d.id]-dy/len*s,d.a[1]+dy*stations[d.id]+dx/len*s,'isle-250'),d.id+' full 46-radius boat passes under bridge at '+s);
 }
});
