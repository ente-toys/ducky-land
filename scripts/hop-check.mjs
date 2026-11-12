#!/usr/bin/env node
const S=new URL('../src/pixi/',import.meta.url).href;
const {destinationsFor}=await import(S+'islands.js');
const fs=await import('node:fs');
const argv=process.argv.slice(2),oi=argv.indexOf('--out'),OUT=oi>=0?argv.splice(oi,2)[1]:'.';fs.mkdirSync(OUT,{recursive:true});
const RUNTIME='/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=await import(`${RUNTIME}/playwright/index.mjs`);
const BASE=(argv[0]||'http://boss.localhost:8890').replace(/\/$/,''),W=1440,H=900,sleep=ms=>new Promise(r=>setTimeout(r,ms));
const browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:W,height:H}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(`${BASE}/__test/login?account=boss`,{waitUntil:'domcontentloaded'});
await page.goto(`${BASE}/?qa=1`,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>globalThis.__duckyEngine?.ready&&globalThis.__duckyEngine.room?.player,null,{timeout:90000});
await sleep(3000);
const dests=destinationsFor('home');
const info=await page.evaluate(()=>{const e=globalThis.__duckyEngine,r=e.room,p=r.player;const boats=r.boatPoses().filter(b=>!b.occupant&&b.islandId==='home').sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));return {player:{x:p.x,y:p.y,mode:p.mode,island:r.islandId},boat:boats[0]};});
console.log(JSON.stringify(info));
await page.evaluate(id=>globalThis.__duckyEngine.room.board(id),info.boat.id);
await page.waitForFunction(()=>globalThis.__duckyEngine.room.player?.mode==='sailing',null,{timeout:30000}).catch(()=>console.log('board wait timeout'));
const mode=await page.evaluate(()=>globalThis.__duckyEngine.room.player?.mode);console.log('mode',mode);
const p0=await page.evaluate(()=>{const p=globalThis.__duckyEngine.room.player;return {x:p.x,y:p.y};});
const d=dests.sort((a,b)=>Math.hypot(a.dock.x-p0.x,a.dock.y-p0.y)-Math.hypot(b.dock.x-p0.x,b.dock.y-p0.y))[0];
console.log('to',d.destination,JSON.stringify(d.dock));
const ok=await page.evaluate(({x,y})=>globalThis.__duckyEngine.room.destination(x,y),d.dock);console.log('destination',JSON.stringify(ok));
await page.evaluate(()=>{const e=globalThis.__duckyEngine;globalThis.__hopLog=[];const step=()=>{const r=globalThis.__duckyRigid?.()??[];const pick=id=>{const m=r.find(k=>k.kind==='island'&&k.id===id);return m&&{x:m.x,y:m.y};};
 const J=globalThis.__jetty?.[e.islandId],v=e.room?.view?.()??e.room?.player,q=e.camera.basis??{a:1,b:0,c:0,d:1},z=e.camera.zoom,sc=v&&{x:e.width/2+q.a*z*(v.x-e.camera.x)+q.c*z*(v.y-e.camera.y),y:e.height/2+q.b*z*(v.x-e.camera.x)+q.d*z*(v.y-e.camera.y)};
 const scr=p=>p&&{x:e.width/2+q.a*z*(p.x-e.camera.x)+q.c*z*(p.y-e.camera.y),y:e.height/2+q.b*z*(p.x-e.camera.x)+q.d*z*(p.y-e.camera.y)};
 globalThis.__hopLog.push({t:performance.now(),island:e.islandId,mode:e.room?.player?.mode,jetty:scr(J),player:sc,dest:pick(globalThis.__hopDest),cam:{x:e.camera.x,y:e.camera.y,zoom:e.camera.zoom}});requestAnimationFrame(step);};requestAnimationFrame(step);});
