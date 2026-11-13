import {placeRigid,unplaceRigid,flatRigid} from '../world/rigid.js';
import {placeIslet,unplaceIslet} from '../world/islet-placement.js';
import {isletClearance,isletLocalClearance,ISLETS} from '../world/islets.js';
import {walkNav,isletWalks,inWalkArea} from '../world/islet-walk.js';
import {WORLD_ISLANDS, neighboursOf, offsetOf} from '../world/world-map.js';
import {HOME_MAP, mapOf, mapsVersion, FIELD_RES, FIELD_PAD} from '../world/island-maps.js';

export const ISLANDS = WORLD_ISLANDS.map(({id,name,accent}) => ({id,name,accent}));
const ISLAND_BY_ID = new Map(ISLANDS.map(island => [island.id,island]));
export const islandFor = id => ISLAND_BY_ID.get(id);
export const JETTY = HOME_MAP.JETTY;
export const HARBOR = HOME_MAP.HARBOR;
export const harborOf = id => mapOf(id).HARBOR;
export const jettyOf = id => mapOf(id).JETTY;
export const navOf = (id, base = mapOf(id).nav()) => walkNav(id, base);
export const canWalkTo = (id, x, y) => inWalkArea(mapOf(id), id, x, y);
export const harborWorld = (w, id='home') => ({...w, walkways:[...w.walkways, jettyOf(id).walkway]});
export const harborClear = prop => Math.hypot(prop.x-1726-20,prop.y-830-110) > 200;
export function boardingPoint(boat,nav) {
  const dock=isletWalks(boat.islandId ?? 'home').find(w=>near(boat,w.water,150));
  if(dock)return {...dock.land};
  const map=mapOf(boat.islandId ?? 'home'), {HARBOR:harbor,JETTY:jetty}=map, {foot,dir,length,along}=jetty;
  if (!near(boat,harbor.water,600)) return shoreFor(boat.x,boat.y,nav ?? navOf(boat.islandId ?? 'home')) ?? {x:Math.round(boat.x),y:Math.round(boat.y)};
  const t=Math.max(length*jetty.wetFrom,Math.min(length-44,(boat.x-foot.x)*dir.x+(boat.y-foot.y)*dir.y));
  const side=Math.sign((boat.x-foot.x)*-dir.y+(boat.y-foot.y)*dir.x)*(t >= length-45 ? 0 : 18), p=along(t,side);
  return {x:Math.round(p.x),y:Math.round(p.y)};
}
export const BOAT_RADIUS = 46;
export const SAIL_SPEED = 570;   // 1.5x the old 380
const MARGIN=1800;
const DEST=new Map(), BOUNDS=new Map(), OBSTACLES=new Map(), GRIDS=new Map(),CAP=new Map();
const candidateScratch=[];
let SEEN=-1;
const fresh=() => {if (SEEN !== mapsVersion()) {SEEN=mapsVersion(); for (const cache of [DEST,BOUNDS,OBSTACLES,GRIDS,CAP]) cache.clear();}};
export function originOffset(from,to) {
  const c=offsetOf(from,to), A=mapOf(from), B=mapOf(to);
  return {x:c.x+A.cx-B.cx, y:c.y+A.cy-B.cy};
}
export const destinationsFor = id => {
  fresh();
  if (!DEST.has(id)) {
    const A=mapOf(id);
    DEST.set(id,neighboursOf(id).map(({island,x,y}) => {
      const B=mapOf(island.id), o=originOffset(id,island.id);
      return {x:A.cx+x, y:A.cy+y, offset:o, destination:island.id, name:island.name, accent:island.accent, map:B.id,
        dock:placeRigid(id,island.id,B.HARBOR.water), land:placeRigid(id,island.id,B.HARBOR.land)};
    }));
  }
  return DEST.get(id);
};
export function seaBoundsFor(id='home') {
  fresh();
  if (!BOUNDS.has(id)) {
    const boxes=WORLD_ISLANDS.map(island => {const B=mapOf(island.id),o=originOffset(id,island.id);
      return {x:o.x+B.origin.x,y:o.y+B.origin.y,w:B.width,h:B.height};});
    for(const i of ISLETS){const p=placeIslet(id,i,[0,0]);boxes.push({x:p.x-i.width/2,y:p.y-i.width/2,w:i.width,h:i.width});}
    const margin=Math.max(MARGIN,...boxes.map(o=>Math.max(o.w,o.h)/2));
    BOUNDS.set(id,{x0:Math.min(...boxes.map(o=>o.x))-margin,y0:Math.min(...boxes.map(o=>o.y))-margin-1200,
      x1:Math.max(...boxes.map(o=>o.x+o.w))+margin,y1:Math.max(...boxes.map(o=>o.y+o.h))+margin});
  }
  return BOUNDS.get(id);
}
export const SEA_BOUNDS = seaBoundsFor('home');
export const offshoreProgress = player => player ? Math.max(0,Math.min(1,(660-player.y-450)/850)) : 1;
export const near = (a,b,radius) => Math.hypot(a.x-b.x,a.y-b.y) <= radius;

