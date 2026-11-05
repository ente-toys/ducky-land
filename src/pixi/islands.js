import world from '../../rive/web/world.json' with {type:'json'};
import shapes from './walk-shapes.json' with {type:'json'};
import {inPoly, inShape} from '../../rive/web/island-geometry.mjs';

import {WORLD_ISLANDS, neighboursOf, offsetOf} from './world-map.js';
import {createNavigation} from './navigation.js';
import walkWorld from '../../rive/web/walk-world.json' with {type:'json'};

// boss 5 Nov: 300 islands, each an exact copy of home (world-map.js). You play on one; the nearest four are a sail away.
export const ISLANDS = WORLD_ISLANDS.map(({id,name,accent}) => ({id,name,accent}));
export const islandFor = id => ISLANDS.find(island => island.id === id);
// boss 5 Nov: the harbor is a real wooden jetty. Its foot is on the north lawn, its deck runs out over the water, Ducky walks it to
// the boats moored along both sides. land = the deck end you board from and land on, water = where a boat docks, beside the tip.
const FOOT={x:1726,y:830}, TIP={x:1640,y:400}, JETTY_W=104, AXIS=Math.hypot(TIP.x-FOOT.x,TIP.y-FOOT.y);
const DIR={x:(TIP.x-FOOT.x)/AXIS,y:(TIP.y-FOOT.y)/AXIS}, along=(t,side=0) => ({x:FOOT.x+DIR.x*t-DIR.y*side,y:FOOT.y+DIR.y*t+DIR.x*side});
export const JETTY={foot:FOOT, tip:TIP, width:JETTY_W, length:AXIS, angle:Math.atan2(DIR.x,-DIR.y), wetFrom:.14,
  walkway:{a:[Math.round(along(-55).x),Math.round(along(-55).y)], b:[Math.round(along(AXIS-44).x),Math.round(along(AXIS-44).y)], w:JETTY_W}};
const axisX=y => FOOT.x+(y-FOOT.y)*DIR.x/DIR.y;
// nine berths (a whole fleet can end up at one island): two each side staggered so no sail hides another, bows to the deck,
// three off the tip, then two anchored further out (no bollard, no rope)
const berth=(y,side) => ({x:Math.round(axisX(y)+side),y});
const MOORINGS=[berth(640,150),berth(570,-150),berth(490,150),berth(420,-150),{x:TIP.x-175,y:285},{x:TIP.x+175,y:300},{x:TIP.x,y:205},
  berth(560,390),berth(560,-390)];
export const HARBOR = {land:{x:JETTY.walkway.b[0],y:JETTY.walkway.b[1]}, water:{x:Math.round(along(AXIS+20,125).x),y:Math.round(along(AXIS+20,125).y)},
  pier:{x:Math.min(FOOT.x,TIP.x)-JETTY_W/2,y:TIP.y,width:Math.abs(FOOT.x-TIP.x)+JETTY_W,height:FOOT.y-TIP.y}, moorings:MOORINGS};
