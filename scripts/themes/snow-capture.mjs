import {chromium} from '/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
import sharp from 'sharp';
const OUT='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/snow/',round=process.env.ROUND||'round-1';mkdirSync(OUT+round,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1200},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://127.0.0.1:5302/scripts/themes/snow-review.html');
await page.waitForFunction(()=>window.reviewReady&&window.__duckyThemeArt?.includes('snow'),null,{timeout:120000});
const views=[['island',[3750,2750,.22]],['plaza',[3555,2478,1]],['bench',[3730,2920,1]],['junction',[2720,2790,1]],['trees',[2760,2000,1]],['lodge',[1755,1370,.9]],['skating',[5436,2267,.7]],['igloos',[4770,1330,.9]]];
for(const [name,cam]of views){await page.evaluate(c=>window.reviewCamera(...c),cam);await page.waitForTimeout(1100);await page.screenshot({path:`${OUT}${round}/snow-${name}.png`})}
await page.goto('http://127.0.0.1:5302/scripts/themes/snow-review.html?theme=home');await page.waitForFunction(()=>window.reviewReady,null,{timeout:120000});
for(const [name,cam]of [['island',[2900,2200,.22]],['plaza',[2820,2370,1]],['bench',[2520,2110,1]],['junction',[2500,1900,1]],['trees',[2100,1900,1]]]){await page.evaluate(c=>window.reviewCamera(...c),cam);await page.waitForTimeout(1100);await page.screenshot({path:`${OUT}${round}/home-${name}.png`})}
await browser.close();
await sharp({create:{width:3200,height:1200,channels:4,background:'#8CC8CD'}}).composite([{input:OUT+round+'/home-island.png',left:0,top:0},{input:OUT+round+'/snow-island.png',left:1600,top:0}]).png().toFile(OUT+round+'/snow-vs-home.png');
const labels=(s)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="42"><rect width="1600" height="42" fill="#FFF3D2"/><text x="24" y="29" font-family="sans-serif" font-size="22" fill="#39472D">${s}</text></svg>`),comps=[];
for(const [row,name]of ['plaza','bench','junction','trees'].entries())for(const [col,t]of ['home','snow'].entries()){comps.push({input:OUT+round+'/'+t+'-'+name+'.png',left:col*1600,top:row*1242+42},{input:labels(t.toUpperCase()+' / '+name+' / actual Pixi renderer / 1 pixel per world unit'),left:col*1600,top:row*1242})}
await sharp({create:{width:3200,height:4968,channels:4,background:'#8CC8CD'}}).composite(comps).png().toFile(OUT+round+'/snow-closeups-vs-home.png');
writeFileSync(OUT+round+'/browser.json',JSON.stringify({errors,port:5302,renderer:'actual PixiIsland, runtime-only Snowdrift registration',views},null,2));if(errors.length)throw Error(errors.join('\n'));console.log('Captured whole island and game zoom comparisons',round);
