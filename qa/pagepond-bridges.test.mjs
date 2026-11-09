import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DOMParser} from '@xmldom/xmldom';
import {inPoly} from '../rive/web/island-geometry.mjs';
import {mapFor} from '../src/pixi/island-maps.js';
const read=p=>JSON.parse(fs.readFileSync(p));
const art=read('public/pixi-art/themes/library/art.json'),world=read('rive/web/themes/library/world.json'),walk=read('rive/web/themes/library/walk-world.json');
const ground=read('scripts/pagepond/layout.json'),bridges=art.decks.filter(d=>d.homeSource);
const xml=p=>new DOMParser().parseFromString(fs.readFileSync(p,'utf8'),'image/svg+xml');
const paths=doc=>Array.from(doc.getElementsByTagName('path'));
const nums=d=>(d.match(/[-+]?(?:\d*\.\d+|\d+)/g)??[]).map(Number);
const near=(a,b,label)=>assert(Math.abs(a-b)<.001,label+`: ${a} != ${b}`);
const floor=p=>ground.floorRings.reduce((n,r)=>n+(inPoly(...p,r)?1:0),0)%2===1;
function posts(doc){return paths(doc).flatMap(p=>[...p.getAttribute('d').matchAll(/M[^M]+/g)].flatMap(([sub])=>{
 if(!/Z/.test(sub)||/Q/.test(sub))return[];const n=nums(sub);if(n.length!==8)return[];
 const xs=n.filter((_,i)=>i%2===0),ys=n.filter((_,i)=>i%2===1),w=Math.max(...xs)-Math.min(...xs),h=Math.max(...ys)-Math.min(...ys);
 if(w<5||w>7||h<40||h>43)return[];
 // Both long edges must be vertical and both short edges horizontal.
 near(n[0],n[6],'left post upright');near(n[2],n[4],'right post upright');near(n[1],n[3],'level post top');near(n[5],n[7],'level post foot');return [[w,h]];
}));}

test('all 17 Pagepond Honeywood bridges have no skew, shear or non-uniform render scale',()=>{
 assert.equal(bridges.length,17);
 assert(!art.props.some(p=>/canal-bridge-(north|south)-front\.svg$/.test(p.src)),'retired foreground rail layers cannot overlay the Home bridges');
 for(const d of bridges){
  const doc=xml('public/pixi-art/themes/library/'+d.src),root=doc.documentElement;
  assert.equal(root.getAttribute('data-home-source'),d.homeSource,d.id+' approved source');
  const vb=nums(root.getAttribute('viewBox'));
  near(d.width/vb[2],1,d.id+' render x scale');near(d.height/vb[3],1,d.id+' render y scale');
  for(const el of Array.from(doc.getElementsByTagName('*'))){
   const t=el.getAttribute('transform');assert(!t||/^translate\([\d.,\s-]+\)$/.test(t),d.id+' forbids affine/scale/rotate/skew transforms: '+t);
  }
  for(const key of ['skew','skewX','skewY','rotation','scale','scaleX','scaleY'])assert(d[key]===undefined||d[key]===(key.startsWith('scale')?1:0),d.id+' placement '+key);
  const source=xml('public'+d.homeSource),a=posts(source),b=posts(doc);assert.equal(a.length,12);assert.equal(b.length,a.length,d.id+' all original posts');
  a.forEach((p,i)=>p.forEach((v,k)=>near(b[i][k],v,d.id+' rigid post '+i)));
  const sourceBoards=paths(source).find(p=>p.getAttribute('stroke-width')==='.85'),boards=paths(doc).find(p=>p.getAttribute('stroke-width')==='.85');
  const before=[...sourceBoards.getAttribute('d').matchAll(/M([^M]+)/g)],after=[...boards.getAttribute('d').matchAll(/M([^M]+)/g)];assert.equal(after.length,before.length);
  before.forEach((m,i)=>{const a=nums(m[1]),b=nums(after[i][1]);if(d.homeSource.includes('-ew')){near(b[0],b[2],d.id+' transverse plank');near(b[3]-b[1],a[3]-a[1],d.id+' original deck depth');}else if(d.homeSource.includes('-ns')){near(b[1],b[3],d.id+' level cross plank');near(b[2]-b[0],a[2]-a[0],d.id+' original deck width');}else{near(b[2]-b[0],a[2]-a[0],d.id+' original cross-plank x');near(b[3]-b[1],a[3]-a[1],d.id+' original cross-plank y');}});
 }
});

