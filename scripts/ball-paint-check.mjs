#!/usr/bin/env node
// boss 8 Nov ("it's not a 3D globe, it still moves the islands"): islands are painted ON the ball. During a real mouse drag
// on the full globe, every sampled point of an island's own map must be drawn where the orthographic projection of its
// sphere point lands: its land pixels are land on screen (less the art's own ponds and moats, ~4%), its sea pixels are sea,
// and the same test 25px off scores far lower. Near the rim each island is squashed by exactly 1/cos (orthographic).
// Usage: node scripts/ball-paint-check.mjs <url> --out <dir>   (writes ball-1..6.png and ball-paint.json)
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {viewFrame,spherePoint} from '../src/pixi/sphere-coordinates.js';
import {dot} from '../src/pixi/sphere.js';
import {lensOffset} from '../src/pixi/globe-look.js';
import {WORLD_GEO,WORLD_ISLANDS} from '../src/pixi/world-map.js';
import {mapOf} from '../src/pixi/island-maps.js';
const RUNTIME='/Users/pragadees.xd/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? `${RUNTIME}/playwright/index.mjs`);
const {PNG}=createRequire(`${RUNTIME}/`)('pngjs');
const args=process.argv.slice(2),opt=(n,d)=>{const i=args.indexOf(n);return i>=0?args.splice(i,2)[1]:d;};
const OUT=path.resolve(opt('--out','.')),BASE=(args[0]||'http://boss.localhost:8890').replace(/\/$/,'');
const W=1440,H=900,sleep=ms=>new Promise(r=>setTimeout(r,ms));fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:W,height:H}});const errors=[];page.on('pageerror',e=>errors.push(String(e.message)));
await page.goto(`${BASE}/__test/login?account=boss`);await page.goto(`${BASE}/?qa=1`);
await page.waitForFunction(()=>globalThis.__duckyEngine?.ready,null,{timeout:90000});await sleep(2500);
await page.mouse.move(W/2,H/2);for(let i=0;i<45;i++){await page.mouse.wheel(0,400);await sleep(40);}
await page.mouse.move(5,5);await sleep(2500);await page.evaluate(()=>{globalThis.__duckyEngine.quietAt=Infinity;});
// turn the ball away from Home first
for(let n=0;n<2;n++){await page.mouse.move(W/2-220,H/2+60);await page.mouse.down();for(let k=1;k<=12;k++){await page.mouse.move(W/2-220+440*k/12,H/2+60-60*k/12);await sleep(20);}await sleep(250);await page.mouse.up();await sleep(600);}
const state=()=>page.evaluate(()=>{const e=globalThis.__duckyEngine;e.quietAt=Infinity;return {id:e.islandId,cam:{x:e.camera.x,y:e.camera.y,zoom:e.camera.zoom},basis:e.camera.basis??{a:1,b:0,c:0,d:1},ball:e.worldView.debug.ball,st:e.worldView.stickers};});
const frameOf=s=>{const T=viewFrame(s.id,s.cam),c=s.basis.a,si=s.basis.b;return {center:T.center,east:T.east.map((v,k)=>v*c+T.north[k]*si),north:T.north.map((v,k)=>v*c-T.east[k]*si)};};
const blue=(r,g,b)=>b>r+35&&b>=g-10;
const frames=[];let land=0,landHit=0,sea=0,seaHit=0,shifted=0;const rim=[];
const press={x:W/2-250,y:H/2};await page.mouse.move(press.x,press.y);await page.mouse.down();
for(let f=1;f<=6;f++){
 if(f>1)for(let j=1;j<=6;j++){await page.mouse.move(press.x+(f-2+j/6)*100,press.y);await sleep(16);}
 await sleep(350);
 const s=await state(),F=frameOf(s),Rp=WORLD_GEO.Rw*s.cam.zoom;
 const h=await page.addStyleTag({content:'body *{visibility:hidden!important}canvas{visibility:visible!important}'});
 const file=path.join(OUT,`ball-${f}.png`),buf=await page.screenshot({path:file});await h.evaluate(e=>e.remove());
 const png=PNG.sync.read(buf),px=(x,y)=>{const i=(Math.round(y)*png.width+Math.round(x))*4;return [png.data[i],png.data[i+1],png.data[i+2]];};
 let fl=0,flh=0,fs=0,fsh=0;
 for(const island of WORLD_ISLANDS){
  const m=mapOf(island.id);
  for(let x=m.origin.x+40;x<m.origin.x+m.width;x+=120)for(let y=m.origin.y+40;y<m.origin.y+m.height;y+=120){
   const ring=[0,1,2,3,4,5,6,7].map(k=>m.landAt(x+Math.cos(k*Math.PI/4)*90,y+Math.sin(k*Math.PI/4)*90));
   const here=m.landAt(x,y);if(ring.some(v=>v!==here))continue;   // well inside land or well out at sea only
   const P=spherePoint(island.id,{x,y});if(dot(P,F.center)<.35)continue;   // keep off the dimmed rim
   const o=lensOffset(F,P,s.ball,Rp),sx=W/2+o.x,sy=H/2+o.y;if(sx<2||sy<2||sx>W-3||sy>H-3)continue;
   const isBlue=blue(...px(sx,sy));
   if(here){fl++;if(!isBlue)flh++;if(sx+25<W-3&&!blue(...px(sx+25,sy)))shifted++;}   // control: the same test 25px off
   else if(!WORLD_ISLANDS.some(o2=>o2.id!==island.id&&dot(o2.center,P)>Math.cos(Math.hypot(mapOf(o2.id).width,mapOf(o2.id).height)/2/WORLD_GEO.Rw))){fs++;if(isBlue)fsh++;}
  }
 }
 land+=fl;landHit+=flh;sea+=fs;seaHit+=fsh;
 for(const d of s.st.filter(q=>q.kind==='island')){const P=spherePoint(d.id,{x:mapOf(d.id).cx,y:mapOf(d.id).cy}),z=dot(P,F.center);if(z<.6&&z>.1){const t=d.a*d.a+d.b*d.b+d.c*d.c+d.d*d.d,det=Math.abs(d.a*d.d-d.b*d.c),r=Math.sqrt(Math.max(0,t*t/4-det*det)),sv=Math.sqrt(t/2+r)/Math.sqrt(Math.max(1e-12,t/2-r));rim.push({frame:f,id:d.id,depth:+z.toFixed(3),squash:+sv.toFixed(3),expected:+(1/z).toFixed(3)});}}
 frames.push({frame:f,file,ball:s.ball,landPoints:fl,landOnLand:flh,seaPoints:fs,seaOnSea:fsh});
 console.log(`ball-${f}: ball ${s.ball.toFixed(3)} land ${flh}/${fl} sea ${fsh}/${fs}`);
}
await page.mouse.up();await browser.close();
const res={url:BASE,landOnLandPct:+(100*landHit/land).toFixed(2),controlShifted25pxPct:+(100*shifted/land).toFixed(2),seaOnSeaPct:+(100*seaHit/sea).toFixed(2),rimForeshortening:rim,frames,errors};
res.passed=res.landOnLandPct>94&&res.seaOnSeaPct>97&&res.controlShifted25pxPct<res.landOnLandPct-10&&rim.length>0&&rim.every(r=>Math.abs(r.squash/r.expected-1)<.05)&&!errors.length;
fs.writeFileSync(path.join(OUT,'ball-paint.json'),JSON.stringify(res,null,1)+'\n');
console.log(JSON.stringify({control:res.controlShifted25pxPct,landOnLandPct:res.landOnLandPct,seaOnSeaPct:res.seaOnSeaPct,rim:rim.slice(0,6),passed:res.passed}));
if(!res.passed)process.exitCode=1;