export const boatSpots=(islandId='home') => mapOf(islandId).boatSpots();
const mooredBoat=(islandId,slot,id=`${islandId}-${slot}`) => {
  const spot=boatSpots(islandId)[slot];
  return {id, islandId, x:spot.x, y:spot.y, turn:spot.turn, occupant:null, departure:islandId};
};
export function createBoats() {
  return ISLANDS.flatMap(island => boatSpots(island.id).map((spot,slot) => mooredBoat(island.id,slot)));
}
const MOORING_IDS = new WeakMap();
function mooringOf(boat) {
  let entry=MOORING_IDS.get(boat);
  if (!entry || entry.id !== boat.id) {
    const base=boat.id.split('~')[0], dash=base.lastIndexOf('-');
    entry={id:boat.id,home:base.slice(0,dash),slot:Number(base.slice(dash+1))};
    entry.key=`${entry.home}|${entry.slot}`;
    MOORING_IDS.set(boat,entry);
  }
  return entry;
}
export const boatHome = boat => mooringOf(boat).home;
export const boatSlot = boat => mooringOf(boat).slot;
export const boatSpot = boat => boatSpots(boatHome(boat))[boatSlot(boat)] ?? boatSpots(boatHome(boat))[0];

export const MOORING_CLEAR=300;
let MINT=Date.now();
function nextBoatId(islandId,slot,ids) {
  const base=`${islandId}-${slot}`;
  let id=base;
  while (ids.has(id)) id=`${base}~${(MINT++).toString(36)}`;
  return id;
}
export function addParkedBoat(boats,islandId,{x,y}) {
  const id=nextBoatId(islandId,0,new Set(boats.map(boat=>boat.id)));
  boats.push({...mooredBoat(islandId,0,id),x,y,parked:true});
}
const atMooring = (boat,spot) => boat.islandId === boatHome(boat) && boat.x === spot.x && boat.y === spot.y;
export function fillMoorings(boats) {
  const SPOTS=new Map(), spotsOf=id => {if (!SPOTS.has(id)) SPOTS.set(id,boatSpots(id)); return SPOTS.get(id);};
  const held=new Set(), ids=new Set(), keep=[];
  const keyOf=boat => mooringOf(boat).key;
  const valid=boat => typeof boat?.id === 'string' && islandFor(boatHome(boat)) && spotsOf(boatHome(boat))[boatSlot(boat)];
  const spotOf=boat => spotsOf(boatHome(boat))[boatSlot(boat)];
  for (const boat of boats) {
    if (!valid(boat) || boat.occupant || ids.has(boat.id) || !atMooring(boat,spotOf(boat)) || held.has(keyOf(boat))) continue;
    held.add(keyOf(boat)); ids.add(boat.id); keep.push(boat);
  }
  for (const boat of boats) {
    if (!valid(boat) || ids.has(boat.id) || (!boat.occupant && boat.parked !== true)) continue;
    if (!islandFor(boat.islandId) || !Number.isFinite(boat.x) || !Number.isFinite(boat.y)) continue;
    if (boat.occupant && boat.islandId === boatHome(boat) && near(boat,spotOf(boat),MOORING_CLEAR)) held.add(keyOf(boat));
    ids.add(boat.id); keep.push(boat);
  }
  let changed=keep.length !== boats.length;
  for (const island of ISLANDS) for (let slot=0,spots=spotsOf(island.id);slot<spots.length;slot++) {
    if (held.has(`${island.id}|${slot}`)) continue;
    const id=nextBoatId(island.id,slot,ids);
    ids.add(id); keep.push({...mooredBoat(island.id,slot,id),spawnedAt:Date.now()}); changed=true;
  }
  if (changed) boats.splice(0,boats.length,...keep);
  return changed;
}
export function retireBoat(boats,boat) {
  const spot=boatSpot(boat), home=boatHome(boat);
  boat.occupant=null; boat.parked=true;
  if (boat.islandId === home && near(boat,spot,MOORING_CLEAR) && !boats.some(other => other !== boat && !other.occupant && boatHome(other) === home && boatSlot(other) === boatSlot(boat) && atMooring(other,spot)))
    Object.assign(boat,{x:spot.x,y:spot.y,turn:spot.turn,departure:home,parked:false});
  if (!canSail(boat.x,boat.y,boat.islandId)) {
    const index=boats.indexOf(boat);
    if (index!==-1) boats.splice(index,1);
  }
  fillMoorings(boats);
}

