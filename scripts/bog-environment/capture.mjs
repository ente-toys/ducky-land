import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const OUT=process.env.BOG_CAPTURE_DIR??'/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/bog-check/arena/home-rebuild/final';
const BASE=process.env.BOG_REVIEW_URL??'http://127.0.0.1:8897';
const ENTRY='/scripts/bog-environment/review.html';
const HOME=[2820,2410,.65],HOME_WHOLE=[2878,2089,.1];
const shots=[['whole',[4200,4170,.1]],['privacy-nw',[1900,1850,.65]],['google-ne',[6500,1850,.65]],['mid',[4200,2050,.65]],['site-a',[2050,3770,.65]],['site-b',[6350,3770,.65]],['privacy-sw',[1900,5650,.65]],['google-se',[6500,5650,.65]],['lantern-cove',[4200,6870,.65]]];
fs.mkdirSync(OUT,{recursive:true});
const errors=[],readbacks=[],combatEvidence=[];
let browser;
const contextOptions={viewport:{width:1400,height:1000},deviceScaleFactor:2};
function watch(page){page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});}
async function settle(page,gameName){
 await page.waitForFunction(name=>{
  const g=globalThis[name];if(!g?.ready||g.sceneryPending)return false;
  const pools=[g.groundPool,...[...g.arts.values()].filter(a=>a.ready&&a.id===g.artShown).map(a=>a.rasterPool)].filter(Boolean);
  return pools.every(p=>p.stats().pendingTiles===0);
 },gameName,{timeout:120000});
 await page.waitForTimeout(800);
}
async function pair(name,bogFile,homeFile){
 const label=Buffer.from(`<svg width="5600" height="52"><rect width="5600" height="52" fill="#fff0c7"/><text x="24" y="35" font-family="Arial" font-size="26" fill="#39472d">BOG | ${name} | DPR 2</text><text x="2824" y="35" font-family="Arial" font-size="26" fill="#39472d">HOME | fixed comparison view, same zoom and DPR</text></svg>`);
 await sharp({create:{width:5600,height:2052,channels:4,background:'#fff0c7'}}).composite([{input:label,left:0,top:0},{input:bogFile,left:0,top:52},{input:homeFile,left:2800,top:52}]).png().toFile(path.join(OUT,`${name}-beside-home.png`));
}
async function join(context,team){
 const page=await context.newPage();watch(page);await page.goto(BASE+ENTRY);
 await page.waitForFunction(()=>globalThis.bogReviewReady&&bogGame.arts.get('bog-arena')?.ready,null,{timeout:120000});
 await page.getByRole('button',{name:new RegExp(`Team ${team.toUpperCase()}`)}).click();
 await page.waitForFunction(()=>bogGame.bogCombat?.room.client.self?.alive,null,{timeout:30000});
 await page.evaluate(()=>{document.querySelector('nav').style.display='none';bogGame.follow=true;bogGame.camera.zoom=bogGame.target.zoom=.65;bogGame.canvas.focus();});
 return page;
}
async function walkTo(page,target){
 const route=await page.evaluate(target=>{const r=bogGame.bogCombat.room,p=r.client.self;return r.navHere().route(p.x,p.y,...target);},target);
 if(!route.length)throw Error(`No route to ${target}`);
 const held=new Set();
 async function keys(wanted){for(const k of held)if(!wanted.has(k)){await page.keyboard.up(k);held.delete(k);}for(const k of wanted)if(!held.has(k)){await page.keyboard.down(k);held.add(k);}}
 try{
  await page.bringToFront();await page.locator('canvas').focus();
  for(const point of route){
   let done=false;
   for(let n=0;n<600;n++){
    const p=await page.evaluate(()=>{const p=bogGame.bogCombat.room.client.self;return {x:p.x,y:p.y,alive:p.alive};});
    if(!p.alive)throw Error('Walker was tagged before the capture rendezvous');
    const dx=point[0]-p.x,dy=point[1]-p.y,d=Math.hypot(dx,dy);if(d<9){done=true;break;}
    const wanted=new Set();if(Math.abs(dx)>4)wanted.add(dx>0?'d':'a');if(Math.abs(dy)>4)wanted.add(dy>0?'s':'w');if(d>180)wanted.add('Shift');await keys(wanted);await page.waitForTimeout(70);
   }
   if(!done)throw Error(`Walking stalled at ${point}`);
  }
 }finally{await keys(new Set());await page.evaluate(()=>bogGame.stopInput());}
 await page.waitForTimeout(180);
}
async function moment(page,name){
 const file=path.join(OUT,`${name}-bog.png`);await page.screenshot({path:file});
 combatEvidence.push(await page.evaluate(name=>{const r=bogGame.bogCombat.room,c=r.client;return {name,tick:c.snapshot.tick,time:c.snapshot.time,self:c.self,players:c.snapshot.players,shots:c.snapshot.shots,splats:c.snapshot.splats,events:c.snapshot.events,canvasCount:document.querySelectorAll('canvas').length};},name));
 await pair(name,file,path.join(OUT,'home-reference.png'));
}
try{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext(contextOptions),page=await context.newPage();watch(page);
 await page.goto(BASE+'/scripts/bigger-home/review.html');await page.waitForFunction(()=>globalThis.reviewReady,null,{timeout:120000});
 for(const [name,camera]of [['home-reference',HOME],['home-whole',HOME_WHOLE]]){await page.evaluate(v=>reviewCamera(...v),camera);await settle(page,'game');await page.screenshot({path:path.join(OUT,`${name}.png`)});}
 await page.goto(BASE+ENTRY+'?inspect');await page.waitForFunction(()=>globalThis.bogReviewReady&&bogGame.arts.get('bog-arena')?.ready,null,{timeout:120000});
 await page.evaluate(()=>document.querySelector('nav').style.display='none');
 for(const [name,camera]of shots){
  await page.evaluate(v=>bogCamera(...v),camera);await settle(page,'bogGame');
  const file=path.join(OUT,`${name}-bog.png`);await page.screenshot({path:file});
  readbacks.push(await page.evaluate(name=>({name,renderer:bogGame.app.renderer.name,dpr:devicePixelRatio,map:bogGame.artShown,canvas:{...bogGame.canvas.dataset},ground:bogGame.groundPool.stats(),art:bogGame.arts.get('bog-arena').rasterPool.stats(),frameTimes:bogGame.frameTimes.slice()}),name));
  await pair(name,file,path.join(OUT,name==='whole'?'home-whole.png':'home-reference.png'));
 }
 await context.close();
 const privacyContext=await browser.newContext(contextOptions),googleContext=await browser.newContext(contextOptions);
 const privacy=await join(privacyContext,'privacy'),google=await join(googleContext,'google');
 await walkTo(privacy,[4000,3270]);await walkTo(google,[4320,3430]);
 await privacy.bringToFront();await privacy.locator('canvas').focus();await privacy.keyboard.down('d');await privacy.waitForTimeout(50);await privacy.keyboard.up('d');
 await privacy.keyboard.down('Space');await privacy.waitForFunction(()=>bogGame.bogCombat.room.client.self.ammo<12);await moment(privacy,'combat-1-shooting');await privacy.keyboard.up('Space');
 const row=await privacy.evaluate(()=>bogGame.bogCombat.room.client.self.y);await walkTo(google,[4320,row]);
 await privacy.bringToFront();await privacy.locator('canvas').focus();await privacy.keyboard.down('Space');
 await google.waitForFunction(()=>bogGame.bogCombat.room.client.self?.alive===false,null,{timeout:10000});await privacy.keyboard.up('Space');await moment(google,'combat-2-tagged');
 await google.waitForFunction(()=>{const g=bogGame,p=g.bogCombat.room.client.self;return p?.alive&&Math.hypot(g.camera.x-p.x,g.camera.y-(p.y-90))<150;},null,{timeout:20000});await moment(google,'combat-3-respawn');
 const expected=await privacy.evaluate(()=>({...bogGame.bogCombat.room.client.self.stats}));
 await privacy.getByRole('button',{name:'Back to dock',exact:true}).click();await privacy.getByRole('heading',{name:'Back at the dock'}).waitFor();await privacy.screenshot({path:path.join(OUT,'dock-summary.png')});
 await privacy.reload();await privacy.getByRole('button',{name:'Medal case',exact:true}).click();
 await privacy.waitForFunction(tags=>Number(document.querySelector('.bog-combat-lifetime dd')?.textContent??0)===tags,expected.tags);await privacy.screenshot({path:path.join(OUT,'persisted-medal-case.png')});
 const rendered=await privacy.locator('.bog-combat-lifetime dd').allTextContents(),keys=['tags','survives','score','medals','bestStreak'];
 if(keys.some((key,i)=>Number(rendered[i])!==expected[key]))throw Error('Profile totals changed after reload');
 combatEvidence.push({name:'reload-persistence',expected,rendered:Object.fromEntries(keys.map((key,i)=>[key,Number(rendered[i])]))});
 if(errors.length)throw Error(`${errors.length} browser errors, see runtime.json`);
}catch(error){
 errors.push(String(error));throw error;
}finally{
 fs.writeFileSync(path.join(OUT,'runtime.json'),JSON.stringify({base:BASE,errors,readbacks,combatEvidence,views:shots,homeReference:HOME,homeWhole:HOME_WHOLE,captured:readbacks.length===9&&combatEvidence.length===4},null,2)+'\n');
 await browser?.close();
}