test('all 34 Pagepond bridge ends meet widened paths and the production deck physics',()=>{
 const map=mapFor('library'),nav=map.nav();
 for(const d of bridges){
  const arch=world.arches.find(w=>w.id===d.id),way=world.walkways.find(w=>w.id===d.id);
  assert(arch&&way?.boatPassUnder,d.id+' arch and underpass');assert.deepEqual(walk.arches.find(w=>w.id===d.id),arch);assert.deepEqual(walk.walkways.find(w=>w.id===d.id),way);
  assert.deepEqual([way.a,way.b],[d.a,d.b]);assert.equal(arch.r,24,d.id+' source crown');
  const dx=d.b[0]-d.a[0],dy=d.b[1]-d.a[1],l=Math.hypot(dx,dy),u=[dx/l,dy/l];assert(dx===0||dy===0||Math.abs(Math.abs(dy/dx)-184/297)<.001,d.id+' authored square crossing direction');
  for(const [sign,p]of [[-1,d.a],[1,d.b]]){
   const v=d.homeSource.includes('-ne')?[85,52]:d.homeSource.includes('-nw')?[-85,52]:[-u[1]*100,u[0]*100],vl=Math.hypot(...v);
   for(const cross of [-48,-24,0,24,48])assert(floor([p[0]+v[0]/vl*cross,p[1]+v[1]/vl*cross]),d.id+' full-width bank throat '+cross);
   for(let distance=0;distance<=40;distance+=4){const q=p.map((v,k)=>v+u[k]*sign*distance);assert(floor(q),d.id+' path extends to deck');assert(nav.walkable(...q),d.id+' clear landing');}
   const route=nav.route(map.spawn.x,map.spawn.y,...p);assert.deepEqual(route.at(-1),p,d.id+' landing reachable');
  }
  for(let t=0;t<=1;t+=.02)assert(nav.walkable(d.a[0]+dx*t,d.a[1]+dy*t),d.id+' continuous deck');
 }
});

test('every Pagepond bridge crosses the local water flow rather than following it',()=>{
 const channels=[...ground.channels,...read('scripts/pagepond-rework/report.json').boatTours].map(c=>(c.samples??c.points).map(p=>p.slice(0,2)));
 const at=(ps,station)=>{for(let i=1;i<ps.length;i++){const a=ps[i-1],b=ps[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(station<=l)return a.map((v,k)=>v+(b[k]-v)*Math.max(0,station)/l);station-=l;}return ps.at(-1);};
 for(const d of bridges){
  const centre=d.a.map((v,k)=>(v+d.b[k])/2);let best={distance:Infinity};
  for(const ps of channels){let station=0;for(let i=1;i<ps.length;i++){const a=ps[i-1],b=ps[i],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy);if(!l)continue;const t=Math.max(0,Math.min(1,((centre[0]-a[0])*dx+(centre[1]-a[1])*dy)/(l*l))),distance=Math.hypot(centre[0]-a[0]-dx*t,centre[1]-a[1]-dy*t);if(distance<best.distance)best={distance,ps,station:station+t*l};station+=l;}}
  const a=at(best.ps,best.station-60),b=at(best.ps,best.station+60),flow=[b[0]-a[0],b[1]-a[1]],deck=[d.b[0]-d.a[0],d.b[1]-d.a[1]];
  // Four authored camera directions bound the angular fit. This catches the
  // old EW spans on the two diagonal bends without rotating their uprights.
  assert(Math.abs(flow[0]*deck[0]+flow[1]*deck[1])/Math.hypot(...flow)/Math.hypot(...deck)<.56,d.id+' crosses the local river spine');
 }
});
