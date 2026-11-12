import {chromium} from '/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='../concepts/themes/world-map/sphere';mkdirSync(out,{recursive:true});
const result={kind:'Live Pixi headless Chromium',scenarios:[],errors:[]};let browser;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1400,height:1000},deviceScaleFactor:1});
 page.on('pageerror',e=>result.errors.push(String(e)));
 await page.goto((process.env.SPHERE_URL??'http://127.0.0.1:5317')+'/scripts/bigger-home/review.html?qa=1');
 await page.waitForFunction(()=>window.reviewReady&&!game.sceneryPending,null,{timeout:120000});
 await page.evaluate(()=>{game.quietAt=Infinity;});
 for(const [name,lon,lat,id,zoom]of [['front',0,0,'home',0],['back',180,0,'home',0],['left',-90,0,'home',0],['right',90,0,'home',0],['top',0,90,'home',0],['bottom',0,-90,'home',0],['mid-home',0,0,'home',.065],['mid-iceland',0,90,'isle-55',.065],['Home play',0,0,'home',.8]]){
  await page.evaluate(async({lon,lat,id,zoom})=>{
   const {sphereFrame}=await import('/src/pixi/sphere.js'),{localPoint}=await import('/src/pixi/sphere-coordinates.js');
   if(game.islandId!==id)game.switchIsland(id);
   const point=localPoint(id,sphereFrame(lon*Math.PI/180,lat*Math.PI/180).center);
   reviewCamera(point.x,point.y,zoom||game.birdZoom());game.quietAt=Infinity;
  },{lon,lat,id,zoom});
  await page.waitForTimeout(1500);
  const stats=await page.evaluate(async()=>{
   const intervals=[],cpu=[];let last=performance.now(),tick=game.tick;
   game.tick=function(...args){const at=performance.now();try{return tick.apply(this,args);}finally{cpu.push(performance.now()-at);}};
   try{for(let i=0;i<240;i++)await new Promise(resolve=>requestAnimationFrame(now=>{intervals.push(now-last);last=now;resolve();}));}finally{game.tick=tick;}
   const stats=a=>{a.sort((x,y)=>x-y);return {medianMs:a[Math.floor(a.length*.5)],p95Ms:a[Math.floor(a.length*.95)],maxMs:a.at(-1)};};
   return {frames:stats(intervals.slice(1)),cpu:stats(cpu),ground:game.groundPool.stats(),camera:game.camera,globeT:game.globeT};
  });
  result.scenarios.push({name,...stats});await page.screenshot({path:`${out}/browser-${name.replaceAll(' ','-')}.png`});
 }
 if(result.errors.length)throw Error(result.errors.join('\n'));
}catch(error){result.blocked=String(error);process.exitCode=1;console.error(result.blocked);}
finally{await browser?.close();writeFileSync(`${out}/browser-validation.json`,JSON.stringify(result,null,2)+'\n');}
