import {WORLD_ISLANDS} from '../world/world-map.js';
import {mapOf,mapsVersion} from '../world/island-maps.js';
import {ISLETS} from '../world/islets.js';
import {coastPolygons,coastDistance} from '../world/island-coasts.js';
import {mapPoint} from '../world/sphere-coordinates.js';
import {placeIslet} from '../world/islet-placement.js';
import {FLAT_RADIUS} from '../world/flat-layout.js';
export const PIRATE_COUNT=18,PIRATE_RADIUS=360,PIRATE_BOAT_GAP=560;
export const PIRATE_ART=['p3_duckhull','p5_raft','p6_treasure'];
// Ships sail the flat chart in Home's map coordinates (p and dir are [x,y]), inside a ring round the archipelago.
const TAU=Math.PI*2,SEA=FLAT_RADIUS*1.45;
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const turn=(p,d,a)=>{const c=Math.cos(a),n=Math.sin(a);return [d[0]*c-d[1]*n,d[0]*n+d[1]*c];};
const advance=(p,d,distance)=>[p[0]+d[0]*distance,p[1]+d[1]*distance];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
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
 const random=rng(seed),ships=[];let time=0,enabled=true;
 for(let k=0;k<count;k++){
  const c=waterObstacles().centre;
  let p;for(let attempt=0;attempt<600;attempt++){const a=(k*2.399963+random()*.9)%TAU,r=SEA*Math.sqrt(.04+random()*.9);p=[c.x+Math.cos(a)*r,c.y+Math.sin(a)*r];if(pirateClearance(p)>950&&ships.every(s=>distance(s.p,p)>1800))break;p=null;}
  if(!p)throw Error('No safe pirate sea spawn');const h=random()*TAU;
  ships.push({id:k,art:k%3,p,dir:[Math.cos(h),Math.sin(h)],speed:9+random()*8,velocity:0,rate:0,wantedRate:0,nextWander:random()*12,nextCheck:k*.2/count,phase:random()*TAU,width:[620,600,600][k%3],flip:1,flipAge:0});
 }
 function safe(p,boats,others,ship){return pirateClearance(p)>=PIRATE_RADIUS+80&&boats.every(b=>distance(p,b)>PIRATE_BOAT_GAP)&&others.every(s=>s===ship||distance(p,s.p)>800);}
 return {ships,get enabled(){return enabled;},set enabled(v){enabled=Boolean(v);},get time(){return time;},stats:{cpuMs:0,checks:0},
  update(dt,boats=[]){if(!enabled){this.stats.cpuMs=0;return;}const start=performance.now();dt=Math.min(.1,Math.max(0,dt));time+=dt;
   for(const s of ships){
    if(time>s.nextWander){s.nextWander=time+12+random()*22;s.wantedRate=(random()-.5)*.07;}
    if(time>=s.nextCheck){s.nextCheck=time+.22;this.stats.checks++;
     const look=advance(s.p,s.dir,420);
     if(!safe(look,boats,ships,s)){
      let chosen=null;
      for(const a of [.45,-.45,.9,-.9,1.4,-1.4,2,-2,Math.PI]){const d=turn(s.p,s.dir,a);if(safe(advance(s.p,d,450),boats,ships,s)){chosen=a;break;}}
      s.wantedRate=chosen===null?0:Math.sign(chosen)*.38;s.brake=chosen===null;
     }else s.brake=false;
     if(pirateClearance(advance(s.p,s.dir,18))<PIRATE_RADIUS+80)s.brake=true;
    }
    s.rate+=(s.wantedRate-s.rate)*(1-Math.exp(-2*dt));s.dir=turn(s.p,s.dir,s.rate*dt);
    s.velocity+=((s.brake?0:s.speed)-s.velocity)*(1-Math.exp(-3*dt));
    const next=advance(s.p,s.dir,s.velocity*dt);
    if(boats.every(b=>distance(next,b)>PIRATE_BOAT_GAP))s.p=next;
   }
   this.stats.cpuMs=performance.now()-start;
  }
 };
}
export function pirateMotion(ship,t,reduced=false){return{bob:reduced?0:Math.sin(t*1.15+ship.phase)*2.3,roll:reduced?0:Math.sin(t*.73+ship.phase)*.012};}
export function pirateFacing(ship,horizontal,dt){const next=horizontal>.18?1:horizontal<-.18?-1:ship.flip;if(next!==ship.flip){ship.flipAge+=dt;if(ship.flipAge>.8){ship.flip=next;ship.flipAge=0;}}else ship.flipAge=0;return ship.flip;}
export const pirateLocal=(id,p)=>mapPoint('home',id,{x:p[0],y:p[1]});
export const pirateBoatPoint=(boat,id)=>{const q=mapPoint(boat.islandId??id,'home',boat);return [q.x,q.y];};
