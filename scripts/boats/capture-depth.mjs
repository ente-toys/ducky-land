import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from '/private/tmp/boat48-browser/node_modules/playwright-core/index.mjs';
const out='../concepts/boat-turntable/spin48-work/depth';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BOAT_BROWSER??'/Users/pragadees.xd/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:480,height:440}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
try{
 await page.goto('http://127.0.0.1:8912/qa/boat48-depth.html?capture');await page.waitForFunction(()=>window.ready,null,{timeout:120000});
 const proof=[];
 for(let n=0;n<48;n++){
  const data=await page.evaluate(n=>window.setFrame(n),n);writeFileSync(`${out}/frame-${String(n).padStart(2,'0')}.png`,Buffer.from(data.split(',')[1],'base64'));
  proof.push(await page.evaluate(()=>window.proof));
 }
 writeFileSync(`${out}/runtime.json`,JSON.stringify({proof,errors},null,2)+'\n');
 if(errors.length)throw Error(errors.join('\n'));console.log('Captured 48 real Pixi sailing frames',proof[0]);
}finally{await browser.close();}
