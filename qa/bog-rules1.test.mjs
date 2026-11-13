import test from 'node:test';
import assert from 'node:assert/strict';
import {createBogCombat} from '../src/features/bog-combat/sim.js';
import {RULES} from '../src/features/bog-combat/rules.js';
import {BOG_ISLAND} from '../src/features/bog-combat/entry.js';
import {mapOf} from '../src/world/island-maps.js';
import {ISLETS} from '../src/world/islets.js';
import {angle} from '../src/world/sphere.js';
import {worldIsland} from '../src/world/world-map.js';
import {isletWalk} from '../src/world/islet-walk.js';
import {LiveBogRoom} from '../worker/bog-room.js';
import {bogExitIslet,setBogExitRandom} from '../worker/bog-exit.js';
import {createBoats} from '../src/gameplay/islands.js';
import {buildSpot,strandedIslet} from '../src/gameplay/boat-build.js';
import {makeRoom,addPlayer,fakeSocket} from './room-harness.mjs';
import {createDemo} from '../src/features/bog-combat/demo.js';
import {BOG_COMBAT} from '../src/features/bog-combat/config.js';
import {ArenaClient} from '../src/features/bog-combat/client.js';

const advance=(sim,seconds)=>{for(let i=0;i<Math.ceil(seconds*60);i++)sim.step(1/60);};
const hit=(sim,p)=>sim.state.shots.push({id:999,owner:'opponent',team:p.team==='karma'?'evil':'karma',x:p.x,y:p.y,dx:1,dy:0,left:RULES.range,colour:0});
const bank=(room,p,n)=>{room.sql.exec('INSERT OR REPLACE INTO karma_balances VALUES(?,?)',p.account,n);room.karma.balances.delete(p.account);};
function landed(room,n,balance=10){
 const bog=mapOf(BOG_ISLAND),p=addPlayer(room,n,{islandId:BOG_ISLAND,...bog.HARBOR.water,mode:'sailing'});
 const boat=room.boats.find(b=>b.islandId===BOG_ISLAND&&!b.occupant);
 Object.assign(boat,{...bog.HARBOR.water,occupant:p.actor.id});Object.assign(p.actor,{boatId:boat.id,docking:true});
 bank(room,p,balance);room.step();return p;
}
function peer(){const socket=fakeSocket();socket.serializeAttachment=value=>socket.saved=value;socket.deserializeAttachment=()=>socket.saved;return socket;}
function stop(room){clearInterval(room.timer);room.bog?.dispose();}

setBogExitRandom(()=>.25);

test('seven-second hiding is omitted from enemies, visible to allies, untaggable, and firing reveals immediately',()=>{
 const sim=createBogCombat({blockers:[],bounds:{width:1000,height:1000},pads:team=>[{x:team==='karma'?200:600,y:300}]}),p=sim.join({id:'p',team:'karma'});
 assert.equal(p.lives,5);assert.equal(RULES.spawnShield,7);
 advance(sim,7.1);p.hits=RULES.hitsPerHeart-1;hit(sim,p);sim.step(1/60);assert.equal(p.lives,4);assert.equal(p.alive,false);
 advance(sim,3.05);assert.equal(p.alive,true);assert.equal(p.x,200);
 const until=p.shieldUntil;
 assert.equal(sim.snapshot('evil').players.some(q=>q.id==='p'),false);
 assert.equal(sim.snapshot('karma').players[0].lives,4);
 p.hits=RULES.hitsPerHeart-1;hit(sim,p);sim.step(1/60);assert.equal(p.lives,4);assert.equal(p.hits,RULES.hitsPerHeart-1);sim.state.shots=[];
 advance(sim,6.8);assert.ok(sim.state.time<until);assert.equal(sim.snapshot('evil').players.length,0);
 advance(sim,.25);assert.ok(sim.state.time>until);assert.equal(sim.snapshot('evil').players.length,1);
 hit(sim,p);sim.step(1/60);assert.equal(p.lives,3);advance(sim,3.05);
 assert.ok(p.shieldUntil>sim.state.time);
 sim.input(p.id,{seq:0,x:0,y:0,fire:true});sim.step(1/60);
 assert.equal(p.ammo,11);assert.ok(p.shieldUntil<=sim.state.time);
 assert.equal(sim.snapshot('evil').players.length,1);
 p.hits=RULES.hitsPerHeart-1;hit(sim,p);sim.step(1/60);assert.equal(p.lives,2);
});

