import {localPoint,viewFrame} from './sphere-coordinates.js';
import {dot} from './sphere.js';
import {WORLD_GEO,worldIsland} from './world-map.js';
import {horizonRatio} from './sphere-projection.js';
import {polar} from './rigid.js';

const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export const globeWeight=(ball,far=0)=>smooth(ball/(.25-.23*far));
export const farFromAnchor=(view,anchor)=>smooth((Math.acos(Math.max(-1,Math.min(1,dot(view.center,anchor.center))))-.45)/.5);
export const ease=smooth;
export const paintWeight=ball=>smooth((ball-.1)/.5);

export function globeScreen({id,cam,ball,w,h,basis}){
 const b=basis??{a:1,b:0,c:0,d:1},view=viewFrame(id,cam),Rp=WORLD_GEO.Rw*cam.zoom,horizon=Rp*horizonRatio(ball),k=globeWeight(ball,farFromAnchor(view,worldIsland(id)));
 const toScreen=(px,py)=>({x:w/2+b.a*px+b.c*py,y:h/2+b.b*px+b.d*py});
 const lens=p=>{
  const e=dot(p,view.east),n=dot(p,view.north),s=Math.hypot(e,n),a=Math.atan2(s,dot(p,view.center));
  if(ball>=.25&&a>=Math.PI/2)return null;
  const r=((1-ball)*a+ball*Math.sin(a))*Rp/(s||1);
  return {px:e*r,py:-n*r,a};
 };
 const offset=p=>{
  let px=0,py=0,a=Math.acos(Math.max(-1,Math.min(1,dot(p,view.center))));
  if(k>0){const l=lens(p);if(!l)return null;px=k*l.px;py=k*l.py;a=l.a;}
  if(k<1){const g=localPoint(id,p);px+=(1-k)*(g.x-cam.x)*cam.zoom;py+=(1-k)*(g.y-cam.y)*cam.zoom;}
  if(!Number.isFinite(px+py)||Math.hypot(px,py)>=horizon)return null;
  return {px,py,a};
 };
 const screenOf=p=>{const o=offset(p);return o&&toScreen(o.px,o.py);};
 const sticker=(S,step)=>{
  const c=S(0,0),C=screenOf(c);if(!C)return null;
  const xp=screenOf(S(step,0)),xm=screenOf(S(-step,0)),yp=screenOf(S(0,step)),ym=screenOf(S(0,-step));
  if(!xp||!xm||!yp||!ym)return null;
  const q=polar((xp.x-xm.x)/(2*step),(xp.y-xm.y)/(2*step),(yp.x-ym.x)/(2*step),(yp.y-ym.y)/(2*step));
  const depth=dot(c,view.center),a=Math.acos(Math.max(-1,Math.min(1,depth))),limb=ball===0||ball>.5?1:smooth((Math.PI/2-a)/.12);
  const scale=(cam.zoom*(1-ball)+q.scale*ball)*(ball>.5?1:limb);
  if(!(scale>1e-6))return null;
  return {x:C.x,y:C.y,cos:q.cos,sin:q.sin,scale,depth};
 };
 return {view,Rp,horizon,weight:k,screenOf,sticker};
}
