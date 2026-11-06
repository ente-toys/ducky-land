// Run with the Neon Vite server on 5266. Optional PLAYWRIGHT_MODULE = absolute index.mjs path.
import fs from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 for(const view of ['island','centre']){
  await page.goto('http://127.0.0.1:5266/rive/web/themes/neon/preview.html?view='+view);
  await page.waitForFunction(()=>window.__neonReady,null,{timeout:90000});
  const state=await page.evaluate(()=>window.__neonReady);
  if(state.crowd!==100||state.sleepers!==40)throw Error(JSON.stringify(state));
  await page.screenshot({path:`../concepts/themes/work/neon/browser-${view}.png`});
 }
 if(errors.length)throw Error(errors.join('\n'));
 fs.writeFileSync('public/pixi-art/themes/neon/browser-results.json',JSON.stringify({pass:true,port:5266,errors},null,2));
}finally{await browser.close();}
