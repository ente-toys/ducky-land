#!/usr/bin/env node
// Fast headless check of the globe: frame times on Home and on the full globe, six globe views, ghost islands off the sphere.
// Usage: node scripts/verify-sphere.mjs [url] [--out dir] [--frames 240]
//   url defaults to http://boss.localhost:8890 (logs in via /__test/login?account=boss)
//   PLAYWRIGHT_MODULE overrides where Playwright is loaded from (it is not in this repo's node_modules).
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {midZoomQuality} from './sphere-quality.mjs';
import {mapPoint} from '../src/pixi/sphere-coordinates.js';
import {mapOf} from '../src/pixi/island-maps.js';

const RUNTIME='/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? `${RUNTIME}/playwright/index.mjs`);
const {PNG}=createRequire(`${RUNTIME}/`)('pngjs');

const args=process.argv.slice(2), opt=(n,d)=>{const i=args.indexOf(n);return i>=0?args.splice(i,2)[1]:d;};
const OUT=path.resolve(opt('--out','/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/world-map/sphere'));
const FRAMES=Number(opt('--frames',240));
const BASE=(args[0]||'http://boss.localhost:8890').replace(/\/$/,'');
const W=1440,H=900,CX=W/2,CY=H/2;
fs.mkdirSync(OUT,{recursive:true});
const t0=Date.now(), sleep=ms=>new Promise(r=>setTimeout(r,ms));

let browser;
try {
browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:W,height:H}});
const errors=[]; page.on('pageerror',e=>errors.push(String(e.message).slice(0,200)));

async function frameStats(n=FRAMES){
  return page.evaluate(n=>new Promise(res=>{const d=[];let last=performance.now();
    const step=t=>{d.push(t-last);last=t;if(d.length<n)requestAnimationFrame(step);else{d.sort((a,b)=>a-b);const q=p=>+d[Math.min(d.length-1,Math.floor(p*d.length))].toFixed(2);res({frames:n,medianMs:q(.5),p95Ms:q(.95),maxMs:+d[d.length-1].toFixed(2),fpsMedian:+(1000/q(.5)).toFixed(1)});}};
    requestAnimationFrame(t=>{last=t;requestAnimationFrame(step);});}),n);
}
// drag across the middle of the globe; hold still before release so the globe does not keep flicking
async function drag(dx,dy,steps=3){
  for(let i=0;i<steps;i++){
    await page.mouse.move(CX-dx/2,CY-dy/2);await page.mouse.down();
    for(let k=1;k<=12;k++){await page.mouse.move(CX-dx/2+dx*k/12,CY-dy/2+dy*k/12);await sleep(16);}
    await sleep(140);await page.mouse.up();await sleep(60);
  }
  await page.mouse.move(5,5);await page.evaluate(()=>{globalThis.__duckyEngine.quietAt=Infinity;});await sleep(700);
}
// screenshot of the canvas only (DOM HUD hidden for the shot), plus the off-sphere ghost count
async function shot(name){
  await page.addStyleTag({content:'body *{visibility:hidden!important}canvas{visibility:visible!important;outline:none!important;box-shadow:none!important}'}).then(h=>h.evaluate(e=>e.id='__vs_hide'));
  const buf=await page.screenshot();
  await page.evaluate(()=>document.getElementById('__vs_hide')?.remove());
  const file=path.join(OUT,`verify-${name}.png`);fs.writeFileSync(file,buf);
  return {view:name,file,...ghosts(PNG.sync.read(buf))};
}
function ghosts(png){
  const {width:w,height:h,data}=png,px=i=>[data[i],data[i+1],data[i+2]];
  const blue=(r,g,b)=>b>110&&b>r+35&&b>=g-10;   // the sea-blue disc
  const xs=[],ys=[];
  for(let y=0;y<h;y+=2)for(let x=0;x<w;x+=2){const[r,g,b]=px((y*w+x)*4);if(blue(r,g,b)){xs.push(x);ys.push(y);}}
  if(xs.length<500)return {sphere:null,offSpherePixels:null,offSphereClustered:null,note:'no blue disc found'};
  xs.sort((a,b)=>a-b);ys.sort((a,b)=>a-b);const pc=(a,p)=>a[Math.floor(p*(a.length-1))];
  const x0=pc(xs,.002),x1=pc(xs,.998),y0=pc(ys,.002),y1=pc(ys,.998);
  const cx=(x0+x1)/2,cy=(y0+y1)/2,r=Math.max(x1-x0,y1-y0)/2,rr=(r*1.1+4)**2;   // skip the disc and its glow halo;
  // sky colour = median of the pixels well outside the disc; ghosts are faint patches that differ from it (stars are bright specks)
  const sky=[[],[],[]];for(let y=8;y<h-8;y+=3)for(let x=8;x<w-8;x+=3){if((x-cx)**2+(y-cy)**2<=rr)continue;const p=px((y*w+x)*4);for(let c=0;c<3;c++)sky[c].push(p[c]);}
  const S=sky.map(a=>a.sort((p,q)=>p-q)[a.length>>1]);
  const off=new Uint8Array(w*h);let count=0;
  for(let y=6;y<h-6;y++)for(let x=6;x<w-6;x++){if((x-cx)**2+(y-cy)**2<=rr)continue;const[R,G,B]=px((y*w+x)*4);if(Math.abs(R-S[0])+Math.abs(G-S[1])+Math.abs(B-S[2])>18){off[y*w+x]=1;count++;}}
  let clustered=0;   // stars are single specks; a ghost island is a solid patch (>=12 of its 5x5 neighbours also off-sphere)
  for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){if(!off[y*w+x])continue;let n=0;for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++)n+=off[(y+j)*w+x+i];if(n>=12)clustered++;}
  return {sphere:{cx:Math.round(cx),cy:Math.round(cy),r:Math.round(r)},sky:S,offSpherePixels:count,offSphereClustered:clustered,offSpherePct:+(100*clustered/(w*h-Math.PI*rr)).toFixed(2)};
}

