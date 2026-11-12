import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EventEmitter} from 'node:events';
import {Container,Texture} from 'pixi.js';
import {createBogCombat} from '../src/features/bog-combat/sim.js';
import {RULES} from '../src/features/bog-combat/rules.js';
import {BOG_COMBAT} from '../src/features/bog-combat/config.js';
import {HIDE_BUSHES,buildHideBushes,hideBushAt,isBushHidden,isCombatHidden,BUSH_REVEAL_SECONDS} from '../src/features/bog-combat/hide-bushes.js';
import fallback from '../src/features/bog-combat/hide-bushes.json' with {type:'json'};
import art from '../public/pixi-art/themes/bog-arena/art.json' with {type:'json'};
import {createBotBrain,createBotController} from '../src/features/bog-combat/bot-brain.js';
import {createBushRustleObserver} from '../src/features/bog-combat/bush-rustle.js';
import {createBushRustle} from '../src/features/bog-combat/bush-rustle-view.js';
import {createBogBots} from '../worker/bog-bots.js';
import {LiveBogRoom} from '../worker/bog-room.js';
import {createArenaSocket} from '../server/arena-socket.mjs';
import {ArenaClient} from '../src/features/bog-combat/client.js';
import {BogCombatRoom} from '../src/features/bog-combat/room.js';
import {makeRoom,addPlayer,fakeSocket} from './room-harness.mjs';
import {mapOf} from '../src/world/island-maps.js';
import {BOG_ISLAND} from '../src/features/bog-combat/entry.js';

const bush={id:'lane-bush',x:400,y:400,radius:64};
const combat={blockers:[],bounds:{width:1000,height:1000},pads:team=>[{x:team==='privacy'?150:700,y:400}],pickupSpots:[],hideBushes:[bush]};
function fixture(){
  const sim=createBogCombat(combat),p=sim.join({id:'p',team:'privacy'}),e=sim.join({id:'e',team:'google'});
  p.shieldUntil=e.shieldUntil=0;return {sim,p,e};
}
const input=(sim,p,extra={})=>sim.input(p.id,{seq:p.seq+1,x:0,y:0,fire:false,...extra});
const advance=(sim,seconds)=>{for(let i=0;i<Math.ceil(seconds*60);i++)sim.step(1/60);};
const seen=(sim,team,id)=>sim.snapshot(team).players.some(p=>p.id===id);
function enter(sim,p){p.x=bush.x;p.y=bush.y;sim.step(1/60);}

test('temporary clumps match existing walkable bushes; marked art replaces fallback without new geometry',()=>{
  assert.ok(fallback.length>=8);
  const active=art.props.some(p=>p.hideBush===true)?HIDE_BUSHES:fallback;
  for(const b of active){
    const p=art.props.find(p=>p.id===b.id);assert.ok(p,b.id);assert.match(p.src,/bush/);
    assert.equal(b.x,p.x);assert.equal(b.y,p.y);assert.ok(b.radius<=p.width/2);
    assert.ok(BOG_COMBAT.navigation.walkable(b.x,b.y),b.id);
  }
  assert.ok(Object.isFrozen(HIDE_BUSHES));assert.deepEqual(buildHideBushes({props:[]}),fallback);
  const marked={props:[{id:'new-cover',hideBush:true,x:900,y:800,width:180,height:110,scale:1},{...bush,hideBush:false}]};
  const result=buildHideBushes(marked);assert.equal(result.length,1);assert.equal(result[0].id,'new-cover');
  assert.ok(Math.abs(result[0].radius-60.5)<1e-9);
  assert.throws(()=>buildHideBushes({props:[{id:'bad',hideBush:true,x:NaN,y:0,width:10,height:10}]}));
});

