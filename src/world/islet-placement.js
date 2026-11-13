import {flatOffset,FLAT_ISLETS} from './flat-layout.js';
import {mapOf,mapsVersion} from './island-maps.js';
let seen=-1,cache=new WeakMap();
export function isletPlacement(id,islet){
 if(seen!==mapsVersion()){seen=mapsVersion();cache=new WeakMap();}
 let byId=cache.get(islet);if(!byId)cache.set(islet,byId=new Map());
 if(byId.has(id))return byId.get(id);
 const m=mapOf(id),d=flatOffset(id,islet.home),p=FLAT_ISLETS[islet.id];
 const r={x:m.cx+d.x+p.x,y:m.cy+d.y+p.y,cos:1,sin:0};byId.set(id,r);return r;
}
export function placeIslet(id,islet,[x,y]){const r=isletPlacement(id,islet);return {x:r.x+r.cos*x-r.sin*y,y:r.y+r.sin*x+r.cos*y};}
export function unplaceIslet(id,islet,p){const r=isletPlacement(id,islet),x=p.x-r.x,y=p.y-r.y;return {x:r.cos*x+r.sin*y,y:-r.sin*x+r.cos*y};}
export function reframeIslet(from,to,islet,p){const q=unplaceIslet(from,islet,p);return placeIslet(to,islet,[q.x,q.y]);}

export function isletLandingFrame(from,to,islet){
 return {a:1,b:0,c:0,d:1};
}
