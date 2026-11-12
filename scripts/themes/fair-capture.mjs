import {chromium} from '/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {mkdirSync} from 'node:fs';
const OUT=process.env.OUT||'/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/fair';mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1600,height:1200},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://127.0.0.1:5265/pixi-art/themes/fair/review.html');
await page.waitForFunction(()=>window.reviewReady&&window.__duckyThemeArt?.includes('fair')&&window.__duckyMapSleepers?.fair?.length===40,null,{timeout:120000});
for(const [name,cam]of [['overview',[3625,2425,.23]],['centre',[3570,2740,1.05]],['fair',[3570,1900,.65]],['garden',[1600,2300,.65]],['beach',[6200,3300,.65]]]){await page.evaluate(c=>window.reviewCamera(...c),cam);await page.waitForTimeout(1600);await page.screenshot({path:`${OUT}/ingame-fair-${name}.png`});}
console.log('fair diagnostics',await page.locator('canvas').first().evaluate(n=>({...n.dataset})),errors);
await page.goto('http://127.0.0.1:5265/pixi-art/themes/fair/review.html?theme=home');await page.waitForFunction(()=>window.reviewReady);await page.evaluate(()=>window.reviewCamera(2820,2370,.65));await page.waitForTimeout(2000);await page.screenshot({path:`${OUT}/ingame-fair-home-reference.png`});await browser.close();
if(errors.length)throw Error(errors.join('\n'));