// the server and the live client walk the same harbor: the jetty deck is a walkway, and the lawn at its foot is cleared of props
export const harborWorld = w => ({...w, walkways:[...w.walkways, JETTY.walkway]});
export const harborClear = prop => Math.hypot(prop.x-FOOT.x-20,prop.y-FOOT.y-110) > 200;
// boss 5 Nov: walk to the deck beside your boat, then step in
export function boardingPoint(boat,nav) {
  if (!near(boat,HARBOR.water,600)) return shoreFor(boat.x,boat.y,nav ?? defaultNav()) ?? {x:Math.round(boat.x),y:Math.round(boat.y)};   // a beach or islet boat: step in from the nearest sand
  const t=Math.max(AXIS*JETTY.wetFrom,Math.min(AXIS-44,(boat.x-FOOT.x)*DIR.x+(boat.y-FOOT.y)*DIR.y));
  const side=Math.sign((boat.x-FOOT.x)*-DIR.y+(boat.y-FOOT.y)*DIR.x)*(t >= AXIS-45 ? 0 : 18), p=along(t,side);
  return {x:Math.round(p.x),y:Math.round(p.y)};
}
const onJetty=(x,y,pad) => {
  const t=Math.max(0,Math.min(AXIS,(x-FOOT.x)*DIR.x+(y-FOOT.y)*DIR.y)), p=along(t);
  return Math.hypot(x-p.x,y-p.y) < JETTY_W/2+pad;
};
export const BOAT_RADIUS = 46;
export const SAIL_SPEED = 380;
// the sea you can sail: round this island and its four neighbours (every island is the same map, shifted)
const MARGIN=1800;
const DEST=new Map(), BOUNDS=new Map();
export const destinationsFor = id => {
  if (!DEST.has(id)) DEST.set(id,neighboursOf(id).map(({island,x,y}) => ({x:world.width/2+x, y:world.height/2+y, offset:{x,y},
    destination:island.id, name:island.name, accent:island.accent, dock:{x:HARBOR.water.x+x,y:HARBOR.water.y+y}})));
  return DEST.get(id);
};
export function seaBoundsFor(id='home') {
  if (!BOUNDS.has(id)) {
    const offsets=[{x:0,y:0},...destinationsFor(id).map(d => d.offset)];
    BOUNDS.set(id,{x0:Math.min(...offsets.map(o => o.x))-MARGIN, y0:Math.min(...offsets.map(o => o.y))-MARGIN-1200,
      x1:Math.max(...offsets.map(o => o.x))+world.width+MARGIN, y1:Math.max(...offsets.map(o => o.y))+world.height+MARGIN});
  }
  return BOUNDS.get(id);
}
export const SEA_BOUNDS = seaBoundsFor('home');
export const offshoreProgress = player => player ? Math.max(0,Math.min(1,(660-player.y-450)/850)) : 1;   // 660: the old harbor line, so the clouds stay put
export const near = (a,b,radius) => Math.hypot(a.x-b.x,a.y-b.y) <= radius;

// boss 5 Nov: "we can take boats from any place and dock any place". Every island has the same real boats: three at the
// harbor jetty, one off each little jetty islet, and four moored off the north-west beach. Fixed spots, so every player
// sees the same boats (they replace the decoration boats in live play).
let SPOTS=null;
export const boatSpots=() => SPOTS ??= (() => {
  const spots=[0,1,2].map(i => ({...HARBOR.moorings[i],turn:Math.PI}));
  const centre={x:2980,y:2005};
  for (const [cx,cy,rx,ry] of world.islets) if (cx !== 3930) {   // the east islet is gone (trimWorld)
    const a=Math.atan2(cy-centre.y,cx-centre.x);
    spots.push({x:Math.round(cx+Math.cos(a)*(rx*1.25+70)),y:Math.round(cy+Math.sin(a)*(ry*1.25+55)),turn:Math.cos(a)<0?-Math.PI/2:Math.PI/2});
  }
  // four boats off the west and north-west beaches: walk out from the island's middle to the first open water, then a bit more
  for (const deg of [150,175,200,225]) {
    const a=deg*Math.PI/180;
    for (let r=600;r<5000;r+=20) {
      const x=centre.x+Math.cos(a)*r*1.3, y=centre.y+Math.sin(a)*r;
      if (!landAt(x,y) && !landAt(x+Math.cos(a)*60,y+Math.sin(a)*60) && Math.hypot(x-HARBOR.water.x,y-HARBOR.water.y) > 700) {
        const bx=Math.round(x+Math.cos(a)*85), by=Math.round(y+Math.sin(a)*85);
        if (spots.every(o => Math.hypot(o.x-bx,o.y-by) > 300) && !defaultNav().walkable(bx,by) && canSail(bx,by) && shoreFor(bx,by,defaultNav(),200)) spots.push({x:bx,y:by,turn:-Math.PI/2});
        break;
      }
    }
  }
  return spots;
})();
export function createBoats() {
  return ISLANDS.flatMap(island => boatSpots().map((spot,slot) => ({id:`${island.id}-${slot}`, islandId:island.id,
    x:spot.x, y:spot.y, turn:spot.turn, occupant:null, departure:island.id})));
}
export const boatHome = boat => boat.id.slice(0,boat.id.lastIndexOf('-'));
export const boatSpot = boat => boatSpots()[Number(boat.id.slice(boat.id.lastIndexOf('-')+1))] ?? boatSpots()[0];

