// Local-only capacity checks. Test routes exist only in this in-memory Miniflare bundle.
// node scripts/audit-load.mjs [scenarioSeconds=60] [soakSeconds=900] [port=8941]
import assert from 'node:assert/strict';
import {createAuditServer} from './audit-room.mjs';
import WebSocket from 'ws';
import {setTimeout as delay} from 'node:timers/promises';
import {mapOf} from '../src/pixi/island-maps.js';
import {WORLD_ISLANDS} from '../src/pixi/world-map.js';

const soakOnly=process.argv.includes('--soak-only');
const [seconds=60,soak=900,port=8941]=process.argv.slice(2).filter(v=>v!=='--soak-only').map(Number);
assert(seconds>0&&soak>=0&&Number.isInteger(port)&&port!==8890);
const mf=await createAuditServer({port});
const base=String(await mf.ready).replace(/\/$/,''),sockets=new Set();
const percentile=(values,q)=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length*q)]??0;};
async function until(check,label,timeout=15000){const deadline=Date.now()+timeout;while(!check()){assert(Date.now()<deadline,label);await delay(20);}}
async function scenario({name,total=100,spectators=0,delta=true,duration=seconds,churn=false}){
 const room=name,bots=[],errors=[],gaps=[];let measuring=false,bytes=0,messages=0,reconnections=0,transitions=0;
 const endpoint=path=>base+path+'?room='+room;
 const stats=()=>fetch(endpoint('/test/stats')).then(r=>r.json());
 const islands=WORLD_ISLANDS.slice(0,2).map(i=>i.id);
 const send=(bot,command)=>bot.ws.send(JSON.stringify(command));
 async function connect(account,play=true){
  const bot={account,seq:0,welcome:null,players:new Map(),boats:new Map(),tick:-1,islandId:'home',expectedClose:false,last:0};
  const ws=bot.ws=new WebSocket(base.replace('http','ws')+'/api/room?'+new URLSearchParams({room,play:play?'1':'0',...(account?{account}:{})}));sockets.add(ws);
  ws.on('error',error=>errors.push(error.message));
  ws.on('close',()=>{sockets.delete(ws);if(!bot.expectedClose)errors.push('Unexpected close: '+account);});
  ws.on('message',buffer=>{try{
   const m=JSON.parse(buffer.toString());
   if(m.type==='welcome'){bot.welcome=m;if(m.reason==='spectators-full')bot.expectedClose=true;if(delta&&m.reason!=='spectators-full')send(bot,{type:'updates'});return;}
   if(m.type!=='snapshot'&&m.type!=='delta')return;
   if(m.type==='delta'){
    assert.equal(m.epoch,bot.epoch);assert.equal(m.baseTick,bot.tick);assert.equal(m.islandId,bot.islandId);
    for(const [key,patch]of [['players',m.players],['boats',m.boats]]){for(const id of patch.removed)bot[key].delete(id);for(const value of patch.changed)bot[key].set(value.id,{...bot[key].get(value.id),...value});}
   }else {bot.players=new Map(m.players.map(p=>[p.id,p]));bot.boats=new Map(m.boats.map(p=>[p.id,p]));}
   if(bot.epoch===m.epoch)assert(m.tick>bot.tick,'monotonic tick');
   bot.epoch=m.epoch;bot.tick=m.tick;bot.islandId=m.islandId;
   for(const p of bot.players.values())assert(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.islandId===m.islandId,'valid island pose');
   if(measuring){const now=performance.now();if(bot.last)gaps.push(now-bot.last);bot.last=now;messages++;bytes+=buffer.length;}
  }catch(error){errors.push(error.message);}});
  await until(()=>bot.welcome,'welcome '+account);
  return bot;
 }
 async function place(bot,islandId){const map=mapOf(islandId),p=map.spawn;const r=await fetch(endpoint('/test/pose'),{method:'POST',body:JSON.stringify({account:bot.account,islandId,x:p.x,y:p.y})});assert.equal(r.status,204);await until(()=>bot.islandId===islandId,'island transition');}
 async function close(bot){
  bot.expectedClose=true;bot.ws.close();
  try{await until(()=>bot.ws.readyState===WebSocket.CLOSED,'socket close');}
  catch(error){console.error(JSON.stringify({failure:'close',account:bot.account,reconnections,transitions,readyState:bot.ws.readyState,bufferedAmount:bot.ws.bufferedAmount,closeFrameReceived:bot.ws._closeFrameReceived,closeFrameSent:bot.ws._closeFrameSent,closeCode:bot.ws._closeCode,socketEnded:bot.ws._socket?.writableEnded,server:await stats()}));throw error;}
 }
 try{
  // Move the first group before admitting the second, so Home's cap remains real.
  for(let i=0;i<total;i++){const bot=await connect('audit-'+i);assert(bot.welcome.id,'admitted player '+i);bots.push(bot);if(total>100&&i<100)await place(bot,islands[1]);}
  if(total===200){
   // Leave a free Home slot so this probe isolates the global player cap
   // from both the per-island cap and the spectator cap.
   await place(bots[100],WORLD_ISLANDS[2].id);
   const globalOverflow=await connect('global-overflow');
   assert.equal(globalOverflow.welcome.reason,'players-full');assert.equal(globalOverflow.welcome.id,null);
   await close(globalOverflow);await place(bots[100],islands[0]);
  }
  for(let i=0;i<spectators;i++){const bot=await connect(null,false);assert.equal(bot.welcome.id,null);bots.push(bot);}
  const overflow=await connect('overflow');assert.equal(overflow.welcome.reason,spectators===64?'spectators-full':'players-full');overflow.expectedClose=true;await close(overflow);
  const before=await stats();assert.equal(before.actors,total);assert.equal(before.connections,total+spectators);
  await delay(1000);await stats();measuring=true;const start=Date.now();let nextChurn=start+5000,nextTransition=start+10000,nextProgress=start+60000,n=0;
  const loop=setInterval(()=>{for(let i=0;i<total;i++){const b=bots[i];if(b.ws.readyState!==1)continue;const map=mapOf(b.islandId),angle=(n+i)*2.399;send(b,{type:'destination',seq:++b.seq,islandId:b.islandId,x:map.spawn.x+Math.cos(angle)*180,y:map.spawn.y+Math.sin(angle)*180});}n++;},1000);
  try{while(Date.now()-start<duration*1000){await delay(250);assert.equal(errors.length,0,errors.slice(0,3).join('; '));
   if(churn&&Date.now()>=nextProgress){console.error(JSON.stringify({progress:name,elapsedSeconds:Math.round((Date.now()-start)/1000),reconnections,transitions}));nextProgress+=60000;}
   if(churn&&Date.now()>=nextChurn){const i=reconnections%total,old=bots[i],islandId=old.islandId;await close(old);const b=await connect(old.account);assert(b.welcome.id);bots[i]=b;await place(b,islandId);reconnections++;nextChurn+=5000;}
   if(churn&&Date.now()>=nextTransition){const i=transitions%total,b=bots[i];await place(b,b.islandId===islands[0]?islands[1]:islands[0]);transitions++;nextTransition+=10000;}
  }}finally{clearInterval(loop);measuring=false;}
  const after=await stats();assert.equal(after.actors,total);assert.equal(after.connections,total+spectators);assert(after.samples>0);assert(after.p95<50,'server step p95 exceeds 50ms: '+after.p95);
  await Promise.all(bots.map(close));await until(()=>sockets.size===0,'all sockets closed');await delay(1100);
  const cleaned=await stats();assert.equal(cleaned.connections,0);assert.equal(cleaned.actors,0);assert.equal(cleaned.timer,false);
  console.log(JSON.stringify({name,total,spectators,delta,duration,globalLimitChecked:total===200,reconnections,transitions,messages,bytes,gapP95Ms:percentile(gaps,.95),stepP95Ms:after.p95,stepMaxMs:after.max,cleanup:cleaned,errors}));
 }finally{for(const b of bots){b.expectedClose=true;b.ws.terminate();}}
}
try{
 for(const delta of (soakOnly?[]:[true,false])){
  await scenario({name:'single-'+delta,delta});
  await scenario({name:'capacity-'+delta,total:200,spectators:64,delta});
 }
 if(soak)await scenario({name:'soak',total:100,spectators:16,delta:true,duration:soak,churn:true});
}finally{for(const ws of sockets)ws.terminate();await mf.dispose();}
