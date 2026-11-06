// Run with the user's own Vite on 5281. No src, registry, or world map files are changed.
// Screenshot runner is prepared but could not be executed in the restricted builder sandbox.
// npx vite --port 5281 --strictPort --host 127.0.0.1
// node scripts/themes/goldmine-ingame.mjs
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const pw=process.env.PLAYWRIGHT_MODULE || '/Users/pragadees.xd/Documents/Framer 2/node_modules/playwright/index.mjs';
const {chromium}=await import(pathToFileURL(pw));
const A='public/pixi-art/themes/goldmine/',D='rive/web/themes/goldmine/';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const data={world:read(D+'world.json'),walk:read(D+'walk-world.json'),harbor:read(D+'harbor.json'),art:'/pixi-art/themes/goldmine/art.json',sea:read(A+'art.json').sea};
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5281/?offline&qa',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__duckyEngine?.ready,{timeout:120000});
 await page.addStyleTag({content:'.pixi-live,.pixi-bottom-hud,.pixi-ente-logo{display:none!important}'});
 await page.evaluate(()=>{const e=window.__duckyEngine;e.follow=false;e.fitMode=false;e.fly=null;Object.assign(e.camera,{x:2900,y:2400,zoom:.25});Object.assign(e.target,e.camera);});
 await page.waitForTimeout(1000);
 await page.screenshot({path:'../concepts/themes/work/goldmine/'+'goldmine-home-reference.png'});
 await page.evaluate(async data=>{
  const maps=await import('/src/pixi/island-maps.js');
  if(!maps.registerMap('goldmine',data))throw Error('Goldmine map did not register');
  const {worldIsland}=await import('/src/pixi/world-map.js');
  const id=[...maps.THEME_OF].find(([,theme])=>theme==='goldmine')?.[0]??'isle-163';
  Object.assign(worldIsland(id),{theme:'goldmine',name:'Nuggetnook',width:8000,height:6000});
  const e=window.__duckyEngine;
  e.switchIsland(id);e.follow=false;e.fitMode=false;
  if(e.player)Object.assign(e.player,{x:4100,y:3280,previousX:4100,previousY:3280,path:[]});
 },data);
 await page.waitForFunction(()=>window.__duckyEngine?.artReady('goldmine') && window.__duckyMapSleepers?.goldmine?.length===40,{timeout:120000});
 await page.setViewportSize({width:2000,height:1500});
 for(const [name,x,y,zoom]of [['island',4000,3000,.25],['mine',4100,2620,.8],['centre',4100,2910,.8],['bench-ring',4090,3430,.8],['path-junction',3050,3800,.8],['tree-cluster',2670,2900,.8],['pond',1900,3260,.8],['harbor',3090,4800,.8]]){
  await page.evaluate(({x,y,zoom})=>{const e=window.__duckyEngine;e.follow=false;e.fitMode=false;e.fly=null;Object.assign(e.camera,{x,y,zoom});Object.assign(e.target,{x,y,zoom});},{x,y,zoom});
  await page.waitForTimeout(700);
  await page.screenshot({path:'../concepts/themes/work/goldmine/'+`ingame-goldmine-${name}.png`});
 }
 const state=await page.evaluate(()=>({art:window.__duckyThemeArt,sleepers:window.__duckyMapSleepers?.goldmine?.length,island:window.__duckyEngine.islandId}));
 writeFileSync(A+'ingame-validation.json',JSON.stringify({state,errors},null,2)+'\n');
 if(errors.length)throw Error(errors.join('\n'));
 console.log('Saved actual Pixi screenshots',state);
}finally{await browser.close();}
