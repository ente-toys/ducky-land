// Standalone intro entry. No renderer, application imports or side effects.
let index, entry;
const pending = new Map();
const json = async url => {
  const response = await fetch(url, {cache:'no-cache'});
  if (!response.ok) throw Error(response.status);
  return response.json();
};
// Viewport zoom is distinct from the camera's maximum zoom. A phone should
// not preload the density chosen for a full-screen desktop viewport.
export function selectIslandTier(data,id,dpr=Math.min(globalThis.devicePixelRatio||1,2),width=globalThis.innerWidth,height=globalThis.innerHeight){
  const tier=data.islands[id]?.[Math.min(3,Math.max(1,Math.ceil(dpr)))];
  if(!tier)return;
  const zoom=width>0&&height>0?Math.min(1.8,width/1500,height/1000):.65;
  const views=tier.views;
  const detail=views?.find(v=>v.zoom>=zoom)??views?.at(-1);
  const limit=v=>v.limits?.[views.indexOf(detail)]??v.sharpZoom;
  const landing=data.version>=2?views.filter(v=>v.zoom<=zoom&&limit(v)>=v.zoom*2-1e-8&&v.bytes<=5.5*1000000).at(-1):detail;
  const selected={...tier,...(landing??views?.[0])};
  return data.version>=2?{...selected,sharpZoom:limit(selected),rasterDetail:detail.rasterDetail,detail:detail.detail,detailBytes:detail.detailBytes,detailSharpZoom:detail.detailSharpZoom}:selected;
}
export function duckyPrefetch(islandId) {
  if (pending.has(islandId)) return pending.get(islandId);
  const job = (async () => {
    index ??= json('/art-prerender/islands.json').then(p => json(p.url)).catch(error => {index=undefined;throw error;});
    const data=await index;
    const tier = selectIslandTier(data,islandId);
    if (!tier) throw Error(`Unknown island ${islandId}`);
    entry ??= new Promise((resolve,reject) => {
      const link = document.createElement('link');link.rel='modulepreload';link.href=data.entry;
      link.onload=resolve;link.onerror=()=>{entry=undefined;link.remove();reject(Error('JS preload'));};
      document.head.appendChild(link);
    });
    await Promise.all([entry,...[...new Set([...tier.webp,...tier.ground??[]])].map(async url => {
      const response = await fetch(url, {priority:'low'});
      if (!response.ok) throw Error(response.status);
      await response.arrayBuffer();
    })]);
  })().catch(error => {pending.delete(islandId);throw error;});
  pending.set(islandId, job);
  return job;
}
