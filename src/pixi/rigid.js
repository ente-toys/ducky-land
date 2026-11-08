import {mapOf,mapsVersion} from './island-maps.js';
import {mapPoint} from './sphere-coordinates.js';
// boss 8 Nov: "I don't want any skew. If you zoom, it has to seamlessly zoom to the island or islets."
// Every island and islet is a RIGID sticker: its own flat art, only turned and uniformly scaled. The sphere decides where
// its centre goes and which way it faces (the nearest rotation to the projection's Jacobian there, its polar
// decomposition), never a shear or a squash.

// Columns (a,b) and (c,d) are where a unit step east and a unit step south of the art land.
export function polar(a,b,c,d){
 const angle=Math.atan2(b-c,a+d);
 return {angle,cos:Math.cos(angle),sin:Math.sin(angle),scale:Math.sqrt(Math.abs(a*d-b*c))};
}
export const rigidMatrix=(cos,sin,scale,x,y)=>({a:cos*scale,b:sin*scale,c:-sin*scale,d:cos*scale,x,y});
export function shearOf({a,b,c,d}){
 const ex=Math.hypot(a,b),ny=Math.hypot(c,d),cos=(a*c+b*d)/(ex*ny);
 return {shearDeg:Math.abs(Math.acos(Math.max(-1,Math.min(1,cos)))*180/Math.PI-90),ratio:Math.max(ex/ny,ny/ex)};
}
// Where island `to` is drawn in island `from`'s flat chart: its centre exactly where the sphere puts it, its art at true
// size (scale 1), turned by the chart's rotation at that centre. a..d map `to`-local offsets from its map centre.
const cache=new Map();let cacheVersion=-1;
export function flatRigid(from,to){
 if(cacheVersion!==mapsVersion()){cacheVersion=mapsVersion();cache.clear();}   // a theme arrived: its map centre moved
 const key=from+'>'+to;let r=cache.get(key);
 if(!r){
  const m=mapOf(to);
  if(from===to)r=rigidMatrix(1,0,1,m.cx,m.cy);
  else{
   const h=4,P=(x,y)=>mapPoint(to,from,{x:m.cx+x,y:m.cy+y}),c=P(0,0),xp=P(h,0),xm=P(-h,0),yp=P(0,h),ym=P(0,-h);
   const q=polar((xp.x-xm.x)/(2*h),(xp.y-xm.y)/(2*h),(yp.x-ym.x)/(2*h),(yp.y-ym.y)/(2*h));
   r=rigidMatrix(q.cos,q.sin,1,c.x,c.y);
  }
  r.cx=m.cx;r.cy=m.cy;cache.set(key,r);
 }
 return r;
}
// `to`-local point -> `from` flat chart, and back.
export function placeRigid(from,to,p){const r=flatRigid(from,to),x=p.x-r.cx,y=p.y-r.cy;return {x:r.x+r.a*x+r.c*y,y:r.y+r.b*x+r.d*y};}
export function unplaceRigid(from,to,p){const r=flatRigid(from,to),x=p.x-r.x,y=p.y-r.y;return {x:r.cx+r.a*x+r.b*y,y:r.cy+r.c*x+r.d*y};}
