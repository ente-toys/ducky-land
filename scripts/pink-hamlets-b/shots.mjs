import {chromium} from '/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const out='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/pink-fix/ingame';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
for(const [name,x,y,zoom] of [['teacup',8480,1690,.46],['tutu-tides',4050,5850,.55]]){
 await page.goto(`http://127.0.0.1:19962/scripts/bigger-pink/review.html?x=${x}&y=${y}&zoom=${zoom}`);
 await page.waitForFunction(()=>window.reviewReady&&window.reviewGame.artShown==='pink'&&!window.reviewGame.sceneryPending,null,{timeout:120000});
 await page.waitForTimeout(2500);await page.screenshot({path:`${out}/${name}-game.png`});
 console.log(name,await page.evaluate(()=>({error:window.reviewError,art:window.reviewGame.artShown,sleepers:window.reviewGame.map?.sleepers?.length})));
}
writeFileSync(`${out}/shore-runtime.json`,JSON.stringify({errors},null,2));await browser.close();
