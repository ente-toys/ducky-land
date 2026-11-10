import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {DOMAdapter} from 'pixi.js';
import {createCanvas,Image} from '@napi-rs/canvas';
import {cropFairSVG,FAIR_ART_BUDGET_BYTES,FAIR_MAX_RESOLUTION,FAIR_ART_UTILIZATION,FAIR_KITE_RESOLUTION} from '../src/pixi/fair-raster.js';
import {createFairRasterLoader} from '../src/pixi/fair-art-stream.js';
import {createGroundPool,GROUND_BUDGET_BYTES,tileInView} from '../src/pixi/ground-stream.js';
import {allocation,planned,layers} from '../scripts/fair-crisp/model.mjs';
import poses from '../src/pixi/sleep-poses.json' with {type:'json'};
import {SLEEP_ROOT,SLEEP_SIZE} from '../src/pixi/sleep-spots.js';
const art=JSON.parse(readFileSync('public/pixi-art/themes/fair/art.json'));
const tiles=planned(art),centres=[{x:3500,y:2700},...layers(art).map(({p})=>({x:p.x,y:p.y-p.height*(p.scale??1)/2}))];
const fakeSprite=()=>({position:{set(x,y){this.x=x;this.y=y;}},scale:{x:1},destroy(){}});
const flush=()=>new Promise(r=>setImmediate(r));

test('every Fair art layer supplies at least one texel per device pixel at default AND maximum zoom on 2x screens',()=>{
 for(const [width,height]of [[1000,600],[1400,1000],[1985,1180],[2560,1440]])for(const zoom of [Math.min(width/1500,height/1000),1.8]){
  for(const {p,kind}of layers(art)){
   const own=tiles.filter(t=>t.id===(p.id??p.src)&&t.kind===kind);
   assert(own.length,`${kind} ${p.src} has no streamed art`);
   // The new tiles are authored in world units, hence sprite scale = 1.
   const anchor=layers(art).find(l=>l.p===p).anchor;
   const {visible}=allocation(own,{x:p.x+p.width*(p.scale??1)*(.5-anchor.x),y:p.y+p.height*(p.scale??1)*(.5-anchor.y),zoom},width,height);
   assert(visible.length,`${kind} ${p.src} no visible crop`);
   for(const t of visible){assert(t.resolution/(zoom*2)>=1,`${kind} ${p.src} is undersampled at ${zoom}`);assert(Math.ceil(t.width*FAIR_MAX_RESOLUTION)<=514);assert(Math.ceil(t.height*FAIR_MAX_RESOLUTION)<=514);}
  }
 }
 for(const p of Object.values(poses.poses))assert(1/((1/poses.F)*p.k*SLEEP_SIZE*SLEEP_ROOT/3*1.8*2)>=1,'sleep art at maximum zoom');
 for(const site of art.kites)assert(FAIR_KITE_RESOLUTION/(Math.max(1,site.size)*1.8*2)>=1,'kite including its stake');
});

test('all Fair default/max views fit the existing ground budget and the previous non-ground allocation',()=>{
 assert.equal(GROUND_BUDGET_BYTES,128*1048576);
 assert(FAIR_ART_BUDGET_BYTES<=88.302433014*1048576);
 for(const [width,height]of [[1000,600],[1400,1000],[1985,1180],[2560,1440]])for(const zoom of [Math.min(width/1500,height/1000),1.8])for(const centre of centres){
  const a=allocation(tiles,{...centre,zoom},width,height);
  assert(a.ground<=GROUND_BUDGET_BYTES*.9,`ground ${JSON.stringify({centre,zoom,width,MiB:a.ground/1048576})}`);
  assert(a.art<=FAIR_ART_BUDGET_BYTES*FAIR_ART_UTILIZATION,`art ${JSON.stringify({centre,zoom,width,MiB:a.art/1048576})}`);
 }
});

test('actual shared pool requests retain full retina density, relative placement, and release Fair crop leases',async()=>{
 for(const kind of ['ground','art']){
  const requested=[],released=[];
  const pool=createGroundPool({budget:kind==='ground'?GROUND_BUDGET_BYTES:FAIR_ART_BUDGET_BYTES,utilization:kind==='ground'?.9:FAIR_ART_UTILIZATION,makeSprite:fakeSprite,
   acquire:async(src,resolution)=>{requested.push({src,resolution});const c=new URL(src,'http://test').searchParams.get('fairCrop').split(',').map(Number);return {source:{pixelWidth:Math.ceil(c[4]*resolution),pixelHeight:Math.ceil(c[5]*resolution)}};},release:src=>released.push(src)});
  const stream=pool.create(tiles.filter(t=>(t.kind==='ground')===(kind==='ground')),{addChild(){}});
  const tile=stream.entries[0];assert.equal(tile.sprite.position.x,tile.localX+(tile.flip?tile.width:0));
  for(const zoom of [1.18,1.8]){
   pool.update([{stream,camera:{x:3500,y:2700,zoom},width:1985,height:1180}],2);
   while(pool.stats().pendingTiles)await flush();
   assert.equal(pool.stats().failedTiles,0);assert(pool.stats().reservedBytes<=pool.stats().budgetBytes);
   assert(requested.filter(p=>p.src.endsWith('groundScale='+p.resolution)).every(p=>p.resolution>=2*1.18));
  }
  pool.destroy();assert.equal(pool.stats().reservedBytes,0);assert.equal(requested.length,released.length);
 }
});

