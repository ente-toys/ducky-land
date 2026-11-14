// Trace outside edges of occupied alpha-mask cells. Interior holes are closed;
// disconnected marks stay separate, so smoke/leaves never create a convex bridge.
export function alphaContours(data, size, tolerance = 1) {
  const filled = new Uint8Array(size * size);
  for (let i=0;i<filled.length;i++) filled[i]=data[i*4+3]>32?1:0;
  const edges=new Map(), key=(x,y)=>y*(size+1)+x;
  const occupied=(x,y)=>x>=0&&y>=0&&x<size&&y<size&&filled[y*size+x];
  const add=(x,y,u,v)=>{const k=key(x,y);if(!edges.has(k))edges.set(k,[]);edges.get(k).push([u,v]);};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(occupied(x,y)){
    if(!occupied(x,y-1))add(x,y,x+1,y);
    if(!occupied(x+1,y))add(x+1,y,x+1,y+1);
    if(!occupied(x,y+1))add(x+1,y+1,x,y+1);
    if(!occupied(x-1,y))add(x,y+1,x,y);
  }
  const rings=[];
  while(edges.size){
    const start=edges.keys().next().value;let cur=start,prev=null;const ring=[];
    do{
      const p=[cur%(size+1),Math.floor(cur/(size+1))];ring.push(p);
      const next=edges.get(cur);
      // At a diagonal touch follow the right turn, keeping components apart.
      let i=0;
      if(prev&&next.length>1){const dx=p[0]-prev[0],dy=p[1]-prev[1];i=next.findIndex(q=>dx*(q[1]-p[1])-dy*(q[0]-p[0])>0);if(i<0)i=0;}
      const q=next.splice(i,1)[0];if(!next.length)edges.delete(cur);prev=p;cur=key(...q);
    }while(cur!==start);
    const area=ring.reduce((s,p,i)=>{const q=ring[(i+1)%ring.length];return s+p[0]*q[1]-p[1]*q[0];},0);
    if(area>0)rings.push(simplifyRing(ring,tolerance)); // Negative rings are holes.
  }
  if(!rings.length)throw Error('Empty SVG trace');
  return rings.sort((a,b)=>Math.abs(area(b))-Math.abs(area(a))).map(r=>r.map(p=>p.map(v=>v/size)));
}
const area=r=>r.reduce((s,p,i)=>{const q=r[(i+1)%r.length];return s+p[0]*q[1]-p[1]*q[0];},0);
function simplifyRing(r,tolerance){
  const corners=r.filter((p,i)=>{const a=r[(i+r.length-1)%r.length],b=r[(i+1)%r.length];return (p[0]-a[0])*(b[1]-p[1])!==(p[1]-a[1])*(b[0]-p[0]);});
  if(!tolerance)return corners;
  const split=corners.reduce((best,p,i)=>Math.hypot(p[0]-corners[0][0],p[1]-corners[0][1])>Math.hypot(corners[best][0]-corners[0][0],corners[best][1]-corners[0][1])?i:best,0);
  const dp=ps=>{if(ps.length<=2)return ps;const a=ps[0],b=ps.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;let best=tolerance*tolerance,at=-1;
    for(let i=1;i<ps.length-1;i++){const p=ps[i],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l)),d=(p[0]-a[0]-dx*t)**2+(p[1]-a[1]-dy*t)**2;if(d>best){best=d;at=i;}}
    return at<0?[a,b]:[...dp(ps.slice(0,at+1)).slice(0,-1),...dp(ps.slice(at))];};
  const out=[...dp(corners.slice(0,split+1)).slice(0,-1),...dp([...corners.slice(split),corners[0]]).slice(0,-1)];return out.length>=3?out:corners;
}
