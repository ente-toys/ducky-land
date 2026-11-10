import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import sharp from 'sharp';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {Texture,CanvasSource,Sprite} from 'pixi.js';
import {loadThemeArt} from '../src/pixi/theme-art.js';
import {createGroundPool} from '../src/pixi/ground-stream.js';
const base='public/pixi-art/themes/snow/';
const art=JSON.parse(readFileSync(base+'art.json'));
const world=JSON.parse(readFileSync('rive/web/themes/snow/world.json'));
const terrain=readFileSync(base+'v2/terrain.svg','utf8');

test('FIX4 actual theme loader renders complete ice, pine and every rim post before any ground decode',async t=>{
 const before=globalThis.fetch;t.after(()=>globalThis.fetch=before);
 globalThis.fetch=async src=>({ok:true,json:async()=>src.endsWith('art.json')?art:{pieces:[]}});
 let bytes=0;
 const textures=[];
 const acquire=async(src,resolution)=>{
  const file='public'+src;
  const m=await sharp(file).metadata();
  const png=await sharp(file).resize(Math.ceil(m.width*resolution),Math.ceil(m.height*resolution)).png().toBuffer();
  const image=await loadImage(png),canvas=createCanvas(image.width,image.height);
  canvas.getContext('2d').drawImage(image,0,0);
  const texture=new Texture({source:new CanvasSource({resource:canvas,resolution})});textures.push(texture);
  if(!src.includes('/globe/')){bytes+=canvas.width*canvas.height*4;assert.ok(canvas.width<=4096&&canvas.height<=4096,'static texture exceeds 4096: '+src);}
  return texture;
 };
 const pool=createGroundPool({acquire:async()=>{throw Error('terrain must not load in this test');},release(){}});
 const loaded=await loadThemeArt({id:'snow',art:'/pixi-art/themes/snow/art.json',origin:{x:0,y:0},width:world.width,height:world.height},{groundPool:pool,acquire,release(){}});
 t.after(()=>{loaded.destroy();pool.destroy();for(const tex of textures)tex.destroy(true);});
 assert.equal(pool.stats().residentTiles,0);
 assert.ok(bytes<72*1048576,'bounded static rink textures: '+bytes);
 const rink=art.flats.find(p=>p.id==='rink'),pad=180;
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
 // Sample ALL four quadrants and the full rounded silhouette, not a single good tile.
 const r=world.iceland2.rink;
 for(let y=r.y+12;y<r.y+r.height-10;y+=17)for(let x=r.x+12;x<r.x+r.width-10;x+=17){
  const qx=Math.abs(x-r.x-r.width/2)-(r.width/2-r.radius),qy=Math.abs(y-r.y-r.height/2)-(r.height/2-r.radius);
  const d=Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-r.radius;
  if(d<-12){const p=pixel(x,y);assert.ok(p[3]>240&&p[0]<250&&p[2]>220,'missing ice at '+x+','+y);}
 }
 for(const p of loaded.props.toSorted((a,b)=>a.y-b.y))if(p.preload)draw(p.sprite);
 for(const [x,y]of r.posts){const p=pixel(x,y-35);assert.ok(p[0]>170&&p[1]>110&&p[2]<170,'missing fence post at '+x+','+y);}
 const pine=loaded.props.find(p=>p.id==='decorated-pine');
 const pineFrame=ctx.getImageData(Math.round(pine.x-110-x0),Math.round(pine.y-330-y0),220,330).data;
 let green=0;for(let i=0;i<pineFrame.length;i+=4)if(pineFrame[i+1]>pineFrame[i]*1.12&&pineFrame[i+1]>pineFrame[i+2]*1.12)green++;
 assert.ok(green>1000,'decorated pine absent');
 for(const [dx,dy]of [[.5,.08],[.1,.5],[.9,.5],[.5,.92]])assert.ok(blue(pixel(r.x+r.width*dx,r.y+r.height*dy)),'ice quadrant missing');
 assert.ok(!blue(pixel(r.x+8,r.y+8)),'rounded corner became square');
 assert.equal(loaded.props.filter(p=>p.preload&&p.id.startsWith('rink-home-bench')).length,4);
 assert.equal(Object.keys(world.iceland2.gates).length,3);
 if(process.env.FIX4_PROOF_DIR)writeFileSync(process.env.FIX4_PROOF_DIR+'/rink-loaded.png',canvas.toBuffer('image/png'));
});

test('FIX4 snow stays sparse without a repeating pattern and courts are nearly snow coloured',()=>{
 assert.ok(!terrain.includes('<pattern'));
 const n=(terrain.match(/data-snow-detail=/g)??[]).length;
 assert.ok(n>200&&n<600,n+' snow marks');
 assert.ok(terrain.includes('scale(0.48)'));assert.ok(terrain.includes('scale(0.75)'));
 assert.equal((terrain.match(/data-door-court=/g)??[]).length,14);
 assert.ok(!terrain.includes('#eee7f5'));assert.ok(terrain.includes('fill="#f8f6fb" stroke="#e7e3ed" stroke-width="2"'));
});

test('FIX4 tree crowns leave the snowman scene and whole yard approach clear',()=>{
 const s=world.iceland2.traceScale,region={x0:600+160*s,y0:600+880*s,x1:600+355*s,y1:600+951*s};
 const route=world.iceland2.routes.find(r=>r.id==='yard');
 for(const p of art.props.filter(p=>/grove|bush/.test(p.id))){
  const left=p.x-p.width/2,right=p.x+p.width/2,top=p.y-p.height,bottom=p.y;
  assert.ok(!(left<region.x1&&right>region.x0&&top<region.y1&&bottom>region.y0),p.id+' covers snowmen');
  for(const [x,y]of route.samples)assert.ok(!(left<x+85&&right>x-85&&top<y+85&&bottom>y-85),p.id+' covers approach');
 }
 const snowmen=art.props.filter(p=>/^snowman-\d$/.test(p.id));assert.equal(snowmen.length,3);
 assert.ok(Math.max(...snowmen.map(p=>p.x))-Math.min(...snowmen.map(p=>p.x))<300,'snowmen must read as one scene');
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
