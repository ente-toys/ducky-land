import {geometry,inShape,shapeIndex} from '../../assets/world/island-geometry.mjs';
const fixedGraphs=new WeakMap();
// Reuse the fixed neighbour graph while trying drawings at nearby positions.
// Keep already-reachable destinations connected while opening the requested approach.
export function candidateConnectivity(world,props,beds,exclude,spawn,target,{preserveAreas=false,protectTargets=[],allowCoveredTarget=false}={}){
 const step=16,C=Math.ceil(world.width/step),R=Math.ceil(world.height/step),N=C*R;
 const point=i=>[world.origin.x+(i%C+.5)*step,world.origin.y+(Math.floor(i/C)+.5)*step];
 const cell=([x,y])=>Math.floor((y-world.origin.y)/step)*C+Math.floor((x-world.origin.x)/step);
 const stable=geometry({...world,obstacles:[...world.obstacles.filter(o=>!exclude.has(String(o.prop))),...beds]}).walkable;
 const cached=fixedGraphs.get(world),grid=cached?cached.grid.slice():new Uint8Array(N),edges=cached?cached.edges.slice():new Uint8Array(N),seen=new Int32Array(N),cut=new Int32Array(N),cutEdges=new Int32Array(N*4),queue=new Int32Array(N),dirs=[-1,1,-C,C];let version=0;const fractions=Array.from({length:15},(_,i)=>(i+1)/16);
 let bounds=[0,0,C-1,R-1];
 if(cached){const changed=world.obstacles.filter(o=>exclude.has(String(o.prop))!==cached.exclude.has(String(o.prop)));if(!changed.length)bounds=null;else {const points=changed.flatMap(o=>o.poly?[o.poly,...(o.parts??[])].flat():[[o.x-o.rx,o.y-o.ry],[o.x+o.rx,o.y+o.ry]]),pad=Math.max(...changed.map(o=>o.clearance??16))+step*2,xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);bounds=[Math.max(0,Math.floor((Math.min(...xs)-pad-world.origin.x)/step)),Math.max(0,Math.floor((Math.min(...ys)-pad-world.origin.y)/step)),Math.min(C-1,Math.ceil((Math.max(...xs)+pad-world.origin.x)/step)),Math.min(R-1,Math.ceil((Math.max(...ys)+pad-world.origin.y)/step))];}}
 if(bounds){const [left,top,right,bottom]=bounds;for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){const i=y*C+x;grid[i]=+stable(...point(i));}
 for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){const i=y*C+x,p=point(i);for(const k of [1,3]){const j=i+dirs[k];if(j<0||j>=N||Math.abs(j%C-i%C)>1)continue;const other=k===1?0:2;edges[i]&=~(1<<k);edges[j]&=~(1<<other);if(!grid[i]||!grid[j])continue;const q=point(j);if(fractions.every(t=>stable(p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t))){edges[i]|=1<<k;edges[j]|=1<<other;}}}}
 if(!cached)fixedGraphs.set(world,{grid:grid.slice(),edges:edges.slice(),exclude:new Set(exclude)});
 const targetList=[target,...protectTargets],targetKey=JSON.stringify(targetList);const endSets=targetList.map((target,index)=>{if(cached?.targetKey===targetKey&&cached.endSets&&(!bounds||target[0]+96<world.origin.x+bounds[0]*step||target[0]-96>world.origin.x+(bounds[2]+1)*step||target[1]+96<world.origin.y+bounds[1]*step||target[1]-96>world.origin.y+(bounds[3]+1)*step))return cached.endSets[index];const out=[];for(let y=-5;y<=5;y++)for(let x=-5;x<=5;x++){const i=cell(target)+y*C+x;if(i<0||i>=N||!grid[i])continue;const q=point(i),n=Math.ceil(Math.hypot(q[0]-target[0],q[1]-target[1]));if(n>96)continue;const path=[];for(let k=0;k<=n;k++)path.push([target[0]+(q[0]-target[0])*k/(n||1),target[1]+(q[1]-target[1])*k/(n||1)]);if(path.every(p=>stable(...p)))out.push({i,path});}return out;});
 const fixed=fixedGraphs.get(world);if(!fixed.endSets){fixed.endSets=endSets;fixed.targetKey=targetKey;}
 const rasterCache=new Map(),fx=world.origin.x-Math.floor(world.origin.x),fy=world.origin.y-Math.floor(world.origin.y);
 const fastMask=p=>{let m=rasterCache.get(String(p.id));if(m)return m;const shapes=[p.footprint,p.bodyFootprint].filter(Boolean),points=shapes.flatMap(f=>[f.poly,...(f.parts??[])].flat());if(!points.length){m={empty:true};rasterCache.set(String(p.id),m);return m;}const pad=Math.max(...shapes.map(f=>f.clearance??0))+2,xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),left=Math.floor(Math.min(...xs)-pad-fx)+fx,top=Math.floor(Math.min(...ys)-pad-fy)+fy,width=Math.ceil(Math.max(...xs)+pad-left)+1,height=Math.ceil(Math.max(...ys)+pad-top)+1,bits=new Uint8Array(width*height);for(let y=0;y<height;y++)for(let x=0;x<width;x++)bits[y*width+x]=+shapes.some(f=>inShape(left+x,top+y,f,f.clearance??0));m={baseX:p.x,baseY:p.y,left,top,width,height,bits};rasterCache.set(String(p.id),m);return m;};
 const start=cell(spawn);let oldComponent=null,protectedIndexes=null;
 const check=candidates=>{version++;
  const masks=candidates.map(p=>({p,m:fastMask(p)}));const gridHits=(x,y)=>masks.some(({p,m})=>{if(m.empty)return false;const u=Math.round(x-(p.x-m.baseX)-m.left),v=Math.round(y-(p.y-m.baseY)-m.top);return u>=0&&v>=0&&u<m.width&&v<m.height&&m.bits[v*m.width+u];});
  const near=shapeIndex(candidates.flatMap(p=>[p.footprint,p.bodyFootprint].filter(Boolean)),30),hits=(x,y)=>near(x,y).some(f=>inShape(x,y,f,f.clearance??0));
  for(const p of candidates){const shapes=[p.footprint,p.bodyFootprint].filter(Boolean),pts=shapes.flatMap(f=>[f.poly,...(f.parts??[])].flat());if(!pts.length)continue;const pad=Math.max(...shapes.map(f=>f.clearance??0))+step*2,xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
   const left=Math.max(0,Math.floor((Math.min(...xs)-pad-world.origin.x)/step)),right=Math.min(C-1,Math.ceil((Math.max(...xs)+pad-world.origin.x)/step)),top=Math.max(0,Math.floor((Math.min(...ys)-pad-world.origin.y)/step)),bottom=Math.min(R-1,Math.ceil((Math.max(...ys)+pad-world.origin.y)/step));
   for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){const i=y*C+x;if(!grid[i])continue;const a=point(i);if(gridHits(...a))cut[i]=version;for(const k of [1,3])if(edges[i]&(1<<k)){const j=i+dirs[k],b=point(j);if(fractions.some(t=>gridHits(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t))){cutEdges[i*4+k]=version;cutEdges[j*4+(k===1?0:2)]=version;}}}
  }
  let head=0,tail=0;if(!oldComponent||allowCoveredTarget){queue[tail++]=start;seen[start]=version;}else{for(const e of endSets[0])if(cut[e.i]!==version&&e.path.every(p=>!hits(...p))){queue[tail++]=e.i;seen[e.i]=version;}if(!tail)return false;}
  while(head<tail){const i=queue[head++];for(let k=0;k<4;k++){if(!(edges[i]&(1<<k))||cutEdges[i*4+k]===version)continue;const j=i+dirs[k];if(seen[j]===version||cut[j]===version)continue;seen[j]=version;queue[tail++]=j;}}
  if(oldComponent&&seen[start]!==version)return false;
  const reachable=endSets.map((ends,i)=>i===0&&allowCoveredTarget&&hits(...target)||ends.some(e=>seen[e.i]===version&&e.path.every(p=>!hits(...p))));
  if(!oldComponent){oldComponent=Array.from(queue.subarray(0,tail));protectedIndexes=reachable.flatMap((yes,i)=>yes?[i]:[]);return reachable[0];}
  if(!reachable[0]||protectedIndexes.some(i=>!reachable[i]))return false;
  if(preserveAreas)for(const i of oldComponent)if(cut[i]!==version&&seen[i]!==version)return false;
  return true;
 };
 check(preserveAreas?[]:props.filter(p=>exclude.has(String(p.id))));return check;
}
