import {chromium} from '/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1160},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
for(const mode of ['overview','centre']){
 await page.goto(`http://127.0.0.1:${process.env.PORT||5298}/rive/web/themes/community/preview.html?still`+(mode==='centre'?'&centre':''));
 await page.waitForFunction(()=>window.communityPreview?.ready,null,{timeout:60000});
 await page.screenshot({path:`../concepts/themes/work/community/browser-${mode}.png`});
 console.log(mode,await page.evaluate(()=>({sleepers:communityPreview.sleepers.length,props:communityPreview.art.props.length})));
}
const motion=await page.evaluate(()=>{
 let p=communityPreview.art.props.find(p=>p.id==='campfire-flame');communityPreview.update(0);let a=[p.sprite.scale.x,p.sprite.scale.y,p.sprite.alpha];communityPreview.update(.23);let b=[p.sprite.scale.x,p.sprite.scale.y,p.sprite.alpha];return {a,b,changed:a.some((v,i)=>v!==b[i])};
});
await page.screenshot({path:'../concepts/themes/work/community/centre-fire-b.png'});
await page.emulateMedia({reducedMotion:'reduce'});
const reduced=await page.evaluate(()=>{const p=communityPreview.art.props.find(p=>p.id==='campfire-flame');communityPreview.update(0);const a=[p.sprite.scale.x,p.sprite.scale.y,p.sprite.alpha,p.sprite.skew.x];communityPreview.update(.8);const b=[p.sprite.scale.x,p.sprite.scale.y,p.sprite.alpha,p.sprite.skew.x];return {a,b,stable:a.every((v,i)=>v===b[i])}});
console.log({errors,motion,reduced});
fs.writeFileSync('rive/web/themes/community/browser-validation.json',JSON.stringify({errors,motion,reduced},null,2));
await browser.close();if(errors.length||!motion.changed||!reduced.stable)process.exitCode=1;
