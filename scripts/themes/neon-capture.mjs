import {chromium} from '/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import sharp from 'sharp';
const OUT='../concepts/themes/work/neon/';fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
const shots={neon:{plaza:[3844,2110,.6],bench:[4130,2660,.6],junction:[3844,3390,.6],trees:[1600,2850,.6],activity:[2436.4,2944.8,.6],market:[1500,2130,.6]},home:{plaza:[2820,2290,.6],bench:[3230,2300,.6],junction:[2920,1710,.6],trees:[2220,2050,.6],activity:[2820,2290,.6],market:[2920,1710,.6]}};
for(const theme of ['neon','home']){
 await page.goto('http://127.0.0.1:5291/assets/world/themes/neon/review.html?theme='+theme);
 await page.waitForFunction(()=>window.reviewReady,null,{timeout:120000});
 for(const [name,cam]of Object.entries(shots[theme])){
  await page.evaluate(c=>window.reviewCamera(...c),cam);await page.waitForTimeout(700);
  await page.screenshot({path:`${OUT}${theme}-${name}.png`});
 }
 if(theme==='neon')console.log(await page.evaluate(()=>({sleepers:window.__duckyMapSleepers?.neon?.length,themeArt:window.__duckyThemeArt})));
}
await browser.close();
const w=800,h=550,lh=38,panels=[];
for(const [i,key]of Object.keys(shots.neon).entries())for(const [j,theme]of ['home','neon'].entries()){
 const image=await sharp(`${OUT}${theme}-${key}.png`).resize(w,h).png().toBuffer();
 const label=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${lh}"><rect width="100%" height="100%" fill="#FFF0C7"/><text x="16" y="25" font-family="sans-serif" font-size="18">${theme.toUpperCase()} | ${key} | same camera scale</text></svg>`);
 panels.push({input:label,left:j*w,top:i*(h+lh)},{input:image,left:j*w,top:i*(h+lh)+lh});
}
await sharp({create:{width:w*2,height:Object.keys(shots.neon).length*(h+lh),channels:4,background:'#6EC9DE'}}).composite(panels).png().toFile(OUT+'neon-browser-closeups-vs-home.png');
fs.writeFileSync('public/pixi-art/themes/neon/browser-results.json',JSON.stringify({port:5291,realEngine:true,errors,views:Object.keys(shots.neon)},null,2));
if(errors.length)throw Error(errors.join('\n'));