const shoreFor=(x,y,nav,reach=280) => {const p=nav.nearest(x,y,reach); return p ? {x:Math.round(p[0]),y:Math.round(p[1])} : null;};
export function landingSpot(actor,nav=null,reach=420) {
  let best=null;
  for (const island of WORLD_ISLANDS) {
    const map=mapOf(island.id),p=unplaceRigid(actor.islandId,island.id,actor),lx=p.x,ly=p.y;
    if (lx < map.origin.x-reach || ly < map.origin.y-reach || lx > map.origin.x+map.width+reach || ly > map.origin.y+map.height+reach) continue;
    const shore=shoreFor(lx,ly,island.id===actor.islandId && nav && map.home ? nav : map.nav(),reach);
    if(shore && (!best||Math.hypot(shore.x-lx,shore.y-ly)<best.d)){
      const at=placeRigid(actor.islandId,island.id,shore);
      best={islandId:island.id,offset:{x:at.x-shore.x,y:at.y-shore.y},...shore,d:Math.hypot(shore.x-lx,shore.y-ly)};
    }
  }
  for (const i of ISLETS) {
    const q=unplaceIslet(actor.islandId,i,actor),water=i.jetty.water,c=i.landCentre;
    const cap=Math.max(i.radius,Math.hypot(water[0]-c[0],water[1]-c[1]));
    if(Math.hypot(q.x-c[0],q.y-c[1])-cap>reach)continue;
    const d=Math.min(isletLocalClearance(i,q,reach+1),Math.hypot(q.x-water[0],q.y-water[1]));
    if (d > reach || (best && d >= best.d)) continue;
    const walk=isletWalks(i.home).find(w => w.islet === i), at=placeIslet(actor.islandId,i,i.jetty.land);
    best={islandId:i.home,islet:i.id,offset:{x:at.x-walk.land.x,y:at.y-walk.land.y},x:walk.land.x,y:walk.land.y,d:Math.max(0,d)};
  }
  return best;
}
export function landingApproach(actor,spot) {
  if (spot.islet) {
    const i=ISLETS.find(i=>i.id===spot.islet),p=placeIslet(actor.islandId,i,i.jetty.water);
    const q={x:Math.round(p.x),y:Math.round(p.y)};
    if (canSail(q.x,q.y,actor.islandId) && (near(actor,q,14) || sailRoute(actor.islandId,actor,q))) return q;
  }
  const at=spot.islet?placeIslet(actor.islandId,ISLETS.find(i=>i.id===spot.islet),ISLETS.find(i=>i.id===spot.islet).jetty.land):placeRigid(actor.islandId,spot.islandId,spot);
  const sx=at.x,sy=at.y,len=Math.hypot(actor.x-sx,actor.y-sy)||1;
  for (let t=40;t<len-14;t+=10) {
    const p={x:Math.round(sx+(actor.x-sx)*t/len), y:Math.round(sy+(actor.y-sy)*t/len)};
    if (canSail(p.x,p.y,actor.islandId) && sailRoute(actor.islandId,actor,p)) return p;
  }
  return {x:actor.x,y:actor.y};
}

