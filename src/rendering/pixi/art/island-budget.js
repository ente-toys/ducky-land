import sizes from '../../shared/art-source-sizes.json' with {type:'json'};
import {textureFootprint} from './texture-footprint.js';

// Rebalance the 350 MiB total: 250 MiB of fixed island pictures, 100 MiB
// for Duckies, the boat atlas, globe previews, water and effects.
export const SHARED_TEXTURE_ALLOWANCE = 100 * 1048576;
export const ISLAND_ART_BUDGET = 250 * 1048576;
export const GROUND_DENSITY = .75;
export const PROP_DENSITY = .9;
export const MIN_PROP_DENSITY = .5;
export const MIN_GROUND_DENSITY = .35;
let warnedOverBudget=false;
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
  const resolutions=(groundDensity,propScale=0,propDensity=PROP_DENSITY)=>new Map([...sources].map(([src,v])=>[src,!v.ground?v.needed*propDensity+(v.desired-v.needed*propDensity)*propScale:v.needed*groundDensity]));
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
  // Reserve the live ground floor before fitting props. Both densities are
  // uniform across the island, including sources shared by multiple pieces.
  const propFit=fit(f=>resolutions(MIN_GROUND_DENSITY,0,MIN_PROP_DENSITY+(PROP_DENSITY-MIN_PROP_DENSITY)*f));
  const propDensity=MIN_PROP_DENSITY+(PROP_DENSITY-MIN_PROP_DENSITY)*propFit;
  const groundFit=fit(f=>resolutions(MIN_GROUND_DENSITY+(GROUND_DENSITY-MIN_GROUND_DENSITY)*f,0,propDensity));
  const groundDensity=MIN_GROUND_DENSITY+(GROUND_DENSITY-MIN_GROUND_DENSITY)*groundFit;
  const groundScale=groundDensity/GROUND_DENSITY;
  const artScale=groundFit===1?fit(f=>resolutions(groundDensity,f,propDensity)):0;
  const fixed=resolutions(groundDensity,artScale,propDensity),total=bytes(fixed);
  const overBudget=total>budget;
  if(overBudget&&!warnedOverBudget){
    warnedOverBudget=true;
    console.warn('Island art exceeds texture allowance at minimum densities; keeping the island visible');
  }
  return {resolutions:fixed,bytes:total,budget,overBudget,propDensity,artScale,groundScale,groundDensity,defaultZoom,dpr};
}

export const activeIslandTiers=new WeakMap();
export const plannedSheetTiers=new WeakMap();
export const pinnedSheetTiers=new WeakMap();

// Atlas memory is charged once per sheet, including gutters and unused space.
// Choose one tier for the entire group before any of its frames are acquired.
export function planIslandSheets(plan, manifest) {
  const active=activeIslandTiers.get(manifest);
  if(active){
    const resolutions=new Map(plan.resolutions);
    for(const [src,t]of active)if(resolutions.has(src))resolutions.set(src,t.scale);
    return {...plan,resolutions};
  }
  const pinned=pinnedSheetTiers.get(manifest);
  if(pinned&&[...plan.resolutions.keys()].every(src=>!manifest[src]?.tiers?.length||(pinned.get(src)?.scale??0)>=plan.resolutions.get(src)-1e-10)){
    const resolutions=new Map(plan.resolutions),selected=plannedSheetTiers.get(manifest)??new Map(),sheets=new Map();
    for(const [src,t]of pinned)if(resolutions.has(src)){resolutions.set(src,t.scale);selected.set(src,t);sheets.set(t.sheet??t.url,(t.sheetWidth??t.width)*(t.sheetHeight??t.height)*4*(t.group.includes('/ground/')?1:4/3));}
    plannedSheetTiers.set(manifest,selected);
    const bytes=[...sheets.values()].reduce((a,b)=>a+b,0);
    return {...plan,resolutions,bytes,sheetCount:sheets.size,overBudget:bytes>plan.budget};
  }
  const groups=new Map(),selected=plannedSheetTiers.get(manifest)??new Map();let fallbackBytes=0;
  for(const [src,resolution] of plan.resolutions){
    const entry=manifest[src],tiers=entry?.tiers?.some(t=>t.sheet)?entry.tiers:null;
    if(!tiers?.length||!tiers.some(t=>t.scale>=resolution-1e-10)){
      selected.delete(src);pinned?.delete(src);
      const f=textureFootprint(src,resolution,entry?.padding??0);
      fallbackBytes+=f.width*f.height*4*(entry?.padding?1:4/3);continue;
    }
    const key=tiers[0].group.replace(/\/\d+$/,'');
    const group=groups.get(key)??{entries:[],index:0};groups.set(key,group);
    group.entries.push({src,tiers});
    const i=tiers.findIndex(t=>t.scale>=resolution-1e-10);
    group.index=Math.max(group.index,i<0?tiers.length-1:i);
  }
  if(!groups.size){plannedSheetTiers.set(manifest,selected);return plan;}
  const tierFor=(group,tiers)=>tiers[Math.min(group.index,tiers.length-1)];
  const cost=()=>{
    const sheets=new Map();
    for(const group of groups.values())for(const {tiers}of group.entries){const t=tierFor(group,tiers);
      sheets.set(t.sheet??t.url,(t.sheetWidth??t.width)*(t.sheetHeight??t.height)*4*(t.group.includes('/ground/')?1:4/3));}
    return {bytes:[...sheets.values()].reduce((a,b)=>a+b,fallbackBytes),sheetCount:sheets.size};
  };
  const total=cost();
  // A memory or request-count target must never choose softer art than the
  // whole-picture renderer. Report excess memory without reducing density.
  const resolutions=new Map(plan.resolutions);
  for(const group of groups.values())for(const {src,tiers}of group.entries){const t=tierFor(group,tiers);resolutions.set(src,t.scale);selected.set(src,t);}
  plannedSheetTiers.set(manifest,selected);
  return {...plan,resolutions,...total,overBudget:total.bytes>plan.budget};
}
