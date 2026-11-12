import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import READY from '../assets/world/themes/index.js';
import {checkTheme} from '../scripts/theme-index.mjs';
import {makeMap,mapOf} from '../src/pixi/island-maps.js';
import {geometry,inPoly,inShape} from '../assets/world/island-geometry.mjs';
const read=p=>JSON.parse(readFileSync(p)),A='public/pixi-art/themes/community/',D='assets/world/themes/community/';
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),plants=art.props.filter(p=>p.lifeGrove);
const hash=o=>createHash('sha256').update(typeof o==='string'?o:JSON.stringify(o)).digest('hex');
const segmentDistance=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);};
const pathEdge=(x,y)=>Math.min(...world.paths.map((line,i)=>Math.min(...line.slice(1).map((b,j)=>segmentDistance(x,y,line[j],b)))-(world.pathWidths[i]??128)/2));
const checked=checkTheme('community');

test('Campfire has exactly 100 resolved residents in the source, registry and isle-250 runtime',()=>{
 assert.equal(world.sleepTotal,100);
 assert.equal(Object.values(world.sleepSpots).reduce((n,v)=>n+v.length,0),100);
 assert.deepEqual(checked.problems,[]);
 assert.equal(checked.sleepers.length,100);
 assert.deepEqual(READY.community.sleepers,checked.sleepers);
 assert.deepEqual(JSON.parse(JSON.stringify(mapOf('isle-250').sleepers)),checked.sleepers);
 assert.equal(new Set(checked.sleepers.map(b=>`${b.x},${b.y}`)).size,100);
 assert.equal(new Set(checked.sleepers.map(b=>b.pose)).size,8);
});

test('Every Campfire sleeper fits on dry lawn outside full path widths, water, buildings and door approaches',()=>{
 const m=makeMap('community',{world,walk,harbor:read(D+'harbor.json'),sleepers:[]}),g=geometry(m.baseWalk);
 for(const b of checked.sleepers){
  assert(pathEdge(b.x,b.y)>=b.r,`${b.pose} ${b.x},${b.y} clears path by its full half width`);
  for(const dx of [-b.r*.8,0,b.r*.8]){
   assert(inPoly(b.x+dx,b.y,world.coast),'sleeper inside shore');
   assert(!world.water.some(o=>inShape(b.x+dx,b.y,o,0)),'sleeper outside water');
   if(!b.tree)assert(g.walkable(b.x+dx,b.y),'sleeper on open ground');
  }
  for(const p of art.props.filter(p=>p.kind==='building'))assert(!inShape(b.x,b.y,p.footprint,12),'sleeper outside building '+p.id);
  for(const h of world.residentialPlots)assert(Math.hypot(b.x-h.door[0],b.y-h.door[1])>b.r+65,'open door '+h.id);
 }
});

test('Eight Campfire groves use the unmodified Home SVG family, with overlapping crowns and open lawn between',()=>{
 assert.equal(plants.length,42);
 assert.equal(plants.filter(p=>p.kind==='tree').length,26);
 assert.equal(plants.filter(p=>p.kind==='bush').length,16);
 const groups=Object.groupBy(plants,p=>p.lifeGrove);assert.equal(Object.keys(groups).length,8);
 for(const [id,group]of Object.entries(groups)){
  const trees=group.filter(p=>p.kind==='tree');assert(trees.length>=3&&trees.length<=4,id);
  assert.equal(group.filter(p=>p.kind==='bush').length,2);
  assert(trees.every(a=>trees.some(b=>a!==b&&Math.abs(a.x-b.x)<(a.width+b.width)/2&&Math.abs(a.y-b.y)<Math.max(a.height,b.height))),id+' connected crowns');
  for(const p of group){
   assert.match(p.src,/^\/pixi-art\/plants\/(tree-[1-5]|bush-[1-4])\.svg$/);
   assert.equal(p.contact,false);assert.equal(p.wind,false);assert.equal(p.scale,1);
   for(const key of ['rotation','rotate','angle','skew','tint'])assert.equal(p[key],undefined);
   const svg=readFileSync('public'+p.src,'utf8');assert.match(svg,/#39472d/i);
   assert.doesNotMatch(svg,/<(?:image|linearGradient|radialGradient|filter)\b|data:|rotate\(|skew\(/i);
  }
 }
 for(const [x,y]of [[2950,-140],[4030,-80],[5260,-120],[3220,5520],[4720,5500]])assert(plants.every(p=>!(x>p.x-p.width/2&&x<p.x+p.width/2&&y>p.y-p.height&&y<p.y)),'open lawn '+x+','+y);
});

test('New Campfire planting keeps its whole crown off paths, water, doors and sleeping residents',()=>{
 for(const p of plants){
  for(const fx of [-.5,0,.5])for(const fy of [-1,-.5,0]){
   const x=p.x+p.width*fx,y=p.y+p.height*fy;
   assert(inPoly(x,y,world.coast),p.id+' within shore');
   assert(!world.water.some(o=>inShape(x,y,o,8)),p.id+' dry crown');
   assert(pathEdge(x,y)>5,p.id+' clear path');
  }
  for(const b of checked.sleepers)assert(!(p.x-p.width/2<b.x+b.r&&p.x+p.width/2>b.x-b.r&&p.y-p.height<b.y&&p.y>b.y-100),p.id+' leaves resident visible');
  for(const h of world.residentialPlots)assert(Math.hypot(p.x-h.door[0],p.y-h.door[1])>p.width/2+90,p.id+' clear door');
 }
});

test('Campfire life additions preserve existing solid props, the redrawn stage and raster off',()=>{
 assert.equal(art.raster.enabled,false);
 assert.deepEqual(art.props.filter(p=>!p.lifeGrove),walk.props);
 assert.deepEqual(world.props,walk.props);
 assert.equal(hash(readFileSync(A+'detail/stage.svg','utf8')),'3435cf2f99ec06cfd5754b494181168429e1a2dd6e7d5e700fe5c93322f9f036');
});
