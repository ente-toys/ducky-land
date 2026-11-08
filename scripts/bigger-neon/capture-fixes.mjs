import fs from 'node:fs';
import {chromium} from '/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const O='../concepts/themes/world-map/bigger/',errors=[];
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1764,height:1330},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:19124/scripts/bigger-neon/review.html');
 await page.waitForFunction(()=>window.reviewReady&&!window.reviewGame.sceneryPending,null,{timeout:120000});
 await page.waitForTimeout(1000);
 await page.screenshot({path:O+'neon-fixed-runtime.png'});
 const runtime=await page.evaluate(()=>({state:window.reviewGame.canvas.dataset.state,map:window.reviewGame.mapHere().id,waterShapes:window.reviewGame.mapHere().world.water.length,bridges:window.reviewGame.mapHere().world.bridges.length,artReady:window.reviewGame.artReady('neon'),error:window.reviewError??null}));
 for(const[name,x,y]of [['bridge-river',550,2285],['heart-north',3844,746],['heart-south',3899,4460],['stream-bridge',6700,150]]){
  await page.evaluate(([x,y])=>window.reviewCamera(x,y,.8),[x,y]);await page.waitForTimeout(300);await page.screenshot({path:O+'neon-fixed-crops/runtime-'+name+'.png'});
 }
 fs.writeFileSync(O+'neon-work/fix-runtime.json',JSON.stringify({headless:true,errors,runtime},null,2)+'\n');console.log({errors,runtime});if(errors.length||runtime.error)throw Error('Runtime errors');
}finally{await browser.close();}
