import sourceSizes from '../../shared/art-source-sizes.json' with {type:'json'};
import {Sprite, Texture} from 'pixi.js';
import {textureSourceBytes} from '../texture-memory.js';

export const GROUND_BUDGET_BYTES = 128 * 1048576;
export const VIEW_POOL_OPTIONS = {retainCache:false, prefetchPixels:192, screenBuffers:12, utilization:.995};
export function tileInView(tile, camera, width, height, tilt = 1, margin = 192) {
  margin=tile.margin??margin;
  const hw=width/(2*camera.zoom)+(typeof margin==='number'?margin:margin.x), hh=height/(2*camera.zoom*tilt)+(typeof margin==='number'?margin:margin.y);
  return tile.x < camera.x+hw && tile.x+tile.width > camera.x-hw &&
    tile.y < camera.y+hh && tile.y+tile.height > camera.y-hh;
}
export function tileResolution(tile, zoom, dpr = 1) {
  const ceiling=tile.screenLimited?zoom*dpr*1.5:Infinity;
  if(tile.screenResolution)return Math.min(ceiling,tile.resolution??4,Math.ceil(zoom*dpr*(tile.rasterDensity??1)*16)/16);
  const size=sourceSizes[tile.src]??[tile.width??1,tile.height??1];
  const ratio=Math.max((tile.width??size[0])/size[0],(tile.height??size[1])/size[1]);
  return Math.min(tile.resolution ?? 1,ratio*ceiling, ratio*Math.max(.0625, 2 ** Math.ceil(Math.log2(zoom*dpr))));
}
export function createGroundPool({acquire, release, budget = GROUND_BUDGET_BYTES, concurrency = 64, utilization = .9,
  makeSprite = () => new Sprite(Texture.EMPTY),
  schedule = globalThis.requestAnimationFrame?.bind(globalThis), now = () => performance.now(),
  settleMs = schedule ? 100 : 0, planInterval = schedule ? 32 : 0,
  frameBudgetMs = 5, progressive = !!schedule, prefetch = !!schedule,
  retainCache = true, prefetchPixels, screenBuffers = Infinity, poolBudget} = {}) {
  const streams=new Set(), resident=new Map(), pending=new Map(), cache=new Map();
  const owner={};
  let desired=new Map(), disposed=false, reserved=0, peak=0, failures=new Map(), deferred=new Set(), limit=budget;
  let scheduled=false,lastPlan=-Infinity,lastSignature='',plans=0,started=0,streamId=0,zooming=false;
  const zooms=new Map(),allocations=new Map();
  const lastViews=[];
  let lastDpr=0,nextSettle=Infinity,dirty=false,lastLimit=0;
  let demandSignature='',demandBytes=0;
  const inRange=(tile,view)=>!tile.preload&&tileInView(tile,view.camera,view.width,view.height,view.tilt,
    prefetchPixels!==undefined?{x:prefetchPixels/view.camera.zoom,y:prefetchPixels/(view.camera.zoom*(view.tilt??1))}:tile.prefetchMargin??(prefetch?{x:view.width/view.camera.zoom,y:view.height/(view.camera.zoom*(view.tilt??1))}:(tile.viewMargin??192)));
  const retain=need=>{
    let sources=allocations.get(need.acquire);
    if(!sources)allocations.set(need.acquire,sources=new Map());
    let allocation=sources.get(need.src);
    if(!allocation){
      allocation={refs:0,bytes:need.bytes,src:need.src,release:need.release,sources,claim:need.claim};
      if(allocation.claim)allocation.claim.evict=()=>{
        for(const [tile,entry] of resident)if(entry.allocation===allocation)drop(tile);
        for(const work of pending.values())if(work.allocation===allocation)work.cancelled=true;
        dirty=true;lastSignature='';
      };
      sources.set(need.src,allocation);reserved+=need.bytes;peak=Math.max(peak,reserved);started++;
      allocation.promise=need.acquire(need.src,need.resolution,{visible:need.visible,priority:need.priority??0,distance:need.distance,valid:()=>!disposed&&[...pending.values()].some(n=>n.allocation===allocation&&!n.cancelled)});
    }
    allocation.refs++;need.allocation=allocation;return allocation.promise;
  };
  const extraBytes=need=>allocations.get(need.acquire)?.has(need.src)?0:need.bytes;
  const requestPump=()=>{if(!schedule){pump();return;}if(scheduled||disposed)return;scheduled=true;schedule(()=>{scheduled=false;pump();});};
  const blank=tile => {tile.sprite.texture=Texture.EMPTY;tile.sprite.visible=false;};
  const discard=entry=>{
    const a=entry.allocation;if(--a.refs)return;
    reserved-=a.bytes;a.sources.delete(a.src);poolBudget?.release(a.claim);a.release(a.src);
  };
  const remember=(tile,entry)=>{
    if(!progressive||!retainCache){discard(entry);return;}
    let versions=cache.get(tile);if(!versions)cache.set(tile,versions=new Map());
    if(versions.has(entry.src))discard(versions.get(entry.src));
    versions.set(entry.src,entry);
  };
  const show=(tile,entry)=>{
    resident.set(tile,entry);tile.sprite.texture=entry.texture;
    tile.sprite.width=tile.width+(tile.bleed??0);tile.sprite.height=tile.height+(tile.bleed??0);tile.sprite.visible=tile.render!==false;
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
      if((held?.resolution>=target.resolution&&(retainCache||held.resolution===target.resolution))||pending.has(tile)||deferred.has(tile))continue;
      const versions=cache.get(tile);
      const cached=versions&&[...versions.values()].find(e=>e.resolution>=target.resolution);
      if(cached){versions.delete(cached.src);if(!versions.size)cache.delete(tile);if(held)remember(tile,held);show(tile,cached);continue;}
      const resolution=progressive&&!held&&!tile.fullResolutionFirst?Math.min(.5,target.resolution):target.resolution;
      const need={...target,resolution,requestedResolution:target.resolution,src:tile.src+(tile.src.includes('?')?'&':'?')+'groundScale='+resolution,
        bytes:Math.ceil(target.pixelWidth*resolution)*Math.ceil(target.pixelHeight*resolution)*4};
      // Old production densities have already been released by update().
      if(failures.has(need.src))continue;
      for(const [t,entries] of cache){
        for(const [src,entry] of entries){if(reserved+extraBytes(need)<=limit)break;discard(entry);entries.delete(src);}
        if(!entries.size)cache.delete(t);
      }
      for(const [t] of resident) {if(reserved+extraBytes(need)<=limit)break;if(!desired.get(t)?.visible&&target.visible)drop(t);}
      for(const [t,entries] of cache){
        for(const [src,entry] of entries){if(reserved+extraBytes(need)<=limit)break;discard(entry);entries.delete(src);}
        if(!entries.size)cache.delete(t);
      }
      if(reserved+extraBytes(need)>limit){deferred.add(tile);continue;}
      if(poolBudget&&extraBytes(need)){need.claim=poolBudget.reserve(need.bytes,{owner});if(!need.claim){deferred.add(tile);continue;}}
      submitted++;pending.set(tile,need);
      retain(need).then(texture=>{
        if(disposed||!desired.has(tile)||need.cancelled) {discard(need);return;}
        const bytes=textureSourceBytes(texture.source);
        if(poolBudget&&!poolBudget.commit(need.allocation.claim,texture.source)){discard(need);if(bytes>need.bytes)failures.set(need.src,'Actual source exceeds shared texture budget');deferred.add(tile);return;}
        const stale=resident.get(tile);
        if((stale?.resolution>=need.resolution&&(retainCache||stale.resolution===need.resolution))||reserved-need.allocation.bytes+bytes>limit){discard(need);if(bytes>need.bytes)failures.set(need.src,'Actual source exceeds pool budget');deferred.add(tile);return;}
        reserved+=bytes-need.allocation.bytes;need.allocation.bytes=bytes;peak=Math.max(peak,reserved);
        if(stale){resident.delete(tile);remember(tile,stale);}
        show(tile,{...need,bytes,texture});
      }).catch(error=>{discard(need);if(!need.cancelled&&!disposed)failures.set(need.src,String(error));})
        .finally(()=>{pending.delete(tile);deferred.clear();requestPump();});
    }
    if(!pending.size&&jobs.some(([tile,n])=>!deferred.has(tile)&&!failures.has(n.src)&&(!resident.has(tile)||resident.get(tile).resolution<n.resolution||!retainCache&&resident.get(tile).resolution!==n.resolution)))requestPump();
  };
  return {
    create(tiles,container,url=src=>src,loader={acquire,release}) {
      const entries=tiles.map(t=>{const tile={...t,screenLimited:!retainCache,src:url(t.src),sprite:makeSprite(),acquire:loader.acquire,release:loader.release};
        tile.sprite.position.set((t.localX??t.x)+(t.flip?t.width:0),t.localY??t.y);if(t.flip)tile.sprite.scale.x=-1;blank(tile);container.addChild(tile.sprite);return tile;});
      let dead=false;
      const resolutionTiles=[...new Map(entries.map(t=>[[t.screenResolution,t.rasterDensity,t.resolution,t.screenResolution?0:tileResolution(t,1)].join('|'),t])).values()];
      const stream={id:++streamId,entries,resolutionTiles,destroy(){if(dead)return;dead=true;streams.delete(stream);lastSignature='';zooms.delete(stream);for(const tile of entries){desired.delete(tile);drop(tile);for(const entry of cache.get(tile)?.values()??[])discard(entry);cache.delete(tile);tile.sprite.destroy();}}};
      streams.add(stream);return stream;
    },
    update(views,dpr=1,fastZoom=false) {
      const time=now(),modeChanged=zooming!==fastZoom;
      const allowance=poolBudget?.allowanceFor?.(owner)??poolBudget?.allowance??Infinity,limitChanged=allowance!==lastLimit;lastLimit=allowance;
      zooming=fastZoom;
      let unchanged=views.length===lastViews.length&&dpr===lastDpr&&!modeChanged&&!limitChanged&&time<nextSettle;
      if(unchanged)for(let i=0;i<views.length;i++){
        const v=views[i],p=lastViews[i],c=v.camera;
        if(v.stream!==p.stream||c.x!==p.x||c.y!==p.y||c.zoom!==p.zoom||v.width!==p.width||v.height!==p.height||v.tilt!==p.tilt){unchanged=false;break;}
      }
      if(unchanged&&lastSignature&&!dirty)return;
      lastViews.length=views.length;lastDpr=dpr;nextSettle=Infinity;
      for(let i=0;i<views.length;i++){
        const v=views[i],p=lastViews[i]??(lastViews[i]={});
        p.stream=v.stream;p.x=v.camera.x;p.y=v.camera.y;p.zoom=v.camera.zoom;p.width=v.width;p.height=v.height;p.tilt=v.tilt;
      }
      const active=views.filter(v=>streams.has(v.stream));
      limit=poolBudget?allowance:Math.min(budget,active.reduce((n,v)=>Math.max(n,v.width*v.height*dpr*dpr*4*screenBuffers),0)||budget);
      let waiting=false,settled=false;
      const planned=active.map(v=>{
        let z=zooms.get(v.stream);
        if(!z){z={value:v.camera.zoom,input:v.camera.zoom,at:time};zooms.set(v.stream,z);}
        const step=v.stream.resolutionTiles.map(t=>tileResolution(t,v.camera.zoom,dpr)).join(',');
        if(z.step!==step){if(z.step!==undefined)z.at=time;z.step=step;z.input=v.camera.zoom;}
        if(!zooming&&time-z.at>=settleMs){settled ||= z.value!==z.input;z.value=z.input;}
        else if(z.value!==z.input){waiting=true;nextSettle=Math.min(nextSettle,z.at+settleMs);}
        return {...v,camera:{...v.camera,zoom:z.value},cullCamera:v.camera};
      });
      const signature=JSON.stringify(active.map(v=>v.stream.id).concat(active.map(v=>[v.camera.x,v.camera.y,v.camera.zoom,v.width,v.height,v.tilt,dpr]),planned.map(v=>v.camera.zoom)));
      if(active.length&&!settled&&time-lastPlan<planInterval&&!modeChanged){dirty=true;return;}
      if(active.length&&signature===lastSignature&&!waiting&&!settled&&!modeChanged&&!limitChanged&&!dirty)return;
      lastSignature=signature;lastPlan=time;plans++;dirty=false;
      let next, step=1, ringStep=1;
      do {
        next=new Map();let total=0;const plannedSources=new Map();
        for(const {stream,camera,cullCamera,width,height,tilt=1} of planned) {
          for(const tile of stream.entries) if((tile.preload&&retainCache)||(!tile.preload&&tileInView(tile,cullCamera,width,height,tilt,prefetchPixels!==undefined?{x:prefetchPixels/cullCamera.zoom,y:prefetchPixels/(cullCamera.zoom*tilt)}:tile.prefetchMargin??(prefetch?{x:width/cullCamera.zoom,y:height/(cullCamera.zoom*tilt)}:(tile.viewMargin??192))))) {
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
        if(total<=limit*utilization||step>=16)break;
        if(prefetch&&ringStep<8)ringStep*=2;else step*=2;
      } while(true);
      desired=new Map([...next].sort(([a,an],[b,bn])=>(b.priority??0)-(a.priority??0)||an.distance-bn.distance));deferred.clear();
      // Keep current textures scaled throughout active zoom. Once settled,
      // retire obsolete densities before admitting their replacements, so
      // uploaded sources and pending reservations obey the same hard cap.
      for(const [tile,need] of pending)if(!desired.has(tile)||!retainCache&&desired.get(tile).resolution!==need.requestedResolution)need.cancelled=true;
      for(const [tile,entry] of resident)if(!desired.has(tile)||!zooming&&!retainCache&&desired.get(tile).resolution!==entry.resolution)drop(tile);
      requestPump();
    },
    get pending(){return pending.size;},
    // Run for every pool before any pool allocates. Reclaim the old view first,
    // then size the shared ledger from unique full-density visible sources and
    // the low-density prefetch ring, rather than dividing a fixed 128 MiB cap.
    prepare(views,dpr=1){
      const active=views.filter(v=>streams.has(v.stream));
      const signature=JSON.stringify(active.map(v=>[v.stream.id,v.camera.x,v.camera.y,v.camera.zoom,v.width,v.height,v.tilt,dpr]));
      if(signature===demandSignature)return Math.ceil(demandBytes/utilization);
      demandSignature=signature;
      const keep=new Set(),sources=new Map();demandBytes=0;
      for(const view of active)for(const tile of view.stream.entries){
        if(!(tile.preload&&retainCache)&&!inRange(tile,view))continue;
        keep.add(tile);
        const visible=!tile.preload&&tileInView(tile,view.camera,view.width,view.height,view.tilt,tile.viewMargin??192);
        const resolution=visible?tileResolution(tile,view.camera.zoom,dpr):Math.min(.5,tileResolution(tile,view.camera.zoom,dpr));
        const key=tile.src+'|'+resolution,size=tile.pixelWidth?[tile.pixelWidth,tile.pixelHeight]:(sourceSizes[tile.src]??[tile.width,tile.height]);
        let loader=sources.get(tile.acquire);if(!loader)sources.set(tile.acquire,loader=new Set());
        if(!loader.has(key)){loader.add(key);demandBytes+=Math.ceil(size[0]*resolution)*Math.ceil(size[1]*resolution)*4;}
      }
      if(!retainCache){
        for(const [tile]of resident)if(!keep.has(tile))drop(tile);
        for(const [tile,need]of pending)if(!keep.has(tile))need.cancelled=true;
      }
      return Math.ceil(demandBytes/utilization);
    },
    hasViews(views){return views.some(v=>streams.has(v.stream));},
    get poolBudget(){return poolBudget;},
    stats(){return {budgetBytes:budget,viewBudgetBytes:limit,reservedBytes:reserved,peakBytes:peak,residentTiles:resident.size,cachedTiles:cache.size,refiningTiles:[...desired].filter(([t,n])=>n.visible&&(resident.get(t)?.resolution??0)<n.resolution).length,pendingTiles:pending.size,streams:streams.size,failedTiles:failures.size,failures:[...failures].slice(0,8),desiredTiles:desired.size,missingTiles:[...desired.keys()].filter(t=>!resident.has(t)).length,plans,started,sharedSources:[...allocations.values()].reduce((n,s)=>n+s.size,0)};},
    destroy(){disposed=true;desired.clear();for(const stream of [...streams])stream.destroy();},
  };
}
