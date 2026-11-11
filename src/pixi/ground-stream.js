import sourceSizes from './art-source-sizes.json' with {type:'json'};
import {Sprite, Texture} from 'pixi.js';

export const GROUND_BUDGET_BYTES = 128 * 1048576;
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
// A single pool for Home and live neighbours, including pending decodes. Far tiles
// have no texture lease. New crops get a cheap preview before refinement.
export function createGroundPool({acquire, release, budget = GROUND_BUDGET_BYTES, concurrency = 64, utilization = .9,
  makeSprite = () => new Sprite(Texture.EMPTY),
  schedule = globalThis.requestAnimationFrame?.bind(globalThis), now = () => performance.now(),
  settleMs = schedule ? 100 : 0, planInterval = schedule ? 32 : 0,
  frameBudgetMs = 5, progressive = !!schedule, prefetch = !!schedule} = {}) {
  const streams=new Set(), resident=new Map(), pending=new Map(), cache=new Map();
  let desired=new Map(), disposed=false, reserved=0, peak=0, failures=new Map(), deferred=new Set();
  let scheduled=false,lastPlan=-Infinity,lastSignature='',plans=0,started=0,streamId=0,zooming=false;
  const zooms=new Map();
  const requestPump=()=>{if(!schedule){pump();return;}if(scheduled||disposed)return;scheduled=true;schedule(()=>{scheduled=false;pump();});};
  const blank=tile => {tile.sprite.texture=Texture.EMPTY;tile.sprite.visible=false;};
  const discard=entry=>{reserved-=entry.bytes;entry.release(entry.src);};
  const remember=(tile,entry)=>{
    if(!progressive){discard(entry);return;}
    let versions=cache.get(tile);if(!versions)cache.set(tile,versions=new Map());
    if(versions.has(entry.src))discard(versions.get(entry.src));
    versions.set(entry.src,entry);
  };
  const show=(tile,entry)=>{
    resident.set(tile,entry);tile.sprite.texture=entry.texture;
    tile.sprite.width=tile.width+(tile.bleed??0);tile.sprite.height=tile.height+(tile.bleed??0);tile.sprite.visible=true;
  };
  const drop=tile => {
    const entry=resident.get(tile);if (!entry)return;
    blank(tile);resident.delete(tile);remember(tile,entry);
  };
  const pump=() => {
    if(disposed)return;
    // Empty visible crops first, then visible refinements, then the walking ring.
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
      // Keep previously decoded crop+resolution leases in the SAME pool budget.
      const versions=cache.get(tile);
      const cached=versions&&[...versions.values()].find(e=>e.resolution>=target.resolution);
      if(cached){versions.delete(cached.src);if(!versions.size)cache.delete(tile);if(held)remember(tile,held);show(tile,cached);continue;}
      const resolution=progressive&&!held?Math.min(.5,target.resolution):target.resolution;
      const need={...target,resolution,src:tile.src+(tile.src.includes('?')?'&':'?')+'groundScale='+resolution,
        bytes:Math.ceil(target.pixelWidth*resolution)*Math.ceil(target.pixelHeight*resolution)*4};
      if(failures.has(need.src))continue;
      for(const [t,entries] of cache){
        for(const [src,entry] of entries){if(reserved+need.bytes<=budget)break;discard(entry);entries.delete(src);}
        if(!entries.size)cache.delete(t);
      }
      // Ring crops may be evicted to fund a visible refinement. Never evict a
      // visible resident, even when its replacement is already in flight.
      for(const [t] of resident) {if(reserved+need.bytes<=budget)break;if(!desired.get(t)?.visible&&target.visible)drop(t);}
      // drop() caches, so reclaim those leases too before reserving a decode.
      for(const [t,entries] of cache){
        for(const [src,entry] of entries){if(reserved+need.bytes<=budget)break;discard(entry);entries.delete(src);}
        if(!entries.size)cache.delete(t);
      }
      if(reserved+need.bytes>budget){deferred.add(tile);continue;}
      submitted++;started++;reserved+=need.bytes;peak=Math.max(peak,reserved);pending.set(tile,need);
      need.acquire(need.src,need.resolution).then(texture=>{
        if(disposed||!desired.has(tile)) {need.release(need.src);reserved-=need.bytes;return;}
        const bytes=(texture.source.pixelWidth??tile.width*need.resolution)*(texture.source.pixelHeight??tile.height*need.resolution)*4;
        const stale=resident.get(tile);
        if(stale?.resolution>=need.resolution||reserved-need.bytes+bytes>budget){need.release(need.src);reserved-=need.bytes;deferred.add(tile);return;}
        reserved+=bytes-need.bytes;peak=Math.max(peak,reserved);
        if(stale){resident.delete(tile);remember(tile,stale);}
        show(tile,{...need,bytes,texture});
      }).catch(error=>{need.release(need.src);reserved-=need.bytes;failures.set(need.src,String(error));})
        .finally(()=>{pending.delete(tile);deferred.clear();requestPump();});
    }
    // A synchronous submission can consume the budget before concurrency fills.
    if(!pending.size&&jobs.some(([tile,n])=>!deferred.has(tile)&&!failures.has(n.src)&&(!resident.has(tile)||resident.get(tile).resolution<n.resolution)))requestPump();
  };
  return {
    create(tiles,container,url=src=>src,loader={acquire,release}) {
      const entries=tiles.map(t=>{const tile={...t,src:url(t.src),sprite:makeSprite(),acquire:loader.acquire,release:loader.release};
        tile.sprite.position.set((t.localX??t.x)+(t.flip?t.width:0),t.localY??t.y);if(t.flip)tile.sprite.scale.x=-1;blank(tile);container.addChild(tile.sprite);return tile;});
      let dead=false;
      const resolutionTiles=[...new Map(entries.map(t=>[[t.screenResolution,t.rasterDensity,t.resolution,t.screenResolution?0:tileResolution(t,1)].join('|'),t])).values()];
      const stream={id:++streamId,entries,resolutionTiles,destroy(){if(dead)return;dead=true;streams.delete(stream);lastSignature='';zooms.delete(stream);for(const tile of entries){desired.delete(tile);drop(tile);for(const entry of cache.get(tile)?.values()??[])discard(entry);cache.delete(tile);tile.sprite.destroy();}}};
      streams.add(stream);return stream;
    },
    update(views,dpr=1,fastZoom=false) {
      // boss 8 Nov (a hard rectangle of missing terrace on Rosybutton Bay): when everything in view cannot fit the budget at full
      // sharpness, the whole view steps down a sharpness level together. A slightly softer ground beats a tile that never draws.
      // Keep filling holes during zoom, but let existing tiles cover the
      // transition before refining them or decoding outside the viewport.
      zooming=fastZoom;
      const time=now();
      const active=views.filter(v=>streams.has(v.stream));
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
        next=new Map();let total=0;
        for(const {stream,camera,cullCamera,width,height,tilt=1} of planned) {
          for(const tile of stream.entries) if(tileInView(tile,cullCamera,width,height,tilt,prefetch?{x:width/cullCamera.zoom,y:height/(cullCamera.zoom*tilt)}:(tile.viewMargin??192))) {
            const visible=tileInView(tile,cullCamera,width,height,tilt,tile.viewMargin??192);
            const resolution=Math.max(.0625,visible?tileResolution(tile,camera.zoom,dpr)/step:Math.min(.5,tileResolution(tile,camera.zoom,dpr))/ringStep);
            const src=tile.src+(tile.src.includes('?')?'&':'?')+'groundScale='+resolution;
            const size=sourceSizes[tile.src]??[tile.width,tile.height];
            const bytes=Math.ceil(size[0]*resolution)*Math.ceil(size[1]*resolution)*4;
            next.set(tile,{src,resolution,bytes,visible,pixelWidth:size[0],pixelHeight:size[1],distance:Math.hypot(tile.x+tile.width/2-cullCamera.x,tile.y+tile.height/2-cullCamera.y),acquire:tile.acquire,release:tile.release});total+=bytes;
          }
        }
        if(total<=budget*utilization||step>=16)break;
        if(prefetch&&ringStep<8)ringStep*=2;else step*=2;
      } while(true);
      // Load standing props before decorative floor crops,
      // so the centre of the view cannot sit behind thousands of off-centre decals.
      desired=new Map([...next].sort(([a,an],[b,bn])=>(b.priority??0)-(a.priority??0)||an.distance-bn.distance));deferred.clear();
      for(const tile of [...resident.keys()]) if(!desired.has(tile))drop(tile);   // only tiles that left the view; a resolution change swaps on load
      requestPump();
    },
    stats(){return {budgetBytes:budget,reservedBytes:reserved,peakBytes:peak,residentTiles:resident.size,cachedTiles:cache.size,refiningTiles:[...desired].filter(([t,n])=>n.visible&&(resident.get(t)?.resolution??0)<n.resolution).length,pendingTiles:pending.size,streams:streams.size,failedTiles:failures.size,failures:[...failures].slice(0,8),desiredTiles:desired.size,missingTiles:[...desired.keys()].filter(t=>!resident.has(t)).length,plans,started};},
    destroy(){disposed=true;desired.clear();for(const stream of [...streams])stream.destroy();},
  };
}
