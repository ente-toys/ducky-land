import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {LiveBogRoom} from '../worker/bog-room.js';
import {BOT_FILL,createBogBots} from '../worker/bog-bots.js';
import {createBotBrain,createBotController} from '../src/pixi/bog-combat/bot-brain.js';
import {createBotPoofs} from '../src/pixi/bog-combat/bot-poof.js';
import {createBotNavigation} from '../src/pixi/bog-combat/bot-navigation.js';
import {createBogCombat} from '../src/pixi/bog-combat/sim.js';
import {BOG_COMBAT} from '../src/pixi/bog-combat/config.js';
import {RULES,emptyStats} from '../src/pixi/bog-combat/rules.js';
import {tagMedals} from '../src/pixi/bog-combat/medals.js';
import {BOG_ISLAND,teamCounts} from '../src/pixi/bog-combat/entry.js';
import {mapOf} from '../src/pixi/island-maps.js';
import {makeRoom,addPlayer,fakeSocket,seeded} from './room-harness.mjs';

const bots=service=>[...service.arena.state.players.values()].filter(p=>p.bot);
const allCounts=service=>{
 const counts={privacy:0,google:0};for(const p of service.arena.state.players.values())counts[p.team]++;return counts;
};
function peer(){const s=fakeSocket();s.serializeAttachment=value=>s.saved=value;s.deserializeAttachment=()=>s.saved;return s;}
function visitor(owner,n){
 const p=addPlayer(owner,n,{islandId:BOG_ISLAND,...mapOf(BOG_ISLAND).HARBOR.land});
 owner.sql.exec('INSERT OR REPLACE INTO karma_balances VALUES(?,?)',p.account,10);owner.karma.balances.delete(p.account);
 return p;
}
function join(service,p,team){const socket=peer();assert.ok(service.open(socket,{digest:p.account,team}));return socket;}
function stop(owner){owner.bog?.dispose();clearInterval(owner.timer);}
function hit(sim,p,owner='opponent'){
 p.shieldUntil=0;sim.state.shots.push({id:999,owner,team:p.team==='privacy'?'google':'privacy',x:p.x,y:p.y,dx:1,dy:0,left:RULES.range,colour:0});sim.step(1/60);
}
function advance(sim,seconds){for(let i=0;i<Math.ceil(seconds*60);i++)sim.step(1/60);}

test('live lobby starts six balanced, plain-name bots with no accounts, payments or saved profiles',async()=>{
 const owner=await makeRoom();try{
  const p=visitor(owner,9100),service=owner.bog=new LiveBogRoom(owner),lobby=join(service,p,null);
  assert.equal(BOT_FILL,6);assert.equal(bots(service).length,6);assert.deepEqual(allCounts(service),{privacy:3,google:3});
  assert.deepEqual(lobby.notes.at(-1).counts,{privacy:0,google:0});assert.ok(service.timer);
  const at=service.arena.state.time;service.step();assert.ok(service.arena.state.time>at,'bots run with no human fighter');
  for(const bot of bots(service)){
   assert.match(bot.name,/^Bog Bot [1-6]$/);assert.equal(bot.karma,0);assert.equal(bot.lives,5);assert.equal(owner.karma.bogEntry(bot.profile),null);
  }
  assert.equal(owner.karma.balance(p.account),5,'only the human visit pays');
  assert.equal(owner.sql.exec('SELECT * FROM bog_profiles').toArray().length,0);
  service.close(lobby);assert.equal(service.timer,null);assert.equal(service.arena.state.players.size,0,'unobserved room releases bots');
 }finally{stop(owner);}
});

