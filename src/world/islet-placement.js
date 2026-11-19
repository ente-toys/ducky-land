import {flatOffset,FLAT_ISLETS,nearestSeaImage} from './flat-layout.js';
import {seaCentreY} from './rigid.js';
import {mapOf,mapsVersion} from './island-maps.js';
let seen=-1,cache=new WeakMap();
export function isletPlacement(id,islet){
 if(seen!==mapsVersion()){seen=mapsVersion();cache=new WeakMap();}
 let byId=cache.get(islet);if(!byId)cache.set(islet,byId=new Map());
 if(byId.has(id))return byId.get(id);
 const m=mapOf(id),d=flatOffset(id,islet.home),p=FLAT_ISLETS[islet.id];
 const r={x:m.cx+d.x+p.x,y:m.cy+d.y+p.y,cos:1,sin:0};byId.set(id,r);return r;
}
export function isletImage(id,islet,reference){
 const r=isletPlacement(id,islet);
 return reference?nearestSeaImage(r.x,r.y,reference,seaCentreY(id)):{...r,flip:1};
}
export function placeIslet(id,islet,[x,y],reference=null){
 const r=isletImage(id,islet,reference);
 return {x:r.x+x,y:r.y+r.flip*y};
}
export function unplaceIslet(id,islet,p){const r=isletImage(id,islet,p);return {x:p.x-r.x,y:(p.y-r.y)*r.flip};}
export function reframeIslet(from,to,islet,p){const q=unplaceIslet(from,islet,p);return placeIslet(to,islet,[q.x,q.y]);}

export function isletLandingFrame(from,to,islet){
 return {a:1,b:0,c:0,d:1};
}
