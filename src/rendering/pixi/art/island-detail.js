import {loadedSVGTextures,wholeSVGLoader} from './whole-svg-loader.js';
import {uploadIsland,preparationFrame,mapArtInFrames} from './island-preparation.js';
import {sliceCentreTexture} from '../environment/centre-motion.js';

export function detailZoomLimit(state,normal=1.8) {
  if(!state)return normal;
  return Math.min(normal,(state.live?normal:state.lease.tier.sharpZoom)??normal);
}

// Existing sprites and leases keep their Texture identity. Construct all new
// frames privately, upload sources within a bounded frame budget, then change every frame in a
// single animation callback. Nothing visible changes during preparation.
export async function swapIslandDetail(lease,renderer,{cancelled=()=>false,
  textures=loadedSVGTextures,loader=wholeSVGLoader,frame=preparationFrame,signal,
  beforeSwap=()=>{},afterSwap=()=>{},upload=uploadIsland}={}) {
  if(lease.tier?.rasterDetail?.overBudget)return false;
  const release=await lease.prepareDetail({signal}),changes=[];
  try{
    if(cancelled())return false;
    const originals=[...textures].filter(t=>!t.destroyed&&t.artKey&&lease.landing.has(t.artKey)&&(!lease.tier?.rasterDetail||lease.detail.has(t.artKey)));
    await mapArtInFrames(originals,async original=>{
      const tier=lease.detail.get(original.artKey);
      if(!tier||!lease.tier?.rasterDetail&&tier.scale<original.artTier.scale)throw Error(`Detail density regressed: ${original.artKey}`);
      if(tier.sheet===original.artTier.sheet&&tier.scale===original.artTier.scale)return;
      const next=await loader.load(original.artKey,{data:{resolution:tier.scale,priority:'low',signal,groundPadding:original.artGroundPadding,
        prerenderSource:original.artKey,prerenderTier:{...lease.manifest[original.artKey],...tier}}});
      if(cancelled()){loader.unload(next);return;}
      if(!next.artTier||next.artTier.scale<tier.scale) {loader.unload(next);throw Error(`Detail sheet unavailable: ${original.artKey}`);}
      changes.push({original,next});
    },{yieldFrame:frame,frameBudgetMs:8,batchSize:128,cancelled});
    await upload(renderer,[],{sources:changes.map(c=>c.next.source),batchSize:32,batchBytes:8*1048576,frameBudgetMs:4,yieldFrame:frame,cancelled});
    await frame();
    if(cancelled()||changes.some(c=>c.original.destroyed))return false;
    beforeSwap();
    for(const {original,next}of changes){
      for(const view of original.artViews??[]){
        if(view.texture.destroyed)continue;
        const replacement=sliceCentreTexture(next,view.y,view.height);
        copyFrame(view.texture,replacement);replacement.destroy(false);
      }
      copyFrame(original,next);
      original.artTier=next.artTier;
      original.releaseAtlas?.();
      original.atlasFrame=true;
      original.once('destroy',()=>loader.unload(next));
    }
    lease.activate();afterSwap();return true;
  }finally{
    // Successful replacements are owned by the original texture until island
    // release. A cancelled or failed job owns and disposes its private frames.
    for(const {original,next}of changes)if(original.source!==next.source&&!next.destroyed)loader.unload(next);
    release();
  }
}
function copyFrame(target,source){
  target.source=source.source;
  target.groundPadding=source.groundPadding;
  target.frame=source.frame.clone();target.orig=source.orig.clone();target.trim=source.trim?.clone();
  target.updateUvs();target.emit('update',target);
}
