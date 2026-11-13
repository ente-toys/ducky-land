import {readyTexture} from './ready-texture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {cropSVG,rasterTiles,RASTER_GROUND_TILE_SIZE,RASTER_ART_BUDGET_BYTES,RASTER_ART_UTILIZATION} from '../src/rendering/pixi/art/theme-raster.js';
import {tileInView,tileResolution,GROUND_BUDGET_BYTES,createGroundPool} from '../src/rendering/pixi/art/ground-stream.js';
import {rasterPeak} from '../scripts/globe-perf/raster-peak.mjs';
import {DOMAdapter,ImageSource,Texture} from 'pixi.js';
import {loadThemeArt} from '../src/rendering/pixi/art/theme-art.js';
import {createCanvas,Image} from '@napi-rs/canvas';
import {createRasterLoader} from '../src/rendering/pixi/art/theme-art-stream.js';
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
test('Cropped streams release through their own loader and account for pending replacement textures',async()=>{
 const releases=[],pending=[];const sprite=()=>({position:{set(){}},scale:{x:1},destroy(){}});
 const pool=createGroundPool({budget:250000,makeSprite:sprite,acquire:()=>{throw Error('wrong loader');},release:()=>{throw Error('wrong owner');}});
 const stream=pool.create([{src:'/theme.svg?rasterCrop=100,100,0,0,100,100',x:0,y:0,width:100,height:100,screenResolution:true,resolution:4}],{addChild(){}},undefined,{acquire:(src,r)=>new Promise(resolve=>pending.push(()=>resolve({source:{pixelWidth:100*r,pixelHeight:100*r}}))),release:src=>releases.push(src)});
 const view=zoom=>[{stream,camera:{x:50,y:50,zoom},width:100,height:100}];
 pool.update(view(.6),2);pending.shift()();await new Promise(setImmediate);
 pool.update(view(1),2);assert.ok(pool.stats().reservedBytes<=250000);pending.shift()();await new Promise(setImmediate);
 assert.equal(releases.length,1);pool.destroy();assert.equal(releases.length,2);assert.equal(pool.stats().reservedBytes,0);
});

const rasterFixture={raster:{enabled:true},ground:{tiles:[{src:'floor.svg',x:3500,y:600,width:1000,height:1000}]},
 decks:[{src:'deck.svg',x:3900,y:950,width:200,height:100,overBoats:true}],
 flats:[{src:'paving.svg',x:4000,y:1200,width:300,height:200}],
 props:[{id:'fixture-stage',src:'stage.svg',x:4000,y:1282,width:830,height:695,shadow:false,wind:false}]};
test('Enabled raster fixture retains >=1 texel per device pixel at DPR 2 and both zoom limits within pool caps',()=>{
 assert.equal(rasterFixture.raster.enabled,true);
 const art=rasterFixture,url=p=>'/raster-fixture/'+p.src;
 const layers={ground:art.ground.tiles.flatMap(p=>rasterTiles(p,url(p),undefined,RASTER_GROUND_TILE_SIZE)),art:[...art.decks.flatMap(p=>Array.from({length:p.overBoats?2:1},()=>[p,{x:0,y:0}])),...art.flats.map(p=>[p,p.topLeft?{x:0,y:0}:{x:.5,y:1}]),...art.props.map(p=>[p,p.anchor??{x:.5,y:1}])].flatMap(([p,a])=>rasterTiles(p,url(p),a))};
 for(const zoom of [.6,1.8])for(const [width,height]of [[390,844],[1400,1000],[1920,1080]])for(const [name,tiles]of Object.entries(layers)){
  const visible=tiles.filter(t=>tileInView(t,{x:4000,y:1050,zoom},width,height,1,t.viewMargin??192));assert(visible.length>0);
  let bytes=0;for(const t of visible){const r=tileResolution(t,zoom,2);assert(r/(zoom*2)>=1);bytes+=Math.ceil(t.width*r)*Math.ceil(t.height*r)*4;}
  assert(bytes<(name==='ground'?GROUND_BUDGET_BYTES*.9:RASTER_ART_BUDGET_BYTES*RASTER_ART_UTILIZATION),`${name}, ${zoom}, ${width}x${height}: ${bytes/1048576} MiB`);
 }
});
test('Enabled raster fixture loads visible standing crops through the raster pool and releases them',async t=>{
 const previousFetch=globalThis.fetch;t.after(()=>globalThis.fetch=previousFetch);
 globalThis.fetch=async url=>({ok:true,json:async()=>url.endsWith('art.json')?rasterFixture:{pieces:[]}});
 const textures=new Map();
 const loader={acquire:async(src,resolution)=>{
  const crop=new URL(src,'https://test').searchParams.get('rasterCrop').split(',').map(Number);
  const texture=new Texture({source:new ImageSource({width:Math.ceil(crop[4]*resolution)/resolution,height:Math.ceil(crop[5]*resolution)/resolution,resolution})});
  textures.set(src,texture);return texture;
 },release:src=>{textures.get(src)?.destroy(true);textures.delete(src);},destroy(){}};
 const groundPool=createGroundPool(loader);let loaded;
 try{
  loaded=await loadThemeArt({id:'raster-fixture',art:'/raster-fixture/art.json',origin:{x:3500,y:600},width:1000,height:1000},{groundPool,acquire:async()=>readyTexture(),release(){},rasterLoaderFactory:()=>loader});
  assert(loaded.rasterPool);assert(loaded.props.some(p=>p.id==='fixture-stage'));
  const camera={x:4000,y:1050,zoom:1.8},views=loaded.groundStreams.map(stream=>({stream,camera,width:1400,height:1000}));
  groundPool.update(views,2);loaded.rasterPool.update(views,2);
  for(let i=0;i<1000&&(groundPool.stats().pendingTiles||loaded.rasterPool.stats().pendingTiles);i++)await new Promise(setImmediate);
  const stream=loaded.groundStreams.find(s=>s.entries[0]?.src.includes('stage.svg'));assert(stream);
  const visible=stream.entries.filter(tile=>tileInView(tile,camera,1400,1000,1,tile.viewMargin));
  assert(visible.length>0);assert(visible.every(t=>t.sprite.visible&&t.sprite.texture!==Texture.EMPTY),'no missing standing crops');
  for(const pool of [groundPool,loaded.rasterPool]){assert.equal(pool.stats().failedTiles,0);assert.equal(pool.stats().missingTiles,0);assert(pool.stats().peakBytes<=pool.stats().budgetBytes);}
 }finally{loaded?.destroy();groundPool.destroy();}
 assert.equal(textures.size,0);
});
