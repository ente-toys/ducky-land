import {chromium} from '/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {mkdirSync, writeFileSync} from 'node:fs';
const tag=process.argv[2]??'before';
const out='../concepts/themes/work/live-persp';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:1200,height:1050},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5298/?offline&qa');
  await page.waitForFunction(()=>window.__duckyEngine?.initialized,null,{timeout:120000});
  await page.addStyleTag({content:'.hud,.topbar,header,button{visibility:hidden!important}'});
  for(const [theme,x,y] of [['home',2900,1450],['pink',4000,2500],['waterfall',3900,3620],['fair',3570,2737.5]]) {
    await page.evaluate(async theme=>{
      const {THEME_OF}=await import('/src/pixi/island-maps.js');
      const id=theme==='home'?'home':[...THEME_OF].find(([,t])=>t===theme)?.[0];
      window.__duckyEngine.switchIsland(id);
    },theme);
    if(theme!=='home')await page.waitForFunction(t=>window.__duckyThemeArt?.includes(t),theme,{timeout:120000});
    await page.evaluate(([x,y])=>{
      const e=window.__duckyEngine;e.follow=false;e.fitMode=false;e.fly=null;
      Object.assign(e.camera,{x,y,zoom:.7});Object.assign(e.target,e.camera);
    },[x,y]);
    await page.waitForTimeout(1500);
    await page.screenshot({path:`${out}/${tag}-${theme}-game.png`});
    const info=await page.evaluate(theme=>({sleepers:window.__duckyMapSleepers?.[theme]?.length??null,
      camera:window.__duckyEngine.camera,ready:window.__duckyThemeArt}),theme);
    writeFileSync(`${out}/${tag}-${theme}-game.json`,JSON.stringify(info,null,2)+'\n');
  }
  writeFileSync(`${out}/${tag}-browser.json`,JSON.stringify({errors},null,2)+'\n');
  if(errors.length)throw Error(errors.join('\n'));
  console.log('Captured',tag,'Home, Pink, Waterfall and Fair in the real Pixi renderer.');
} finally {await browser.close();}
