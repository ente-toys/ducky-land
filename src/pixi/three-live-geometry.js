import {PlaneGeometry} from 'three';
import {surfacePoint} from './three-globe-math.js';

// Reject transient empty/invalid viewport bounds before writing GPU vertices.
// A single NaN here poisons PlaneGeometry's bounding sphere and culls the mesh.
export function liveSurfaceGeometry(frame,bounds,width,height,radius) {
  if(!frame||![...frame.center,...frame.east,...frame.north,bounds?.x,bounds?.y,bounds?.width,bounds?.height,width,height,radius].every(Number.isFinite)||
      Math.min(bounds.width,bounds.height,width,height,radius)<=0)return null;
  const geometry=new PlaneGeometry(bounds.width*1.8,bounds.height*1.8,64,64);
  const pos=geometry.attributes.position,uv=geometry.attributes.uv;
  for(let k=0;k<pos.count;k++){
    const x=bounds.x+pos.getX(k),y=bounds.y-pos.getY(k),p=surfacePoint(frame,x,y,radius);
    pos.setXYZ(k,p.x,p.y,p.z);uv.setXY(k,x/width+.5,.5-y/height);
  }
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return geometry;
}
