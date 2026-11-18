// Public polygons remain ordinary arrays on access. Their immutable backing
// coordinates are shared with the contour indexes rather than copied per edge.
const coordinateBuffer=Symbol('contour coordinates');
const sourceBuffers=new WeakMap(),compactShapes=new WeakSet();
const hasPolygon=shape=>compactShapes.has(shape)||Boolean(shape.poly);
function coordinates(poly){
 let coords=sourceBuffers.get(poly);
 if(!coords){coords=Float64Array.from(poly.flat());sourceBuffers.set(poly,coords);}
 return coords;
}
export function compactContours(shape,source=null,project=null){
 if(!shape)return shape;
 compactShapes.add(shape);
 for(const key of ['poly','parts']){
  if(!shape[key])continue;
  const rings=(source?(key==='poly'?[source[0]]:source.slice(1)):(key==='poly'?[shape[key]]:shape[key])).map(coordinates);
  Object.defineProperty(shape,key,{enumerable:true,configurable:true,get(){
   const arrays=rings.map(sourceCoords=>{
    const coords=project?new Float64Array(sourceCoords.length):sourceCoords;
    const poly=Array.from({length:coords.length/2},(_,i)=>{
     const point=project?project(sourceCoords[i*2],sourceCoords[i*2+1]):[coords[i*2],coords[i*2+1]];
     if(project){coords[i*2]=point[0];coords[i*2+1]=point[1];}return point;
    });
    Object.defineProperty(poly,coordinateBuffer,{value:coords});return poly;
   });
   return key==='poly'?arrays[0]:arrays;
  }});
 }
 return shape;
}
// Contour work is synchronous. A small shared LRU serves all islands and lets
// grid construction release source endpoint/index objects as it advances.
const contourCache=new Map();
function cachedContours(shape,build,kind=0){
 if(contourCache.has(shape)){const entry=contourCache.get(shape);if(entry.kind===kind){contourCache.delete(shape);contourCache.set(shape,entry);return entry.value;}}
 const value=build();contourCache.set(shape,{kind,value});
 if(contourCache.size>128)contourCache.delete(contourCache.keys().next().value);
 return value;
}
export function inPoly(x,y,p){let inside=false;for(let i=0,j=p.length-1;i<p.length;j=i++){if((p[i][1]>y)!=(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])inside=!inside;}return inside;}
function edgeDist(x,y,p){let d=Infinity;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[j],b=p[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));d=Math.min(d,Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t));}return d;}
function nearEdge(x,y,p,pad){for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[j],b=p[i];
 if(x<Math.min(a[0],b[0])-pad||x>Math.max(a[0],b[0])+pad||y<Math.min(a[1],b[1])-pad||y>Math.max(a[1],b[1])+pad)continue;
 const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));if(Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t)<pad)return true;}return false;}
// Body masks have exact, unsimplified pixel edges and zero clearance. Index
// their edges by row so the first navigation grid does not scan every stair-step
// vertex at every cell (which can consume a fresh manual input's expiry window).

