import {DOMAdapter, ImageSource, Texture, Rectangle} from 'pixi.js';
import {cropSVG} from './theme-raster.js';

async function rasterizeSVG(svg,crop,resolution) {
  const adapter=DOMAdapter.get(),image=adapter.createImage();
  const bitmap=typeof globalThis.createImageBitmap==='function';
  const objectURL=bitmap?URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})):null;
  try {
    image.src=objectURL??'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
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
    if(objectURL){URL.revokeObjectURL(objectURL);image.src='';}
  }
}

export function createRasterLoader({schedule=globalThis.requestAnimationFrame?.bind(globalThis),
  now=()=>performance.now(),frameBudgetMs=5,concurrency=64,prepareSVG=cropSVG,exactFrame=false,
  cropParam='rasterCrop',prepareSource=text=>text,rasterize=(original,crop,resolution)=>rasterizeSVG(prepareSVG(original,crop,resolution),crop,resolution)}={}) {
  const originals=new Map(),leases=new Map();
  let disposed=false,scheduled=false,inFlight=0,delivered=0;
  const queue=[],completed=[];
  const request=()=>{
    if(scheduled||disposed||(!completed.length&&(!queue.length||inFlight>=concurrency)))return;
    if(!schedule){drain();return;}
    scheduled=true;schedule(()=>{scheduled=false;drain();});
  };
  const drain=()=>{
    delivered=0;
    while(completed.length&&delivered<8){delivered++;completed.shift()();}
    const began=now();
    for(let i=queue.length-1;i>=0;i--)if(queue[i].order.isNeeded?.()===false)queue.splice(i,1)[0].reject(new DOMException('Raster no longer needed','AbortError'));
    queue.sort((a,b)=>Number(Boolean(b.order.visible))-Number(Boolean(a.order.visible))||(b.order.priority??0)-(a.order.priority??0)||(a.order.distance??0)-(b.order.distance??0));
    while(queue.length&&inFlight<concurrency&&(!schedule||now()-began<frameBudgetMs)){
      const {run,resolve,reject}=queue.shift();inFlight++;
      run().then(value=>{if(disposed||!schedule||delivered<8){delivered++;resolve(value);}else{completed.push(()=>resolve(value));request();}},reject).finally(()=>{inFlight--;request();});
    }
    request();
  };
  const dispatch=(run,order)=>new Promise((resolve,reject)=>{if(disposed){reject(new DOMException('Raster loader disposed','AbortError'));return;}queue.push({run,resolve,reject,order});request();});
  const acquire=(key,resolution,order={})=>{
    if(disposed)return Promise.reject(new DOMException('Raster loader disposed','AbortError'));
    let held=leases.get(key);
    if(held&&held.resolution!==resolution)throw Error('Raster lease resolution mismatch');
    if(!held){
      const promise=(async()=>{
        const url=new URL(key,globalThis.location.href),crop=url.searchParams.get(cropParam).split(',').map(Number);
        url.searchParams.delete(cropParam);url.searchParams.delete('groundScale');
        const src=url.href;
        if(!originals.has(src))originals.set(src,fetch(src).then(r=>{if(!r.ok)throw Error(`Theme SVG ${r.status}: ${src}`);return r.text();}).then(prepareSource));
        const original=await originals.get(src);
        const check=()=>{if(disposed||order.isNeeded?.()===false)throw new DOMException('Raster no longer needed','AbortError');};
        check();
        return dispatch(async()=>{
          check();
          const resource=await rasterize(original,crop,resolution);
          if(disposed||order.isNeeded?.()===false){resource.close?.();throw new DOMException('Raster no longer needed','AbortError');}
          const source=new ImageSource({resource,resolution,alphaMode:'premultiply-alpha-on-upload'});
          if(typeof resource.close==='function')source.once('destroy',()=>resource.close());
          return new Texture({source,...(exactFrame?{frame:new Rectangle(0,0,crop[4],crop[5])}:{})});
        },order);
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
  return {acquire,release,destroy(){if(disposed)return;disposed=true;originals.clear();for(const finish of completed.splice(0))finish();for(const job of queue.splice(0))job.reject(new DOMException('Raster loader disposed','AbortError'));}};
}
