import {createNavigation} from './navigation.js';
import {inPoly} from '../../assets/world/island-geometry.mjs';
export function onRink(rink, x, y) {
  return !!rink && x>=rink.x-2 && y>=rink.y-2 && x<=rink.x+rink.width+2 && y<=rink.y+rink.height+2 &&
    inPoly(x,y,rink.poly) && !(rink.exclusions??[]).some(poly=>inPoly(x,y,poly));
}

function segmentGap(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);}
export function onIcePath(paths, x, y) {
  return (paths??[]).some(r=>r.samples.some((p,i)=>i>0&&segmentGap(x,y,r.samples[i-1],p)<=r.width/2-6));
}
const nearLake=(r,x,y)=>x>r.x-220&&y>r.y-220&&x<r.x+r.width+220&&y<r.y+r.height+220;
export const onIce = (nav, x, y) => onRink(nav.rink,x,y) || onIcePath(nav.icePaths,x,y);

const iceMaps=new WeakMap();
function iceNavigation(nav){
 let result=iceMaps.get(nav);if(result)return result;
 const r=nav.rink,pts=[...r.poly,...(nav.icePaths??[]).flatMap(q=>q.samples)],xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
 const x0=Math.min(...xs)-96,y0=Math.min(...ys)-96;
 result=createNavigation({origin:{x:x0,y:y0},width:Math.max(...xs)+96-x0,height:Math.max(...ys)+96-y0},
  {cellSize:24,walkable:(x,y)=>nav.walkable(x,y)&&(onIce(nav,x,y)||nearLake(r,x,y))});
 iceMaps.set(nav,result);return result;
}

export const RINK_TWIRL = .6, RINK_REDUCED_GLIDE = .55;
const approach = (from,to,amount) => from+Math.max(-amount,Math.min(amount,to-from));

export function rinkTilt(ice, speed, time, reduced=false) {
  return !ice || reduced || speed < 8 ? 0 : Math.sin(time*7)*.045*Math.min(1,speed/150);
}

export const ICE_SPEED = 300, ICE_SPIN = 7, ICE_CRASH = .7;
export function stepRink(actor, nav, dt, input, move) {
  const rink=nav.rink;
  if (!rink || actor.mode==='sailing') {actor.ice=null;return false;}
  if (typeof input.reducedMotion==='boolean') actor.reducedMotion=input.reducedMotion;
  const reduced=actor.reducedMotion===true;
  let ice=actor.ice;
  if (ice?.phase==='crash') {
    ice.elapsed+=dt;
    if (ice.elapsed<ICE_CRASH) {actor.travel=0;actor.pace=0;actor.action=0;actor.until=0;return true;}
    ice.phase='done';
  }
  if (!onIce(nav,actor.x,actor.y)) {actor.ice=null;return false;}
  if (ice?.phase==='done') return false;
  if (!ice) {
    const manual=input.x||input.y, len=manual?Math.hypot(input.x,input.y):0;
    const next=actor.path?.[0], nd=next?Math.hypot(next[0]-actor.x,next[1]-actor.y):0;
    const dir=manual?[input.x/len,input.y/len]:actor.heading??(nd>1?[(next[0]-actor.x)/nd,(next[1]-actor.y)/nd]:[Math.sin(actor.turn),Math.cos(actor.turn)]);
    ice=actor.ice={phase:'glide',elapsed:0,vx:dir[0]*ICE_SPEED,vy:dir[1]*ICE_SPEED};
    actor.path=[];actor.until=0;
  }
  for (let left=dt;left>1e-8;) {
    const h=Math.min(left,1/120);left-=h;ice.elapsed+=h;
    if (!reduced) actor.turn+=ICE_SPIN*h;
    const x=actor.x,y=actor.y,[nx,ny]=move(nav,x,y,ice.vx*h,ice.vy*h);
    const want=Math.hypot(ice.vx*h,ice.vy*h),got=Math.hypot(nx-x,ny-y);
    actor.x=nx;actor.y=ny;
    if (!onIce(nav,nx,ny) || got<want*.3) {ice.phase='crash';ice.elapsed=0;ice.crashX=ice.vx;ice.crashY=ice.vy;ice.vx=ice.vy=0;break;}
  }
  actor.travel=Math.hypot(actor.x-actor.previousX,actor.y-actor.previousY)/dt;
  actor.pace=Math.hypot(ice.vx,ice.vy);actor.heading=null;actor.until=0;
  actor.action=actor.travel>.001?1:0;
  return true;
}
