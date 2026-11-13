import {DOMAdapter, ImageSource, Texture, Rectangle} from 'pixi.js';
import {cropSVG} from './theme-raster.js';
import {createRasterWorkQueue,createRasterCache} from './raster-work.js';

export async function rasterizeSVG(svg,crop,resolution,work,order,valid) {
  const adapter=DOMAdapter.get(),image=adapter.createImage();
  const bitmap=typeof globalThis.createImageBitmap==='function';
  const objectURL=bitmap?URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})):null;
  try {
    image.src=objectURL??'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
    await image.decode();
    // Decoding an SVG does not rasterize its paths. The expensive draw must
    // re-enter the frame queue after decode, including the fallback branch.
    return await work.enqueue(()=>{
      const width=crop?.[4]??image.width,height=crop?.[5]??image.height;
      const canvas=adapter.createCanvas(crop?.pixelWidth??Math.ceil(width*resolution),crop?.pixelHeight??Math.ceil(height*resolution));
      const context=canvas.getContext('2d',{willReadFrequently:true});
      context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
      context.drawImage(image,0,0,crop?canvas.width:width*resolution,crop?canvas.height:height*resolution);
      return canvas;
    },order,true,valid);
  }finally{
    if(objectURL){URL.revokeObjectURL(objectURL);image.src='';}
  }
}

export function createRasterLoader({schedule=globalThis.requestAnimationFrame?.bind(globalThis),
  now=()=>performance.now(),frameBudgetMs=5,prepareSVG=cropSVG,exactFrame=false,
  prepareSource,rasterize,workQueue,sourceCache,
  maxBandPixels=4*1048576,maxBandSide=4096,cropParameter='rasterCrop',cacheSources=true}={}) {
  const work=workQueue??createRasterWorkQueue({schedule,now,frameBudgetMs});
  const cache=sourceCache??createRasterCache();
  const originals=new Map(),leases=new Map();
  let disposed=false;
  // Different SVG preparation rules must never alias in a shared CPU cache.
  const namespace=prepareSVG===cropSVG?'svg':prepareSVG.name;
  const acquire=(key,resolution,order={})=>{
    if(disposed)return Promise.reject(Error('Raster loader disposed'));
    let held=leases.get(key);
    if(held&&held.resolution!==resolution)throw Error('Raster lease resolution mismatch');
    if(!held){
      held={count:0,resolution};
      const valid=()=>!disposed&&held.count>0&&(!order.valid||order.valid());
      held.promise=(async()=>{
        const url=new URL(key,globalThis.location.href),crop=url.searchParams.get(cropParameter).split(',').map(Number);
        url.searchParams.delete(cropParameter);url.searchParams.delete('groundScale');
        const src=url.href;
        if(!originals.has(src))originals.set(src,fetch(src).then(r=>{if(!r.ok)throw Error(`Theme SVG ${r.status}: ${src}`);return r.text();})
          .then(text=>prepareSource?work.enqueue(()=>prepareSource(text),order,true,()=>!disposed):text)
          .catch(error=>{originals.delete(src);throw error;}));
        const original=await originals.get(src);
        const draw=(band,isValid)=>work.enqueue(()=>rasterize
          ?rasterize(original,band,resolution)
          :rasterizeSVG(prepareSVG(original,band,resolution),band,resolution,work,order,isValid),order,true,isValid);
        let resource;
        if(!cacheSources){resource=await draw(crop,valid);}
        else {
          const [width,height,x,y,w,h]=crop;
          const totalW=Math.ceil(width*resolution),totalH=Math.ceil(height*resolution);
          const pixels=Math.min(maxBandPixels,Math.floor(cache.budgetBytes/4));
          const bandW=Math.min(totalW,maxBandSide-4,Math.max(1,Math.floor(pixels/5)-4));
          const bandH=Math.min(totalH,Math.max(1,Math.floor(pixels/(bandW+4))-4),maxBandSide-4);
          const left=Math.max(0,Math.floor(x*resolution/bandW)*bandW),top=Math.max(0,Math.floor(y*resolution/bandH)*bandH);
          const right=Math.min(totalW,(x+w)*resolution),bottom=Math.min(totalH,(y+h)*resolution);
          // Crop canvases never reference a cache backing after this copy. The
          // cache can evict a band while its uploaded crops remain on screen.
          resource=await work.enqueue(()=>DOMAdapter.get().createCanvas(Math.ceil(w*resolution),Math.ceil(h*resolution)),order,false,valid);
          try{
            for(let by=top;by<bottom;by+=bandH)for(let bx=left;bx<right;bx+=bandW){
              // A two-pixel gutter keeps antialiasing identical across bands.
              const sx=Math.max(0,bx-2),sy=Math.max(0,by-2),ex=Math.min(totalW,bx+bandW+2),ey=Math.min(totalH,by+bandH+2);
              const band=Object.assign([width,height,sx/resolution,sy/resolution,(ex-sx)/resolution,(ey-sy)/resolution],{pixelWidth:ex-sx,pixelHeight:ey-sy});
              const cacheKey=[namespace,src,width,height,resolution,sx,sy,ex,ey].join('|');
              await cache.use(cacheKey,(ex-sx)*(ey-sy)*4,isValid=>draw(band,isValid),bitmap=>work.enqueue(()=>{
                const context=resource.getContext('2d',{willReadFrequently:true});context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
                // Partition output pixels, rather than antialiasing two
                // adjacent fractional rectangles into a translucent seam.
                const dx=Math.max(0,Math.ceil(bx-x*resolution)),dy=Math.max(0,Math.ceil(by-y*resolution));
                const cw=Math.min(resource.width,Math.ceil(Math.min(bx+bandW,totalW)-x*resolution))-dx;
                const ch=Math.min(resource.height,Math.ceil(Math.min(by+bandH,totalH)-y*resolution))-dy;
                if(cw>0&&ch>0)context.drawImage(bitmap,x*resolution+dx-sx,y*resolution+dy-sy,cw,ch,dx,dy,cw,ch);
              },order,false,valid),valid);
            }
          }catch(error){resource.width=resource.height=1;throw error;}
        }
        if(!valid()){resource.close?.();throw Error('Raster work cancelled');}
        const source=new ImageSource({resource,resolution,label:key,alphaMode:'premultiply-alpha-on-upload'});
        if(typeof resource.close==='function')source.once('destroy',()=>resource.close());
        return new Texture({source,...(exactFrame?{frame:new Rectangle(0,0,crop[4],crop[5])}:{})});
      })();
      held.promise=held.promise.then(texture=>{held.texture=texture;return texture;});
      leases.set(key,held);
    }
    held.count++;return held.promise;
  };
  const release=key=>{
    const held=leases.get(key);if(!held||--held.count)return;
    const retire=()=>{if(!held.count&&leases.get(key)===held){leases.delete(key);held.texture?.destroy(true);}};
    if(held.texture)retire();
    else held.promise.then(retire).catch(()=>{if(leases.get(key)===held)leases.delete(key);});
  };
  return {acquire,release,workQueue:work,sourceCache:cache,
    destroy(){if(disposed)return;disposed=true;originals.clear();for(const held of leases.values())held.texture?.destroy(true);leases.clear();if(!workQueue)work.destroy();if(!sourceCache)cache.destroy();}};
}
