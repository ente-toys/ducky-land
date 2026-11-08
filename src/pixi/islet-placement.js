import {expMap} from './sphere.js';
import {localPoint} from './sphere-coordinates.js';
import {WORLD_GEO} from './world-map.js';
import {polar} from './rigid.js';
import {mapsVersion} from './island-maps.js';
let seen=-1,cache=new WeakMap();
// Shared by vector rendering, walking, collision and docking. The sphere places
// the centre; the nearest rotation preserves the art's true size and angles.
export function isletPlacement(id,islet){
 if(seen!==mapsVersion()){seen=mapsVersion();cache=new WeakMap();}
 let byId=cache.get(islet);if(!byId)cache.set(islet,byId=new Map());
 if(byId.has(id))return byId.get(id);
 const p=localPoint(id,islet.center),h=4,P=(x,y)=>localPoint(id,expMap(islet,x,y,WORLD_GEO.Rw));
 const xp=P(h,0),xm=P(-h,0),yp=P(0,h),ym=P(0,-h);
 const q=polar((xp.x-xm.x)/(2*h),(xp.y-xm.y)/(2*h),(yp.x-ym.x)/(2*h),(yp.y-ym.y)/(2*h));
 const r={x:p.x,y:p.y,cos:q.cos,sin:q.sin};byId.set(id,r);return r;
}
export function placeIslet(id,islet,[x,y]){const r=isletPlacement(id,islet);return {x:r.x+r.cos*x-r.sin*y,y:r.y+r.sin*x+r.cos*y};}
export function unplaceIslet(id,islet,p){const r=isletPlacement(id,islet),x=p.x-r.x,y=p.y-r.y;return {x:r.cos*x+r.sin*y,y:-r.sin*x+r.cos*y};}
export function reframeIslet(from,to,islet,p){const q=unplaceIslet(from,islet,p);return placeIslet(to,islet,[q.x,q.y]);}

// Target-chart vectors as drawn in the source chart, for a seamless landing camera.
export function isletLandingFrame(from,to,islet){
 const a=isletPlacement(from,islet),b=isletPlacement(to,islet);
 const co=a.cos*b.cos+a.sin*b.sin,si=a.sin*b.cos-a.cos*b.sin;
 return {a:co,b:si,c:-si,d:co};
}
