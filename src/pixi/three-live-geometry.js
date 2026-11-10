import {PlaneGeometry} from 'three';
import {surfacePoint} from './three-globe-math.js';

export function liveSurfaceBounds(bounds){return {...bounds,width:bounds.width*1.8,height:bounds.height*1.8};}

// Pan and zoom consume the same padding. Independent movement/scale thresholds
// can both pass while a viewport corner has already escaped the cached mesh.
export function liveSurfaceNeedsUpdate(old,bounds){
  return !old||Math.abs(bounds.x-old.x)+bounds.width/2>old.width/2||
    Math.abs(bounds.y-old.y)+bounds.height/2>old.height/2||
    bounds.width*1.8<old.width*.65||bounds.height*1.8<old.height*.65;
}

// Reject transient empty/invalid viewport bounds before writing GPU vertices.
// A single NaN here poisons PlaneGeometry's bounding sphere and culls the mesh.
export function liveSurfaceGeometry(frame,bounds,width,height,radius) {
  if(!frame||![...frame.center,...frame.east,...frame.north,bounds?.x,bounds?.y,bounds?.width,bounds?.height,width,height,radius].every(Number.isFinite)||
      Math.min(bounds.width,bounds.height,width,height,radius)<=0)return null;
  const padded=liveSurfaceBounds(bounds),geometry=new PlaneGeometry(padded.width,padded.height,64,64);
  const pos=geometry.attributes.position,uv=geometry.attributes.uv;
  for(let k=0;k<pos.count;k++){
    const x=bounds.x+pos.getX(k),y=bounds.y-pos.getY(k),p=surfacePoint(frame,x,y,radius);
    pos.setXYZ(k,p.x,p.y,p.z);uv.setXY(k,x/width+.5,.5-y/height);
  }
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return geometry;
}