test('live joins replace same-team bots, humans may exceed six, disconnects refill and lobby counts stay human-only',async()=>{
 const owner=await makeRoom();try{
  const first=visitor(owner,9200),service=owner.bog=new LiveBogRoom(owner),lobby=join(service,first,null);
  const before=new Set(bots(service).filter(p=>p.team==='privacy').map(p=>p.id));
  const sockets=[join(service,first,'privacy')];
  const removed=[...before].filter(id=>!service.arena.state.players.has(id));assert.equal(removed.length,1);
  assert.deepEqual(allCounts(service),{privacy:3,google:3});assert.equal(bots(service).length,5);
  assert.equal(service.snapshot('privacy').botDepartures.length,1);assert.equal(service.snapshot('google').botDepartures.length,0,'hidden poof never leaks');
  const timer=service.timer;
  for(let i=1;i<12;i++){
   const team=i<6?'privacy':'google',p=visitor(owner,9200+i);sockets.push(join(service,p,team));
   assert.equal(service.arena.state.players.size,Math.max(BOT_FILL,i+1));
   assert.equal(bots(service).length,Math.max(0,BOT_FILL-i-1));
  }
  assert.deepEqual(allCounts(service),{privacy:6,google:6});assert.deepEqual(lobby.notes.at(-1).counts,{privacy:6,google:6});
  assert.equal(service.timer,timer,'joins never add another simulation loop');
  for(let i=0;i<60;i++)service.step();assert.equal(service.arena.state.players.size,12);
  for(const socket of sockets)service.close(socket);
  assert.deepEqual(allCounts(service),{privacy:3,google:3});assert.deepEqual(teamCounts(service.arena.state.players.values()),{privacy:0,google:0});
  for(let i=0;i<25;i++){const socket=join(service,first,'privacy');assert.equal(service.arena.state.players.size,6);service.close(socket);assert.equal(bots(service).length,6);}
  assert.equal(owner.karma.balance(first.account),5,'reconnect churn never spends another feather');
  service.dispose();assert.equal(service.timer,null);assert.equal(service.arena.state.players.size,0);
 }finally{stop(owner);}
});

test('bot tags use real five-life knockouts and hidden respawns, then renew without a world exit or SQL profile',async()=>{
 const owner=await makeRoom();try{
  const service=owner.bog=new LiveBogRoom(owner),p=visitor(owner,9300);join(service,p,null);
  let bot=bots(service)[0];const id=bot.id;
  for(let life=4;life>=0;life--){
   hit(service.arena,bot);assert.equal(bot.lives,life);assert.equal(bot.alive,false);
   assert.ok(service.snapshot(bot.team==='privacy'?'google':'privacy').players.some(q=>q.id===id&&!q.alive),'knockout remains visible');
   if(life){advance(service.arena,3.05);assert.equal(bot.alive,true);assert.ok(bot.shieldUntil-service.arena.state.time>6.9);
    assert.ok(!service.snapshot(bot.team==='privacy'?'google':'privacy').players.some(q=>q.id===id));}
  }
  advance(service.arena,3.1);assert.equal(bot.out,true);assert.equal(service.exits.length,0);
  advance(service.arena,2.05);service.bots.step();bot=service.arena.state.players.get(id);
  assert.equal(bot.bot,true);assert.equal(bot.lives,5);assert.ok(bot.alive);assert.ok(bot.shieldUntil>service.arena.state.time);
  assert.equal(service.exits.length,0);assert.equal(owner.karma.balance(p.account),5);
  assert.equal(owner.sql.exec('SELECT * FROM bog_profiles').toArray().length,0);
 }finally{stop(owner);}
});