await page.goto(`${BASE}/__test/login?account=boss`,{waitUntil:'domcontentloaded'});
if(!page.url().startsWith(BASE))await page.goto(BASE,{waitUntil:'domcontentloaded'});
await page.goto(`${BASE}/?qa=1`,{waitUntil:'domcontentloaded'});
await page.waitForSelector('canvas',{timeout:60000});
await page.waitForFunction(()=>globalThis.__duckyEngine?.ready,null,{timeout:60000});
await page.waitForLoadState('networkidle',{timeout:30000}).catch(()=>{});
await sleep(2500);
const gpu=await page.evaluate(()=>{try{const g=document.createElement('canvas').getContext('webgl');const e=g.getExtension('WEBGL_debug_renderer_info');return g.getParameter(e?e.UNMASKED_RENDERER_WEBGL:g.RENDERER);}catch{return null;}});
const loadMs=Date.now()-t0;
await page.evaluate(()=>{globalThis.__duckyEngine.quietAt=Infinity;});
const home=await frameStats();
const homeShot=await shot('home');

await page.mouse.move(CX,CY);
for(let i=0;i<45;i++){await page.mouse.wheel(0,400);await sleep(40);}
await page.mouse.move(5,5);await page.evaluate(()=>{globalThis.__duckyEngine.quietAt=Infinity;});await sleep(2500);
const globe=await frameStats();

const midZoom=[];
const images=new Map();
for(const theme of ['home','sunflower','pink','library','community','fair','neon','cathedral','canal','waterfall','goldmine','bog','snow'])images.set(theme,PNG.sync.read(fs.readFileSync(new URL(`../public/pixi-art/globe/${theme}.png`,import.meta.url))));
const bog=mapOf('isle-249'),focus=mapPoint('isle-249','home',{x:bog.cx,y:bog.cy});
await page.evaluate(focus=>{const e=globalThis.__duckyEngine;e.follow=false;e.spin=null;e.fly=null;Object.assign(e.camera,focus,{zoom:e.birdZoom()});Object.assign(e.target,e.camera);},focus);
// Reproduce the boss's middle zoom with real wheel events, centred on Bog.
for(let k=0;k<2;k++){await page.mouse.move(CX,CY);await page.mouse.wheel(0,-150);await sleep(650);}
await page.evaluate(()=>{globalThis.__duckyEngine.quietAt=Infinity;});await sleep(400);
const midState=await page.evaluate(()=>{const e=globalThis.__duckyEngine;return {camera:{x:e.camera.x,y:e.camera.y,zoom:e.camera.zoom,basis:e.camera.basis},islandId:e.islandId,ball:e.worldView.debug.ball,render:e.worldView.debug,stickers:e.worldView.stickers};});
const midShot=await shot('mid-zoom-bog'),midPNG=PNG.sync.read(fs.readFileSync(midShot.file));
midZoom.push({shot:midShot.file,...midState,...midZoomQuality(midPNG,midState,images),frames:await frameStats()});
// Restore the full globe for the six off-sphere ghost checks.
for(let k=0;k<5;k++){await page.mouse.move(CX,CY);await page.mouse.wheel(0,400);await sleep(50);}
await sleep(1800);await page.evaluate(()=>{globalThis.__duckyEngine.quietAt=Infinity;});
const views=[];
views.push(await shot('front'));
const R=views[0].sphere?.r||300, q=R*Math.PI/2/3;   // three drags of a third of a quarter turn each
await drag(q,0);views.push(await shot('left'));
await drag(q,0);views.push(await shot('back'));
await drag(q,0);views.push(await shot('right'));
await drag(q,0);
await drag(0,q);views.push(await shot('top'));
await drag(0,-q,6);views.push(await shot('bottom'));
await browser.close();

const result={status:'verified',url:BASE,gpu,loadMs,home:{...home,shot:homeShot.file},globe,midZoom,
  views:views.map(({view,file,sphere,offSpherePixels,offSphereClustered,offSpherePct,note})=>({view,file,sphere,offSpherePixels,offSphereClustered,offSpherePct,...(note?{note}:{})})),
  ghostIslandsSuspected:views.some(v=>v.offSphereClustered==null||v.offSphereClustered>200),pageErrors:errors.slice(0,5),totalMs:Date.now()-t0};
result.passed=!result.ghostIslandsSuspected&&home.p95Ms<12&&globe.p95Ms<12&&!errors.length&&midZoom.every(m=>m.opacityPassed&&m.blurPassed);
fs.writeFileSync(path.join(OUT,'verify.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
if(!result.passed)process.exitCode=1;
} catch(error) {
 await browser?.close().catch(()=>{});
 const message=String(error.message??error);
 const reason=message.split('\n').filter(line=>/browserType\.launch:|Target page|FATAL:|Permission denied/.test(line)).slice(0,3).join('\n')||message.slice(0,800);
 const result={status:'blocked',url:BASE,passed:false,reason,ghostIslandsSuspected:null,home:null,globe:null,midZoom:[],views:[],totalMs:Date.now()-t0};
 fs.writeFileSync(path.join(OUT,'verify.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));process.exitCode=1;
}
