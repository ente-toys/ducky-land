import {WORLD_GEO} from './world-map.js';
import {expMap,angle,unit} from './sphere.js';
export function isletHull(i){
 const [a,b]=[i.jetty.foot,i.jetty.tip],w=i.jetty.width/2,n=[-i.jetty.dir[1]*w,i.jetty.dir[0]*w];
 const points=[...i.coast,...i.blocked.flat(),...[a,b].flatMap(p=>[[p[0]+n[0],p[1]+n[1]],[p[0]-n[0],p[1]-n[1]]])].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const turn=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),chain=p=>{const out=[];for(const q of p){while(out.length>1&&turn(out.at(-2),out.at(-1),q)<=0)out.pop();out.push(q);}return out;};
 return [...chain(points).slice(0,-1),...chain(points.toReversed()).slice(0,-1)];
}
export function isletShores(i,R=WORLD_GEO.Rw){
 const local=isletHull(i),points=[];
 for(let k=0;k<local.length;k++){
  const a=local[k],b=local[(k+1)%local.length],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/200));
  for(let j=0;j<n;j++)points.push(expMap(i,a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n,R));
 }
 const center=unit(points.reduce((sum,p)=>sum.map((v,k)=>v+p[k]),[0,0,0]));
 return [{local,points,center,radius:Math.max(...points.map(p=>angle(p,center))),island:i}];
}

const cross2=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const inside=(q,p)=>{let yes=false;for(let k=0,j=p.length-1;k<p.length;j=k++)if((p[k][1]>q[1])!==(p[j][1]>q[1])&&q[0]<(p[j][0]-p[k][0])*(q[1]-p[k][1])/(p[j][1]-p[k][1])+p[k][0])yes=!yes;return yes;};
const pointSegment=(p,a,b)=>{const x=b[0]-a[0],y=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*y)/(x*x+y*y||1)));return Math.hypot(p[0]-a[0]-t*x,p[1]-a[1]-t*y);};
export function flatRingGap(A,B,limit=Infinity){
 if(inside(A[0],B)||inside(B[0],A))return 0;
 let best=limit;
 for(let k=0;k<A.length;k++)for(let j=0;j<B.length;j++){
  const a=A[k],b=A[(k+1)%A.length],c=B[j],d=B[(j+1)%B.length];
  if(Math.max(a[0],b[0])+best<Math.min(c[0],d[0])||Math.max(c[0],d[0])+best<Math.min(a[0],b[0])||Math.max(a[1],b[1])+best<Math.min(c[1],d[1])||Math.max(c[1],d[1])+best<Math.min(a[1],b[1]))continue;
  if(cross2(a,b,c)*cross2(a,b,d)<=0&&cross2(c,d,a)*cross2(c,d,b)<=0&&Math.max(Math.min(a[0],b[0]),Math.min(c[0],d[0]))<=Math.min(Math.max(a[0],b[0]),Math.max(c[0],d[0]))&&Math.max(Math.min(a[1],b[1]),Math.min(c[1],d[1]))<=Math.min(Math.max(a[1],b[1]),Math.max(c[1],d[1])))return 0;
  best=Math.min(best,pointSegment(a,c,d),pointSegment(b,c,d),pointSegment(c,a,b),pointSegment(d,a,b));
 }
 return best;
}
