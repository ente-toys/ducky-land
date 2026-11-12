import {chromium} from '/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const tag=process.argv[2]??'after',out='../concepts/themes/world-map/spread';mkdirSync(out,{recursive:true});
let browser;const result={tag,viewport:{width:1400,height:1000,dpr:1},scenarios:[],errors:[]};
try{
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1400,height:1000},deviceScaleFactor:1});
 page.on('pageerror',e=>result.errors.push(String(e)));
 await page.addInitScript(()=>{
  const sizes=new Map(),bindings=new Map();let unit=0,peak=0;
  const bytes=()=>[...sizes.values()].reduce((a,b)=>a+b,0);
  window.textureMemory=()=>({bytes:bytes(),peakBytes:peak,textures:sizes.size,method:'Tracked RGBA8-equivalent WebGL allocations. Excludes driver and renderbuffer overhead.'});
  for(const proto of [WebGLRenderingContext.prototype,WebGL2RenderingContext.prototype]){
   for(const name of ['activeTexture','bindTexture','texImage2D','texStorage2D','deleteTexture']){
    const original=proto[name];if(!original)continue;
    proto[name]=function(...a){
     const ret=original.apply(this,a);
     if(name==='activeTexture')unit=a[0];
     if(name==='bindTexture')bindings.set(`${unit}/${a[0]}`,a[1]);
     if(name==='deleteTexture')sizes.delete(a[0]);
     if(name==='texStorage2D'||name==='texImage2D'){
      const texture=bindings.get(`${unit}/${a[0]}`);
      let w,h,levels=1;
      if(name==='texStorage2D'){[,levels,,w,h]=a;}
      else if(a.length>=9){w=a[3];h=a[4];}
      else {const src=a[5];w=src?.videoWidth||src?.width;h=src?.videoHeight||src?.height;}
      if(texture&&w&&h){let n=0;for(let k=0;k<levels;k++)n+=Math.max(1,w>>k)*Math.max(1,h>>k)*4;sizes.set(texture,n);peak=Math.max(peak,bytes());}
     }
     return ret;
    };
   }
  }
 });
 await page.goto((process.env.PERF_URL??'http://127.0.0.1:5317')+'/scripts/bigger-home/review.html?qa=1');
 await page.waitForFunction(()=>window.reviewReady&&!game.sceneryPending,null,{timeout:120000});
 await page.evaluate(()=>{game.quietAt=Infinity;});
 const cdp=await page.context().newCDPSession(page);
 const sample=async name=>{
  await page.waitForTimeout(2000);
  const metrics=await page.evaluate(async()=>{
   const intervals=[],cpu=[];let last=performance.now();const original=game.tick;
   game.tick=function(...args){const at=performance.now();try{return original.apply(this,args);}finally{cpu.push(performance.now()-at);}};
   try{for(let i=0;i<360;i++)await new Promise(resolve=>requestAnimationFrame(now=>{intervals.push(now-last);last=now;resolve();}));}
   finally{game.tick=original;}
   const stats=a=>{a.sort((x,y)=>x-y);return {medianMs:a[Math.floor(a.length*.5)],p95Ms:a[Math.floor(a.length*.95)],maxMs:a.at(-1),samples:a.length};};
   return {frames:stats(intervals.slice(1)),cpu:stats(cpu),gpuTextures:window.textureMemory(),ground:game.groundPool?.stats(),art:[...game.arts.keys()],camera:{...game.camera},globeT:game.globeT};
  });
  metrics.jsHeap=await cdp.send('Runtime.getHeapUsage');result.scenarios.push({name,...metrics});
  console.log(name,JSON.stringify(metrics));
 };
 await page.evaluate(()=>reviewCamera(game.mapHere().cx,game.mapHere().cy,game.birdZoom()));
 await page.waitForFunction(async()=>{const {FINISHED_THEMES}=await import('/src/pixi/world-map.js');return FINISHED_THEMES.every(t=>game.archipelago.has(t));},null,{timeout:180000});
 await sample('globe');
 for(const degrees of [0,120,240]){
  await page.evaluate(degrees=>{const b=game.archipelago.bounds,R=(b.x1-b.x0)/(2*Math.PI);reviewCamera((b.x0+b.x1)/2+degrees*Math.PI/180*R,(b.y0+b.y1)/2,game.birdZoom());},degrees);
  await page.waitForTimeout(400);await page.screenshot({path:`${out}/perf-${tag}-browser-${degrees}.png`});
 }
 await page.evaluate(()=>reviewCamera(game.mapHere().cx,game.mapHere().cy,Math.sqrt(game.minZoom*.95*game.birdZoom())));await sample('mid-zoom');
 await page.evaluate(()=>reviewCamera(game.sim.player.x,game.sim.player.y,.8));await sample('Home');
 await page.evaluate(async()=>{
  const {destinationsFor,harborOf,sailRoute,sailStep}=await import('/src/pixi/islands.js');
  const start=harborOf('home').water,to=destinationsFor('home')[0].dock,route=sailRoute('home',start,to);
  if(!route?.length)throw Error('No sailing benchmark route');
  const actor={...start,islandId:'home',mode:'sailing',sailTarget:route[0],sailRoute:route.slice(1)};
  const original=game.tick;game.benchmarkSailOriginal=original;
  game.tick=function(now){sailStep(actor,1/60,{x:0,y:0});reviewCamera(actor.x,actor.y,.5);return original.call(this,now);};
 });
 await sample('sailing route');
 await page.evaluate(()=>{game.tick=game.benchmarkSailOriginal;});
 if(result.errors.length)throw Error(result.errors.join('\n'));
}catch(error){result.blocked=String(error);process.exitCode=1;console.error(result.blocked);}
finally{if(browser)await browser.close();writeFileSync(`${out}/perf-${tag}-browser.json`,JSON.stringify(result,null,2)+'\n');}
