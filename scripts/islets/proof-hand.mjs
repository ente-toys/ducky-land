#!/usr/bin/env node
// Headless proof (boss 8 Nov, hand-drawn islets): for every sea islet, take a real boat, sail up, Dock at its drawn jetty
// and capture it at max zoom with the boat tied up at the jetty tip; then one globe view. Also checks the globe atlas the
// game bakes at start-up against the browser's own rendering of the same SVGs.
// Usage: node scripts/islets/proof-hand.mjs [url] [out dir]   (url: qa/travel-server.mjs serving a fresh build, never 8890)
import fs from 'node:fs';
import {ISLETS,ISLET_ART,isletPoint} from '../../src/pixi/islets.js';
import {isletWalk} from '../../src/pixi/islet-walk.js';
import {localPoint} from '../../src/pixi/sphere-coordinates.js';
import {boardingPoint,navOf} from '../../src/pixi/islands.js';
const RUNTIME='/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? `${RUNTIME}/playwright/index.mjs`);
const BASE=(process.argv[2]||'http://127.0.0.1:8938').replace(/\/$/,''),OUT=process.argv[3]||'.';
fs.mkdirSync(OUT,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const only=process.env.ISLETS?.split(',');
const report={base:BASE,errors:[],islets:[]};
const browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2});
 page.on('pageerror',e=>report.errors.push(String(e.message).slice(0,200)));
 page.on('console',m=>{if(m.type()==='error'||/SVG parser|svg-context/.test(m.text()))report.errors.push(m.text().slice(0,200));});
 await page.goto(`${BASE}/__test/login?account=boss`,{waitUntil:'domcontentloaded'});
 await page.goto(`${BASE}/?qa=1`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>globalThis.__duckyEngine?.ready&&globalThis.__duckyEngine.player&&globalThis.__duckyEngine.isletView,null,{timeout:120000});
 await page.addStyleTag({content:'body *{visibility:hidden!important}canvas{visibility:visible!important}'});
 // 1. the globe atlas, baked in the game from the vector art, against the browser drawing the same SVG files
 report.atlas=await page.evaluate(async arts=>{
  const e=globalThis.__duckyEngine,r=e.app.renderer,live=r.extract.canvas(e.isletView.atlas),W=live.width,H=live.height;
  const a=live.getContext('2d').getImageData(0,0,W,H).data;
  const ref=document.createElement('canvas');ref.width=W;ref.height=H;const g=ref.getContext('2d');
  for(const [k,art]of arts.entries()){const im=new Image();im.src=`/pixi-art/islets/${art}.svg`;await im.decode();g.drawImage(im,k%4*512+2,Math.floor(k/4)*512+2,508,508);}
  const b=g.getImageData(0,0,W,H).data,cells=[];
  for(const [k,art]of arts.entries()){let n=0,sum=0,alphaOff=0,bad=0;
   for(let y=Math.floor(k/4)*512;y<Math.floor(k/4)*512+512;y++)for(let x=k%4*512;x<k%4*512+512;x++){const p=(y*W+x)*4;
    if(Math.abs(a[p+3]-b[p+3])>96)alphaOff++;
    if(a[p+3]>230&&b[p+3]>230){n++;const d=(Math.abs(a[p]-b[p])+Math.abs(a[p+1]-b[p+1])+Math.abs(a[p+2]-b[p+2]))/3;sum+=d;if(d>60)bad++;}}
   cells.push({art,size:[W,H],meanDiff:+(sum/n).toFixed(2),pixelsOff:+(bad/n*100).toFixed(2)+'%',edgeAlphaOff:alphaOff});}
  return {cells,live:live.toDataURL('image/png'),ref:ref.toDataURL('image/png')};
 },ISLET_ART);
 fs.writeFileSync(`${OUT}/globe-atlas-baked-in-game.png`,Buffer.from(report.atlas.live.split(',')[1],'base64'));
 fs.writeFileSync(`${OUT}/globe-atlas-browser-reference.png`,Buffer.from(report.atlas.ref.split(',')[1],'base64'));
 delete report.atlas.live;delete report.atlas.ref;
 const state=async()=>page.evaluate(async()=>(await fetch('/__test/state')).json());
 const pose=async(p,steps=2)=>page.evaluate(async([p,steps])=>{await fetch('/__test/pose',{method:'POST',body:JSON.stringify({account:'boss',pose:p,steps})});},[p,steps]);
 const me=()=>page.evaluate(()=>{const e=globalThis.__duckyEngine,p=e.player;return {x:p.x,y:p.y,mode:p.mode,islandId:e.islandId};});
 const until=async(test,ms=60000)=>{const t=Date.now();while(Date.now()-t<ms){if(await test())return true;await sleep(250);}return false;};
 // 2. a real boat from the home harbour
 let s=await state(),boat=s.boats.find(b=>b.islandId==='home'&&!b.occupant),deck=boardingPoint(boat,navOf('home'));
 await pose({islandId:'home',x:deck.x,y:deck.y,mode:'walking',path:[]});
 await until(async()=>(await me()).islandId==='home');
 for(const i of ISLETS){
  if(only&&!only.includes(i.id))continue;
  const w=isletWalk(i.id),row={id:i.id,art:i.art,home:i.home,width:i.width};
  try{
   s=await state();boat=s.boats.find(b=>b.id===boat.id);
   await page.evaluate(id=>globalThis.__duckyEngine.room.board(id),boat.id);
   if(!await until(async()=>(await me()).mode==='sailing',30000))throw Error('could not board');
   // sail to open water off this islet's jetty (the far side of the world is a pose; the last stretch is real sailing)
   const off=localPoint(i.home,isletPoint(i,[i.jetty.tip[0]+i.jetty.dir[0]*260,i.jetty.tip[1]+i.jetty.dir[1]*260]));
   await pose({islandId:i.home,x:Math.round(off.x),y:Math.round(off.y),mode:'sailing',sailTarget:null,sailRoute:null,path:[]},4);
   if(!await until(async()=>{const m=await me();return m.islandId===i.home&&Math.hypot(m.x-off.x,m.y-off.y)<40;},30000))throw Error('did not arrive off the islet');
   row.dockButton=await page.evaluate(()=>globalThis.__duckyEngine.travelOptions().dock);
   await page.evaluate(()=>globalThis.__duckyEngine.room.disembark());
   if(!await until(async()=>(await me()).mode==='walking',60000))throw Error('did not dock');
   const m=await me();row.ashore={x:Math.round(m.x),y:Math.round(m.y)};row.onJettyEnd=Math.hypot(m.x-w.land.x,m.y-w.land.y)<4;
   s=await state();const b=s.boats.find(b=>b.id===boat.id);row.boat={x:Math.round(b.x),y:Math.round(b.y),atJettyTip:Math.hypot(b.x-w.water.x,b.y-w.water.y)<16};
   // max zoom, framed on the jetty and the land behind it
   const mid=localPoint(i.home,isletPoint(i,[(i.landCentre[0]*.5+i.jetty.tip[0]*.5),(i.landCentre[1]*.5+i.jetty.tip[1]*.5)]));
   await page.evaluate(([x,y])=>{const e=globalThis.__duckyEngine;e.follow=false;e.fitMode=false;e.fly=null;Object.assign(e.target,{x,y,zoom:1.8});Object.assign(e.camera,{x,y,zoom:1.8});e.quietAt=Infinity;},[mid.x,mid.y]);
   await sleep(2200);
   row.vector=await page.evaluate(id=>{const v=globalThis.__duckyEngine.isletView.views.find(v=>v.i.id===id);return {visible:v.root.visible,geometry:v.art.context.instructions.length};},i.id);
   row.max=`${OUT}/${i.id}-${i.art}-docked-max-zoom.png`;fs.writeFileSync(row.max,await page.screenshot());
   // and the whole islet, for context
   const c=localPoint(i.home,isletPoint(i,i.landCentre));
   await page.evaluate(([x,y,z])=>{const e=globalThis.__duckyEngine;Object.assign(e.target,{x,y,zoom:z});Object.assign(e.camera,{x,y,zoom:z});},[c.x,c.y,Math.min(1.8,900/i.width)]);
   await sleep(1500);
   row.whole=`${OUT}/${i.id}-${i.art}-docked-whole.png`;fs.writeFileSync(row.whole,await page.screenshot());
   await page.evaluate(()=>{globalThis.__duckyEngine.follow=true;});
  }catch(error){row.error=String(error.message);}
  report.islets.push(row);console.log(JSON.stringify(row));
 }
 // 3. one globe view, turned to the islets
 const i=ISLETS[0],g=localPoint(await page.evaluate(()=>globalThis.__duckyEngine.islandId),isletPoint(i,[0,0]));
 await page.evaluate(([x,y])=>{const e=globalThis.__duckyEngine;e.follow=false;e.fitMode=false;e.fly=null;const z=e.birdZoom();Object.assign(e.target,{x,y,zoom:z});Object.assign(e.camera,{x,y,zoom:z});e.quietAt=Infinity;},[g.x,g.y]);
 await sleep(4000);
 report.globeT=await page.evaluate(()=>globalThis.__duckyEngine.globeT);
 report.globe=`${OUT}/globe.png`;fs.writeFileSync(report.globe,await page.screenshot());
}finally{await browser.close();}
fs.writeFileSync(`${OUT}/proof.json`,JSON.stringify(report,null,1)+'\n');
console.log(JSON.stringify({atlas:report.atlas,errors:report.errors,globeT:report.globeT},null,1));
