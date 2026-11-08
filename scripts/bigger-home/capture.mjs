import {chromium} from '/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';
const OUT='../concepts/themes/world-map/bigger';mkdirSync(OUT+'/ground-crops',{recursive:true});
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1400,height:1000},deviceScaleFactor:1}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try {await page.goto('http://127.0.0.1:5309/scripts/bigger-home/review.html');await page.waitForFunction(()=>window.reviewReady&&!game.sceneryPending,null,{timeout:120000});
const at=([x,y])=>[(x-278)/.18,(y-204)/.18];
const views=[['village',[225,425],.8],['garden',[766,177],.8],['market',[1262,269],.8],['pond',[343,852],.8],['picnic',[975,987],.8],['swan-cove',[1326,514],.8]];
for(const [name,p,z]of views){await page.evaluate(([x,y,z])=>window.reviewCamera(x,y,z),[...at(p),z]);await page.waitForTimeout(650);await page.screenshot({path:`${OUT}/ground-crops/${name}.png`});}
await page.evaluate(()=>window.reviewCamera(2878,2089,.16));await page.waitForTimeout(800);await page.screenshot({path:`${OUT}/home-live-overview.png`});
await page.evaluate(()=>window.reviewCamera(2878,2089,.006));await page.waitForFunction(()=>game.archipelago?.has('home'),null,{timeout:120000});await page.waitForTimeout(1000);await page.screenshot({path:`${OUT}/home-globe.png`});
const runtime=await page.evaluate(()=>({state:game.canvas.dataset.state,originalSleepers:globalThis.__duckySleepers,props:globalThis.__duckyProps.length,origin:game.mapHere().origin,snapshotSize:{w:game.archipelago.texture.width,h:game.archipelago.texture.height},globe:game.globeT,reviewError:window.reviewError}));writeFileSync(OUT+'/work/runtime.json',JSON.stringify({errors,runtime},null,2));console.log(JSON.stringify({errors,state:runtime.state,props:runtime.props,sleepers:runtime.originalSleepers.length,snapshot:runtime.snapshotSize}));if(errors.length||runtime.reviewError)throw Error('Browser errors');
} finally{await browser.close();}
