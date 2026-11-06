// Actual Pixi evidence. Run with Vite on 5301. Only writes Library work images.
import {chromium} from '/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {mkdirSync} from 'node:fs';
import sharp from 'sharp';
const OUT=process.env.OUT||'../concepts/themes/work/peaks';mkdirSync(OUT,{recursive:true});
const BASE=process.env.BASE||'http://127.0.0.1:5301',round=process.argv[2]||'close-final';
const views=[
 ['overview',[2900,2200,.18],[4000,2900,.18]],
 ['plaza',[2820,2370,.65],[4000,3100,.65]],
 ['summit',[2920,1130,.65],[3150,1050,.65]],
 ['court',[2820,2370,.65],[5700,2850,.65]],
 ['bench',[2537,2118,.65],[3530,2810,.65]],
 ['junction',[3050,3080,.65],[4470,3420,.65]],
 ['grove',[2120,3210,.65],[2870,3340,.65]],
];
const browser=await chromium.launch({headless:true});
const errors=[],shots={home:[],peaks:[]};
try {
 const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(String(e)));
 for(const theme of ['peaks','home']){
  await page.goto(BASE+'/public/pixi-art/themes/peaks/review.html?theme='+theme);
  await page.waitForFunction(()=>window.reviewReady,null,{timeout:120000});
  if(theme==='peaks')await page.waitForFunction(()=>window.__duckyThemeArt?.includes('peaks')&&window.__duckyMapSleepers?.peaks?.length===40,null,{timeout:120000});
  for(const [name,home,peaks]of views){
   await page.evaluate(c=>window.reviewCamera(...c),theme==='home'?home:peaks);await page.waitForTimeout(900);
   const path=`${OUT}/ingame-peaks-${round}-${theme}-${name}.png`;await page.screenshot({path});shots[theme].push(path);
  }
  if(theme==='peaks')console.log('Library diagnostics',await page.locator('canvas').first().evaluate(n=>({...n.dataset})));
 }
 for(const [name,indices]of [['overview',[0]],['closeups',[1,2,3,4,5,6]]]){
  const panels=[];
  for(const [row,index]of indices.entries())for(const [column,theme]of ['home','peaks'].entries()){
   panels.push({input:shots[theme][index],left:column*1600,top:row*1150+50});
   panels.push({input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="50"><rect width="100%" height="100%" fill="#fff5d5"/><text x="22" y="34" font-family="sans-serif" font-size="24" fill="#39472d">${theme.toUpperCase()} / ${views[index][0]} / live Pixi / zoom ${views[index][1][2]}</text></svg>`),left:column*1600,top:row*1150});
  }
  await sharp({create:{width:3200,height:indices.length*1150,channels:4,background:'#fff5d5'}}).composite(panels).png().toFile(`${OUT}/peaks-live-${name}-vs-home-${round}.png`);
 }
 if(errors.length)throw Error(errors.join('\n'));
} finally {await browser.close();}
