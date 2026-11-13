import {mapPoint} from '../world/sphere-coordinates.js';
import {WORLD_ISLANDS} from '../world/world-map.js';
import {mapOf} from '../world/island-maps.js';
import {BOG_RADAR_ISLAND, placeBogRadar} from '../features/bog-combat/bog-radar.js';

export const NEARBY_MAP_WIDTH = 8000;
export const NEARBY_MAP_HEIGHT = NEARBY_MAP_WIDTH;

export function nearbyMapFrame(islandId, point, bogRadar, radarRadius = NEARBY_MAP_WIDTH / 2) {
  return WORLD_ISLANDS.map(island=>{const m=mapOf(island.id),c=mapPoint(island.id,islandId,{x:m.cx,y:m.cy}),q={x:c.x-point.x,y:c.y-point.y};
    if (bogRadar && island.id === BOG_RADAR_ISLAND) placeBogRadar(bogRadar,islandId,q.x,q.y,radarRadius);
    return {id:island.id,...q,bearing:0};})
    .sort((a,b)=>Math.hypot(a.x,a.y)-Math.hypot(b.x,b.y)).slice(0,3);
}

export function nearbyHeading(id,p,dx,dy){return Math.atan2(dx,-dy)*180/Math.PI;}
