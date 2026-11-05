import world from '../../rive/web/world.json' with {type:'json'};
import shapes from './walk-shapes.json' with {type:'json'};
import {inPoly, inShape} from '../../rive/web/island-geometry.mjs';

import {WORLD_ISLANDS, neighboursOf, offsetOf} from './world-map.js';

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
export function boardingPoint(boat) {
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

export function createBoats() {
  return ISLANDS.flatMap(island => [0,1,2].map(slot => ({id:`${island.id}-${slot}`, islandId:island.id,
    ...HARBOR.moorings[slot], turn:Math.PI, occupant:null, departure:island.id})));
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
const CELL=250, GRIDS=new Map();
const clearLine=(id,a,b) => {   // checked every 6px with a 10px margin either side, so a route never grazes a beach (review 5 Nov)
  const len=Math.hypot(b.x-a.x,b.y-a.y), steps=Math.max(1,Math.ceil(len/6)), nx=len ? -(b.y-a.y)/len*10 : 0, ny=len ? (b.x-a.x)/len*10 : 0;
  for (let i=1;i<=steps;i++) {
    const x=a.x+(b.x-a.x)*i/steps, y=a.y+(b.y-a.y)*i/steps;
    if (!canSail(x,y,id) || (i<steps && (!canSail(x+nx,y+ny,id) || !canSail(x-nx,y-ny,id)))) return false;
  }
  return true;
};
function gridFor(id) {
  if (!GRIDS.has(id)) {
    const b=seaBoundsFor(id), cols=Math.ceil((b.x1-b.x0)/CELL), rows=Math.ceil((b.y1-b.y0)/CELL), open=new Uint8Array(cols*rows);
    // a cell is open only if its whole neighbourhood is water, so the straight line to any open neighbour is water too
    const ring=[...Array(12)].map((_,k) => [Math.cos(k*Math.PI/6),Math.sin(k*Math.PI/6)]);
    for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) {
      const x=b.x0+(c+.5)*CELL, y=b.y0+(r+.5)*CELL;
      open[r*cols+c]=canSail(x,y,id) && ring.every(([u,v]) => canSail(x+u*CELL*.4,y+v*CELL*.4,id) && canSail(x+u*CELL*.75,y+v*CELL*.75,id))?1:0;
    }
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
