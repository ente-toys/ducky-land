import {worldIsland,WORLD_GEO} from './world-map.js';
import {flatOffset} from './flat-layout.js';
import {mapOf} from './island-maps.js';
import {expMap,logMap,transport} from './sphere.js';
export function spherePoint(id,p){const m=mapOf(id);return expMap(worldIsland(id),p.x-m.cx,p.y-m.cy,WORLD_GEO.Rw);}
export function localPoint(id,p){const m=mapOf(id),q=logMap(worldIsland(id),p,WORLD_GEO.Rw);return {x:m.cx+q.x,y:m.cy+q.y};}
// Gameplay frames share flat north-up axes; the functions above are globe-only.
export function mapPoint(from,to,p){
 if(from===to)return {x:p.x,y:p.y};
 const a=mapOf(from),b=mapOf(to),d=flatOffset(to,from);
 return {x:b.cx+d.x+p.x-a.cx,y:b.cy+d.y+p.y-a.cy};
}
export const viewFrame=(id,p)=>transport(worldIsland(id),spherePoint(id,p));
export function copyTransform(from,to){
 const m=mapOf(to),p=mapPoint(to,from,{x:m.cx,y:m.cy});
 return {a:1,b:0,c:0,d:1,x:p.x,y:p.y};
}