const {harborOf}=await import(S+'islands.js');
await page.evaluate(([id,a,b])=>{globalThis.__hopDest=id;globalThis.__jetty={home:a,[id]:b};
 const e=globalThis.__duckyEngine,orig=e.switchIsland.bind(e);
 const look=()=>{const q=e.camera.basis??{a:1,b:0,c:0,d:1},z=e.camera.zoom,J=globalThis.__jetty[e.islandId],r=globalThis.__duckyRigid?.()??[],isl=r.find(k=>k.kind==='island'&&k.id===id);
  return {island:e.islandId,jetty:{x:e.width/2+q.a*z*(J.x-e.camera.x)+q.c*z*(J.y-e.camera.y),y:e.height/2+q.b*z*(J.x-e.camera.x)+q.d*z*(J.y-e.camera.y)},islandCentre:isl&&{x:isl.x,y:isl.y,a:isl.a,b:isl.b}};};
 e.switchIsland=nid=>{const before=look();orig(nid);globalThis.__switch={before,after:look()};};
},[d.destination,d.dock,harborOf(d.destination).water]);
let hopped=false,shots=0,frozen=false;
for(let k=0;k<240&&!hopped;k++){await sleep(250);
 if(!frozen){const far=await page.evaluate(([x,y])=>{const p=globalThis.__duckyEngine.room.player;return Math.hypot(p.x-x,p.y-y);},[d.dock.x,d.dock.y]);if(far<500){frozen=true;await page.evaluate(()=>{const e=globalThis.__duckyEngine;e.follow=false;Object.assign(e.target,e.camera);globalThis.__freezeCam=()=>{e.follow=false;};setInterval(globalThis.__freezeCam,5);});}}const id=await page.evaluate(()=>globalThis.__duckyEngine.islandId);if(id!=='home'){hopped=true;}
 if(k%10===0){const h=await page.addStyleTag({content:'body *{visibility:hidden!important}canvas{visibility:visible!important}'});await page.screenshot({path:`${OUT}/hop-sail-${shots++}.png`});await h.evaluate(e=>e.remove());}}
await page.screenshot({path:`${OUT}/hop-moment.png`});await sleep(1500);
const log=await page.evaluate(()=>globalThis.__hopLog);
const h=await page.addStyleTag({content:'body *{visibility:hidden!important}canvas{visibility:visible!important}'});await page.screenshot({path:`${OUT}/hop-after.png`});await h.evaluate(e=>e.remove());
let maxStep=0,hopStep=null,hopAt=-1;const steps=[];
for(let i=1;i<log.length;i++){const a=log[i-1].player,b=log[i].player;if(!a||!b)continue;const s=Math.hypot(b.x-a.x,b.y-a.y);steps.push(s);
 if(log[i].island!==log[i-1].island){hopStep=s;hopAt=i;}else if(i>40)maxStep=Math.max(maxStep,s);}
let jet=null,jetMax=0;for(let i=1;i<log.length;i++){const a=log[i-1].jetty,b=log[i].jetty;if(!a||!b)continue;const s=Math.hypot(b.x-a.x,b.y-a.y);if(i===hopAt)jet=s;else if(i>40&&Math.abs(i-hopAt)>40)jetMax=Math.max(jetMax,s);}
const sw=await page.evaluate(()=>globalThis.__switch);
const res={atSwitch:sw,jettyJumpAtSwitchPx:sw&&Math.hypot(sw.after.jetty.x-sw.before.jetty.x,sw.after.jetty.y-sw.before.jetty.y),islandJumpAtSwitchPx:sw?.after.islandCentre&&Math.hypot(sw.after.islandCentre.x-sw.before.islandCentre.x,sw.after.islandCentre.y-sw.before.islandCentre.y),jettyScreenJumpAtHopFramePx:jet,maxOrdinaryJettyFrameStepPx:jetMax,from:'home',to:d.destination,hopped,frames:log.length,playerScreenJumpAtHopPx:hopStep,maxOrdinaryPlayerFrameStepPx:maxStep,around:hopAt>0?log.slice(hopAt-5,hopAt+6):[],stepsAroundHop:hopAt>0?steps.slice(hopAt-6,hopAt+5).map(x=>+x.toFixed(2)):[],errors};
fs.writeFileSync(`${OUT}/hop.json`,JSON.stringify(res,null,1));console.log(JSON.stringify({...res,around:undefined}));
await browser.close();
