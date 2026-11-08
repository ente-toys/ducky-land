import {placeRigid,unplaceRigid,flatRigid} from './rigid.js';
import {placeIslet,unplaceIslet} from './islet-placement.js';
import {dot} from './sphere.js';
import {isletClearance,isletLocalClearance,ISLETS} from './islets.js';
import {walkNav,isletWalks,inWalkArea} from './islet-walk.js';
import {worldIsland} from './world-map.js';
import {WORLD_GEO} from './world-map.js';
import {WORLD_ISLANDS, neighboursOf, offsetOf} from './world-map.js';
import {HOME_MAP, mapOf, mapsVersion, FIELD_RES, FIELD_PAD} from './island-maps.js';

// boss 5 Nov: 300 islands. You play on one; the nearest four are a sail away. boss 6 Nov: an island plays on its theme's own
// map (island-maps.js), in that map's local coordinates; a theme not delivered yet plays the home map.
export const ISLANDS = WORLD_ISLANDS.map(({id,name,accent}) => ({id,name,accent}));
const ISLAND_BY_ID = new Map(ISLANDS.map(island => [island.id,island]));
export const islandFor = id => ISLAND_BY_ID.get(id);
// boss 5 Nov: the harbor is a real wooden jetty. Its foot is on the lawn, its deck runs out over the water, Ducky walks it to
// the boats moored along both sides. land = the deck end you board from and land on, water = where a boat docks, beside the tip.
// JETTY and HARBOR are the home island's; harborOf(islandId) and jettyOf(islandId) give any island's own.
export const JETTY = HOME_MAP.JETTY;
export const HARBOR = HOME_MAP.HARBOR;
export const harborOf = id => mapOf(id).HARBOR;
export const jettyOf = id => mapOf(id).JETTY;
// the walking map of island id: its own ground plus the sea islets charted on it (islet-walk.js)
export const navOf = (id, base = mapOf(id).nav()) => walkNav(id, base);
export const canWalkTo = (id, x, y) => inWalkArea(mapOf(id), id, x, y);
// the server and the live client walk the same harbor: the jetty deck is a walkway, and the lawn at its foot is cleared of props
export const harborWorld = (w, id='home') => ({...w, walkways:[...w.walkways, jettyOf(id).walkway]});
export const harborClear = prop => Math.hypot(prop.x-1726-20,prop.y-830-110) > 200;
// boss 5 Nov: walk to the deck beside your boat, then step in
export function boardingPoint(boat,nav) {
  const dock=isletWalks(boat.islandId ?? 'home').find(w=>near(boat,w.water,150));
  if(dock)return {...dock.land};   // return along the drawn jetty, even when a radial sand search misses its narrow deck
  const map=mapOf(boat.islandId ?? 'home'), {HARBOR:harbor,JETTY:jetty}=map, {foot,dir,length,along}=jetty;
  if (!near(boat,harbor.water,600)) return shoreFor(boat.x,boat.y,nav ?? navOf(boat.islandId ?? 'home')) ?? {x:Math.round(boat.x),y:Math.round(boat.y)};   // a beach or islet boat: step in from the nearest sand
  const t=Math.max(length*jetty.wetFrom,Math.min(length-44,(boat.x-foot.x)*dir.x+(boat.y-foot.y)*dir.y));
  const side=Math.sign((boat.x-foot.x)*-dir.y+(boat.y-foot.y)*dir.x)*(t >= length-45 ? 0 : 18), p=along(t,side);
  return {x:Math.round(p.x),y:Math.round(p.y)};
}
export const BOAT_RADIUS = 46;
export const SAIL_SPEED = 380;
// the sea you can sail: round this island and its four neighbours (each island in its own map, placed by its centre)
const MARGIN=1800;
const DEST=new Map(), BOUNDS=new Map(), OBSTACLES=new Map(), GRIDS=new Map(),CAP=new Map();
const sphereScratch=[0,0,0],candidateScratch=[];
let SEEN=-1;
const fresh=() => {if (SEEN !== mapsVersion()) {SEEN=mapsVersion(); for (const cache of [DEST,BOUNDS,OBSTACLES,GRIDS,CAP]) cache.clear();}};   // a theme arrived: re-plan the seas
// where island `to`'s local (0,0) sits in island `from`'s local coordinates. The world map places island CENTRES, so two
// maps of different sizes still line up round their middles (boss 6 Nov: every theme has its own size and coast).
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
    // All thirteen real shores are sail-able, even without a listed jetty link.
    // Respect negative map origins and retain room outside the largest map.
    const boxes=WORLD_ISLANDS.map(island => {const B=mapOf(island.id),o=originOffset(id,island.id);
      return {x:o.x+B.origin.x,y:o.y+B.origin.y,w:B.width,h:B.height};});
    const margin=Math.max(MARGIN,...boxes.map(o=>Math.max(o.w,o.h)/2));
    BOUNDS.set(id,{x0:Math.min(...boxes.map(o=>o.x))-margin,y0:Math.min(...boxes.map(o=>o.y))-margin-1200,
      x1:Math.max(...boxes.map(o=>o.x+o.w))+margin,y1:Math.max(...boxes.map(o=>o.y+o.h))+margin});
  }
  return BOUNDS.get(id);
}
export const SEA_BOUNDS = seaBoundsFor('home');
export const offshoreProgress = player => player ? Math.max(0,Math.min(1,(660-player.y-450)/850)) : 1;   // 660: the old harbor line, so the clouds stay put
export const near = (a,b,radius) => Math.hypot(a.x-b.x,a.y-b.y) <= radius;

