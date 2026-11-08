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
  let desired=new Map(), disposed=false, reserved=0, peak=0, failures=new Set();
  const blank=tile => {tile.sprite.texture=Texture.EMPTY;tile.sprite.visible=false;};
  const drop=tile => {
    const entry=resident.get(tile);if (!entry)return;
    blank(tile);resident.delete(tile);reserved-=entry.bytes;release(entry.src);
  };
  const pump=() => {
    if(disposed)return;
    for(const [tile,need] of desired) {
      if(pending.size>=concurrency)break;
      if(resident.has(tile)||pending.has(tile)||failures.has(need.src)||reserved+need.bytes>budget)continue;
      reserved+=need.bytes;peak=Math.max(peak,reserved);pending.set(tile,need);
      acquire(need.src,need.resolution).then(texture=>{
        if(disposed||desired.get(tile)?.src!==need.src) {release(need.src);reserved-=need.bytes;return;}
        // SVG tiles are authored at tile size. Account for actual pixel extent too.
        const bytes=(texture.source.pixelWidth??tile.width*need.resolution)*(texture.source.pixelHeight??tile.height*need.resolution)*4;
        if(reserved-need.bytes+bytes>budget){release(need.src);reserved-=need.bytes;failures.add(need.src);return;}
        reserved+=bytes-need.bytes;peak=Math.max(peak,reserved);
        resident.set(tile,{...need,bytes});tile.sprite.texture=texture;
        tile.sprite.width=tile.width+(tile.bleed??0);tile.sprite.height=tile.height+(tile.bleed??0);   // home 10: a few units of overlap hide the seam between tiles
tile.sprite.visible=true;
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
      const next=new Map();
      for(const {stream,camera,width,height,tilt=1} of views) if(streams.has(stream)) {
        for(const tile of stream.entries) if(tileInView(tile,camera,width,height,tilt)) {
          const resolution=tileResolution(tile,camera.zoom,dpr);
          const src=tile.src+(tile.src.includes('?')?'&':'?')+'groundScale='+resolution;
          const size=sourceSizes[tile.src]??[tile.width,tile.height];
          next.set(tile,{src,resolution,bytes:Math.ceil(size[0]*resolution)*Math.ceil(size[1]*resolution)*4});
        }
      }
      desired=next;
      for(const [tile,entry] of resident) if(desired.get(tile)?.src!==entry.src)drop(tile);
      pump();
    },
    stats(){return {budgetBytes:budget,reservedBytes:reserved,peakBytes:peak,residentTiles:resident.size,pendingTiles:pending.size,streams:streams.size,failedTiles:failures.size};},
    destroy(){disposed=true;desired.clear();for(const stream of [...streams])stream.destroy();},
  };
}
