// Preserve the existing URL leases, but let a new engine retry pending loads
// whose original frame queue was destroyed during a quick remount.
export function createTextureLeases({load,unload}) {
  const leases=new Map(),unloads=new Map();
  const acquire=(src,resolution=1,options={})=>{
    let entry=leases.get(src);
    const start=()=>load(src,resolution,options);
    if(!entry){
      entry={count:0,texture:null,workQueue:options.workQueue};
      entry.promise=(unloads.has(src)?unloads.get(src).then(start):start()).then(texture=>{entry.texture=texture;return texture;});
      leases.set(src,entry);
    }else if(!entry.texture&&entry.workQueue?.disposed&&entry.workQueue!==options.workQueue){
      entry.workQueue=options.workQueue;
      entry.promise=entry.promise.catch(start).then(texture=>{entry.texture=texture;return texture;});
    }
    entry.count++;return entry.promise;
  };
  const release=src=>{
    const entry=leases.get(src);if(!entry||--entry.count)return;
    const retire=()=>{
      if(entry.count||leases.get(src)!==entry)return;
      leases.delete(src);
      const unloading=unload(src).catch(()=>{}).finally(()=>{if(unloads.get(src)===unloading)unloads.delete(src);});
      entry.texture?.destroy(true);unloads.set(src,unloading);
    };
    if(entry.texture)retire();
    else {const watched=entry.promise;watched.then(retire).catch(()=>{if(entry.promise===watched&&!entry.count&&leases.get(src)===entry)leases.delete(src);});}
  };
  return {acquire,release};
}
