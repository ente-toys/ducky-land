import {geometry,inShape,shapeIndex} from '../../assets/world/island-geometry.mjs';
import {solidLineTest,waterLineTest} from './home/home-building-lines.js';
export function createNavigation(world,{cellSize=32,walkable:customWalkable,safeEndpoints=world.homeBuildingRoutes===true}={}){
const walkable=customWalkable??geometry(world).walkable;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const X0=world.origin?.x ?? 0,Y0=world.origin?.y ?? 0;
const CELL=cellSize,COLS=Math.ceil(world.width/CELL),ROWS=Math.ceil(world.height/CELL);
const grid=new Uint8Array(COLS*ROWS);
for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)grid[y*COLS+x]=walkable(X0+(x+.5)*CELL,Y0+(y+.5)*CELL)?1:0;
function point(id){return [X0+(id%COLS+.5)*CELL,Y0+(Math.floor(id/COLS)+.5)*CELL];}
const STEP=new Uint8Array(COLS*ROWS*9);
function stepClear(cur,dx,dy,n){const k=cur*9+(dy+1)*3+(dx+1);if(!STEP[k])STEP[k]=clearLine(point(cur),point(n))?1:2;return STEP[k]===1;}
function cell(x,y){return Math.floor((y-Y0)/CELL)*COLS+Math.floor((x-X0)/CELL);}
const targetObstacles=shapeIndex(world.obstacles??[],16);
function targetRadius(x,y){if(!safeEndpoints)return 150;let r=150;for(const s of targetObstacles(x,y))if(inShape(x,y,s,16)){const xs=s.poly?s.poly.map(q=>q[0]):[s.x-s.rx,s.x+s.rx],ys=s.poly?s.poly.map(q=>q[1]):[s.y-s.ry,s.y+s.ry];r=Math.max(r,Math.max(...xs)-Math.min(...xs)+32,Math.max(...ys)-Math.min(...ys)+32);}return r;}
function nearest(x,y,radius=targetRadius(x,y)){
 if(walkable(x,y))return [x,y];
 for(let r=16;r<=radius;r+=16)for(let a=0;a<24;a++){let xx=x+Math.cos(a*Math.PI/12)*r,yy=y+Math.sin(a*Math.PI/12)*r;if(walkable(xx,yy))return [xx,yy];}
 return null;
}
let solidLine=null,waterLine=null;
function clearLine(a,b){if(safeEndpoints&&![...a,...b].every(Number.isFinite))return false;let n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/3);for(let i=1;i<=n;i++)if(!walkable(a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n))return false;if(!safeEndpoints)return true;solidLine??=solidLineTest(world.obstacles??[]);waterLine??=waterLineTest(world.water??[],world.bridges??[]);return solidLine(a,b)&&waterLine(a,b);}
let fineNav=null;
function route(sx,sy,tx,ty){
 const path=coarseRoute(sx,sy,tx,ty);
 // A few Home building verges are narrower than a 32-unit grid cell. Keep
 // normal routes cheap; build the finer fallback only if that grid has no way.
 if(path.length||!safeEndpoints||CELL<=16)return path;
 fineNav??=createNavigation(world,{cellSize:16,walkable,safeEndpoints:true});
 return fineNav.route(sx,sy,tx,ty);
}
function coarseRoute(sx,sy,tx,ty){
 // Home: a blocked click must choose a reachable verge, rather than the first
 // open sample (which can be in a disconnected pocket on the other side).
 if(safeEndpoints&&!walkable(tx,ty)){
  for(let r=16;r<=targetRadius(tx,ty);r+=16){
   const candidates=[];
   for(let a=0;a<24;a++){const p=[tx+Math.cos(a*Math.PI/12)*r,ty+Math.sin(a*Math.PI/12)*r];if(walkable(...p))candidates.push(p);}
   candidates.sort((a,b)=>Math.hypot(a[0]-sx,a[1]-sy)-Math.hypot(b[0]-sx,b[1]-sy));
   for(const target of candidates){if(clearLine([sx,sy],target))return [target];const path=search(sx,sy,target);if(path.length)return path;}
  }
 }
 const near=nearest(tx,ty),target=near||shoreToward(sx,sy,tx,ty);if(!target)return [];
 if(clearLine([sx,sy],target))return [target];
 const path=search(sx,sy,target);if(path.length||near)return path;
 const edge=reachToward(sx,sy,tx,ty);return edge?[edge]:[];
}
function search(sx,sy,target){
 function nearCell(x,y){const c=cell(x,y);if(grid[c])return c;for(let r=1;r<6;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){let xx=Math.floor((x-X0)/CELL)+dx,yy=Math.floor((y-Y0)/CELL)+dy,id=yy*COLS+xx;if(xx>=0&&xx<COLS&&yy>=0&&yy<ROWS&&grid[id]&&clearLine([x,y],point(id)))return id;}return -1;}
 // A wall-side point can see several cells, while its containing cell belongs
 // to a narrow pocket. Attach Home's endpoints to all visible local cells so
 // choosing that one pocket cannot strand an otherwise reachable route.
 function nearCells(x,y){
  const out=[],cx=Math.floor((x-X0)/CELL),cy=Math.floor((y-Y0)/CELL);
  for(let r=0;r<6;r++){
   for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
    if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
    const xx=cx+dx,yy=cy+dy,id=yy*COLS+xx;
    if(xx>=0&&xx<COLS&&yy>=0&&yy<ROWS&&grid[id]&&clearLine([x,y],point(id)))out.push(id);
   }
   if(r>=2&&out.length)break;
  }
  return out;
 }
 const starts=safeEndpoints?nearCells(sx,sy):[nearCell(sx,sy)],ends=safeEndpoints?nearCells(...target):[nearCell(...target)];
 if(!starts.length||!ends.length||starts[0]<0||ends[0]<0)return [];
 const end=ends[0],endSet=new Set(ends);
 const cost=new Float32Array(grid.length).fill(Infinity),parent=new Int32Array(grid.length).fill(-1),closed=new Uint8Array(grid.length),heap=[];
 const heuristic=id=>{const a=point(id),b=safeEndpoints?target:point(end);return Math.hypot(a[0]-b[0],a[1]-b[1])/CELL;};
 function push(id,f){let i=heap.length;heap.push({id,f});while(i){let p=(i-1)>>1;if(heap[p].f<=f)break;heap[i]=heap[p];i=p;}heap[i]={id,f};}
 function pop(){let top=heap[0],end=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=end.f)break;heap[i]=heap[c];i=c;}heap[i]=end;}return top.id;}
 for(const start of starts){const p=point(start);cost[start]=safeEndpoints?Math.hypot(p[0]-sx,p[1]-sy)/CELL:0;push(start,cost[start]+heuristic(start));}let found=-1;
 while(heap.length){let cur=pop();if(closed[cur])continue;closed[cur]=1;if(endSet.has(cur)){found=cur;break;}
 const x=cur%COLS,y=Math.floor(cur/COLS);
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;let xx=x+dx,yy=y+dy,n=yy*COLS+xx;if(xx<0||yy<0||xx>=COLS||yy>=ROWS||!grid[n]||closed[n])continue;if(!world.navigationClearCorners&&dx&&dy&&(!grid[y*COLS+xx]||!grid[yy*COLS+x]))continue;const nc=cost[cur]+(dx&&dy?Math.SQRT2:1);if(!stepClear(cur,dx,dy,n))continue;if(nc<cost[n]){cost[n]=nc;parent[n]=cur;push(n,nc+heuristic(n));}}}
 if(found<0)return [];
 // Keep the checked connector from the duck to the grid. Dropping this cell
 // let the first leg cut through a wall even though every grid edge was clear.
 const cells=[];for(let n=found;n!==-1;n=parent[n]){if(safeEndpoints||n!==starts[0])cells.push(point(n));}cells.reverse();cells.push(target);
 // A* produces one point per 32-unit cell. Keep the ends of straight runs
 // before pulling corners tight, avoiding repeated checks of the same prefix.
 const raw=[];
 for(const p of cells){
  while(raw.length>1){const a=raw.at(-2),b=raw.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],ex=p[0]-b[0],ey=p[1]-b[1];
   if(dx*ey!==dy*ex||dx*ex+dy*ey<=0)break;raw.pop();}
  raw.push(p);
 }
 let out=[],anchor=[sx,sy];for(let i=0;i<raw.length;){let j=i;while(j+1<raw.length&&clearLine(anchor,raw[j+1]))j++;out.push(raw[j]);anchor=raw[j];i=j+1;}return rounded(out,sx,sy);
}
function shoreToward(sx,sy,tx,ty){
 const len=Math.hypot(tx-sx,ty-sy),n=Math.min(400,Math.ceil(len/16));if(!n)return null;
 for(let i=1;i<=n;i++){const t=i/n;if(!walkable(tx+(sx-tx)*t,ty+(sy-ty)*t))continue;
  let lo=(i-1)/n,hi=t;for(let k=0;k<8;k++){const m=(lo+hi)/2;if(walkable(tx+(sx-tx)*m,ty+(sy-ty)*m))hi=m;else lo=m;}
  const inland=Math.min(1,hi+6/len),p=[tx+(sx-tx)*inland,ty+(sy-ty)*inland];return walkable(...p)?p:[tx+(sx-tx)*hi,ty+(sy-ty)*hi];}
 return null;
}
function reachToward(sx,sy,tx,ty){
 const len=Math.hypot(tx-sx,ty-sy),n=Math.min(400,Math.floor(len/12));let last=null;
 for(let i=1;i<=n;i++){const p=[sx+(tx-sx)*i/n,sy+(ty-sy)*i/n];if(!clearLine(last||[sx,sy],p))break;last=p;}
 return last&&Math.hypot(last[0]-sx,last[1]-sy)>8?last:null;
}
function rounded(path,sx,sy){
 if(path.length<2)return path;const out=[],last=()=>out.at(-1)||[sx,sy];
 for(let i=0;i<path.length;i++){const p=path[i],prev=i?path[i-1]:[sx,sy],next=path[i+1];if(!next){out.push(p);break;}
  const ax=prev[0]-p[0],ay=prev[1]-p[1],bx=next[0]-p[0],by=next[1]-p[1],la=Math.hypot(ax,ay),lb=Math.hypot(bx,by),r=Math.min(28,la*.4,lb*.4);
  if(r<4||(ax*bx+ay*by)/(la*lb)<-.985){out.push(p);continue;}
  const a=[p[0]+ax/la*r,p[1]+ay/la*r],b=[p[0]+bx/lb*r,p[1]+by/lb*r];
  const curve=[a,...[.25,.5,.75].map(t=>[0,1].map(k=>(1-t)*(1-t)*a[k]+2*(1-t)*t*p[k]+t*t*b[k])),b];
  if(clearLine(last(),a)&&curve.every((q,k)=>!k||clearLine(curve[k-1],q))&&clearLine(b,next))out.push(...curve);else out.push(p);}
 return out;
}

return {walkable,route,nearest,clearLine,homeBuildingRoutes:safeEndpoints,rink:world.iceland2?.rink??null,icePaths:world.iceland2?.rink?world.iceland2.routes??[]:[]};
}
