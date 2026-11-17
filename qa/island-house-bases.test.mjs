import {furnitureDepth,usesFurnitureDepth} from '../src/rendering/pixi/furniture-depth.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mapOf,makeMap} from '../src/world/island-maps.js';
import READY from '../src/world/delivered-themes.js';
import {WORLD_ISLANDS} from '../src/world/world-map.js';
import {geometry} from '../assets/world/island-geometry.mjs';
import {createNavigation} from '../src/world/navigation.js';
import {navOf} from '../src/gameplay/islands.js';
import {IslandRoom} from '../worker/index.js';
import {blocks,blockerFilter} from '../src/world/walk-rule.js';
import {islandHouseCut} from './home-house-rule.mjs';

const gaps={sunset:[2304,1248],'isle-251':[-720,-320],'isle-250':[-112,-224],'isle-55':[2816,2704]};
const counts={sunset:26,'isle-251':20,'isle-250':21,'isle-55':9};
for(const {id,theme,name} of WORLD_ISLANDS){
 test(`${name}: client and authority agree over the complete 16-unit island and islet lattice`,t=>{
  const map=mapOf(id);
  // A fresh navigation instance exercises the browser's navHere path. Home's
  // separately generated placement world is also covered in home-house-bases.
  const local=theme?makeMap(theme,READY[theme]):map;
  const client=navOf(id,createNavigation(local.walk)),worker=IslandRoom.prototype.navFor.call({},id);
  assert.deepEqual(local.walk.obstacles,map.walk.obstacles);
  let samples=0;
  const boxes=[{x0:map.origin.x,y0:map.origin.y,x1:map.origin.x+map.width,y1:map.origin.y+map.height},...(client.islets??[]).map(w=>w.box)];
  for(const {x0,y0,x1,y1} of boxes)for(let y=y0+8;y<y1;y+=16)for(let x=x0+8;x<x1;x+=16){
   assert.equal(client.walkable(x,y),worker.walkable(x,y),`${id} ${x},${y}`);samples++;
  }
  t.diagnostic(`${id}: ${samples} samples, zero disagreements`);
 });
 if(!theme||theme==='bog')continue;
 test(`${name}: house gaps are reachable and every non-house blocker is retained`,()=>{
  const map=mapOf(id),changed=map.walk.obstacles.filter(o=>o.homeHouseBase);
  if(theme==='sunflower'){
   assert.equal(changed.length,0,'Sunbob already uses ellipse bases');
   const point=[1939.5,-180];
   assert.ok(map.nav().walkable(...point),'behind the north cottage');
   assert.deepEqual(map.nav().route(map.spawn.x,map.spawn.y,...point).at(-1),point);
   // No polygon house transform applies to this island at all.
   assert.deepEqual(map.walk.obstacles,READY.sunflower.walk.obstacles.filter(blockerFilter(map.world.props)));
   return;
  }
  assert.equal(changed.length,counts[id],'reviewed building count excludes furniture');
  const houseIds=new Set(changed.map(o=>o.prop));
  let nonHouses=0;
  for(const p of map.world.props)for(const o of [p.footprint,p.bodyFootprint].filter(Boolean)){
   if(!blocks(o,p)||houseIds.has(p.id))continue;
   assert.ok(map.walk.obstacles.includes(o),`${p.id} retains its original ${o.bodyBlock?'body':'foot'} blocker`);nonHouses++;
  }
  assert.ok(nonHouses>20);
  for(const o of changed){
   const original=map.world.props.find(p=>p.id===o.prop).footprint;
   const cut=islandHouseCut(original);
   assert.notEqual(cut,null);
   const ys=[o.poly,...(o.parts??[])].flat().map(p=>p[1]);
   assert.ok(Math.abs(Math.min(...ys)-cut)<1e-8);
   assert.equal(Math.max(...ys),Math.max(...[original.poly,...(original.parts??[])].flat().map(p=>p[1])));
   assert.equal(o.clearance,original.clearance);
   assert.ok(!map.walk.obstacles.some(b=>b.prop===o.prop&&b.bodyBlock));
  }
  const baseline=geometry({...map.walk,obstacles:[...map.walk.obstacles.filter(o=>!houseIds.has(o.prop)),...map.world.props.filter(p=>houseIds.has(p.id)).flatMap(p=>[p.footprint,p.bodyFootprint].filter(Boolean))]});
  const point=gaps[id];
  // Narrower furniture padding means the old gap may already clear a full roof.
  // Find an actual roof-only sample instead, while keeping the authored gap checks.
  let roofOnly=false;
  for(const h of changed){const f=map.world.props.find(p=>p.id===h.prop).footprint;
   const ps=[f.poly,...(f.parts??[])].flat(),xs=ps.map(p=>p[0]),ys=ps.map(p=>p[1]);
   for(let y=Math.min(...ys);y<islandHouseCut(f);y+=24)for(let x=Math.min(...xs);x<Math.max(...xs);x+=24)
    if(map.nav().walkable(x,y)&&!baseline.walkable(x,y))roofOnly=true;
  }
  assert.ok(roofOnly,'full roofs still obstruct ground opened by the house-base rule');
  assert.equal(map.nav().walkable(...point),true,'house gap is open');
  assert.deepEqual(map.nav().route(map.spawn.x,map.spawn.y,...point).at(-1),point,'exact gap is connected');
 });
}

test('Bog keeps every prop foot and body blocker, including its cottage cover',()=>{
 const map=mapOf('isle-249');
 assert.ok(!map.walk.obstacles.some(o=>o.homeHouseBase));
 for(const p of map.world.props)for(const o of [p.footprint,p.bodyFootprint].filter(Boolean))if(blocks(o,p))assert.ok(map.walk.obstacles.includes(o),p.id);
});

for(const id of ['sunset','isle-251','isle-250'])test(`${id}: every house keeps rear and front depth in the furniture layer`,()=>{
  assert.ok(usesFurnitureDepth(id));
  const props=mapOf(id).world.props.filter(p=>islandHouseCut(p)!==null);
  assert.ok(props.length>=20);
  for(const p of props){
    const points=[p.footprint.poly,...(p.footprint.parts??[])].flat(),top=Math.min(...points.map(q=>q[1])),z=p.sortY??p.z??p.y,y=top+(z-top)*.2;
    assert.ok(furnitureDepth([p],p.x,y)<z,`${p.id}: behind the roof`);
    assert.equal(furnitureDepth([p],p.x,z+100),z+100,`${p.id}: in front of the house`);
  }
});
