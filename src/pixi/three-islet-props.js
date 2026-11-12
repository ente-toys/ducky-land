import {Vector3,clamp,lerp,smoothstep} from './globe-math.js';
import * as Globe from './globe-mesh.js';
import {svgLayerDocuments} from './svg-context.js';
import {ISLET_META} from './islets.js';
import {WORLD_GEO} from './world-map.js';
import {surfacePoint,SURFACE_RADIUS} from './three-globe-math.js';
async function raster(svg){
 const image=new Image();image.src=`data:image/svg+xml,${encodeURIComponent(svg)}`;await image.decode();
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
 canvas.getContext('2d').drawImage(image,0,0,512,512);return canvas;
}
function texture(canvas){const t=new Globe.CanvasTexture(canvas);t.colorSpace=Globe.SRGBColorSpace;return t;}
// Cards keep their full base in front of the ocean. A normal depth test would
// cut that base in half where the upright card intersects the curved water.
// Clip against the actual planet silhouette instead, then cull back anchors.
export function isletCardMaterial(map){
 const material=new Globe.MeshBasicMaterial({map,transparent:true,depthWrite:false,depthTest:false,opacity:0});
 const flatBlend={value:0};material.userData.flatBlend=flatBlend;
 material.onBeforeCompile=shader=>{
  shader.uniforms.isletGlobeRadius={value:SURFACE_RADIUS};
  shader.uniforms.isletFlatBlend=flatBlend;
  shader.vertexShader=shader.vertexShader
   .replace('#include <common>','#include <common>\nvarying vec3 isletWorldPoint;')
   .replace('#include <project_vertex>','#include <project_vertex>\nisletWorldPoint=(modelMatrix*vec4(transformed,1.)).xyz;');
  shader.fragmentShader=shader.fragmentShader
   .replace('#include <common>','#include <common>\nvarying vec3 isletWorldPoint;uniform float isletGlobeRadius;uniform float isletFlatBlend;')
   .replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nvec3 isletRay=normalize(isletWorldPoint-cameraPosition);float isletAlong=dot(cameraPosition,isletRay);float isletDisc=isletAlong*isletAlong-dot(cameraPosition,cameraPosition)+isletGlobeRadius*isletGlobeRadius;if(isletFlatBlend<.001&&(isletAlong>=0.||isletDisc<0.))discard;');
 };
 material.customProgramCacheKey=()=> 'islet-card-silhouette';
 return material;
}
export async function createIsletStanding(scene,frame,source,_blend,{rasterize=raster}={}){
 const layers=svgLayerDocuments(source),ground=texture(await rasterize(layers.ground)),props=[];
 try{for(const piece of ISLET_META[frame.art].tallPieces){
  const source=layers.pieces.get(piece.id);if(!source)throw Error(`Missing ${frame.art}/${piece.id}`);
  const full=await rasterize(source),context=full.getContext('2d',{willReadFrequently:true}),data=context.getImageData(0,0,512,512).data;
  let x0=512,y0=512,x1=0,y1=0;
  for(let y=0;y<512;y++)for(let x=0;x<512;x++)if(data[(y*512+x)*4+3]>10){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
  if(x0>x1)continue;
  x0=Math.max(0,x0-1);y0=Math.max(0,y0-1);x1=Math.min(511,x1+1);y1=Math.min(511,y1+1);
  const canvas=document.createElement('canvas'),w=x1-x0+1,h=y1-y0+1;canvas.width=w;canvas.height=h;
  canvas.getContext('2d').drawImage(full,x0,y0,w,h,0,0,w,h);
  const unit=frame.width/512/WORLD_GEO.Rw,geometry=new Globe.PlaneGeometry(w*unit,h*unit);
  geometry.translate(((x0+x1+1)/2-piece.foot[0]/2)*unit,(piece.foot[1]/2-(y0+y1+1)/2)*unit,0);
  const material=isletCardMaterial(texture(canvas));
  const mesh=new Globe.Mesh(geometry,material);mesh.name=`Standing ${frame.art}/${piece.id}`;scene.add(mesh);
  const k=frame.width/1024,anchor=surfacePoint(frame,(piece.foot[0]-512)*k,(piece.foot[1]-512)*k,WORLD_GEO.Rw);
  props.push({mesh,anchor,piece});
 }
 }catch(error){
  ground.dispose();
  for(const {mesh}of props){scene.remove(mesh);mesh.geometry.dispose();mesh.material.map.dispose();mesh.material.dispose();}
  throw error;
 }
 const sight=new Vector3(),projected=new Vector3(),inView=new Vector3();
 return {ground,props,update(quaternion,camera,project=()=>null){
  for(const {mesh,anchor,piece}of props){
   mesh.position.copy(anchor).applyQuaternion(quaternion);mesh.quaternion.copy(camera.quaternion);
   sight.copy(camera.position).sub(mesh.position).normalize();
   const facing=mesh.position.dot(sight)/SURFACE_RADIUS;
   const flat=project(frame,piece),blend=flat?clamp(flat.blend,0,1):0;
   mesh.visible=facing>.25||blend>.001;
   // Zoom never crossfades two displaced versions of the same drawing. Only
   // the limb fades a card, on top of the ground-only islet texture. Fade
   // before grazing angles make its broad base overhang compressed ground.
   mesh.material.opacity=lerp(smoothstep(facing,.25,.55),1,blend);
   mesh.scale.setScalar(1);mesh.material.userData.flatBlend.value=blend;
   if(blend>0&&flat.width>0&&flat.height>0&&Number.isFinite(flat.pixelsPerUnit)){
    projected.copy(mesh.position).project(camera);
    projected.x=lerp(projected.x,flat.x/flat.width*2-1,blend);
    projected.y=lerp(projected.y,1-flat.y/flat.height*2,blend);
    mesh.position.copy(projected).unproject(camera);
    const depth=-inView.copy(mesh.position).applyMatrix4(camera.matrixWorldInverse).z;
    const scale=flat.pixelsPerUnit*2*depth*Math.tan(camera.fov*Math.PI/360)/flat.height;
    mesh.scale.setScalar(lerp(1,scale,blend));
   }
   // All upright scenery stays above the live surface (100) and flat handoff
   // (101), while retaining its foot-based order amongst other scenery.
   mesh.renderOrder=10000-mesh.position.y*1000;
  }
 }};
}
