import {KarmaPool} from '../../src/pixi/karma-pool.js';
import {mapOf} from '../../src/pixi/island-maps.js';
import {WORLD_ISLANDS} from '../../src/pixi/world-map.js';
import {WALK_SPEED,RUN_SPEED} from '../../src/pixi/player-motion.js';
const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const length=(start,path)=>{let p=start,total=0;for(const q of path){total+=Math.hypot(q[0]-p[0],q[1]-p[1]);p=q;}return total;};
const rows=[];
for(const island of WORLD_ISLANDS.filter(i=>i.theme!=='bog')){
 const map=mapOf(island.id),nav=map.nav(),times=[];
 for(let seed=1;seed<=20;seed++){
  const pool=new KarmaPool(null,random(seed)),targets=pool.visible(island.id).filter(s=>s.region===island.id);
  let p=[map.spawn.x,map.spawn.y],distance=0,found=0;
  const goal=Math.min(3,targets.length);
  while(targets.length&&found<goal){
   const routes=targets.map(site=>({site,path:nav.route(...p,site.x,site.y)})).filter(r=>r.path?.length).map(r=>({...r,distance:length(p,r.path)})).sort((a,b)=>a.distance-b.distance);
   const best=routes[0];if(!best)break;
   distance+=best.distance;p=[best.site.x,best.site.y];targets.splice(targets.indexOf(best.site),1);found++;
  }
  if(found!==goal)throw Error('Unreachable pickup on '+island.id);
  times.push(distance/WALK_SPEED);
 }
 times.sort((a,b)=>a-b);
 rows.push({island:island.name??island.id,localThreePickupWalkSeconds:{min:Math.round(times[0]),median:Math.round(times[10]),max:Math.round(times.at(-1))},runMedianSeconds:Math.round(times[10]*WALK_SPEED/RUN_SPEED)});
}
console.log(JSON.stringify({model:'Known locations, nearest reachable route, up to three initial feathers on one main island, no search time or respawns. An informed-route baseline, not a playtest.',speed:WALK_SPEED,minimumLandmassesForFive:2,samplesPerIsland:20,rows},null,2));
