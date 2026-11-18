import {finishWork} from './work-steps.js';
import {BOAT_GAP,boatSeparated,nearestBoatSpace,boatSpaceCandidates} from './boat-spacing.js';
export {BOAT_GAP} from './boat-spacing.js';
import {SEA_WIDTH,SEA_HEIGHT,SEA_VERSION,FLAT_RADIUS,FLAT_RING,FLAT_POSITIONS,FLAT_ISLETS,GLOBE_ISLET_OFFSETS,nearestSeaX,wrapSea} from '../world/flat-layout.js';
import {placeRigid,unplaceRigid,flatRigid} from '../world/rigid.js';
import {SAIL_EMOTES} from './player-motion.js';
import {placeIslet,unplaceIslet} from '../world/islet-placement.js';
import {isletClearance,ISLETS} from '../world/islets.js';
import {walkNav,isletWalks,inWalkArea} from '../world/islet-walk.js';
import {WORLD_ISLANDS, neighboursOf, offsetOf} from '../world/world-map.js';
import {HOME_MAP, mapOf, mapsVersion, islandMapReady, FIELD_RES, FIELD_PAD, PORT_CLEAR} from '../world/island-maps.js';

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
  if (boat.landing && (nav ?? navOf(boat.islandId)).walkable(boat.landing.x,boat.landing.y)) return {...boat.landing};
  const dock=isletWalks(boat.islandId ?? 'home').find(w=>near(boat,w.water,150));
  if(dock)return {...dock.land};
  const map=mapOf(boat.islandId ?? 'home'), {HARBOR:harbor,JETTY:jetty}=map, {foot,dir,length,along}=jetty;
  if (!near(boat,harbor.water,600)) return shoreFor(boat.x,boat.y,nav ?? navOf(boat.islandId ?? 'home'),320,map) ?? {x:Math.round(boat.x),y:Math.round(boat.y)};
  const t=Math.max(length*jetty.wetFrom,Math.min(length-44,(boat.x-foot.x)*dir.x+(boat.y-foot.y)*dir.y));
  const side=Math.sign((boat.x-foot.x)*-dir.y+(boat.y-foot.y)*dir.x)*(t >= length-45 ? 0 : 18), p=along(t,side);
  return {x:Math.round(p.x),y:Math.round(p.y)};
}
export const BOAT_RADIUS = 46;
export const SAIL_SPEED = 570;   // 1.5x the old 380
const DEST=new Map(), BOUNDS=new Map(), GRIDS=new Map(),GRID_BUILDERS=new Map(),CAP=new Map();
const candidateScratch=[];
let SEEN=-1;
const fresh=() => {if (SEEN !== mapsVersion()) {SEEN=mapsVersion(); for (const cache of [DEST,BOUNDS,GRIDS,GRID_BUILDERS,CAP]) cache.clear();}};
export function originOffset(from,to) {
  const c=offsetOf(from,to), A=mapOf(from), B=mapOf(to);
  return {x:c.x+A.cx-B.cx, y:c.y+A.cy-B.cy};
}
export const destinationsFor = id => {
  fresh();
  if (!DEST.has(id)) {
    const A=mapOf(id);
    DEST.set(id,neighboursOf(id).map(({island,x,y}) => {
      const B=mapOf(island.id), o={x:x+A.cx-B.cx,y:y+A.cy-B.cy};
      return {x:A.cx+x, y:A.cy+y, offset:o, destination:island.id, name:island.name, accent:island.accent, map:B.id,
        dock:placeRigid(id,island.id,B.HARBOR.water,{x:A.cx}), land:placeRigid(id,island.id,B.HARBOR.land,{x:A.cx})};
    }));
  }
  return DEST.get(id);
};
export function seaBoundsFor(id='home') {
  fresh();
  if (!BOUNDS.has(id)) {
    const m=mapOf(id),c=FLAT_POSITIONS[id];
    // Extra polar coast room preserves existing harbours, moorings and walking.
    BOUNDS.set(id,{x0:m.cx-SEA_WIDTH/2-20000,x1:m.cx+SEA_WIDTH/2+20000,
      y0:m.cy-c.y-SEA_HEIGHT/2-7000,y1:m.cy-c.y+SEA_HEIGHT/2+7000});
  }
  return BOUNDS.get(id);
}
export const SEA_BOUNDS = seaBoundsFor('home');
export const offshoreProgress = player => player ? Math.max(0,Math.min(1,(660-player.y-450)/850)) : 1;
export const near = (a,b,radius) => Math.hypot(wrapSea(a.x-b.x),a.y-b.y) <= radius;

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

const seaBoatSeparated=(a,b,gap)=>boatSeparated({...a,x:nearestSeaX(a.x,b.x)},b,gap);

// Compare in the actor's island frame, including boats sailing in a neighbour's frame.
const otherBoatPositions = (actor,boats) => boats.filter(b=>b.id!==(actor.boatId??actor.id))
  .map(b=>{const p=b.islandId===actor.islandId?b:placeRigid(actor.islandId,b.islandId,b);return {...p,x:nearestSeaX(p.x,actor.x)};});
