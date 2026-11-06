import {chromium} from '/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import sharp from 'sharp';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='../concepts/themes/work/cathedral',round=process.env.ROUND||'close-0';mkdirSync(out,{recursive:true});
const W=1100,H=800,rows=[['Piazza',[2820,2370],[4100,2680]],['Bench rim',[2820,2630],[4210,3340]],['Path junction',[3780,2720],[5500,2750]],['Tree cluster',[2200,1560],[2500,1180]],['Activity paving',[2820,2370],[2240,2200]],['Stall paving',[2820,2370],[4860,3900]]];
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(String(e)));let comps=[],overviews=[];
const label=t=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="40"><rect width="100%" height="100%" fill="#FFF6E1"/><text x="20" y="27" font-size="19" font-family="Arial" fill="#39472D">${t}</text></svg>`);
for(const [j,theme]of ['home','cathedral'].entries()){
 await page.goto(`http://127.0.0.1:5294/pixi-art/themes/cathedral/review.html?theme=${theme}`);await page.waitForFunction(()=>window.reviewReady,null,{timeout:120000});await page.waitForTimeout(2500);
 for(const [i,[name,h,c]]of rows.entries()){
  await page.evaluate(([x,y])=>window.reviewCamera(x,y,.65),j?c:h);await page.waitForTimeout(350);
  const buf=await page.screenshot({path:`${out}/cathedral-${round}-${i}-${theme}.png`});comps.push({input:label(`${theme.toUpperCase()} / ${name} / Pixi game zoom 0.65`),left:j*W,top:i*(H+40)},{input:buf,left:j*W,top:i*(H+40)+40});
 }
 await page.setViewportSize({width:2000,height:1500});await page.evaluate(t=>window.reviewCamera(...(t==='home'?[2900,2200,.25]:[4000,3000,.25])),theme);await page.waitForTimeout(500);
 overviews.push(await page.screenshot({path:`${out}/cathedral-${round}-overview-${theme}.png`}));await page.setViewportSize({width:W,height:H});
}
await browser.close();
const sheet=await sharp({create:{width:W*2,height:(H+40)*rows.length,channels:4,background:'#FFF6E1'}}).composite(comps).png().toBuffer();
writeFileSync(`${out}/cathedral-closeups-vs-home-${round}.png`,sheet);writeFileSync(`${out}/cathedral-closeups-vs-home.png`,sheet);
const whole=await sharp({create:{width:4000,height:1500,channels:4,background:'#8CC8CD'}}).composite(overviews.map((input,i)=>({input,left:i*2000,top:0}))).png().toBuffer();writeFileSync(`${out}/cathedral-vs-home-${round}.png`,whole);writeFileSync(`${out}/cathedral-vs-home.png`,whole);writeFileSync(`${out}/cathedral-${round}-browser.json`,JSON.stringify({errors,zoom:.65,rows:rows.map(r=>r[0])},null,2));console.log({round,errors});if(errors.length)process.exitCode=1;
