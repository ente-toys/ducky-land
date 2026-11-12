import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import sharp from 'sharp';
import {onRink} from '../src/pixi/rink-slide.js';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {Texture,CanvasSource,Sprite} from 'pixi.js';
import {loadThemeArt} from '../src/pixi/theme-art.js';
import {icelandPieceSVG} from '../src/pixi/iceland-art-stream.js';
import {createGroundPool} from '../src/pixi/ground-stream.js';
const base='public/pixi-art/themes/snow/';
const art=JSON.parse(readFileSync(base+'art.json'));
const world=JSON.parse(readFileSync('assets/world/themes/snow/world.json'));
const terrain=readFileSync(base+'v2/terrain.svg','utf8');

test('FIX4 actual theme loader renders complete lake and heart before terrain decode, with streamed shore props',async t=>{
 const before=globalThis.fetch;t.after(()=>globalThis.fetch=before);
 globalThis.fetch=async src=>({ok:true,json:async()=>src.endsWith('art.json')?art:{pieces:[]}});
 let bytes=0;
 const textures=[],acquired=[];
 const acquire=async(src,resolution)=>{
  acquired.push(src);
  const url=new URL(src,'https://test'),crop=url.searchParams.get('rasterCrop')?.split(',').map(Number),file='public'+url.pathname;
  const input=crop?Buffer.from(icelandPieceSVG(readFileSync(file,'utf8'),crop,resolution)):file;
  const m=await sharp(input).metadata();
  const png=crop?await sharp(input).png().toBuffer():await sharp(file).resize(Math.ceil(m.width*resolution),Math.ceil(m.height*resolution)).png().toBuffer();
  const image=await loadImage(png),canvas=createCanvas(image.width,image.height);
  canvas.getContext('2d').drawImage(image,0,0);
  const texture=new Texture({source:new CanvasSource({resource:canvas,resolution})});textures.push(texture);
  if(!src.includes('/globe/')){bytes+=canvas.width*canvas.height*4;assert.ok(canvas.width<=4096&&canvas.height<=4096,'static texture exceeds 4096: '+src);}
  return texture;
 };
 const pool=createGroundPool({acquire:async()=>{throw Error('terrain must not load in this test');},release(){}});
 const loaded=await loadThemeArt({id:'snow',art:'/pixi-art/themes/snow/art.json',origin:{x:0,y:0},width:world.width,height:world.height},{groundPool:pool,acquire,release(){},icelandRasterLoaderFactory:()=>({acquire,release(){},destroy(){}})});
 t.after(()=>{loaded.destroy();pool.destroy();for(const tex of textures)tex.destroy(true);});
 assert.equal(pool.stats().residentTiles,0);
 assert.ok(!acquired.some(src=>src.includes('/final/rink/')),'entering Iceland never blocks on an offscreen lake decode');
 const rink=art.flats.find(p=>p.id==='rink'),pad=180;
 const stream=loaded.groundStreams.find(s=>s.entries[0]?.src.includes(rink.src+'?'));assert(stream);
 loaded.rasterPool.update([{stream,camera:{x:rink.x,y:rink.y-rink.height/2,zoom:1},width:1440,height:900}],2);
 for(let i=0;i<1000&&loaded.rasterPool.stats().pendingTiles;i++)await new Promise(r=>setTimeout(r,1));
 assert.equal(loaded.rasterPool.stats().missingTiles,0);assert.equal(pool.stats().started,0,'lake paints while terrain decode has not begun');
 assert.ok(bytes<72*1048576,'bounded shared lake texture: '+bytes);
 const x0=Math.floor(rink.x-pad),y0=Math.floor(rink.y-150),canvas=createCanvas(Math.ceil(rink.width+pad*2),Math.ceil(rink.height+420)),ctx=canvas.getContext('2d');
 const draw=s=>{
  if(s instanceof Sprite){
   const m=s.getGlobalTransform();ctx.setTransform(m.a,m.b,m.c,m.d,m.tx-x0,m.ty-y0);
   const tex=s.texture;if(tex.source.resource)ctx.drawImage(tex.source.resource,-s.anchor.x*tex.width,-s.anchor.y*tex.height,tex.width,tex.height);
  }
  for(const c of s.children??[])draw(c);
 };
 draw(loaded.ground);

 const pixel=(x,y)=>ctx.getImageData(Math.round(x-x0),Math.round(y-y0),1,1).data;
 const blue=p=>Math.abs(p[0]-166)<8&&Math.abs(p[1]-222)<8&&Math.abs(p[2]-236)<8;
 // Every interior sample is painted before any streamed terrain arrives.
 const r=world.iceland2.rink;
 for(let y=r.y+12;y<r.y+r.height-10;y+=17)for(let x=r.x+12;x<r.x+r.width-10;x+=17){
  if(onRink(r,x,y)){const p=pixel(x,y);assert.ok(p[3]>240&&p[2]>220,'missing lake at '+x+','+y);}
 }
 assert.ok(loaded.props.some(p=>p.id==='lake-warming-hut'));
 assert.ok(!loaded.props.some(p=>p.id==='decorated-pine'||/^rink-fence/.test(p.id)));
 assert.ok(blue(pixel(...r.heart)),'heart interior stays open ice');
 assert.ok(!blue(pixel(r.x+8,r.y+8)),'irregular bank became square');
 assert.equal(loaded.props.filter(p=>p.scene==='rink-scene'&&p.finalRole==='bench-skates').length,1);for(const p of loaded.props.filter(p=>p.scene==='rink-scene'))assert.ok(p.tiles?.length,p.id+' streams sharply');
 assert.equal(Object.keys(world.iceland2.shores).length,3);
 if(process.env.FIX4_PROOF_DIR)writeFileSync(process.env.FIX4_PROOF_DIR+'/rink-loaded.png',canvas.toBuffer('image/png'));
});

