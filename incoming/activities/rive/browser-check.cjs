const {chromium}=require('/Users/pragadees.xd/Developer/slap-series/node_modules/playwright-core');
(async()=>{
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://127.0.0.1:8802/bread.html');await page.waitForFunction(()=>window.game,{timeout:20000});
await page.waitForTimeout(300);await page.screenshot({path:'rive/shots/bread-intro.png'});
await page.keyboard.press('Enter');await page.waitForTimeout(300);await page.screenshot({path:'rive/shots/bread-playing.png'});
console.log('BREAD',await page.evaluate(()=>({phase:game.activity.phase,bread:game.activity.bread.length,animations:game.r.animationNames,vmi:!!game.vmi,visible:document.visibilityState})));
await page.goto('http://127.0.0.1:8802/race.html');await page.waitForFunction(()=>window.game,{timeout:20000});
await page.waitForTimeout(300);await page.screenshot({path:'rive/shots/race-intro.png'});
await page.keyboard.press('Enter');await page.waitForTimeout(250);await page.screenshot({path:'rive/shots/race-countdown.png'});
await page.waitForTimeout(3000);for(let i=0;i<10;i++){await page.keyboard.press('Space');await page.waitForTimeout(130);}
await page.screenshot({path:'rive/shots/race-playing.png'});
console.log('RACE',await page.evaluate(()=>({phase:game.activity.phase,taps:game.activity.taps,racers:game.activity.racers.map(d=>({name:d.name,p:d.progress})),animations:game.r.animationNames})));
console.log('ERRORS',errors);await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
