import {worldIsland,WORLD_GEO} from './world-map.js';
import {mapOf} from './island-maps.js';
import {expMap,logMap,transport} from './sphere.js';
export function spherePoint(id,p){const m=mapOf(id);return expMap(worldIsland(id),p.x-m.cx,p.y-m.cy,WORLD_GEO.Rw);}
export function localPoint(id,p){const m=mapOf(id),q=logMap(worldIsland(id),p,WORLD_GEO.Rw);return {x:m.cx+q.x,y:m.cy+q.y};}
export function mapPoint(from,to,p){if(from===to)return {x:p.x,y:p.y};return localPoint(to,spherePoint(from,p));}
export const viewFrame=(id,p)=>transport(worldIsland(id),spherePoint(id,p));
export function copyTransform(from,to){
 const m=mapOf(to),p=mapPoint(to,from,{x:m.cx,y:m.cy}),x=mapPoint(to,from,{x:m.cx+1,y:m.cy}),y=mapPoint(to,from,{x:m.cx,y:m.cy+1});
 return {a:x.x-p.x,b:x.y-p.y,c:y.x-p.x,d:y.y-p.y,x:p.x,y:p.y};
}
