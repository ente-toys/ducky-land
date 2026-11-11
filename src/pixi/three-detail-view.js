import {surfaceCoordinates} from './three-globe-math.js';
import {Mesh,MeshBasicMaterial,PlaneGeometry} from 'three';
import {DETAIL_BLEND_START} from './three-detail-budget.js';

// A handoff is a viewport image, not an island patch. Morphing the curved
// patch into atlas UVs moves the capture boundary inside the screen after a
// rotation (and can collapse it at a half turn). Composite the full capture
// in clip space instead, sharing the live texture and its single upload.
export const DETAIL_CAPTURE_SCALE=1.5;

export function detailViewport(texture,captureScale=1){
  const scale=Math.max(1,Number(captureScale)||1);
  const material=new MeshBasicMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false});
  material.userData.captureScale=scale;
  material.onBeforeCompile=shader=>{
    shader.uniforms??={};shader.uniforms.detailCaptureScale={value:scale};
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nuniform float detailCaptureScale;')
      .replace('#include <uv_vertex>','#include <uv_vertex>\nvMapUv=vec2(.5)+(uv-vec2(.5))/detailCaptureScale;')
      .replace('#include <project_vertex>','gl_Position=vec4(position.xy,0.,1.);');
  };
  const mesh=new Mesh(new PlaneGeometry(2,2),material);
  mesh.name='Live viewport handoff';mesh.frustumCulled=false;mesh.renderOrder=101;
  return mesh;
}

// Blend into the native viewport only in the final close approach, after the island's heading has
// largely settled. Hysteresis prevents mode changes at a single wheel boundary.
export function detailBlend(altitude,heading=0){
  const ease=t=>t*t*t*(t*(t*6-15)+10);
  const t=altitude<=.160001?1:Math.max(0,Math.min(1,Math.log(DETAIL_BLEND_START/altitude)/Math.log(DETAIL_BLEND_START/.16)));
  // A rapid wheel/pinch can outrun the deliberately capped globe rotation.
  // Interpolating opposite screen orientations collapses the live surface.
  // Keep its curved projection until north is close, then flatten smoothly.
  const angle=Number.isFinite(heading)?Math.abs(Math.atan2(Math.sin(heading),Math.cos(heading))):Math.PI;
  const north=Math.max(0,Math.min(1,(70*Math.PI/180-angle)/(60*Math.PI/180)));
  return ease(t)*ease(north);
}
export function directDetail(altitude,previous,ready){return ready&&(previous?altitude<.18:altitude<=.160001);}
export function detailSize(width,height,dpr=1,highDensity=false){
  const limit=highDensity?2048:1536;
  const density=Math.min(highDensity?2:1.5,dpr,limit/Math.max(1,width,height));
  return {width:Math.max(1,Math.round(width*density)),height:Math.max(1,Math.round(height*density))};
}

// Both projections share the same grabbed point. This makes flattening and the
// final canvas swap preserve the cursor anchor, rather than recentering it.
export function detailCamera(frame,map,state,width,height,tilt=1,offset={x:0,y:0},captureScale=1){
  const scale=Math.max(1,Number(captureScale)||1);
  const span=2*Math.tan(state.fov*Math.PI/360)*state.altitude*state.radius;
  const zoom=height/(scale*span),centre={x:map.cx+state.point.x,y:map.cy+state.point.y};
  let x=centre.x+offset.x,y=centre.y+offset.y;
  if(state.anchor){
    const p=surfaceCoordinates(frame,state.anchor.point,state.radius);
    x=map.cx+p.x-(state.anchor.x-state.width/2)*width/(scale*state.width*zoom);
    y=map.cy+p.y-(state.anchor.y-state.height/2)*height/(scale*state.height*zoom*tilt);
    offset.x=x-centre.x;offset.y=y-centre.y;
  }
  return {x,y,zoom};
}
export function detailScreen(camera,x,y,width,height,cssWidth,cssHeight,tilt=1,captureScale=1){
  const scale=Math.max(1,Number(captureScale)||1);
  return {x:cssWidth/2+(x-camera.x)*camera.zoom*scale*cssWidth/width,y:cssHeight/2+(y-camera.y)*camera.zoom*tilt*scale*cssHeight/height};
}
