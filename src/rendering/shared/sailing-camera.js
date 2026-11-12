import {WORLD_ISLANDS} from '../../world/world-map.js';
import {mapOf,mapsVersion} from '../../world/island-maps.js';
import {coastPolygons} from '../../world/island-coasts.js';
import {flatRigid} from '../../world/rigid.js';
import {ISLETS} from '../../world/islets.js';
import {isletPlacement} from '../../world/islet-placement.js';

export const SAIL_TURN_SPEED=12*Math.PI/180;
export const SAIL_TURN_ACCELERATION=10*Math.PI/180;
const APPROACH=12000;
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const difference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

// Scalar shore queries: geometry is cached when the chart changes, with no
// point arrays, navigation searches or matrices allocated by the frame loop.
function shoreDistance(x,y,rings){
 let best=Infinity;
 for(const ring of rings){
  let inside=false;
  for(let j=0,k=ring.length-1;j<ring.length;k=j++){
   const a=ring[k],b=ring[j],dx=b[0]-a[0],dy=b[1]-a[1];
   if((a[1]>y)!==(b[1]>y)&&x<dx*(y-a[1])/dy+a[0])inside=!inside;
   const t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1));
   const ex=x-a[0]-t*dx,ey=y-a[1]-t*dy;
   best=Math.min(best,ex*ex+ey*ey);
  }
  if(inside)return 0;
 }
 return Math.sqrt(best);
}

export function createSailingCamera(){
 const basis={a:1,b:0,c:0,d:1};
 let from=null,version=-1,shores=[];
 return {basis,active:false,angle:0,velocity:0,targetAngle:0,targetId:null,islet:null,distance:Infinity,
  update(id,boat,dt,reduced=false,prior){
   dt=Math.max(0,dt);
   if(!this.active){this.angle=Math.atan2(prior?.b??0,prior?.a??1);this.velocity=0;}
   this.active=true;
   if(from!==id||version!==mapsVersion()){
    from=id;version=mapsVersion();
    shores=WORLD_ISLANDS.map(i=>{
     const m=mapOf(i.id),r=flatRigid(id,i.id);
     return {id:i.id,islet:null,r,dockX:m.JETTY.tip.x,dockY:m.JETTY.tip.y,angle:-Math.atan2(r.b,r.a),rings:coastPolygons(m.world,m.walk,{foot:[m.JETTY.foot.x,m.JETTY.foot.y],tip:[m.JETTY.tip.x,m.JETTY.tip.y],width:m.JETTY.width})};
    });
    for(const i of ISLETS){
     const p=isletPlacement(id,i),home=isletPlacement(i.home,i),r={a:p.cos,b:p.sin,c:-p.sin,d:p.cos,x:p.x,y:p.y,cx:0,cy:0};
     const {foot:a,tip:b,width:w}=i.jetty,dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy),nx=-dy/l*w/2,ny=dx/l*w/2;
     shores.push({id:i.home,islet:i.id,r,dockX:i.jetty.water[0],dockY:i.jetty.water[1],angle:difference(Math.atan2(home.sin,home.cos),Math.atan2(p.sin,p.cos)),rings:[i.coast,[[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]]]});
    }
    for(const s of shores){s.cos=Math.cos(s.angle);s.sin=Math.sin(s.angle);}
   }
   // A tiny neutral ocean weight also fades the target continuously to the
   // departure frame beyond all approach zones, rather than selecting a shore.
   let gap=Infinity,sx=1e-8,sy=0,best=0,nearest=null;
   const travel=clamp((boat.travel??0)/380);
   const vx=Math.sin(boat.turn??0),vy=Math.cos(boat.turn??0);
   for(const s of shores){
    const r=s.r,bx=boat.x-r.x,by=boat.y-r.y,x=r.cx+r.a*bx+r.b*by,y=r.cy+r.c*bx+r.d*by;
    const d=shoreDistance(x,y,s.rings);
    gap=Math.min(gap,d);
    if(d>=APPROACH)continue;
    // Every shore contributes. The broad inverse-square kernel starts a turn
    // early; the dock-bearing bonus resolves small islets in front of mainland.
    // Its 200-unit corridor has a smooth skirt, including grazing headings.
    // An extra inverse-square factor gives nearby docks a precise final frame.
    const dx=s.dockX-x,dy=s.dockY-y,hx=r.a*vx+r.b*vy,hy=r.c*vx+r.d*vy;
    const squared=dx*dx+dy*dy;
    let bonus=0;
    if(travel>0||squared<800*800){
     const length=Math.sqrt(squared),along=Math.max(0,dx*hx+dy*hy),across=dx*hy-dy*hx;
     // Retain the dock frame when stopping or passing the water anchor, where
     // the bearing itself becomes undefined. Both fades are continuous.
     const near=1-(1-smooth((420-length)/420))*(1-smooth((800-length)/380)*(1-travel));
     const heading=(along/(length||1))**8/(1+(across/200)**8);
     bonus=4096*(500/(length+500))**2*(1+(2600/(length+500))**2)*(near+(1-near)*heading*travel);
    }
    const falloff=smooth(1-d/APPROACH);
    const weight=falloff*((500/(d+500))**2+bonus);
    sx+=weight*s.cos;sy+=weight*s.sin;
    if(weight>best){best=weight;nearest=s;this.distance=d;}
   }
   if(nearest){this.targetId=nearest.id;this.islet=nearest.islet;}
   if(sx*sx+sy*sy>1e-20)this.targetAngle=Math.atan2(sy,sx);
   // Critical damping (x'' = w² error - 2w x') near rest. Softly limit
   // spring extension, so long turns round into the speed ceiling instead of
   // acquiring a linear, hard-clamped cruise. Limit acceleration independently.
   // The 12k approach begins early enough for the largest neighbour frames.
   const omega=(reduced?1.6:1.2)+(reduced?1.8:2)*smooth((APPROACH-gap)/9000);
   const extension=2*SAIL_TURN_SPEED/omega;
   // Only scalar integration is subdivided; shore geometry is queried once.
   // A <= 1/120 s step keeps 30/60/144 Hz paths together even under the caps.
   const steps=Math.max(1,Math.ceil(dt*120)),h=dt/steps;
   for(let k=0;k<steps;k++){
    const error=difference(this.targetAngle,this.angle);
    const force=omega*omega*extension*Math.tanh(error/extension)-2*omega*this.velocity;
    const acceleration=Math.max(-SAIL_TURN_ACCELERATION,Math.min(SAIL_TURN_ACCELERATION,force));
    const velocity=Math.max(-SAIL_TURN_SPEED,Math.min(SAIL_TURN_SPEED,this.velocity+acceleration*h));
    this.angle+=(this.velocity+velocity)*h/2;this.velocity=velocity;
   }
   const co=Math.cos(this.angle),si=Math.sin(this.angle);
   basis.a=basis.d=co;basis.b=si;basis.c=-si;
   return basis;
  },
 };
}
