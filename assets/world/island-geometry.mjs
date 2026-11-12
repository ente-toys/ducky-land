// Same island geometry used for the world host and socket authority.
// boss 4 Nov: a water or obstacle entry may carry `poly` (a traced outline) in place of its oval. Only the client's local world
// sets it; world.json has none, so the socket server walks exactly as before.
export function inPoly(x,y,p){let inside=false;for(let i=0,j=p.length-1;i<p.length;j=i++){if((p[i][1]>y)!=(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])inside=!inside;}return inside;}
function edgeDist(x,y,p){let d=Infinity;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[j],b=p[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));d=Math.min(d,Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t));}return d;}
// is any edge of p closer than pad to (x,y)? The same answer as edgeDist(x,y,p)<pad, but an edge whose box is farther than
// pad away is skipped without the square root, and the first close edge ends the search (boss 6 Nov: 100 Duckies)
function nearEdge(x,y,p,pad){for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[j],b=p[i];
 if(x<Math.min(a[0],b[0])-pad||x>Math.max(a[0],b[0])+pad||y<Math.min(a[1],b[1])-pad||y>Math.max(a[1],b[1])+pad)continue;
 const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));if(Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t)<pad)return true;}return false;}
export const inShape=(x,y,o,pad=0)=>o.poly?(pad<0?inPoly(x,y,o.poly)&&edgeDist(x,y,o.poly)>-pad:inPoly(x,y,o.poly)||pad>0&&nearEdge(x,y,o.poly,pad)):((x-o.x)/(o.rx+pad))**2+((y-o.y)/(o.ry+pad))**2<1;
// boss 6 Nov (100 Duckies on one island): a coarse grid of which water and obstacle shapes could touch each spot, so a walk
// test only tries the few shapes near it instead of every traced outline on a big island. Exactly the same answers: a shape
// is listed in every cell its padded box reaches. Built on first use (the shape lists are fixed by then).
export function shapeIndex(list,pad,CELL=256){
 const cells=new Map(),key=(c,r)=>c*65536+r;
 for(const o of list){
  let x0,y0,x1,y1;
  if(o.poly){x0=Infinity;y0=Infinity;x1=-Infinity;y1=-Infinity;for(const [px,py] of o.poly){if(px<x0)x0=px;if(px>x1)x1=px;if(py<y0)y0=py;if(py>y1)y1=py;}}
  else{x0=o.x-o.rx;x1=o.x+o.rx;y0=o.y-o.ry;y1=o.y+o.ry;}
  x0-=pad+1;y0-=pad+1;x1+=pad+1;y1+=pad+1;
  for(let c=Math.floor(x0/CELL);c<=Math.floor(x1/CELL);c++)for(let r=Math.floor(y0/CELL);r<=Math.floor(y1/CELL);r++){const k=key(c,r);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(o);}
 }
 const none=[];
 return (x,y)=>cells.get(key(Math.floor(x/CELL),Math.floor(y/CELL)))??none;
}
// An exact horizontal ray only crosses edges that span the query's Y band.
// Keep the original crossing rule, including the half-open vertex boundary.
export function polygonIndex(poly,cellSize=64){
 const rows=new Map();
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];
  if(a[1]===b[1])continue;
  const edge=[a,b];
  const first=Math.floor(Math.min(a[1],b[1])/cellSize),last=Math.floor(Math.max(a[1],b[1])/cellSize);
  for(let row=first;row<=last;row++){
   if(!rows.has(row))rows.set(row,[]);
   rows.get(row).push(edge);
  }
 }
 return (x,y)=>{
  const edges=rows.get(Math.floor(y/cellSize));
  if(!edges)return false;
  let inside=false;
  for(const [a,b] of edges){
   if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
 };
}
// boss 6 Nov (100 Duckies on a big island): which side of the coast each 64-unit cell is on. A cell no coast edge comes near
// is wholly inside or wholly outside, so only cells the coastline crosses still need the full point-in-polygon test. Exact:
// every edge is sampled every 16 units and each sample marks its cell and the eight round it.
export function coastIndex(coast,CELL=64){
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
 for(const [px,py] of coast){if(px<x0)x0=px;if(px>x1)x1=px;if(py<y0)y0=py;if(py>y1)y1=py;}
 x0-=CELL;y0-=CELL;const cols=Math.ceil((x1+CELL-x0)/CELL)+1,rows=Math.ceil((y1+CELL-y0)/CELL)+1,cls=new Uint8Array(cols*rows);
 for(let i=0;i<coast.length;i++){const a=coast[i],b=coast[(i+1)%coast.length],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/16));
  for(let k=0;k<=n;k++){const c=Math.floor((a[0]+(b[0]-a[0])*k/n-x0)/CELL),r=Math.floor((a[1]+(b[1]-a[1])*k/n-y0)/CELL);
   for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){const cc=c+dc,rr=r+dr;if(cc>=0&&rr>=0&&cc<cols&&rr<rows)cls[rr*cols+cc]=2;}}}
 const contains=polygonIndex(coast,CELL);
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const i=r*cols+c;if(!cls[i])cls[i]=contains(x0+(c+.5)*CELL,y0+(r+.5)*CELL)?1:3;}
 return (x,y)=>{const c=Math.floor((x-x0)/CELL),r=Math.floor((y-y0)/CELL);if(c<0||r<0||c>=cols||r>=rows)return 0;const v=cls[r*cols+c];return v===3?0:v;};
}
export function geometry(world){
 const ellipse=(x,y,o,pad=0)=>((x-o.x)/(o.rx+pad))**2+((y-o.y)/(o.ry+pad))**2<1;
 let waterNear=null,solidNear=null,bridgeNear=null,coastAt=null;
 function walkable(x,y){if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  coastAt??=coastIndex(world.coast);
  const side=coastAt(x,y);
  if(!(side===2?inPoly(x,y,world.coast):side===1)){   // off the island: only a deck, the boardwalk or an islet holds you
   const board=world.walkways?world.walkways.some(b=>{const dx=b.b[0]-b.a[0],dy=b.b[1]-b.a[1],t=Math.max(0,Math.min(1,((x-b.a[0])*dx+(y-b.a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-b.a[0]-dx*t,y-b.a[1]-dy*t)<b.w/2-10;}):Math.abs(x-world.boardwalk.x)<world.boardwalk.w/2-12&&Math.abs(y-world.boardwalk.y)<world.boardwalk.h/2+25;
   const isle=world.islets.some(a=>((x-a[0])/(a[2]-20))**2+((y-a[1])/(a[3]-20))**2<1);
   if(!board&&!isle)return false;
  }
  // Community maps can have hundreds of crossing rectangles. Index their exact
  // walking bounds too, so every route sample only checks nearby bridges.
  bridgeNear??=shapeIndex(world.bridges.map(b=>({...b,rx:Math.max(0,b.w/2-8),ry:Math.max(0,b.h/2-12)})),0);
  const bridge=bridgeNear(x,y).some(b=>b.poly?inShape(x,y,b,-8):Math.abs(x-b.x)<b.w/2-8&&Math.abs(y-b.y)<b.h/2-12);
  waterNear??=shapeIndex(world.water,20);solidNear??=shapeIndex(world.obstacles,16);
  return (bridge||!waterNear(x,y).some(o=>inShape(x,y,o,20)))&&!solidNear(x,y).some(o=>inShape(x,y,o,16));
 }
 return {walkable,inPoly:(x,y,p=world.coast)=>inPoly(x,y,p),ellipse};
}
