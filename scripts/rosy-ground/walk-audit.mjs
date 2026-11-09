// Audit the current drawn routes. No nearest-target fallback or protected-lamp
// exclusions: an exact authored target must be walkable and actually reached.
import {readFileSync,writeFileSync} from 'node:fs';
import {mapOf} from '../../src/pixi/island-maps.js';
import {inShape} from '../../rive/web/island-geometry.mjs';
const read=p=>JSON.parse(readFileSync(p));
export function auditRosy(){
 const map=mapOf('sunset'),nav=map.nav(),routes=read('scripts/rosy-ground/sampled-routes.json'),art=read('public/pixi-art/themes/pink/art.json'),remaining=[],pathEnds=[];
 let samples=0;
 for(const r of routes){
  for(const p of r.samples){samples++;if(!nav.walkable(...p))remaining.push({type:'route-clearance',id:r.id,point:p,hits:map.walk.obstacles.filter(o=>inShape(...p,o,16))});}
  for(const [end,p]of[['start',r.samples[0]],['end',r.samples.at(-1)]]){
   const reached=nav.walkable(...p)&&((Math.hypot(p[0]-map.spawn.x,p[1]-map.spawn.y)<1)||JSON.stringify(nav.route(map.spawn.x,map.spawn.y,...p).at(-1))===JSON.stringify(p));
   pathEnds.push({id:r.id,end,point:p,reached});if(!reached)remaining.push({type:'exact-path-end',id:r.id,end,point:p});
  }
 }
 const destinations=Object.entries(map.world.zones).filter(([id])=>id.startsWith('bigger-')).map(([id,z])=>{
  const p=z.spawn,reached=nav.walkable(...p)&&JSON.stringify(nav.route(map.spawn.x,map.spawn.y,...p).at(-1))===JSON.stringify(p);
  if(!reached)remaining.push({type:'destination',id,point:p});return {id,point:p,reached};
 });
 const bridges=map.world.arches.map(b=>{
  for(const p of [b.a,b.b,b.a.map((v,k)=>(v+b.b[k])/2)])if(!nav.walkable(...p))remaining.push({type:'bridge',id:b.id,point:p});
  return {id:b.id,a:b.a,b:b.b,boatPassUnder:map.world.walkways.find(w=>w.id===b.id)?.boatPassUnder};
 });
 const throats=read('scripts/rosy-ground/throat-report.json');remaining.push(...throats.unserved,...throats.crossings);
 const forbidden=art.props.filter(p=>/^hamlets\/.*\/(?:[^/]*(?:tree|oak|cherry|blossom|shrub|bush)[^/]*)\.svg$/i.test(p.src));
 const report={remainingOverlapCount:remaining.length,remainingWalkIssues:remaining.length,forbiddenHamletPlantProps:forbidden.length,checked:{props:art.props.length,routeSamples:samples,bridges:bridges.length,pathEnds:pathEnds.length,destinations:destinations.length,sleepers:map.sleepers.length},remaining,pathEnds,bridges,destinations,throats,lockedBaselineContacts:[]};
 return report;
}
if(process.argv[1]?.endsWith('walk-audit.mjs')){
 const report=auditRosy();
 writeFileSync('scripts/rosy-ground/walk-audit.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({checked:report.checked,issues:report.remaining},null,2));
 if(report.remaining.length)process.exitCode=1;
}
