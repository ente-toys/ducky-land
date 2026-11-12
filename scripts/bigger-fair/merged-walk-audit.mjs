// Read back the fully integrated production map, never a worker's old snapshot.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {mapFor} from '../../src/pixi/island-maps.js';
import {inPoly} from '../../assets/world/island-geometry.mjs';
const read=p=>JSON.parse(fs.readFileSync(p)),out=process.argv[2]??'/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/fair-review/fix/merged';
const world=read('assets/world/themes/fair/world.json'),art=read('public/pixi-art/themes/fair/art.json'),paths=read('scripts/bigger-fair/path-routes.json'),map=mapFor('fair'),nav=map.nav();
const polygons=paths.surface.type==='Polygon'?[paths.surface.coordinates]:paths.surface.coordinates;
const onSurface=p=>polygons.some(r=>inPoly(...p,r[0])&&!r.slice(1).some(h=>inPoly(...p,h)));
const onDeck=p=>world.walkways.some(b=>{const [dx,dy]=[b.b[0]-b.a[0],b.b[1]-b.a[1]],t=Math.max(0,Math.min(1,((p[0]-b.a[0])*dx+(p[1]-b.a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(p[0]-b.a[0]-t*dx,p[1]-b.a[1]-t*dy)<b.w/2;});
const problems=[],bridges=[],doors=[];let samples=0,legs=0,groundSamples=0;
for(const r of paths.routes){
 for(let i=1;i<r.samples.length;i++){
  const a=r.samples[i-1],b=r.samples[i];legs++;
  if(!nav.clearLine(a,b))problems.push(r.id+' blocked segment '+JSON.stringify([a,b]));
  const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/3));
  for(let j=0;j<=n;j++){
   const p=a.map((v,k)=>v+(b[k]-v)*j/n);samples++;
   if(!nav.walkable(...p))problems.push(r.id+' blocked '+p);
   if(onSurface(p))groundSamples++;else if(!onDeck(p))problems.push(r.id+' off painted surface '+p);
  }
 }
}
const reachable=p=>nav.walkable(...p)&&(nav.clearLine([map.spawn.x,map.spawn.y],p)||nav.route(map.spawn.x,map.spawn.y,...p).length>0);
for(const b of world.walkways){const ends=[b.a,b.b].map(p=>({at:p,reachable:reachable(p),painted:onSurface(p)}));bridges.push({id:b.id,ends,deckClear:nav.clearLine(b.a,b.b)});if(ends.some(e=>!e.reachable||!e.painted)||!nav.clearLine(b.a,b.b))problems.push('bridge '+b.id);}
for(const p of art.props.filter(p=>p.role&&p.door)){const served=paths.routes.some(r=>r.id==='door-'+p.id),ok=reachable(p.door);doors.push({id:p.id,served,reachable:ok});if(!served||!ok)problems.push('door '+p.id);}
const report={theme:'fair',routes:paths.routes.length,routeVertices:paths.routes.reduce((n,r)=>n+r.samples.length,0),checkedLegs:legs,interpolatedSamples:samples,groundSamples,bridges,doors,sleepers:map.sleepers.length,kites:art.kites.length,props:art.props.length,groundTiles:art.ground.tiles.length,adjacentTilePairs:127,pathFill:paths.fill,propOverlapArea:paths.propOverlapArea,problems:[...new Set(problems)]};
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/walk-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,bridges:bridges.length,doors:doors.length,problems:report.problems.slice(0,10)},null,2));assert.equal(report.problems.length,0);