test('cropped SVG pixels equal the unchanged source, including ink on crop boundaries',async()=>{
 for(const {p,src}of layers(art).filter(({kind,p})=>kind==='props'&&/ac2.*(lamp-post-01|ferris-wheel)/.test(p.src))){
  const width=Math.round(p.width*(p.scale??1)),height=Math.round(p.height*(p.scale??1)),svg=readFileSync('public'+src,'utf8'),x=32,y=64,w=64,h=128;
  const cropped=await sharp(Buffer.from(cropFairSVG(svg,[width,height,x,y,w,h]))).ensureAlpha().raw().toBuffer();
  const full=await sharp(Buffer.from(cropFairSVG(svg,[width,height,0,0,width,height]))).extract({left:x,top:y,width:w,height:h}).ensureAlpha().raw().toBuffer();
  let error=0;for(let i=0;i<full.length;i++)error+=Math.abs(full[i]-cropped[i]);assert(error/full.length<1,'changed source pixels '+src);
 }
});

test('the real Fair SVG loader rasterises at requested dimensions, shares leases and destroys the final texture',async()=>{
 const adapter=DOMAdapter.get(),oldFetch=globalThis.fetch,oldLocation=globalThis.location;
 DOMAdapter.set({createImage:()=>new Image(),createCanvas});
 globalThis.location={href:'http://test/'};let fetches=0;
 globalThis.fetch=async url=>{fetches++;return {ok:true,text:async()=>readFileSync('public'+new URL(url).pathname,'utf8')}};
 const loader=createFairRasterLoader(),key='/pixi-art/themes/fair/ac2/placed-ac2-lamp-post-01.svg?fairCrop=125,355,0,0,128,128&groundScale=3.625';
 try{
  const [a,b]=await Promise.all([loader.acquire(key,3.625),loader.acquire(key,3.625)]);
  assert.equal(a,b);assert.equal(fetches,1);assert.equal(a.source.pixelWidth,464);assert.equal(a.source.pixelHeight,464);assert.equal(a.source.scaleMode,'linear');assert.equal(a.source.autoGenerateMipmaps,false);
  loader.release(key);await flush();assert(!a.destroyed);loader.release(key);await flush();assert(a.destroyed);
 }finally{loader.destroy();DOMAdapter.set(adapter);globalThis.fetch=oldFetch;if(oldLocation===undefined)delete globalThis.location;else globalThis.location=oldLocation;}
});

test('the production theme loader wires Fair ground and standing props into their budgeted crop pools',async()=>{
 const {loadThemeArt}=await import('../src/pixi/theme-art.js');
 const oldFetch=globalThis.fetch,manifest={ground:{tiles:[{src:'ground.svg',x:1000,y:2000,width:200,height:200}]},decks:[],flats:[],props:[{id:'lamp',src:'lamp.svg',x:1100,y:2100,width:29,height:82,scale:4.3,anchor:{x:.5,y:1},flip:true,shadow:false}]};
 globalThis.fetch=async url=>({ok:!String(url).includes('centre/'),json:async()=>manifest});
 const acquisitions=[],streams=[],fakePool={create(entries,container,url,loader){const stream={entries,loader,destroy(){this.destroyed=true;}};streams.push(stream);return stream;}};
 let loaded;
 try{
  loaded=await loadThemeArt({id:'fair',art:'/pixi-art/themes/fair/art.json',origin:{x:0,y:0},width:3000,height:3000},{acquire:async(src,r)=>{acquisitions.push([src,r]);const {Texture}=await import('pixi.js');return Texture.EMPTY;},release(){},groundPool:fakePool});
  assert.deepEqual(acquisitions,[['/pixi-art/globe/fair-ground.svg',1]],'no fixed-resolution Fair props may be eagerly rasterised');
  assert.equal(loaded.rasterPool.stats().budgetBytes,FAIR_ART_BUDGET_BYTES);
  assert(streams[0].entries.every(t=>t.screenResolution&&t.x>=1000&&t.y>=2000&&t.localX===undefined));
  assert.equal(typeof streams[0].loader.acquire,'function');
  const lamp=loaded.props[0].sprite;assert.equal(lamp.x,1100);assert.equal(lamp.y,2100);assert(lamp.children.length>0);
  const xs=lamp.children.map(s=>s.x);assert(Math.min(...xs)>=-29*4.3/2);assert(Math.max(...xs)<=29*4.3/2);
 }finally{loaded?.destroy();globalThis.fetch=oldFetch;}
});