const obstaclesFor=id => {
  fresh();
  if (!OBSTACLES.has(id)) {
    const b=seaBoundsFor(id);
    OBSTACLES.set(id,WORLD_ISLANDS.filter(island => island.id!==id).map(island => ({...originOffset(id,island.id),id:island.id,map:mapOf(island.id)}))
      .filter(o => o.x+o.map.origin.x+o.map.width+600 > b.x0 && o.x+o.map.origin.x-600 < b.x1 && o.y+o.map.origin.y+o.map.height+600 > b.y0 && o.y+o.map.origin.y-600 < b.y1));
  }
  return OBSTACLES.get(id);
};
export const islandOffset=(from,to) => {const o=obstaclesFor(from).find(o => o.id===to); return o ? {x:o.x,y:o.y} : null;};
function candidates(id,x,y,pad=0){
 fresh();
 const out=candidateScratch;out.length=0;
 let caps=CAP.get(pad);
 if(!caps){caps=WORLD_ISLANDS.map(island=>{const m=mapOf(island.id);return {island,map:m,reach:Math.hypot(m.width,m.height)/2+pad};});CAP.set(pad,caps);}
 for(const c of caps){
  const F=flatRigid(id,c.island.id),ox=x-F.x,oy=y-F.y;
  if(ox*ox+oy*oy>c.reach*c.reach)continue;
  out.push({map:c.map,x:F.cx+F.a*ox+F.b*oy,y:F.cy+F.c*ox+F.d*oy});
 }
 return out;
}
export function canSail(x,y,id='home',radius=BOAT_RADIUS){
 if(!Number.isFinite(x+y))return false;
 const b=seaBoundsFor(id);if(x<b.x0||y<b.y0||x>b.x1||y>b.y1)return false;
 for(const p of candidates(id,x,y,Math.ceil(radius))){
  if(p.map.landAt(p.x,p.y))return false;
  for(let k=0;k<16;k++){const a=k*Math.PI/8;if(p.map.landAt(p.x+Math.cos(a)*radius,p.y+Math.sin(a)*radius))return false;}
 }
 if(isletClearance({x,y},radius,id)<radius)return false;
 return true;
}

export function canDock(actor) {
  const water=harborOf(actor.islandId ?? 'home').water;
  if (!near(actor,water,650)) return false;
  const distance=Math.hypot(actor.x-water.x,actor.y-water.y);
  const steps=Math.max(1,Math.ceil(distance/6));
  for (let i=0;i<=steps;i++) if (!canSail(actor.x+(water.x-actor.x)*i/steps,actor.y+(water.y-actor.y)*i/steps,actor.islandId)) return false;
  return true;
}

