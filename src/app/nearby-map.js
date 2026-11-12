import {spherePoint,viewFrame} from '../world/sphere-coordinates.js';
import {logMap} from '../world/sphere.js';
import {WORLD_ISLANDS, WORLD_GEO, worldIsland} from '../world/world-map.js';
import {mapOf} from '../world/island-maps.js';
import {BOG_RADAR_ISLAND, placeBogRadar} from '../features/bog-combat/bog-radar.js';

export const NEARBY_MAP_WIDTH = 8000;
export const NEARBY_MAP_HEIGHT = NEARBY_MAP_WIDTH;

export function nearbyMapFrame(islandId, point, bogRadar, radarRadius = NEARBY_MAP_WIDTH / 2) {
  const frame=viewFrame(islandId,point);
  return WORLD_ISLANDS.map(island=>{const q=logMap(frame,island.center,WORLD_GEO.Rw),m=mapOf(island.id),e=logMap(frame,spherePoint(island.id,{x:m.cx+10,y:m.cy}),WORLD_GEO.Rw);
    if (bogRadar && island.id === BOG_RADAR_ISLAND) placeBogRadar(bogRadar,islandId,q.x,q.y,radarRadius);
    return {id:island.id,...q,bearing:Math.atan2(e.y-q.y,e.x-q.x)*180/Math.PI};})
    .sort((a,b)=>Math.hypot(a.x,a.y)-Math.hypot(b.x,b.y)).slice(0,3);
}

export function nearbyHeading(id,p,dx,dy){const frame=viewFrame(id,p),q=logMap(frame,spherePoint(id,{x:p.x+dx,y:p.y+dy}),WORLD_GEO.Rw);return Math.atan2(q.x,-q.y)*180/Math.PI;}
