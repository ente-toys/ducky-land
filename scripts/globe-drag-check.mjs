#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {viewFrame} from '../src/pixi/sphere-coordinates.js';
import {dot} from '../src/pixi/sphere.js';
import {spherePoint} from '../src/pixi/sphere-coordinates.js';
import {unlens,lensOffset} from '../src/pixi/globe-look.js';
import {WORLD_GEO,worldIsland} from '../src/pixi/world-map.js';
const RUNTIME='/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? `${RUNTIME}/playwright/index.mjs`);
const args=process.argv.slice(2),opt=(n,d)=>{const i=args.indexOf(n);return i>=0?args.splice(i,2)[1]:d;};
const OUT=path.resolve(opt('--out','.')),BASE=(args[0]||'http://boss.localhost:8890').replace(/\/$/,'');
const W=1440,H=900,sleep=ms=>new Promise(r=>setTimeout(r,ms));fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:W,height:H}});const errors=[];page.on('pageerror',e=>errors.push(String(e.message)));
await page.goto(`${BASE}/__test/login?account=boss`);await page.goto(`${BASE}/?qa=1`);
await page.waitForFunction(()=>globalThis.__duckyEngine?.ready,null,{timeout:90000});await sleep(2500);
await page.mouse.move(W/2,H/2);for(let i=0;i<45;i++){await page.mouse.wheel(0,400);await sleep(40);}
await page.mouse.move(5,5);await sleep(6000);
await page.evaluate(()=>{globalThis.__duckyEngine.quietAt=Infinity;});
for(let n=0;n<4;n++){await page.mouse.move(W/2-220,H/2+60);await page.mouse.down();for(let k=1;k<=12;k++){await page.mouse.move(W/2-220+440*k/12,H/2+60-60*k/12);await sleep(20);}await sleep(200);await page.mouse.up();await sleep(500);}
const state=()=>page.evaluate(()=>{const e=globalThis.__duckyEngine;e.quietAt=Infinity;return {id:e.islandId,cam:{x:e.camera.x,y:e.camera.y,zoom:e.camera.zoom},basis:e.camera.basis??{a:1,b:0,c:0,d:1},ball:e.worldView.debug.ball,st:e.worldView.stickers.filter(s=>s.kind==='island')};});
const frameOf=s=>{const T=viewFrame(s.id,s.cam),c=s.basis.a,si=s.basis.b;return {center:T.center,east:T.east.map((v,k)=>v*c+T.north[k]*si),north:T.north.map((v,k)=>v*c-T.east[k]*si)};};
const rollOf=s=>{const T=viewFrame(s.id,s.cam),c=s.basis.a,si=s.basis.b,E=T.east.map((v,k)=>v*c+T.north[k]*si),N=T.north.map((v,k)=>v*c-T.east[k]*si);
 return Math.atan2(dot([0,1,0],E),dot([0,1,0],N))*180/Math.PI;};
const shot=async name=>{const h=await page.addStyleTag({content:'body *{visibility:hidden!important}canvas{visibility:visible!important}'});const f=path.join(OUT,name);await page.screenshot({path:f});await h.evaluate(e=>e.remove());return f;};
const results=[];
for(const [name,dx,dy]of [['horizontal',300,0],['vertical',0,240],['diagonal',260,-200]]){
 let s=await state();
 const g0={x:W/2-dx/2,y:H/2-dy/2},near=s.st.map(k=>({k,d:Math.hypot(k.x-g0.x,k.y-g0.y)})).sort((a,b)=>a.d-b.d)[0].k;
 await page.mouse.move(g0.x,g0.y);await page.mouse.down();await sleep(100);s=await state();
 const Rp=s2=>WORLD_GEO.Rw*s2.cam.zoom,spot=unlens(frameOf(s),{x:g0.x-W/2,y:g0.y-H/2},s.ball,Rp(s));
 let drawn=0,clamped=false,drift=0,roll=Math.abs(rollOf(s));const frames=[];
 if(name==='horizontal')frames.push(await shot('rotate-1.png'));
 for(let k=1;k<=10;k++){
  const cx=g0.x+dx*k/10,cy=g0.y+dy*k/10;
  for(let j=1;j<=4;j++){await page.mouse.move(g0.x+dx*(k-1+j/4)/10,g0.y+dy*(k-1+j/4)/10);await sleep(16);}
  await sleep(260);s=await state();const q=lensOffset(frameOf(s),spot,s.ball,Rp(s));
  const lat=Math.asin(spherePoint(s.id,s.cam)[1])*180/Math.PI,e=Math.hypot(q.x+W/2-cx,q.y+H/2-cy);
  for(const d of s.st){const m=lensOffset(frameOf(s),worldIsland(d.id).center,s.ball,Rp(s));drawn=Math.max(drawn,Math.hypot(m.x+W/2-d.x,m.y+H/2-d.y));}

  if(Math.abs(lat)>88.2)clamped=true;else drift=Math.max(drift,e);
  if(name==='horizontal'&&k%2===0)frames.push(await shot(`rotate-${k/2+1}.png`));
 }
 if(name!=='horizontal')frames.push(await shot(`drag-${name}-end.png`));
 await page.mouse.up();await sleep(800);
 results.push({drag:name,island:near.id,degreesFromHome:+(Math.acos(Math.max(-1,Math.min(1,spherePoint(s.id,s.cam)[2])))*180/Math.PI).toFixed(1),maxUnderCursorDriftPx:+drift.toFixed(3),hitPoleLimit:clamped,maxDrawnIslandVsSpherePx:+drawn.toFixed(3),maxNorthRollDeg:+roll.toFixed(4),frames});
 console.log(name,near.id,results.at(-1).degreesFromHome,'deg from home','drift',drift.toFixed(3),clamped?'(hit pole limit)':'','drawn vs sphere',drawn.toFixed(3),'px roll',roll.toFixed(4),'deg');
}
await browser.close();
const passed=results.every(r=>r.maxUnderCursorDriftPx<3&&r.maxDrawnIslandVsSpherePx<1&&r.maxNorthRollDeg<1)&&!errors.length;
fs.writeFileSync(path.join(OUT,'globe-drag.json'),JSON.stringify({url:BASE,passed,results,errors},null,1)+'\n');
console.log(passed?'PASS':'FAIL');if(!passed)process.exitCode=1;
