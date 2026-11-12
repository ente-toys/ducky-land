export const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const unit=a=>{const d=Math.hypot(...a)||1;return a.map(v=>v/d);};
export const angle=(a,b)=>Math.atan2(Math.hypot(...cross(a,b)),Math.max(-1,Math.min(1,dot(a,b))));
export function sphereFrame(lon,lat,roll=0){
 const c=Math.abs(Math.cos(lat))<1e-14?[0,Math.sign(lat),0]:[Math.sin(lon)*Math.cos(lat),Math.sin(lat),Math.cos(lon)*Math.cos(lat)];
 const e=[Math.cos(lon),0,-Math.sin(lon)],n=cross(c,e),co=Math.cos(roll),si=Math.sin(roll);
 return {center:c,east:e.map((v,k)=>v*co+n[k]*si),north:n.map((v,k)=>v*co-e[k]*si)};
}
export function expMap(frame,x,y,R){
 const d=Math.hypot(x,y),a=d/R,s=d>1e-10?Math.sin(a)/d:1/R,c=Math.cos(a);
 return frame.center.map((v,k)=>v*c+(frame.east[k]*x-frame.north[k]*y)*s);
}
export function logMap(frame,p,R){
 const e=dot(p,frame.east),n=dot(p,frame.north),s=Math.hypot(e,n),a=Math.atan2(s,dot(p,frame.center));
 if(s<1e-12)return a<1?{x:0,y:0}:{x:Math.PI*R,y:0};
 return {x:e*a*R/s,y:-n*a*R/s};
}
export function transport(frame,p){
 const v=cross(frame.center,p),c=dot(frame.center,p),s=Math.hypot(...v);
 const axis=s>1e-10?v.map(x=>x/s):frame.north;
 const move=a=>{
  if(s<1e-10&&c>0)return a;
  const va=cross(axis,a),parallel=dot(axis,a);
  return a.map((x,k)=>x*c+va[k]*s+axis[k]*parallel*(1-c));
 };
 return {center:p,east:unit(move(frame.east)),north:unit(move(frame.north))};
}
export function arcDistance(p,a,b){
 const ab=angle(a,b),normal=unit(cross(a,b));
 const foot=unit(p.map((v,k)=>v-dot(p,normal)*normal[k]));
 for(const q of [foot,foot.map(v=>-v)])if(Math.abs(angle(a,q)+angle(q,b)-ab)<1e-7)return angle(p,q);
 return Math.min(angle(p,a),angle(p,b));
}
export function ringGap(a,b,R){
 let best=Infinity;
 for(const [points,edges]of [[a,b],[b,a]])for(const p of points)for(let k=0;k<edges.length;k++)best=Math.min(best,arcDistance(p,edges[k],edges[(k+1)%edges.length])*R);
 return best;
}
