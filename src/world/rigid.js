import {mapOf,mapsVersion} from './island-maps.js';
import {mapPoint} from './sphere-coordinates.js';

export function polar(a,b,c,d){
 const angle=Math.atan2(b-c,a+d);
 return {angle,cos:Math.cos(angle),sin:Math.sin(angle),scale:Math.sqrt(Math.abs(a*d-b*c))};
}
export const rigidMatrix=(cos,sin,scale,x,y)=>({a:cos*scale,b:sin*scale,c:-sin*scale,d:cos*scale,x,y});
export function shearOf({a,b,c,d}){
 const ex=Math.hypot(a,b),ny=Math.hypot(c,d),cos=(a*c+b*d)/(ex*ny);
 return {shearDeg:Math.abs(Math.acos(Math.max(-1,Math.min(1,cos)))*180/Math.PI-90),ratio:Math.max(ex/ny,ny/ex)};
}
const cache=new Map();let cacheVersion=-1;
export function flatRigid(from,to){
 if(cacheVersion!==mapsVersion()){cacheVersion=mapsVersion();cache.clear();}
 const key=from+'>'+to;let r=cache.get(key);
 if(!r){
  const m=mapOf(to);
  const c=mapPoint(to,from,{x:m.cx,y:m.cy});
  r={a:1,b:0,c:0,d:1,x:c.x,y:c.y};
  r.cx=m.cx;r.cy=m.cy;cache.set(key,r);
 }
 return r;
}
export function placeRigid(from,to,p){const r=flatRigid(from,to),x=p.x-r.cx,y=p.y-r.cy;return {x:r.x+r.a*x+r.c*y,y:r.y+r.b*x+r.d*y};}
export function unplaceRigid(from,to,p){const r=flatRigid(from,to),x=p.x-r.x,y=p.y-r.y;return {x:r.cx+r.a*x+r.b*y,y:r.cy+r.c*x+r.d*y};}
