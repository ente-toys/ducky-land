const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  const context = await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const page = await context.newPage();
  page.on('pageerror',e=>console.log('PAGEERROR', e.message));
  page.on('console',m=>{if(m.type()==='error') console.log('CONSOLE',m.text())});
  await page.goto('http://127.0.0.1:8807/?quality=high');
  await page.waitForFunction(()=>window.game?.ready,{timeout:30000});
  await page.waitForTimeout(2000);
  console.log(await page.evaluate(()=>({ready:game.ready,quality:game.quality,camera:game.camera,dpr:devicePixelRatio,artboard:[game.r.artboardWidth,game.r.artboardHeight],slots:game.slots.length,visibility:document.visibilityState,screen:[innerWidth,innerHeight],backing:[c.width,c.height]})));
  await page.screenshot({path:'shots/phone-390-initial.png'});
  await page.evaluate(()=>game.startBenchmark()); await page.waitForTimeout(5000);
  const result = await page.evaluate(()=>game.stopBenchmark());
  fs.writeFileSync('qa/smoke.json',JSON.stringify(result,null,2)); delete result.rawFrames; console.log(result);
  await browser.close();
})();
