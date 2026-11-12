import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Container,DOMAdapter,ImageSource,Texture} from 'pixi.js';
import {createGroundPool,tileInView} from '../src/rendering/pixi/art/ground-stream.js';
import {loadThemeArt} from '../src/rendering/pixi/art/theme-art.js';
import {mapFor} from '../src/world/island-maps.js';
import {rasterTiles,cropSVG} from '../src/rendering/pixi/art/theme-raster.js';
import {liveSurfaceGeometry} from '../src/rendering/three/three-live-geometry.js';
import {WORLD_ISLANDS,WORLD_GEO} from '../src/world/world-map.js';
import sharp from 'sharp';
const flush=()=>new Promise(setImmediate);
const sprite=()=>({position:{set(){}},scale:{x:1},destroy(){}});
const container={addChild(){}};
const centre={x:4100,y:2800,zoom:1.8};
const manifest=JSON.parse(readFileSync('public/pixi-art/themes/cathedral/art.json'));
const ids=['cloister-olive-well','centre-A-fountain'];
DOMAdapter.set({...DOMAdapter.get(),createCanvas:()=>({getContext:()=>null})});

test('production Bellovo static centre view loads and draws the olive fountain centrepiece',async t=>{
 const old=globalThis.fetch;t.after(()=>globalThis.fetch=old);
 globalThis.fetch=async url=>({ok:true,json:async()=>JSON.parse(readFileSync('public'+url))});
 assert.equal(manifest.raster.enabled,false);
 const textures=new Map(),released=[];
 const groundPool=createGroundPool({acquire:async()=>Texture.EMPTY,release(){}});
 const objects=new Container({sortableChildren:true});
 let art;
 try{
  art=await loadThemeArt(mapFor('cathedral'),{groundPool,acquire:async src=>{
   const texture=new Texture({source:new ImageSource({width:16,height:16})});
   textures.set(src,texture);return texture;
  },release:src=>{released.push(src);textures.get(src)?.destroy(true);},
  rasterLoaderFactory:()=>{throw Error('Bellovo must use static prop textures');}});
  assert.equal(art.rasterPool,null);
  for(const p of art.props){objects.addChild(p.sprite);p.sprite.visible=tileInView({x:p.x-p.width*(p.anchor?.x??.5),y:p.y-p.height*(p.anchor?.y??1),width:p.width,height:p.height},centre,1400,1000,1,0);}
  for(const id of ids){
   const p=art.props.find(p=>p.id===id);assert(p&&p.sprite.visible,id+' in actual visible prop set');
   assert.equal(p.sprite.themeArt,'cathedral');assert.equal(p.sprite.parent,objects,'standing layer, above piazza ground');
   assert.equal(p.sprite.texture,textures.get('/pixi-art/themes/cathedral/'+p.src),id+' uses acquired static art');
   assert.notEqual(p.sprite.texture,Texture.EMPTY);assert.equal(p.sprite.texture.destroyed,false);
   assert.equal(p.sprite.renderable,true);assert.equal(p.sprite.alpha,1);
   assert.equal(p.sprite.width,p.width*(p.scale??1));assert.equal(p.sprite.height,p.height*(p.scale??1));
   assert(!art.groundStreams.some(s=>s.entries.some(t=>t.src.includes(p.src))),id+' needs no raster crop stream');
  }
  const olive=art.props.find(p=>p.id===ids[0]);
  assert.deepEqual([olive.sprite.x+olive.trunk[0]-olive.sprite.anchor.x*olive.sprite.width,olive.sprite.y+olive.trunk[1]-olive.sprite.anchor.y*olive.sprite.height],[4100,2700]);
  assert.equal(olive.src,'centre-A/olive.svg');
  const fountain=art.props.find(p=>p.id==='centre-A-fountain');
  assert.equal(fountain.src,'centre-A/fountain.svg');
  assert.deepEqual([fountain.sprite.x,fountain.sprite.y],[4100,2720]);
  assert(olive.sprite.zIndex>fountain.sprite.zIndex,'olive drawn above its fountain island');
  assert(art.fountainWaters.some(f=>f.x===4100&&f.y===2720),'centre fountain water created');
  assert.equal(olive.shadow,null,'SVG supplies the single olive shadow');
  assert.equal((readFileSync('public/pixi-art/themes/cathedral/'+olive.src,'utf8').match(/data-contact-shadow/g)??[]).length,1);
 }finally{art?.destroy();groundPool.destroy();objects.destroy();}
 assert.equal(released.length,textures.size);assert.equal(new Set(released).size,textures.size);
 assert([...textures.values()].every(t=>t.destroyed),'all static artwork released');
});

