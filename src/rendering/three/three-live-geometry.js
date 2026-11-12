import {Vector2} from '../shared/globe-math.js';
import {PlaneGeometry} from '../pixi/globe-mesh.js';
import {surfacePoint} from './three-globe-math.js';

export function liveSurfaceBounds(bounds){return {...bounds,width:bounds.width*1.8,height:bounds.height*1.8};}

export function liveSurfaceNeedsUpdate(old,bounds){
  return !old||Math.abs(bounds.x-old.x)+bounds.width/2>old.width/2||
    Math.abs(bounds.y-old.y)+bounds.height/2>old.height/2||
    bounds.width*1.8<old.width*.65||bounds.height*1.8<old.height*.65;
}

export function liveSurfaceGeometry(frame,bounds,width,height,radius) {
  if(!frame||![...frame.center,...frame.east,...frame.north,bounds?.x,bounds?.y,bounds?.width,bounds?.height,width,height,radius].every(Number.isFinite)||
      Math.min(bounds.width,bounds.height,width,height,radius)<=0)return null;
  const padded=liveSurfaceBounds(bounds),geometry=new PlaneGeometry(padded.width,padded.height,64,64);
  const pos=geometry.attributes.position,uv=geometry.attributes.uv;
  for(let k=0;k<pos.count;k++){
    const x=bounds.x+pos.getX(k),y=bounds.y-pos.getY(k),p=surfacePoint(frame,x,y,radius);
    pos.setXYZ(k,p.x,p.y,p.z);uv.setXY(k,x/width+.5,.5-y/height);
  }
  return geometry;
}

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
