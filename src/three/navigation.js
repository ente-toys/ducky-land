import {geometry} from '../../rive/web/island-geometry.mjs';
export function createNavigation(world){
const {walkable}=geometry(world);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const CELL=32,COLS=Math.ceil(world.width/CELL),ROWS=Math.ceil(world.height/CELL);
const grid=new Uint8Array(COLS*ROWS);
for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)grid[y*COLS+x]=walkable((x+.5)*CELL,(y+.5)*CELL)?1:0;
function point(id){return [(id%COLS+.5)*CELL,(Math.floor(id/COLS)+.5)*CELL];}
function cell(x,y){return Math.floor(y/CELL)*COLS+Math.floor(x/CELL);}
function nearest(x,y,radius=150){
 if(walkable(x,y))return [x,y];
 for(let r=16;r<=radius;r+=16)for(let a=0;a<24;a++){let xx=x+Math.cos(a*Math.PI/12)*r,yy=y+Math.sin(a*Math.PI/12)*r;if(walkable(xx,yy))return [xx,yy];}
 return null;
}
function clearLine(a,b){let n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/3);for(let i=1;i<=n;i++)if(!walkable(a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n))return false;return true;}
function route(sx,sy,tx,ty){
 const target=nearest(tx,ty);if(!target)return [];
 if(clearLine([sx,sy],target))return [target];
 function nearCell(x,y){const c=cell(x,y);if(grid[c])return c;for(let r=1;r<6;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){let xx=Math.floor(x/CELL)+dx,yy=Math.floor(y/CELL)+dy,id=yy*COLS+xx;if(xx>=0&&xx<COLS&&yy>=0&&yy<ROWS&&grid[id]&&clearLine([x,y],point(id)))return id;}return -1;}
 const start=nearCell(sx,sy),end=nearCell(...target);if(start<0||end<0)return [];
 const cost=new Float32Array(grid.length).fill(Infinity),parent=new Int32Array(grid.length).fill(-1),closed=new Uint8Array(grid.length),heap=[];
 const heuristic=id=>{const a=point(id),b=point(end);return Math.hypot(a[0]-b[0],a[1]-b[1])/CELL;};
 function push(id,f){let i=heap.length;heap.push({id,f});while(i){let p=(i-1)>>1;if(heap[p].f<=f)break;heap[i]=heap[p];i=p;}heap[i]={id,f};}
 function pop(){let top=heap[0],end=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=end.f)break;heap[i]=heap[c];i=c;}heap[i]=end;}return top.id;}
 cost[start]=0;push(start,heuristic(start));let found=false;
 while(heap.length){let cur=pop();if(closed[cur])continue;closed[cur]=1;if(cur===end){found=true;break;}
 const x=cur%COLS,y=Math.floor(cur/COLS);
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;let xx=x+dx,yy=y+dy,n=yy*COLS+xx;if(xx<0||yy<0||xx>=COLS||yy>=ROWS||!grid[n]||closed[n])continue;if(dx&&dy&&(!grid[y*COLS+xx]||!grid[yy*COLS+x]))continue;const nc=cost[cur]+(dx&&dy?Math.SQRT2:1);if(!clearLine(point(cur),point(n)))continue;if(nc<cost[n]){cost[n]=nc;parent[n]=cur;push(n,nc+heuristic(n));}}}
 if(!found)return [];
 const raw=[];for(let n=end;n!==start;n=parent[n])raw.push(point(n));raw.reverse();raw.push(target);
 let out=[],anchor=[sx,sy];for(let i=0;i<raw.length;){let j=i;while(j+1<raw.length&&clearLine(anchor,raw[j+1]))j++;out.push(raw[j]);anchor=raw[j];i=j+1;}return out;
}

return {walkable,route,nearest,clearLine};
}
