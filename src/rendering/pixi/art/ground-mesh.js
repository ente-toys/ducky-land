import {Container,Geometry,GlProgram,Shader,Mesh,Buffer,BufferUsage,Texture,BufferImageSource} from 'pixi.js';
const manifestURL=typeof __GROUND_MESH_MANIFEST__==='string'?__GROUND_MESH_MANIFEST__:null;
let manifestPromise;
const manifest=()=>manifestPromise??=(manifestURL?fetch(manifestURL,{signal:AbortSignal.timeout(5000)}).then(r=>{if(!r.ok)throw Error(`Ground manifest HTTP ${r.status}`);return r.json();}):Promise.resolve({}));
export const groundMeshEnabled=()=>new URLSearchParams(globalThis.location?.search??'').get('ground')!=='tiles';
export async function groundMeshEntry(id){if(!groundMeshEnabled())return null;try{return (await manifest())[id]??null;}catch(error){console.warn('Ground mesh unavailable; using tiles',error);return null;}}
const vertex=`#version 300 es
precision highp float;
in vec2 aPosition;
in vec4 aColor;
in vec2 aMaskUV;
out vec2 vMaskUV;
out vec4 vColor;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main(){vMaskUV=aMaskUV;vColor=aColor;gl_Position=vec4((uProjectionMatrix*uWorldTransformMatrix*uTransformMatrix*vec3(aPosition,1.)).xy,0.,1.);}`;
const fragment=`#version 300 es
precision highp float;
in vec4 vColor;
in vec2 vMaskUV;
uniform sampler2D uStrokeMask;
uniform vec4 uColor;
out vec4 finalColor;
void main(){float alpha=vColor.a*texture(uStrokeMask,vMaskUV/vec2(textureSize(uStrokeMask,0))).r;finalColor=vec4(vColor.rgb*alpha,alpha)*uColor;}`;
const frame=()=>new Promise(resolve=>globalThis.requestAnimationFrame?requestAnimationFrame(resolve):setTimeout(resolve,0));
async function parseMesh(buffer){
 if(typeof Worker==='undefined'){const {splitGroundMesh,decodeStrokeMask}=await import('./ground-mesh-worker.js'),parsed=splitGroundMesh(buffer);if(parsed.metadata.strokeMask)parsed.strokeMaskPixels=await decodeStrokeMask(parsed.metadata.strokeMask);return parsed;}
 const worker=new Worker(new URL('./ground-mesh-worker.js',import.meta.url),{type:'module'});
 try{return await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('Ground parse timed out')),10000);
  worker.onmessage=({data})=>{clearTimeout(timeout);data.error?reject(Error(data.error)):resolve(data);};
  worker.onerror=event=>{clearTimeout(timeout);reject(Error(event.message));};worker.postMessage(buffer,[buffer]);
 });}finally{worker.terminate();}
}
export async function loadGroundMesh(entry,{fetcher=fetch,parse=parseMesh}={}){
 const response=await fetcher(entry.url,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(`Ground mesh HTTP ${response.status}`);const start=performance.now();let buffer=await response.arrayBuffer();
 // Some hosts also set Content-Encoding, in which case fetch already inflated it.
 if(entry.compression==='gzip'&&new Uint8Array(buffer)[0]===31&&new Uint8Array(buffer)[1]===139)buffer=await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 const parsed=await parse(buffer);parsed.parseMs=performance.now()-start;return parsed;
}
export function createMeshGroundStream(id,container,{fallback,entry:provided,load=loadGroundMesh,makeMesh,renderer,yieldFrame=frame,index=0}={}){
 let pending,dead=false,tileStream,root,geometry=[],shaders=[],maskTexture;
 const stream={entries:[],resolutionTiles:[],pinned:true,mesh:true,
  prepare(options){return pending??=(async()=>{
   try{
    const entry=provided??await groundMeshEntry(id);if(!entry)throw Error('Tile ground selected');
    const parsed=await load(entry);if(dead)return;let taskStart=performance.now();stream.parseMs=parsed.parseMs??0;const constructStart=taskStart;
    if(!makeMesh&&parsed.metadata?.strokeMask){
     const mask=parsed.metadata.strokeMask;
     maskTexture=new Texture({source:new BufferImageSource({resource:parsed.strokeMaskPixels,width:mask.width,height:mask.height,format:'r8unorm',alphaMode:'no-premultiply-alpha',scaleMode:'linear',autoGenerateMipmaps:false,addressMode:'clamp-to-edge'})});
     renderer?.texture?.initSource?.(maskTexture.source);await yieldFrame();if(dead)return;taskStart=performance.now();
    }
    root=new Container({label:`${id} vector ground`});
    for(const chunk of parsed.chunks){
     if(dead)return;
     let mesh;
     if(makeMesh)mesh=makeMesh(chunk);else{
      const positions=new Buffer({data:chunk.positions,usage:BufferUsage.VERTEX|BufferUsage.COPY_DST}),colors=new Buffer({data:chunk.colors,usage:BufferUsage.VERTEX|BufferUsage.COPY_DST});
      const geo=new Geometry({attributes:{aPosition:{buffer:positions,format:'float32x2'},aColor:{buffer:colors,format:'unorm8x4'},aMaskUV:{buffer:new Buffer({data:chunk.uv??new Float32Array(chunk.positions.length).fill(.5),usage:BufferUsage.VERTEX|BufferUsage.COPY_DST}),format:'float32x2'}},indexBuffer:chunk.indices});
      const shader=new Shader({glProgram:GlProgram.from({vertex,fragment,name:'island-vector-ground'}),resources:{uStrokeMask:(maskTexture??Texture.WHITE).source}});
      geometry.push(geo);shaders.push(shader);mesh=new Mesh({geometry:geo,shader,label:`${id} ground mesh`});
      // Warm each buffer behind the reveal gate, with a yield after a small upload.
      if(renderer?.geometry?.bind){try{renderer.geometry.bind(geo,shader.glProgram);}finally{renderer.geometry.resetState();}}
     }
     root.addChild(mesh);if(performance.now()-taskStart>5){await yieldFrame();taskStart=performance.now();}
    }
    if(dead)return;
    // Add below ground decals which may already have been constructed.
    container.addChildAt(root,Math.min(index,container.children.length));stream.readyMs=stream.parseMs+performance.now()-constructStart;stream.ready=true;
   }catch(error){
    root?.destroy({children:true});root=null;for(const g of geometry)g.destroy(true);for(const s of shaders)s.destroy();geometry=[];shaders=[];maskTexture?.destroy(true);maskTexture=null;
    if(dead)return;console.warn(`${id}: using ground tiles`,error);
    root=new Container({label:`${id} tile ground fallback`});container.addChildAt(root,Math.min(index,container.children.length));tileStream=fallback(root);stream.fallbackStream=tileStream;await tileStream.prepare(options);stream.mesh=false;stream.ready=true;
   }
  })();},
  destroy(){if(dead)return;dead=true;tileStream?.destroy();root?.destroy({children:true});for(const g of geometry)g.destroy(true);for(const s of shaders)s.destroy();maskTexture?.destroy(true);},
 };
 return stream;
}
