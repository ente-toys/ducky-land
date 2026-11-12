import {mapPoint} from '../src/world/sphere-coordinates.js';
import {WORLD_ISLANDS,offsetOf} from '../src/world/world-map.js';
import {mapOf} from '../src/world/island-maps.js';
import {originOffset,canSail,landingSpot,destinationsFor} from '../src/gameplay/islands.js';
export function nonNeighbourLanding(preferred) {
 const targets=preferred ? [preferred,...WORLD_ISLANDS.map(i=>i.id).filter(id=>id!==preferred)] : WORLD_ISLANDS.map(i=>i.id);
 for(const target of targets) {
  const map=mapOf(target);
  const starts=WORLD_ISLANDS.filter(i=>i.id!==target).sort((a,b)=>Math.hypot(...Object.values(offsetOf(target,a.id)))-Math.hypot(...Object.values(offsetOf(target,b.id))));
  for(const start of starts) {
   if(destinationsFor(start.id).some(d=>d.destination===target))continue;
   const o=originOffset(start.id,target);
   const shore=map.world.coast.filter((_,i)=>i%4===0).flatMap(([x,y])=>Array.from({length:8},(_,i)=>({x:x+Math.cos(i*Math.PI/4)*120,y:y+Math.sin(i*Math.PI/4)*120})));
   for(const p of [map.HARBOR.water,...map.boatSpots(),...shore]) {
    const boat={islandId:start.id,...mapPoint(target,start.id,p)};
    if(canSail(boat.x,boat.y,boat.islandId)&&landingSpot(boat)?.islandId===target) return {target,...boat};
   }
  }
 }
 throw Error('No real non-neighbour shore in the current layout');
}
