import {localPoint,viewFrame} from './sphere-coordinates.js';
import {dot} from './sphere.js';
import {WORLD_GEO,worldIsland} from './world-map.js';
import {horizonRatio} from './sphere-projection.js';
import {polar} from './rigid.js';

// boss 8 Nov ("try rotating the globe: all the positions are changing instead of the globe rotating"): on the ball every
// island and islet is placed by the SPHERE, never by the current island's flat chart. Its sticker centre is the lens
// projection of its true sphere centre through the view frame, r = ((1-ball)*angle + ball*sin(angle)) * Rp, the same
// lens the ocean is drawn with. Only at ball 0 is it today's flat placement (the anchor island's chart, where the live
// scene is drawn), and the two are blended on screen with the shader's own coordinate morph weight, so zooming in from
// the ball lands on the flat island with no pop. Far from the anchor its flat chart is badly stretched; blending
// through it (the old Newton inverse of the shader's mixed chart) made islands slide against each other as you dragged.
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
// far: 0 while the camera is near the anchor island, 1 once it is well away from it (where the anchor's chart is useless,
// so the sphere takes over at a much smaller ball). Still exactly 0 at ball 0.
export const globeWeight=(ball,far=0)=>smooth(ball/(.25-.23*far));
export const farFromAnchor=(view,anchor)=>smooth((Math.acos(Math.max(-1,Math.min(1,dot(view.center,anchor.center))))-.45)/.5);
export const ease=smooth;
// boss 8 Nov: how far islands are painted ON the sphere (1) rather than laid down as rigid stickers (0)
export const paintWeight=ball=>smooth((ball-.1)/.5);

// state: {id, cam:{x,y,zoom}, ball, w, h, basis}
export function globeScreen({id,cam,ball,w,h,basis}){
 const b=basis??{a:1,b:0,c:0,d:1},view=viewFrame(id,cam),Rp=WORLD_GEO.Rw*cam.zoom,horizon=Rp*horizonRatio(ball),k=globeWeight(ball,farFromAnchor(view,worldIsland(id)));
 const toScreen=(px,py)=>({x:w/2+b.a*px+b.c*py,y:h/2+b.b*px+b.d*py});
 // Lens offset (pixels before the camera basis) of a sphere point, or null past the horizon.
 const lens=p=>{
  const e=dot(p,view.east),n=dot(p,view.north),s=Math.hypot(e,n),a=Math.atan2(s,dot(p,view.center));
  if(ball>=.25&&a>=Math.PI/2)return null;
  const r=((1-ball)*a+ball*Math.sin(a))*Rp/(s||1);
  return {px:e*r,py:-n*r,a};
 };
 // Screen pixel of any sphere point.
 const offset=p=>{
  let px=0,py=0,a=Math.acos(Math.max(-1,Math.min(1,dot(p,view.center))));
  if(k>0){const l=lens(p);if(!l)return null;px=k*l.px;py=k*l.py;a=l.a;}
  if(k<1){const g=localPoint(id,p);px+=(1-k)*(g.x-cam.x)*cam.zoom;py+=(1-k)*(g.y-cam.y)*cam.zoom;}
  if(!Number.isFinite(px+py)||Math.hypot(px,py)>=horizon)return null;
  return {px,py,a};
 };
 const screenOf=p=>{const o=offset(p);return o&&toScreen(o.px,o.py);};
 // Rigid sticker: centre = screenOf(its sphere centre); turn = nearest rotation (polar part) of how its own east and
 // south steps project there; one uniform scale (the camera zoom at the flat end, the area-preserving sqrt|det J| on the
 // ball, shrinking to nothing at the horizon). Never a shear.
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