export function boatRoom(actor,boats=[]) {
  return otherBoatPositions(actor,boats).every(p=>seaBoatSeparated(actor,p,BOAT_GAP+.1));
}
export function freeBoatPosition(actor,boats=[],reach=1040) {
  const others=otherBoatPositions(actor,boats);
  return nearestBoatSpace(actor,p=>others.every(q=>seaBoatSeparated(p,q,BOAT_GAP+1)) && canSail(p.x,p.y,actor.islandId),reach);
}
// Dock targets are transit space, including their images in neighbouring charts.
export function harborApproachClear(actor) {
  return ISLANDS.every(({id})=>{
    const water=id===actor.islandId?harborOf(id).water:placeRigid(actor.islandId,id,harborOf(id).water,actor);
    return seaBoatSeparated(actor,water,BOAT_GAP+24);
  });
}
function parkedBoatPosition(boat,boats) {
  const others=otherBoatPositions(boat,boats);
  return nearestBoatSpace(boat,p=>harborApproachClear({...boat,...p}) &&
    others.every(q=>seaBoatSeparated(p,q,BOAT_GAP+1)) && canSail(p.x,p.y,boat.islandId));
}
// A refused ticket must leave room to turn and sail away, outside the dock cove.
export function refusedLandingPosition(actor,islandId,boats=[]) {
  const m=mapOf(islandId),h=harborOf(islandId);
  // Wait on the open-sea side of the island (north, toward the main chart). A
  // south apron sits inside the polar current, which carries the boat back into
  // the refused cove whichever way it steers.
  const y=m.origin.y-900;
  const origin=placeRigid(actor.islandId,islandId,{x:h.water.x,y},actor);
  const others=otherBoatPositions(actor,boats), room=600;
  return nearestBoatSpace(origin,p=>canSail(p.x,p.y,actor.islandId,BOAT_RADIUS+room) &&
    others.every(q=>seaBoatSeparated(p,q,BOAT_GAP+room+1)),4160);
}
export const MOORING_CLEAR=BOAT_GAP+40, PARKED_PER_ISLAND=3, PARKED_LINGER=90000;
let MINT=Date.now();
function nextBoatId(islandId,slot,ids) {
  const base=`${islandId}-${slot}`;
  let id=base;
  while (ids.has(id)) id=`${base}~${(MINT++).toString(36)}`;
  return id;
}
const atMooring = (boat,spot) => Boolean(spot) && boat.islandId === boatHome(boat) && boat.x === spot.x && boat.y === spot.y;
export function fillMoorings(boats, islandId = null) {
  const SPOTS=new Map(), spotsOf=id => {if (!SPOTS.has(id)) SPOTS.set(id,boatSpots(id)); return SPOTS.get(id);};
  const held=new Set(), ids=new Set(), keep=[];
  let moved=false;
  const keyOf=boat => mooringOf(boat).key;
  // A boat sailing or parked keeps going even if its home slot no longer exists (island boat layouts can change).
  const valid=boat => typeof boat?.id === 'string' && islandFor(boatHome(boat)) && (spotsOf(boatHome(boat))[boatSlot(boat)] || boat.occupant || boat.parked === true);
  const spotOf=boat => spotsOf(boatHome(boat))[boatSlot(boat)];
  for (const boat of boats) {
    if (!valid(boat) || boat.occupant || ids.has(boat.id) || !atMooring(boat,spotOf(boat)) || held.has(keyOf(boat))) continue;
    if (!harborApproachClear(boat) || !boatRoom(boat,[...keep,...boats.filter(b=>b.occupant)])) continue;
    held.add(keyOf(boat)); ids.add(boat.id); keep.push(boat);
  }
  // Left-behind boats never crowd a port (its moorings are always refilled) and at most PARKED_PER_ISLAND,
  // the newest, wait on any island's beaches. A player's own built boat is always kept.
  // They linger PARKED_LINGER first, so whoever just landed can hop straight back in.
  const parkedKept=new Map(), now=Date.now(), dropped=new Set();
  const leftBoats=boats.filter(b=>valid(b)&&!b.occupant&&b.parked===true&&!b.owner&&islandFor(b.islandId));
  for (const boat of leftBoats) if (!Number.isFinite(boat.parkedAt)) {boat.parkedAt=now; moved=true;}
  leftBoats.sort((a,b)=>b.parkedAt-a.parkedAt);
  for (const boat of leftBoats) {
    const n=parkedKept.get(boat.islandId)??0;
    // A boat left at sea with nobody landed from it (its sailor disconnected) is cleared too.
    if (now-boat.parkedAt>=PARKED_LINGER && (near(boat,harborOf(boat.islandId).water,PORT_CLEAR) || n>=PARKED_PER_ISLAND || !boat.landing)) {dropped.add(boat);continue;}
    parkedKept.set(boat.islandId,n+1);
  }
  for (const boat of boats) {
    if (!valid(boat) || ids.has(boat.id) || dropped.has(boat) || (!boat.occupant && boat.parked !== true)) continue;
    if (!islandFor(boat.islandId) || !Number.isFinite(boat.x) || !Number.isFinite(boat.y)) continue;
    if (boat.occupant && spotOf(boat) && boat.islandId === boatHome(boat) && near(boat,spotOf(boat),MOORING_CLEAR)) held.add(keyOf(boat));
    if (!boat.occupant) {
      const at=parkedBoatPosition(boat,[...keep,...boats.filter(b=>b.occupant)]);
      if (!at) continue;
      if (at.x!==boat.x || at.y!==boat.y) {Object.assign(boat,at); moved=true;}
    }
    ids.add(boat.id); keep.push(boat);
  }
  let changed=moved || keep.length !== boats.length;
  for (const island of ISLANDS.filter(item => islandId === null || item.id === islandId)) for (let slot=0,spots=spotsOf(island.id);slot<spots.length;slot++) {
    if (held.has(`${island.id}|${slot}`)) continue;
    if (!harborApproachClear({...spots[slot],islandId:island.id}) || !boatRoom({...spots[slot],islandId:island.id},keep)) continue;
    const id=islandId === null ? nextBoatId(island.id,slot,ids) : `${island.id}-${slot}~${crypto.randomUUID()}`;
    ids.add(id); keep.push({...mooredBoat(island.id,slot,id),spawnedAt:Date.now()}); changed=true;
  }
  if (changed) boats.splice(0,boats.length,...keep);
  return changed;
}
export function retireBoat(boats,boat,landing=null,islandId=null) {
  const spot=boatSpot(boat), home=boatHome(boat);
  boat.occupant=null; boat.parked=true; boat.parkedAt=Date.now();
  if (landing) boat.landing={x:landing.x,y:landing.y};
  else if (boat.landing) boat.landing=null;
  if (!landing && !boat.owner && boatRoom({...boat,...spot},boats) && boat.islandId === home && near(boat,spot,MOORING_CLEAR) && !boats.some(other => other !== boat && !other.occupant && boatHome(other) === home && boatSlot(other) === boatSlot(boat) && atMooring(other,spot)))
    Object.assign(boat,{x:spot.x,y:spot.y,turn:spot.turn,departure:home,parked:false});
  const at=parkedBoatPosition(boat,boats);
  if (at) Object.assign(boat,at);
  if (!at) {
    const index=boats.indexOf(boat);
    if (index!==-1) boats.splice(index,1);
  }
  fillMoorings(boats,islandId);
}

