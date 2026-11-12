import {Quaternion, Vector3} from './globe-math.js';
import {expMap, logMap} from './sphere.js';

export const SURFACE_RADIUS=1.001;
export const EARTH_DISTANCE=5.2;

// Image scale is proportional to 1 / altitude near the island. Interpolate
// altitude ratios so a fly-in does not cram most of the zoom into its end.
export function zoomDistance(from,to,progress){
  return 1+(from-1)*Math.pow((to-1)/(from-1),progress);
}

// Background drags turn the globe in camera axes, even outside its silhouette.
export function rotateGlobeFromScreen(quaternion,dx,dy,height) {
  const scale=Math.PI/Math.max(1,height);
  quaternion.premultiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),dx*scale));
  quaternion.premultiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),dy*scale)).normalize();
}

// The original artwork's coordinates become distances along one continuous sphere.
export function surfacePoint(frame,x,y,radius) {
  return new Vector3(...expMap(frame,x,y,radius)).multiplyScalar(SURFACE_RADIUS);
}

export function surfaceCoordinates(frame,point,radius) {
  return logMap(frame,point.clone().normalize().toArray(),radius);
}

export function surfaceUnderPointer(camera,x,y,width,height) {
  camera.updateMatrixWorld(true);
  const origin=camera.position;
  const ray=new Vector3(x/width*2-1,1-y/height*2,.5).unproject(camera).sub(origin).normalize();
  const along=-ray.dot(origin),disc=along*along-origin.lengthSq()+SURFACE_RADIUS*SURFACE_RADIUS;
  if(disc<0)return null;
  const root=Math.sqrt(disc),near=along-root,far=along+root;
  return far<0?null:ray.multiplyScalar(near>=0?near:far).addScaledVector(origin,1).normalize();
}

// Keep the grabbed surface point under the same screen pixel as the camera approaches.
export function lockSurfaceAnchor(quaternion,localPoint,camera,x,y,width,height) {
  const target=surfaceUnderPointer(camera,x,y,width,height);
  if(!target)return false;
  const current=localPoint.clone().normalize().applyQuaternion(quaternion);
  quaternion.premultiply(new Quaternion().setFromUnitVectors(current,target)).normalize();
  return true;
}

export function focusSurfaceQuaternion(frame,current) {
  const normal=new Vector3(...frame.center).applyQuaternion(current);
  return new Quaternion().setFromUnitVectors(normal,new Vector3(0,0,1)).multiply(current);
}

// Exact map-to-atlas transform cancels the neighbouring copy's chart rotation.
export function atlasUV(x,y,placement,cameraMatrix,width,height) {
  const px=placement.x+placement.a*x+placement.c*y,py=placement.y+placement.b*x+placement.d*y;
  return {u:(cameraMatrix.a*px+cameraMatrix.c*py+cameraMatrix.tx)/width,
    v:1-(cameraMatrix.b*px+cameraMatrix.d*py+cameraMatrix.ty)/height};
}

// One GPU transform replaces two per-vertex UV buffer rewrites on each atlas update.
export function atlasTransform(width,height,placement,matrix,atlasWidth,atlasHeight) {
  const o=atlasUV(-width/2,height/2,placement,matrix,atlasWidth,atlasHeight);
  const e=atlasUV(width/2,height/2,placement,matrix,atlasWidth,atlasHeight);
  const n=atlasUV(-width/2,-height/2,placement,matrix,atlasWidth,atlasHeight);
  return {a:e.u-o.u,b:e.v-o.v,c:n.u-o.u,d:n.v-o.v,x:o.u,y:o.v};
}

// All patches share the sphere: picking needs one ray/sphere intersection, then
// nine chart bounds, rather than intersections against over 120,000 triangles.
export function pickSurfacePatch(camera,quaternion,x,y,width,height,frames,radius){
  const point=surfaceUnderPointer(camera,x,y,width,height);
  if(!point)return null;
  point.applyQuaternion(quaternion.clone().invert());
  let best=null,nearest=-Infinity;
  for(const frame of frames){
    const q=surfaceCoordinates(frame,point,radius);
    if(Math.abs(q.x)>frame.width/2||Math.abs(q.y)>frame.height/2)continue;
    const score=point.x*frame.center[0]+point.y*frame.center[1]+point.z*frame.center[2];
    if(score>nearest){nearest=score;best={id:frame.id,frame,point,x:q.x,y:q.y};}
  }
  return best;
}

// One rigid basis for each existing island. No remeshing, bending or changing its UVs.
export function islandQuaternion(frame) {
  return new Quaternion().setFromBasis(frame.east,frame.north,frame.center);
}
export const focusQuaternion = frame => islandQuaternion(frame).invert();

// Arcball coordinates use the visible sphere's screen radius, not independent island positions.
export function trackballPoint(x, y, cx, cy, radius) {
  const p = new Vector3((x-cx)/radius, (cy-y)/radius, 0), d = p.lengthSq();
  if (d <= 1) p.z = Math.sqrt(1-d);
  else p.normalize();
  return p;
}

export function rigidPoint(frame, x, y, radius, altitude=1.007) {
  return new Vector3(...frame.center).multiplyScalar(altitude)
    .addScaledVector(new Vector3(...frame.east), x/radius)
    .addScaledVector(new Vector3(...frame.north), -y/radius);
}

// Segment-to-camera test also hides back-facing patches and hearts behind the ocean.
export function visiblePoint(point, camera, globeRadius=1) {
  const direction = camera.clone().sub(point), length = direction.length();
  direction.divideScalar(length);
  const b=point.dot(direction), c=point.lengthSq()-globeRadius*globeRadius;
  const disc=b*b-c;
  if(disc<0) return true;
  const hit=-b-Math.sqrt(disc);
  return hit<1e-5 || hit>length;
}
