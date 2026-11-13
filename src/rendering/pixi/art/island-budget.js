import sizes from '../../shared/art-source-sizes.json' with {type:'json'};

// Leave room for Duckies, water, effects and the boat atlas under 340 MiB.
export const ISLAND_ART_BUDGET = 220 * 1048576;
export function planIslandArt(entries, {dpr=2, maxZoom=1.8, budget=ISLAND_ART_BUDGET, sourceSizes=sizes}={}) {
  const sources=new Map();
  for(const entry of entries) {
    const size=sourceSizes[entry.src]??[entry.width??64,entry.height??64];
    const scale=entry.scale??1;
    const needed=entry.width&&entry.height?Math.max(entry.width/size[0],entry.height/size[1])*scale*maxZoom*dpr:entry.resolution??1;
    const resolution=Math.min(entry.rasterResolution??entry.resolution??2,needed);
    const held=sources.get(entry.src);
    sources.set(entry.src,{size,resolution:Math.max(held?.resolution??0,resolution),mipmaps:(held?.mipmaps??false)||entry.mipmaps!==false});
  }
  const bytes=(factor,ground)=>[...sources.values()].filter(v=>ground===undefined||!v.mipmaps===ground).reduce((sum,{size,resolution,mipmaps})=>sum+(Math.ceil(size[0]*resolution*factor)+(mipmaps?0:4))*(Math.ceil(size[1]*resolution*factor)+(mipmaps?0:4))*4*(mipmaps?4/3:1),0);
  const fit=(ground,allowance)=>{
    if(bytes(1,ground)<=allowance)return 1;
    let lo=0,hi=1;
    for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(bytes(mid,ground)<=allowance)lo=mid;else hi=mid;}
    return lo;
  };
  // Keep fine ink on buildings and vegetation sharp before spending on the
  // much larger, mostly flat ground surfaces. Both choices stay fixed on zoom.
  const artScale=fit(false,Math.max(budget*.7,budget-Math.min(bytes(1,true),96*1048576)));
  const groundScale=fit(true,budget-bytes(artScale,false));
  return {resolutions:new Map([...sources].map(([src,v])=>[src,v.resolution*(v.mipmaps?artScale:groundScale)])),
    bytes:bytes(artScale,false)+bytes(groundScale,true),budget,artScale,groundScale};
}