const shoreFor=(x,y,nav,reach=280,map=null) => {
  const approach=map?.id==='library'&&map.world.boardingApproaches?.find(a=>Math.hypot(x-a.boat[0],y-a.boat[1])<8&&Math.hypot(x-a.point[0],y-a.point[1])<=reach&&nav.walkable(...a.point));
  if(approach)return {x:approach.point[0],y:approach.point[1]};
  const p=nav.nearest(x,y,reach);
  if (!p) return null;
  const [rx,ry]=p.map(Math.round);
  return nav.walkable(rx,ry) ? {x:rx,y:ry} : {x:p[0],y:p[1]};
};
export function landingSpot(actor,nav=null,reach=420,target=null) {
  if (target && !near(actor,target,reach)) return null;
  let best=null;
  const consider=(islandId,shore,at,extra={},d=Math.hypot(at.x-actor.x,at.y-actor.y)) => {
    if (d <= reach && (!best || d < best.d)) {
      best={islandId,offset:{x:at.x-shore.x,y:at.y-shore.y},...shore,d,...extra};
    }
  };
  const findShore=(p,walk,map)=>target ? (walk.walkable(p.x,p.y) ? p : null) : shoreFor(p.x,p.y,walk,reach,map);
  for (const island of WORLD_ISLANDS) {
    if(!islandMapReady(island.id))continue;
    const map=mapOf(island.id),p=unplaceRigid(actor.islandId,island.id,target ?? actor),lx=p.x,ly=p.y;
    if (lx < map.origin.x-reach || ly < map.origin.y-reach || lx > map.origin.x+map.width+reach || ly > map.origin.y+map.height+reach) continue;
    const shore=findShore(p,island.id===actor.islandId && nav && map.home ? nav : map.nav(),map);
    if (shore) consider(island.id,shore,placeRigid(actor.islandId,island.id,shore,actor));
  }
  for (const i of ISLETS) {
    const q=unplaceIslet(actor.islandId,i,target ?? actor),water=i.jetty.water,c=i.landCentre;
    const cap=Math.max(i.radius,Math.hypot(water[0]-c[0],water[1]-c[1]));
    if (Math.hypot(q.x-c[0],q.y-c[1])-cap>reach) continue;
    const walk=isletWalks(i.home).find(w => w.islet === i);
    const jettyDistance=Math.hypot(q.x-water[0],q.y-water[1]);
    if (!target && jettyDistance <= 240) {
      consider(i.home,walk.land,placeIslet(actor.islandId,i,i.jetty.land,actor),{islet:i.id,jetty:true},jettyDistance);
      continue;
    }
    const local=placeIslet(i.home,i,[q.x,q.y]);
    const shore=findShore(local,walk.nav);
    if (shore) {
      const point=unplaceIslet(i.home,i,shore);
      consider(i.home,shore,placeIslet(actor.islandId,i,[point.x,point.y],actor),{islet:i.id});
    }
  }
  return best;
}

// Islands where a boat may only land at the harbour. Empty: every island, Booquack Bog
// included, can be landed on from any shore (the Bog ticket is still checked on landing).
export const HARBOR_ONLY=new Set();
export function dockingSpot(actor,target=null) {
  const spot=landingSpot(actor,null,420,target);
  if (spot && !spot.islet && HARBOR_ONLY.has(spot.islandId)) return spot.islandId===actor.islandId && canDock(actor) ? {...harborOf(actor.islandId).land,islandId:actor.islandId,harbor:true} : null;
  if (target) return spot;
  const {land,water}=harborOf(actor.islandId);
  if ((!spot || (!spot.islet && spot.islandId===actor.islandId && (near(spot,land,200) || near(actor,water,150)))) && canDock(actor))
    return {...land,islandId:actor.islandId,harbor:true};
  return spot;
}