test('FIX4 grouped snow detail has no repeating pattern and courts are nearly snow coloured',()=>{
 assert.ok(!terrain.includes('<pattern'));
 const n=art.flats.filter(p=>p.finalKind==='ground-detail').length;
 assert.ok(n<650,n+' grouped snow marks and continuous trail chunks');
 assert.ok(art.icelandFinal.ground.clusters.filter(c=>c.role!=='trail').length<300);
 assert.ok(!terrain.includes('data-ground-cluster='),'Q2 ground detail must stream as sharp individual SVG crops');
 assert.equal(n,art.icelandFinal.ground.clusters.length);for(const c of art.icelandFinal.ground.clusters)assert.ok(c.motifCount>=2,c.id);
 assert.equal((terrain.match(/data-door-court=/g)??[]).length,14);
 assert.ok(!terrain.includes('#eee7f5'));assert.ok(terrain.includes('fill="#f8f6fb" stroke="#e7e3ed" stroke-width="2"'));
});

test('FIX4 tree crowns leave the snowman scene and whole yard approach clear',()=>{
 const clearing=art.flats.find(p=>p.id==='snowman-clearing'),region={x0:clearing.x-clearing.width/2,y0:clearing.y-clearing.height,x1:clearing.x+clearing.width/2,y1:clearing.y};
 const route=world.iceland2.routes.find(r=>r.id==='yard');
 for(const p of art.props.filter(p=>/grove|bush/.test(p.id)&&p.scene!=='snowman-scene')){
  const left=p.x-p.width/2,right=p.x+p.width/2,top=p.y-p.height,bottom=p.y;
  assert.ok(!(left<region.x1&&right>region.x0&&top<region.y1&&bottom>region.y0),p.id+' covers snowmen');
  for(const [x,y]of route.samples)assert.ok(!(left<x+85&&right>x-85&&top<y+85&&bottom>y-85),p.id+' covers approach');
 }
 const snowmen=art.props.filter(p=>p.scene==='snowman-scene'&&p.buildStage);assert.equal(snowmen.length,3);
 assert.ok(Math.max(...snowmen.map(p=>p.x))-Math.min(...snowmen.map(p=>p.x))<600,'snowmen must read as one scene');
});

test('FIX4 sparse ground crops retain the master pixels at detail clusters and courts',async()=>{
 for(const [x,y]of [[2048,2304],[7680,2304],[2816,3072]]){
  const tile=art.ground.tiles.find(t=>t.x===x&&t.y===y);assert.ok(tile);
  const master=terrain.replace(/width="[^\"]+" height="[^\"]+" viewBox="[^\"]+"/,`width="256" height="256" viewBox="${x} ${y} 256 256"`);
  const a=await sharp(Buffer.from(master)).ensureAlpha().raw().toBuffer();
  const b=await sharp(base+tile.src).ensureAlpha().raw().toBuffer();
  assert.equal(a.length,b.length);let diff=0;for(let i=0;i<a.length;i++)diff+=Math.abs(a[i]-b[i]);assert.ok(diff/a.length<.1,'ground detail cropped incorrectly at '+x+','+y);
 }
});