test('bot combat grants no bot medals and cannot farm saved human tags, medals or best streak',()=>{
 const saves=[],sim=createBogCombat({...BOG_COMBAT,onStats:(...args)=>saves.push(args)});
 const human=sim.join({id:'human',team:'privacy'}),bot=sim.join({id:'bot',team:'google'});bot.bot=true;
 hit(sim,bot,human.id);assert.deepEqual(human.stats,emptyStats());assert.deepEqual(human.medalCase,{});assert.equal(human.streak,0);
 assert.equal(saves.length,0);assert.deepEqual(sim.state.events.at(-1).medals,[]);
 hit(sim,human,bot.id);assert.equal(bot.stats.tags,1);assert.equal(bot.stats.medals,0);assert.deepEqual(bot.medalCase,{});
 sim.leave(bot.id);sim.leave(human.id);assert.ok(saves.every(([id,stats])=>id==='human'&&stats.tags===0&&stats.medals===0));
 const owner={id:'owner',team:'privacy',stats:{tags:1},medalCase:{},lastTagAt:-Infinity,streak:1},victim={id:'victim',team:'google'};
 const medals=tagMedals({owner,victim,players:[{...owner,alive:true},{...victim,alive:false},{id:'extra-bot',bot:true,team:'google',alive:true}],time:0,distance:0});
 assert.ok(!medals.includes('clutch'),'bots cannot satisfy a saved medal condition');
});

test('shared normal brain cannot see hidden opponents, lead targets, or bypass eight-direction facing and reaction time',()=>{
 const packets=[],sim=createBogCombat(BOG_COMBAT),a=sim.join({id:'bot-a',team:'privacy'}),b=sim.join({id:'bot-b',team:'google'});a.bot=b.bot=true;
 // Use a clear area and a stationary enemy, outside the exact eight-way line.
 const combat={...BOG_COMBAT,blockers:[],navigation:{walkable:()=>true,route:()=>[]}};
 Object.assign(a,{x:1000,y:1000,shieldUntil:0});Object.assign(b,{x:1200,y:1025,shieldUntil:7});
 sim.input=(id,m)=>{packets.push({...m});return true;};
 const controller=createBotController(sim,combat,{random:()=>.5}),brain=createBotBrain();
 controller.think(a,brain);assert.ok(packets.every(p=>!p.fire),'hidden opponent is not targeted');
 packets.length=0;sim.state.time=.1;controller.think(a,brain);assert.equal(packets.length,0,'no instant reaction');
 sim.state.time=.3;b.shieldUntil=0;controller.think(a,brain);assert.ok(packets.every(p=>!p.fire),'does not magically aim at off-axis target');
 assert.ok(packets.every(p=>!('facing' in p)&&!('ax' in p)&&!('ay' in p)));
 packets.length=0;sim.state.time=.6;b.y=1000;controller.think(a,brain);assert.ok(packets.some(p=>p.fire));
});

test('bounded departure poofs are deduplicated, expire, respect hidden enemies and reuse island dust',()=>{
 const sim=createBogCombat(BOG_COMBAT),fill=createBogBots(sim,BOG_COMBAT),calls=[];fill.sync();
 for(const p of sim.state.players.values())p.shieldUntil=0;
 fill.replace('privacy');const visible=fill.visibleDepartures('google');assert.equal(visible.length,1);
 const update=createBotPoofs({land:(...args)=>calls.push(args)}),snapshot={time:0,botDepartures:visible};
 update(snapshot);update(snapshot);assert.equal(calls.length,1);assert.equal(calls[0][2],1.3);
 fill.sync();for(const p of sim.state.players.values())if(p.team==='google')p.shieldUntil=7;
 fill.replace('google');assert.equal(fill.visibleDepartures('privacy').length,1,'hidden Google departure not sent to Privacy');
 update({time:0,botDepartures:fill.visibleDepartures('google')},true);assert.equal(calls.length,1,'reduced motion');
 sim.state.time=1;assert.equal(fill.visibleDepartures('privacy').length,0);
});

