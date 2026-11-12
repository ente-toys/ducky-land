// Spatial capacity, not a multiplayer or rendering load test.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {checkTheme} from '../theme-index.mjs';
const root=new URL('../../',import.meta.url), read=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
const world=read('assets/world/themes/canal/world.json'),walk=read('assets/world/themes/canal/walk-world.json'),harbor=read('assets/world/themes/canal/harbor.json');
const art=read('public/pixi-art/themes/canal/art.json'), report=checkTheme('canal');assert.equal(report.ready,true,report.problems.join('\n'));assert.equal(report.sleepers.length,40);
const map=makeMap('canal',{world,walk,harbor,sleepers:report.sleepers}),nav=map.nav();
const reserved=Object.entries(world.zones).filter(([k])=>k.startsWith('activity-')||k.startsWith('stalls-'));
for(const [id,z] of reserved){
 const inside=(x,y)=>'x0'in z?x>=z.x0&&x<=z.x1&&y>=z.y0&&y<=z.y1:((x-z.x)/z.rx)**2+((y-z.y)/z.ry)**2<=1;
 for(const p of art.props)assert.ok(!inside(p.x,p.y),`${id}: prop ${p.id} inside reservation`);
 const bounds='x0'in z?[z.x0,z.y0,z.x1,z.y1]:[z.x-z.rx,z.y-z.ry,z.x+z.rx,z.y+z.ry];
 for(let y=bounds[1];y<=bounds[3];y+=20)for(let x=bounds[0];x<=bounds[2];x+=20)if(inside(x,y))assert.ok(nav.walkable(x,y),`${id}: blocked reservation ${x},${y}`);
}
// Check each resting sprite's footprint against full path widths, not centre lines.
const distance=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)};
for(const bed of report.sleepers)for(const [dx,dy] of [[0,0],[bed.r,0],[-bed.r,0],[0,30],[0,-30]]){
 assert.ok(world.paths.every((line,i)=>line.slice(1).every((b,j)=>distance(bed.x+dx,bed.y+dy,line[j],b)>=world.pathWidths[i]/2)),`sleeper ${bed.pose} at ${bed.x},${bed.y} touches a path`);
}
const crowd=[];
for(const [id,n] of [['activity-1',12],['activity-2',12],['activity-3',10],['centre',46],['stalls-1',8],['stalls-2',8],['stalls-3',4]]){
 const z=world.zones[id],candidates=[];
 const rect='x0'in z,b=rect?[z.x0,z.y0,z.x1,z.y1]:[z.x-z.rx,z.y-z.ry,z.x+z.rx,z.y+z.ry];
 const pad=rect?60:90;
 for(let y=b[1]+pad;y<b[3]-pad;y+=150)for(let x=b[0]+pad;x<b[2]-pad;x+=150){
  if(!rect&&((x-z.x)/(z.rx-60))**2+((y-z.y)/(z.ry-60))**2>1)continue;
  if(![[0,0],[50,0],[-50,0],[0,40],[0,-40]].every(([dx,dy])=>nav.walkable(x+dx,y+dy)))continue;
  if(art.props.some(p=>Math.hypot(p.x-x,(p.y-y)*1.3)<120))continue;
  candidates.push({x,y,zone:id});
 }
 assert.ok(candidates.length>=n,`${id}: only ${candidates.length} crowd spots`);
 for(let i=0;i<n;i++){const p=candidates[Math.floor(i*candidates.length/n)];const route=nav.route(map.spawn.x,map.spawn.y,p.x,p.y);assert.ok(route.length||nav.clearLine([map.spawn.x,map.spawn.y],[p.x,p.y]),`${id}: no route`);crowd.push(p);}
}
assert.equal(crowd.length,100);
for(let i=0;i<crowd.length;i++)for(let j=i+1;j<crowd.length;j++)assert.ok(Math.hypot(crowd[i].x-crowd[j].x,crowd[i].y-crowd[j].y)>=145);
const out={ready:true,sleepers:40,standingCapacity:100,minimumSpacing:145,reservedZones:reserved.map(([id])=>id),crowd,limitations:['Spatial and navigation checks only; no 100-client server load test.','Vite serves port 5292. Headless Chromium is blocked by macOS sandbox permissions; runtime visuals remain unverified.']};
writeFileSync(new URL('public/pixi-art/themes/canal/capacity-check.json',root),JSON.stringify(out,null,2));
console.log('READY canal; 40 valid sleepers; 100 reachable crowd positions; 3 open activity areas and 3 open stall rows');
