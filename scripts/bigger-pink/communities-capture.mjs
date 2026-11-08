import {chromium} from '/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {writeFileSync} from 'node:fs';
const out='../concepts/themes/world-map/bigger/pink-validation';
let browser;
try {
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1400,height:1050},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:19952/scripts/bigger-pink/review.html');
 await page.waitForFunction(()=>window.reviewReady&&window.reviewGame.artShown==='pink'&&!window.reviewGame.sceneryPending,null,{timeout:45000});
 const runtime=await page.evaluate(()=>({state:window.reviewGame.canvas.dataset.state,theme:window.reviewGame.artShown,origin:window.reviewGame.mapHere().origin}));
 await page.screenshot({path:out+'/pink-runtime-overview.png'});
 await page.evaluate(()=>{const g=window.reviewGame;g.fly=null;g.follow=false;Object.assign(g.camera,{x:700,y:300,zoom:.8});Object.assign(g.target,g.camera);});
 await page.waitForTimeout(500);await page.screenshot({path:out+'/pink-runtime-ribbonwick.png'});
 writeFileSync(out+'/runtime.json',JSON.stringify({runtime,errors},null,2)+'\n');
 if(errors.length)throw Error(errors.join('\n'));console.log(runtime);
} finally {await browser?.close();}
