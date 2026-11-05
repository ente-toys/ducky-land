import world from '../../rive/web/world.json' with {type:'json'};
import shapes from './walk-shapes.json' with {type:'json'};
import {inPoly, inShape} from '../../rive/web/island-geometry.mjs';

export const ISLANDS = [
  {id:'home', name:'Home Island', accent:0xffda69},
  {id:'blossom', name:'Blossom Island', accent:0xf29bb7},
  {id:'sunset', name:'Sunset Island', accent:0xffa14f},
];
export const islandFor = id => ISLANDS.find(island => island.id === id);
export const HARBOR = {land:{x:1800,y:930}, water:{x:1800,y:660}, pier:{x:1735,y:745,width:130,height:210}};
export const BOAT_RADIUS = 46;
export const SAIL_SPEED = 380;
export const SEA_BOUNDS = {x0:-1800,y0:-3000,x1:world.width+1800,y1:world.height+1800};
export const ISLAND_SCALE = .13;
export const SEA_ISLANDS = [{x:900,y:-1800}, {x:3500,y:-2000}];
export const destinationsFor = id => ISLANDS.filter(island => island.id !== id).map((island,i) => ({...SEA_ISLANDS[i], destination:island.id, name:island.name, accent:island.accent, dock:{x:SEA_ISLANDS[i].x,y:SEA_ISLANDS[i].y+260}}));
export const offshoreProgress = player => player ? Math.max(0,Math.min(1,(HARBOR.water.y-player.y-450)/850)) : 1;
export const near = (a,b,radius) => Math.hypot(a.x-b.x,a.y-b.y) <= radius;

export function createBoats() {
  return ISLANDS.flatMap(island => [0,1,2].map(slot => ({id:`${island.id}-${slot}`, islandId:island.id,
    x:1650+slot*150, y:660, turn:Math.PI, occupant:null, departure:island.id})));
}

function wet(x,y) {
  const pier=HARBOR.pier;
  if (x>=pier.x && x<=pier.x+pier.width && y>=pier.y && y<=pier.y+pier.height) return false;
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