test('paid landing spends exactly once, shows authoritative balance, and refused four spends nothing',async()=>{
 const room=await makeRoom();try{
  const p=landed(room,8100,10);assert.equal(p.actor.mode,'walking');assert.equal(room.karma.balance(p.account),5);assert.equal(p.actor.karma,5);
  const entry=room.karma.bogEntry(p.account);assert.equal(entry.lives,5);
  const service=room.bog=new LiveBogRoom(room),socket=peer();assert.ok(service.open(socket,{digest:p.account,team:'karma'}));
  service.close(socket);assert.ok(service.open(peer(),{digest:p.account,team:'karma'}));
  assert.equal(room.karma.balance(p.account),5);assert.equal(room.karma.bogEntry(p.account).id,entry.id);
  const observer=addPlayer(room,8102,{islandId:BOG_ISLAND,...mapOf(BOG_ISLAND).HARBOR.land});
  const guest=peer();room.connections.set(guest,{...room.connections.get(p.socket),actor:null});
  room.broadcast();assert.ok(p.socket.notes.some(m=>m.type==='karma-state'&&m.balance===5));
  assert.equal(JSON.parse(observer.socket.last).players.some(q=>q.id===p.actor.id),false,'world snapshots cannot leak combat harbour placeholders');
  assert.ok(JSON.parse(p.socket.last).players.some(q=>q.id===p.actor.id),'world owner still receives its travel pose');
  assert.equal(JSON.parse(guest.last).players.some(q=>q.id===p.actor.id),false,'another spectator tab on the same account gets no combat placeholder');
  const fighter=service.arena.state.players.values().next().value;
  assert.equal(fighter.karma,5,'combat snapshot keeps the remaining feather balance');
  bank(room,observer,5);const enemySocket=peer();assert.ok(service.open(enemySocket,{digest:observer.account,team:'evil'}));
  service.broadcast();assert.equal(enemySocket.notes.findLast(m=>m.type==='arena-snapshot').players.some(q=>q.id===fighter.id),false,'live transport never sends a hidden enemy');
  assert.ok([...service.members].filter(([,m])=>m.account===p.account&&m.team).every(([s])=>s.notes.findLast(m=>m.type==='arena-snapshot').players.some(q=>q.id===fighter.id)),'live transport still sends self');
  const refused=landed(room,8101,4);assert.equal(refused.actor.mode,'sailing');assert.equal(room.karma.balance(refused.account),4);assert.equal(room.karma.bogEntry(refused.account),null);
  assert.equal(refused.socket.notes.find(m=>m.type==='travel-notice').text,'You need 5 golden feathers to land on Booquack Bog (you have 4)');
 }finally{stop(room);}
});

test('combat reconnect and hibernated socket restore retain paid entry, lives, hidden state and lifetime stats',async()=>{
 const room=await makeRoom();let restored;
 try{
  const p=landed(room,8200,5),service=room.bog=new LiveBogRoom(room),socket=peer();
  assert.ok(service.open(socket,{digest:p.account,team:'karma'}));
  let fighter=service.arena.state.players.get(service.members.get(socket).id);
  fighter.shieldUntil=0;fighter.hits=RULES.hitsPerHeart-1;hit(service.arena,fighter);service.step();assert.equal(fighter.lives,4);
  for(let i=0;i<185;i++)service.step();assert.equal(fighter.alive,true);
  fighter.stats.tags=9;fighter.medalCase['first-splat']=true;service.close(socket);
  const replacement=peer();assert.ok(service.open(replacement,{digest:p.account,team:'evil'}));
  fighter=service.arena.state.players.get(service.members.get(replacement).id);
  assert.equal(fighter.lives,4);assert.equal(fighter.stats.tags,9);assert.ok(fighter.shieldUntil>service.arena.state.time);
  assert.equal(room.karma.balance(p.account),0);
  service.dispose();
  p.socket.deserializeAttachment=()=>room.connections.get(p.socket);
  const {IslandRoom}=await import('../worker/index.js');
  restored=new IslandRoom({...room.ctx,getWebSockets:()=>[p.socket,replacement]});
  const actual=restored.bog.arena.state.players.values().next().value;
  assert.equal(actual.lives,4);assert.equal(actual.stats.tags,9);assert.equal(actual.medalCase['first-splat'],true);
  assert.equal(restored.karma.balance(p.account),0);assert.ok(actual.shieldUntil>restored.bog.arena.state.time);
 }finally{if(restored)stop(restored);stop(room);}
});