export function landingApproach(actor,spot,boats=[]) {
  return finishWork(landingApproachSteps(actor, spot, boats));
}
export function* landingApproachSteps(actor,spot,boats=[],work) {
  const others=otherBoatPositions(actor,boats);
  if (spot.jetty) {
    const i=ISLETS.find(i=>i.id===spot.islet),p=placeIslet(actor.islandId,i,i.jetty.water,actor);
    const q={x:Math.round(p.x),y:Math.round(p.y)};
    yield 16;
    if ((yield* separatedFromBoats(q,others,BOAT_GAP+.1)) && canSail(q.x,q.y,actor.islandId) && (near(actor,q,14) || (yield* sailRouteSteps(actor.islandId,actor,q,boats,work)))) return q;
  }
  const at={x:spot.x+spot.offset.x,y:spot.y+spot.offset.y};
  const sx=at.x,sy=at.y,len=Math.hypot(actor.x-sx,actor.y-sy)||1;
  for (let t=40;t<len-14;t+=10) {
    yield 16;
    const p={x:Math.round(sx+(actor.x-sx)*t/len), y:Math.round(sy+(actor.y-sy)*t/len)};
    if ((yield* separatedFromBoats(p,others,BOAT_GAP+.1)) && canSail(p.x,p.y,actor.islandId) && (yield* sailRouteSteps(actor.islandId,actor,p,boats,work))) return p;
  }
  return {x:actor.x,y:actor.y};
}

export const islandOffset=(from,to)=>islandFor(to)?originOffset(from,to):null;
function candidates(id,x,y,pad=0){
 fresh();
 const out=candidateScratch;out.length=0;
 let caps=CAP.get(pad);
 if(!caps){caps=WORLD_ISLANDS.map(island=>{const m=mapOf(island.id);return {island,map:m,reach:Math.hypot(m.width,m.height)/2+pad};});CAP.set(pad,caps);}
 for(const c of caps){
  const F=flatRigid(id,c.island.id),ox=wrapSea(x-F.x),oy=y-F.y;
  if(ox*ox+oy*oy>c.reach*c.reach)continue;
  out.push({map:c.map,x:F.cx+F.a*ox+F.b*oy,y:F.cy+F.c*ox+F.d*oy});
 }
 return out;
}
export function canSail(x,y,id='home',radius=BOAT_RADIUS){
 if(!Number.isFinite(x+y))return false;
 const b=seaBoundsFor(id);if(y<b.y0||y>b.y1)return false;
 for(const p of candidates(id,x,y,Math.ceil(radius))){
  if(p.map.landAt(p.x,p.y))return false;
  for(let k=0;k<16;k++){const a=k*Math.PI/8;if(p.map.landAt(p.x+Math.cos(a)*radius,p.y+Math.sin(a)*radius))return false;}
 }
 if(isletClearance({x,y},radius,id)<radius)return false;
 return true;
}

export function canDock(actor) {
  const at=harborOf(actor.islandId ?? 'home').water,water={...at,x:nearestSeaX(at.x,actor.x)};
  if (!near(actor,water,650)) return false;
  const distance=Math.hypot(actor.x-water.x,actor.y-water.y);
  const steps=Math.max(1,Math.ceil(distance/6));
  for (let i=0;i<=steps;i++) if (!canSail(actor.x+(water.x-actor.x)*i/steps,actor.y+(water.y-actor.y)*i/steps,actor.islandId)) return false;
  return true;
}

