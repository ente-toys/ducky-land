import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const origin=process.env.REVIEW_ORIGIN ?? 'http://127.0.0.1:8896';
const out=process.env.REVIEW_OUT ?? '/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/raster-originals/fix-svg-review';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});
const errors=[],requests=new Set(),responses=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('request',r=>requests.add(r.url()));
page.on('response',r=>{if(r.status()>=400)responses.push({url:r.url(),status:r.status()});});
try {
 for(const theme of ['home','cathedral']) {
  await page.goto(`${origin}/qa/fix-svg-review.html?theme=${theme}`);
  await page.waitForFunction(()=>window.reviewReady&&!window.reviewError,null,{timeout:120000});
  if(theme==='cathedral')await page.waitForFunction(()=>window.__duckyMapSleepers?.cathedral?.length===40,null,{timeout:120000});
  await page.waitForTimeout(2500);
  await page.screenshot({path:path.join(out,`game-${theme}.png`)});
  if(theme==='cathedral') {
   const tree=await page.evaluate(()=>{const p=window.reviewGame.arts.get('cathedral').props.find(p=>p.id==='olive-14');return {x:p.x,y:p.y};});
   assert.deepEqual([tree.x,tree.y],[6400,3870]);
  }
 }
 const raster=[...requests].filter(u=>/\.(?:png|webp|jpe?g|gif|avif)(?:[?#]|$)/i.test(u));
 assert.deepEqual(raster,[]);assert.deepEqual(errors,[]);assert.deepEqual(responses,[]);
 const result={requests:requests.size,svgRequests:[...requests].filter(u=>/\.svg(?:[?#]|$)/i.test(u)).length,rasterRequests:raster,errors,responses};
 await fs.writeFile(path.join(out,'browser-audit.json'),JSON.stringify(result,null,2)+'\n');console.log(result);
} finally {await browser.close();}
