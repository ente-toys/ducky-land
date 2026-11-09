import test from 'node:test';
import assert from 'node:assert/strict';
import {artResolution} from '../src/pixi/art-resolution.js';
import sizes from '../src/pixi/art-source-sizes.json' with {type:'json'};
import tiled from '../src/pixi/large-art-tiles.json' with {type:'json'};
import {readFileSync} from 'node:fs';
import sharp from 'sharp';

test('SVG raster sizing retains every screen pixel at maximum zoom and DPR with extra sampling headroom',()=>{
 for(const [src,size] of Object.entries(sizes))for(const scale of [.2,.8,1,2]){
  const entry={src,width:size[0],height:size[1],scale},r=artResolution(entry,2);
  assert.ok(r>=Math.min(2,scale*1.8*2));assert.ok(r<=2);
 }
 assert.equal(artResolution({src:'unknown.svg'},2),2);
});
test('oversized decorative SVG tiles render the same pixels as their original source',async()=>{
 // Non-transparent crop pixels, gradients, filters, and root viewBoxes survive
 // nested-SVG tiling. Compare actual raster output, not generated string shape.
 for(const [theme,src]of [['waterfall','detail/waterfall-last-lawn-flowers.svg'],['waterfall','centre/decal-water.svg'],['cathedral','detail/rose-inlay.svg']]){
  const a=JSON.parse(readFileSync(`public/pixi-art/themes/${theme}/art.json`));
  const p=[...a.flats,...a.decks].find(p=>p.src===src),native=p.resolution??2;
  const tiles=tiled[theme][[p.src,p.width,p.height,native].join('|')];assert.ok(tiles?.length);
  const full=await sharp(`public/pixi-art/themes/${theme}/${src}`).resize(Math.round(p.width),Math.round(p.height),{fit:'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  // Choose the tile whose original crop contains the most non-transparent pixels.
  let best=tiles[0],count=-1;
  for(const t of tiles){let n=0;for(let y=Math.ceil(t.y);y<Math.min(Math.floor(t.y+t.height),full.info.height);y+=16)for(let x=Math.ceil(t.x);x<Math.min(Math.floor(t.x+t.width),full.info.width);x+=16)n+=full.data[(y*full.info.width+x)*4+3]>0;if(n>count){best=t;count=n;}}
  const image=await sharp('public'+best.src).resize(Math.round(best.width),Math.round(best.height),{fit:'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let error=0,n=0;
  for(let y=4;y<image.info.height-4;y+=8)for(let x=4;x<image.info.width-4;x+=8){
   const ai=((y+Math.round(best.y))*full.info.width+x+Math.round(best.x))*4,bi=(y*image.info.width+x)*4;
   // Compare premultiplied colour to ignore RGB in transparent SVG pixels.
   for(let k=0;k<3;k++){error+=Math.abs(full.data[ai+k]*full.data[ai+3]/255-image.data[bi+k]*image.data[bi+3]/255);n++;}
  }
  assert.ok(count>0,`${theme}/${src}: visible source sampled`);assert.ok(error/n<2,`${theme}/${src}: mean pixel error ${error/n}`);
 }
});