// the walking map every island shares (the same file the room server walks on)
let NAV=null;
const defaultNav=() => NAV ??= createNavigation({...world, ...walkWorld});
// where you step on and off a boat moored away from the harbor: the nearest land you can stand on
const shoreFor=(x,y,nav,reach=280) => {const p=nav.nearest(x,y,reach); return p ? {x:Math.round(p[0]),y:Math.round(p[1])} : null;};
// boss 5 Nov: when you sail close to any shore (this island's or a neighbour's) you can dock and hop out there
export function landingSpot(actor,nav=defaultNav(),reach=420) {   // the walking map keeps Duckies a little back from the waterline
  let best=null;
  for (const o of [{x:0,y:0,id:actor.islandId},...destinationsFor(actor.islandId).map(d => ({...d.offset,id:d.destination}))]) {
    const lx=actor.x-o.x, ly=actor.y-o.y;
    if (lx < -reach || ly < -reach || lx > world.width+reach || ly > world.height+reach) continue;
    const p=shoreFor(lx,ly,nav,reach);
    if (p && (!best || Math.hypot(p.x-lx,p.y-ly) < best.d)) best={islandId:o.id,offset:{x:o.x,y:o.y},x:p.x,y:p.y,d:Math.hypot(p.x-lx,p.y-ly)};
  }
  return best;
}

// land on one island, in its own local coordinates (the home map)
function landAt(x,y) {
  if (x < -600 || y < -600 || x > world.width+600 || y > world.height+600) return false;   // nowhere near this island
  if (onJetty(x,y,4) || inPoly(x,y,shapes.coast) || inPoly(x,y,world.coast)) return true;
  if (world.islets.some(([cx,cy,rx,ry]) => cx !== 3930 && inShape(x,y,{x:cx,y:cy,rx,ry}))) return true;
  return world.walkways.filter(w => w.a[0] !== 3940).some(({a,b,w}) => {
    const dx=b[0]-a[0], dy=b[1]-a[1], t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));
    return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy) < w/2;
  });
}

// every island drawn inside this sea is solid land, not only the ones you can dock at (review 5 Nov)
const OBSTACLES=new Map();
const obstaclesFor=id => {
  if (!OBSTACLES.has(id)) {
    const b=seaBoundsFor(id);
    OBSTACLES.set(id,WORLD_ISLANDS.filter(island => island.id!==id).map(island => offsetOf(id,island.id))
      .filter(o => o.x+world.width+600 > b.x0 && o.x-600 < b.x1 && o.y+world.height+600 > b.y0 && o.y-600 < b.y1));
  }
  return OBSTACLES.get(id);
};
function wet(x,y,id) {
  const b=seaBoundsFor(id);
  if (x < b.x0 || y < b.y0 || x > b.x1 || y > b.y1 || landAt(x,y)) return false;
  return !obstaclesFor(id).some(o => landAt(x-o.x,y-o.y));
}

export function canSail(x,y,id='home') {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !wet(x,y,id)) return false;
  for (let i=0;i<16;i++) {
    const angle=i*Math.PI/8;
    if (!wet(x+Math.cos(angle)*BOAT_RADIUS,y+Math.sin(angle)*BOAT_RADIUS,id)) return false;
  }
  return true;
}