const RES=FIELD_RES, PAD=FIELD_PAD;
function* clearance(id,x,y,buildFields=true) {
  yield 4;
  const b=seaBoundsFor(id);
  if (y < b.y0 || y > b.y1) return 0;
  let best=PAD;
  // Materialize the coordinates before yielding. Other queries reuse candidateScratch.
  for(const p of candidates(id,x,y,PAD).slice()){
    const c=Math.round((p.x-p.map.origin.x+PAD)/RES),r=Math.round((p.y-p.map.origin.y+PAD)/RES);
    const cols=Math.ceil((p.map.width+2*PAD)/RES),rows=Math.ceil((p.map.height+2*PAD)/RES);
    if(c<0||r<0||c>=cols||r>=rows)continue;
    const field=p.map.cachedField ?? (buildFields ? (yield* p.map.fieldSteps()) : null);
    if (!field) return 0;
    best=Math.min(best,field.d[r*field.FW+c]);
  }
  return Math.max(0,Math.min(best-RES,isletClearance({x,y},PAD,id)));

}
const SAFE=BOAT_RADIUS+30;
function* clearSeaLine(id,a,b,buildFields) {
  const len=Math.hypot(b.x-a.x,b.y-a.y), steps=Math.max(1,Math.ceil(len/6));
  for (let i=1;i<=steps;i++) {
    const x=a.x+(b.x-a.x)*i/steps, y=a.y+(b.y-a.y)*i/steps, room=yield* clearance(id,x,y,buildFields);
    if (room >= SAFE) {i+=Math.max(0,Math.floor((room*.85-SAFE)/6)); continue;}
    for (let k=0;k<3;k++) {
      const f=(i-k/3)/steps;
      const x=a.x+(b.x-a.x)*f,y=a.y+(b.y-a.y)*f;
      const margin=Math.min(4,len*f,len*(1-f));
      yield 24;
      if (!canSail(x,y,id) || margin>0 && !canSail(x,y,id,BOAT_RADIUS+margin)) return false;
    }
  }
  return true;
};
const CELL=125;
// Share this limit across the origin, destination, and every alternate dock
// target so one route cannot run an entire fine-grid search for each target.
const FINE_ROUTE_VISITS=3000;
// Keep the proven local grid phase through the chart migration. Sliding the grid
// can turn an existing narrow canal route into a tangent to an authored bank.
const LEGACY_CENTRES=Object.fromEntries([['home',{x:0,y:0}],...FLAT_RING.map((id,k)=>[id,{x:FLAT_RADIUS*Math.sin(k*Math.PI/3),y:-FLAT_RADIUS*Math.cos(k*Math.PI/3)}])]);
function routeBounds(id){
 const bounds=seaBoundsFor(id),m=mapOf(id),old=LEGACY_CENTRES[id];
 const boxes=WORLD_ISLANDS.map(i=>{const p=LEGACY_CENTRES[i.id],map=mapOf(i.id);return {x:p.x-map.width/2,y:p.y-map.height/2,w:map.width,h:map.height};});
 for(const i of ISLETS){const p=GLOBE_ISLET_OFFSETS[i.id],home=LEGACY_CENTRES[p.home];boxes.push({x:home.x+p.x-i.width/2,y:home.y+p.y-i.width/2,w:i.width,h:i.width});}
 const margin=Math.max(1800,...boxes.map(b=>Math.max(b.w,b.h)/2));
 const x=m.cx-old.x+Math.min(...boxes.map(b=>b.x))-margin,y=m.cy-old.y+Math.min(...boxes.map(b=>b.y))-margin-1200;
 return {...bounds,x0:x+Math.floor((bounds.x0-x)/CELL)*CELL,y0:y+Math.floor((bounds.y0-y)/CELL)*CELL};
}

function* buildGrid(id) {
  const b=routeBounds(id), cols=Math.ceil((b.x1-b.x0)/CELL), rows=Math.ceil((b.y1-b.y0)/CELL);
  const open=new Uint8Array(cols*rows);
  for (let r=0;r<rows;r++) for (let c=0;c<cols;c++)
    open[r*cols+c]=(yield* clearance(id,b.x0+(c+.5)*CELL,b.y0+(r+.5)*CELL))*.9 >= CELL*.71+SAFE ? 1 : 0;
  const labels=new Int32Array(open.length);
  let label=0,largest=[];
  for(let start=0;start<open.length;start++){
    yield 1;
    if(!open[start]||labels[start])continue;
    const queue=[start];labels[start]=++label;
    for(let k=0;k<queue.length;k++){
      yield 1;
      const i=queue[k],r=Math.floor(i/cols),c=i%cols;
      for(const [dr,dc]of [[0,1],[0,-1],[1,0],[-1,0]]){
        const nr=r+dr,nc=c+dc,j=nr*cols+nc;
        if(nr>=0&&nc>=0&&nr<rows&&nc<cols&&open[j]&&!labels[j]){labels[j]=label;queue.push(j);}
      }
    }
    if(queue.length>largest.length)largest=queue;
  }
  const ocean=new Uint8Array(open.length);
  for(const k of largest){yield 1; ocean[k]=1;}
  return {b,cols,rows,open:ocean};
}

function* gridFor(id) {
  fresh();
  while (!GRIDS.has(id)) {
    let builder=GRID_BUILDERS.get(id);
    if (!builder) {builder=buildGrid(id);GRID_BUILDERS.set(id,builder);}
    const next=builder.next();
    if (next.done) {GRIDS.set(id,next.value);GRID_BUILDERS.delete(id);}
    else yield next.value;
  }
  return GRIDS.get(id);
}

export function sailRoute(id,from,to,boats=[],work) {
 const report=work&&{visitLimit:work.visitLimit};
 const route=finishWork(sailRouteSteps(id,from,to,boats,report));
 if(report)Object.assign(work,report);
 return route;
}
function* sailRouteSteps(id,from,to,boats,work) {
 const m=mapOf(id),targetX=nearestSeaX(to.x,from.x),middle=(from.x+targetX)/2,shift=middle-nearestSeaX(middle,m.cx);
 const start={x:from.x-shift,y:from.y},end={x:targetX-shift,y:to.y};
 const others=otherBoatPositions({...from,islandId:id},boats).flatMap(p=>{
   const x=nearestSeaX(p.x,middle)-shift;
   return [-SEA_WIDTH,0,SEA_WIDTH].map(offset=>({...p,x:x+offset}));
 });
 const budget={visits:0,limit:Math.min(FINE_ROUTE_VISITS,work?.visitLimit??FINE_ROUTE_VISITS)};
 const findRoute=chartPlanner(id,start,others,budget);
 let alternatives=0, route=yield* findRoute(end);
 // moored boats can wall in a harbour's dock point (Bog's three moorings sit 380-620 around it): aim for the
 // nearest free water beside it instead, and the arrival docks from there
 if(!route&&others.length)for(let r=BOAT_GAP+100;r<=BOAT_GAP+1000&&!route;r+=150){
   const ring=[];
   for (let k=0;k<16;k++){
     yield 8;
     const q={x:end.x+Math.cos(k*Math.PI/8)*r,y:end.y+Math.sin(k*Math.PI/8)*r};
     if(canSail(q.x+shift,q.y,id)&&(yield* separatedFromBoats(q,others,BOAT_GAP+1)))ring.push(q);
   }
   ring.sort((a,b)=>Math.hypot(a.x-start.x,a.y-start.y)-Math.hypot(b.x-start.x,b.y-start.y));
   for(const q of ring){
     alternatives++;
     if((route=yield* findRoute(q)))break;
   }
 }
 if(work) {
   work.fineVisits=(work.fineVisits??0)+budget.visits;
   work.alternatives=(work.alternatives??0)+alternatives;
 }
 return route?.map(p=>({...p,x:p.x+shift}))??null;
}
function* separatedFromBoats(point, others, gap) {
  for (const boat of others) {
    yield 1;
    if (!seaBoatSeparated(point,boat,gap)) return false;
  }
  return true;
}

