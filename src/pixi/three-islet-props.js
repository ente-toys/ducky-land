import * as THREE from 'three';
import {svgLayerDocuments} from './svg-context.js';
import {ISLET_META} from './islets.js';
import {WORLD_GEO} from './world-map.js';
import {surfacePoint,visiblePoint} from './three-globe-math.js';
async function raster(svg){
 const image=new Image();image.src=`data:image/svg+xml,${encodeURIComponent(svg)}`;await image.decode();
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
 canvas.getContext('2d').drawImage(image,0,0,512,512);return canvas;
}
function texture(canvas){const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;}
export async function createIsletStanding(scene,frame,source,blend){
 const layers=svgLayerDocuments(source),ground=texture(await raster(layers.ground)),props=[];
 for(const piece of ISLET_META[frame.art].tallPieces){
  const source=layers.pieces.get(piece.id);if(!source)throw Error(`Missing ${frame.art}/${piece.id}`);
  const full=await raster(source),context=full.getContext('2d',{willReadFrequently:true}),data=context.getImageData(0,0,512,512).data;
  let x0=512,y0=512,x1=0,y1=0;
  for(let y=0;y<512;y++)for(let x=0;x<512;x++)if(data[(y*512+x)*4+3]>10){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
  if(x0>x1)continue;
  x0=Math.max(0,x0-1);y0=Math.max(0,y0-1);x1=Math.min(511,x1+1);y1=Math.min(511,y1+1);
  const canvas=document.createElement('canvas'),w=x1-x0+1,h=y1-y0+1;canvas.width=w;canvas.height=h;
  canvas.getContext('2d').drawImage(full,x0,y0,w,h,0,0,w,h);
  const unit=frame.width/512/WORLD_GEO.Rw,geometry=new THREE.PlaneGeometry(w*unit,h*unit);
  geometry.translate(((x0+x1+1)/2-piece.foot[0]/2)*unit,(piece.foot[1]/2-(y0+y1+1)/2)*unit,0);
  const material=new THREE.MeshBasicMaterial({map:texture(canvas),transparent:true,depthWrite:false,depthTest:false,opacity:0});
  const mesh=new THREE.Mesh(geometry,material);mesh.name=`Standing ${frame.art}/${piece.id}`;scene.add(mesh);
  const k=frame.width/1024,anchor=surfacePoint(frame,(piece.foot[0]-512)*k,(piece.foot[1]-512)*k,WORLD_GEO.Rw);
  props.push({mesh,anchor});
 }
 return {ground,props,update(quaternion,camera){
  for(const {mesh,anchor}of props){
   if(blend.value<=.001){mesh.visible=false;continue;}
   mesh.position.copy(anchor).applyQuaternion(quaternion);mesh.quaternion.copy(camera.quaternion);
   mesh.renderOrder=200-mesh.position.y*1000;
   const facing=mesh.position.clone().normalize().dot(camera.position.clone().sub(mesh.position).normalize());
   mesh.visible=blend.value>.001&&facing>.08&&visiblePoint(mesh.position,camera.position);
   mesh.material.opacity=blend.value*THREE.MathUtils.smoothstep(facing,.08,.3);
  }
 }};
}
