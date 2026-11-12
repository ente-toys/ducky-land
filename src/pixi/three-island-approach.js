import {Quaternion,Vector3} from './globe-math.js';
import {transport} from './sphere.js';
import {SURFACE_RADIUS} from './three-globe-math.js';

// Twist the whole globe around the grabbed surface normal. Rotation about this
// axis cannot move the grabbed ground point, including away from screen centre.
// The desired tangent projects vertically through the perspective camera.
export function alignIslandNorth(quaternion,frame,anchor,camera,amount=1,maxStep=Infinity,remaining=0){
  const local=anchor.clone().normalize(),normal=local.clone().applyQuaternion(quaternion);
  const ray=normal.clone().multiplyScalar(SURFACE_RADIUS).sub(camera.position),denominator=ray.dot(normal);
  if(Math.abs(denominator)<1e-8)return 0;
  const desired=new Vector3(0,1,0).addScaledVector(ray,-normal.y/denominator).normalize();
  const north=new Vector3(...transport(frame,local.toArray()).north).applyQuaternion(quaternion).projectOnPlane(normal).normalize();
  const angle=Math.atan2(new Vector3().crossVectors(north,desired).dot(normal),north.dot(desired));
  const step=Math.max(-maxStep,Math.min(maxStep,Math.atan2(Math.sin(angle-remaining),Math.cos(angle-remaining))*Math.max(0,Math.min(1,amount))));
  if(Math.abs(step)>1e-9)quaternion.premultiply(new Quaternion().setFromAxisAngle(normal,step)).normalize();
  return angle;
}

// Use perceived zoom distance, not a late altitude threshold. The complete
// approach shares one smooth progress curve, even across repeated wheel events.
export function approachProgress(startAltitude,altitude){
  if(startAltitude<=.14)return 1;
  const t=Math.max(0,Math.min(1,Math.log(startAltitude/altitude)/Math.log(startAltitude/.14)));
  return t*t*t*(t*(t*6-15)+10);
}
