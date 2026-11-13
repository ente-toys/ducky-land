import sizes from '../../shared/art-source-sizes.json' with {type:'json'};
import {textureFootprint} from './texture-footprint.js';

// Rebalance the 350 MiB total: 250 MiB of fixed island pictures, 100 MiB
// for Duckies, the boat atlas, globe previews, water and effects.
export const SHARED_TEXTURE_ALLOWANCE = 100 * 1048576;
export const ISLAND_ART_BUDGET = 250 * 1048576;
export const GROUND_DENSITY = .75;
export const PROP_DENSITY = .9;
export function planIslandArt(entries, {dpr=2, defaultZoom=.65, maxZoom=1.8, budget=ISLAND_ART_BUDGET, sourceSizes=sizes}={}) {
  const sources=new Map();
  for(const entry of entries) {
    const size=sourceSizes[entry.src]??[entry.width??64,entry.height??64];
    const ground=entry.ground===true||entry.mipmaps===false,scale=entry.scale??1;
    const ratio=entry.width&&entry.height?Math.max((entry.width+(ground?entry.bleed??0:0))/size[0],(entry.height+(ground?entry.bleed??0:0))/size[1])*scale:null;
    const needed=ratio?ratio*defaultZoom*dpr:entry.rasterResolution??entry.resolution??2;
    const desired=ratio?Math.max(needed*PROP_DENSITY,Math.min(entry.rasterResolution??entry.resolution??2,ratio*maxZoom*dpr)):needed;
    const held=sources.get(entry.src);
    sources.set(entry.src,{needed:Math.max(held?.needed??0,needed),desired:Math.max(held?.desired??0,desired),ground:(held?.ground??true)&&ground,mipmaps:(held?.mipmaps??false)||entry.mipmaps!==false});
  }
  const resolutions=(groundDensity,propScale=0)=>new Map([...sources].map(([src,v])=>[src,!v.ground?v.needed*PROP_DENSITY+(v.desired-v.needed*PROP_DENSITY)*propScale:v.needed*groundDensity]));
  const bytes=rs=>[...sources].reduce((sum,[src,v])=>{
    const f=textureFootprint(src,rs.get(src),v.mipmaps?0:2,sourceSizes);
    return sum+f.width*f.height*4*(v.mipmaps?4/3:1);
  },0);
  const fit=make=>{
    if(bytes(make(1))<=budget)return 1;
    let lo=0,hi=1;
    for(let i=0;i<48;i++){const mid=(lo+hi)/2;if(bytes(make(mid))<=budget)lo=mid;else hi=mid;}
    return lo;
  };
  if(bytes(resolutions(0))>budget)throw Error('Island props exceed texture allowance at 0.9 density');
  const groundScale=fit(f=>resolutions(GROUND_DENSITY*f));
  const groundDensity=GROUND_DENSITY*groundScale;
  const artScale=groundScale===1?fit(f=>resolutions(groundDensity,f)):0;
  const fixed=resolutions(groundDensity,artScale);
  return {resolutions:fixed,bytes:bytes(fixed),budget,artScale,groundScale,groundDensity,defaultZoom,dpr};
}