const RES=FIELD_RES, PAD=FIELD_PAD;
function clearance(id,x,y) {
  const b=seaBoundsFor(id);
  if (x < b.x0 || y < b.y0 || x > b.x1 || y > b.y1) return 0;
  let best=PAD;
  for(const p of candidates(id,x,y,PAD)){
    const c=Math.round((p.x-p.map.origin.x+PAD)/RES),r=Math.round((p.y-p.map.origin.y+PAD)/RES);
    const cols=Math.ceil((p.map.width+2*PAD)/RES),rows=Math.ceil((p.map.height+2*PAD)/RES);
    if(c<0||r<0||c>=cols||r>=rows)continue;
    const {d,FW}=p.map.field();best=Math.min(best,d[r*FW+c]);
  }
  return Math.max(0,Math.min(best-RES,isletClearance({x,y},PAD,id)));

}
const SAFE=BOAT_RADIUS+30;
const clearLine=(id,a,b) => {
  const len=Math.hypot(b.x-a.x,b.y-a.y), steps=Math.max(1,Math.ceil(len/6));
  for (let i=1;i<=steps;i++) {
    const x=a.x+(b.x-a.x)*i/steps, y=a.y+(b.y-a.y)*i/steps, room=clearance(id,x,y);
    if (room >= SAFE) {i+=Math.max(0,Math.floor((room*.85-SAFE)/6)); continue;}
    for (let k=0;k<3;k++) {
      const f=(i-k/3)/steps;
      const x=a.x+(b.x-a.x)*f,y=a.y+(b.y-a.y)*f;
      const margin=Math.min(4,len*f,len*(1-f));
      if (!canSail(x,y,id) || margin>0 && !canSail(x,y,id,BOAT_RADIUS+margin)) return false;
    }
  }
  return true;
};
const CELL=125;
function gridFor(id) {
  fresh();
  if (!GRIDS.has(id)) {
    const b=seaBoundsFor(id), cols=Math.ceil((b.x1-b.x0)/CELL), rows=Math.ceil((b.y1-b.y0)/CELL), open=new Uint8Array(cols*rows);
    for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) open[r*cols+c]=clearance(id,b.x0+(c+.5)*CELL,b.y0+(r+.5)*CELL)*.9 >= CELL*.71+SAFE ? 1 : 0;
    const labels=new Int32Array(open.length);let label=0,largest=[];
    for(let start=0;start<open.length;start++)if(open[start]&&!labels[start]){
      const queue=[start];labels[start]=++label;
      for(let k=0;k<queue.length;k++){
        const i=queue[k],r=Math.floor(i/cols),c=i%cols;
        for(const [dr,dc]of [[0,1],[0,-1],[1,0],[-1,0]]){const nr=r+dr,nc=c+dc,j=nr*cols+nc;if(nr>=0&&nc>=0&&nr<rows&&nc<cols&&open[j]&&!labels[j]){labels[j]=label;queue.push(j);}}
      }
      if(queue.length>largest.length)largest=queue;
    }
    const ocean=new Uint8Array(open.length);for(const k of largest)ocean[k]=1;
    GRIDS.set(id,{b,cols,rows,open:ocean});
  }
  return GRIDS.get(id);
}
export function sailRoute(id,from,to) {
  if (clearLine(id,from,to)) return [to];
  const {b,cols,rows,open}=gridFor(id), centre=i => ({x:b.x0+(i%cols+.5)*CELL,y:b.y0+(Math.floor(i/cols)+.5)*CELL});
  const nearestOpen=p => {
    const c0=Math.floor((p.x-b.x0)/CELL), r0=Math.floor((p.y-b.y0)/CELL);
    for (let d=0;d<14;d++) for (let r=r0-d;r<=r0+d;r++) for (let c=c0-d;c<=c0+d;c++) {
      if (r<0||c<0||r>=rows||c>=cols||!open[r*cols+c]) continue;
      if (clearLine(id,p,centre(r*cols+c))) return r*cols+c;
    }
    return -1;
  };
  const connect=(p,step=60,limit=60)=>{
    const direct=nearestOpen(p);if(direct>=0)return {index:direct,points:[centre(direct)]};
    const side=limit*2+1,total=side*side,start=limit*side+limit;
    const prev=new Int32Array(total).fill(-1),queue=[start];prev[start]=start;
    const point=i=>({x:p.x+(i%side-limit)*step,y:p.y+(Math.floor(i/side)-limit)*step});
    for(let k=0;k<queue.length;k++){
      const i=queue[k],at=point(i),c=Math.floor((at.x-b.x0)/CELL),r=Math.floor((at.y-b.y0)/CELL),cell=r*cols+c;
      if(c>=0&&r>=0&&c<cols&&r<rows&&open[cell]&&clearLine(id,at,centre(cell))){
        const points=[centre(cell)];for(let j=i;j!==start;j=prev[j])points.push(point(j));points.reverse();return {index:cell,points};
      }
      const row=Math.floor(i/side),col=i%side;
      for(const [dr,dc]of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[-1,1],[1,-1],[-1,-1]]){
        const nr=row+dr,nc=col+dc,j=nr*side+nc;if(nr<0||nc<0||nr>=side||nc>=side||prev[j]>=0)continue;
        const q=point(j);if(canSail(q.x,q.y,id)&&clearLine(id,at,q)){prev[j]=i;queue.push(j);}
      }
    }
    return null;
  };
  const reach=p=>connect(p)??connect(p,20,180);
  const entrance=reach(from),exit=entrance&&reach(to);if(!entrance||!exit)return null;
  const start=entrance.index,goal=exit.index;
  const prev=new Int32Array(cols*rows).fill(-1), queue=[start]; prev[start]=start;
  for (let q=0;q<queue.length && prev[goal]<0;q++) {
    const i=queue[q], c=i%cols, r=Math.floor(i/cols);
    for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) {
      const nr=r+dr, nc=c+dc, n=nr*cols+nc;
      if ((dr||dc) && nr>=0 && nc>=0 && nr<rows && nc<cols && open[n] && prev[n]<0 && (!dr||!dc||open[r*cols+nc]&&open[nr*cols+c])) {prev[n]=i; queue.push(n);}
    }
  }
  if(prev[goal]<0)return null;
  const cells=[];
  for (let i=goal;i!==start;i=prev[i]) cells.push(centre(i));
  cells.push(centre(start));cells.reverse();cells.unshift(...entrance.points.slice(0,-1));cells.push(...exit.points.slice(0,-1).reverse(),to);
  const route=[]; let at=from;
  for (let k=0;k<cells.length;) {
    if(!clearLine(id,at,cells[k]))return null;
    let j=k,step=1,blocked=cells.length;
    while(j+step<cells.length){const next=j+step;if(!clearLine(id,at,cells[next])){blocked=next;break;}j=next;step*=2;}
    let lo=j+1,hi=Math.min(cells.length-1,blocked-1);
    while(lo<=hi){const mid=(lo+hi)>>1;if(clearLine(id,at,cells[mid])){j=mid;lo=mid+1;}else hi=mid-1;}
    route.push(cells[j]); at=cells[j]; k=j+1;
  }
  return route;
}