test('authority derives concealment from position, hides enemies, keeps self/allies, and releases immediately outside',()=>{
  const {sim,p}=fixture();assert.ok(seen(sim,'google',p.id));enter(sim,p);
  assert.equal(isBushHidden(p,sim.state.time),true);assert.equal(p.shieldUntil,0);
  assert.equal(seen(sim,'google',p.id),false);assert.equal(seen(sim,'privacy',p.id),true);
  const owner=sim.snapshot('privacy').players.find(q=>q.id===p.id);
  assert.equal(owner.bushHidden,true);assert.equal(owner.bushId,bush.id);assert.equal(owner.bushEntry,1);
  assert.ok(input(sim,p,{bushHidden:false,bushId:null,bushRevealUntil:999,x:0}));sim.step(1/60);
  assert.equal(seen(sim,'google',p.id),false,'client cannot reveal itself by injecting flags');
  assert.equal(p.bushEntry,1,'standing still does not repeat entry');
  p.x=bush.x+bush.radius+1;sim.step(1/60);assert.ok(seen(sim,'google',p.id));assert.equal(p.bushId,null);
  input(sim,p,{bushHidden:true,bushId:bush.id});sim.step(1/60);assert.ok(seen(sim,'google',p.id),'client cannot hide on open floor');
  assert.equal(hideBushAt({x:464,y:400},[bush]),bush);assert.equal(hideBushAt({x:464.01,y:400},[bush]),null);
});

test('real movement can enter and leave soft bushes; overlapping clumps do not chatter',()=>{
  const {sim,p}=fixture();p.x=330;p.y=400;input(sim,p,{x:1});
  for(let i=0;i<60&&!p.bushId;i++)sim.step(1/60);
  assert.equal(p.bushId,bush.id);assert.equal(seen(sim,'google',p.id),false);
  for(let i=0;i<90&&p.x<=464;i++){input(sim,p,{x:1});sim.step(1/60);}
  assert.ok(p.x>464);assert.ok(seen(sim,'google',p.id));
  const overlap={id:'overlap',x:420,y:400,radius:64};
  assert.equal(hideBushAt({x:410,y:400,bushId:overlap.id},[bush,overlap]),overlap);
});

test('only actual firing reveals for two seconds, repeated shots extend it, and crossing bushes cannot reset it',()=>{
  const {sim,p}=fixture();enter(sim,p);p.facing=-Math.PI/2;
  input(sim,p,{fire:true});sim.step(1/60);input(sim,p);
  const first=p.bushRevealUntil;assert.equal(first,sim.state.time+BUSH_REVEAL_SECONDS);
  assert.equal(p.ammo,11);assert.ok(seen(sim,'google',p.id));assert.equal(isBushHidden(p,sim.state.time),false);
  advance(sim,.4);input(sim,p,{fire:true});sim.step(1/60);input(sim,p);assert.ok(p.bushRevealUntil>first);
  const until=p.bushRevealUntil;
  p.x=500;sim.step(1/60);enter(sim,p);assert.equal(p.bushRevealUntil,until);assert.ok(seen(sim,'google',p.id));
  while(sim.state.time+1/60<until-1e-8)sim.step(1/60);
  assert.ok(seen(sim,'google',p.id));advance(sim,.04);assert.equal(seen(sim,'google',p.id),false);
  p.ammo=0;p.reloadAt=sim.state.time+100;input(sim,p,{fire:true});sim.step(1/60);
  assert.equal(seen(sim,'google',p.id),false,'an empty trigger does not count as firing');
});

test('a shot fired before entering a bush still reveals for the remaining two seconds',()=>{
  const {sim,p}=fixture();p.facing=-Math.PI/2;input(sim,p,{fire:true});sim.step(1/60);input(sim,p);
  const until=p.bushRevealUntil;enter(sim,p);assert.equal(p.bushRevealUntil,until);assert.ok(seen(sim,'google',p.id));
  advance(sim,2.05);assert.equal(seen(sim,'google',p.id),false);
});

test('blind paint tags a bush-hidden Ducky, while seven-second respawn hiding stays untaggable',()=>{
  for(const respawnHidden of [false,true]){
    const {sim,p,e}=fixture();enter(sim,p);p.shieldUntil=respawnHidden?sim.state.time+7:0;
    assert.equal(seen(sim,'google',p.id),false);
    e.x=650;e.facing=-Math.PI/2;input(sim,e,{fire:true});sim.step(1/60);input(sim,e);advance(sim,.25);
    assert.equal(p.lives,respawnHidden?5:4);assert.equal(p.alive,respawnHidden);
    if(!respawnHidden){assert.equal(e.stats.tags,1);assert.ok(seen(sim,'google',p.id),'knockout remains visible');
      advance(sim,3.05);assert.ok(p.alive);assert.equal(p.bushId,null);assert.ok(p.shieldUntil>sim.state.time);}
  }
});