// boss 5 Nov: "we can take boats from any place and dock any place". Every island has its map's real boats: three at the
// harbor jetty, one off each little islet, and a few moored off the beaches (island-maps.js). Fixed spots, so every player
// sees the same boats (they replace the decoration boats in live play). boatSpots() is the home island's.
export const boatSpots=(islandId='home') => mapOf(islandId).boatSpots();
const mooredBoat=(islandId,slot,id=`${islandId}-${slot}`) => {
  const spot=boatSpots(islandId)[slot];
  return {id, islandId, x:spot.x, y:spot.y, turn:spot.turn, occupant:null, departure:islandId};
};
export function createBoats() {
  return ISLANDS.flatMap(island => boatSpots(island.id).map((spot,slot) => mooredBoat(island.id,slot)));
}
// a refilled mooring's boat is "<island>-<slot>~<n>": the part before ~ still names its island and mooring
// IDs stay stable while a boat moves. Parse once rather than splitting every boat ID repeatedly on each room tick.
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

// boss 6 Nov ("I took the boat already. Every island should have all the boats"): every mooring on every island always
// holds a boat. A mooring counts as held by an empty boat sitting on it, or by a taken boat that has not yet sailed
// MOORING_CLEAR away from it; once the sailor is clear a fresh boat (new id) appears there. An empty boat anywhere else
// without a parked marker is an obsolete save entry. Explicitly parked arrivals stay where their sailor left them.
// Runs in place on the room's list; returns whether it changed.
export const MOORING_CLEAR=300;
let MINT=Date.now();
const atMooring = (boat,spot) => boat.islandId === boatHome(boat) && boat.x === spot.x && boat.y === spot.y;
export function fillMoorings(boats) {
  // boss 6 Nov: each island refills its OWN map's moorings (a themed island has its own spots; a boat whose mooring the
  // island's map no longer has is dropped and fades out)
  const SPOTS=new Map(), spotsOf=id => {if (!SPOTS.has(id)) SPOTS.set(id,boatSpots(id)); return SPOTS.get(id);};
  const held=new Set(), ids=new Set(), keep=[];
  const keyOf=boat => mooringOf(boat).key;
  const valid=boat => typeof boat?.id === 'string' && islandFor(boatHome(boat)) && spotsOf(boatHome(boat))[boatSlot(boat)];
  const spotOf=boat => spotsOf(boatHome(boat))[boatSlot(boat)];
  for (const boat of boats) {   // empty boats first, so a sailor passing a refilled mooring never pushes its boat out
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
    let id=`${island.id}-${slot}`;
    while (ids.has(id)) id=`${island.id}-${slot}~${(MINT++).toString(36)}`;
    ids.add(id); keep.push({...mooredBoat(island.id,slot,id),spawnedAt:Date.now()}); changed=true;   // spawnedAt: the client fades it in
  }
  if (changed) boats.splice(0,boats.length,...keep);
  return changed;
}
// a sailor steps off (lands, docks or leaves the game): a boat still beside its own empty mooring ties back up there;
// any other boat parks at its arrival position, and the original moorings stay full
export function retireBoat(boats,boat) {
  const spot=boatSpot(boat), home=boatHome(boat);
  boat.occupant=null; boat.parked=true;
  if (boat.islandId === home && near(boat,spot,MOORING_CLEAR) && !boats.some(other => other !== boat && !other.occupant && boatHome(other) === home && boatSlot(other) === boatSlot(boat) && atMooring(other,spot)))
    Object.assign(boat,{x:spot.x,y:spot.y,turn:spot.turn,departure:home,parked:false});
  fillMoorings(boats);
}

