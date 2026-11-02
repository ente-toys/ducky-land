import { chromium } from '/Users/pragadees.xd/Developer/ente-paste-video/.tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch({executablePath:'/Users/pragadees.xd/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const page = await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://127.0.0.1:8805/');
await page.waitForFunction(()=>window.game?.slots?.length===16);
await page.waitForTimeout(1000);
console.log('READY',await page.evaluate(()=>({visibility:document.visibilityState,state:game.r.isPlaying,ducks:game.ducks.length,riv:performance.getEntriesByType('resource').filter(e=>e.name.includes('.riv')).map(e=>({bytes:e.decodedBodySize,url:e.name})),audio:game.audio.context?.state})));
await page.screenshot({path:'shots/plaza-browser-first.png'});
for(let k=1;k<=7;k++){
  await page.keyboard.press(String(k)); await page.waitForTimeout(k===5?720:400);
  console.log('EMOTE',k,await page.evaluate(()=>({action:game.player.action,emoting:game.player.emoting,played:game.audio.played,audio:game.audio.context?.state})));
  await page.screenshot({path:`shots/emote-${k}-plaza.png`});
  await page.waitForTimeout(2200);
}
console.log('ERRORS',errors);
await browser.close();
