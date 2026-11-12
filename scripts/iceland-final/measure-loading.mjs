import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {DOMAdapter,Texture,ImageSource} from 'pixi.js';
import {createCanvas,Image} from '@napi-rs/canvas';
const {loadThemeArt,createGroundPool}=process.env.PERF_BASELINE_MODULE?await import(process.env.PERF_BASELINE_MODULE):{...await import('../../src/pixi/theme-art.js'),...await import('../../src/pixi/ground-stream.js')};
let kitDecodes=0;const previous=DOMAdapter.get();globalThis.location={href:'https://ducky.test/'};
const reads=new Set();globalThis.fetch=async input=>{const url=new URL(input,location.href),file='public'+url.pathname;reads.add(url.pathname);return {ok:fs.existsSync(file),text:async()=>fs.readFileSync(file,'utf8'),json:async()=>JSON.parse(fs.readFileSync(file,'utf8'))};};
DOMAdapter.set({...previous,createCanvas,createImage:()=>{kitDecodes++;return new Image();}});
const schedule=cb=>setTimeout(()=>cb(performance.now()),16),leases=new Map();let acquisitions=0,decodes=0,rasterMs=0;
const acquire=(src,resolution=1)=>{acquisitions++;let held=leases.get(src);if(!held){held={count:0,promise:(async()=>{const text=await (await fetch(src)).text(),image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(text);const at=performance.now();await image.decode();const canvas=createCanvas(Math.ceil(image.width*resolution),Math.ceil(image.height*resolution));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);rasterMs+=performance.now()-at;decodes++;return new Texture({source:new ImageSource({resource:canvas,resolution})});})()};leases.set(src,held);}held.count++;return held.promise;};
const release=src=>{const held=leases.get(src);if(held&&!--held.count){leases.delete(src);held.promise.then(t=>t.destroy(true));}};
globalThis.requestAnimationFrame=schedule;
const pool=createGroundPool({acquire,release,schedule});let art;
const begun=performance.now();
try{
 art=await loadThemeArt({id:'snow',art:'/pixi-art/themes/snow/art.json',origin:{x:0,y:0},width:12000,height:9000},{acquire,release,groundPool:pool});
 const camera={x:2888.36,y:3068.96-90,zoom:.6},views=art.groundStreams.map(stream=>({stream,camera,width:1440,height:900}));
 const update=()=>{pool.update(views,2);art.rasterPool?.update(views,2);};update();let firstMs,nearMs;
 while(performance.now()-begun<30000){await new Promise(r=>setTimeout(r,16));update();const props=art.groundStreams.filter(s=>s.entries[0]?.src.includes('/final/')&&s.entries[0]?.render!==false);
 const visible=props.flatMap(s=>s.entries).filter(t=>t.x<camera.x+1440/(2*camera.zoom)&&t.x+t.width>camera.x-1440/(2*camera.zoom)&&t.y<camera.y+900/(2*camera.zoom)&&t.y+t.height>camera.y-900/(2*camera.zoom));
 if(!firstMs&&visible.every(t=>t.sprite.visible))firstMs=performance.now()-begun;
 const pools=[pool,art.rasterPool].filter(Boolean),stats=pools.map(p=>p.stats());
 if(firstMs&&stats.every(s=>!s.pendingTiles&&!s.missingTiles&&!s.refiningTiles)){nearMs=performance.now()-begun;break;}}
 console.log(JSON.stringify({firstVisibleMs:firstMs,settledMs:nearMs,totalMs:performance.now()-begun,acquisitions:acquisitions+(art.rasterPool?.stats().started??0),decodes:decodes+kitDecodes,uniqueReads:reads.size,rasterMs,visiblePieceSources:new Set(art.groundStreams.flatMap(s=>s.entries).filter(t=>t.src.includes('/final/')&&t.render!==false&&t.x<camera.x+1440/(2*camera.zoom)&&t.x+t.width>camera.x-1440/(2*camera.zoom)&&t.y<camera.y+900/(2*camera.zoom)&&t.y+t.height>camera.y-900/(2*camera.zoom)).map(t=>t.src)).size,pools:[pool.stats(),art.rasterPool?.stats()].filter(Boolean)},null,2));
}finally{art?.destroy();pool.destroy();DOMAdapter.set(previous);}
