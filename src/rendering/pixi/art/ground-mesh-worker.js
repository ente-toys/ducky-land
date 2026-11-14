import {decodeGroundMesh} from './ground-mesh-codec.js';
export function splitGroundMesh(buffer){
 const {metadata,positions,colors,indices}=decodeGroundMesh(buffer,{expand:false}),chunks=[];
 if(metadata.layout>=2){
  let first=0;
  while(first<metadata.instances.length){let last=first,vertices=0,count=0;
   while(last<metadata.instances.length){const m=metadata.motifs[metadata.instances[last][0]];if(last!==first&&(vertices+m[1]>200000||count+m[3]>600000))break;vertices+=m[1];count+=m[3];last++;}
   const uv=new Float32Array(vertices*2).fill(.5),xy=new Float32Array(vertices*2),rgba=new Uint8Array(vertices*4),ix=new Uint32Array(count);let vertex=0,index=0;
   for(let k=first;k<last;k++){const instance=metadata.instances[k],[motif,x,y]=instance,[sx,sy]=metadata.layout>=3?instance.slice(3,5):[1,1],[r,g,b,a]=instance.slice(metadata.layout>=3?5:3),[v,n,start,nix]=metadata.motifs[motif];
    for(let j=0;j<n;j++){xy[(vertex+j)*2]=positions[(v+j)*2]*sx+x;xy[(vertex+j)*2+1]=positions[(v+j)*2+1]*sy+y;const c=(vertex+j)*4;rgba[c]=r;rgba[c+1]=g;rgba[c+2]=b;rgba[c+3]=a;if(metadata.maskUV?.[k])uv.set(metadata.maskUV[k].slice(j*2,j*2+2),(vertex+j)*2);}
    for(let j=0;j<nix;j++)ix[index+j]=indices[start+j]+vertex;vertex+=n;index+=nix;
   }
   chunks.push({positions:xy,colors:rgba,indices:ix,uv});first=last;
  }
  return {metadata:{version:metadata.version,id:metadata.id,raster:metadata.raster,strokeMask:metadata.strokeMask},chunks};
 }
 const seen=new Uint32Array(positions.length/2),mapped=new Uint16Array(positions.length/2);let generation=0;
 // Each upload stays small; triangle order (including translucent paint) is retained.
 for(let start=0;start<indices.length;start+=60000){
  const end=Math.min(indices.length,start+60000);generation++;let vertices=0;const xy=new Float32Array(120000),rgba=new Uint8Array(240000),ix=new Uint16Array(end-start);
  for(let i=start;i<end;i++){const old=indices[i];if(old>=seen.length)throw Error('Ground mesh index out of range');let at=mapped[old];if(seen[old]!==generation){at=vertices++;seen[old]=generation;mapped[old]=at;xy[at*2]=positions[old*2];xy[at*2+1]=positions[old*2+1];rgba.set(colors.subarray(old*4,old*4+4),at*4);}ix[i-start]=at;}
  chunks.push({positions:xy.slice(0,vertices*2),colors:rgba.slice(0,vertices*4),indices:ix});
 }
 return {metadata:{version:metadata.version,id:metadata.id,raster:metadata.raster,strokeMask:metadata.strokeMask},chunks};
}
export async function decodeStrokeMask(mask){
 const bytes=Uint8Array.from(atob(mask.png),c=>c.charCodeAt(0));
 const bitmap=await createImageBitmap(new Blob([bytes],{type:`image/${mask.format??'png'}`}));
 try{
  const canvas=new OffscreenCanvas(mask.width,mask.height),context=canvas.getContext('2d');
  context.drawImage(bitmap,0,0);const rgba=context.getImageData(0,0,mask.width,mask.height).data;
  const pixels=new Uint8Array(mask.width*mask.height);for(let i=0;i<pixels.length;i++)pixels[i]=rgba[i*4];
  return pixels;
 }finally{bitmap.close();}
}
if(typeof self!=='undefined'&&typeof self.postMessage==='function'&&typeof document==='undefined')self.onmessage=async({data})=>{
 try{const result=splitGroundMesh(data);
  if(result.metadata.strokeMask)result.strokeMaskPixels=await decodeStrokeMask(result.metadata.strokeMask);
  self.postMessage(result,[...result.chunks.flatMap(c=>[c.positions.buffer,c.colors.buffer,c.indices.buffer,...(c.uv?[c.uv.buffer]:[])]),...(result.strokeMaskPixels?[result.strokeMaskPixels.buffer]:[])]);
 }catch(error){self.postMessage({error:String(error)});}
};
