// Actual Pixi renderer, port 5304, runtime-only registration. No shared code edits.
import {chromium} from '/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import sharp from 'sharp';
const OUT='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/lantern/';
const round=process.env.ROUND||'final';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
const base='http://127.0.0.1:5304/rive/web/themes/lantern/review.html';
await page.goto(base);
await page.waitForFunction(()=>window.reviewReady&&window.__duckyThemeArt?.includes('lantern'),null,{timeout:180000});
const views=[['plaza',[1980,2700,.65],[2820,2370,.65]],['bench-ring',[4180,4530,.8],[2890,2660,.8]],['path-junction',[2740,4050,.8],[2280,2290,.8]],['tree-cluster',[1310,2500,.65],[3530,3040,.65]]];
async function shot(name,c){await page.evaluate(c=>window.reviewCamera(...c),c);await page.waitForTimeout(1000);await page.screenshot({path:OUT+round+'-'+name+'.png'});}
await shot('lantern-overview',[4000,3000,.18]);
for(const [name,c]of views)await shot('lantern-'+name,c);
await shot('lantern-lake',[4700,2830,.55]);
const diagnostics=await page.locator('canvas').first().evaluate(n=>({...n.dataset}));
await page.goto(base+'?theme=home');await page.waitForFunction(()=>window.reviewReady,null,{timeout:120000});
await shot('home-overview',[2900,2200,.18]);
for(const [name,,c]of views)await shot('home-'+name,c);
await browser.close();
const label=(s,w)=>Buffer.from(`<svg width="${w}" height="36"><rect width="100%" height="100%" fill="#fff5d7"/><text x="14" y="25" font-family="Arial" font-size="18" fill="#39472d">${s}</text></svg>`);
const panels=[];for(const [col,t]of ['home','lantern'].entries()){panels.push({input:await sharp(OUT+round+'-'+t+'-overview.png').png().toBuffer(),left:col*1600,top:36},{input:label(t.toUpperCase()+' | actual Pixi, identical 0.18 zoom',1600),left:col*1600,top:0});}
await sharp({create:{width:3200,height:1136,channels:4,background:'#fff5d7'}}).composite(panels).png().toFile(OUT+round+'-ingame-lantern-vs-home.png');
const comps=[];for(const [row,[name,c]]of views.entries())for(const [col,t]of ['home','lantern'].entries()){const image=await sharp(OUT+round+'-'+t+'-'+name+'.png').resize(1000,688).png().toBuffer();comps.push({input:image,left:col*1000,top:row*724+36},{input:label(t.toUpperCase()+' | '+name+' | same zoom '+c[2],1000),left:col*1000,top:row*724});}
await sharp({create:{width:2000,height:2896,channels:4,background:'#fff5d7'}}).composite(comps).png().toFile(OUT+round+'-ingame-lantern-closeups-vs-home.png');
fs.writeFileSync(OUT+round+'-browser-diagnostics.json',JSON.stringify({diagnostics,errors},null,2));
console.log({round,diagnostics,errors});if(errors.length)process.exitCode=1;
