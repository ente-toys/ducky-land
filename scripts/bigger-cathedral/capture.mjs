import {chromium} from '/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const out='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/world-map/bigger',plan=JSON.parse(fs.readFileSync('scripts/bigger-cathedral/plan.json'));
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1400,height:1000},deviceScaleFactor:1}),errors=[],warnings=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
try{
 await page.goto('http://127.0.0.1:5368/scripts/bigger-cathedral/review.html');
 await page.waitForFunction(()=>window.reviewReady&&globalThis.__duckyThemeArt?.includes('cathedral')&&globalThis.__duckyMapSleepers?.cathedral?.length===40,null,{timeout:120000});
 for(const [name,x,y]of plan.crops){await page.evaluate(([x,y])=>window.reviewCamera(x,y,.8),[x,y]);await page.waitForTimeout(250);await page.screenshot({path:out+'/cathedral-crops/live-'+name+'.png'});}
 await page.evaluate(()=>window.reviewCamera(4200,2800,.105));await page.waitForTimeout(500);await page.screenshot({path:out+'/cathedral-live-overview.png'});
 const runtime=await page.evaluate(()=>({state:game.canvas.dataset.state,theme:game.artShown,origin:game.mapHere().origin,props:game.arts.get('cathedral')?.props.length,sleepers:__duckyMapSleepers.cathedral.length,reviewError:window.reviewError,memory:performance.memory?.usedJSHeapSize}));
 fs.writeFileSync('scripts/bigger-cathedral/runtime.json',JSON.stringify({runtime,errors,warnings},null,2)+'\n');console.log(JSON.stringify({runtime,errors,warnings}));
 if(errors.length||runtime.reviewError)throw Error('Runtime errors');
}finally{await browser.close();}
