import {Texture} from 'pixi.js';
import {recoverArt, finalTextureSource, isArtPlaceholder, ART_TIMEOUT_MS} from './art-recovery.js';

let busyUntil=0;
export const markArtActivity=(duration=180)=>{busyUntil=performance.now()+duration;};
export const nextArtFrame = () => new Promise(resolve => {
  const check=()=>{
    if(performance.now()<busyUntil){setTimeout(check,32);return;}
    if(globalThis.requestAnimationFrame)requestAnimationFrame(()=>{
      if(performance.now()<busyUntil)check();else resolve();
    });
    else setTimeout(resolve,0);
  };
  check();
});

// Readiness work must progress even while the player moves. Idle background
// jobs can still use nextArtFrame's activity-aware scheduling above.
export const preparationFrame=()=>new Promise(resolve=>{
  if(globalThis.requestAnimationFrame)requestAnimationFrame(()=>resolve());
  else setTimeout(resolve,0);
});

// Async decodes overlap, while synchronous raster work uses a small frame
// budget. Small pictures share a turn; a large indivisible raster yields next.
export function createArtQueue({concurrency = 4, yieldFrame = preparationFrame,
  now = () => performance.now(), frameBudgetMs = 14, batchSize = 256} = {}) {
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

// Scene/rig construction also needs a budget: hundreds of resolved promises
// otherwise create one uninterrupted microtask train after the last decode.
export async function mapArtInFrames(items, visit, {yieldFrame=preparationFrame,
  now=()=>performance.now(),frameBudgetMs=14,batchSize=1024,cancelled=()=>false}={}) {
  const results=[];let start=now(),count=0;
  for(let i=0;i<items.length;i++){
    if(cancelled())break;
    if(count>=batchSize||now()-start>=frameBudgetMs){await recoverArt(yieldFrame,{label:'Island construction frame'});start=now();count=0;}
    if(cancelled())break;
    results.push(await visit(items[i],i));count++;
  }
  return results;
}

function textureSources(roots) {
  const sources = new Set();
  const visit = node => {
    if (!node || node.destroyed) return;
    if (node.texture?.source && node.texture !== Texture.EMPTY) sources.add(node.texture.source);
    for (const child of node.children ?? []) visit(child);
  };
  for (const root of roots) visit(root);
  return sources;
}

export function assertFinalTexture(texture, label = 'Island art') {
  const source=finalTextureSource(texture);
  if(!source&&!isArtPlaceholder(texture))console.warn(`${label}: texture is not final; accepting placeholder`);
  return source;
}

const acceptedNodes=new WeakSet();
function requiredNodes(roots) {
  const nodes=[];
  const visit=node=>{
    if(!node||node.destroyed)return;
    if('texture' in node&&node.renderPipeId!=='graphics')nodes.push(node);
    for(const child of node.children??[])visit(child);
  };
  roots.forEach(visit);return nodes;
}
async function requiredTextureSources(roots,timeoutMs) {
  const nodes=requiredNodes(roots);
  await Promise.all(nodes.filter(node=>!acceptedNodes.has(node)&&!isArtPlaceholder(node.texture)&&!finalTextureSource(node.texture)).map(node=>
    recoverArt(()=>node.texture,{label:node.label||'Island texture',timeoutMs,
      valid:texture=>!!finalTextureSource(texture)||isArtPlaceholder(texture)||node.destroyed,
      fallback:()=>{acceptedNodes.add(node);}})));
  return new Set(nodes.map(node=>!node.destroyed&&finalTextureSource(node.texture)).filter(Boolean));
}

const uploaded=new WeakMap();
export async function uploadIsland(renderer, roots, {sources = [], requiredRoots = [], yieldFrame = preparationFrame, cancelled = () => false, batchSize = 64, frameBudgetMs = 8, batchBytes = 128 * 1048576, now = () => performance.now(), timeoutMs=ART_TIMEOUT_MS} = {}) {
  if(cancelled())return;
  let warmed=uploaded.get(renderer);if(!warmed)uploaded.set(renderer,warmed=new WeakSet());
  let count=0,bytes=0,start=now(),started=false;
  // Keep the whole-island barrier for healthy pictures, including hidden
  // ground. A failed piece is accepted once and cannot pin readiness forever.
  let required=await requiredTextureSources(requiredRoots,timeoutMs);
  const pending=new Set([...sources,...textureSources(roots),...required]);
  for (const source of pending) {
    if(cancelled())return;
    if(!source||source===Texture.EMPTY.source||source.destroyed||warmed.has(source))continue;
    const size=(source.pixelWidth??1)*(source.pixelHeight??1)*4;
    if(!started||!count||bytes+size>batchBytes){await recoverArt(yieldFrame,{label:'Island upload frame',timeoutMs});count=0;bytes=0;start=now();}
    if(cancelled())return;
    required=await requiredTextureSources(requiredRoots,timeoutMs);
    for(const current of required)if(!warmed.has(current))pending.add(current);
    if(source.destroyed||warmed.has(source))continue;
    source.autoGarbageCollect=false;
    await recoverArt(()=>{
      if(renderer.texture.bindSource)renderer.texture.bindSource(source);
      else renderer.texture.initSource(source);
    },{label:source.label||'Island GPU upload',timeoutMs});
    warmed.add(source);started=true;count++;bytes+=size;
    if(count>=batchSize||now()-start>=frameBudgetMs)count=0;
    required=await requiredTextureSources(requiredRoots,timeoutMs);
    for(const current of required)if(!warmed.has(current))pending.add(current);
  }
}
