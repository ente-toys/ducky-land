// Find real nearby water after world spacing, instead of freezing old Home-map coordinates.
import {WORLD_ISLANDS,offsetOf} from '../src/pixi/world-map.js';
import {mapOf} from '../src/pixi/island-maps.js';
import {originOffset,canSail,landingSpot,destinationsFor} from '../src/pixi/islands.js';
export function nonNeighbourLanding(target='isle-176') {
 const map=mapOf(target);
 const starts=WORLD_ISLANDS.filter(i=>i.id!==target).sort((a,b)=>Math.hypot(...Object.values(offsetOf(target,a.id)))-Math.hypot(...Object.values(offsetOf(target,b.id))));
 for(const start of starts) {
  if(destinationsFor(start.id).some(d=>d.destination===target))continue;
  const o=originOffset(start.id,target);
  for(const p of [map.HARBOR.water,...map.boatSpots()]) {
   const boat={islandId:start.id,x:o.x+p.x,y:o.y+p.y};
   if(canSail(boat.x,boat.y,boat.islandId)&&landingSpot(boat)?.islandId===target) return boat;
  }
 }
 throw Error(`No non-neighbour landing fixture for ${target}`);
}
