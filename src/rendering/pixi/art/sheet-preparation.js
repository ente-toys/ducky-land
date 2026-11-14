let worker, serial=0;
const tasks=new Map();
export function decodeArtBitmap(blob,options={}) {
  if(options.crop)return globalThis.createImageBitmap(blob,...options.crop,options);
  if(typeof Worker!=='function')return globalThis.createImageBitmap(blob,options);
  try {
    if(!worker){
      worker=new Worker(new URL('./bitmap-worker.js',import.meta.url),{type:'module'});
      worker.onmessage=({data:{id,bitmap,error}})=>{const task=tasks.get(id);tasks.delete(id);if(error)task?.reject(Error(error));else task?.resolve(bitmap);};
      worker.onerror=()=>{for(const task of tasks.values())task.reject(Error('Art bitmap worker failed'));tasks.clear();worker.terminate();worker=undefined;};
    }
    return new Promise((resolve,reject)=>{const id=++serial;tasks.set(id,{resolve,reject});worker.postMessage({id,blob,options});}).catch(()=>globalThis.createImageBitmap(blob,options));
  }catch{return globalThis.createImageBitmap(blob,options);}
}
