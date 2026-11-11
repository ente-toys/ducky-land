// Decode completion must not expose a whole batch of cold textures to the next
// draw. Upload one shared GPU source per frame, before making its sprites live.
export function createTextureUploadQueue(upload, schedule=globalThis.requestAnimationFrame.bind(globalThis)) {
  const pending=[],sources=new WeakMap();
  let scheduled=false,disposed=false;
  const request=()=>{
    if(scheduled||disposed||!pending.length)return;
    scheduled=true;
    schedule(()=>{
      scheduled=false;
      if(disposed)return;
      const job=pending.shift();
      try{upload(job.source);job.resolve();}catch(error){sources.delete(job.source);job.reject(error);}
      request();
    });
  };
  return {
    enqueue(texture){
      if(disposed)return Promise.resolve();
      const source=texture.source;
      let ready=sources.get(source);
      if(!ready){
        ready=new Promise((resolve,reject)=>pending.push({source,resolve,reject}));
        sources.set(source,ready);request();
      }
      return ready;
    },
    destroy(){disposed=true;for(const job of pending.splice(0))job.resolve();},
  };
}
