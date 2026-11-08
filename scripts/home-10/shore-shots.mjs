// Headless proof shots for the shore lane (same framing as home-check/REPORT.html). Never opens a visible browser.
// Usage: node scripts/home-10/shore-shots.mjs [base-url] [out-dir]
import fs from 'node:fs';
import path from 'node:path';
const RUNTIME='/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? `${RUNTIME}/playwright/index.mjs`);
const BASE=(process.argv[2]||'http://boss.localhost:8897').replace(/\/$/,'');
const OUT=path.resolve(process.argv[3]||'/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/home-fix/shore');
const ONLY=process.env.SHOTS?.split(',');
// FILL_PREVIEW=<old home-expansion.json>: paint the filled-in inlet flat grass at runtime, standing in for the ground lane's
// repainted tiles (preview only, never committed art): the land between the old coast and the new one
let FILL=null;
if(process.env.FILL_PREVIEW){
  const old=JSON.parse(fs.readFileSync(process.env.FILL_PREVIEW,'utf8')).coast, lane=JSON.parse(fs.readFileSync(new URL('./shore.json',import.meta.url),'utf8')).coast;
  const near=(p,q)=>Math.round(p[0])===q[0]&&Math.round(p[1])===q[1], i=old.findIndex(p=>near(p,lane.after)), j=old.findIndex(p=>near(p,lane.before));
  FILL=[...old.slice(i,j+1),...[...lane.points].reverse()];
}
fs.mkdirSync(OUT,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// [name, x, y, zoom]: the report's spots, plus the new harbour
const SPOTS=[['close-bay-6150-1800',6150,1800,.9],['harbor-boats',5600,1750,.9],['wave-5450-1680',5450,1680,.9],
  ['bay-wide',6400,1700,.35],['south-boats',4300,5500,.45],['new-harbour',4080,5750,.9],['overview',2600,1900,.13],['millhead',6200,1050,.9]];
const browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(String(e.message).slice(0,200)));
  await page.goto(`${BASE}/__test/login?account=boss`,{waitUntil:'domcontentloaded'});
  await page.goto(`${BASE}/?qa=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>globalThis.__duckyEngine?.ready,null,{timeout:90000});
  await sleep(2500);
  if(FILL)await page.evaluate(poly=>{const e=globalThis.__duckyEngine,G=e.surf.crests[0].constructor,g=new G({label:'fill preview'});
    g.poly(poly.flat()).fill(0x93b72f);e.homeGround.addChild(g);},FILL);
  for(const [name,x,y,zoom] of SPOTS){
    if(ONLY&&!ONLY.includes(name))continue;
    await page.evaluate(([x,y,zoom])=>{const e=globalThis.__duckyEngine;e.follow=false;e.spin=null;e.fly=null;Object.assign(e.camera,{x,y,zoom});Object.assign(e.target,{x,y,zoom});e.quietAt=Infinity;},[x,y,zoom]);
    await sleep(3500);
    await page.evaluate(([x,y,zoom])=>{const e=globalThis.__duckyEngine;Object.assign(e.camera,{x,y,zoom});Object.assign(e.target,{x,y,zoom});},[x,y,zoom]);
    await sleep(600);
    const h=await page.addStyleTag({content:'body *{visibility:hidden!important}canvas{visibility:visible!important}'});
    await page.screenshot({path:path.join(OUT,`${name}.png`)});
    await h.evaluate(e=>e.remove());
    console.log('shot',name);
  }
  if(errors.length)console.log('page errors',errors);
}finally{await browser.close();}
