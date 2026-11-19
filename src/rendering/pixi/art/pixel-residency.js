import * as Pixi from 'pixi.js';
const {extensions,ExtensionType,glUploadImageResource}=Pixi;

// Only reproducible static pictures use this uploader. Dimensions, frames and
// GPU textures stay intact; the HTTP cache replaces their decoded CPU copy.
const pictures=new Map(), gameContexts=new WeakMap(), gates=new WeakMap();
const close=resource=>{resource?.close?.();};
const PIXEL_RELOAD_TIMEOUT_MS=4000;
export function cacheBackedPixels(source,reload) {
  if(typeof source.resource?.close!=='function')return source;
  pictures.set(source,{reload,uploaded:false,pending:null});
  source.autoGarbageCollect=false;
  source.uploadMethodId='cacheBackedImage';
  source.once('destroy',()=>{close(source.resource);pictures.delete(source);});
  return source;
}
export function releaseArtPixels(source) {
  if(pictures.get(source)?.uploaded&&source.resource){close(source.resource);source.resource=null;source.options.resource=null;}
}
extensions?.add({extension:{type:ExtensionType?.TextureUploaderWebGL,name:'cacheBackedImage'},
  id:'cacheBackedImage',upload(source,texture,gl,webGLVersion,targetOverride,forceAllocation=false){
    if(gl.isContextLost())return;
    const entry=pictures.get(source);
    const renderer=gameContexts.get(gl);
    const w=source.pixelWidth,h=source.pixelHeight,target=targetOverride||texture.target;
    if(!source.resource){
      if(!renderer||entry?.degraded!==renderer)throw Error(`Picture needs recovery: ${source.label}`);
      // Keep the atlas frame geometry. Every frame samples the same transparent pixel.
      gl.texImage2D(target,0,texture.internalFormat,1,1,0,texture.format,texture.type,null);
      texture.width=texture.height=1;
      return;
    }
    if(webGLVersion===2&&w*h*4>8*1048576&&source.resourceWidth===w&&source.resourceHeight===h){
      // Keep the complete texture and its original mipmaps. Small row uploads
      // avoid a sheet-sized client/driver transfer buffer without resampling.
      if(forceAllocation||texture.width!==w||texture.height!==h)
        gl.texImage2D(target,0,texture.internalFormat,w,h,0,texture.format,texture.type,null);
      const skip=gl.getParameter(gl.UNPACK_SKIP_ROWS),pixels=gl.getParameter(gl.UNPACK_SKIP_PIXELS);
      try{
        gl.pixelStorei(gl.UNPACK_SKIP_PIXELS,0);
        const rows=Math.max(1,Math.floor(2*1048576/(w*4)));
        for(let y=0;y<h;y+=rows){
          gl.pixelStorei(gl.UNPACK_SKIP_ROWS,y);
          gl.texSubImage2D(target,0,0,y,w,Math.min(rows,h-y),texture.format,texture.type,source.resource);
        }
        texture.width=w;texture.height=h;
      }finally{gl.pixelStorei(gl.UNPACK_SKIP_ROWS,skip);gl.pixelStorei(gl.UNPACK_SKIP_PIXELS,pixels);}
    }else glUploadImageResource.upload(source,texture,gl,webGLVersion,targetOverride,forceAllocation);
    if(renderer){entry.uploaded=true;entry.renderer=renderer;entry.degraded=null;releaseArtPixels(source);}
  },
});
// Snow profiles read alpha on the CPU. Preserve their exact 192px sample,
// not an entire decoded sheet or a GPU readback with different edge rounding.
export async function retainArtSample(texture){
  const source=texture.source,entry=pictures.get(source);
  if(!entry||!texture.artKey?.startsWith('/pixi-duck/')||typeof globalThis.ImageBitmap!=='function')return;
  await reloadPixels(source);
  if(source.destroyed||texture.destroyed||!source.resource)return;
  const canvas=Pixi.DOMAdapter.get().createCanvas(192,192),ctx=canvas.getContext('2d',{willReadFrequently:true});
  try{
    const f=texture.frame,r=source.resolution,ink=texture.trim??{x:0,y:0,width:texture.width,height:texture.height};
    ctx.drawImage(source.resource,f.x*r,f.y*r,f.width*r,f.height*r,
      ink.x/texture.width*192,ink.y/texture.height*192,ink.width/texture.width*192,ink.height/texture.height*192);
    const rgba=ctx.getImageData(0,0,192,192).data,alpha=new Uint8Array(192*192);
    for(let i=0;i<alpha.length;i++)alpha[i]=rgba[i*4+3];
    texture.artAlphaSample=alpha;
  }finally{canvas.width=canvas.height=1;if(entry.uploaded)setTimeout(()=>releaseArtPixels(source),0);}
}
export async function prepareArtPixels(source,renderer) {
  const gate=gates.get(renderer);if(gate)await gate.promise;
  if(source.destroyed||source.resource||source._gpuData?.[renderer.uid])return;
  await reloadPixels(source);
}
// A portrait has its own short-lived renderer. Rehydrate only its frames and
// leave the game renderer's already-uploaded textures in place.
export async function prepareTreePixels(renderer,root){
  const sources=new Set();
  const visit=node=>{if(node.texture?.source)sources.add(node.texture.source);for(const child of node.children??[])visit(child);};
  visit(root);
  for(const source of sources){await prepareArtPixels(source,renderer);if(!source.destroyed)renderer.texture.bindSource(source);}
  return sources;
}
async function reloadPixels(source){
  const entry=pictures.get(source);
  if(!entry||source.destroyed||source.resource)return;
  if(!entry.pending){
    let timer, expired=false;
    const deadline=new Promise((_,reject)=>{
      timer=setTimeout(()=>{
        expired=true;
        reject(Error(`Picture reload timed out: ${source.label}`));
      },PIXEL_RELOAD_TIMEOUT_MS);
    });
    const reload=Promise.resolve().then(entry.reload).then(resource=>{
      if(expired||source.destroyed)close(resource);
      else source.resource=resource;
    });
    entry.pending=Promise.race([reload,deadline]).finally(()=>{clearTimeout(timer);entry.pending=null;});
  }
  await entry.pending;
}
export function installPixelRecovery(renderer,{lost=()=>{},restored=()=>{},failed=()=>{}}={}) {
  const canvas=renderer.canvas;gameContexts.set(renderer.gl,renderer);let dead=false,epoch=0;
  const releaseGate=()=>{
    const gate=gates.get(renderer);
    gates.delete(renderer);
    gate?.resolve();
  };
  const onLost=event=>{
    event.preventDefault();epoch++;
    if(!gates.has(renderer)){let resolve;const promise=new Promise(r=>resolve=r);gates.set(renderer,{promise,resolve});}
    lost();
  };
  const onRestored=async()=>{
    const version=epoch;
    const failures=[];
    try{
      // One sheet at a time. Never rebuild a second full island in CPU memory.
      for(const [source,entry] of pictures){
        if(dead||version!==epoch)return;
        if(entry.renderer!==renderer||!entry.uploaded||source.destroyed)continue;
        try{
          await reloadPixels(source);
        }catch(error){
          if(dead||version!==epoch)return;
          entry.degraded=renderer;
          failures.push(error);
        }
        if(dead||version!==epoch)return;
        if(source.destroyed)continue;
        renderer.texture.bindSource(source);
        await new Promise(resolve=>requestAnimationFrame(resolve));
      }
      if(!dead&&version===epoch){
        releaseGate();
        if(failures.length)console.warn(`WebGL restored with ${failures.length} unavailable texture(s)`,failures[0]);
        restored();
      }
    }catch(error){
      if(!dead&&version===epoch){releaseGate();failed(error);}
    }
  };
  canvas.addEventListener('webglcontextlost',onLost);
  canvas.addEventListener('webglcontextrestored',onRestored);
  return ()=>{dead=true;epoch++;canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);releaseGate();gameContexts.delete(renderer.gl);for(const entry of pictures.values())if(entry.renderer===renderer){entry.renderer=null;entry.uploaded=false;entry.degraded=null;}};
}
