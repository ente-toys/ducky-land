// HTTP-cache warming only. No renderer, bitmap decoder or texture allocation.
export function createIslandPrefetch({getIndex,selectTier,islands,distance=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2,fetchBytes=async(url,signal)=>{
  const response=await fetch(url,{priority:'low',signal});
  if(!response.ok)throw Error(`Island prefetch HTTP ${response.status}`);
  await response.arrayBuffer();
},idle=callback=>globalThis.requestIdleCallback?requestIdleCallback(callback,{timeout:2000}):setTimeout(callback,100)}={}) {
  const done=new Set();let current,paused=true,scheduled=false,running=false,controller,dead=false,generation=0;
  const schedule=()=>{
    if(dead||paused||running||scheduled||!current||!islands.some(i=>i.id!==current&&!done.has(i.id)))return;
    scheduled=true;idle(()=>{scheduled=false;void run();});
  };
  const run=async()=>{
    if(dead||paused||running)return;
    const origin=islands.find(i=>i.id===current);if(!origin)return;
    const next=islands.filter(i=>i.id!==current&&!done.has(i.id)).sort((a,b)=>distance(origin,a)-distance(origin,b)||a.id.localeCompare(b.id))[0];
    if(!next)return;
    running=true;const epoch=generation;controller=new AbortController();
    try{
      const data=await getIndex();
      if(dead||paused||epoch!==generation)return;
      const tier=selectTier(data,next.id);
      for(const url of new Set([...tier.webp,...tier.ground??[]])){
        if(dead||paused||epoch!==generation)return;
        await fetchBytes(url,controller.signal);
      }
      done.add(next.id);
    }catch(error){if(error.name!=='AbortError')done.add(next.id);}
    finally{running=false;controller=null;schedule();}
  };
  return {
    pause(){paused=true;generation++;controller?.abort();},
    resume(id){current=id;done.add(id);paused=false;schedule();},
    destroy(){dead=true;controller?.abort();},
  };
}