// where you step on and off a boat moored away from the harbor: the nearest land you can stand on
const shoreFor=(x,y,nav,reach=280) => {const p=nav.nearest(x,y,reach); return p ? {x:Math.round(p[0]),y:Math.round(p[1])} : null;};
// boss 5 Nov: when you sail close to any shore you can dock and hop out there. Boss 6 Nov ("no Dock button at that beach"):
// ANY island drawn in this sea counts, not only the five you can sail to by jetty (isle-250 sits right beside isle-176's
// east beach, which is not one of its listed neighbours). The client asks this four times a second, so each island is
// skipped on a cheap box test before the walking map is searched. Each island is searched on its own map's walking map;
// `nav` (the caller's own walking map, e.g. the client's with its sleepers) stands in for a home-map island you are on.
export function landingSpot(actor,nav=null,reach=420) {   // the walking map keeps Duckies a little back from the waterline
  let best=null;
  for (const island of WORLD_ISLANDS) {
    const map=mapOf(island.id),p=unplaceRigid(actor.islandId,island.id,actor),lx=p.x,ly=p.y;
    if (lx < map.origin.x-reach || ly < map.origin.y-reach || lx > map.origin.x+map.width+reach || ly > map.origin.y+map.height+reach) continue;
    const shore=shoreFor(lx,ly,island.id===actor.islandId && nav && map.home ? nav : map.nav(),reach);   // the island itself (its islets below)
    if(shore && (!best||Math.hypot(shore.x-lx,shore.y-ly)<best.d)){
      const at=placeRigid(actor.islandId,island.id,shore);
      best={islandId:island.id,offset:{x:at.x-shore.x,y:at.y-shore.y},...shore,d:Math.hypot(shore.x-lx,shore.y-ly)};
    }
  }
  // boss 8 Nov ("I should be able to dock here"): a sea islet in reach offers its jetty. Its walking ground is charted on
  // its nearest island (islet.home), so landing there moves you onto that island, far out in its sea.
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
// boss 5 Nov ("dock fix"): the water right beside that sand, so the boat sails in before the Ducky hops out. Walk back from
// the sand toward the boat to the first water the boat fits in AND can actually sail to (a narrow cove can have open water by
// the beach that no route reaches); if there is none, the boat is already as close as it can get. Kept out of landingSpot
// because the client asks landingSpot four times a second just to show the Dock button.
export function landingApproach(actor,spot) {
  if (spot.islet) {
    const i=ISLETS.find(i=>i.id===spot.islet),p=placeIslet(actor.islandId,i,i.jetty.water);
    const q={x:Math.round(p.x),y:Math.round(p.y)};
    if (near(actor,q,14) || (canSail(q.x,q.y,actor.islandId) && sailRoute(actor.islandId,actor,q))) return q;
  }
  const at=spot.islet?placeIslet(actor.islandId,ISLETS.find(i=>i.id===spot.islet),ISLETS.find(i=>i.id===spot.islet).jetty.land):placeRigid(actor.islandId,spot.islandId,spot);
  const sx=at.x,sy=at.y,len=Math.hypot(actor.x-sx,actor.y-sy)||1;
  for (let t=40;t<len-14;t+=10) {
    const p={x:Math.round(sx+(actor.x-sx)*t/len), y:Math.round(sy+(actor.y-sy)*t/len)};
    if (canSail(p.x,p.y,actor.islandId) && sailRoute(actor.islandId,actor,p)) return p;
  }
  return {x:Math.round(actor.x),y:Math.round(actor.y)};
}

// every island drawn inside this sea is solid land, not only the ones you can dock at (review 5 Nov): each one's origin in
// this island's coordinates, with its own map (its own coast, size and jetty)
const obstaclesFor=id => {
  fresh();
  if (!OBSTACLES.has(id)) {
    const b=seaBoundsFor(id);
    OBSTACLES.set(id,WORLD_ISLANDS.filter(island => island.id!==id).map(island => ({...originOffset(id,island.id),id:island.id,map:mapOf(island.id)}))
      .filter(o => o.x+o.map.origin.x+o.map.width+600 > b.x0 && o.x+o.map.origin.x-600 < b.x1 && o.y+o.map.origin.y+o.map.height+600 > b.y0 && o.y+o.map.origin.y-600 < b.y1));
  }
  return OBSTACLES.get(id);
};
// how far island `to` sits from island `from` (to's local origin, in from's local coordinates), when `to` is drawn in from's
// sea (a neighbour or any other island near enough to sail up to); null for an island out of sight
export const islandOffset=(from,to) => {const o=obstaclesFor(from).find(o => o.id===to); return o ? {x:o.x,y:o.y} : null;};
function candidates(id,x,y,pad=0){
 fresh();
 const frame=worldIsland(id),map=mapOf(id),dx=x-map.cx,dy=y-map.cy,d=Math.hypot(dx,dy),a=d/WORLD_GEO.Rw;
 const k=d>1e-10?Math.sin(a)/d:1/WORLD_GEO.Rw,co=Math.cos(a),p=sphereScratch,out=candidateScratch;out.length=0;
 for(let j=0;j<3;j++)p[j]=frame.center[j]*co+(frame.east[j]*dx-frame.north[j]*dy)*k;
 let caps=CAP.get(pad);
 if(!caps){caps=WORLD_ISLANDS.map(island=>{const m=mapOf(island.id);const reach=Math.hypot(m.width,m.height)/2+pad;return {island,map:m,reach,cos:Math.cos(reach/WORLD_GEO.Rw)};});CAP.set(pad,caps);}
 for(const c of caps){
  if(c.island.id===id){if(dot(p,c.island.center)>=c.cos)out.push({map:c.map,x,y});continue;}
  // the neighbour's coast in its rigid frame: the art as drawn, centred where the sphere puts it, turned, true size
  const F=flatRigid(id,c.island.id),ox=x-F.x,oy=y-F.y;
  if(ox*ox+oy*oy>c.reach*c.reach)continue;
  out.push({map:c.map,x:F.cx+F.a*ox+F.b*oy,y:F.cy+F.c*ox+F.d*oy});
 }
 return out;
}
export function canSail(x,y,id='home',radius=BOAT_RADIUS){
 if(!Number.isFinite(x+y))return false;
 const b=seaBoundsFor(id);if(x<b.x0||y<b.y0||x>b.x1||y>b.y1)return false;
 // The boat's clearance circle belongs to the candidate island's local map.
 // Planning tapers its clearance margin near endpoints. Round the cap up so
 // those fractional radii share a bounded set of conservative cached caps.
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

// boss 5 Nov: neighbours are full-size islands with their jetty on the north side, so a boat heading for one sails round
// the coasts instead of stopping dead at the first beach: a coarse grid of open water, a shortest path across it, then the
// corners pulled tight. The room server and the game run the same code, so both agree on the route.
// boss 5 Nov ("fix the freeze"): planning used to test hundreds of thousands of water points the first time a boat left an
// island (about a second of a frozen room). The distance from any point to the nearest land of each island MAP is worked out
// once, on a 25-unit grid (island-maps.js); any island's sea is then a cheap lookup in its neighbours' maps.
const RES=FIELD_RES, PAD=FIELD_PAD;
// how far (x,y) in this island's sea is from the nearest land of any island (capped at PAD; 0 outside the sea)
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
  // The source chart is distance-expanding, so its straight-line steps travel
  // no farther on the sphere. Keep physical shore clearance independent of
  // distance from this chart's centre, including on the far side of a pole.
  return Math.max(0,Math.min(best-RES,isletClearance({x,y},PAD,id)));

}
const SAFE=BOAT_RADIUS+30;   // clear of every coast by the boat plus a margin bigger than the 25-unit grid's error
const clearLine=(id,a,b) => {   // a route leg is open water all along (review 5 Nov: never graze a beach)
  const len=Math.hypot(b.x-a.x,b.y-a.y), steps=Math.max(1,Math.ceil(len/6));
  for (let i=1;i<=steps;i++) {
    const x=a.x+(b.x-a.x)*i/steps, y=a.y+(b.y-a.y)*i/steps, room=clearance(id,x,y);
    if (room >= SAFE) {i+=Math.max(0,Math.floor((room*.85-SAFE)/6)); continue;}   // far from land: jump ahead (the chamfer field reads up to 8% long)
    for (let k=0;k<3;k++) {   // close to a jetty or beach: the exact test the boat itself uses, every 2px so nothing slips between
      const f=(i-k/3)/steps;
      const x=a.x+(b.x-a.x)*f,y=a.y+(b.y-a.y)*f;
      // Leave room between samples: a tangent shore hit can be shorter than
      // 2px and otherwise stop a sailor at a different simulation timestep.
      // Taper at the endpoints so any legal boarding/docking point stays valid.
      const margin=Math.min(4,len*f,len*(1-f));
      if (!canSail(x,y,id) || margin>0 && !canSail(x,y,id,BOAT_RADIUS+margin)) return false;
    }
  }
  return true;
};
// Resolve the 600-unit boat channels even after the distance field's error,
// boat margin and full-cell corner clearance. A 250-unit grid can close a
// real channel and discard the sea behind it as a disconnected component.
const CELL=125;
function gridFor(id) {
  fresh();
  if (!GRIDS.has(id)) {
    const b=seaBoundsFor(id), cols=Math.ceil((b.x1-b.x0)/CELL), rows=Math.ceil((b.y1-b.y0)/CELL), open=new Uint8Array(cols*rows);
    // a cell is open only if open water reaches past its corners, so the straight line to any open neighbour is water too
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
  const nearestOpen=p => {   // the closest open cell you can sail to in a straight line
    const c0=Math.floor((p.x-b.x0)/CELL), r0=Math.floor((p.y-b.y0)/CELL);
    for (let d=0;d<14;d++) for (let r=r0-d;r<=r0+d;r++) for (let c=c0-d;c<=c0+d;c++) {
      if (r<0||c<0||r>=rows||c>=cols||!open[r*cols+c]) continue;
      if (clearLine(id,p,centre(r*cols+c))) return r*cols+c;
    }
    return -1;
  };
  const connect=(p,step=60,limit=60)=>{
    const direct=nearestOpen(p);if(direct>=0)return {index:direct,points:[centre(direct)]};
    // A narrow curved harbour mouth can fit a boat but not a full ocean
    // cell. Search just that endpoint at boat scale, then join the ocean graph.
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
  // boss 8 Nov (sailable rivers): a river is only a little wider than the boat, so a 60-unit lattice can miss its channel;
  // try a 20-unit one over the same reach before giving up
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
  const route=[]; let at=from;   // pull the corners tight: reach as far along the path as a straight line allows
  for (let k=0;k<cells.length;) {
    if(!clearLine(id,at,cells[k]))return null;   // never hand the boat a leg that crosses land
    // Visibility checks sample complete shore geometry. Probe exponentially,
    // then bisect the first blocked interval instead of rechecking every cell.
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
    if (target && near(actor,target,1)) actor.sailTarget=actor.sailRoute?.shift() ?? null;   // next corner of the route
  }
  actor.travel=Math.hypot(actor.x-ox,actor.y-oy)/dt;
  actor.action=0;
  return actor.travel>0;
}

// allow(islandId): may this Ducky land there now (boss 6 Nov: an island holds up to 100 players; the room server says no
// to a full one, and the boat waits at its harbor mouth)
export function crossIsland(actor,allow=() => true) {
  if (actor.mode !== 'sailing') return false;
  const destination=destinationsFor(actor.islandId).find(island =>
    Math.abs(actor.x-island.dock.x)<=65 && Math.abs(actor.y-island.dock.y)<=50 &&
    (!actor.sailTarget || (Math.abs(actor.sailTarget.x-island.dock.x)<=65 && Math.abs(actor.sailTarget.y-island.dock.y)<=50)));
  if (!destination || !allow(destination.destination)) return false;
  Object.assign(actor,{islandId:destination.destination,...harborOf(destination.destination).water,turn:Math.PI,travel:0,path:[],sailTarget:null,sailRoute:null,docking:true,exitLocked:false});
  return true;
}
