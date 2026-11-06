import {chromium} from '/Users/pragadees.xd/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import {writeFileSync,copyFileSync} from 'node:fs';
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:2067,height:1537}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url())});
await page.goto('http://127.0.0.1:5293/pixi-art/themes/waterfall/waterfall-review.html');await page.waitForFunction(()=>window.waterfallQA?.ready,null,{timeout:60000});await page.waitForTimeout(1200);
const qa=await page.evaluate(()=>window.waterfallQA);qa.errors=errors;await page.screenshot({path:'../concepts/themes/work/waterfall/waterfall-browser-overview.png'});
await page.setViewportSize({width:1500,height:1000});await page.goto('http://127.0.0.1:5293/pixi-art/themes/waterfall/waterfall-review.html?k=1&x=3900&y=3650');await page.waitForFunction(()=>window.waterfallQA?.ready,null,{timeout:60000});await page.waitForTimeout(500);await page.screenshot({path:'../concepts/themes/work/waterfall/waterfall-browser-detail.png'});
for(const [name,x,y] of [['plaza',3900,3800],['bench-ring',3900,3450],['path-junction',4900,3030],['tree-cluster',2710,3020]]){
 await page.goto(`http://127.0.0.1:5293/pixi-art/themes/waterfall/waterfall-review.html?k=1&x=${x}&y=${y}`);
 await page.waitForFunction(()=>window.waterfallQA?.ready,null,{timeout:60000});
 await page.screenshot({path:`../concepts/themes/work/waterfall/waterfall-browser-${name}.png`});
}
writeFileSync('../concepts/themes/work/waterfall/waterfall-browser-validation.json',JSON.stringify(qa,null,2));console.log(qa);await browser.close();if(errors.length||qa.sleepers!==40)process.exitCode=1;
