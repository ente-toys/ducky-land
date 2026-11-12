export const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0;};
export class PondCapacityError extends Error {}
export function planPond(p){
 let seed=hash(p.island+'/'+p.id),rnd=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 const count=p.duckies.length;
 if(count!==2&&count!==3)throw Error('Expected two or three pond Duckies');
 const seeds=p.duckies.map((_,k)=>hash(p.island+'/'+p.id+'/'+k)),states=seeds.slice(),random=k=>((states[k]=Math.imul(states[k],1664525)+1013904223>>>0)/4294967296);
 const cells=new Set(p.cells),point=i=>[p.origin[0]+(i%p.cols)*p.step,p.origin[1]+Math.floor(i/p.cols)*p.step];
 const nodes=new Map(p.cells.map(i=>[i,point(i)]));
 const widths=p.duckies.map(d=>d.width).sort((a,b)=>b-a),gapX=(widths[0]+widths[1])/2+18,gapY=(widths[0]+widths[1])*.17+14;
 const near=(a,b)=>Math.hypot((a[0]-b[0])/gapX,(a[1]-b[1])/gapY);
 const distSegment=(p,a,b)=>{const dx=(b[0]-a[0])/gapX,dy=(b[1]-a[1])/gapY,x=(p[0]-a[0])/gapX,y=(p[1]-a[1])/gapY,t=Math.max(0,Math.min(1,(x*dx+y*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-dx*t,y-dy*t);};
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 function segmentDistance(a,b,c,d){
  if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return 0;
  return Math.min(distSegment(a,c,d),distSegment(b,c,d),distSegment(c,a,b),distSegment(d,a,b));
 }
 function clearLine(a,b,reserves){
  for(const path of reserves){
   if(path.length===1){if(distSegment(path[0],a,b)<=1.18)return false;}
   else for(let j=1;j<path.length;j++)if(segmentDistance(a,b,path[j-1],path[j])<=1.18)return false;
  }
  return true;
 }
 function line(a,b,reserves){
  if(!clearLine(a,b,reserves))return false;
  const cuts=[0,1],dx=b[0]-a[0],dy=b[1]-a[1];
  for(const [axis,delta] of [[0,dx],[1,dy]])if(delta){
   const min=Math.min(a[axis],b[axis]),max=Math.max(a[axis],b[axis]),origin=p.origin[axis];
   for(let k=Math.floor((min-origin)/p.step-.5);origin+(k+.5)*p.step<max;k++){
    const t=(origin+(k+.5)*p.step-a[axis])/delta;if(t>0&&t<1)cuts.push(t);
   }
  }
  cuts.sort((a,b)=>a-b);
  for(let i=1;i<cuts.length;i++){
   const t=(cuts[i-1]+cuts[i])/2,v=[a[0]+dx*t,a[1]+dy*t];
   const ix=Math.round((v[0]-p.origin[0])/p.step),iy=Math.round((v[1]-p.origin[1])/p.step);
   if(!cells.has(iy*p.cols+ix))return false;
  }
  return true;
 }
 const offsets=[-1,1,-p.cols,p.cols,-p.cols-1,-p.cols+1,p.cols-1,p.cols+1];
 function route(from,to,reserves){
  if(!clearLine(nodes.get(from),nodes.get(from),reserves)||!clearLine(nodes.get(to),nodes.get(to),reserves))return null;
  if(line(nodes.get(from),nodes.get(to),reserves))return [nodes.get(from),nodes.get(to)];
  const queue=[from],prev=new Map([[from,-1]]);let cursor=0;
  while(cursor<queue.length&&!prev.has(to)){
   const k=queue[cursor++];for(const d of offsets){const n=k+d;if(prev.has(n)||!cells.has(n)||Math.abs(n%p.cols-k%p.cols)>1)continue;
    if(!line(nodes.get(k),nodes.get(n),reserves))continue;prev.set(n,k);queue.push(n);}
  }
  if(!prev.has(to))return null;
  const path=[];for(let k=to;k!==-1;k=prev.get(k))path.push(nodes.get(k));path.reverse();
  const result=[path[0]];let i=0;while(i<path.length-1){let j=path.length-1;while(j>i+1&&!line(path[i],path[j],reserves))j--;result.push(path[j]);i=j;}return result;
 }
 const length=path=>{let n=0;for(let i=1;i<path.length;i++)n+=Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]);return n;};
 let components=[],seen=new Set();for(const c of p.cells){if(seen.has(c))continue;const q=[c];seen.add(c);for(let i=0;i<q.length;i++)for(const d of offsets){const n=q[i]+d;if(cells.has(n)&&!seen.has(n)&&Math.abs(n%p.cols-q[i]%p.cols)<=1&&line(nodes.get(q[i]),nodes.get(n),[])){q.push(n);seen.add(n);}}components.push(q);}
 components.sort((a,b)=>b.length-a.length);const pool=components.filter(c=>c.length>=8).flat();if(!pool.length)throw new PondCapacityError(p.id+' no connected swimming lanes');
 let starts=null,bestGap=0;
 const first=Math.floor(rnd()*pool.length);
 for(let attempt=0;attempt<Math.min(pool.length,64);attempt++){
  const chosen=[pool[(first+Math.floor(attempt*pool.length/Math.min(pool.length,64)))%pool.length]];
  while(chosen.length<count)chosen.push(pool.reduce((a,b)=>Math.min(...chosen.map(c=>near(nodes.get(b),nodes.get(c))))>Math.min(...chosen.map(c=>near(nodes.get(a),nodes.get(c))))?b:a,pool[0]));
  const gap=Math.min(...chosen.flatMap((c,i)=>chosen.slice(i+1).map(d=>near(nodes.get(c),nodes.get(d)))));
  if(gap>bestGap){starts=chosen;bestGap=gap;}
 }
 if(bestGap<1.5)throw new PondCapacityError(p.id+' too little separation for '+count);
 let at=[...starts],time=0;const tracks=p.duckies.map(()=>[]);
 function append(paths,ends){
  const lens=paths.map(length),holds=paths.map((_,k)=>2+random(k)*4);
  const duration=Math.max(...lens)/((6+rnd()*2)/.65)+Math.max(...holds);
  for(let k=0;k<count;k++){const path=paths[k],cum=[0];for(let i=1;i<path.length;i++)cum.push(cum.at(-1)+Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]));tracks[k].push({at:time,hold:holds[k],duration:duration-holds[k],path,cum,length:lens[k]});}
  time+=duration;at=ends;
 }
 for(let round=0;round<32;round++){
  let best=null;
  for(let tries=0;tries<300;tries++){
   const paths=[],ends=[];
   for(let k=0;k<count;k++){
    const end=pool[Math.floor(random(k)*pool.length)],reserves=[...paths,...at.slice(k+1).map(i=>[nodes.get(i)])],path=route(at[k],end,reserves);
    if(!path||length(path)<20)break;
    paths.push(path);ends.push(end);
   }
   if(paths.length!==count)continue;
   const lens=paths.map(length),ratio=Math.min(...lens)/Math.max(...lens);
   if(!best||ratio>best.ratio)best={paths,ends,ratio};if(ratio>.92)break;
  }
  if(!best&&tracks[0].length){const previous=tracks.map(t=>t.at(-1));best={paths:previous.map(t=>t.path.toReversed()),ends:at.map((_,k)=>{const v=previous[k].path[0];return pool.find(i=>nodes.get(i)[0]===v[0]&&nodes.get(i)[1]===v[1]);})};}
  if(!best)throw new PondCapacityError(p.id+' cannot plan '+count+' paddlers at round '+round);
  append(best.paths,best.ends);
 }
 const forward=tracks.map(t=>t.slice());
 for(let i=forward[0].length-1;i>=0;i--)append(forward.map(t=>t[i].path.toReversed()),starts);
 const round=v=>Math.round(v*1000)/1000;
 return {seed:hash(p.island+'/'+p.id),seeds,period:round(time),tracks:tracks.map(t=>t.map(s=>({...s,at:round(s.at),hold:round(s.hold),duration:round(s.duration),length:round(s.length),cum:s.cum.map(round)})))};
}
