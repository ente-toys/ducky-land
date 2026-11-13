import {recoverArt, artPlaceholder, isArtPlaceholder} from './art-recovery.js';
import {DOMAdapter, ImageSource, Texture, Rectangle} from 'pixi.js';
import {cropSVG} from './theme-raster.js';

async function rasterizeSVG(svg,crop,resolution) {
  const adapter=DOMAdapter.get(),image=adapter.createImage();
  const bitmap=typeof globalThis.createImageBitmap==='function';
  const blob=new Blob([svg],{type:'image/svg+xml'});
  const objectURL=URL.createObjectURL(blob);
  try {
    image.src=typeof window==='undefined'&&image.constructor.name==='Image'&&typeof Buffer!=='undefined'?Buffer.from(await blob.arrayBuffer()):objectURL;
    await image.decode();
    if(bitmap){
      try{return await createImageBitmap(image,{premultiplyAlpha:'premultiply'});}catch{  }
    }
    const canvas=adapter.createCanvas(Math.ceil(crop[4]*resolution),Math.ceil(crop[5]*resolution));
    const context=canvas.getContext('2d');
    context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
    context.drawImage(image,0,0,canvas.width,canvas.height);
    return canvas;
  }finally{
    if(objectURL){URL.revokeObjectURL(objectURL);if(typeof window!=='undefined')image.src='';}
  }
}

export function createRasterLoader({schedule=globalThis.requestAnimationFrame?.bind(globalThis),
  now=()=>performance.now(),frameBudgetMs=5,concurrency=4,prepareSVG=cropSVG,exactFrame=false,
  prepareSource=text=>text,rasterize=(original,crop,resolution)=>rasterizeSVG(prepareSVG(original,crop,resolution),crop,resolution)}={}) {
  const originals=new Map(),leases=new Map();
  let disposed=false,scheduled=false,inFlight=0;
  const queue=[];
  const request=()=>{
    if(!queue.length||scheduled||disposed||inFlight>=concurrency)return;
    if(!schedule){drain();return;}
    scheduled=true;schedule(()=>{scheduled=false;drain();});
  };
  const drain=()=>{
    const began=now();
    while(queue.length&&inFlight<concurrency&&(!schedule||now()-began<frameBudgetMs)){
      queue.sort((a,b)=>Number(Boolean(b.order.visible))-Number(Boolean(a.order.visible))||(b.order.priority??0)-(a.order.priority??0)||(a.order.distance??0)-(b.order.distance??0));
      const {run,resolve,reject}=queue.shift();inFlight++;
      run().then(resolve,reject).finally(()=>{inFlight--;request();});
    }
    request();
  };
  const dispatch=(run,order)=>new Promise((resolve,reject)=>{if(disposed){reject(Error('Raster loader disposed'));return;}queue.push({run,resolve,reject,order});request();});
  const acquire=(key,resolution,order={})=>{
    if(disposed){console.warn('Raster loader disposed; accepting placeholder');return Promise.resolve(artPlaceholder());}
    let held=leases.get(key);
    if(held&&held.resolution!==resolution)console.warn('Raster lease resolution mismatch; keeping existing picture');
    if(!held){
      const promise=recoverArt(async()=>{
        const url=new URL(key,globalThis.location.href),crop=url.searchParams.get('rasterCrop').split(',').map(Number);
        url.searchParams.delete('rasterCrop');url.searchParams.delete('groundScale');
        const src=url.href;
        if(!originals.has(src))originals.set(src,fetch(src).then(r=>{if(!r.ok)throw Error(`Theme SVG ${r.status}: ${src}`);return r.text();}).then(prepareSource));
        const original=await originals.get(src);
        return dispatch(async()=>{
          if(disposed)throw Error('Raster loader disposed');
          const resource=await rasterize(original,crop,resolution);
          const source=new ImageSource({resource,resolution,alphaMode:'premultiply-alpha-on-upload'});
          if(typeof resource.close==='function')source.once('destroy',()=>resource.close());
          return new Texture({source,...(exactFrame?{frame:new Rectangle(0,0,crop[4],crop[5])}:{})});
        },order);
      },{label:key,fallback:artPlaceholder,late:texture=>texture.destroy(!isArtPlaceholder(texture))});
      leases.set(key,held={count:0,promise,resolution});
    }
    held.count++;return held.promise;
  };
  const release=key=>{
    const held=leases.get(key);if(!held||--held.count)return;
    held.promise.then(texture=>{
      if(!held.count&&leases.get(key)===held){leases.delete(key);texture.destroy(!isArtPlaceholder(texture));}
    }).catch(()=>{if(leases.get(key)===held)leases.delete(key);});
  };
  return {acquire,release,destroy(){if(disposed)return;disposed=true;originals.clear();for(const job of queue.splice(0))job.reject(Error('Raster loader disposed'));}};
}
