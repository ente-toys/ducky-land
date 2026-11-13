import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {Texture,ImageSource} from 'pixi.js';
import {loadThemeArt} from '../src/rendering/pixi/art/theme-art.js';
import {createGroundPool,tileInView,tileResolution} from '../src/rendering/pixi/art/ground-stream.js';
import {icelandPieceTile,icelandPieceSVG} from '../src/rendering/pixi/art/iceland-art-stream.js';
const art=JSON.parse(readFileSync('public/pixi-art/themes/snow/art.json'));
const world=JSON.parse(readFileSync('assets/world/themes/snow/world.json'));
const sprite=()=>({position:{set(){}},scale:{x:1},destroy(){}});
const flush=()=>new Promise(setImmediate);
const finish=async pools=>{for(let i=0;i<300&&pools.some(p=>p.stats().pendingTiles);i++)await flush();};

test('1440x900 Iceland arrivals acquire bounded unique shared pieces at full device density, release on exit',async t=>{
 const previous=globalThis.fetch;t.after(()=>globalThis.fetch=previous);
 globalThis.fetch=async url=>({ok:true,json:async()=>url.endsWith('art.json')?art:{pieces:[]}});
 const acquired=[],released=[];
 const loader={acquire:async(src,r)=>{acquired.push(src);const c=new URL(src,'https://test').searchParams.get('rasterCrop').split(',').map(Number);return new Texture({source:new ImageSource({width:Math.ceil(c[4]*r)/r,height:Math.ceil(c[5]*r)/r,resolution:r})});},release:src=>released.push(src),destroy(){}};
 const ground=createGroundPool({acquire:async()=>Texture.EMPTY,release(){}});
 const loaded=await loadThemeArt({id:'snow',art:'/pixi-art/themes/snow/art.json',origin:{x:0,y:0},width:world.width,height:world.height},{groundPool:ground,icelandRasterLoaderFactory:()=>loader,acquire:async()=>Texture.WHITE,release(){}});
 try{
  for(const zoom of [.6,1,1.8])for(const name of ['plaza','rink','bakery','lodge','workshop','harbour']){
   const camera={...world.zones[name],zoom},before=acquired.length;
   const views=loaded.groundStreams.map(stream=>({stream,camera,width:1440,height:900}));
   loaded.rasterPool.update(views,2);await finish([loaded.rasterPool]);
   const stats=loaded.rasterPool.stats();assert.equal(stats.failedTiles,0);assert.equal(stats.missingTiles,0,`${name} ${zoom}`);
   assert(stats.peakBytes<=stats.budgetBytes);assert(stats.budgetBytes<=80*1048576);
   const keys=acquired.slice(before);assert.equal(new Set(keys).size,keys.length,'one acquisition per backing source, never per placement');
   assert(keys.length<=145,`${name} zoom ${zoom}: ${keys.length} acquisitions, including the whole kit warmup`);
   for(const stream of loaded.groundStreams.slice(1))for(const tile of stream.entries){
    if(!tile.render&&tile.render===false||tile.preload||!tileInView(tile,camera,1440,900,1,tile.viewMargin))continue;
    assert(tile.sprite.visible,`${name} ${zoom}: visible piece ready`);
    const density=tile.sprite.texture.source.pixelWidth/tile.width;
    assert(density>=zoom*2,`${name} ${zoom}: ${tile.src} density ${density} < ${zoom*2}`);
   }
  }
 }finally{loaded.destroy();ground.destroy();}
 assert.equal(released.length,acquired.length,'every unique source and pending lease is released exactly once');
});

test('arrival queue paints nearby standing pieces before distant props, decals and the warmup kit',async()=>{
 let clock=0;const frames=[],calls=[],pending=[];
 const pool=createGroundPool({schedule:cb=>frames.push(cb),now:()=>clock,concurrency:1,progressive:false,prefetch:true,frameBudgetMs:5,makeSprite:sprite,
  acquire:(src,r)=>new Promise(resolve=>{calls.push({src,at:clock});pending.push(()=>resolve({source:{pixelWidth:20*r,pixelHeight:20*r}}));}),release(){}});
 const stream=pool.create([
  {src:'far.svg',x:80,y:0,width:20,height:20,priority:2},
  {src:'decal.svg',x:0,y:0,width:20,height:20,priority:0},
  {src:'warm.svg',x:0,y:0,width:20,height:20,priority:-2,preload:true,render:false},
  {src:'near.svg',x:0,y:0,width:20,height:20,priority:2},
 ],{addChild(){}});
 pool.update([{stream,camera:{x:10,y:10,zoom:1},width:200,height:100}],1);
 for(let i=0;i<4;i++){clock=i*16;assert(frames.length);frames.shift()();assert.equal(calls.length,i+1);clock+=8;pending.shift()();await flush();}
 assert.deepEqual(calls.map(c=>c.src.split('?')[0]),['near.svg','far.svg','decal.svg','warm.svg']);
 assert.deepEqual(calls.map(c=>c.at),[0,16,32,48]);
 assert.equal(pool.stats().missingTiles,0);pool.destroy();
});

