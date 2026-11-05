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
export const EXITS = [{x:1000,y:300,radius:125}, {x:3100,y:220,radius:125}];
export const exitsFor = id => ISLANDS.filter(island => island.id !== id).map((island,i) => ({...EXITS[i], destination:island.id, name:island.name}));
export const arrivalFor = boatId => ({x:1710 + Number(boatId.at(-1)) * 90, y:430});
export const near = (a,b,radius) => Math.hypot(a.x-b.x,a.y-b.y) <= radius;

export function createBoats() {
  return ISLANDS.flatMap(island => [0,1,2].map(slot => ({id:`${island.id}-${slot}`, islandId:island.id,
    x:1650+slot*150, y:660, turn:0, occupant:null, departure:island.id})));
}

function wet(x,y) {
  const pier=HARBOR.pier;
  if (x>=pier.x && x<=pier.x+pier.width && y>=pier.y && y<=pier.y+pier.height) return false;
  if (x < 60 || y < 60 || x > world.width-60 || y > world.height-60 ||
      inPoly(x,y,shapes.coast) || inPoly(x,y,world.coast)) return false;
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
  const arrival=arrivalFor(actor.boatId);
  if (actor.exitLocked) {
    if (!near(actor,arrival,180)) actor.exitLocked=false;
    return false;
  }
  const exit=exitsFor(actor.islandId).find(exit => near(actor,exit,exit.radius));
  if (!exit) return false;
  Object.assign(actor,{islandId:exit.destination,...arrival,turn:0,travel:0,path:[],sailTarget:null,docking:false,exitLocked:true});
  return true;
}