test('fifth tag keeps visible knockout then exits to the nearest world islet dock, with a new fee on re-entry',async()=>{
 const room=await makeRoom();try{
  const p=landed(room,8300,15),service=room.bog=new LiveBogRoom(room),socket=peer();service.open(socket,{digest:p.account,team:'evil'});
  const fighter=service.arena.state.players.get(service.members.get(socket).id);
  fighter.stats.tags=3;fighter.medalCase['first-splat']=true;
  for(let life=4;life>=0;life--){
   fighter.shieldUntil=0;fighter.hits=RULES.hitsPerHeart-1;hit(service.arena,fighter);service.step();assert.equal(fighter.lives,life);assert.equal(fighter.alive,false);
   if(life)for(let i=0;i<185;i++)service.step();
  }
  assert.ok(service.arena.snapshot('karma').players.some(q=>q.id===fighter.id&&!q.alive&&q.out));
  for(let i=0;i<120;i++)service.step();assert.ok(service.members.has(socket),'knockout remains visible');
  for(let i=0;i<65;i++)service.step();assert.equal(service.members.has(socket),false);
  const dest=bogExitIslet();assert.ok(ISLETS.some(i=>i.id===dest.islet));
  assert.deepEqual([p.actor.x,p.actor.y],[isletWalk(dest.islet).land.x,isletWalk(dest.islet).land.y]);
  assert.equal(p.actor.mode,'walking');assert.equal(p.actor.boatId,null);assert.ok(room.navFor(p.actor.islandId).walkable(p.actor.x,p.actor.y));
  // the paddled-out Duck finds no boat at its islet: it gathers materials and builds one to sail away
  assert.equal(strandedIslet(p.actor.islandId,p.actor,room.boats),isletWalk(dest.islet),'stranded, no boat added');
  assert.equal(room.karma.bogEntry(p.account),null);assert.equal(room.karma.balance(p.account),10);
  assert.equal(p.socket.notes.findLast(m=>m.type==='travel-notice').text,`Out of lives! Paddled to ${dest.name}`);
  assert.equal(socket.notes.findLast(m=>m.type==='arena-exit').destination.islet,dest.islet);
  assert.equal(service.profile(p.account).stats.tags,3);assert.equal(service.profile(p.account).medalCase['first-splat'],true);
  const harbor=mapOf(BOG_ISLAND).HARBOR,boat=room.boats.find(b=>b.islandId===BOG_ISLAND&&!b.occupant);
  Object.assign(boat,{...harbor.water,occupant:p.actor.id});Object.assign(p.actor,{...harbor.water,islandId:BOG_ISLAND,mode:'sailing',boatId:boat.id,docking:true});room.step();
  assert.equal(room.karma.balance(p.account),5);assert.equal(room.karma.bogEntry(p.account).lives,5);
 }finally{stop(room);}
});

test('demo bot uses five lives and seven-second hiding and re-enters after a short pause without karma',async()=>{
 const demo=createDemo(BOG_COMBAT,2),room=new demo.Room({...BOG_COMBAT,profile:'rule-demo'});await new Promise(queueMicrotask);
 let now=0,p=demo.sim.state.players.get('bot-0');
 for(let life=4;life>=0;life--){
  p.shieldUntil=0;p.hits=RULES.hitsPerHeart-1;hit(demo.sim,p);demo.sim.step(1/60);assert.equal(p.lives,life);
  if(life){advance(demo.sim,3.05);assert.ok(p.shieldUntil-demo.sim.state.time>6.9);}
 }
 advance(demo.sim,5.1);room.step(1/60,{x:0,y:0},now+=17);
 p=demo.sim.state.players.get('bot-0');assert.equal(p.lives,5);assert.equal(p.alive,true);assert.ok(p.shieldUntil>demo.sim.state.time);assert.equal(p.bot,true);room.dispose();
});

test('authoritative exit stops the arena client without reconnecting',()=>{
 class Socket{constructor(){this.readyState=1;}close(){this.readyState=3;this.onclose?.({code:1000});}}
 let exit,retries=0;
 const client=new ArenaClient({Socket,profile:'x'.repeat(36),onExit:value=>exit=value,schedule:()=>{retries++;}});
 client.socket.onmessage({data:JSON.stringify({type:'arena-exit',text:'Out of lives! Paddled to Spooky Purple'})});
 assert.equal(exit.type,'arena-exit');assert.equal(client.closed,true);assert.equal(client.socket.readyState,3);assert.equal(retries,0);
});

test('out of lives picks a random islet, every islet reachable',()=>{
 const seen=new Set();for(let i=0;i<ISLETS.length;i++){setBogExitRandom(()=>(i+.5)/ISLETS.length);seen.add(bogExitIslet().islet);}
 setBogExitRandom(()=>.25);assert.equal(seen.size,ISLETS.length);
});
test('a Bog drop-off adds no boat: the duck is stranded on its islet and can build one from the shore',t=>{
 t.after(()=>setBogExitRandom(()=>.25));
 for(const [index,islet] of ISLETS.entries()){
  setBogExitRandom(()=>(index+.5)/ISLETS.length);
  const destination=bogExitIslet(),walk=isletWalk(islet.id),duck={mode:'walking',x:destination.x,y:destination.y};
  assert.equal(strandedIslet(destination.islandId,duck,createBoats()),walk,islet.id);
  const shore=walk.world.coast.map(([x,y])=>walk.nav.nearest(x,y,300)).find(p=>p&&buildSpot(destination.islandId,{x:p[0],y:p[1]}));
  assert.ok(shore,`${islet.id}: a shore to build from`);
 }
});
test('closing the combat socket on the fifth tag cannot postpone the authoritative exit',async()=>{
 const room=await makeRoom();try{
  const p=landed(room,8400,10),service=room.bog=new LiveBogRoom(room),socket=peer();service.open(socket,{digest:p.account,team:'karma'});
  const fighter=service.arena.state.players.get(service.members.get(socket).id);
  fighter.lives=1;fighter.shieldUntil=0;fighter.hits=RULES.hitsPerHeart-1;hit(service.arena,fighter);service.step();assert.equal(fighter.lives,0);
  service.close(socket);
  const dest=bogExitIslet();assert.deepEqual([p.actor.x,p.actor.y],[dest.x,dest.y]);assert.equal(room.karma.bogEntry(p.account),null);
 }finally{stop(room);}
});
