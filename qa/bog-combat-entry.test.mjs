import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createArena} from '../src/pixi/bog-combat/sim.js';
import {MEDALS,tagMedals,cleanMedalCase} from '../src/pixi/bog-combat/medals.js';
import {KARMA_REQUIRED,canEnterBog,dockArrival,teamCounts,suggestedTeam} from '../src/pixi/bog-combat/entry.js';
import {RULES} from '../src/pixi/bog-combat/rules.js';
import {createArenaSocket} from '../server/arena-socket.mjs';
import {createArenaProfiles} from '../server/arena-socket.mjs';
import {ArenaLobbyClient} from '../src/pixi/bog-combat/client.js';
import {DUCK_LENGTH as D} from '../src/pixi/bog-combat/rules.js';
const MAP_SCALE=1;

test('Bog dock entry is walking only, karma is disabled, team sizes remain free',()=>{
  assert.equal(KARMA_REQUIRED,0);assert.ok(canEnterBog());
  assert.ok(dockArrival({islandId:'isle-249',mode:'walking'},'playing'));
  for(const [id,mode,status]of [['home','walking','playing'],['isle-249','sailing','playing'],['isle-249','walking','watching']])assert.equal(dockArrival({islandId:id,mode},status),false);
  const counts=teamCounts([{team:'privacy'},{team:'google',bot:true},{team:'privacy'}]);assert.deepEqual(counts,{privacy:2,google:0});assert.equal(suggestedTeam(counts),'google');assert.equal(suggestedTeam({privacy:0,google:0}),null);
});

test('all eight free-play medals have achievable conditions, unlock once, and use no rounds',()=>{
  const owner={id:'a',team:'privacy',stats:{tags:25},streak:5,lastTagAt:9,medalCase:{},comebackReady:true,alive:true};
  const victim={id:'b',team:'google',x:28*D*MAP_SCALE,y:43*D*MAP_SCALE,alive:false},enemy={id:'c',team:'google',alive:true};
  const earned=tagMedals({owner,victim,players:[owner,victim,enemy],time:10,distance:8*D,scores:{privacy:1,google:3},inBonusZone:true});
  assert.deepEqual(earned,MEDALS.map(m=>m.id));
  assert.deepEqual(tagMedals({owner,victim,players:[owner,victim,enemy],time:11,distance:9*D,scores:{privacy:1,google:3},inBonusZone:true}),[]);
  assert.deepEqual(cleanMedalCase({'ace':true,'mvp':3,'unknown':true}),{ace:true});
});

test('medal collection and totals persist through tag, leave, store reload and other-team re-entry',()=>{
  const file=join(mkdtempSync(join(tmpdir(),'bog-medals-')),'profiles.json'),store=createArenaProfiles(file),profile='a'.repeat(36);
  const arena=createArena({practice:false,blockers:[],bounds:{width:2000,height:1500},pads:team=>[{x:team==='privacy'?100:450,y:300}],onStats:(id,s,m)=>store.set(id,s,m)});
  const a=arena.join({id:'a',profile,team:'privacy'});arena.join({id:'b',team:'google'});
  for(let i=0;i<100;i++)arena.step(1/60);
  a.facing=Math.PI/2;arena.input('a',{seq:1,x:0,y:0,ax:1,ay:0,fire:true});for(let i=0;i<20;i++)arena.step(1/60);
  assert.equal(a.medalCase['first-splat'],true);assert.deepEqual(arena.state.events[0].medals,['first-splat']);
  const snap=arena.snapshot();snap.players[0].medalCase.ace=true;snap.events[0].medals.push('ace');assert.equal(a.medalCase.ace,undefined);assert.equal(arena.state.events[0].medals.length,1);
  arena.leave('a');store.flush();const reloaded=createArenaProfiles(file);
  const p=arena.join({id:'again',profile,team:'google',stats:reloaded.get(profile),medalCase:reloaded.getMedals(profile)});
  assert.equal(p.stats.tags,1);assert.equal(p.stats.bestStreak,1);assert.equal(p.streak,0);assert.deepEqual(p.medalCase,{'first-splat':true});
});

test('ammo is authoritative, empty clip prevents fire, refill and respawn restore paint',()=>{
  const arena=createArena({practice:false,blockers:[],bounds:{width:3000,height:1500},pads:()=>[{x:100,y:300}]});const p=arena.join({id:'a',team:'privacy'});
  let seq=0;for(let i=0;i<310;i++){arena.input('a',{seq:seq++,x:0,y:0,ax:1,ay:0,fire:true,ammo:999});arena.step(1/60);}
  assert.equal(p.ammo,0);const reload=p.reloadAt;assert.ok(reload>arena.state.time);
  arena.step(1/60);assert.equal(p.ammo,0);
  while(arena.state.time<reload+.02){arena.input('a',{seq:seq++,x:0,y:0,ax:1,ay:0,fire:false});arena.step(1/60);}
  assert.equal(p.ammo,RULES.ammoCapacity);assert.equal(arena.snapshot().players[0].ammo,p.ammo);
});

class Peer extends EventEmitter{readyState=1;bufferedAmount=0;messages=[];send(m){this.messages.push(JSON.parse(m));}close(){this.readyState=3;this.emit('close');}terminate(){this.close();}ping(){this.pinged=true;}}
test('live dock observers do not join combat and counts update through joins, leaves and heartbeat',()=>{
  const server=new EventEmitter(),store=createArenaProfiles(join(mkdtempSync(join(tmpdir(),'bog-lobby-')),'profiles.json'));let now=0;
  const room=createArenaSocket(server,store,{now:()=>now});
  const connect=(profile,extra)=>{const ws=new Peer();server.emit('connection',ws,{headers:{origin:'http://localhost:8800'},url:`/arena-room?profile=${profile.repeat(36)}&${extra}`});return ws;};
  const dock=connect('a','mode=lobby');assert.equal(room.arena.state.players.size,0);assert.deepEqual(dock.messages[0].counts,{privacy:0,google:0});
  const a=connect('b','team=privacy');room.broadcast();assert.deepEqual(dock.messages.at(-1).counts,{privacy:1,google:0});
  const b=connect('c','team=privacy');room.broadcast();assert.deepEqual(dock.messages.at(-1).counts,{privacy:2,google:0});assert.equal(dock.messages.at(-1).suggested,'google');
  a.close();b.close();room.broadcast();assert.deepEqual(dock.messages.at(-1).counts,{privacy:0,google:0});
  room.heartbeat();assert.ok(dock.pinged);now=16000;room.heartbeat();assert.equal(dock.readyState,3);room.close();
});
test('lobby client releases once and ignores late messages',()=>{
  let ws,received=0;class Socket{constructor(){ws=this;}close(){this.closed=(this.closed||0)+1;}}
  const client=new ArenaLobbyClient({profile:'a'.repeat(36),Socket,onSnapshot:()=>received++});
  ws.onmessage({data:JSON.stringify({type:'arena-lobby',counts:{privacy:0,google:0}})});assert.equal(received,1);
  client.dispose();client.dispose();ws.onmessage({data:JSON.stringify({type:'arena-lobby'})});assert.equal(received,1);assert.equal(ws.closed,1);
});
