import sourceSizes from './art-source-sizes.json' with {type:'json'};
import {Sprite, Texture} from 'pixi.js';

export const GROUND_BUDGET_BYTES = 128 * 1048576;
export function tileInView(tile, camera, width, height, tilt = 1, margin = 192) {
  const hw=width/(2*camera.zoom)+margin, hh=height/(2*camera.zoom*tilt)+margin;
  return tile.x < camera.x+hw && tile.x+tile.width > camera.x-hw &&
    tile.y < camera.y+hh && tile.y+tile.height > camera.y-hh;
}
export function tileResolution(tile, zoom, dpr = 1) {
  const size=sourceSizes[tile.src]??[tile.width??1,tile.height??1];
  const ratio=Math.max((tile.width??size[0])/size[0],(tile.height??size[1])/size[1]);
  return Math.min(tile.resolution ?? 1, ratio*Math.max(.0625, 2 ** Math.ceil(Math.log2(zoom*dpr))));
}
// A single pool for Home and live neighbours, including pending decodes. Far tiles
// have no texture lease. The low-resolution terrain beneath them covers loading.
export function createGroundPool({acquire, release, budget = GROUND_BUDGET_BYTES, concurrency = 2,
  makeSprite = () => new Sprite(Texture.EMPTY)} = {}) {
  const streams=new Set(), resident=new Map(), pending=new Map();
  let desired=new Map(), disposed=false, reserved=0, peak=0, failures=new Set(), deferred=new Set();
  const blank=tile => {tile.sprite.texture=Texture.EMPTY;tile.sprite.visible=false;};
  const drop=tile => {
    const entry=resident.get(tile);if (!entry)return;
    blank(tile);resident.delete(tile);reserved-=entry.bytes;release(entry.src);
  };
  const pump=() => {
    if(disposed)return;
    for(const [tile,need] of desired) {
      if(pending.size>=concurrency)break;
      const held=resident.get(tile);   // boss 8 Nov ("whenever I zoom the whole island is redrawing"): a tile keeps its current picture until the sharper one is ready
      if(held?.src===need.src||pending.has(tile)||failures.has(need.src)||deferred.has(tile))continue;
      // boss 8 Nov (a hard rectangle of missing terrace on Rosybutton Bay): over budget, old pictures kept for a zoom
      // change go first, and a tile with nothing on screen falls back to a coarser picture instead of staying a hole
      for(const [t,e] of resident) {if(reserved-(held?.bytes??0)+need.bytes<=budget)break;if(t!==tile&&desired.get(t)?.src!==e.src)drop(t);}
      if(reserved-(held?.bytes??0)+need.bytes>budget){deferred.add(tile);continue;}
      reserved+=need.bytes;peak=Math.max(peak,reserved);pending.set(tile,need);
      acquire(need.src,need.resolution).then(texture=>{
        if(disposed||desired.get(tile)?.src!==need.src) {release(need.src);reserved-=need.bytes;return;}
        // SVG tiles are authored at tile size. Account for actual pixel extent too.
        const bytes=(texture.source.pixelWidth??tile.width*need.resolution)*(texture.source.pixelHeight??tile.height*need.resolution)*4;
        const stale=resident.get(tile);
        if(reserved-need.bytes-(stale?.bytes??0)+bytes>budget){release(need.src);reserved-=need.bytes;deferred.add(tile);return;}   // over budget is not a broken tile: try again on the next view change
        if(stale){resident.delete(tile);reserved-=stale.bytes;release(stale.src);}
        reserved+=bytes-need.bytes;peak=Math.max(peak,reserved);
        resident.set(tile,{...need,bytes});tile.sprite.texture=texture;
        tile.sprite.width=tile.width+(tile.bleed??0);tile.sprite.height=tile.height+(tile.bleed??0);tile.sprite.visible=true;   // home 10: bleed = a few units of overlap that hide the seam between tiles
      }).catch(()=>{release(need.src);reserved-=need.bytes;failures.add(need.src);})
        .finally(()=>{pending.delete(tile);pump();});
    }
  };
  return {
    create(tiles,container,url=src=>src) {
      const entries=tiles.map(t=>{const tile={...t,src:url(t.src),sprite:makeSprite()};
        tile.sprite.position.set(t.x+(t.flip?t.width:0),t.y);if(t.flip)tile.sprite.scale.x=-1;blank(tile);container.addChild(tile.sprite);return tile;});
      let dead=false;
      const stream={entries,destroy(){if(dead)return;dead=true;streams.delete(stream);for(const tile of entries){desired.delete(tile);drop(tile);tile.sprite.destroy();}}};
      streams.add(stream);return stream;
    },
    update(views,dpr=1) {
      // boss 8 Nov (a hard rectangle of missing terrace on Rosybutton Bay): when everything in view cannot fit the budget at full
      // sharpness, the whole view steps down a sharpness level together. A slightly softer ground beats a tile that never draws.
      let next, step=1;
      do {
        next=new Map();let total=0;
        for(const {stream,camera,width,height,tilt=1} of views) if(streams.has(stream)) {
          for(const tile of stream.entries) if(tileInView(tile,camera,width,height,tilt)) {
            const resolution=Math.max(.0625,tileResolution(tile,camera.zoom,dpr)/step);
            const src=tile.src+(tile.src.includes('?')?'&':'?')+'groundScale='+resolution;
            const size=sourceSizes[tile.src]??[tile.width,tile.height];
            const bytes=Math.ceil(size[0]*resolution)*Math.ceil(size[1]*resolution)*4;
            next.set(tile,{src,resolution,bytes});total+=bytes;
          }
        }
        if(total<=budget*.9||step>=16)break;
        step*=2;
      } while(true);
      desired=next;deferred.clear();
      for(const tile of [...resident.keys()]) if(!desired.has(tile))drop(tile);   // only tiles that left the view; a resolution change swaps on load
      pump();
    },
    stats(){return {budgetBytes:budget,reservedBytes:reserved,peakBytes:peak,residentTiles:resident.size,pendingTiles:pending.size,streams:streams.size,failedTiles:failures.size};},
    destroy(){disposed=true;desired.clear();for(const stream of [...streams])stream.destroy();},
  };
}
