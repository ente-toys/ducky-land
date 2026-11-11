// Live bots share a coarse, static walking graph and advance a bounded amount
// of A* work each tick. Native navigation still decides every walkable point
// and edge; the normal sim still moves/collides each duck at 60 Hz.
const CELL=96,WORK=8,MAX_SEARCH=512;
const DX=[-1,0,1,-1,1,-1,0,1],DY=[-1,-1,-1,0,0,1,1,1];

export function createBotNavigation({navigation:nav,bounds}){
 const cols=Math.ceil(bounds.width/CELL),rows=Math.ceil(bounds.height/CELL),size=cols*rows;
 const x0=bounds.x0??0,y0=bounds.y0??0,cells=new Uint8Array(size),edges=new Uint8Array(size*8),jobs=[];
 const from=[0,0],to=[0,0];let cursor=0;
 const px=id=>x0+(id%cols+.5)*CELL,py=id=>y0+(Math.floor(id/cols)+.5)*CELL;
 function open(id){if(!cells[id])cells[id]=nav.walkable(px(id),py(id))?1:2;return cells[id]===1;}
 function line(x,y,id){from[0]=x;from[1]=y;to[0]=px(id);to[1]=py(id);return nav.clearLine(from,to);}
 function nearest(x,y,start=false){
  const xx=Math.max(0,Math.min(cols-1,Math.floor((x-x0)/CELL))),yy=Math.max(0,Math.min(rows-1,Math.floor((y-y0)/CELL)));
  for(let r=0;r<=2;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
   if(r&&Math.abs(dx)!==r&&Math.abs(dy)!==r)continue;
   const cx=xx+dx,cy=yy+dy;if(cx<0||cx>=cols||cy<0||cy>=rows)continue;
   const id=cy*cols+cx;if(open(id)&&(!start||line(x,y,id)))return id;
  }
  return -1;
 }
 function prepare(brain){
  if(brain.routeJob)return brain.routeJob;
  const job={brain,active:false,epoch:0,length:0,start:0,end:0,best:0,expanded:0,
   cost:new Float32Array(size),parent:new Int32Array(size),seen:new Uint32Array(size),closed:new Uint32Array(size),
   heap:new Int32Array(size),where:new Int32Array(size),priority:new Float32Array(size),trail:new Int32Array(size),
   points:Array.from({length:size},()=>[0,0])};
  jobs.push(job);brain.routeJob=job;return job;
 }
 function heuristic(id,end){const dx=Math.abs(id%cols-end%cols),dy=Math.abs(Math.floor(id/cols)-Math.floor(end/cols));return Math.max(dx,dy)+(Math.SQRT2-1)*Math.min(dx,dy);}
 function push(j,id){
  let i=j.where[id];if(i<0)i=j.length++;
  const f=j.priority[id];
  while(i){const parent=(i-1)>>1,other=j.heap[parent];if(j.priority[other]<=f)break;j.heap[i]=other;j.where[other]=i;i=parent;}
  j.heap[i]=id;j.where[id]=i;
 }
 function pop(j){
  const id=j.heap[0],last=j.heap[--j.length];j.where[id]=-1;
  if(j.length){let i=0;
   while(i*2+1<j.length){let child=i*2+1;if(child+1<j.length&&j.priority[j.heap[child+1]]<j.priority[j.heap[child]])child++;
    if(j.priority[j.heap[child]]>=j.priority[last])break;
    j.heap[i]=j.heap[child];j.where[j.heap[i]]=i;i=child;
   }
   j.heap[i]=last;j.where[last]=i;
  }
  return id;
 }
 function route(brain,sx,sy,tx,ty){
  const j=prepare(brain);j.active=false;brain.path.length=0;
  j.start=nearest(sx,sy,true);j.end=nearest(tx,ty);if(j.start<0||j.end<0)return;
  if(++j.epoch>=0xffffffff){j.seen.fill(0);j.closed.fill(0);j.epoch=1;}
  j.length=0;j.expanded=0;j.best=j.start;j.cost[j.start]=0;j.parent[j.start]=-1;
  j.seen[j.start]=j.epoch;j.where[j.start]=-1;j.priority[j.start]=heuristic(j.start,j.end);push(j,j.start);j.active=true;
 }
 function finish(j,id){
  let count=0;
  for(let n=id;n!==-1;n=j.parent[n])j.trail[count++]=n;
  const path=j.brain.path;path.length=0;
  for(let i=count-1;i>=0;i--){const node=j.trail[i],point=j.points[count-1-i];point[0]=px(node);point[1]=py(node);path.push(point);}
  j.active=false;
 }
 function expand(j){
  if(!j.length){finish(j,j.best);return;}
  const id=pop(j);j.closed[id]=j.epoch;j.expanded++;
  if(heuristic(id,j.end)<heuristic(j.best,j.end))j.best=id;
  if(id===j.end||j.expanded>=MAX_SEARCH){finish(j,j.best);return;}
  const x=id%cols,y=Math.floor(id/cols);
  for(let d=0;d<8;d++){
   const xx=x+DX[d],yy=y+DY[d];if(xx<0||xx>=cols||yy<0||yy>=rows)continue;
   const next=yy*cols+xx;if(j.closed[next]===j.epoch||!open(next))continue;
   const key=id*8+d;
   if(!edges[key]){const clear=line(px(id),py(id),next);edges[key]=clear?1:2;edges[next*8+7-d]=edges[key];}
   if(edges[key]!==1)continue;
   const cost=j.cost[id]+(DX[d]&&DY[d]?Math.SQRT2:1),fresh=j.seen[next]!==j.epoch;
   if(!fresh&&cost>=j.cost[next])continue;
   if(fresh){j.seen[next]=j.epoch;j.where[next]=-1;}
   j.cost[next]=cost;j.parent[next]=id;j.priority[next]=cost+heuristic(next,j.end);push(j,next);
  }
 }
 function step(){
  let left=WORK,misses=0;
  while(left&&jobs.length&&misses<jobs.length){const j=jobs[cursor++%jobs.length];if(!j.active){misses++;continue;}misses=0;expand(j);left--;}
 }
 return {prepare,route,step,pending:brain=>brain.routeJob?.active===true,cancel:brain=>{if(brain.routeJob)brain.routeJob.active=false;}};
}
