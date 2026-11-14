// Fetch all sheets concurrently at foreground priority, without Wasm or SVG work.
export async function loadRasterDetail(spec,{signal,fetcher=fetch,decode=createImageBitmap}={}){
 const sheetsPromise=fetcher(spec.plan,{signal,priority:'high'}).then(r=>{if(!r.ok)throw Error(`Detail plan HTTP ${r.status}`);return r.json();});
 sheetsPromise.catch(()=>{});
 let packed;
 if(spec.rasterPack){
  try{const r=await fetcher(spec.rasterPack.url,{signal,priority:'high'});if(!r.ok)throw Error(`Detail pack HTTP ${r.status}`);packed=await r.blob();}
  catch(error){await sheetsPromise.catch(()=>{});throw error;}
 }
 const count=spec.rasterPack?spec.rasterPack.ranges.length:spec.raster.length;
 const results=new Array(count);let cursor=0;
 await Promise.all(Array.from({length:Math.min(4,count)},async()=>{
  while(cursor<count){const i=cursor++;
   try{
    signal?.throwIfAborted();let blob;
    if(packed){const [offset,length]=spec.rasterPack.ranges[i];blob=packed.slice(offset,offset+length,'image/webp');}
    else{const r=await fetcher(spec.raster[i],{signal,priority:'high'});if(!r.ok)throw Error(`Detail sheet HTTP ${r.status}`);blob=await r.blob();}
    results[i]={status:'fulfilled',value:await decode(blob,{premultiplyAlpha:'premultiply'})};
   }catch(reason){results[i]={status:'rejected',reason};}
  }
 }));
 let plan;
 try{plan=await sheetsPromise;const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;signal?.throwIfAborted();}
 catch(error){for(const r of results)if(r.status==='fulfilled')r.value.close();throw error;}
 return {sheets:plan.sheets,bitmaps:results.map(r=>r.value)};
}
