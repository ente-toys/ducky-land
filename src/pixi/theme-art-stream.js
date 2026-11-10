import {DOMAdapter, ImageSource, Texture} from 'pixi.js';
import {cropSVG} from './theme-raster.js';

// Same SVG -> Image -> canvas -> ImageSource pipeline as Pixi's loadSVG parser,
// with a small cropped viewport. Leases are owned by the shared 128 MiB pool.
export function createRasterLoader() {
  const originals=new Map(),leases=new Map();
  let disposed=false;
  const acquire=(key,resolution)=>{
    let held=leases.get(key);
    if(held&&held.resolution!==resolution)throw Error('Raster lease resolution mismatch');
    if(!held){
      const promise=(async()=>{
        const url=new URL(key,globalThis.location.href),crop=url.searchParams.get('rasterCrop').split(',').map(Number);
        url.searchParams.delete('rasterCrop');url.searchParams.delete('groundScale');
        const src=url.href;
        if(!originals.has(src))originals.set(src,fetch(src).then(r=>{if(!r.ok)throw Error(`Theme SVG ${r.status}: ${src}`);return r.text();}));
        const svg=cropSVG(await originals.get(src),crop,resolution),adapter=DOMAdapter.get(),image=adapter.createImage();
        image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
        await image.decode();
        const canvas=adapter.createCanvas(Math.ceil(crop[4]*resolution),Math.ceil(crop[5]*resolution));
        const context=canvas.getContext('2d');context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
        context.drawImage(image,0,0,canvas.width,canvas.height);
        return new Texture({source:new ImageSource({resource:canvas,resolution,alphaMode:'premultiply-alpha-on-upload'})});
      })();
      leases.set(key,held={count:0,promise,resolution});
    }
    held.count++;return held.promise;
  };
  const release=key=>{
    const held=leases.get(key);if(!held||--held.count)return;
    held.promise.then(texture=>{
      if(!held.count&&leases.get(key)===held){leases.delete(key);texture.destroy(true);}
    }).catch(()=>{if(leases.get(key)===held)leases.delete(key);});
  };
  return {acquire,release,destroy(){if(disposed)return;disposed=true;originals.clear();}};
}
