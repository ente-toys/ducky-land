import {PlaneGeometry,Vector2} from 'three';
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

// The live detail texture covers only the native viewport. Its rectangular
// boundary becomes a diagonal on the globe after rotation. Keep the atlas
// underneath and taper only this detail layer, rather than punching a hole in
// the atlas or extending the texture's final pixels across the sea.
export function captureFeather(canvas,target=new Vector2()){
  const width=Math.max(1,canvas.width),height=Math.max(1,canvas.height);
  return target.set(Math.min(.12,48/width),Math.min(.12,48/height));
}

export function liveCaptureEdgeShader(shader,feather){
  shader.uniforms.liveCaptureFeather={value:feather};
  shader.fragmentShader=shader.fragmentShader
    .replace('#include <common>','#include <common>\nuniform vec2 liveCaptureFeather;')
    .replace('#include <map_fragment>',`#include <map_fragment>
      vec2 captureEdge=min(vMapUv,vec2(1.)-vMapUv);
      vec2 captureFade=smoothstep(vec2(0.),liveCaptureFeather,captureEdge);
      diffuseColor.a*=captureFade.x*captureFade.y;`);
}

// One captured surface changes projection continuously. Drawing a second flat
// viewport over the spherical copy would show two positions for every tree and
// shoreline. At the flat endpoint W also becomes constant, so perspective UV
// interpolation becomes an exact affine viewport image rather than a warped one.
export function liveCaptureProjection(shader,blendUniform,captureScale=1){
  shader.uniforms.liveCaptureBlend=blendUniform;
  shader.uniforms.liveCaptureScale=typeof captureScale==='object'?captureScale:{value:Math.max(1,Number(captureScale)||1)};
  shader.vertexShader=shader.vertexShader
    .replace('#include <common>','#include <common>\nuniform float liveCaptureBlend;uniform float liveCaptureScale;')
    .replace('#include <project_vertex>',`#include <project_vertex>
      vec2 captureFlatNdc=(vMapUv-vec2(.5))*2.*liveCaptureScale;
      vec3 captureCurvedNdc=gl_Position.xyz/gl_Position.w;
      float captureW=mix(gl_Position.w,1.,liveCaptureBlend);
      gl_Position=vec4(mix(captureCurvedNdc,vec3(captureFlatNdc,0.),liveCaptureBlend)*captureW,captureW);`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float liveCaptureBlend;');
}
