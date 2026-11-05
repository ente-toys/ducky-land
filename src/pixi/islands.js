import world from '../../rive/web/world.json' with {type:'json'};
import shapes from './walk-shapes.json' with {type:'json'};
import {inPoly, inShape} from '../../rive/web/island-geometry.mjs';

export const ISLANDS = [
  {id:'home', name:'Home Island', accent:0xffda69},
  {id:'blossom', name:'Blossom Island', accent:0xf29bb7},
  {id:'sunset', name:'Sunset Island', accent:0xffa14f},
];
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
export const SEA_BOUNDS = {x0:-1800,y0:-3000,x1:world.width+1800,y1:world.height+1800};
export const ISLAND_SCALE = .13;
export const SEA_ISLANDS = [{x:900,y:-1800}, {x:3500,y:-2000}];
export const destinationsFor = id => ISLANDS.filter(island => island.id !== id).map((island,i) => ({...SEA_ISLANDS[i], destination:island.id, name:island.name, accent:island.accent, dock:{x:SEA_ISLANDS[i].x,y:SEA_ISLANDS[i].y+260}}));
export const offshoreProgress = player => player ? Math.max(0,Math.min(1,(660-player.y-450)/850)) : 1;   // 660: the old harbor line, so the clouds stay put
export const near = (a,b,radius) => Math.hypot(a.x-b.x,a.y-b.y) <= radius;

export function createBoats() {
  return ISLANDS.flatMap(island => [0,1,2].map(slot => ({id:`${island.id}-${slot}`, islandId:island.id,
    ...HARBOR.moorings[slot], turn:Math.PI, occupant:null, departure:island.id})));
}

function wet(x,y) {
  if (onJetty(x,y,4)) return false;
  if (x < SEA_BOUNDS.x0 || y < SEA_BOUNDS.y0 || x > SEA_BOUNDS.x1 || y > SEA_BOUNDS.y1 ||
      inPoly(x,y,shapes.coast) || inPoly(x,y,world.coast)) return false;
  for (const island of SEA_ISLANDS) {
    const lx=(x-island.x)/ISLAND_SCALE+world.width/2, ly=(y-island.y)/ISLAND_SCALE+world.height/2;
    if (inPoly(lx,ly,shapes.coast)) return false;
    if (Math.abs(x-island.x)<55 && y>island.y+150 && y<island.y+205) return false;
  }
  if (world.islets.some(([cx,cy,rx,ry]) => cx !== 3930 && inShape(x,y,{x:cx,y:cy,rx,ry}))) return false;
  return !world.walkways.filter(w => w.a[0] !== 3940).some(({a,b,w}) => {
    const dx=b[0]-a[0], dy=b[1]-a[1], t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));
    return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy) < w/2;
  });
}

export function canSail(x,y) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !wet(x,y)) return false;
  for (let i=0;i<16;i++) {
    const angle=i*Math.PI/8;
    if (!wet(x+Math.cos(angle)*BOAT_RADIUS,y+Math.sin(angle)*BOAT_RADIUS)) return false;
  }
  return true;
}

export function canDock(actor) {
  if (!near(actor,HARBOR.water,650)) return false;
  const distance=Math.hypot(actor.x-HARBOR.water.x,actor.y-HARBOR.water.y);
  const steps=Math.max(1,Math.ceil(distance/6));
  for (let i=0;i<=steps;i++) if (!canSail(actor.x+(HARBOR.water.x-actor.x)*i/steps,actor.y+(HARBOR.water.y-actor.y)*i/steps)) return false;
  return true;
}

export function setSailDestination(actor,x,y) {
  if (!canSail(x,y)) return null;
  actor.sailTarget={x,y};
  actor.docking=false;
  return [x,y];
}

export function sailStep(actor,dt,input) {
  const manual=Boolean(input.x || input.y);
  if (manual) {actor.sailTarget=null; actor.docking=false;}
  const target=actor.sailTarget;
  const dx=manual?input.x:target?target.x-actor.x:0, dy=manual?input.y:target?target.y-actor.y:0;
  const distance=Math.hypot(dx,dy);
  const travel=manual?SAIL_SPEED*dt:Math.min(SAIL_SPEED*dt,distance);
  const ox=actor.x, oy=actor.y;
  if (distance) {
    const steps=Math.ceil(travel/6);
    for (let i=0;i<steps;i++) {
      const x=actor.x+dx/distance*travel/steps, y=actor.y+dy/distance*travel/steps;
      if (!canSail(x,y)) {actor.sailTarget=null; actor.docking=false; break;}
      actor.x=x; actor.y=y;
    }
    actor.turn=Math.atan2(dx,dy);
    if (target && near(actor,target,1)) actor.sailTarget=null;
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
  Object.assign(actor,{islandId:destination.destination,...HARBOR.water,turn:Math.PI,travel:0,path:[],sailTarget:null,docking:true,exitLocked:false});
  return true;
}
