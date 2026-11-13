// A shared queue gates the work after image.decode(), not just decode submission.
// Heavy work gets an exclusive animation frame, including async continuations.
export function createRasterWorkQueue({schedule=globalThis.requestAnimationFrame?.bind(globalThis),
  now=()=>performance.now(),frameBudgetMs=5,settleMs=320}={}) {
  const jobs=[];
  let scheduled=false,disposed=false,paused=false,changedAt=-Infinity,lastZoom,lastInput=-Infinity;
  let frame=0,heavyJobs=0,maxHeavyMs=0;
  const request=()=>{
    if(disposed||scheduled||!jobs.some(j=>!j.valid()||((!paused||!j.heavy||j.zoomSafe)&&j.ready())))return;
    scheduled=true;
    if(schedule)schedule(drain);else queueMicrotask(drain);
  };
  const drain=()=>{
    scheduled=false;if(disposed)return;
    frame++;
    for(let i=jobs.length-1;i>=0;i--)if(!jobs[i].valid())jobs.splice(i,1)[0].reject(Error('Raster work cancelled'));
    jobs.sort((a,b)=>Number(Boolean(b.order.visible))-Number(Boolean(a.order.visible))||(b.order.priority??0)-(a.order.priority??0)||(a.order.distance??0)-(b.order.distance??0));
    const began=now();let ran=false;
    while(jobs.length){
      const index=jobs.findIndex(j=>(!paused||!j.heavy||j.zoomSafe)&&j.ready());
      if(index<0)break;
      const job=jobs[index];
      if(ran&&(job.heavy||now()-began>=frameBudgetMs))break;
      jobs.splice(index,1);const start=now();
      try{job.resolve(job.run());}catch(error){job.reject(error);}
      ran=true;
      if(job.heavy){heavyJobs++;maxHeavyMs=Math.max(maxHeavyMs,now()-start);break;}
    }
    // Paused queues are woken by update(), without a busy rAF loop.
    request();
  };
  return {
    enqueue(run,order={},heavy=true,valid=()=>true,zoomSafe=false,ready=()=>true){return new Promise((resolve,reject)=>{
      if(disposed){reject(Error('Raster queue disposed'));return;}
      jobs.push({run,order,heavy,valid,resolve,reject,zoomSafe,ready});request();
    });},
    update(zoom,time=now(),activeInput=false){
      if(lastZoom!==undefined&&Math.abs(Math.log(zoom/lastZoom))>1e-6)changedAt=time;
      if(activeInput)lastInput=time;
      lastZoom=zoom;
      paused=time-Math.max(changedAt,lastInput)<settleMs;
      request();return paused;
    },
    get paused(){return paused;},
    get disposed(){return disposed;},
    stats(){return {pending:jobs.length,frame,heavyJobs,maxHeavyMs,paused};},
    destroy(){disposed=true;for(const job of jobs.splice(0))job.reject(Error('Raster queue disposed'));},
  };
}

const close=resource=>{if(typeof resource?.close==='function')resource.close();else if(resource){resource.width=resource.height=1;}};
// CPU resources are never TextureSources. Uploads remain small, independently
// budgeted crops; returning to recently seen ground reuses these backing pixels.
export function createRasterCache({budgetBytes=128*1048576}={}) {
  const entries=new Map(),waiters=new Set();let bytes=0,peakBytes=0,hits=0,misses=0,disposed=false;
  const wake=()=>{for(const done of waiters)done();waiters.clear();};
  const room=async size=>{
    while(!disposed){
      for(const [key,entry]of entries){
        if(bytes+size<=budgetBytes)break;
        if(entry.refs||!entry.resource)continue;
        entries.delete(key);bytes-=entry.bytes;close(entry.resource);
      }
      if(bytes+size<=budgetBytes){bytes+=size;peakBytes=Math.max(peakBytes,bytes);return;}
      await new Promise(resolve=>waiters.add(resolve));
    }
    throw Error('Raster cache disposed');
  };
  return {
    budgetBytes,
    async use(key,size,create,read,valid=()=>true){
      if(disposed)throw Error('Raster cache disposed');
      if(size>budgetBytes)throw Error('Raster band exceeds CPU cache budget');
      let entry=entries.get(key);
      if(entry){hits++;entries.delete(key);entries.set(key,entry);}
      else{
        misses++;entry={refs:0,bytes:size,resource:null,users:new Set()};entries.set(key,entry);
        entry.promise=(async()=>{
          await room(size);
          try{
            const resource=await create(()=>!disposed&&[...entry.users].some(user=>user.valid()));
            if(disposed){close(resource);throw Error('Raster cache disposed');}
            entry.resource=resource;return resource;
          }catch(error){bytes-=size;if(entries.get(key)===entry)entries.delete(key);wake();throw error;}
        })();
      }
      const user={valid};entry.refs++;entry.users.add(user);
      try{return await read(await entry.promise);}
      finally{entry.refs--;entry.users.delete(user);wake();}
    },
    stats(){return {bytes,peakBytes,budgetBytes,entries:entries.size,hits,misses};},
    destroy(){if(disposed)return;disposed=true;for(const e of entries.values())if(e.resource){bytes-=e.bytes;close(e.resource);}entries.clear();wake();},
  };
}
