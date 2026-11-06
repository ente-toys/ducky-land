// Run alongside `npx vite --port 5305 --strictPort --host 127.0.0.1`.
// Uses the actual PixiIsland renderer and runtime-only theme registration, no src edits.
import {chromium} from '/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {mkdirSync} from 'node:fs';
const OUT=process.env.OUT||'/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/blossom';mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1600,height:1200},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://127.0.0.1:5305/pixi-art/themes/blossom/review.html');
await page.waitForFunction(()=>window.reviewReady&&window.__duckyThemeArt?.includes('blossom')&&window.__duckyMapSleepers?.blossom?.length===40,null,{timeout:120000});
for(const [name,cam]of [['overview',[3800,2700,.22]],['centre',[3640,2525,.65]],['gate',[3540,3950,.65]],['garden',[1500,2570,.65]],['beach',[6100,3400,.65]]]){await page.evaluate(c=>window.reviewCamera(...c),cam);await page.waitForTimeout(1600);await page.screenshot({path:`${OUT}/ingame-blossom-${name}.png`});}
console.log('blossom diagnostics',await page.locator('canvas').first().evaluate(n=>({...n.dataset})),errors);
await page.goto('http://127.0.0.1:5305/pixi-art/themes/blossom/review.html?theme=home');await page.waitForFunction(()=>window.reviewReady);await page.evaluate(()=>window.reviewCamera(2820,2370,.65));await page.waitForTimeout(2000);await page.screenshot({path:`${OUT}/ingame-blossom-home-reference.png`});await browser.close();
if(errors.length)throw Error(errors.join('\n'));