export function canDock(actor) {
  if (!near(actor,HARBOR.water,650)) return false;
  const distance=Math.hypot(actor.x-HARBOR.water.x,actor.y-HARBOR.water.y);
  const steps=Math.max(1,Math.ceil(distance/6));
  for (let i=0;i<=steps;i++) if (!canSail(actor.x+(HARBOR.water.x-actor.x)*i/steps,actor.y+(HARBOR.water.y-actor.y)*i/steps,actor.islandId)) return false;
  return true;
}

// boss 5 Nov: neighbours are full-size islands with their jetty on the north side, so a boat heading for one sails round
// the coasts instead of stopping dead at the first beach: a coarse grid of open water, a shortest path across it, then the
// corners pulled tight. The room server and the game run the same code, so both agree on the route.
// boss 5 Nov ("fix the freeze"): planning used to test hundreds of thousands of water points the first time a boat left an
// island (about a second of a frozen room). Every island is the same map shifted, so the distance from any point to the
// nearest land of the home island is worked out once, on a 25-unit grid; any island's sea is then a cheap lookup.
const RES=25, PAD=700, FX0=-PAD, FY0=-PAD, FW=Math.ceil((world.width+2*PAD)/RES), FH=Math.ceil((world.height+2*PAD)/RES);
let FIELD=null;
function landDistance() {
  if (FIELD) return FIELD;
  const d=new Float32Array(FW*FH).fill(1e9);
  const h=RES/2, subs=[[0,0],[-h,-h],[h,-h],[-h,h],[h,h]];   // the centre and four corners, so land smaller than a sample is still seen
  for (let r=0;r<FH;r++) for (let c=0;c<FW;c++) {
    const x=FX0+c*RES, y=FY0+r*RES;
    if (subs.some(([u,v]) => landAt(x+u,y+v))) d[r*FW+c]=0;
  }
  const D=RES, DD=RES*Math.SQRT2;   // two-pass chamfer distance, in world units
  for (let r=0;r<FH;r++) for (let c=0;c<FW;c++) {
    const i=r*FW+c; let v=d[i];
    if (c>0) v=Math.min(v,d[i-1]+D);
    if (r>0) {v=Math.min(v,d[i-FW]+D); if (c>0) v=Math.min(v,d[i-FW-1]+DD); if (c<FW-1) v=Math.min(v,d[i-FW+1]+DD);}
    d[i]=v;
  }
  for (let r=FH-1;r>=0;r--) for (let c=FW-1;c>=0;c--) {
    const i=r*FW+c; let v=d[i];
    if (c<FW-1) v=Math.min(v,d[i+1]+D);
    if (r<FH-1) {v=Math.min(v,d[i+FW]+D); if (c<FW-1) v=Math.min(v,d[i+FW+1]+DD); if (c>0) v=Math.min(v,d[i+FW-1]+DD);}
    d[i]=v;
  }
  return FIELD=d;
}
// how far (x,y) in this island's sea is from the nearest land of any island (capped at PAD; 0 outside the sea)
function clearance(id,x,y) {
  const b=seaBoundsFor(id);
  if (x < b.x0 || y < b.y0 || x > b.x1 || y > b.y1) return 0;
  const d=landDistance(); let best=PAD;
  for (const o of [{x:0,y:0},...obstaclesFor(id)]) {
    const c=Math.round((x-o.x-FX0)/RES), r=Math.round((y-o.y-FY0)/RES);
    if (c<0 || r<0 || c>=FW || r>=FH) continue;
    best=Math.min(best,d[r*FW+c]);
  }
  return Math.max(0,best-RES);   // a thin walkway or jetty can sit between samples: count it as one sample closer
}
const SAFE=BOAT_RADIUS+30;   // clear of every coast by the boat plus a margin bigger than the 25-unit grid's error
const clearLine=(id,a,b) => {   // a route leg is open water all along (review 5 Nov: never graze a beach)
  const len=Math.hypot(b.x-a.x,b.y-a.y), steps=Math.max(1,Math.ceil(len/6));
  for (let i=1;i<=steps;i++) {
    const x=a.x+(b.x-a.x)*i/steps, y=a.y+(b.y-a.y)*i/steps, room=clearance(id,x,y);
    if (room >= SAFE) {i+=Math.max(0,Math.floor((room*.85-SAFE)/6)); continue;}   // far from land: jump ahead (the chamfer field reads up to 8% long)
    for (let k=0;k<3;k++) {   // close to a jetty or beach: the exact test the boat itself uses, every 2px so nothing slips between
      const f=(i-k/3)/steps;
      if (!canSail(a.x+(b.x-a.x)*f,a.y+(b.y-a.y)*f,id)) return false;
    }
  }
  return true;
};
const CELL=250, GRIDS=new Map();
function gridFor(id) {
  if (!GRIDS.has(id)) {
    const b=seaBoundsFor(id), cols=Math.ceil((b.x1-b.x0)/CELL), rows=Math.ceil((b.y1-b.y0)/CELL), open=new Uint8Array(cols*rows);
    // a cell is open only if open water reaches past its corners, so the straight line to any open neighbour is water too
    for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) open[r*cols+c]=clearance(id,b.x0+(c+.5)*CELL,b.y0+(r+.5)*CELL)*.9 >= CELL*.71+SAFE ? 1 : 0;
    GRIDS.set(id,{b,cols,rows,open});
  }
  return GRIDS.get(id);
}
export function sailRoute(id,from,to) {
  if (clearLine(id,from,to)) return [to];
  const {b,cols,rows,open}=gridFor(id), centre=i => ({x:b.x0+(i%cols+.5)*CELL,y:b.y0+(Math.floor(i/cols)+.5)*CELL});
  const nearestOpen=p => {   // the closest open cell you can sail to in a straight line
    const c0=Math.floor((p.x-b.x0)/CELL), r0=Math.floor((p.y-b.y0)/CELL);
    for (let d=0;d<4;d++) for (let r=r0-d;r<=r0+d;r++) for (let c=c0-d;c<=c0+d;c++) {
      if (r<0||c<0||r>=rows||c>=cols||!open[r*cols+c]) continue;
      if (clearLine(id,p,centre(r*cols+c))) return r*cols+c;
    }
    return -1;
  };
  const start=nearestOpen(from), goal=nearestOpen(to);
  if (start<0 || goal<0) return null;
  const prev=new Int32Array(cols*rows).fill(-1), queue=[start]; prev[start]=start;
  for (let q=0;q<queue.length && prev[goal]<0;q++) {
    const i=queue[q], c=i%cols, r=Math.floor(i/cols);
    for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) {
      const nr=r+dr, nc=c+dc, n=nr*cols+nc;
      if ((dr||dc) && nr>=0 && nc>=0 && nr<rows && nc<cols && open[n] && prev[n]<0 && (!dr||!dc||open[r*cols+nc]&&open[nr*cols+c])) {prev[n]=i; queue.push(n);}
    }
  }
  if (prev[goal]<0) return null;
  const cells=[];
  for (let i=goal;i!==start;i=prev[i]) cells.push(centre(i));
  cells.push(centre(start)); cells.reverse(); cells.push(to);
  const route=[]; let at=from;   // pull the corners tight: reach as far along the path as a straight line allows
  for (let k=0;k<cells.length;) {
    if (!clearLine(id,at,cells[k])) return null;   // never hand the boat a leg that crosses land
    let j=k;
    while (j+1<cells.length && clearLine(id,at,cells[j+1])) j++;
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

export function crossIsland(actor) {
  if (actor.mode !== 'sailing') return false;
  const destination=destinationsFor(actor.islandId).find(island =>
    Math.abs(actor.x-island.dock.x)<=65 && Math.abs(actor.y-island.dock.y)<=50);
  if (!destination) return false;
  Object.assign(actor,{islandId:destination.destination,...HARBOR.water,turn:Math.PI,travel:0,path:[],sailTarget:null,sailRoute:null,docking:true,exitLocked:false});
  return true;
}