function inBodyMask(x,y,o){
 const rows=cachedContours(o,()=>[o.poly,...(o.parts??[])].map(poly=>polygonIndex(poly)),1);
 return rows.some(contains=>contains(x,y));
}
export const inShape=(x,y,o,pad=0)=>o.bodyBlock&&pad===0?inBodyMask(x,y,o):o.parts ? [o.poly,...o.parts].some(poly=>inShape(x,y,{poly},pad)) : o.poly?(pad<0?inPoly(x,y,o.poly)&&edgeDist(x,y,o.poly)>-pad:inPoly(x,y,o.poly)||pad>0&&nearEdge(x,y,o.poly,pad)):((x-o.x)/(o.rx+pad))**2+((y-o.y)/(o.ry+pad))**2<1;
export function shapeIndex(list,pad,CELL=256){
 const cells=new Map(),key=(c,r)=>c*65536+r;
 for(const o of list){
  const margin = o.clearance ?? pad;
  let x0,y0,x1,y1;
  if(o.poly){x0=Infinity;y0=Infinity;x1=-Infinity;y1=-Infinity;for(const [px,py] of [o.poly,...(o.parts??[])].flat()){if(px<x0)x0=px;if(px>x1)x1=px;if(py<y0)y0=py;if(py>y1)y1=py;}}
  else{x0=o.x-o.rx;x1=o.x+o.rx;y0=o.y-o.ry;y1=o.y+o.ry;}
  x0-=margin+1;y0-=margin+1;x1+=margin+1;y1+=margin+1;
  for(let c=Math.floor(x0/CELL);c<=Math.floor(x1/CELL);c++)for(let r=Math.floor(y0/CELL);r<=Math.floor(y1/CELL);r++){const k=key(c,r);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(o);}
 }
 const none=[];
 return (x,y)=>cells.get(key(Math.floor(x/CELL),Math.floor(y/CELL)))??none;
}
// A row holds edge offsets into one full-precision coordinate buffer. Keeping
// edge objects and their endpoint arrays here used more memory than the maps.
function contourEdges(poly,cellSize,pad=0){
 const coords=poly[coordinateBuffer]??Float64Array.from(poly.flat()),buckets=new Map();
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const ay=coords[2*i+1],by=coords[2*j+1];
  if(!pad&&ay===by)continue;
  for(let r=Math.floor((Math.min(ay,by)-pad)/cellSize);r<=Math.floor((Math.max(ay,by)+pad)/cellSize);r++){
   if(!buckets.has(r))buckets.set(r,[]);buckets.get(r).push(i);
  }
 }
 const rows=new Map([...buckets].map(([r,edges])=>[r,Uint32Array.from(edges)]));
 return {coords,rows};
}
export function polygonIndex(poly,cellSize=64){
 const {coords,rows}=contourEdges(poly,cellSize),length=poly.length;
 return (x,y)=>{
  const edges=rows.get(Math.floor(y/cellSize));if(!edges)return false;
  let inside=false;
  for(const i of edges){const j=i?i-1:length-1,ax=coords[2*i],ay=coords[2*i+1],bx=coords[2*j],by=coords[2*j+1];
   if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
  }
  return inside;
 };
}
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
 // Compile outlined islands' static prop and water contours once. Row-local
 // containment and clearance queries preserve the original point tests.
 // Each 8-unit cell is certified with its circumscribed circle. Cells touching
 // a contour use the exact point test; the cache never rounds a blocked edge.
 const CELL=8,RADIUS=Math.SQRT2*CELL/2+1e-7;
 function partsOf(o){
  return cachedContours(o,()=>{
   const reach=Math.max(20,o.clearance??16)+RADIUS;
   return [o.poly,...(o.parts??[])].map(poly=>({contains:polygonIndex(poly,8),rows:contourEdges(poly,64,reach)}));
  });
 }
 function edgeNear(x,y,{coords,rows},pad){
  const length=coords.length/2;
  for(const i of rows.get(Math.floor(y/64))??[]){
   const j=i?i-1:length-1,ax=coords[2*j],ay=coords[2*j+1],bx=coords[2*i],by=coords[2*i+1];
   if(x<Math.min(ax,bx)-pad||x>Math.max(ax,bx)+pad)continue;
   const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));
   if(Math.hypot(x-ax-dx*t,y-ay-dy*t)<pad)return true;
  }
  return false;
 }
 function solidAt(x,y,o,pad=o.clearance??16){
  if(!hasPolygon(o)||pad<0||o.bodyBlock&&pad===0)return inShape(x,y,o,pad);
  return partsOf(o).some(({contains,rows})=>contains(x,y)||pad>0&&edgeNear(x,y,rows,pad));
 }
 function staticLookup(list,defaultPad,near,respectClearance=true){
  const padding=o=>respectClearance?(o.clearance??defaultPad):defaultPad;
  let solidGrid;
  return (x,y)=>{
  if(!solidGrid){
   const x0=Math.floor((world.origin?.x??0)/CELL),y0=Math.floor((world.origin?.y??0)/CELL);
   const cols=Math.ceil(world.width/CELL)+1,rows=Math.ceil(world.height/CELL)+1,cells=new Uint8Array(Math.ceil(cols*rows/4));
   for(const o of list){
    const pad=padding(o),hasPoly=hasPolygon(o),parts=hasPoly&&pad>=0?partsOf(o):null;
    // Unusual negative clearances keep the exact fallback throughout their box.
    const points=hasPoly?[o.poly,...(o.parts??[])].flat():[[o.x-o.rx,o.y-o.ry],[o.x+o.rx,o.y+o.ry]];
    let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
    for(const [px,py] of points){left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py);}
    const margin=Math.max(0,pad)+1;
    for(let r=Math.max(0,Math.floor((top-margin)/CELL)-y0);r<=Math.min(rows-1,Math.floor((bottom+margin)/CELL)-y0);r++)
     for(let c=Math.max(0,Math.floor((left-margin)/CELL)-x0);c<=Math.min(cols-1,Math.floor((right+margin)/CELL)-x0);c++){
      const i=r*cols+c;if((cells[i>>2]>>((i&3)*2)&3)===1)continue;
      const cx=(x0+c+.5)*CELL,cy=(y0+r+.5)*CELL;
      let state=0;
      if(pad<0)state=2;
      else if(hasPoly){
       for(const {contains,rows:edges} of parts){
        const inside=contains(cx,cy);
        const full=inside?(pad>=RADIUS||!edgeNear(cx,cy,edges,RADIUS-pad)):pad>RADIUS&&edgeNear(cx,cy,edges,pad-RADIUS);
        if(full){state=1;break;}
        if(inside||edgeNear(cx,cy,edges,pad+RADIUS))state=2;
       }
      }else{
       const rx=o.rx+pad,ry=o.ry+pad;
       const far=((Math.abs(cx-o.x)+CELL/2)/rx)**2+((Math.abs(cy-o.y)+CELL/2)/ry)**2;
       const close=(Math.max(0,Math.abs(cx-o.x)-CELL/2)/rx)**2+(Math.max(0,Math.abs(cy-o.y)-CELL/2)/ry)**2;
       state=far<1?1:close<=1?2:0;
      }
      if(state){const shift=(i&3)*2;cells[i>>2]=(cells[i>>2]&~(3<<shift))|(state<<shift);}
     }
   }
   solidGrid={x0,y0,cols,rows,cells};
  }
  const {x0,y0,cols,rows,cells}=solidGrid,c=Math.floor(x/CELL)-x0,r=Math.floor(y/CELL)-y0;
  if(c<0||r<0||c>=cols||r>=rows)return near(x,y).some(o=>solidAt(x,y,o,padding(o)));
  const i=r*cols+c,state=cells[i>>2]>>((i&3)*2)&3;
  return state===1||state===2&&near(x,y).some(o=>solidAt(x,y,o,padding(o)));
  };
 }
 let waterAt=null,solidAtPoint=null;
 let waterNear=null,solidNear=null,bridgeNear=null,coastAt=null,coastContains=null,walkwayNear=null,landsAt=null;
 function boardAt(x,y){
  if(!world.walkways)return Math.abs(x-world.boardwalk.x)<world.boardwalk.w/2-12&&Math.abs(y-world.boardwalk.y)<world.boardwalk.h/2+25;
  // Pagepond's and Campfire's fine fallback grids sample a large sea box. Reject distant
  // decks by their bounds before doing segment projections at every sea cell.
  if(world.indexPropContours)walkwayNear??=shapeIndex(world.walkways.map(b=>{
   const pad=Math.max(0,b.w/2-10);
   return {...b,clearance:0,poly:[[Math.min(b.a[0],b.b[0])-pad,Math.min(b.a[1],b.b[1])-pad],[Math.max(b.a[0],b.b[0])+pad,Math.max(b.a[1],b.b[1])+pad]]};
  }),0);
  return (walkwayNear?walkwayNear(x,y):world.walkways).some(b=>{const dx=b.b[0]-b.a[0],dy=b.b[1]-b.a[1],t=Math.max(0,Math.min(1,((x-b.a[0])*dx+(y-b.a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-b.a[0]-dx*t,y-b.a[1]-dy*t)<b.w/2-10;});
 }
 function walkable(x,y){if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  coastAt??=coastIndex(world.coast);
  const side=coastAt(x,y);
  if(world.indexPropContours)coastContains??=polygonIndex(world.coast,8);
  if(!(side===2?(coastContains?coastContains(x,y):inPoly(x,y,world.coast)):side===1)){
   const board=boardAt(x,y);
   const isle=world.islets.some(a=>((x-a[0])/(a[2]-20))**2+((y-a[1])/(a[3]-20))**2<1);
   // extra walkable ground outside the coastline (the sled hill island's plaza)
   landsAt??=(world.lands??[]).map(poly=>polygonIndex(poly,16));
   if(!board&&!isle&&!landsAt.some(contains=>contains(x,y)))return false;
  }
  bridgeNear??=shapeIndex(world.bridges.map(b=>({...b,rx:Math.max(0,b.w/2-8),ry:Math.max(0,b.h/2-12)})),0);
  const bridge=bridgeNear(x,y).some(b=>b.poly?inShape(x,y,b,-8):Math.abs(x-b.x)<b.w/2-8&&Math.abs(y-b.y)<b.h/2-12);
  waterNear??=shapeIndex(world.water,20);solidNear??=shapeIndex(world.obstacles,16,world.indexPropContours?64:256);
  if(world.indexPropContours){
   waterAt??=staticLookup(world.water,20,waterNear,false);
   solidAtPoint??=staticLookup(world.obstacles,16,solidNear);
   return (bridge||!waterAt(x,y))&&!solidAtPoint(x,y);
  }
  return (bridge||!waterNear(x,y).some(o=>inShape(x,y,o,20)))&&!solidNear(x,y).some(o=>inShape(x,y,o,o.clearance??16));
 }
 return {walkable,inPoly:(x,y,p=world.coast)=>inPoly(x,y,p),ellipse};
}
