import {chromium} from '/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='../concepts/themes/work/pink-fix/final';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
try{
const page=await browser.newPage({viewport:{width:1800,height:1200},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
for(const [name,x,y,zoom] of [['whole-island',4000,3100,.12],['ribbonwick',700,0,.57],['chirrup',6250,-50,.78],['petalpatch',-650,2650,.72],['teacup',6700,4790,.65],['tutu-tides',4050,6000,.78]]){
 await page.goto(`http://127.0.0.1:19962/scripts/bigger-pink/review.html?x=${x}&y=${y}&zoom=${zoom}`);
 await page.waitForFunction(()=>window.reviewReady&&window.reviewGame.artShown==='pink'&&!window.reviewGame.sceneryPending,null,{timeout:120000});
 await page.waitForTimeout(1500);await page.screenshot({path:`${out}/${name}.png`});console.log(name);
}
writeFileSync(`${out}/runtime.json`,JSON.stringify({errors},null,2));
}finally{await browser.close();}