test('aim assist ignores bush-hidden targets but still guides toward the same target during reveal',()=>{
  const {sim,p,e}=fixture();enter(sim,p);e.x=650;e.y=440;e.facing=-Math.PI/2;
  input(sim,e,{fire:true});sim.step(1/60);input(sim,e);
  const blind=sim.state.shots.find(s=>s.owner===e.id);assert.ok(Math.abs(blind.dy)<1e-9);
  sim.state.shots.length=0;p.bushRevealUntil=sim.state.time+2;advance(sim,.4);
  input(sim,e,{fire:true});sim.step(1/60);
  const assisted=sim.state.shots.find(s=>s.owner===e.id);assert.ok(assisted.dy<-.1);
});

test('bots ignore bush occupants when searching or aiming and can target them when revealed',()=>{
  const {sim,p,e}=fixture();enter(sim,p);e.x=650;e.y=400;
  const packets=[],routes=[];
  const botCombat={...combat,navigation:{walkable:()=>true,route:(...args)=>{routes.push(args);return [];}}};
  sim.input=(id,m)=>packets.push({...m});
  const controller=createBotController(sim,botCombat,{random:()=>.5,showcase:true,heroId:'e'}),brain=createBotBrain();
  controller.think(e,brain);assert.ok(packets.every(p=>!p.fire));
  assert.ok(routes.every(route=>Math.hypot(route[2]-p.x,route[3]-p.y)>64),'no hidden target coordinates in route');
  packets.length=0;p.bushRevealUntil=sim.state.time+2;controller.think(e,brain);
  assert.ok(packets.some(p=>p.fire));
});

test('hidden bot departures do not leak a concealment position through poof effects',()=>{
  const sim=createBogCombat(combat),fill=createBogBots(sim,{...combat,navigation:{walkable:()=>true,route:()=>[]}});fill.sync();
  const bot=[...sim.state.players.values()].find(p=>p.team==='privacy');bot.shieldUntil=0;enter(sim,bot);
  fill.replace('privacy');assert.equal(fill.visibleDepartures('google').length,0);assert.equal(fill.visibleDepartures('privacy').length,1);
});

test('local transport omits hidden enemies and client drops their tracks and poses immediately',()=>{
  class Peer extends EventEmitter{readyState=1;bufferedAmount=0;notes=[];send(data){this.notes.push(JSON.parse(data));}terminate(){this.readyState=3;}}
  const wss=new EventEmitter(),room=createArenaSocket(wss,{get:()=>({}),set(){},flush(){}},{combat,log:()=>{}});
  const connect=(team,char)=>{const ws=new Peer();wss.emit('connection',ws,{headers:{origin:'http://localhost'},url:`/arena-room?team=${team}&profile=${char.repeat(36)}`});return ws;};
  let client;
  try{
    const own=connect('privacy','a'),enemy=connect('google','b'),id=own.notes[0].id;
    const p=room.arena.state.players.get(id);p.shieldUntil=0;room.step();room.broadcast();
    class Socket{readyState=1;bufferedAmount=0;send(){}close(){}}
    client=new ArenaClient({...combat,team:'google',profile:'c'.repeat(36),Socket});
    client.socket.onmessage({data:JSON.stringify({type:'arena-welcome',id:enemy.notes[0].id})});
    client.socket.onmessage({data:JSON.stringify(enemy.notes.at(-1))});assert.ok(client.tracks.has(id));
    enter(room.arena,p);room.broadcast();const hidden=enemy.notes.at(-1);
    assert.equal(hidden.players.some(p=>p.id===id),false);client.socket.onmessage({data:JSON.stringify(hidden)});
    assert.equal(client.sample(id),null);assert.equal(client.tracks.has(id),false);
    const poses=BogCombatRoom.prototype.poses.call({client,id:client.id,islandId:BOG_ISLAND,view:()=>client.view()});
    assert.ok(poses.every(p=>p.id!==id),'no render or radar consumer receives hidden pose');
    const source=readFileSync(new URL('../src/features/bog-combat/attach.js',import.meta.url),'utf8');
    assert.match(source,/entry\.readability\.update\(\)/);assert.doesNotMatch(source,/AlphaFilter/);
  }finally{client?.dispose();room.close();}
});

