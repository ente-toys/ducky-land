import fs from 'node:fs';
import path from 'node:path';
const RUNTIME='/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? `${RUNTIME}/playwright/index.mjs`);
const [outDir,...specs]=process.argv.slice(2);
const BASE=(process.env.DUCKY_URL||'http://boss.localhost:8901').replace(/\/$/,''), ACCOUNT='boss';
const W=+(process.env.SHOT_W||1600), H=+(process.env.SHOT_H||1000);
fs.mkdirSync(outDir,{recursive:true});
const spots=specs.map(s=>{const [name,x,y,z]=s.split(':');return {name,x:+x,y:+y,z};});
const browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(String(e.message).slice(0,200)));
 await page.goto(`${BASE}/__test/login?account=${ACCOUNT}`,{waitUntil:'domcontentloaded'});
 await page.goto(`${BASE}/?qa=1`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>globalThis.__duckyEngine?.ready&&globalThis.__duckyEngine.room,null,{timeout:90000});
 await page.waitForFunction(()=>globalThis.__duckyEngine.player,null,{timeout:60000}).catch(()=>{});
 const first=spots[0];
 const res=await page.evaluate(async([account,x,y])=>(await fetch('/__test/pose',{method:'POST',body:JSON.stringify({account,pose:{islandId:'sunset',mode:'walking',boatId:null,x,y,turn:0},steps:1})})).status,[ACCOUNT,4000,3300]);
 if(res!==204)throw Error('pose failed '+res);
 await page.waitForFunction(()=>{const e=globalThis.__duckyEngine;return e.islandId==='sunset'&&e.artShown==='pink'&&!e.sceneryPending;},null,{timeout:120000});
 await page.waitForLoadState('networkidle',{timeout:30000}).catch(()=>{});
 await page.addStyleTag({content:'body *{visibility:hidden!important}canvas{visibility:visible!important;outline:none!important}'});
 for(const s of spots){
  const set=()=>page.evaluate(([x,y,z])=>{const e=globalThis.__duckyEngine;const zoom=z==='fit'?e.minZoom:+z;e.follow=false;e.fitMode=false;e.fly=null;e.spin=null;e.quietAt=Infinity;Object.assign(e.camera,{x,y,zoom});Object.assign(e.target,e.camera);},[s.x,s.y,s.z]);
  await set();await page.waitForTimeout(+(process.env.WAIT||3000));await set();await page.waitForTimeout(700);
  await page.screenshot({path:path.join(outDir,s.name+'.png')});
  console.log("shot",s.name,await page.evaluate(()=>{const e=globalThis.__duckyEngine;return JSON.stringify({x:e.camera.x,y:e.camera.y,zoom:e.camera.zoom});}));
 }
 if(errors.length)console.log('page errors',errors);
}finally{await browser.close();}
