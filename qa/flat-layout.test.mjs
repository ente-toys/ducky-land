import test from 'node:test';
import assert from 'node:assert/strict';
import {FLAT_RADIUS,FLAT_RING,FLAT_POSITIONS} from '../src/world/flat-layout.js';
import {WORLD_ISLANDS,neighboursOf} from '../src/world/world-map.js';
import {mapOf} from '../src/world/island-maps.js';
import {flatRigid,placeRigid} from '../src/world/rigid.js';
import {mapPoint,copyTransform} from '../src/world/sphere-coordinates.js';
import {ISLETS} from '../src/world/islets.js';
import {placeIslet,isletPlacement} from '../src/world/islet-placement.js';
import {isletHull,flatRingGap} from '../src/world/islet-shores.js';
import {coastPolygons} from '../src/world/island-coasts.js';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('flat ring preserves measured mean distance, clockwise bearings and exact routes',()=>{
 close(FLAT_RADIUS,19475.34714565078);
 for(const [k,id]of FLAT_RING.entries()){
  const p=FLAT_POSITIONS[id];close(Math.hypot(p.x,p.y),FLAT_RADIUS);
  close(p.x,FLAT_RADIUS*Math.sin(k*Math.PI/3));close(p.y,-FLAT_RADIUS*Math.cos(k*Math.PI/3));
  assert.deepEqual(new Set(neighboursOf(id).map(n=>n.island.id)),new Set(['home',FLAT_RING[(k+5)%6],FLAT_RING[(k+1)%6]]));
 }
 assert.deepEqual(new Set(neighboursOf('home').map(n=>n.island.id)),new Set(FLAT_RING));
});
test('all gameplay frame mappings compose as pure translation, independent of map centres',()=>{
 for(const a of WORLD_ISLANDS)for(const b of WORLD_ISLANDS){
  const r=flatRigid(a.id,b.id),t=copyTransform(a.id,b.id),m=mapOf(b.id),p={x:m.cx+123,y:m.cy-456};
  assert.deepEqual([r.a,r.b,r.c,r.d],[1,0,0,1]);assert.deepEqual(t,{a:1,b:0,c:0,d:1,x:r.x,y:r.y});
  const q=mapPoint(b.id,a.id,p),drawn=placeRigid(a.id,b.id,p);close(q.x,drawn.x);close(q.y,drawn.y);
  const viaHome=mapPoint('home',a.id,mapPoint(b.id,'home',p));close(q.x,viaHome.x);close(q.y,viaHome.y);
 }
});
test('all seven upright islets clear every coast, each other and all straight sailing lanes',()=>{
 const hull=i=>isletHull(i).map(p=>{const q=placeIslet('home',i,p);return [q.x,q.y];});
 const origin=mapOf('home'),lanes=[];
 for(const a of WORLD_ISLANDS)for(const n of neighboursOf(a.id)){
  const p=FLAT_POSITIONS[a.id],q=FLAT_POSITIONS[n.island.id],dx=q.x-p.x,dy=q.y-p.y,l=Math.hypot(dx,dy),nx=-dy/l*300,ny=dx/l*300;
  lanes.push([[p.x+nx,p.y+ny],[q.x+nx,q.y+ny],[q.x-nx,q.y-ny],[p.x-nx,p.y-ny]].map(([x,y])=>[x+origin.cx,y+origin.cy]));
 }
 for(const [k,i]of ISLETS.entries()){
  const h=hull(i),r=isletPlacement('home',i);assert.equal(r.cos,1);assert.equal(r.sin,0);
  const home=FLAT_POSITIONS[i.home],delta={x:r.x-origin.cx-home.x,y:r.y-origin.cy-home.y};
  if(i.home!=='home')assert.ok(home.x*delta.x+home.y*delta.y>0,`${i.id} outward from Home`);
  for(const island of WORLD_ISLANDS){
   const m=mapOf(island.id);
   for(const coast of coastPolygons(m.world,m.walk)){
    const ring=coast.map(([x,y])=>{const q=placeRigid('home',island.id,{x,y});return [q.x,q.y];});
    assert.ok(flatRingGap(h,ring,600)>=600,`${i.id}/${island.id} shore margin`);
   }
  }
  for(const lane of lanes)assert.ok(flatRingGap(h,lane,600)>=600,`${i.id} lane margin`);
  for(const other of ISLETS.slice(0,k))assert.ok(flatRingGap(h,hull(other),600)>=600,`${i.id}/${other.id} separation`);
 }
});