test('retina zoom/pan swaps count old and pending Fair textures within each hard memory cap',async()=>{
 for(const kind of ['ground','art']){
  const pool=createGroundPool({budget:kind==='ground'?GROUND_BUDGET_BYTES:FAIR_ART_BUDGET_BYTES,utilization:kind==='ground'?.9:FAIR_ART_UTILIZATION,makeSprite:fakeSprite,
   acquire:async(src,resolution)=>{await flush();const c=new URL(src,'http://test').searchParams.get('fairCrop').split(',').map(Number);return {source:{pixelWidth:Math.ceil(c[4]*resolution),pixelHeight:Math.ceil(c[5]*resolution)}};},release(){}});
  const stream=pool.create(tiles.filter(t=>(t.kind==='ground')===(kind==='ground')),{addChild(){}});
  for(const [x,y,zoom]of [[3500,2400,.6],[7762.1,2639.25,1.44],[7762.1,2639.25,1.8],[3500,2400,1.8],[3500,2400,.6]]){
   const view=[{stream,camera:{x,y,zoom},width:2560,height:1440}];
   // The first overview has deliberately large world coverage; only the normal
   // and maximum play views must retain the density floor under the budget.
   pool.update(view,2);while(pool.stats().pendingTiles)await flush();
   pool.update(view,2);while(pool.stats().pendingTiles)await flush();
   assert(pool.stats().peakBytes<=pool.stats().budgetBytes,`${kind} peak must include old + pending decodes`);
   assert.equal(pool.stats().failedTiles,0);
   if(zoom>=1.44)for(const tile of stream.entries.filter(t=>tileInView(t,{x,y,zoom},2560,1440,1,t.viewMargin))){
    assert(tile.sprite.visible,`${kind} visible tile never loaded`);
    assert(tile.sprite.texture.source.pixelWidth/tile.width/(zoom*2)>=1,`${kind} budget reduced sharpness`);
    assert(tile.sprite.texture.source.pixelHeight/tile.height/(zoom*2)>=1,`${kind} budget reduced sharpness`);
   }
  }
  pool.destroy();assert.equal(pool.stats().reservedBytes,0);
 }
});

test('Fair crop pool plus its independent sharp kites fit within the former 88.30 MiB fixed-art allocation',async()=>{
 const {KITE_ASSETS}=await import('../src/pixi/home-kites.js');let kiteBytes=0;
 for(const src of KITE_ASSETS){const m=await sharp('public'+src).metadata();kiteBytes+=Math.ceil(m.width*FAIR_KITE_RESOLUTION)*Math.ceil(m.height*FAIR_KITE_RESOLUTION)*4;}
 assert(FAIR_ART_BUDGET_BYTES+kiteBytes<=88.302433014*1048576);
});

test('transparent-gutter crop plans retain the original thin ink and silhouettes at retina sampling',async()=>{
 const selected=new Map();
 for(const l of layers(art).filter(l=>l.kind==='props')){
  const category=/ferris-wheel|swing-ride|teacup-ride|carousel|lamp-post|banner-post|\/tree-|\/bush-|\/flower-|house-blue-flower-hall/.exec(l.src)?.[0];
  if(category&&!selected.has(category))selected.set(category,l);
 }
 for(const {p,src,anchor}of selected.values()){
  const width=p.width*(p.scale??1),height=p.height*(p.scale??1),W=Math.ceil(width*2),H=Math.ceil(height*2);
  const {data}=await sharp(Buffer.from(cropFairSVG(readFileSync('public'+src,'utf8'),[width,height,0,0,width,height]))).resize(W,H,{fit:'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const covered=new Uint8Array(W*H),{fairTiles}=await import('../src/pixi/fair-raster.js');
  for(const tile of fairTiles(p,src,anchor)){
   const c=new URL(tile.src,'http://test').searchParams.get('fairCrop').split(',').map(Number),x0=Math.max(0,Math.floor(c[2]/width*W)),x1=Math.min(W,Math.ceil((c[2]+c[4])/width*W)),y0=Math.max(0,Math.floor(c[3]/height*H)),y1=Math.min(H,Math.ceil((c[3]+c[5])/height*H));
   for(let y=y0;y<y1;y++)covered.fill(1,y*W+x0,y*W+x1);
  }
  for(let i=0;i<covered.length;i++)assert(covered[i]||data[i*4+3]===0,`${src} lost a visible source pixel to gutter trimming`);
 }
});
