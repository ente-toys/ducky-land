import {easeCamera} from '../../../assets/world/island-camera.mjs';

export function easeZoomCamera(camera, target, motion, dt, reduced = false, panRate = 14) {
  const error=Math.log(camera.zoom/target.zoom);
  if(reduced || Math.abs(error)<1e-6) {
    motion.velocity=0;
    easeCamera(camera,target,dt,reduced,panRate);
    return;
  }
  const omega=16, maxSpeed=4.5;
  let velocity=motion.velocity ?? 0;
  if(velocity*error>0) velocity=0;
  const decay=Math.exp(-omega*dt), c=velocity+omega*error;
  const nextError=(error+c*dt)*decay;
  let step=nextError-error;
  motion.velocity=(velocity-omega*c*dt)*decay;
  if(Math.abs(step)>maxSpeed*dt) {
    step=Math.sign(step)*maxSpeed*dt;
    motion.velocity=Math.sign(step)*maxSpeed;
  }
  if(step*error>0 || Math.abs(step)>Math.abs(error)) {step=-error;motion.velocity=0;}
  const nextZoom=camera.zoom*Math.exp(step);
  const alpha=(1/nextZoom-1/camera.zoom)/(1/target.zoom-1/camera.zoom);
  camera.x+=(target.x-camera.x)*alpha;
  camera.y+=(target.y-camera.y)*alpha;
  camera.zoom=nextZoom;
}
