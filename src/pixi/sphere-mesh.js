import {Mesh,MeshGeometry,RenderTexture,Matrix} from 'pixi.js';
import {cameraMatrix,cameraSpan} from './sphere-camera.js';
import {mapPoint} from './sphere-coordinates.js';
import {mapOf} from './island-maps.js';
import {WORLD_GEO} from './world-map.js';
export function patchGeometry(from,to,box,steps=24){
 const positions=[],uvs=[],indices=[];
 for(let y=0;y<=steps;y++)for(let x=0;x<=steps;x++){
  const p=mapPoint(to,from,{x:box.x+x/steps*box.width,y:box.y+y/steps*box.height});positions.push(p.x,p.y);uvs.push(x/steps,y/steps);
 }
 const triangle=(a,b,c)=>{const p=i=>positions.slice(i*2,i*2+2);const A=p(a),B=p(b),C=p(c);if(Math.max(Math.hypot(A[0]-B[0],A[1]-B[1]),Math.hypot(B[0]-C[0],B[1]-C[1]),Math.hypot(C[0]-A[0],C[1]-A[1]))<WORLD_GEO.Rw)indices.push(a,b,c);};
 for(let y=0;y<steps;y++)for(let x=0;x<steps;x++){const a=y*(steps+1)+x,b=a+1,c=a+steps+1,d=c+1;triangle(a,b,d);triangle(a,d,c);}
 return new MeshGeometry({positions:new Float32Array(positions),uvs:new Float32Array(uvs),indices:new Uint32Array(indices)});
}
export const overviewPatch=(from,to,texture)=>{const m=mapOf(to);return new Mesh({texture,geometry:patchGeometry(from,to,{...m.origin,width:m.width,height:m.height})});};
// Only visible live neighbours get a bounded render target. Their animation is
// drawn in the original flat map, then wrapped through the exact same chart.
export function createLivePatches(renderer){
 const entries=new Map();
 const drop=e=>{setTimeout(()=>{e.mesh.geometry.destroy();e.mesh.destroy();e.texture.destroy(true);},0);};
 return {
  retain(ids){for(const [id,e]of entries)if(!ids.has(id)){drop(e);entries.delete(id);}},
  draw(from,to,scene,camera,width,height,tilt,target){
   const m=mapOf(to),span=cameraSpan(camera,width,height),hw=span.width/(2*camera.zoom),hh=span.height/(2*camera.zoom*tilt);
   const points=[[-hw,-hh],[hw,-hh],[-hw,hh],[hw,hh],[0,0]].map(([x,y])=>mapPoint(from,to,{x:camera.x+x,y:camera.y+y}));
   const minx=Math.max(m.origin.x-500,Math.min(...points.map(p=>p.x))),maxx=Math.min(m.origin.x+m.width+500,Math.max(...points.map(p=>p.x))),miny=Math.max(m.origin.y-500,Math.min(...points.map(p=>p.y))),maxy=Math.min(m.origin.y+m.height+500,Math.max(...points.map(p=>p.y)));
   let e=entries.get(to);
   if(!e||e.from!==from||minx<e.box.x+50||maxx>e.box.x+e.box.width-50||miny<e.box.y+50||maxy>e.box.y+e.box.height-50||Math.abs(Math.log(camera.zoom/e.zoom))>.55){
    if(e)drop(e);
    const x=Math.max(m.origin.x-1400,minx-1200),y=Math.max(m.origin.y-1400,miny-1200);
    const box={x,y,width:Math.max(1,Math.min(m.origin.x+m.width+1400,maxx+1200)-x),height:Math.max(1,Math.min(m.origin.y+m.height+1400,maxy+1200)-y)};
    const k=Math.min(Math.max(.1,camera.zoom*1.5),1536/Math.max(box.width,box.height));
    const texture=RenderTexture.create({width:Math.ceil(box.width*k),height:Math.ceil(box.height*k),resolution:1});
    const mesh=new Mesh({texture,geometry:patchGeometry(from,to,box)});
    e={from,mesh,texture,box,k,zoom:camera.zoom};entries.set(to,e);
   }
   renderer.render({container:scene,target:e.texture,clear:true,transform:new Matrix(e.k,0,0,e.k,-e.box.x*e.k,-e.box.y*e.k)});
   renderer.render({container:e.mesh,target,clear:false,transform:Object.assign(new Matrix(),cameraMatrix(camera,width,height,tilt))});
  },
  destroy(){for(const e of entries.values())drop(e);entries.clear();},
 };
}
