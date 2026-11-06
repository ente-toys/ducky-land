// Actual game renderer, headless only. No shared files are written.
import {chromium} from '/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../concepts/themes/work/sunflower/',import.meta.url));
const round=process.argv[2]||'final',out=root+round;mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:2000,height:1500},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
const views={sunflower:[['island',[4000,2800,.25]],['plaza',[3880,2608,1]],['plaza-wide',[3880,2608,.65]],['bench',[3210,2160,1]],['junction',[2680,2390,1]],['trees',[2230,3700,1]],['lawn',[5700,2070,.85]],['stalls',[4325,1765,1]]],
 home:[['island',[2900,2200,.25]],['plaza',[2820,2370,1]],['plaza-wide',[2820,2370,.65]],['bench',[2520,2110,1]],['junction',[2500,1900,1]],['trees',[2100,1900,1]]]};
try{
 for(const theme of ['sunflower','home']){
  await page.goto(`http://127.0.0.1:5295/public/pixi-art/themes/sunflower/review.html?theme=${theme}`);
  await page.waitForFunction(t=>window.reviewReady&&(t==='home'||window.__duckyThemeArt?.includes(t)&&window.__duckyMapSleepers?.[t]?.length===40),theme,{timeout:120000});
  for(const [name,cam] of views[theme]){
   // The two overviews have identical world scale; Sunflower needs a larger canvas to fit.
   await page.setViewportSize(name==='island'?{width:2500,height:1800}:{width:1200,height:850});
   await page.evaluate(c=>window.reviewCamera(...c),cam);await page.waitForTimeout(850);
   await page.screenshot({path:`${out}/${theme}-${name}.png`});
  }
 }
 const whole=await sharp({create:{width:5000,height:1800,channels:3,background:'#6EC9DE'}}).composite([
  {input:`${out}/home-island.png`,left:0,top:0},{input:`${out}/sunflower-island.png`,left:2500,top:0}]).png().toFile(`${out}/sunflower-vs-home.png`);
 const panels=[];
 for(const [i,name]of ['plaza','bench','junction','trees'].entries())for(const [j,theme]of ['home','sunflower'].entries())panels.push({input:`${out}/${theme}-${name}.png`,left:j*1200,top:i*850});
 await sharp({create:{width:2400,height:3400,channels:3,background:'#6EC9DE'}}).composite(panels).png().toFile(`${out}/sunflower-closeups-vs-home.png`);
 writeFileSync(`${out}/browser.json`,JSON.stringify({errors,overviewZoom:.25,plazaZoom:1,detailZoom:1,comparison:'home left, sunflower right'},null,2));
 console.log({out,errors});if(errors.length)process.exitCode=1;
}finally{await browser.close();}
