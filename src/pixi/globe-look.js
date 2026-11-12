import {localPoint,spherePoint} from './sphere-coordinates.js';
import {transport,sphereFrame,dot} from './sphere.js';
import {worldIsland,WORLD_GEO} from './world-map.js';
import {horizonRatio,lensAngle} from './sphere-projection.js';

const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export const LAT_MAX=Math.PI/2-.03;
export const lonLat=p=>({lon:Math.atan2(p[0],p[2]),lat:Math.asin(Math.max(-1,Math.min(1,p[1])))});
export const centreOf=(lon,lat)=>sphereFrame(lon,Math.max(-LAT_MAX,Math.min(LAT_MAX,lat)),0).center;
export const globeBall=(t,zoom,h)=>{const R=WORLD_GEO.Rw*zoom/h;return smooth(t)*smooth((4-R)/3);};
export const uprightFade=ball=>smooth((ball-.25)/.5);
export function northUpRoll(id,c){
 const T=transport(worldIsland(id),c),{lon,lat}=lonLat(c),D=sphereFrame(lon,lat,0);
 return Math.atan2(dot(D.east,T.north),dot(D.east,T.east));
}
export const rollBasis=a=>{const c=Math.cos(a),s=Math.sin(a);return {a:c,b:s,c:-s,d:c};};
export function screenFrame(id,c,fade){
 const T=transport(worldIsland(id),c),f=fade*northUpRoll(id,c),co=Math.cos(f),si=Math.sin(f);
 return {center:c,east:T.east.map((v,k)=>v*co+T.north[k]*si),north:T.north.map((v,k)=>v*co-T.east[k]*si)};
}
export function lensOffset(F,p,ball,Rp){
 const e=dot(p,F.east),n=dot(p,F.north),s=Math.hypot(e,n),a=Math.atan2(s,dot(p,F.center));
 const r=((1-ball)*a+ball*Math.sin(a))*Rp/(s||1);return {x:e*r,y:-n*r};
}
export function unlens(F,o,ball,Rp){
 const max=.97*horizonRatio(ball);let x=o.x/Rp,y=-o.y/Rp;const d=Math.hypot(x,y);if(d>max){x*=max/d;y*=max/d;}
 const r=Math.min(d,max),a=lensAngle(r,ball),s=r>1e-12?Math.sin(a)/r:1,z=Math.cos(a);
 return F.center.map((v,k)=>v*z+(F.east[k]*x+F.north[k]*y)*s);
}
export function globeDrag(id,centre,from,to,ball,Rp){
 const fade=uprightFade(ball),p=unlens(screenFrame(id,centre,fade),from,ball,Rp);
 let {lon,lat}=lonLat(centre);
 const at=(lo,la)=>lensOffset(screenFrame(id,centreOf(lo,la),fade),p,ball,Rp);
 const max=.97*horizonRatio(ball)*Rp,d=Math.hypot(to.x,to.y),goal=d>max?{x:to.x*max/d,y:to.y*max/d}:to;
 for(let it=0;it<10;it++){
  const q=at(lon,lat),ex=goal.x-q.x,ey=goal.y-q.y;if(Math.hypot(ex,ey)<1e-4)break;
  const h=1e-6,a1=at(lon+h,lat),a2=at(lon,lat+h);
  const J=[(a1.x-q.x)/h,(a2.x-q.x)/h,(a1.y-q.y)/h,(a2.y-q.y)/h],det=J[0]*J[3]-J[1]*J[2];
  if(!(Math.abs(det)>1e-9))break;
  let dl=(J[3]*ex-J[1]*ey)/det,dp=(-J[2]*ex+J[0]*ey)/det;const step=Math.hypot(dl*Math.cos(lat),dp);
  if(step>.5){dl*=.5/step;dp*=.5/step;}
  lon+=dl;lat=Math.max(-LAT_MAX,Math.min(LAT_MAX,lat+dp));
 }
 return {lon,lat};
}
export const lookAt=(id,camera,lon,lat)=>Object.assign(camera,localPoint(id,centreOf(lon,lat)));
export const lookOf=(id,camera)=>lonLat(spherePoint(id,camera));
