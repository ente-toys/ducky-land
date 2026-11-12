import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ids,changedIds,contour,rim,measure,benchGeometry} from '../scripts/pagepond-benches/geometry.mjs';
import {dist} from '../scripts/pagepond/geometry.mjs';
import {inPoly,inShape} from '../assets/world/island-geometry.mjs';
const read=p=>JSON.parse(fs.readFileSync(p)),A='public/pixi-art/themes/library/',D='assets/world/themes/library/';
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),records=read('scripts/pagepond-benches/placement.json');
const oldArt=read('scripts/bigger-library/original/art.json'),old=read('scripts/bigger-library/original/world.json');
const source=fs.readFileSync('scripts/pagepond-ground/data/centre-ground.svg','utf8');

test('Pagepond plaza benches follow the painted rim at equal arc-length intervals, face inward and stay on the paving',()=>{
 assert.equal(records.length,9);
 for(const [court,list]of Object.entries(ids)){
  const group=list.map(id=>records.find(b=>b.id===id)),border=contour(court,world,source),points=rim(border,group[0].inset),m=measure(points);
  const gaps=group.slice(1).map((b,i)=>b.distance-group[i].distance);
  if(court!=='bookstore')gaps.push(group[0].distance+m.total-group.at(-1).distance);
  assert(Math.max(...gaps)-Math.min(...gaps)<.003,court+' evenly spaced along the rim');
  for(const b of group){
   const p=art.props.find(p=>p.id===b.id),g=benchGeometry(points,b.distance),[x,y]=g.centre;
   assert(Math.hypot(p.x-x,p.y-y)<.003,b.id+' exact rim station');
   const outer=g.ground(90,24),inner=g.ground(90,-20),back=[outer[0]-x,outer[1]-y];
   assert(Math.abs(back[0]*g.tangent[0]+back[1]*g.tangent[1])<.01,b.id+' tangent seat, perpendicular back');
   const z=world.zones[court==='court'?'activity-3':'bookstore'];
   assert(Math.hypot(outer[0]-z.x,outer[1]-z.y)>Math.hypot(inner[0]-z.x,inner[1]-z.y),b.id+' faces inward with its back toward the outer rim');
   for(const point of b.footprint)assert(inPoly(...point,border),b.id+' full contact on paving');
   assert.deepEqual(p.footprint,{poly:b.footprint});
   assert.deepEqual(world.obstacles[b.obstacleIndex],{poly:b.footprint,name:b.id});
   assert.deepEqual(walk.obstacles[b.obstacleIndex],world.obstacles[b.obstacleIndex]);
   const svg=fs.readFileSync(A+p.src,'utf8');assert(svg.includes('stroke="#39472d"'),b.id+' house ink');
   assert(!/<image\b|data:|foreignObject|(?:linear|radial)Gradient/i.test(svg),b.id+' flat SVG only');
   assert(p.anchor.x>=0&&p.anchor.x<=1&&p.anchor.y>=0&&p.anchor.y<=1,b.id+' valid SVG anchor');
  }
 }
});

test('Pagepond bench correction preserves every other prop, original obstacle and source drawing',()=>{
 const keep=read('scripts/pagepond-ground/data/keep.json');
 const allowed=new Set(['src','x','y','width','height','scale','anchor','flip','shadow','wind','footprint','shadowSize','shadowOffset']);
 for(const id of changedIds){const p=art.props.find(p=>p.id===id),prior=keep.props.find(p=>p.id===id);assert(prior,id+' existing seat retained');for(const key of Object.keys(prior))if(!allowed.has(key))assert.deepEqual(p[key],prior[key],id+' preserves '+key);}
 const indices=new Set(records.map(b=>b.originalObstacleIndex??b.obstacleIndex));assert.equal(indices.size,9);
 const bridgeFix=read('scripts/pagepond-bridges/report.json'),cleared=new Set([...bridgeFix.clearedLandscape,...bridgeFix.retiredBridgeParts]);
 for(let i=0;i<old.obstacles.length;i++)if(!indices.has(i)){const o=old.obstacles[i];if(cleared.has(o.name)||!o.name&&bridgeFix.clearedProps.some(p=>Math.abs(o.x-p.x)<2&&Math.abs(o.y-p.y)<40))continue;assert(world.obstacles.some(q=>JSON.stringify(q)===JSON.stringify(o)),'unrelated original obstacle '+i);}
 for(const b of records){const p=oldArt.props.find(p=>p.id===b.id),o=old.obstacles[b.originalObstacleIndex??b.obstacleIndex];assert(o.name===b.id||o.x===p.x&&Math.abs(o.y-p.y)<40,b.id+' replaces its own original blocker');}
 const placements=read(D+'placements.json');assert.deepEqual(placements,art.props);
});

test('Pagepond tangent bench contacts stay clear of other fixed furniture',()=>{
 const indices=new Set(records.map(b=>b.obstacleIndex));
 for(const b of records)for(const [i,o]of world.obstacles.entries()){
  if(indices.has(i))continue;
  assert(!b.footprint.some(p=>inShape(...p,o,10)),b.id+' clears obstacle '+(o.name??i));
 }
});


test('Pagepond rim benches leave the full width of every existing approach lane clear',()=>{
 const routes=read('scripts/pagepond-ground/sampled-routes.json');
 for(const b of records)for(const route of routes)for(const p of route.samples){
  if(Math.abs(p[0]-b.centre[0])>240||Math.abs(p[1]-b.centre[1])>240)continue;
  assert(!inPoly(...p,b.footprint),b.id+' outside '+route.id);
  const gap=Math.min(...b.footprint.map((q,i)=>dist(p,q,b.footprint[(i+1)%b.footprint.length])));
  assert(gap>=route.width/2+8,b.id+' full lane clearance '+route.id);
 }
});
