import {WORLD_ISLANDS} from '../world/world-map.js';
import {mapOf,mapsVersion} from '../world/island-maps.js';
import {ISLETS} from '../world/islets.js';
import {coastPolygons,coastDistance} from '../world/island-coasts.js';
import {mapPoint} from '../world/sphere-coordinates.js';
import {seaCentreY} from '../world/rigid.js';
import {placeIslet} from '../world/islet-placement.js';
import {SAIL_SPEED} from './islands.js';
import {FLAT_RADIUS,nearestSeaImage,nearestSeaX} from '../world/flat-layout.js';
export const PIRATE_COUNT=18,PIRATE_RADIUS=360,PIRATE_BOAT_GAP=560;
export const PIRATE_ART=['p3_duckhull','p5_raft','p6_treasure'];
// The raft includes a painted rider: 420 keeps that Ducky at the seated player scale.
// Duck-shaped hulls remain boat-sized, rather than being treated as giant characters.
export const PIRATE_WIDTHS=Object.freeze([392.5,420,392.5]);
// Ships sail the flat chart in Home's map coordinates (p and dir are [x,y]), inside a ring round the archipelago.
const TAU=Math.PI*2,SEA=FLAT_RADIUS*1.45;
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const turn=(p,d,a)=>{const c=Math.cos(a),n=Math.sin(a);return [d[0]*c-d[1]*n,d[0]*n+d[1]*c];};
const advance=(p,d,distance)=>[p[0]+d[0]*distance,p[1]+d[1]*distance];
const delta=(a,b)=>[nearestSeaX(a[0],b[0])-b[0],a[1]-b[1]];
const distance=(a,b)=>Math.hypot(nearestSeaX(a[0],b[0])-b[0],a[1]-b[1]);
const YIELD_SPEED=SAIL_SPEED+130,YIELD_REACH=PIRATE_BOAT_GAP+100,YIELD_HORIZON=3;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let obstacleVersion=-1,obstacles=[];
function waterObstacles(){
 if(obstacleVersion===mapsVersion())return obstacles;obstacleVersion=mapsVersion();
 obstacles=WORLD_ISLANDS.map(island=>{const m=mapOf(island.id),c=mapPoint(island.id,'home',{x:m.cx,y:m.cy}),rings=coastPolygons(m.world,m.walk,{foot:[m.JETTY.foot.x,m.JETTY.foot.y],tip:[m.JETTY.tip.x,m.JETTY.tip.y],width:m.JETTY.width}).map(r=>r.map(([x,y])=>[x-m.cx,y-m.cy]));return{x:c.x,y:c.y,rings};});
 for(const i of ISLETS){const {foot:a,tip:b,width}=i.jetty,dx=b[0]-a[0],dy=b[1]-a[1],n=Math.hypot(dx,dy),x=-dy/n*width/2,y=dx/n*width/2,c=placeIslet('home',i,[0,0]);obstacles.push({x:c.x,y:c.y,rings:[i.coast,...i.blocked,[[a[0]+x,a[1]+y],[b[0]+x,b[1]+y],[b[0]-x,b[1]-y],[a[0]-x,a[1]-y]]]});}
 for(const o of obstacles)o.reach=Math.max(...o.rings.flat().map(p=>Math.hypot(...p)))+1700;
 const home=mapOf('home');obstacles.centre={x:home.cx,y:home.cy};
 return obstacles;
}
export function pirateClearance(p,limit=1500){
 const all=waterObstacles();let best=Math.min(limit,SEA-Math.hypot(p[0]-all.centre.x,p[1]-all.centre.y));
 if(best<=0)return 0;
 for(const o of all){const x=p[0]-o.x,y=p[1]-o.y;if(x*x+y*y>o.reach*o.reach)continue;best=Math.min(best,coastDistance(x,y,o.rings)/1.3);if(best===0)return 0;}
 return best;
}
export function createPirateFleet({count=PIRATE_COUNT,seed=713913}={}){
 const random=rng(seed),ships=[];let time=0,enabled=true,previousBoats=[];
 for(let k=0;k<count;k++){
  const c=waterObstacles().centre;
  let p;for(let attempt=0;attempt<600;attempt++){const a=(k*2.399963+random()*.9)%TAU,r=SEA*Math.sqrt(.04+random()*.9);p=[c.x+Math.cos(a)*r,c.y+Math.sin(a)*r];if(pirateClearance(p)>950&&ships.every(s=>distance(s.p,p)>1800))break;p=null;}
  if(!p)throw Error('No safe pirate sea spawn');const h=random()*TAU;
  ships.push({id:k,art:k%3,p,dir:[Math.cos(h),Math.sin(h)],speed:60+random()*40,velocity:0,rate:0,wantedRate:0,nextWander:random()*12,nextCheck:k*.2/count,phase:random()*TAU,width:PIRATE_WIDTHS[k%3],flip:1,flipAge:0});
 }
 function safe(p,boats,others,ship){return pirateClearance(p)>=PIRATE_RADIUS+80&&boats.every(b=>distance(p,b)>PIRATE_BOAT_GAP)&&others.every(s=>s===ship||distance(p,s.p)>800);}
 return {ships,get enabled(){return enabled;},set enabled(v){enabled=Boolean(v);},get time(){return time;},stats:{cpuMs:0,checks:0},
  update(dt,boats=[]){if(!enabled){this.stats.cpuMs=0;return;}const start=performance.now();dt=Math.min(.1,Math.max(0,dt));time+=dt;
   // Estimate occupied-boat velocity without retaining or modifying caller-owned points.
   // Match nearest positions, not array slots: room membership can change between frames.
   // The local boat can appear as both a room pose and a newer predicted pose.
   // Merge those near-identical contacts for steering, retaining every raw pose for the safety guard.
   const contacts=[];
   for(const p of boats){const duplicate=contacts.findIndex(q=>distance(p,q)<130);if(duplicate<0)contacts.push(p);else contacts[duplicate]=p;}
   const tracked=contacts.map(p=>{
    let previous=null,best=Infinity;for(const q of previousBoats){const d=distance(p,q);if(d<best){best=d;previous=q;}}
    let v=previous&&dt>0&&best<=SAIL_SPEED*dt*2+20?delta(p,previous).map(n=>n/dt):[0,0];
    const speed=Math.hypot(...v);if(speed>SAIL_SPEED)v=v.map(n=>n*SAIL_SPEED/speed);
    return {p,v};
   });
   previousBoats=contacts.map(p=>[p[0],p[1]]);
   for(const s of ships){
    if(time>s.nextWander){s.nextWander=time+12+random()*22;s.wantedRate=(random()-.5)*.07;}
    if(time>=s.nextCheck){s.nextCheck=time+.22;this.stats.checks++;s.clearance=pirateClearance(s.p);
     const look=advance(s.p,s.dir,420);
     if(!safe(look,boats,ships,s)){
      let chosen=null;
      for(const a of [.45,-.45,.9,-.9,1.4,-1.4,2,-2,Math.PI]){const d=turn(s.p,s.dir,a);if(safe(advance(s.p,d,450),boats,ships,s)){chosen=a;break;}}
      s.wantedRate=chosen===null?0:Math.sign(chosen)*.38;s.brake=chosen===null;
     }else s.brake=false;
     if(pirateClearance(advance(s.p,s.dir,18))<PIRATE_RADIUS+80)s.brake=true;
    }
    s.rate+=(s.wantedRate-s.rate)*(1-Math.exp(-2*dt));s.dir=turn(s.p,s.dir,s.rate*dt);
    const closeBoats=tracked.filter(b=>distance(s.p,b.p)<1300).length;
    let vx=s.dir[0]*(s.brake?0:s.speed),vy=s.dir[1]*(s.brake?0:s.speed),yielding=false;
    for(const boat of tracked){
     const [dx,dy]=delta(s.p,boat.p),r=Math.hypot(dx,dy);if(r>YIELD_REACH+SAIL_SPEED*YIELD_HORIZON)continue;
     const bv=Math.hypot(...boat.v),rvx=(s.moveVX??0)-boat.v[0],rvy=(s.moveVY??0)-boat.v[1],vv=rvx*rvx+rvy*rvy;
     const t=vv>1?clamp(-(dx*rvx+dy*rvy)/vv,0,YIELD_HORIZON):0;
     const future=Math.hypot(dx+rvx*t,dy+rvy*t);
     if(r>=YIELD_REACH&&(bv<10||t<=0||future>=YIELD_REACH))continue;
     yielding=true;
     if(bv>10&&t>0&&future<YIELD_REACH){
      const nx=-boat.v[1]/bv,ny=boat.v[0]/bv,side=dx*nx+dy*ny;
      // Pick a passing side from the actual offset; keep it while this encounter lasts.
      if(!s.yieldDirection||time>(s.yieldUntil??0)){
       const sign=Math.abs(side)>12?Math.sign(side):(s.id%2?-1:1);
       s.yieldDirection=[nx*sign,ny*sign];
      }
      s.yieldUntil=time+1;
      const passingSide=nx*s.yieldDirection[0]+ny*s.yieldDirection[1]>=0?1:-1;
      const speed=clamp((YIELD_REACH-Math.abs(side))/Math.max(.55,t-.5)+70,0,YIELD_SPEED);
      vx+=nx*passingSide*speed;vy+=ny*passingSide*speed;
     }
     if(closeBoats===1&&bv>10&&r<1300&&r>1){
      const nx=dx/r,ny=dy/r,closing=boat.v[0]*nx+boat.v[1]*ny;
      if(closing>0){
       const radial=Math.max(vx*nx+vy*ny,(closing+100)*clamp((1300-r)/500,0,1));
       const tangent=clamp(-vx*ny+vy*nx,-Math.sqrt(Math.max(0,YIELD_SPEED*YIELD_SPEED-radial*radial)),Math.sqrt(Math.max(0,YIELD_SPEED*YIELD_SPEED-radial*radial)));
       vx=nx*radial-ny*tangent;vy=ny*radial+nx*tangent;
      }
     }
     if(r<YIELD_REACH){
      const n=r>1?[dx/r,dy/r]:[-s.dir[1],s.dir[0]],speed=clamp((YIELD_REACH-r)*3+80,0,YIELD_SPEED);
      vx+=n[0]*speed;vy+=n[1]*speed;
     }
    }
    if(yielding)s.recoverUntil=time+2.5;
    if(!yielding&&time>(s.recoverUntil??0)){
     // Keep the existing cheap cruise path when there is no encounter to resolve.
     s.velocity+=((s.brake?0:s.speed)-s.velocity)*(1-Math.exp(-3*dt));
     const next=advance(s.p,s.dir,s.velocity*dt);
     if(boats.every(b=>distance(next,b)>PIRATE_BOAT_GAP))s.p=next;
     s.moveVX=s.dir[0]*s.velocity;s.moveVY=s.dir[1]*s.velocity;s.yielding=false;
     continue;
    }
    if(yielding&&Math.hypot(vx,vy)<1&&tracked.length){
     const [dx,dy]=delta(s.p,tracked[0].p),r=Math.hypot(dx,dy)||1;
     vx=-dy/r*YIELD_SPEED;vy=dx/r*YIELD_SPEED;
    }
    if(yielding&&pirateClearance([s.p[0]+vx*.8,s.p[1]+vy*.8])<PIRATE_RADIUS+80){
     for(const a of [.35,-.35,.7,-.7,1.1,-1.1,1.6,-1.6,2.2,-2.2,Math.PI]){
      const [x,y]=turn(null,[vx,vy],a);
      if(pirateClearance([s.p[0]+x*.8,s.p[1]+y*.8])>=PIRATE_RADIUS+100){vx=x;vy=y;break;}
     }
    }
    const wanted=Math.hypot(vx,vy);if(wanted>YIELD_SPEED){vx*=YIELD_SPEED/wanted;vy*=YIELD_SPEED/wanted;}
    const blend=1-Math.exp(-(yielding?6:3)*dt);
    let mx=(s.moveVX??0)+(vx-(s.moveVX??0))*blend,my=(s.moveVY??0)+(vy-(s.moveVY??0))*blend;
    const guardCoast=yielding||s.yielding||Math.hypot(mx,my)>s.speed+1||s.clearance<900;
    const coast=guardCoast?pirateClearance(s.p):1500;
    const boatSafe=p=>boats.every(b=>{const before=distance(s.p,b),after=distance(p,b);return after>PIRATE_BOAT_GAP||(before<=PIRATE_BOAT_GAP&&after>=before-1e-7);});
    const waterSafe=p=>(!guardCoast||pirateClearance(p)>=Math.min(PIRATE_RADIUS+80,coast))&&ships.every(other=>other===s||distance(p,other.p)>=Math.min(800,distance(s.p,other.p)));
    const step=(x,y)=>[s.p[0]+x*dt,s.p[1]+y*dt];
    let next=step(mx,my);
    if(!boatSafe(next)||!waterSafe(next)){
     // Slide around a shoreline/close boat instead of freezing the pirate inside its guard.
     // Rotations are of a bounded velocity, never a position correction or teleport.
     let found=false;for(const a of [.3,-.3,.6,-.6,1,-1,1.5,-1.5,2,-2,Math.PI]){
      const [x,y]=turn(null,[mx,my],a),p=step(x,y);
      if(boatSafe(p)&&waterSafe(p)){mx=x;my=y;next=p;found=true;break;}
     }
     if(!found){mx=my=0;next=s.p;}
    }
    s.p=next;s.moveVX=mx;s.moveVY=my;s.yielding=yielding;s.velocity=Math.hypot(mx,my);
    if(s.velocity>1)s.dir=[mx/s.velocity,my/s.velocity];
   }
   this.stats.cpuMs=performance.now()-start;
  }
 };
}
export function pirateMotion(ship,t,reduced=false){return{bob:reduced?0:Math.sin(t*1.15+ship.phase)*2.3,roll:reduced?0:Math.sin(t*.73+ship.phase)*.012};}
export function pirateFacing(ship,horizontal,dt){const next=horizontal>.18?1:horizontal<-.18?-1:ship.flip;if(next!==ship.flip){ship.flipAge+=dt;if(ship.flipAge>.8){ship.flip=next;ship.flipAge=0;}}else ship.flipAge=0;return ship.flip;}
export const pirateLocal=(id,p,reference=null)=>{const q=mapPoint('home',id,{x:p[0],y:p[1]});return Number.isFinite(reference?.x)?nearestSeaImage(q.x,q.y,reference,seaCentreY(id)):q;};
export const pirateBoatPoint=(boat,id)=>{const q=mapPoint(boat.islandId??id,'home',boat);const image=nearestSeaImage(q.x,q.y,{x:mapOf('home').cx,y:mapOf('home').cy},seaCentreY('home'));return [image.x,image.y];};