function chartPlanner(id,from,others,budget) {
  function* lineRoom(a,b){
    const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;
    const xReach=Math.abs(dx)/2+BOAT_GAP+1,yReach=Math.abs(dy)/2+BOAT_GAP+1;
    const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
    for(let i=0;i<others.length;i++){
      if(i%8===0)yield 2;
      const p=others[i];
      if(Math.abs(p.y-my)>yReach||Math.abs(wrapSea(p.x-mx))>xReach)continue;
      yield 1;
      const t=l2?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l2)):0;
      // Movement can stop just inside the planner's extra pixel of clearance.
      // Let the first edge leave that position without getting any closer;
      // every subsequent edge still keeps the full planning margin.
      const gap=a.x===from.x&&a.y===from.y?Math.min(BOAT_GAP+1,Math.hypot(wrapSea(a.x-p.x),a.y-p.y)):BOAT_GAP+1;
      if(!seaBoatSeparated({x:a.x+dx*t,y:a.y+dy*t},p,gap-1e-7))return false;
    }
    return true;
  };
  function* clearLine(id,a,b,buildFields=true){return (yield* lineRoom(a,b))&&(yield* clearSeaLine(id,a,b,buildFields));}
  let plan;
  return function* (to) {
    // A straight sail can use exact shoreline probes while the distance field is cold.
    if (yield* clearLine(id,from,to,false)) return [to];
    plan ??= yield* prepare();
    return yield* plan(to);
  };

  function* prepare() {
    const {b,cols,rows,open:sea}=yield* gridFor(id), open=others.length?sea.slice():sea, centre=i => ({x:b.x0+(i%cols+.5)*CELL,y:b.y0+(Math.floor(i/cols)+.5)*CELL});
    const boatEdges=new Uint8Array(open.length);
    // The cached sea grid stays immutable. Only cells near a live boat change.
    for(const p of others){
      const r=BOAT_GAP+CELL*Math.SQRT2/2+1;
      const c0=Math.max(0,Math.floor((p.x-r-b.x0)/CELL)),c1=Math.min(cols-1,Math.floor((p.x+r-b.x0)/CELL));
      const r0=Math.max(0,Math.floor((p.y-r-b.y0)/CELL)),r1=Math.min(rows-1,Math.floor((p.y+r-b.y0)/CELL));
      for(let y=r0;y<=r1;y++)for(let x=c0;x<=c1;x++){
        yield 1;
        const i=y*cols+x,at=centre(i);
        if(!seaBoatSeparated(at,p,r))boatEdges[i]=1;
        if(!seaBoatSeparated(at,p,BOAT_GAP+1))open[i]=0;
      }
    }
    function* nearestOpen(p) {
      const c0=Math.floor((p.x-b.x0)/CELL), r0=Math.floor((p.y-b.y0)/CELL);
      for (let d=0;d<14;d++) for (let r=r0-d;r<=r0+d;r++) for (let c=c0-d;c<=c0+d;c++) {
        yield 1;
        if (Math.max(Math.abs(c-c0),Math.abs(r-r0))!==d || r<0||c<0||r>=rows||c>=cols||!open[r*cols+c]) continue;
        if (budget.visits>=budget.limit)return -1;
        budget.visits++;
        if (yield* clearLine(id,p,centre(r*cols+c))) return r*cols+c;
      }
      return -1;
    };
    function* connect(p,step=60,limit=60){
      if (budget.visits>=budget.limit)return null;
      const direct=yield* nearestOpen(p);if(direct>=0)return {index:direct,points:[centre(direct)]};
      const side=limit*2+1,total=side*side,start=limit*side+limit;
      const prev=new Int32Array(total).fill(-1),queue=[start];prev[start]=start;
      const point=i=>({x:p.x+(i%side-limit)*step,y:p.y+(Math.floor(i/side)-limit)*step});
      for(let k=0;k<queue.length&&budget.visits<budget.limit;k++,budget.visits++){
        yield 1;
        const i=queue[k],at=point(i),c=Math.floor((at.x-b.x0)/CELL),r=Math.floor((at.y-b.y0)/CELL),cell=r*cols+c;
        if(c>=0&&r>=0&&c<cols&&r<rows&&open[cell]&&(yield* clearLine(id,at,centre(cell)))){
          const points=[centre(cell)];for(let j=i;j!==start;j=prev[j])points.push(point(j));points.reverse();return {index:cell,points};
        }
        const row=Math.floor(i/side),col=i%side;
        for(const [dr,dc]of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[-1,1],[1,-1],[-1,-1]]){
          const nr=row+dr,nc=col+dc,j=nr*side+nc;if(nr<0||nc<0||nr>=side||nc>=side||prev[j]>=0)continue;
          yield 8;
          const q=point(j);if(canSail(q.x,q.y,id)&&(yield* clearLine(id,at,q))){prev[j]=i;queue.push(j);}
        }
      }
      return null;
    };
    function* reach(p){return (yield* connect(p))??(yield* connect(p,20,180));}
    const entrance=yield* reach(from);
    if(!entrance)return function* () {return null;};
    // Nearby dock alternatives all share this origin and obstacle grid.
    const start=entrance.index;
    const prev=new Int32Array(cols*rows).fill(-1), queue=[start]; prev[start]=start;
    let cursor=0;
    return function* (to) {
      const exit=yield* reach(to);
      if(!exit)return null;
      const goal=exit.index;
      while(cursor<queue.length && prev[goal]<0) {
        yield 1;
        const i=queue[cursor++], c=i%cols, r=Math.floor(i/cols);
        for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) {
          const nr=r+dr, nc=c+dc, n=nr*cols+nc;
          // Check actual edges near boats instead of inflating every blocked cell by
          // half its diagonal. That padding seals valid harbour escape corridors.
          if ((dr||dc) && nr>=0 && nc>=0 && nr<rows && nc<cols && open[n] && prev[n]<0 && (!dr||!dc||open[r*cols+nc]&&open[nr*cols+c]) &&
              (!(boatEdges[i]||boatEdges[n]) || (yield* lineRoom(centre(i),centre(n))))) {prev[n]=i; queue.push(n);}
        }
      }
      if(prev[goal]<0)return null;
      const cells=[];
      for (let i=goal;i!==start;i=prev[i]) cells.push(centre(i));
      cells.push(centre(start));cells.reverse();cells.unshift(...entrance.points.slice(0,-1));cells.push(...exit.points.slice(0,-1).reverse(),to);
      const route=[]; let at=from;
      for (let k=0;k<cells.length;) {
        if(!(yield* clearLine(id,at,cells[k])))return null;
        let j=k,step=1,blocked=cells.length;
        while(j+step<cells.length){const next=j+step;if(!(yield* clearLine(id,at,cells[next]))){blocked=next;break;}j=next;step*=2;}
        let lo=j+1,hi=Math.min(cells.length-1,blocked-1);
        while(lo<=hi){const mid=(lo+hi)>>1;if(yield* clearLine(id,at,cells[mid])){j=mid;lo=mid+1;}else hi=mid-1;}
        route.push(cells[j]); at=cells[j]; k=j+1;
      }
      return route;
    };
  }
}

