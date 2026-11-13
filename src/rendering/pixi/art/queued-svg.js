import {DOMAdapter,extensions,ExtensionType,ImageSource,Texture,Cache,Assets} from 'pixi.js';
import {rasterizeSVG} from './theme-art-stream.js';

// Assets.load's stock SVG parser draws in its decode promise continuation.
// Use the same frame queue for static art and globe previews, including loads
// already decoding when a wheel/pinch starts. Assets keeps its usual leases.
export const queuedSVGParser={
  extension:{type:ExtensionType.LoadParser,name:'ducky-raster-svg'},
  name:'ducky-raster-svg',
  async load(url,asset,loader){
    const {workQueue,sourceCache,resolution=1,...style}=asset.data;
    const response=await DOMAdapter.get().fetch(url);
    if(!response.ok)throw Error(`SVG ${response.status}: ${url}`);
    const svg=await response.text();
    const create=()=>workQueue.enqueue(()=>rasterizeSVG(svg,null,resolution,workQueue,{},()=>!workQueue.disposed));
    let unpin;
    let resource;
    if(sourceCache){
      // Read only the root tag. Parsing an entire compiled SVG into a DOM on
      // every cache hit would move a large script hitch into zoom-out.
      const root=svg.match(/<svg\b[^>]*>/)?.[0]??'',attr=name=>root.match(new RegExp(`\\b${name}=["']([^"']+)`))?.[1];
      const box=attr('viewBox')?.split(/[ ,]+/).map(Number);
      const w=Math.ceil((parseFloat(attr('width'))||box?.[2])*resolution),h=Math.ceil((parseFloat(attr('height'))||box?.[3])*resolution);
      // Pin the CPU canvas until the uploaded TextureSource dies. On walking,
      // its GPU lease is freed, but the bounded cache keeps the pixels for the
      // next approach. A cache hit requires no queued SVG work during input.
      resource=await new Promise((resolve,reject)=>{
        sourceCache.use(`preview:${url}:${resolution}`,w*h*4,create,pixels=>new Promise(done=>{unpin=done;resolve(pixels);}),()=>!workQueue.disposed).catch(reject);
      });
    }else resource=await create();
    let source;
    try{source=new ImageSource({resource,resolution,label:url,alphaMode:'premultiply-alpha-on-upload',...style});}
    catch(error){unpin?.();throw error;}
    source.once('destroy',()=>unpin?.());
    source._sourceOrigin=url;
    const texture=new Texture({source,label:url});
    const forget=()=>{if(loader?.promiseCache)delete loader.promiseCache[url];if(Cache.has(url))Cache.remove(url);};
    source.once('destroy',forget);texture.once('destroy',()=>{if(!source.destroyed)forget();});
    return texture;
  },
  unload(texture){texture.destroy(true);},
};
extensions.add(queuedSVGParser);

export function loadQueuedTexture(src,resolution,style={},workQueue){
  // Pixi keeps resolver metadata after unloading. Replace a disposed engine's
  // queue reference before retrying the same URL in a new engine.
  if(workQueue&&Assets.resolver.hasKey(src)){
    const prior=Assets.resolver.resolve(src);
    if(prior.data?.workQueue!==workQueue)Assets.resolver.removeAlias(src,prior);
  }
  return Assets.load({src,...(workQueue&&/\.svg(?:[?#]|$)/.test(src)?{parser:'ducky-raster-svg'}:{}),
    data:{resolution,...style,...(workQueue?{workQueue}:{})}});
}