test('actual olive and fountain SVG crops decode to painted pixels',async()=>{
 for(const id of ids){
   const p=manifest.props.find(p=>p.id===id);assert(p,id+' exists in current manifest');
   const source=readFileSync('public/pixi-art/themes/cathedral/'+p.src,'utf8');let painted=0;
   for(const tile of rasterTiles(p,'/pixi-art/themes/cathedral/'+p.src,p.anchor)){
     const crop=new URL(tile.src,'http://test').searchParams.get('rasterCrop').split(',').map(Number);
     const {data}=await sharp(Buffer.from(cropSVG(source,crop,3.8125))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
     for(let i=3;i<data.length;i+=4)if(data[i])painted++;
   }
   assert(painted>10000,p.id+' vector decode is nonempty');
 }
});

test('budget pressure during zoom never evicts an in-view crop before its replacement is ready',async()=>{
 const finishes=[];let released=0;
 const pool=createGroundPool({budget:200000,utilization:1,concurrency:2,makeSprite:sprite,
   acquire:(src,r)=>new Promise(resolve=>finishes.push(()=>resolve({source:{pixelWidth:100*r,pixelHeight:100*r}}))),release(){released++;}});
 const stream=pool.create([0,100,200].map(x=>({x,y:0,width:100,height:100,src:'/prop-'+x,screenResolution:true,resolution:4})),container);
 const views=zoom=>[{stream,camera:{x:150,y:50,zoom},width:300,height:100}];
 const drain=async()=>{for(let i=0;i<50&&finishes.length;i++){finishes.splice(0).forEach(f=>f());await flush();}};
 pool.update(views(1));await drain();assert(stream.entries.every(t=>t.sprite.visible));
 pool.update(views(1.25));
 assert(stream.entries.every(t=>t.sprite.visible),'old code drops in-view crops to pay for two replacements');
 while(finishes.length){finishes.shift()();await flush();assert(stream.entries.every(t=>t.sprite.visible),'no holes during individual completions');}
 for(const zoom of [.6,1.7,.8,1.2]){pool.update(views(zoom));assert(stream.entries.every(t=>t.sprite.visible));await drain();assert(stream.entries.every(t=>t.sprite.visible));assert(pool.stats().reservedBytes<=200000);}
 assert.equal(pool.stats().missingTiles,0);pool.destroy();assert(released>0);
});

test('frame time budget starts several decodes and retains crops through zoom settling',async()=>{
 const frames=[],requests=[];let time=0,cost=0;
 const pool=createGroundPool({makeSprite:sprite,schedule:cb=>frames.push(cb),now:()=>time+cost,
 acquire:async(src,r)=>{requests.push(r);cost+=1;return {source:{pixelWidth:64*r,pixelHeight:64*r}};},release(){}});
 const stream=pool.create(Array.from({length:12},(_,i)=>({src:'/p'+i,x:i*64,y:0,width:64,height:64,screenResolution:true,resolution:4})),container);
 const views=zoom=>[{stream,camera:{x:384,y:32,zoom},width:1600,height:1000}];
 const frame=async()=>{cost=0;const before=requests.length;frames.splice(0).forEach(f=>f());await flush();assert(requests.length-before<=5,'5ms submission budget');};
 pool.update(views(1));await frame();assert.equal(requests.length,5,'several decodes without idle');
 for(let i=0;i<8;i++)await frame();
 assert(stream.entries.every(t=>t.sprite.visible));const base=requests.length;
 time=16;pool.update(views(1.2));await frame();assert.equal(requests.length,base);
 time=112;pool.update(views(1.2));await frame();assert.equal(requests.length,base);
 time=128;pool.update(views(1.2));await frame();assert(requests.length>base);assert.equal(requests.at(-1),1.25);
 assert(stream.entries.every(t=>t.sprite.visible));pool.destroy();
});

test('live surface mesh has valid vertices and triangles at every island and rejects invalid viewport bounds',()=>{
 for(const frame of WORLD_ISLANDS){
   const geometry=liveSurfaceGeometry(frame,{x:1,y:-9,width:1000,height:700},frame.width,frame.height,WORLD_GEO.Rw);
   assert(geometry);
   const {position,uv}=geometry.attributes;
   assert(position.array.every(Number.isFinite));
   assert.equal(uv.count,position.count);
   assert(uv.array.every(Number.isFinite));
   assert(geometry.indices.length>0 && geometry.indices.length%3===0);
   assert(geometry.indices.every(index=>index<position.count));
   geometry.dispose();
   for(const bounds of [{x:NaN,y:0,width:10,height:10},{x:0,y:0,width:Infinity,height:10},{x:0,y:0,width:0,height:10}])assert.equal(liveSurfaceGeometry(frame,bounds,frame.width,frame.height,WORLD_GEO.Rw),null);
 }
});

test('browser raster path uses frame budget instead of idle, temporary blob URLs, and closes the bitmap on release',async t=>{
 const {DOMAdapter}=await import('pixi.js');
 const {createRasterLoader}=await import('../src/rendering/pixi/art/theme-art-stream.js');
 const adapter=DOMAdapter.get(),originals=Object.fromEntries(['fetch','location','createImageBitmap','requestIdleCallback'].map(k=>[k,globalThis[k]]));
 t.after(()=>{DOMAdapter.set(adapter);Object.assign(globalThis,originals);});
 let idle,decode=0,closed=0,canvas=0,objectURL;const frames=[];
 const image={set src(value){if(value)objectURL=value;},async decode(){decode++;}};
 DOMAdapter.set({...adapter,createImage:()=>image,createCanvas(){canvas++;throw Error('canvas work ran on bitmap path');}});
 globalThis.location={href:'https://test/'};
 globalThis.fetch=async()=>({ok:true,text:async()=>'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="green"/></svg>'});
 globalThis.requestIdleCallback=cb=>idle=cb;
 globalThis.createImageBitmap=async()=>({width:80,height:80,close(){closed++;}});
 const loader=createRasterLoader({schedule:cb=>frames.push(cb)}),key='/tree.svg?rasterCrop=20,20,0,0,20,20&groundScale=4';
 const texturePromise=loader.acquire(key,4);await flush();assert.equal(decode,0,'work queued for the next frame');assert.equal(idle,undefined);frames.shift()();
 const texture=await texturePromise;assert.match(objectURL,/^blob:/);assert.equal(canvas,0);assert.equal(texture.source.pixelWidth,80);
 await assert.rejects(originals.fetch(objectURL),'temporary URL revoked after decode');
 loader.release(key);await flush();assert.equal(closed,1);loader.destroy();
});

test('walking streams new crops in the overscan before they enter the screen, with no visible prop gaps',async()=>{
 let time=0;const frames=[];
 const pool=createGroundPool({schedule:cb=>frames.push(cb),now:()=>time,makeSprite:sprite,
 acquire:async(src,r)=>({source:{pixelWidth:64*r,pixelHeight:64*r}}),release(){}});
 const stream=pool.create(Array.from({length:40},(_,i)=>({src:'/walking-prop-'+i,x:i*64,y:0,width:64,height:64,screenResolution:true,resolution:4,viewMargin:64})),container);
 const view=x=>[{stream,camera:{x,y:32,zoom:1},width:320,height:100}];
 pool.update(view(300));
 for(let i=0;i<20;i++){frames.splice(0).forEach(f=>f());await flush();}
 for(let i=1;i<=90;i++){
   time+=16;const views=view(300+i*4);pool.update(views);frames.splice(0).forEach(f=>f());await flush();
   const visible=stream.entries.filter(t=>tileInView(t,views[0].camera,320,100,1,0));
   assert(visible.every(t=>t.sprite.visible),'no visible gap at walking frame '+i);
 }
 pool.destroy();
});

test('settling between planning ticks still upgrades a stationary viewport',async()=>{
 const frames=[],requests=[];let time=0;
 const pool=createGroundPool({makeSprite:sprite,schedule:cb=>frames.push(cb),now:()=>time,settleMs:100,planInterval:80,
 acquire:async(src,r)=>{requests.push(r);return {source:{pixelWidth:64*r,pixelHeight:64*r}};},release(){}});
 const stream=pool.create([{src:'/settle',x:0,y:0,width:64,height:64,screenResolution:true,resolution:4}],container);
 const views=z=>[{stream,camera:{x:32,y:32,zoom:z},width:100,height:100}];
 pool.update(views(1));frames.splice(0).forEach(f=>f());await flush();
 for(time=16;time<=192;time+=16){pool.update(views(1.2));frames.splice(0).forEach(f=>f());await flush();}
 assert.deepEqual(requests,[.5,1,1.25]);assert(stream.entries[0].sprite.visible);pool.destroy();
});