test('a thousand repeated placements reserve and decode one source, including pending work',async()=>{
 const calls=[],released=[];let resolve;
 const pool=createGroundPool({budget:16384,utilization:1,makeSprite:sprite,concurrency:1024,acquire:src=>{calls.push(src);return new Promise(r=>resolve=r);},release:src=>released.push(src)});
 const stream=pool.create(Array.from({length:1000},()=>({src:'pine.svg',x:0,y:0,width:64,height:64,resolution:1})),{addChild(){}});
 pool.update([{stream,camera:{x:32,y:32,zoom:1},width:1440,height:900}]);
 assert.equal(calls.length,1);assert.equal(pool.stats().reservedBytes,16384);
 resolve({source:{pixelWidth:64,pixelHeight:64}});await finish([pool]);
 assert.equal(pool.stats().residentTiles,1000);assert.equal(pool.stats().reservedBytes,16384);
 pool.destroy();assert.equal(released.length,1);assert.equal(pool.stats().reservedBytes,0);
});

for(const id of ['bakery','final-grove-0-tree-0','bakery-yard-bench-5','lake-warming-hut'])test(`shared ${id} preserves original cropped SVG pixels at 2x density`,async()=>{
 const p=art.props.find(p=>p.id===id),original=readFileSync('public/pixi-art/themes/snow/'+p.src,'utf8');
 const tile=icelandPieceTile(p,p.src,p.anchor),c=[p.width,p.height,0,0,p.width,p.height];
 assert(tileResolution(tile,1.8,2)>=3.6);
 const full=await sharp(Buffer.from(icelandPieceSVG(original,c,2))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const crop=p.tiles.find(t=>t.width===128&&t.height===128)??p.tiles[0];
 const old=readFileSync('public/pixi-art/themes/snow/'+crop.src,'utf8').replace(/(<svg\b[^>]*?)width="[^"]*" height="[^"]*"/,`$1width="${Math.ceil(crop.width*2)}" height="${Math.ceil(crop.height*2)}"`);
 const expected=await sharp(Buffer.from(old)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let error=0,n=0;for(let y=2;y<expected.info.height-2;y++)for(let x=2;x<expected.info.width-2;x++)for(let ch=0;ch<4;ch++){
  error+=Math.abs(expected.data[(y*expected.info.width+x)*4+ch]-full.data[((crop.y*2+y)*full.info.width+crop.x*2+x)*4+ch]);n++;
 }
 assert(error/n<.6,`mean channel error ${error/n}`);
});

test('raster decode queue uses distance after fetch completion and yields between bounded batches',async t=>{
 const {DOMAdapter}=await import('pixi.js');const {createCanvas,Image}=await import('@napi-rs/canvas');
 const {createRasterLoader}=await import('../src/rendering/pixi/art/theme-art-stream.js');
 const old={adapter:DOMAdapter.get(),fetch:globalThis.fetch,location:globalThis.location};
 t.after(()=>{DOMAdapter.set(old.adapter);globalThis.fetch=old.fetch;globalThis.location=old.location;});
 let clock=0,reads=0;const frames=[],waiting=[],started=[];
 DOMAdapter.set({...old.adapter,createCanvas,createImage:()=>{const image=new Image(),decode=image.decode.bind(image);image.decode=()=>new Promise(resolve=>waiting.push(async()=>{await decode();resolve();}));return image;}});
 globalThis.location={href:'https://ducky.test/'};
 globalThis.fetch=async()=>{reads++;return {ok:true,text:async()=>'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>'};};
 const loader=createRasterLoader({concurrency:1,now:()=>clock,schedule:cb=>frames.push(cb),prepareSVG:(svg,c)=>{started.push({id:c[2],at:clock});return svg;}});
 const keys=[0,1,2].map(i=>'/kit.svg?rasterCrop=20,20,'+i+',0,20,20');
 const results=keys.map((key,i)=>loader.acquire(key,1,{visible:i!==0,priority:i===0?-2:2,distance:i===1?100:0}));await flush();
 for(let i=0;i<3;i++){clock=i*16;frames.shift()();assert.equal(started.length,i+1);clock+=8;await flush();await waiting.shift()();await flush();}
 await Promise.all(results);assert.equal(reads,1);assert.deepEqual(started,[{id:2,at:0},{id:1,at:16},{id:0,at:32}]);
 keys.forEach(key=>loader.release(key));await flush();loader.destroy();
});
