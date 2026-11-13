import {Texture} from 'pixi.js';

export const nextArtFrame = () => new Promise(resolve => {
  if (globalThis.requestAnimationFrame) requestAnimationFrame(resolve);
  else setTimeout(resolve, 0);
});

// Async decodes overlap, while synchronous raster work uses a small frame
// budget. Small pictures share a turn; a large indivisible raster yields next.
export function createArtQueue({concurrency = 4, yieldFrame = nextArtFrame,
  now = () => performance.now(), frameBudgetMs = 5, batchSize = 4} = {}) {
  const waiting = [], rasters = [];
  let running = 0, scheduled = false;
  const drain = () => {
    while (running < concurrency && waiting.length) {
      const {job, resolve, reject} = waiting.shift();
      running++;
      Promise.resolve().then(job).then(resolve, reject).finally(() => {running--; drain();});
    }
  };
  const rasterTurn = () => {
    if(scheduled||!rasters.length)return;
    scheduled=true;
    Promise.resolve().then(yieldFrame).then(()=>{
      const start=now();let count=0;
      while(rasters.length&&count<batchSize&&(count===0||now()-start<frameBudgetMs)){
        const {job,resolve,reject}=rasters.shift();count++;
        try{resolve(job());}catch(error){reject(error);}
      }
      scheduled=false;rasterTurn();
    },error=>{scheduled=false;for(const task of rasters.splice(0))task.reject(error);});
  };
  return {
    run(job) {return new Promise((resolve, reject) => {waiting.push({job, resolve, reject}); drain();});},
    raster(job) {return new Promise((resolve,reject)=>{rasters.push({job,resolve,reject});rasterTurn();});},
  };
}

export function textureSources(roots) {
  const sources = new Set();
  const visit = node => {
    if (!node || node.destroyed) return;
    if (node.texture?.source && node.texture !== Texture.EMPTY) sources.add(node.texture.source);
    for (const child of node.children ?? []) visit(child);
  };
  for (const root of roots) visit(root);
  return sources;
}

const uploaded=new WeakMap();
export async function uploadIsland(renderer, roots, {sources = [], yieldFrame = nextArtFrame, cancelled = () => false, batchSize = 4, frameBudgetMs = 5, batchBytes = 16 * 1048576, now = () => performance.now()} = {}) {
  let warmed=uploaded.get(renderer);if(!warmed)uploaded.set(renderer,warmed=new WeakSet());
  let count=0,bytes=0,start=0;
  for (const source of new Set([...sources, ...textureSources(roots)])) {
    if (cancelled()) throw Error('Island preparation cancelled');
    if (source.destroyed||warmed.has(source)) continue;
    const size=(source.pixelWidth??1)*(source.pixelHeight??1)*4;
    if(!count||bytes+size>batchBytes){await yieldFrame();count=0;bytes=0;start=now();}
    if (cancelled()) throw Error('Island preparation cancelled');
    source.autoGarbageCollect = false;
    // Pixi 8's GL initSource expects a Texture (it forwards to bind), while
    // WebGPU expects a TextureSource. bindSource is the explicit GL API.
    if (renderer.texture.bindSource) renderer.texture.bindSource(source);
    else renderer.texture.initSource(source);
    warmed.add(source);count++;bytes+=size;
    if(count>=batchSize||now()-start>=frameBudgetMs)count=0;
    // initSource uploads mip levels when autoGenerateMipmaps is enabled.
  }
}