export function* planSailDestinationSteps(actor,x,y,boats,work) {
  yield 8;
  if (!canSail(x,y,actor.islandId)) return null;
  const others=otherBoatPositions({...actor,x,y},boats);
  let at;
  for (const point of boatSpaceCandidates({x,y},520)) {
    if (!(yield* separatedFromBoats(point,others,BOAT_GAP+1))) continue;
    yield 8;
    if (canSail(point.x,point.y,actor.islandId)) {at=point;break;}
  }
  if (!at) return null;
  const route=yield* sailRouteSteps(actor.islandId,actor,at,boats,work);
  return route ? {target:at, route} : null;
}

export function applySailPlan(actor,plan) {
  actor.sailTarget=plan.route[0];
  actor.sailRoute=plan.route.slice(1);
  actor.docking=false;
}

export function setSailDestination(actor,x,y,boats=[],work) {
  const report=work&&{visitLimit:work.visitLimit};
  const plan=finishWork(planSailDestinationSteps(actor,x,y,boats,report));
  if(report)Object.assign(work,report);
  if (!plan) return null;
  applySailPlan(actor,plan);
  return [plan.target.x,plan.target.y];
}

const clearBoatStep=(actor,x,y,others)=>others.every(p=>seaBoatSeparated({x,y},p,BOAT_GAP+.1) || Math.hypot(wrapSea(x-p.x),y-p.y)>Math.hypot(wrapSea(actor.x-p.x),actor.y-p.y));
export function canStartSailPlan(actor,plan,boats) {
  const point=plan.route.find(p=>!near(actor,p,1));
  if (!point) return true;
  const dx=point.x-actor.x,dy=point.y-actor.y,scale=Math.min(1,6/Math.hypot(dx,dy));
  const x=actor.x+dx*scale,y=actor.y+dy*scale;
  return canSail(x,y,actor.islandId)&&clearBoatStep(actor,x,y,otherBoatPositions(actor,boats));
}

