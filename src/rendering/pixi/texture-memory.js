import {TexturePool} from 'pixi.js';

export function textureSourceBytes(source) {
  if (!source || source.destroyed) return 0;
  let width=Math.ceil(source.pixelWidth),height=Math.ceil(source.pixelHeight),bytes=0;
  const levels=source.autoGenerateMipmaps?Math.floor(Math.log2(Math.max(width,height)))+1:(source.mipLevelCount??1);
  for(let level=0;level<levels;level++) {
    bytes+=Math.max(1,width)*Math.max(1,height)*4;
    width=Math.floor(width/2);height=Math.floor(height/2);
  }
  return bytes;
}

// Explicit QA readback counts the renderer's real, unique managed sources.
export function managedTextureMemory(renderer) {
  const textures=renderer?.texture?._managedTextures?.items??renderer?.texture?.managedTextures??[];
  const seen=new Set();let bytes=0,count=0,largestBytes=0;
  for(const source of Object.values(textures)){
    if(!source||source.destroyed||seen.has(source))continue;
    seen.add(source);count++;
    const total=textureSourceBytes(source);
    bytes+=total;largestBytes=Math.max(largestBytes,total);
  }
  return {count,bytes,MB:bytes/1e6,largestBytes};
}

// One ledger for every game tile/raster pool AND Pixi's cache/filter pool.
// Pending decodes reserve bytes; resolved allocations use actual source sizes.
export function createManagedPoolBudget(renderer) {
  const claims=new Set();let limit=0,externalBytes=0,outsideBytes=0,activePools=1,lastSweep=-Infinity;
  const used=()=>{let bytes=externalBytes;const seen=new Set();for(const c of claims){
    if(c.source){if(seen.has(c.source))continue;seen.add(c.source);bytes+=textureSourceBytes(c.source);}
    else bytes+=c.bytes;
  }return bytes;};
  const idle=()=>[...TexturePool._buckets.values()].flat();
  const gpuBytes=source=>{
    // Allocated CPU caches outside the view have no GPU residency yet.
    const items=renderer?.texture?._managedTextures?.items;
    return !renderer||items?.[source?.uid]===source?textureSourceBytes(source):0;
  };
  let retiredHidden=false;
  const activeSources=stage=>{
    const sources=new Set();
    const visible=root=>{for(let node=root;node;node=node.parent)if(!node.visible||!node.renderable||node.alpha<=0)return false;return true;};
    const visit=group=>{
      if(!group)return;
      if(group.texture){
        // Cached sleepers stay checked out of TexturePool even when their
        // whole rig is culled. Their sources disable Pixi's automatic GC.
        // Retire uploaded hidden caches, then let Pixi bake a fresh target
        // when the group next renders. Keep a second of grace for caches used
        // by a neighbouring-island pass after the primary render. CPU-only
        // targets need no reclamation.
        const source=group.texture.source;
        const idle=source._gcLastUsed<0||performance.now()-source._gcLastUsed>=1000;
        if(gpuBytes(source)&&idle&&!visible(group.root)){
          TexturePool.returnTexture(group.texture);group.texture=null;
          retiredHidden=true;
          group.textureNeedsUpdate=true;
          if(group.renderGroupParent)group.renderGroupParent.structureDidChange=true;
        }else sources.add(group.texture.source);
      }
      for(const child of group.renderGroupChildren??[])visit(child);
    };
    visit(stage?.renderGroup);return sources;
  };
  const trim=(stage,clear=false)=>{
    const active=activeSources(stage),textures=idle();
    let activeBytes=0,idleBytes=0;
    for(const source of active)activeBytes+=gpuBytes(source);
    for(const texture of textures)idleBytes+=gpuBytes(texture.source);
    externalBytes=activeBytes+idleBytes;
    // Public clear() destroys idle targets only, never a checked-out cache.
    if(clear || retiredHidden || idleBytes>limit/6 || used()>limit) {
      TexturePool.clear(true);externalBytes=activeBytes;
    }
    retiredHidden=false;
    // Newly visible Pixi caches may upload during render. Reclaim game tiles
    // now, rather than letting that overage survive until the next plan.
    if(used()>limit)for(const claim of [...claims].reverse()){
      if(used()<=limit)break;
      if(claim.source)claim.evict?.();
    }
  };
  return {
    get limit(){return limit;},
    get bytes(){return used();},
    get allowance(){let statics=0;for(const c of claims)if(c.kind==='static')statics+=c.source?textureSourceBytes(c.source):c.bytes;return Math.max(0,limit-externalBytes-statics)/activePools;},
    allowanceFor(owner){
      let own=0;const seen=new Set();
      for(const c of claims)if(c.owner===owner){
        if(c.source){if(seen.has(c.source))continue;seen.add(c.source);own+=textureSourceBytes(c.source);}
        else own+=c.bytes;
      }
      return Math.max(0,limit-used()+own);
    },
    configure(width,height,resolution,pools=1,stage,now=0,changed=false,visibleBytes=0){
      // Layered ground, paving and props can cover the viewport several times.
      // Keep their visible crops at device density within the total GPU target.
      let statics=0;for(const c of claims)if(c.kind==='static')statics+=c.source?textureSourceBytes(c.source):c.bytes;
      let managedClaims=externalBytes;const seen=new Set();
      for(const c of claims)if(c.source&&!seen.has(c.source)){seen.add(c.source);managedClaims+=gpuBytes(c.source);}
      outsideBytes=Math.max(0,managedTextureMemory(renderer).bytes-managedClaims);
      // Leave room for the actor kit, water and other non-pool textures. Grow
      // only when the current view needs it, with the overall GPU targets intact.
      const target=Math.max(0,(resolution<=1?150:250)*1e6-Math.max(32*1048576,outsideBytes));
      limit=Math.min(target,Math.max(Math.min(128*1048576,width*height*resolution*resolution*4*12),visibleBytes+statics+externalBytes));
      activePools=Math.max(1,pools);
      if(changed||now-lastSweep>=1000){trim(stage,changed);lastSweep=now;}
    },
    reserve(bytes,{kind='pool',owner}={}){if(used()+bytes>limit)return null;const claim={bytes,source:null,kind,owner};claims.add(claim);return claim;},
    commit(claim,source){claim.source=source;return used()<=limit;},
    release(claim){claims.delete(claim);},
    trim(stage,clear=false){trim(stage,clear);},
    stats(){return {bytes:used(),limit,externalBytes,outsideBytes,claims:claims.size};},
  };
}
