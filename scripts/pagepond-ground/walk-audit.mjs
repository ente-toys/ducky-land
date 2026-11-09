import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {mapFor} from '../../src/pixi/island-maps.js';
import {checkTheme} from '../theme-index.mjs';
import {canSail} from '../../src/pixi/islands.js';
import {paperboatMoorings} from '../pagepond-boats/config.mjs';
const read=p=>JSON.parse(fs.readFileSync(p));
export function auditPagepond(){
 const map=mapFor('library'),nav=map.nav(),routes=read('scripts/pagepond-ground/sampled-routes.json'),art=read('public/pixi-art/themes/library/art.json'),issues=[],pathEnds=[];
 let count=0;
 for(const r of routes){
  for(let i=1;i<r.samples.length;i++){
   const a=r.samples[i-1],b=r.samples[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/8));
   for(let j=0;j<n;j++){const p=a.map((v,k)=>v+(b[k]-v)*j/n);count++;if(!nav.walkable(...p))issues.push({type:'path-clearance',id:r.id,point:p});}
  }
  for(const [end,p]of [['start',r.samples[0]],['end',r.samples.at(-1)]]){
   const result=nav.route(map.spawn.x,map.spawn.y,...p),q=result.at(-1),reached=nav.walkable(...p)&&q&&Math.hypot(q[0]-p[0],q[1]-p[1])<.01;
   pathEnds.push({path:r.id,end,point:p,reached});if(!reached)issues.push({type:'path-end-access',id:r.id,end,point:p});
  }
 }
 const bridges=map.world.walkways.map((w,i)=>{
  let bad=0;for(let t=0;t<=1;t+=.025)if(!nav.walkable(w.a[0]+(w.b[0]-w.a[0])*t,w.a[1]+(w.b[1]-w.a[1])*t))bad++;
  if(bad)issues.push({type:'bridge-access',id:w.id??i,bad});return {id:w.id??i,bad};
 });
 const theme=checkTheme('library');if(!theme.ready)issues.push(...theme.problems.map(problem=>({type:'theme-contract',problem})));
 const exact=read('scripts/pagepond-ground/geometry-audit.json');issues.push(...exact.issues);
 const boats=paperboatMoorings.map(p=>({id:p.id,water:map.boatSpots().some(b=>b.x===p.x&&b.y===p.y)&&canSail(p.x,p.y,'isle-251')}));
 for(const b of boats)if(!b.water)issues.push({type:'paperboat-land',id:b.id});
 return {overlaps:exact.issues.length,walkIssues:issues.filter(i=>/access|clearance|contract/.test(i.type)).length,checked:{props:art.props.length,routeSamples:count,bridges:bridges.length,pathEnds:pathEnds.length,sleepers:theme.sleepers.length,boats:boats.length},issues,pathEnds,bridges,boats};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const r=auditPagepond();fs.writeFileSync('scripts/pagepond-ground/walk-audit.json',JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({checked:r.checked,overlaps:r.overlaps,walkIssues:r.walkIssues,issues:r.issues.slice(0,30)},null,2));if(r.issues.length)process.exitCode=1;}
