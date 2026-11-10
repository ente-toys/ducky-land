import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {cropSVG,rasterTiles,RASTER_ART_BUDGET_BYTES,RASTER_ART_UTILIZATION} from '../src/pixi/theme-raster.js';
import {tileInView,tileResolution,GROUND_BUDGET_BYTES,createGroundPool} from '../src/pixi/ground-stream.js';
import {rasterPeak} from '../scripts/globe-perf/raster-peak.mjs';
import {rasterLayers} from '../scripts/bigger-cathedral/final-model.mjs';
import {DOMAdapter} from 'pixi.js';
import {createCanvas,Image} from '@napi-rs/canvas';
import {createRasterLoader} from '../src/pixi/theme-art-stream.js';
test('The real crop loader produces device-sized canvases, shares leases, fetches each vector once and destroys released textures',async()=>{
 const adapter=DOMAdapter.get(),fetch=globalThis.fetch,location=globalThis.location;
 let reads=0;const decoded=[];
 DOMAdapter.set({...adapter,createCanvas,createImage:()=>{const image=new Image();decoded.push(image);return image;}});
 globalThis.location={href:'https://ducky.test/'};
 globalThis.fetch=async()=>{reads++;return {ok:true,text:async()=>'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10" viewBox="0 0 20 10"><rect width="20" height="10" fill="#cb7139"/><rect x="10" width=".1" height="10" fill="#39472d"/></svg>'};};
 const loader=createRasterLoader(),key='/art.svg?rasterCrop=200,100,50,25,64,64&groundScale=3.625';
 try{
  const [a,b]=await Promise.all([loader.acquire(key,3.625),loader.acquire(key,3.625)]);
  assert.equal(a,b);assert.equal(reads,1);
  assert.deepEqual([a.source.pixelWidth,a.source.pixelHeight],[232,232]);
  assert.deepEqual([decoded[0].width,decoded[0].height],[232,232],'SVG decoder itself receives physical pixel dimensions');
  const ctx=a.source.resource.getContext('2d');assert.deepEqual([...ctx.getImageData(116,116,1,1).data],[203,113,57,255]);
  assert.deepEqual([...ctx.getImageData(182,116,1,1).data],[57,71,45,255],'one-world-unit edge is resolved sharply at 3.625x');
  assert.deepEqual([...ctx.getImageData(179,116,1,1).data],[203,113,57,255],'no low-resolution image blur outside the edge');
  loader.release(key);await new Promise(setImmediate);assert.equal(a.destroyed,false);
  loader.release(key);await new Promise(setImmediate);assert.equal(a.destroyed,true);
  const other=key.replace('50,25','0,0');const c=await loader.acquire(other,3.625);assert.equal(reads,1);
  loader.release(other);await new Promise(setImmediate);assert.equal(c.destroyed,true);
 }finally{loader.destroy();DOMAdapter.set(adapter);globalThis.fetch=fetch;globalThis.location=location;}
});
test('Generic SVG crops preserve root styles, nonzero viewBoxes and world placement at device resolution',async()=>{
 const original='<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10" viewBox="10 20 20 10" fill="#cb7139"><rect x="10" y="20" width="20" height="10"/></svg>';
 const cropped=cropSVG(original,[200,100,50,25,64,64]);
 const {data,info}=await sharp(Buffer.from(cropped)).resize(232,232).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.deepEqual([...data.slice((116*info.width+116)*4,(116*info.width+116)*4+4)],[203,113,57,255]);
 for(const flip of [false,true]){
  const tiles=rasterTiles({x:300,y:400,width:200,height:100,flip},'/arbitrary-theme.svg',{x:.5,y:1});
  assert.ok(tiles.every(t=>t.screenResolution));
  for(const t of tiles){assert.equal(t.x,300+t.localX);assert.equal(t.y,400+t.localY);assert.ok(t.width<=64.5&&t.height<=64.5);}
  for(const zoom of [.6,1.8])assert.ok(tiles.every(t=>tileResolution(t,zoom,2)/(zoom*2*(t.rasterDensity??1))>=1));
 }
});
test('Every Bellovo viewport retains >=1 texel per device pixel at default and maximum zoom within unchanged caps',()=>{
 const layers=rasterLayers();
 for(const zoom of [.6,1.8])for(const [width,height]of [[390,844],[1400,1000],[1920,1080]]){
  for(const [kind,tiles]of Object.entries(layers)){
   assert.ok(tiles.every(t=>tileResolution(t,zoom,2)/(zoom*2*(t.rasterDensity??1))>=1));
   const peak=rasterPeak(tiles,{width,height,zoom});
   const cap=kind==='ground'?GROUND_BUDGET_BYTES*.9:RASTER_ART_BUDGET_BYTES*RASTER_ART_UTILIZATION;
   assert.ok(peak.bytes<=cap,`${kind} ${JSON.stringify(peak.camera)} viewport ${width}x${height}: ${peak.bytes/1048576} MiB`);
  }
 }
});
test('Cropped streams release through their own loader and account for pending replacement textures',async()=>{
 const releases=[],pending=[];const sprite=()=>({position:{set(){}},scale:{x:1},destroy(){}});
 const pool=createGroundPool({budget:250000,makeSprite:sprite,acquire:()=>{throw Error('wrong loader');},release:()=>{throw Error('wrong owner');}});
 const stream=pool.create([{src:'/theme.svg?rasterCrop=100,100,0,0,100,100',x:0,y:0,width:100,height:100,screenResolution:true,resolution:4}],{addChild(){}},undefined,{acquire:(src,r)=>new Promise(resolve=>pending.push(()=>resolve({source:{pixelWidth:100*r,pixelHeight:100*r}}))),release:src=>releases.push(src)});
 const view=zoom=>[{stream,camera:{x:50,y:50,zoom},width:100,height:100}];
 pool.update(view(.6),2);pending.shift()();await new Promise(setImmediate);
 pool.update(view(1),2);assert.ok(pool.stats().reservedBytes<=250000);pending.shift()();await new Promise(setImmediate);
 assert.equal(releases.length,1);pool.destroy();assert.equal(releases.length,2);assert.equal(pool.stats().reservedBytes,0);
});
