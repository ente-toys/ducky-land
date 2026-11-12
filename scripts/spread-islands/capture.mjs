import {chromium} from '/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const tag=process.argv[2]??'after',out='../concepts/themes/world-map/spread';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1400,height:1000},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
try {
 await page.goto('http://127.0.0.1:5319/scripts/bigger-home/review.html');
 await page.waitForFunction(()=>window.reviewReady&&!game.sceneryPending,null,{timeout:120000});
 await page.evaluate(()=>{game.quietAt=Infinity;window.reviewCamera(game.mapHere().cx,game.mapHere().cy,game.birdZoom());});
 await page.waitForFunction(async()=>{const {FINISHED_THEMES}=await import('/src/pixi/world-map.js');return FINISHED_THEMES.every(t=>game.archipelago.has(t));},null,{timeout:180000});
 const angles=[0,120,240],states=[];
 for(const degrees of angles){
  await page.evaluate(degrees=>{const b=game.archipelago.bounds,R=(b.x1-b.x0)/(2*Math.PI);game.spin=null;game.quietAt=Infinity;window.reviewCamera((b.x0+b.x1)/2+degrees*Math.PI/180*R,(b.y0+b.y1)/2,game.birdZoom());},degrees);
  await page.waitForTimeout(400);
  await page.screenshot({path:`${out}/${tag}-${degrees}.png`});
  states.push(await page.evaluate(()=>({camera:{...game.camera},ball:game.worldView.globe.ball,islands:game.archipelago.islands.map(i=>({id:i.id,map:i.map,x:i.x,y:i.y,width:i.width,height:i.height})),count:game.archipelago.count})));
 }
 writeFileSync(`${out}/${tag}-runtime.json`,JSON.stringify({errors,states},null,2));
 if(errors.length)throw Error(errors.join('\n'));
 console.log(`${tag}: three globe views captured, ${states[0].count} islands, all 12 snapshots loaded`);
} finally {await browser.close();}
