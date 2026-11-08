#!/usr/bin/env node
// Zoom sweep from Home out to the globe, with a shear number per visible island at each step.
// Usage: node scripts/rigid-sweep.mjs <url> --out <dir> [--tag before|after]
// Shear = |angle between the island's drawn east and north axes - 90 deg|, ratio = |east|/|north| (1 = no squash).
// "after": the island matrices the page actually draws with (globalThis.__duckyRigid). Otherwise: the true sphere
// chart the old pipeline drew each island through, differentiated at the island centre.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {WORLD_ISLANDS,WORLD_GEO} from '../src/pixi/world-map.js';
import {mapOf} from '../src/pixi/island-maps.js';
import {spherePoint,localPoint} from '../src/pixi/sphere-coordinates.js';
import {pixelChart,horizonRatio} from '../src/pixi/sphere-projection.js';
import {dot} from '../src/pixi/sphere.js';
import {viewFrame} from '../src/pixi/sphere-coordinates.js';
import {ISLETS} from '../src/pixi/islets.js';
import {expMap} from '../src/pixi/sphere.js';

const RUNTIME='/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? `${RUNTIME}/playwright/index.mjs`);
const args=process.argv.slice(2),opt=(n,d)=>{const i=args.indexOf(n);return i>=0?args.splice(i,2)[1]:d;};
const OUT=path.resolve(opt('--out','.')),TAG=opt('--tag','sweep'),STEPS=Number(opt('--steps',8));
const BASE=(args[0]||'http://boss.localhost:8890').replace(/\/$/,'');
const W=1440,H=900;fs.mkdirSync(OUT,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// old pipeline: screen pixel of a sphere point (world-view.js project(), same Newton inverse of pixelChart)
function screenOf(state,p){
 const {id,cam,ball,basis}=state,view=viewFrame(id,cam),Rp=WORLD_GEO.Rw*cam.zoom,vz=dot(p,view.center);
 if(ball>.5&&vz<=0)return null;
 const g=localPoint(id,p);
 let px=dot(p,view.east)*Rp*ball+(g.x-cam.x)*cam.zoom*(1-ball),py=-dot(p,view.north)*Rp*ball+(g.y-cam.y)*cam.zoom*(1-ball);
 const gOf=(px,py)=>{const q=pixelChart(id,cam,px,py,ball);return q?[q.x,q.y]:[NaN,NaN];};
 if(ball>1e-6)for(let it=0;it<8;it++){
  const [gx,gy]=gOf(px,py),ex=g.x-gx,ey=g.y-gy;if(Math.abs(ex)+Math.abs(ey)<.01)break;
  const e=.25,[gx1,gy1]=gOf(px+e,py),[gx2,gy2]=gOf(px,py+e),a=(gx1-gx)/e,b=(gx2-gx)/e,c=(gy1-gy)/e,d=(gy2-gy)/e,det=a*d-b*c;
  if(!(Math.abs(det)>1e-14))break;px+=(d*ex-b*ey)/det;py+=(-c*ex+a*ey)/det;
 }
 if(Math.hypot(px,py)>=Rp*horizonRatio(ball))return null;
 return {x:W/2+basis.a*px+basis.c*py,y:H/2+basis.b*px+basis.d*py};
}
export function shearOf(a,b,c,d){
 const ex=Math.hypot(a,b),ny=Math.hypot(c,d),cos=(a*c+b*d)/(ex*ny);
 return {shearDeg:Math.abs(Math.acos(Math.max(-1,Math.min(1,cos)))*180/Math.PI-90),ratio:Math.max(ex/ny,ny/ex)};
}
function oldMatrices(state,targets){
 const out=[];
 for(const t of targets){
  const P=q=>screenOf(state,t.sphere(q)),h=t.h;
  const c=P({x:0,y:0}),x=P({x:h,y:0}),y=P({x:0,y:h});
  if(!c||!x||!y)continue;
  if(c.x<-200||c.y<-200||c.x>W+200||c.y>H+200)continue;
  out.push({id:t.id,kind:t.kind,a:(x.x-c.x)/h,b:(x.y-c.y)/h,c:(y.x-c.x)/h,d:(y.y-c.y)/h,x:c.x,y:c.y});
 }
 return out;
}
const TARGETS=[
 ...WORLD_ISLANDS.map(i=>({id:i.id,kind:'island',h:8,sphere:q=>{const m=mapOf(i.id);return spherePoint(i.id,{x:m.cx+q.x,y:m.cy+q.y});}})),
 ...ISLETS.map((i,k)=>({id:`islet-${k}`,kind:'islet',h:2,sphere:q=>expMap(i,q.x,q.y,WORLD_GEO.Rw)})),
];

const browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:W,height:H}});
const errors=[];page.on('pageerror',e=>errors.push(String(e.message).slice(0,200)));
await page.goto(`${BASE}/__test/login?account=boss`,{waitUntil:'domcontentloaded'});
await page.goto(`${BASE}/?qa=1`,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>globalThis.__duckyEngine?.ready,null,{timeout:90000});
await page.waitForLoadState('networkidle',{timeout:30000}).catch(()=>{});
await sleep(3000);
async function shot(name){
 const h=await page.addStyleTag({content:'body *{visibility:hidden!important}canvas{visibility:visible!important;outline:none!important;box-shadow:none!important}'});
 const buf=await page.screenshot();await h.evaluate(e=>e.remove());
 const file=path.join(OUT,`${TAG}-${name}.png`);fs.writeFileSync(file,buf);return file;
}
const home=mapOf('home');
const range=await page.evaluate(()=>{const e=globalThis.__duckyEngine;return {hi:e.minZoom,lo:e.birdZoom(),id:e.islandId};});
const rows=[];
for(let k=0;k<STEPS;k++){
 const zoom=range.hi*Math.pow(range.lo/range.hi,k/(STEPS-1));
 await page.evaluate(({zoom,x,y})=>{const e=globalThis.__duckyEngine;e.follow=false;e.spin=null;e.fly=null;e.quietAt=Infinity;Object.assign(e.camera,{x,y,zoom});Object.assign(e.target,{x,y,zoom});delete e.camera.basis;},{zoom,x:home.cx,y:home.cy});
 await sleep(k===0?2500:1500);
 await page.evaluate(()=>{globalThis.__duckyEngine.quietAt=Infinity;});
 const state=await page.evaluate(()=>{const e=globalThis.__duckyEngine,g=e.worldView?.globe;return {id:e.islandId,cam:{x:e.camera.x,y:e.camera.y,zoom:e.camera.zoom},t:e.globeT||0,ball:e.globeT>0?(e.worldView.debug?.ball??0):0,basis:e.camera.basis??{a:1,b:0,c:0,d:1},drawn:globalThis.__duckyRigid?.()??null};});
 const file=await shot(`step${k+1}`);
 const mats=state.drawn??oldMatrices(state,TARGETS);
 const visible=mats.filter(m=>m.x>-100&&m.y>-100&&m.x<W+100&&m.y<H+100);
 const measured=visible.map(m=>({id:m.id,kind:m.kind,...(m.mode?{mode:m.mode}:{}),...shearOf(m.a,m.b,m.c,m.d)}));
 const worst=(kind,key)=>Math.max(0,...measured.filter(m=>m.kind===kind).map(m=>m[key]));
 rows.push({step:k+1,zoom:state.cam.zoom,t:state.t,ball:state.ball,file,source:state.drawn?'page matrices':'sphere chart',
  islands:measured.filter(m=>m.kind==='island').length,islets:measured.filter(m=>m.kind==='islet').length,
  maxIslandShearDeg:+worst('island','shearDeg').toFixed(4),maxIslandRatio:+worst('island','ratio').toFixed(4),
  maxIsletShearDeg:+worst('islet','shearDeg').toFixed(4),maxIsletRatio:+worst('islet','ratio').toFixed(4),detail:measured});
 console.error(`step ${k+1} zoom ${state.cam.zoom.toFixed(4)} t ${state.t.toFixed(2)} ball ${state.ball.toFixed(2)}: islands ${rows.at(-1).islands} shear ${rows.at(-1).maxIslandShearDeg} ratio ${rows.at(-1).maxIslandRatio} | islets ${rows.at(-1).islets} shear ${rows.at(-1).maxIsletShearDeg} ratio ${rows.at(-1).maxIsletRatio}`);
}
await browser.close();
fs.writeFileSync(path.join(OUT,`${TAG}-sweep.json`),JSON.stringify({url:BASE,errors,rows},null,1)+'\n');
if(errors.length)console.error('page errors',errors);
