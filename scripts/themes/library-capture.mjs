import {chromium} from '/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {mkdirSync} from 'node:fs';
import sharp from 'sharp';
const OUT=process.env.OUT||'../concepts/themes/work/library';mkdirSync(OUT,{recursive:true});
const BASE=process.env.BASE||'http://127.0.0.1:5297',round=process.argv[2]||'close-final';
const views=[
 ['overview',[2900,2200,.185],[4000,2800,.185]],
 ['plaza',[2820,2370,.65],[2412,2566,.65]],
 ['bookstore',[2820,2370,.65],[5868,1760,.65]],
 ['court',[2820,2370,.65],[6108,3658,.65]],
 ['bench',[2537,2118,.65],[5700,3300,.65]],
 ['junction',[3050,3080,.65],[5148,3658,.65]],
 ['grove',[2120,3210,.65],[2890,4160,.65]],
];
const browser=await chromium.launch({headless:true});
const errors=[],shots={home:[],library:[]};
try {
 const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(String(e)));
 for(const theme of ['library','home']){
  await page.goto(BASE+'/pixi-art/themes/library/review.html?theme='+theme);
  await page.waitForFunction(()=>window.reviewReady,null,{timeout:120000});
  if(theme==='library')await page.waitForFunction(()=>window.__duckyThemeArt?.includes('library')&&window.__duckyMapSleepers?.library?.length===40,null,{timeout:120000});
  for(const [name,home,library]of views){
   await page.evaluate(c=>window.reviewCamera(...c),theme==='home'?home:library);await page.waitForTimeout(900);
   const path=`${OUT}/ingame-library-${round}-${theme}-${name}.png`;await page.screenshot({path});shots[theme].push(path);
  }
  if(theme==='library')console.log('Library diagnostics',await page.locator('canvas').first().evaluate(n=>({...n.dataset})));
 }
 for(const [name,indices]of [['overview',[0]],['closeups',[1,2,3,4,5,6]]]){
  const panels=[];
  for(const [row,index]of indices.entries())for(const [column,theme]of ['home','library'].entries()){
   panels.push({input:shots[theme][index],left:column*1600,top:row*1150+50});
   panels.push({input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="50"><rect width="100%" height="100%" fill="#fff5d5"/><text x="22" y="34" font-family="sans-serif" font-size="24" fill="#39472d">${theme.toUpperCase()} / ${views[index][0]} / live Pixi / zoom ${views[index][1][2]}</text></svg>`),left:column*1600,top:row*1150});
  }
  await sharp({create:{width:3200,height:indices.length*1150,channels:4,background:'#fff5d5'}}).composite(panels).png().toFile(`${OUT}/library-live-${name}-vs-home-${round}.png`);
 }
 if(errors.length)throw Error(errors.join('\n'));
} finally {await browser.close();}
