import { chromium } from '/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import sharp from 'sharp';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='../concepts/themes/work/pink';mkdirSync(out,{recursive:true});
const tag=process.argv[2]??'after';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5296/?offline&qa');
 await page.waitForFunction(()=>window.__duckyEngine?.initialized,{timeout:120000});
 await page.addStyleTag({content:'.hud,.topbar,header,button{visibility:hidden!important}'});
 const views={pink:[[4000,2800,.175],[4000,2810,.7],[3500,3200,.7],[3300,2260,.7],[6750,1850,.7],[2198,3337,.7],[3150,3730,.7],[2580,1030,.7],[4820,3730,.7],[4000,3400,.7]],home:[[2900,2200,.175],[2820,2370,.7],[2870,2670,.7],[2250,2780,.7],[2000,2200,.7],[2820,2370,.7],[2820,2370,.7],[2000,2200,.7],[2820,2370,.7],[2820,2700,.7]]};
 for(const theme of ['pink','home']){
  await page.evaluate(async theme=>{const e=window.__duckyEngine;const {THEME_OF}=await import('/src/pixi/island-maps.js');const id=theme==='home'?'home':[...THEME_OF].find(([,t])=>t===theme)?.[0];if(!id)throw Error('Theme not registered: '+theme);e.switchIsland(id);},theme);
  if(theme==='pink') await page.waitForFunction(()=>window.__duckyThemeArt?.includes('pink'),{timeout:120000});
  for(let i=0;i<views[theme].length;i++){
   await page.evaluate(([x,y,zoom])=>{const e=window.__duckyEngine;e.follow=false;e.fitMode=false;e.fly=null;Object.assign(e.camera,{x,y,zoom});Object.assign(e.target,e.camera);},views[theme][i]);
   await page.waitForTimeout(1000);
   await page.screenshot({path:`${out}/${tag}-${theme}-${i}.png`});
  }
 }
 const sheets=[['pink-vs-home',[0]],['pink-closeups-vs-home',[1,2,3,4]]];
 for(const [name,ids] of sheets){
  const comps=[];for(const [row,i]of ids.entries())for(const [col,t]of ['home','pink'].entries())comps.push({input:await sharp(`${out}/${tag}-${t}-${i}.png`).resize(800,550).png().toBuffer(),left:col*800,top:row*550});
  await sharp({create:{width:1600,height:550*ids.length,channels:3,background:'#fff'}}).composite(comps).png().toFile(`${out}/${tag}-${name}.png`);
 }
 writeFileSync(`${out}/${tag}-browser.json`,JSON.stringify({url:page.url(),errors},null,2));console.log({tag,errors});
}finally{await browser.close()}