export function setSailDestination(actor,x,y) {
  if (!canSail(x,y,actor.islandId)) return null;
  const route=sailRoute(actor.islandId,actor,{x,y});
  if (!route) return null;
  actor.sailTarget=route[0];
  actor.sailRoute=route.slice(1);
  actor.docking=false;
  return [x,y];
}

export function sailStep(actor,dt,input) {
  const manual=Boolean(input.x || input.y);
  if (manual) {actor.sailTarget=null; actor.sailRoute=null; actor.docking=false;}
  const target=actor.sailTarget;
  const dx=manual?input.x:target?target.x-actor.x:0, dy=manual?input.y:target?target.y-actor.y:0;
  const distance=Math.hypot(dx,dy);
  const travel=manual?SAIL_SPEED*dt:Math.min(SAIL_SPEED*dt,distance);
  const ox=actor.x, oy=actor.y;
  if (distance) {
    const steps=Math.ceil(travel/6);
    for (let i=0;i<steps;i++) {
      const x=actor.x+dx/distance*travel/steps, y=actor.y+dy/distance*travel/steps;
      if (!canSail(x,y,actor.islandId)) {actor.sailTarget=null; actor.sailRoute=null; actor.docking=false; break;}
      actor.x=x; actor.y=y;
    }
    actor.turn=Math.atan2(dx,dy);
    if (target && near(actor,target,1)) actor.sailTarget=actor.sailRoute?.shift() ?? null;
  }
  actor.travel=Math.hypot(actor.x-ox,actor.y-oy)/dt;
  actor.action=0;
  return actor.travel>0;
}

export function crossIsland(actor,allow=() => true) {
  if (actor.mode !== 'sailing') return false;
  const destination=destinationsFor(actor.islandId).find(island =>
    Math.abs(actor.x-island.dock.x)<=65 && Math.abs(actor.y-island.dock.y)<=50 &&
    (!actor.sailTarget || (Math.abs(actor.sailTarget.x-island.dock.x)<=65 && Math.abs(actor.sailTarget.y-island.dock.y)<=50)));
  if (!destination || !allow(destination.destination)) return false;
  Object.assign(actor,{islandId:destination.destination,...harborOf(destination.destination).water,turn:Math.PI,travel:0,path:[],sailTarget:null,sailRoute:null,docking:true,exitLocked:false});
  return true;
}