test('live bot paths spread bounded work across ticks, clear actual obstacles and reuse search/waypoint buffers',()=>{
 let checks=0;
 const walkable=(x,y)=>x>=0&&y>=0&&x<960&&y<960&&!(x>390&&x<510&&y<650);
 const nav={walkable,clearLine(a,b){checks++;const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/3);for(let i=0;i<=n;i++)if(!walkable(a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n))return false;return true;}};
 const router=createBotNavigation({navigation:nav,bounds:{width:960,height:960}}),brain=createBotBrain();
 router.prepare(brain);const buffers=brain.routeJob;
 router.route(brain,144,144,816,144);assert.equal(brain.path.length,0);
 let ticks=0;while(router.pending(brain)&&ticks++<200){checks=0;router.step();assert.ok(checks<=64,'at most eight nodes, each with eight edges, per tick');}
 assert.ok(ticks>1&&ticks<200);assert.ok(brain.path.length>1);assert.ok(brain.path.some(p=>p[1]>650),'route takes the opening');
 for(let i=1;i<brain.path.length;i++)assert.ok(nav.clearLine(brain.path[i-1],brain.path[i]));
 const first=brain.path[0];router.route(brain,144,144,816,144);while(router.pending(brain))router.step();
 assert.equal(brain.routeJob,buffers);assert.equal(brain.path[0],first,'point objects are reused');
 router.cancel(brain);assert.equal(router.pending(brain),false);
});

test('six normal bots play real combat on the live map, stay walkable and keep bounded slots',()=>{
 const sim=createBogCombat(BOG_COMBAT),fill=createBogBots(sim,BOG_COMBAT,{random:seeded(97)});fill.sync();
 let tags=0;const timings=[];
 for(let i=0;i<7200;i++){
  const start=performance.now();fill.step();const elapsed=performance.now()-start;timings.push(elapsed);sim.step(1/60);
  if(sim.state.events.length)tags++;
  if(i%60===0)for(const p of sim.state.players.values())assert.ok(BOG_COMBAT.navigation.walkable(p.x,p.y),p.name);
  assert.equal(sim.state.players.size,6);
 }
 assert.ok(tags>0);assert.ok(sim.state.scores.privacy>0&&sim.state.scores.google>0);
 assert.ok([...sim.state.players.values()].every(p=>p.stats.medals===0));
 timings.sort((a,b)=>a-b);const mean=timings.reduce((a,b)=>a+b,0)/timings.length;
 console.log(`Bog bot CPU: mean ${mean.toFixed(3)} ms, P95 ${timings[Math.floor(timings.length*.95)].toFixed(3)} ms, P99 ${timings[Math.floor(timings.length*.99)].toFixed(3)} ms, max ${timings.at(-1).toFixed(3)} ms`);
});

test('ten ducks run the normal shared brain and real simulation for three minutes without showcase advantages',()=>{
 const sim=createBogCombat(BOG_COMBAT),controller=createBotController(sim,BOG_COMBAT,{random:seeded(97)}),brains=[],ids=[],timings=[];
 for(let i=0;i<10;i++){
  const id=`stress-bot-${i}`;ids.push(id);sim.join({id,team:i%2?'google':'privacy'}).bot=true;
  const brain=createBotBrain(i);brains.push(brain);controller.prepare(brain);
 }
 for(let tick=0;tick<10800;tick++){
  const start=performance.now();controller.step();
  for(let i=0;i<10;i++)controller.think(sim.state.players.get(ids[i]),brains[i]);sim.step(1/60);
  timings.push(performance.now()-start);
  if(tick%60===0)for(const p of sim.state.players.values())assert.ok(BOG_COMBAT.navigation.walkable(p.x,p.y));
 }
 assert.equal(sim.state.players.size,10);assert.ok(sim.state.scores.privacy>=10&&sim.state.scores.google>=10,'both teams find real fights');
 assert.ok([...sim.state.players.values()].every(p=>p.stats.medals===0));
 timings.sort((a,b)=>a-b);
 console.log(`Bog 10-duck AI + sim CPU: mean ${(timings.reduce((a,b)=>a+b,0)/timings.length).toFixed(3)} ms, P95 ${timings[Math.floor(timings.length*.95)].toFixed(3)} ms, P99 ${timings[Math.floor(timings.length*.99)].toFixed(3)} ms, max ${timings.at(-1).toFixed(3)} ms`);
});
