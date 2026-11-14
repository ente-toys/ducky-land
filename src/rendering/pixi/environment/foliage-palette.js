import {loadPrerenderManifest} from '../art/whole-svg-loader.js';
const FALLBACK=0x63ae45;
export function createFoliagePalette({getBaked=async()=>null,createWorker=()=>new Worker(new URL('./foliage-palette.worker.js',import.meta.url),{type:'module'})}={}) {
  const colours=new Map(), pending=new Map();
  let worker, sequence=0;

  // Only small colour numbers cross back to the main thread. Keep them across
  // island releases, so returning to an island never reparses its tree pictures.
  function loadFoliageColour(src) {
    if (colours.has(src)) return colours.get(src);
    const colour=Promise.resolve().then(()=>getBaked(src)).catch(()=>null).then(value=>{
      if(typeof value==='number')return value;
      return new Promise(resolve=>{
      try {
        if (!worker) {
          worker=createWorker();
          worker.onmessage=({data})=>{pending.get(data.id)?.(data.colour);pending.delete(data.id);};
          worker.onerror=()=>{
            for (const done of pending.values()) done(FALLBACK);
            pending.clear();worker.terminate();worker=null;
          };
        }
        const id=++sequence;pending.set(id,resolve);
        worker.postMessage({id,src:new URL(src,globalThis.location.href).href});
      } catch {pending.delete(sequence);resolve(FALLBACK);}
    });
    });
    colours.set(src,colour);
    return colour;
  }

  return loadFoliageColour;
}
export const loadFoliageColour=createFoliagePalette({getBaked:async src=>(await loadPrerenderManifest([src]))[src]?.foliageColour});
