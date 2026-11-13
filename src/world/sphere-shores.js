import {unplaceRigid} from './rigid.js';
import {WORLD_GEO,WORLD_ISLANDS} from './world-map.js';
import {mapOf} from './island-maps.js';
import {coastPolygons,coastDistance} from './island-coasts.js';
import {expMap,logMap,angle,arcDistance,unit} from './sphere.js';
export const BOAT_CHANNEL=600;
const SHORE_STEP=400;
const SHORES=new WeakMap();
const shoresOf=m=>{
 if(!SHORES.has(m))SHORES.set(m,coastPolygons(m.world,m.walk));
 return SHORES.get(m);
};
export function sphereShores(island,R=WORLD_GEO.Rw){
 const m=mapOf(island.id),sx=island.width/m.width,sy=island.height/m.height;
 return shoresOf(m).map(ring=>{
  const points=[];for(let k=0;k<ring.length;k++){
   const a=ring[k],b=ring[(k+1)%ring.length],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/SHORE_STEP));
   for(let j=0;j<n;j++)points.push(expMap(island,(a[0]+(b[0]-a[0])*j/n-m.cx)*sx,(a[1]+(b[1]-a[1])*j/n-m.cy)*sy,R));
  }
  const center=unit(points.reduce((sum,p)=>sum.map((v,k)=>v+p[k]),[0,0,0]));
  return {points,center,radius:Math.max(...points.map(p=>angle(p,center))),island,local:ring.map(([x,y])=>[(x-m.cx)*sx,(y-m.cy)*sy])};
 });
}
const inRing=(ring,x,y)=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
const within=(p,s,R)=>{const q=logMap(s.island,p,R);return inRing(s.local,q.x,q.y);};
export function sphereShoreGap(A,B,R=WORLD_GEO.Rw){
 let best=Infinity;
 for(const a of A)for(const b of B){
  if((angle(a.center,b.center)-a.radius-b.radius)*R>=best)continue;
  if(a.local&&b.local&&(within(a.points[0],b,R)||within(b.points[0],a,R)))return 0;
  best=Math.min(best,ringPairGap(a.points,b.points,R));
 }
 return best;
}
function ringPairGap(A,B,R){
 let c=-2;
 for(const p of A)for(const q of B){const d=p[0]*q[0]+p[1]*q[1]+p[2]*q[2];if(d>c)c=d;}
 let best=Math.acos(Math.min(1,c));const reach=Math.cos(best+SHORE_STEP/R);
 for(const [P,E]of [[A,B],[B,A]])for(const p of P)for(let k=0;k<E.length;k++){
  const e=E[k];if(p[0]*e[0]+p[1]*e[1]+p[2]*e[2]<reach)continue;
  best=Math.min(best,arcDistance(p,e,E[(k+1)%E.length]),arcDistance(p,E[(k+E.length-1)%E.length],e));
 }
 return best*R;
}
export function coastGaps(islands=WORLD_ISLANDS,R=WORLD_GEO.Rw){
 const shores=islands.map(i=>sphereShores(i,R)),out=[];
 for(let a=0;a<islands.length;a++)for(let b=a+1;b<islands.length;b++)out.push({a:islands[a].id,b:islands[b].id,gap:sphereShoreGap(shores[a],shores[b],R)});
 return out.sort((p,q)=>p.gap-q.gap);
}

export function copyHolding(x, y, copies, pad = 300, here = mapOf('home')) {
  if (here.landAt?.(x,y)) return null;
  if(!copies.some(c=>c.from)&&Math.abs(x-(here.origin?.x??0)-here.width/2)<here.width/2&&Math.abs(y-(here.origin?.y??0)-here.height/2)<here.height/2)return null;
  const held=[];
  for (const copy of copies) {
    const cw = copy.width ?? mapOf(copy.id).width, ch = copy.height ?? mapOf(copy.id).height;
    let q={x:x-copy.x,y:y-copy.y};
    if(copy.from){
      const m=mapOf(copy.id),p=unplaceRigid(copy.from,copy.id,{x,y});
      q={x:p.x-m.cx,y:p.y-m.cy};
    }
    if(Math.abs(q.x)<cw/2+pad&&Math.abs(q.y)<ch/2+pad)held.push({copy,q});
  }
  const own=here.world?coastDistance(x,y,shoresOf(here)):Infinity;
  if(held.length<2&&own===Infinity)return held[0]?.copy ?? null;
  let best=null,distance=own;
  for(const {copy,q}of held){const m=mapOf(copy.id),d=coastDistance(q.x+m.cx,q.y+m.cy,shoresOf(m));if(d<distance){distance=d;best=copy;}}
  return best;
}
