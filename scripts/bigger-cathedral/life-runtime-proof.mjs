// An in-memory origin lets this check run without binding a server socket.
import {chromium} from '/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),out='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/bellovo-review/fix/life/';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1400,height:1000},deviceScaleFactor:2}),errors=[],failed=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const types={'.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.json':'application/json','.js':'text/javascript','.woff2':'font/woff2'};
await page.route('http://bellovo.test/**',async route=>{
 const p=decodeURIComponent(new URL(route.request().url()).pathname);
 if(p==='/')return route.fulfill({contentType:'text/html',body:'<html><head><style>html,body,#game{margin:0;width:100%;height:100%;overflow:hidden}</style></head><body><div id="game"></div><script type="module" src="/runtime.js"></script></body></html>'});
 const file=p==='/runtime.js'?'/private/tmp/bellovo-life-runtime.js':path.join(root,'public',p);
 if(fs.existsSync(file))return route.fulfill({contentType:types[path.extname(file)]??'application/octet-stream',body:fs.readFileSync(file)});
 failed.push(p);return route.fulfill({status:404,body:'not found'});
});
try{
 await page.goto('http://bellovo.test/');
 await page.waitForFunction(()=>window.reviewReady&&window.game.arts.get('cathedral')?.ready,{timeout:120000});
 for(const [name,x,y,zoom]of [['whole',4200,2800,.105],['grove',100,1050,.8],['well',4100,2860,.75],['fountain',4100,4250,1]]){
  await page.evaluate(([x,y,zoom])=>window.reviewCamera(x,y,zoom),[x,y,zoom]);await page.waitForTimeout(500);
  await page.screenshot({path:out+'runtime-'+name+'.png'});
 }
 await page.evaluate(()=>window.reviewCamera(100,1050,.8));await page.waitForTimeout(500);
 const normal=await page.evaluate(()=>{const a=game.arts.get('cathedral');return {theme:game.artShown,sleepers:__duckyMapSleepers.cathedral.length,leaves:a.autumnLeaves.stats,props:a.props.length,renderer:game.app.renderer.type,reviewError:window.reviewError};});
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);
 const reduced=await page.evaluate(()=>game.arts.get('cathedral').autumnLeaves.stats);
 const report={normal,reduced,errors,failed};fs.writeFileSync(out+'runtime.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 if(normal.sleepers!==120||normal.leaves.active===0||reduced.active!==0||errors.length)throw Error('Runtime life check failed');
}finally{await browser.close();}
