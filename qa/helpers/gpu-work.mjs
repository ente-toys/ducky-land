import {GlTextureSystem,GlRenderTargetAdaptor,TextureSource} from 'pixi.js';

// Also usable on an actual Pixi WebGL renderer. Bracket game frames with
// beginFrame(); no readPixels, finish, timing queries or GPU synchronization
// are introduced. Restore every hook when the measurement ends.
export function traceGPUFrames(renderer){
 const frames=new Map(),restore=[];let frame=0;
 const count=kind=>{const counters=frames.get(frame)??{};counters[kind]=(counters[kind]??0)+1;frames.set(frame,counters);};
 const wrap=(object,key,kind)=>{
  if(typeof object?.[key]!=='function')return;
  const original=object[key];object[key]=function(...args){count(kind);return original.apply(this,args);};
  restore.push(()=>{object[key]=original;});
 };
 wrap(renderer,'render','renders');
 for(const key of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced'])wrap(renderer.gl,key,'drawCalls');
 for(const key of ['texImage2D','texSubImage2D','texStorage2D'])wrap(renderer.gl,key,'textureTransfers');
 wrap(renderer.gl,'generateMipmap','mipmaps');wrap(renderer.gl,'blitFramebuffer','resolves');
 wrap(renderer.gl,'copyTexSubImage2D','textureCopies');wrap(renderer.gl,'readPixels','readbacks');wrap(renderer.gl,'finish','finishes');
 return {frames,beginFrame(number){frame=number;},restore(){restore.reverse().forEach(fn=>fn());}};
}

// Run Pixi's installed GL upload/mipmap and MSAA-resolve code against a command
// recorder. No driver or shader execution: draw counts here are drawable
// submissions (unbatched), not claims about Chrome's actual draw calls.
export function gpuWorkRenderer(){
 let frame=0,active=null;const events=[];
 const record=(kind,extra={})=>events.push({frame,kind,label:active?.label,...extra});
 const gl=new Proxy({TEXTURE_2D:3553,TEXTURE_3D:32879,TEXTURE_2D_ARRAY:35866,TEXTURE_CUBE_MAP:34067,TEXTURE0:33984,
  createTexture:()=>({}),texImage2D(...a){record(a.at(-1)?'upload':'allocation',{level:a[1],pixels:a[3]*a[4]});},
  texSubImage2D(){record('upload');},generateMipmap(){record('mipmap');},
  blitFramebuffer(...a){record('resolve',{pixels:(a[2]-a[0])*(a[3]-a[1])});},
 },{get:(o,k)=>k in o?o[k]:/^[A-Z_0-9]+$/.test(k)?0:()=>{}});
 const renderer={uid:98765,resolution:2,gl,gc:{now:0,addResourceHash(){}},context:{webGLVersion:2,supports:{nonPowOf2mipmaps:true},extensions:{}},runners:{contextChange:{add(){}}}};
 const texture=renderer.texture=new GlTextureSystem(renderer);
 texture._gl=gl;texture._mapFormatToType={'bgra8unorm':5121,'rgba8unorm':5121};
 texture._mapFormatToInternalFormat={'bgra8unorm':6408,'rgba8unorm':6408};texture._mapFormatToFormat={'bgra8unorm':6408,'rgba8unorm':6408};
 texture._mapViewDimensionToGlTarget={'2d':3553};
 const upload=texture.onSourceUpdate.bind(texture),mips=texture.onUpdateMipmaps.bind(texture);
 texture.onSourceUpdate=source=>{const prior=active;active=source;try{return upload(source);}finally{active=prior;}};
 texture.onUpdateMipmaps=(source,...args)=>{const prior=active;active=source;try{return mips(source,...args);}finally{active=prior;}};
 const adaptor=new GlRenderTargetAdaptor();
 adaptor.init(renderer,{getGpuRenderTarget:target=>({msaa:target.colorTexture.antialias,width:target.colorTexture.pixelWidth,height:target.colorTexture.pixelHeight})});
 renderer.render=({container,target})=>{
  record('render',{target:target?.source.label??'screen'});
  if(target)texture.bindSource(target.source);
  const visit=node=>{
   if(!node.visible||!node.renderable||node.alpha<=0)return;
   if(node.texture?.source)texture.bindSource(node.texture.source);
   for(const resource of Object.values(node.shader?.resources??{}))if(resource instanceof TextureSource)texture.bindSource(resource);
   if(node.texture||node.geometry||node.context)record('drawable',{node:node.label});
   for(const child of node.children??[])visit(child);
  };visit(container);
  if(target){const prior=active;active=target.source;adaptor.finishRenderPass({colorAttachments:[{}],colorTexture:target.source});active=prior;}
 };
 return {renderer,events,nextFrame(){frame++;renderer.gc.now=frame*16;},get frame(){return frame;},destroy(){texture.destroy();}};
}