test('live worker snapshots conceal bushes and reconnect preserves the remaining firing reveal',async()=>{
  const owner=await makeRoom();let service;
  const peer=()=>{const s=fakeSocket();s.serializeAttachment=value=>s.saved=value;return s;};
  try{
    const visitor=addPlayer(owner,9800,{islandId:BOG_ISLAND,...mapOf(BOG_ISLAND).HARBOR.land});
    owner.sql.exec('INSERT OR REPLACE INTO karma_balances VALUES(?,?)',visitor.account,10);owner.karma.balances.delete(visitor.account);
    service=owner.bog=new LiveBogRoom(owner);const socket=peer();assert.ok(service.open(socket,{digest:visitor.account,team:'privacy'}));
    let p=service.arena.state.players.get(service.members.get(socket).id);p.x=HIDE_BUSHES[0].x;p.y=HIDE_BUSHES[0].y;p.shieldUntil=0;service.arena.step(1/60);
    assert.equal(service.snapshot('google').players.some(q=>q.id===p.id),false);
    assert.ok(service.snapshot('privacy').players.find(q=>q.id===p.id).bushHidden);
    p.facing=-Math.PI/2;input(service.arena,p,{fire:true});service.arena.step(1/60);input(service.arena,p);
    service.persist(p);service.dispose();
    service=owner.bog=new LiveBogRoom(owner);const again=peer();assert.ok(service.open(again,{digest:visitor.account,team:'google'}));
    p=service.arena.state.players.get(service.members.get(again).id);
    assert.equal(p.team,'privacy');assert.equal(isBushHidden(p,service.arena.state.time),false);
    assert.ok(p.bushRevealUntil-service.arena.state.time>1.8);assert.ok(p.bushRevealUntil-service.arena.state.time<=2);
    assert.ok(service.snapshot('google').players.some(q=>q.id===p.id));
    advance(service.arena,2.05);assert.equal(service.snapshot('google').players.some(q=>q.id===p.id),false);
    assert.equal(owner.karma.balance(visitor.account),5,'no new fee on reconnect');
  }finally{service?.dispose();clearInterval(owner.timer);}
});

test('rustle is owner-only, deduplicated, fresh-entry-only and respects reduced motion without replay',()=>{
  const puffs=[],sounds=[],observe=createBushRustleObserver({puff:(...args)=>puffs.push(args),playSound:s=>sounds.push(s)});
  const self={id:'self',alive:true,x:400,y:400,bushId:null,bushEntry:0};observe(self,0);
  Object.assign(self,{bushId:bush.id,bushEntry:1,bushEnteredAt:.1});observe(self,.1);observe(self,.12);
  assert.equal(puffs.length,1);assert.deepEqual(sounds,['rustle']);
  self.bushHidden=true;observe(self,2.2);assert.equal(puffs.length,1,'reveal expiry is not entry');
  Object.assign(self,{bushEntry:2,bushEnteredAt:3});observe(self,3,true);observe(self,3.1);
  assert.equal(puffs.length,1);assert.equal(sounds.length,2,'mute-aware sound still uses existing audio');
  Object.assign(self,{bushEntry:3,bushEnteredAt:4});observe(self,5);assert.equal(sounds.length,2,'old snapshots stay silent');
  observe(null,5);observe(self,5.1);assert.equal(sounds.length,2,'reconnect seeds state');
});

test('entry leaf puff reuses a fixed pool, finishes in 280ms and cleans up without extra art',()=>{
  const objects=new Container(),sounds=[],view=createBushRustle(objects,Texture.EMPTY,{playSound:s=>sounds.push(s)});
  const nodes=[...objects.children],self={id:'p',alive:true,x:400,y:400,bushEntry:0};
  assert.equal(nodes.length,9);view.update(self,0);
  Object.assign(self,{bushId:bush.id,bushEntry:1,bushEnteredAt:.1});view.update(self,.1);
  assert.equal(nodes.filter(n=>n.visible).length,3);view.update(self,.4);assert.ok(nodes.every(n=>!n.visible));
  for(let i=2;i<30;i++){self.bushEntry=i;self.bushEnteredAt=i;view.update(self,i);}
  assert.deepEqual(objects.children,nodes);view.update(self,30,true);assert.ok(nodes.every(n=>!n.visible));
  view.dispose();assert.equal(objects.children.length,0);assert.ok(nodes.every(n=>n.destroyed));objects.destroy();
});
