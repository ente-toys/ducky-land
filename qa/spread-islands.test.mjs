import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD_ISLANDS,FINISHED_THEMES,THEMED_ISLANDS,ISLAND_COUNT,layoutWorld,sizeOfTheme} from '../src/pixi/world-map.js';
import {mapOf,themeOfIsland} from '../src/pixi/island-maps.js';
import {destinationsFor,canSail,sailRoute,crossIsland,SAIL_SPEED,seaBoundsFor,originOffset,BOAT_RADIUS} from '../src/pixi/islands.js';
const RAD=Math.PI/180;
function checkLayout(m){
 assert.equal(m.islands.length,10);assert.equal(new Set(m.islands.map(i=>i.id)).size,10);
 const ice=m.islands.find(i=>i.theme==='snow');assert.deepEqual(ice.center,[0,1,0]);
 const longs=m.islands.filter(i=>i!==ice).map(i=>i.lon).sort((a,b)=>a-b);
 const gaps=longs.map((x,k)=>(longs[(k+1)%longs.length]-x+2*Math.PI)%(2*Math.PI));
 assert.ok(Math.max(...gaps)-Math.min(...gaps)>20*RAD,'unequal gaps');   // boss 8 Nov: islands cluster, open ocean between groups is fine
 assert.ok(new Set(m.islands.map(i=>i.lat)).size>=10,'varied heights, no rows');
 for(const i of m.islands){assert.ok(Math.abs(Math.hypot(...i.center)-1)<1e-12);}
 assert.deepEqual([m.islands[0].x,m.islands[0].y],[2900,2200]);
}
test('10 unique sphere patches, clustered unevenly, with Iceland exactly on the North Pole',()=>{
 assert.equal(ISLAND_COUNT,10);checkLayout(layoutWorld());
 assert.deepEqual(WORLD_ISLANDS.map(i=>i.theme).filter(Boolean),FINISHED_THEMES);
 for(const [id,theme] of THEMED_ISLANDS){assert.equal(themeOfIsland(id),theme);assert.equal(mapOf(id).id,theme);}
 for(const island of WORLD_ISLANDS){
  const map=mapOf(island.id);
  assert.deepEqual([island.width,island.height],[map.width,map.height],island.id+' uses its delivered map size');
 }
 assert.equal(SAIL_SPEED,380);
});
test('every real map fits inside each sailing envelope, including negative origins and non-neighbour shores',()=>{
 for(const from of WORLD_ISLANDS){
  const bounds=seaBoundsFor(from.id);
  for(const to of WORLD_ISLANDS){
   const map=mapOf(to.id),offset=originOffset(from.id,to.id),x=offset.x+map.origin.x,y=offset.y+map.origin.y;
   assert.ok(x-BOAT_RADIUS>=bounds.x0&&y-BOAT_RADIUS>=bounds.y0&&x+map.width+BOAT_RADIUS<=bounds.x1&&y+map.height+BOAT_RADIUS<=bounds.y1,`${from.id}/${to.id}: room outside the entire map`);
  }
 }
});
test('bounds scale deterministically for three-times-larger themes, growing Home, and uneven future maps',()=>{
 for(const sizeOf of [t=>{const s=sizeOfTheme(t);return {width:s.width*3,height:s.height*3};},t=>t==='home'?{width:42000,height:27000}:sizeOfTheme(t),t=>{const k=FINISHED_THEMES.indexOf(t)+2,s=sizeOfTheme(t);return {width:s.width*(1+k%4),height:s.height*(1+k%3)};}]){
  const a=layoutWorld(sizeOf),b=layoutWorld(sizeOf);assert.deepEqual(a.islands,b.islands);checkLayout(a);
  assert.deepEqual(a.islands.map(i=>[i.id,i.theme]),WORLD_ISLANDS.map(i=>[i.id,i.theme]));
 }
});
test('every island has real boat routes to its neighbours in one connected sea',()=>{
 const seen=new Set(['home']),todo=['home'];
 while(todo.length){const id=todo.shift();
  for(const d of destinationsFor(id)){
   const b=WORLD_ISLANDS.find(i=>i.id===d.destination);
   assert.ok(canSail(d.dock.x,d.dock.y,id),`${id}/${b.id} dock is water`);
   const route=sailRoute(id,mapOf(id).HARBOR.water,d.dock);assert.ok(route?.length,`${id}/${b.id} has an open sailing route`);
   const actor={islandId:id,mode:'sailing',...d.dock};assert.equal(crossIsland(actor),true);assert.equal(actor.islandId,b.id);
   assert.deepEqual([actor.x,actor.y],[mapOf(b.id).HARBOR.water.x,mapOf(b.id).HARBOR.water.y]);
   if(!seen.has(b.id)){seen.add(b.id);todo.push(b.id);}
  }
 }
 assert.equal(seen.size,10);
});