function slideBoatStep(actor,x,y,others) {
  let dx=x-actor.x,dy=y-actor.y;
  // Remove the inward component, keeping the glancing part of the requested
  // movement. A few passes handle contacts with more than one nearby boat.
  for(let pass=0;pass<3;pass++){
    let changed=false;
    for(const p of others){
      if(seaBoatSeparated({x:actor.x+dx,y:actor.y+dy},p,BOAT_GAP+.1))continue;
      const nx=wrapSea(actor.x-p.x),ny=actor.y-p.y,length=Math.hypot(nx,ny);
      if(!length)continue;
      const inward=(dx*nx+dy*ny)/length;
      if(inward<0){dx-=nx/length*inward;dy-=ny/length*inward;changed=true;}
    }
    if(!changed)break;
  }
  return {x:actor.x+dx,y:actor.y+dy};
}
// Polar coast water uses the same continuous movement as every other island.
export function sailStep(actor,dt,input,now=null,boats=[],reroute=setSailDestination) {
  const others=otherBoatPositions(actor,boats);
  delete actor.seaCurrent; // Discard obsolete current state from an older session.
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
      let x=actor.x+dx/distance*travel/steps, y=actor.y+dy/distance*travel/steps;
      // A boat already inside another's gap may still sail away from it, never closer, so no boat is ever boxed in.
      let boatInWay=!clearBoatStep(actor,x,y,others);
      if(manual&&boatInWay){
        const slide=slideBoatStep(actor,x,y,others);
        if(clearBoatStep(actor,slide.x,slide.y,others)&&canSail(slide.x,slide.y,actor.islandId)){
          ({x,y}=slide);boatInWay=false;
        }
      }
      if (boatInWay || !canSail(x,y,actor.islandId)) {
        // A boat moored or sailing across a planned course: plan round it instead of stopping (a few tries).
        const goal=!manual&&target?(actor.sailRoute?.at(-1)??target):null, docking=actor.docking;
        if (boatInWay && goal && (actor.reroutes??0)<8) {
          actor.reroutes=(actor.reroutes??0)+1;
          if (reroute(actor,goal.x,goal.y,boats)) {actor.docking=docking; break;}
        }
        actor.sailTarget=null; actor.sailRoute=null; actor.docking=false; break;
      }
      actor.reroutes=0;
      actor.x=x; actor.y=y;
    }
    actor.turn=Math.atan2(dx,dy);
    if (target && near(actor,target,1)) actor.sailTarget=actor.sailRoute?.shift() ?? null;
  }
  actor.travel=Math.hypot(actor.x-ox,actor.y-oy)/dt;
  if (!(now !== null && SAIL_EMOTES.has(actor.action) && now < actor.until)) {actor.action=0; if (now !== null) actor.until=0;}
  return actor.travel>0;
}

export function arrivalDestination(actor,boats=[]) {
  if (actor.mode !== 'sailing') return null;
  return destinationsFor(actor.islandId).find(island => {
    if (Math.abs(wrapSea(actor.x-island.dock.x))<=65 && Math.abs(actor.y-island.dock.y)<=50 &&
      (!actor.sailTarget || (Math.abs(wrapSea(actor.sailTarget.x-island.dock.x))<=65 && Math.abs(actor.sailTarget.y-island.dock.y)<=50))) return true;
    // Routing an occupied dock ends at nearby free water. Cross from there once
    // stopped, with the same hull/shore checks and without relaxing boat spacing.
    if (actor.sailTarget || !near(actor,island.dock,520) ||
      boatRoom({...actor,...island.dock},boats) || !boatRoom(actor,boats)) return false;
    return canDock({...actor,...unplaceRigid(actor.islandId,island.destination,actor),islandId:island.destination});
  }) ?? null;
}
export function crossIsland(actor,allow=() => true,boats=[]) {
  const destination=arrivalDestination(actor,boats);
  if (!destination || !allow(destination.destination)) return false;
  const at=freeBoatPosition({...actor,islandId:destination.destination,...harborOf(destination.destination).water},boats,520);
  if (!at) return false;
  Object.assign(actor,{islandId:destination.destination,...at,dockTarget:at,turn:Math.PI,travel:0,path:[],sailTarget:null,sailRoute:null,docking:true,exitLocked:false});
  return true;
}

// Preserve old islet visitors relative to their artwork when its chart centre moves.
function migratedIsletPoint(actor){
 const m=mapOf(actor.islandId);
 for(const i of ISLETS){
  if(i.home!==actor.islandId)continue;
  const old=GLOBE_ISLET_OFFSETS[i.id],spot=FLAT_ISLETS[i.id],dx=actor.x-m.cx-old.x,dy=actor.y-m.cy-old.y;
  if(Math.hypot(dx,dy)>i.radius+800)continue;
  const p={x:m.cx+spot.x+dx,y:m.cy+spot.y+dy};
  if(actor.mode==='walking'?canWalkTo(actor.islandId,p.x,p.y):canSail(p.x,p.y,actor.islandId))return p;
 }
 return null;
}
// Old open-sea hexagon coordinates have no geographic meaning on this chart.
// Keep islet visitors with their islet; recover other sailors at their own harbour.
export function migrateSeaPosition(actor){
 if(!actor || actor.seaVersion===SEA_VERSION)return false;
 actor.seaVersion=SEA_VERSION;
 const islet=migratedIsletPoint(actor);
 if(actor.mode!=='sailing'){
  if(islet){Object.assign(actor,islet,{path:[]});return true;}
  return false;
 }
 Object.assign(actor,islet??harborOf(actor.islandId).water,{path:[],travel:0,sailTarget:null,sailRoute:null,docking:false,exitLocked:false});
 delete actor.seaCurrent;return true;
}
