import sourceSizes from '../../shared/art-source-sizes.json' with {type:'json'};
import {Sprite, Texture} from 'pixi.js';

export const GROUND_BUDGET_BYTES = 128 * 1048576;
// Extruded texels cover both sides of a join. Keep the inner image at its
// authored coordinates; stretching the whole piece would shift paths/ink.
export function groundSpriteBounds(tile, texture) {
  const width=tile.width+(tile.bleed??0),height=tile.height+(tile.bleed??0);
  const padding=texture.groundPadding;
  const dx=padding?padding.pad*width/padding.width:0,dy=padding?padding.pad*height/padding.height:0;
  return {x:(tile.localX??tile.x)+(tile.flip?tile.width+dx:-dx),y:(tile.localY??tile.y)-dy,width:width+2*dx,height:height+2*dy};
}
function fitGroundSprite(tile,texture){
  const b=groundSpriteBounds(tile,texture);
  tile.sprite.position.set(b.x,b.y);tile.sprite.width=b.width;tile.sprite.height=b.height;
  if(tile.flip)tile.sprite.scale.x=-Math.abs(tile.sprite.scale.x);
}
export function tileInView(tile, camera, width, height, tilt = 1, margin = 192) {
  margin=tile.margin??margin;
  const hw=width/(2*camera.zoom)+(typeof margin==='number'?margin:margin.x), hh=height/(2*camera.zoom*tilt)+(typeof margin==='number'?margin:margin.y);
  return tile.x < camera.x+hw && tile.x+tile.width > camera.x-hw &&
    tile.y < camera.y+hh && tile.y+tile.height > camera.y-hh;
}
export function tileResolution(tile, zoom, dpr = 1) {
  if(tile.screenResolution)return Math.min(tile.resolution??4,Math.ceil(zoom*dpr*(tile.rasterDensity??1)*16)/16);
  const size=sourceSizes[tile.src]??[tile.width??1,tile.height??1];
  const ratio=Math.max((tile.width??size[0])/size[0],(tile.height??size[1])/size[1]);
  return Math.min(tile.resolution ?? 1, ratio*Math.max(.0625, 2 ** Math.ceil(Math.log2(zoom*dpr))));
}
export function createGroundPool({acquire, release, budget = GROUND_BUDGET_BYTES, concurrency = 64, utilization = .9,
  makeSprite = () => new Sprite(Texture.EMPTY),
  schedule = globalThis.requestAnimationFrame?.bind(globalThis), now = () => performance.now(),
  settleMs = schedule ? 100 : 0, planInterval = schedule ? 32 : 0,
  frameBudgetMs = 5, progressive = !!schedule, prefetch = !!schedule} = {}) {
  const pinned=new Map();
  const streams=new Set(), resident=new Map(), pending=new Map(), cache=new Map();
  let desired=new Map(), disposed=false, reserved=0, peak=0, failures=new Map(), deferred=new Set();
  let scheduled=false,lastPlan=-Infinity,lastSignature='',plans=0,started=0,streamId=0,zooming=false;
  const zooms=new Map(),allocations=new Map();
  const retain=need=>{
    let sources=allocations.get(need.acquire);
    if(!sources)allocations.set(need.acquire,sources=new Map());
    let allocation=sources.get(need.src);
    if(!allocation){
      allocation={refs:0,bytes:need.bytes,src:need.src,release:need.release,sources};
      sources.set(need.src,allocation);reserved+=need.bytes;peak=Math.max(peak,reserved);started++;
      allocation.promise=need.acquire(need.src,need.resolution,{visible:need.visible,priority:need.priority??0,distance:need.distance});
    }
    allocation.refs++;need.allocation=allocation;return allocation.promise;
  };
  const extraBytes=need=>allocations.get(need.acquire)?.has(need.src)?0:need.bytes;
  const requestPump=()=>{if(!schedule){pump();return;}if(scheduled||disposed)return;scheduled=true;schedule(()=>{scheduled=false;pump();});};
  const blank=tile => {tile.sprite.texture=Texture.EMPTY;tile.sprite.visible=false;};
  const discard=entry=>{
    const a=entry.allocation;if(--a.refs)return;
    reserved-=a.bytes;a.sources.delete(a.src);a.release(a.src);
  };
  const remember=(tile,entry)=>{
    if(!progressive){discard(entry);return;}
    let versions=cache.get(tile);if(!versions)cache.set(tile,versions=new Map());
    if(versions.has(entry.src))discard(versions.get(entry.src));
    versions.set(entry.src,entry);
  };
  const show=(tile,entry)=>{
    resident.set(tile,entry);tile.sprite.texture=entry.texture;
    fitGroundSprite(tile,entry.texture);tile.sprite.visible=tile.render!==false;
  };
  const drop=tile => {
    const entry=resident.get(tile);if (!entry)return;
    blank(tile);resident.delete(tile);remember(tile,entry);
  };
  const pump=() => {
    if(disposed)return;
    const jobs=[...desired].filter(([tile,target])=>!zooming||target.visible&&!resident.has(tile)).sort(([a,an],[b,bn])=>
      (an.visible?0:2)-(bn.visible?0:2)||
      Number(resident.has(a))-Number(resident.has(b))||
      (b.priority??0)-(a.priority??0)||an.distance-bn.distance);
    const began=now();
    let submitted=0;
    for(const [tile,target] of jobs) {
      if(pending.size>=concurrency||(schedule&&(now()-began>=frameBudgetMs||zooming&&submitted>=2)))break;
      const held=resident.get(tile);
      if(held?.resolution>=target.resolution||pending.has(tile)||deferred.has(tile))continue;
      const versions=cache.get(tile);
      const cached=versions&&[...versions.values()].find(e=>e.resolution>=target.resolution);
      if(cached){versions.delete(cached.src);if(!versions.size)cache.delete(tile);if(held)remember(tile,held);show(tile,cached);continue;}
      const resolution=progressive&&!held&&!tile.fullResolutionFirst?Math.min(.5,target.resolution):target.resolution;
      const need={...target,resolution,src:tile.src+(tile.src.includes('?')?'&':'?')+'groundScale='+resolution,
        bytes:Math.ceil(target.pixelWidth*resolution)*Math.ceil(target.pixelHeight*resolution)*4};
      if(failures.has(need.src))continue;
      for(const [t,entries] of cache){
        for(const [src,entry] of entries){if(reserved+extraBytes(need)<=budget)break;discard(entry);entries.delete(src);}
        if(!entries.size)cache.delete(t);
      }
      for(const [t] of resident) {if(reserved+extraBytes(need)<=budget)break;if(!desired.get(t)?.visible&&target.visible)drop(t);}
      for(const [t,entries] of cache){
        for(const [src,entry] of entries){if(reserved+extraBytes(need)<=budget)break;discard(entry);entries.delete(src);}
        if(!entries.size)cache.delete(t);
      }
      if(reserved+extraBytes(need)>budget){deferred.add(tile);continue;}
      submitted++;pending.set(tile,need);
      retain(need).then(texture=>{
        if(disposed||!desired.has(tile)) {discard(need);return;}
        const bytes=(texture.source.pixelWidth??tile.width*need.resolution)*(texture.source.pixelHeight??tile.height*need.resolution)*4;
        const stale=resident.get(tile);
        if(stale?.resolution>=need.resolution||reserved-need.allocation.bytes+bytes>budget){discard(need);deferred.add(tile);return;}
        reserved+=bytes-need.allocation.bytes;need.allocation.bytes=bytes;peak=Math.max(peak,reserved);
        if(stale){resident.delete(tile);remember(tile,stale);}
        show(tile,{...need,bytes,texture});
      }).catch(error=>{discard(need);failures.set(need.src,String(error));})
        .finally(()=>{pending.delete(tile);deferred.clear();requestPump();});
    }
    if(!pending.size&&jobs.some(([tile,n])=>!deferred.has(tile)&&!failures.has(n.src)&&(!resident.has(tile)||resident.get(tile).resolution<n.resolution)))requestPump();
  };
  return {
    create(tiles,container,url=src=>src,loader={acquire,release}) {
      const entries=tiles.map(t=>{const tile={...t,src:url(t.src),sprite:makeSprite(),acquire:loader.acquire,release:loader.release};
        tile.sprite.position.set((t.localX??t.x)+(t.flip?t.width:0),t.localY??t.y);if(t.flip)tile.sprite.scale.x=-1;blank(tile);container.addChild(tile.sprite);return tile;});
      let dead=false;
      const resolutionTiles=[...new Map(entries.map(t=>[[t.screenResolution,t.rasterDensity,t.resolution,t.screenResolution?0:tileResolution(t,1)].join('|'),t])).values()];
      const stream={id:++streamId,entries,resolutionTiles,
        async prepare({zoom=1.8,dpr=2,resolutions=new Map()}={}) {
          if(stream.preparing)return stream.preparing;
          stream.pinned=true;
          const leases=new Map();pinned.set(stream,leases);
          const fixed=new Map(resolutions);
          for(const tile of entries)if(!resolutions.has(tile.src))fixed.set(tile.src,Math.max(fixed.get(tile.src)??0,tileResolution(tile,zoom,dpr)));
          stream.preparing=(async()=>{
            const results=await Promise.allSettled([...new Set(entries.map(t=>t.src))].map(async src=>{
              const tile=entries.find(t=>t.src===src),resolution=fixed.get(src);
              const lease={src,release:tile.release};leases.set(src,lease);
              lease.texture=await tile.acquire(src,resolution,{priority:-1});
              if(dead){if(!lease.released)tile.release(src);leases.delete(src);return;}
              for(const entry of entries)if(entry.src===src){
                entry.sprite.texture=lease.texture;fitGroundSprite(entry,lease.texture);entry.sprite.visible=entry.render!==false;
              }
            }));
            const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;
          })();
          return stream.preparing;
        },
        destroy(){if(dead)return;dead=true;for(const lease of pinned.get(stream)?.values()??[]){lease.released=true;lease.release(lease.src);}pinned.delete(stream);streams.delete(stream);lastSignature='';zooms.delete(stream);for(const tile of entries){desired.delete(tile);drop(tile);for(const entry of cache.get(tile)?.values()??[])discard(entry);cache.delete(tile);tile.sprite.destroy();}}};
      streams.add(stream);return stream;
    },
    update(views,dpr=1,fastZoom=false) {
      const pinnedViews=views.filter(v=>streams.has(v.stream)&&v.stream.pinned);
      for(const stream of streams)if(stream.pinned){
        const cameras=pinnedViews.filter(v=>v.stream===stream);
        for(const tile of stream.entries)tile.sprite.visible=tile.render!==false&&cameras.some(v=>tileInView(tile,v.camera,v.width,v.height,v.tilt??1,tile.viewMargin??192));
      }
      zooming=fastZoom;
      const time=now();
      const active=views.filter(v=>streams.has(v.stream)&&!v.stream.pinned);
      let waiting=false,settled=false;
      const planned=active.map(v=>{
        let z=zooms.get(v.stream);
        if(!z){z={value:v.camera.zoom,input:v.camera.zoom,at:time};zooms.set(v.stream,z);}
        const step=v.stream.resolutionTiles.map(t=>tileResolution(t,v.camera.zoom,dpr)).join(',');
        if(z.step!==step){if(z.step!==undefined)z.at=time;z.step=step;z.input=v.camera.zoom;}
        if(time-z.at>=settleMs){settled ||= z.value!==z.input;z.value=z.input;}
        else if(z.value!==z.input)waiting=true;
        return {...v,camera:{...v.camera,zoom:z.value},cullCamera:v.camera};
      });
      const signature=JSON.stringify(active.map(v=>v.stream.id).concat(active.map(v=>[v.camera.x,v.camera.y,v.camera.zoom,v.width,v.height,v.tilt,dpr]),planned.map(v=>v.camera.zoom)));
      if(active.length&&((signature===lastSignature&&!waiting&&!settled)||(!settled&&time-lastPlan<planInterval))){requestPump();return;}
      lastSignature=signature;lastPlan=time;plans++;
      let next, step=1, ringStep=1;
      do {
        next=new Map();let total=0;const plannedSources=new Map();
        for(const {stream,camera,cullCamera,width,height,tilt=1} of planned) {
          for(const tile of stream.entries) if(tile.preload||tileInView(tile,cullCamera,width,height,tilt,tile.prefetchMargin??(prefetch?{x:width/cullCamera.zoom,y:height/(cullCamera.zoom*tilt)}:(tile.viewMargin??192)))) {
            const visible=!tile.preload&&tileInView(tile,cullCamera,width,height,tilt,tile.viewMargin??192);
            const resolution=Math.max(.0625,visible?tileResolution(tile,camera.zoom,dpr)/step:Math.min(.5,tileResolution(tile,camera.zoom,dpr))/ringStep);
            const src=tile.src+(tile.src.includes('?')?'&':'?')+'groundScale='+resolution;
            const size=tile.pixelWidth?[tile.pixelWidth,tile.pixelHeight]:(sourceSizes[tile.src]??[tile.width,tile.height]);
            const bytes=Math.ceil(size[0]*resolution)*Math.ceil(size[1]*resolution)*4;
            next.set(tile,{src,resolution,bytes,visible,pixelWidth:size[0],pixelHeight:size[1],distance:Math.hypot(tile.x+tile.width/2-cullCamera.x,tile.y+tile.height/2-cullCamera.y),acquire:tile.acquire,release:tile.release,priority:tile.priority});
            let sources=plannedSources.get(tile.acquire);if(!sources)plannedSources.set(tile.acquire,sources=new Map());
            if(!sources.has(src)){sources.set(src,true);total+=bytes;}
          }
        }
        if(total<=budget*utilization||step>=16)break;
        if(prefetch&&ringStep<8)ringStep*=2;else step*=2;
      } while(true);
      desired=new Map([...next].sort(([a,an],[b,bn])=>(b.priority??0)-(a.priority??0)||an.distance-bn.distance));deferred.clear();
      for(const tile of [...resident.keys()]) if(!desired.has(tile))drop(tile);
      requestPump();
    },
    stats(){const fixedSources=new Set([...pinned.values()].flatMap(leases=>[...leases.values()].map(l=>l.texture?.source).filter(Boolean)));
      const fixedBytes=[...fixedSources].reduce((n,s)=>n+s.pixelWidth*s.pixelHeight*4,0);
      peak=Math.max(peak,reserved+fixedBytes);
      return {budgetBytes:budget,reservedBytes:reserved+fixedBytes,peakBytes:peak,pinnedBytes:fixedBytes,residentTiles:resident.size+[...streams].filter(s=>s.pinned).reduce((n,s)=>n+s.entries.filter(t=>t.sprite.texture!==Texture.EMPTY).length,0),cachedTiles:cache.size,refiningTiles:[...desired].filter(([t,n])=>n.visible&&(resident.get(t)?.resolution??0)<n.resolution).length,pendingTiles:pending.size,streams:streams.size,failedTiles:failures.size,failures:[...failures].slice(0,8),desiredTiles:desired.size,missingTiles:[...desired.keys()].filter(t=>!resident.has(t)).length,plans,started,sharedSources:[...allocations.values()].reduce((n,s)=>n+s.size,0)};},
    destroy(){disposed=true;desired.clear();for(const stream of [...streams])stream.destroy();},
  };
}
