#!/usr/bin/env node
// Headless proof (boss 8 Nov): a Ducky ashore on a sea islet, walking it, the islet drawn as vector art at max zoom.
// Usage: node scripts/islets/proof-dock.mjs [url] [out dir]   (url: a qa/travel-server.mjs fixture serving a fresh build)
import fs from 'node:fs';
import {ISLETS} from '../../src/pixi/islets.js';
import {isletWalk} from '../../src/pixi/islet-walk.js';
import {localPoint} from '../../src/pixi/sphere-coordinates.js';
import {isletPoint} from '../../src/pixi/islets.js';
const RUNTIME='/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? `${RUNTIME}/playwright/index.mjs`);
const BASE=(process.argv[2]||'http://boss.localhost:8933').replace(/\/$/,''),OUT=process.argv[3]||'.';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const islet=ISLETS.find(i=>i.id===(process.env.ISLET||'sea-9-1')),w=isletWalk(islet.id);
const inland=localPoint(islet.home,isletPoint(islet,islet.landCentre)),to=w.nav.nearest(inland.x,inland.y,300);
const browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const report={islet:islet.id,art:islet.art,home:islet.home,errors:[]};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2});
 page.on('pageerror',e=>report.errors.push(String(e.message).slice(0,200)));
 await page.goto(`${BASE}/__test/login?account=boss`,{waitUntil:'domcontentloaded'});
 await page.goto(`${BASE}/?qa=1`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>globalThis.__duckyEngine?.ready&&globalThis.__duckyEngine.player,null,{timeout:90000});
 const pose=async(p,steps=2)=>page.evaluate(async([p,steps])=>{await fetch('/__test/pose',{method:'POST',body:JSON.stringify({account:'boss',pose:p,steps})});},[p,steps]);
 await pose({islandId:islet.home,x:w.land.x,y:w.land.y,mode:'walking',path:[]});
 await page.waitForFunction(id=>globalThis.__duckyEngine.islandId===id,islet.home,{timeout:60000});
 const view=async(zoom,name)=>{
  await page.evaluate(z=>{const e=globalThis.__duckyEngine;e.follow=true;e.fitMode=false;e.fly=null;e.target.zoom=z;e.camera.zoom=z;e.quietAt=Infinity;},zoom);
  await sleep(2500);
  await page.addStyleTag({content:'body *{visibility:hidden!important}canvas{visibility:visible!important}'});
  const file=`${OUT}/islet-dock-${name}.png`;fs.writeFileSync(file,await page.screenshot());return file;
 };
 report.ashore=await view(.45,'ashore');
 report.player=await page.evaluate(()=>{const p=globalThis.__duckyEngine.player;return {x:p.x,y:p.y,mode:p.mode};});
 report.dockButton=await page.evaluate(()=>globalThis.__duckyEngine.travelOptions());
 report.vector=await page.evaluate(()=>{const e=globalThis.__duckyEngine,v=e.isletView.views.filter(v=>v.root.visible);return v.map(v=>({id:v.i.id,vector:v.art&&v.art!=='loading',raster:v.stand.visible,loadMs:v.loadMs}));});
 report.closeup=await view(1.8,'max-zoom');
 report.svgLoadMs=await page.evaluate(async src=>{const {Assets}=globalThis.__duckyPixi??{};if(!Assets)return null;const t=performance.now();await Assets.load({src,data:{parseAsGraphicsContext:true}});return Math.round(performance.now()-t);},'/pixi-art/islets/12-coral-atoll.svg');
 report.frames=await page.evaluate(()=>new Promise(res=>{const d=[];let last=performance.now();const step=t=>{d.push(t-last);last=t;if(d.length<120)requestAnimationFrame(step);else{d.sort((a,b)=>a-b);res({medianMs:+d[60].toFixed(1),p95Ms:+d[114].toFixed(1)});}};requestAnimationFrame(t=>{last=t;requestAnimationFrame(step);});}));
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>globalThis.__duckyEngine?.ready&&globalThis.__duckyEngine.player,null,{timeout:90000});
 await page.evaluate(([x,y])=>globalThis.__duckyEngine.room.destination(x,y),to);
 await sleep(4000);
 report.walked=await page.evaluate(()=>{const p=globalThis.__duckyEngine.player;return {x:p.x,y:p.y,mode:p.mode};});
 report.walkTarget=to;
 report.inland=await view(.6,'walked-inland');
}finally{await browser.close();}
console.log(JSON.stringify(report,null,1));
