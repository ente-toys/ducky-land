// One deterministic position per star, around an observer near the origin.
// No wrapping, repeated layers or alternate intro geometry.
const TAU=Math.PI*2;
export const INTRO_MS=4400;
export const DEFAULT_FOV=78*Math.PI/180;
export function seeded(seed){return ()=>{seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export function universePosition(seed){
  const random=seeded(seed),longitude=random()*TAU-Math.PI;
  // A faint galactic belt plus a full spherical sky, including both poles.
  const latitude=random()<.38?(random()+random()+random()-1.5)*.20:Math.asin(random()*2-1);
  const radius=55+Math.pow(random(),.65)*1045;
  const horizontal=Math.cos(latitude)*radius;
  return {x:Math.sin(longitude)*horizontal,y:Math.sin(latitude)*radius,z:Math.cos(longitude)*horizontal,
    longitude,latitude,radius,phase:random()*TAU,hue:random()*4|0,size:random()<.97?.55+random()*.65:1.6+random()*1.4};
}
export function angleDelta(from,to){return Math.atan2(Math.sin(to-from),Math.cos(to-from));}
export function cameraBasis(camera){
  const sy=Math.sin(camera.yaw),cy=Math.cos(camera.yaw),sp=Math.sin(camera.pitch),cp=Math.cos(camera.pitch);
  // A small head translation makes nearby stars shift against distant ones
  // while the observer stays in the central region of the universe.
  const head=camera.head??1;
  return {sy,cy,sp,cp,x:camera.x+Math.sin(camera.yaw)*9*head,y:camera.y+Math.sin(camera.pitch)*5*head,z:camera.z+(Math.cos(camera.yaw)-1)*9*head};
}
export function projectStar(point,camera,width,height,basis=cameraBasis(camera)){
  const dx=point.x-basis.x,dy=point.y-basis.y,dz=point.z-basis.z;
  const x=basis.cy*dx-basis.sy*dz,z0=basis.sy*dx+basis.cy*dz;
  const y=basis.cp*dy-basis.sp*z0,z=basis.sp*dy+basis.cp*z0;
  const focal=height/(2*Math.tan(camera.fov/2));
  // Behind-camera labels use their bearing to reach the edge, never a mirrored
  // perspective projection that could make the same star appear twice.
  const divisor=z>2?z:Math.max(1,Math.hypot(x,y))*.35;
  return {x:width/2+x*focal/divisor,y:height/2-y*focal/divisor,z,
    visible:z>2&&Math.abs(x*focal/z)<width/2&&Math.abs(y*focal/z)<height/2,
    scale:Math.max(.55,Math.min(3.5,Math.sqrt(350/Math.max(2,z))))};
}
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function arrivalPose(elapsed,target,reduced=false){
  const progress=reduced?1:Math.max(0,Math.min(1,elapsed/INTRO_MS));
  const travel=smooth(progress),remaining=1-travel;
  const forward={x:Math.sin(target.yaw)*Math.cos(target.pitch),y:Math.sin(target.pitch),z:Math.cos(target.yaw)*Math.cos(target.pitch)};
  return {...target,x:target.x-forward.x*420*remaining,y:target.y-forward.y*420*remaining,z:target.z-forward.z*420*remaining,
    yaw:target.yaw-.20*remaining,pitch:target.pitch+.06*Math.sin(progress*Math.PI)*remaining,
    progress,exposure:smooth(progress/.09),lines:smooth((progress-.68)/.32),
    trails:Math.sin(progress*Math.PI)*.75,done:progress===1};
}
export function lookAt(point,camera){
  const dx=point.x-camera.x,dy=point.y-camera.y,dz=point.z-camera.z;
  return {...camera,yaw:Math.atan2(dx,dz),pitch:Math.atan2(dy,Math.hypot(dx,dz))};
}
