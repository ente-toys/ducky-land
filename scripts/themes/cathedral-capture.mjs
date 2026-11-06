// Run alongside `npx vite --port 5267 --strictPort --host 127.0.0.1`.
// Uses the actual PixiIsland renderer and runtime-only theme registration, no src edits.
import {chromium} from '/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {mkdirSync} from 'node:fs';
const OUT=process.env.OUT||'../concepts/themes/work/cathedral';mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:2000,height:1500},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://127.0.0.1:5267/pixi-art/themes/cathedral/review.html');
await page.waitForFunction(()=>window.reviewReady&&window.__duckyThemeArt?.includes('cathedral')&&window.__duckyMapSleepers?.cathedral?.length===40,null,{timeout:120000});
for(const [name,cam]of [['overview',[4000,3000,.25]],['piazza',[4100,2680,.65]],['cathedral',[4100,1650,.65]],['garden',[1770,3310,.65]],['beach',[6400,3900,.65]]]){await page.evaluate(c=>window.reviewCamera(...c),cam);await page.waitForTimeout(1600);await page.screenshot({path:`${OUT}/ingame-cathedral-${name}.png`});}
console.log('cathedral diagnostics',await page.locator('canvas').first().evaluate(n=>({...n.dataset})),errors);
await page.goto('http://127.0.0.1:5267/pixi-art/themes/cathedral/review.html?theme=home');await page.waitForFunction(()=>window.reviewReady);await page.evaluate(()=>window.reviewCamera(2820,2370,.65));await page.waitForTimeout(2000);await page.screenshot({path:`${OUT}/ingame-cathedral-home-reference.png`});await browser.close();
if(errors.length)throw Error(errors.join('\n'));
