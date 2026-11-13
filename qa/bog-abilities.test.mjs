import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {Container,Texture} from 'pixi.js';
import {createBogCombat} from '../src/features/bog-combat/sim.js';
import {RULES} from '../src/features/bog-combat/rules.js';
import {combatWalkStep} from '../src/features/bog-combat/mechanics.js';
import {createPickupSpots} from '../src/features/bog-combat/pickups.js';
import {createPickupsView,createAbilityView} from '../src/features/bog-combat/pickups-view.js';
import {saveAbilityTimers,ABILITY_TIMERS} from '../src/features/bog-combat/ability-state.js';
import {bindCombatInput} from '../src/features/bog-combat/input.js';
import {ArenaClient,ARENA_INPUT_INTERVAL} from '../src/features/bog-combat/client.js';
import {BOG_COMBAT} from '../src/features/bog-combat/config.js';
import {walkingActor} from '../src/features/bog-combat/physics.js';

const advance=(sim,s)=>{for(let i=0;i<Math.round(s*60);i++)sim.step(1/60);};
const wall={blocksWalk:true,blocksShots:true,polygon:[{x:280,y:100},{x:290,y:100},{x:290,y:900},{x:280,y:900}]};
function fixture(options={}){
  const sim=createBogCombat({blockers:[],bounds:{width:2000,height:1500},pads:team=>[{x:team==='karma'?200:600,y:400}],pickupSpots:[],...options});
  const p=sim.join({id:'p',team:'karma'}),e=sim.join({id:'e',team:'evil'});p.shieldUntil=e.shieldUntil=0;p.facing=Math.PI/2;
  return {sim,p,e};
}
function input(sim,p,extra={}){return sim.input(p.id,{seq:p.seq+1,x:0,y:0,fire:false,...extra});}
function fire(sim,p){input(sim,p,{fire:true});sim.step(1/60);return sim.state.shots.find(s=>s.owner===p.id);}
function hit(sim,p){sim.state.shots.push({id:999,owner:'e',team:'evil',x:p.x,y:p.y,dx:1,dy:0,left:1,colour:0});sim.step(1/60);}

test('aim assist bends at most fourteen degrees toward nearest visible enemy for humans and bots',()=>{
  for(const bot of [false,true]){
    const {sim,p,e}=fixture();p.bot=bot;e.x=560;e.y=470;
    const nearer=sim.join({id:'near',team:'evil'});nearer.x=420;nearer.y=430;nearer.shieldUntil=0;nearer.hits=RULES.hitsPerHeart-1;
    const shot=fire(sim,p),angle=Math.atan2(shot.dy,shot.dx);
    assert.ok(Math.abs(angle-Math.atan2(30,220))<1e-9);assert.equal(p.facing,Math.PI/2);
    assert.ok(angle<=RULES.aimCone);advance(sim,.2);assert.equal(nearer.alive,false);assert.equal(e.alive,true);
  }
});
test('assist ignores friendly, hidden, tagged, out-of-range and outside-cone ducks',()=>{
  for(const excluded of ['friendly','hidden','tagged','range','cone']){
    const {sim,p,e}=fixture();e.x=440;e.y=440;
    if(excluded==='friendly')e.team=p.team;
    if(excluded==='hidden')e.shieldUntil=7;
    if(excluded==='tagged'){e.alive=false;e.respawnAt=10;}
    if(excluded==='range'){e.x=p.x+RULES.range+30;e.y=p.y+40;}
    if(excluded==='cone')e.y=p.y+150;
    const shot=fire(sim,p);assert.ok(Math.abs(shot.dy)<1e-9,excluded);assert.ok(Math.abs(shot.dx-1)<1e-9,excluded);
  }
});
test('assist cannot see through cover and leaves an unassisted facing shot unchanged',()=>{
  const {sim,p,e}=fixture({blockers:[wall]});e.x=450;e.y=440;
  const shot=fire(sim,p);assert.ok(Math.abs(shot.dy)<1e-9);advance(sim,.3);assert.equal(e.alive,true);assert.equal(p.stats.tags,0);
});
test('Q hop travels 1.5 duck lengths in .25 s, does not repeat from held packets, and enforces cooldown',()=>{
  const {sim,p}=fixture(),start=p.x;
  input(sim,p,{dodge:1});advance(sim,.25);assert.ok(Math.abs(p.x-start-RULES.dodgeDistance)<1e-8);
  const stopped=p.x;input(sim,p,{dodge:1});advance(sim,.1);assert.equal(p.x,stopped);
  input(sim,p,{dodge:2});sim.step(1/60);assert.equal(p.x,stopped);
  advance(sim,2.3);input(sim,p,{dodge:3});advance(sim,.25);assert.ok(Math.abs(p.x-stopped-RULES.dodgeDistance)<1e-8);
});
test('a hop uses movement direction or last facing while idle, cannot cross walls or coastlines',()=>{
  const {sim,p}=fixture({blockers:[wall]});p.x=240;input(sim,p,{x:1,dodge:1});advance(sim,.25);
  assert.ok(p.x<=258,'stops one duck radius from cover');assert.equal(p.y,400);
  const second=fixture();second.p.x=1970;input(second.sim,second.p,{dodge:1});advance(second.sim,.25);assert.ok(second.p.x<=1978);
  const third=fixture();input(third.sim,third.p,{x:0,y:1,dodge:1});advance(third.sim,.25);assert.ok(Math.abs(third.p.y-472)<1e-8);assert.equal(third.p.x,200);
});
test('hop grants only .15 s tag protection, remains visible, and then a hit costs one life',()=>{
  const {sim,p}=fixture();p.hits=RULES.hitsPerHeart-1;input(sim,p,{dodge:1});sim.step(1/60);
  assert.ok(sim.snapshot('evil').players.some(q=>q.id===p.id));hit(sim,p);assert.equal(p.lives,5);
  advance(sim,.15);hit(sim,p);assert.equal(p.lives,4);assert.equal(p.alive,false);assert.equal(p.dodgeUntil,0);
});
test('bad dodge packets cannot inject cooldowns, shields or scoring',()=>{
  const {sim,p}=fixture();for(const dodge of [true,-1,NaN,Infinity,1.2,'1'])assert.equal(input(sim,p,{dodge}),false);
  input(sim,p,{dodge:1,dodgeReadyAt:-999,hitShield:100,score:999});sim.step(1/60);
  assert.equal(p.hitShield,0);assert.equal(p.stats.score,0);assert.ok(p.dodgeReadyAt>2.4);
});
test('five pickups occupy walkable Mid, Site A/B and two lane spots, with a twenty-second server timer',()=>{
  const spots=createPickupSpots(BOG_COMBAT.navigation);assert.equal(spots.length,5);
  assert.deepEqual(spots.map(s=>s.id),['mid','site-a','site-b','west-lane','east-lane']);
  assert.deepEqual(spots.map(s=>s.kind),['paint','paint','shield','shield','paint'],'paint and shield only: one of each per side plus Mid');
  for(const s of spots)assert.ok(BOG_COMBAT.navigation.walkable(s.x,s.y));
  const {sim,p}=fixture({pickupSpots:[{id:'paint',kind:'paint',x:200,y:400}]});p.ammo=2;p.reloadAt=100;sim.step(1/60);
  assert.equal(p.ammo,12);assert.equal(p.reloadAt,0);assert.equal(sim.state.pickups[0].readyAt,sim.state.time+20);
  const exported=sim.snapshot('karma').pickups;exported[0].readyAt=0;assert.ok(sim.state.pickups[0].readyAt>0);
  p.ammo=2;advance(sim,19.9);assert.equal(p.ammo,2);advance(sim,.15);assert.equal(p.ammo,12);
});
test('one pickup has one authoritative collector, tagged ducks cannot collect it',()=>{
  const {sim,p,e}=fixture({pickupSpots:[{id:'one',kind:'shield',x:200,y:400}]});
  p.alive=false;p.respawnAt=10;e.x=200;e.y=400;sim.step(1/60);
  assert.equal(p.hitShield,0);assert.equal(e.hitShield,1);
  p.alive=true;sim.step(1/60);assert.equal(p.hitShield,0);
});
test('small shield consumes one hit without score or lives, next decisive hit tags and the bubble also expires at eight seconds',()=>{
  const {sim,p}=fixture({pickupSpots:[{id:'shield',kind:'shield',x:200,y:400}]});sim.step(1/60);
  assert.equal(p.hitShield,1);assert.equal(p.hitShieldUntil,sim.state.time+8);
  p.hits=RULES.hitsPerHeart-1;hit(sim,p);assert.equal(p.alive,true);assert.equal(p.lives,5);assert.equal(p.hitShield,0);assert.equal(sim.state.events.length,0);
  assert.equal(sim.state.players.get('e').stats.tags,0);assert.equal(p.hits,RULES.hitsPerHeart-1);hit(sim,p);assert.equal(p.lives,4);assert.equal(sim.state.players.get('e').stats.tags,1);
  const other=fixture({pickupSpots:[{id:'shield',kind:'shield',x:200,y:400}]});other.sim.step(1/60);other.p.x=800;advance(other.sim,8.05);other.p.hits=RULES.hitsPerHeart-1;hit(other.sim,other.p);assert.equal(other.p.lives,4);
});
test('spawn hiding, hop immunity and one-hit shield are independent; firing reveals but preserves shield',()=>{
  const {sim,p}=fixture({pickupSpots:[{id:'shield',kind:'shield',x:200,y:400}]});p.shieldUntil=7;sim.step(1/60);
  fire(sim,p);assert.ok(p.shieldUntil<=sim.state.time);assert.equal(p.hitShield,1);hit(sim,p);assert.equal(p.lives,5);assert.equal(p.hitShield,0);
});
test('client predicts the same hop path as the authority, and sends the request within the existing rate limit',()=>{
  const {sim,p}=fixture();
  let socket;class Socket{readyState=1;bufferedAmount=0;sent=[];constructor(){socket=this;}send(data){const m=JSON.parse(data);this.sent.push(m);sim.input(p.id,m);}close(){}}
  const client=new ArenaClient({Socket,profile:'x'.repeat(36),url:'ws://local',navigation:BOG_COMBAT.navigation});
  client.nav={walkable:()=>true,clearLine:()=>true};
  socket.onmessage({data:JSON.stringify({type:'arena-welcome',id:p.id})});
  socket.onmessage({data:JSON.stringify(sim.snapshot())});client.queueDodge();
  for(let i=0;i<15;i++){client.control({x:1,y:0},Math.PI/2,false,1/60,i*1000/60);sim.step(1/60);assert.ok(Math.abs(client.predicted.x-p.x)<1e-7);}
  assert.equal(socket.sent[0].dodge,1);assert.ok(socket.sent.length<=8);assert.ok(client.predicted.dodgeReadyAt>2.4);
  const count=socket.sent.length;client.control({x:0,y:0},0,false,0,client.lastSend+1);assert.equal(socket.sent.length,count);
  assert.ok(ARENA_INPUT_INTERVAL>33);client.dispose();
});
test('shared movement replay retains hop timing and movement through reconciliation',()=>{
  const {sim,p}=fixture();input(sim,p,{x:1,dodge:1});sim.step(1/60);
  const saved=sim.snapshot().players.find(q=>q.id==='p'),copy=walkingActor(saved),nav={walkable:()=>true,clearLine:()=>true};
  for(let i=0;i<8;i++){combatWalkStep(copy,nav,1/60,sim.state.time+1/60,{x:1,y:0,run:false,dodge:1});sim.step(1/60);assert.ok(Math.abs(copy.x-p.x)<1e-7);assert.equal(copy.dodgeReadyAt,p.dodgeReadyAt);}
});
test('ability timers survive authority clock reset without replenishing a consumed shield or restarting the hop',()=>{
  const {sim,p}=fixture();p.hitShield=1;p.hitShieldUntil=8;input(sim,p,{dodge:1});advance(sim,.1);
  const snap=sim.snapshot().players.find(q=>q.id==='p'),combat={...snap,...saveAbilityTimers(p,sim.state.time)};
  const fresh=fixture().sim;fresh.leave('p');const restored=fresh.join({id:'p',team:'karma',combat});
  for(const [left,until]of Object.entries(ABILITY_TIMERS))assert.ok(Math.abs(restored[until]-combat[left])<1e-9);
  assert.equal(restored.hitShield,1);assert.equal(restored.dodgeSerial,1);hit(fresh,restored);assert.equal(restored.hitShield,1,'hop protection survived');
  advance(fresh,.1);hit(fresh,restored);assert.equal(restored.hitShield,0);assert.equal(restored.lives,5);
});
test('Q and double-tap Shift request once, leave island Shift listeners active and cleanly remove listeners',()=>{
  const dom=new JSDOM('<canvas></canvas><input/>'),{window}=dom,canvas=window.document.querySelector('canvas');let hops=0,shifts=0;
  const unbind=bindCombatInput(canvas,{keyboard:window,document:window.document,onDodge:()=>hops++});
  window.addEventListener('keydown',e=>{if(e.key==='Shift')shifts++;});
  const key=(code,key,extra={})=>window.dispatchEvent(new window.KeyboardEvent('keydown',{code,key,bubbles:true,cancelable:true,...extra}));
  key('KeyQ','q');key('KeyQ','q',{repeat:true});assert.equal(hops,1);
  key('ShiftLeft','Shift');key('ShiftLeft','Shift',{repeat:true});key('ShiftLeft','Shift');assert.equal(hops,2);assert.equal(shifts,3);
  window.document.querySelector('input').dispatchEvent(new window.KeyboardEvent('keydown',{code:'KeyQ',key:'q',bubbles:true}));assert.equal(hops,2);
  unbind();key('KeyQ','q');assert.equal(hops,2);dom.window.close();
});
test('pickup SVGs use flat vector paths only and pooled display nodes bob without growing',()=>{
  for(const kind of ['paint','shield']){
    const svg=readFileSync(new URL(`../src/features/bog-combat/assets/pickups/${kind}.svg`,import.meta.url),'utf8');
    assert.ok(svg.includes('#232323'));assert.doesNotMatch(svg,/<image|gradient|data:image|filter=/i);
  }
  const objects=new Container(),art={paint:Texture.WHITE,shield:Texture.WHITE},view=createPickupsView(objects,art);
  const snapshot={pickups:[{id:'one',kind:'paint',x:100,y:200,readyAt:0}]};
  view.update(snapshot,0);const node=objects.children[0],icon=node.children[1],before=icon.y;
  for(let i=1;i<60;i++)view.update(snapshot,i/60);assert.equal(objects.children.length,1);assert.notEqual(icon.y,before);
  snapshot.pickups[0].readyAt=20;view.update(snapshot,1);assert.equal(node.visible,false);view.update(snapshot,21);assert.equal(node.visible,true);
  view.dispose();assert.equal(objects.children.length,0);objects.destroy({children:true});
});
test('shield display uses one bubble and hop squash stays within eight percent on the real rig art container',()=>{
  const objects=new Container(),root=new Container(),art=new Container(),direction=new Container({label:'Direction 0'});art.addChild(direction);root.addChild(art);objects.addChild(root);
  const ability=createAbilityView(objects,{root});const p={alive:true,hitShield:1,hitShieldUntil:8,dodgeUntil:.25};
  ability.update(p,.125);assert.equal(objects.children.length,2);assert.ok(art.scale.y<=1.08);assert.ok(art.scale.x>=.92);assert.ok(root.y<0);assert.equal(objects.children[1].visible,true);
  ability.update({...p,hitShield:0},1);assert.equal(objects.children[1].visible,false);ability.dispose();assert.equal(objects.children.length,1);objects.destroy({children:true});
});

test('pooled shots and splats recycle across long firing sessions and demo resets',()=>{
  const {sim,p,e}=fixture();sim.leave(e.id);const seen=new Set(),marks=new Set();
  for(let i=0;i<300;i++){
    p.nextFire=0;p.ammo=12;const shot=fire(sim,p);assert.ok(shot);seen.add(shot);
    if(i%2===0)sim.state.shots.length=0;else{advance(sim,.4);for(const mark of sim.state.splats)marks.add(mark);}
  }
  assert.ok(seen.size<=RULES.maxShots);assert.ok(marks.size<=RULES.maxSplats);assert.ok(sim.state.splats.length<=RULES.maxSplats);
});
test('a request received while tagged never becomes an automatic hop on respawn',()=>{
  const {sim,p}=fixture();p.hits=RULES.hitsPerHeart-1;hit(sim,p);assert.equal(p.alive,false);input(sim,p,{dodge:1});advance(sim,3.05);
  assert.equal(p.alive,true);const x=p.x;input(sim,p,{dodge:1});sim.step(1/60);assert.equal(p.x,x);assert.equal(p.dodgeUntil,0);
});

test('production transport persists pickup effects and cooldowns, and reconnect never restores a spent shield',async()=>{
  const {makeRoom,addPlayer,fakeSocket}=await import('./room-harness.mjs');
  const {LiveBogRoom}=await import('../worker/bog-room.js');
  const {BOG_ISLAND}=await import('../src/features/bog-combat/entry.js');
  const {mapOf}=await import('../src/world/island-maps.js');
  const room=await makeRoom();let service;
  const peer=()=>{const s=fakeSocket();s.serializeAttachment=v=>s.saved=v;s.deserializeAttachment=()=>s.saved;return s;};
  try{
    const visitor=addPlayer(room,9901,{islandId:BOG_ISLAND,...mapOf(BOG_ISLAND).HARBOR.land,mode:'walking'});
    room.sql.exec('INSERT OR REPLACE INTO karma_balances VALUES(?,?)',visitor.account,10);room.karma.balances.delete(visitor.account);
    service=room.bog=new LiveBogRoom(room);const socket=peer();assert.ok(service.open(socket,{digest:visitor.account,team:'karma'}));
    let p=service.arena.state.players.get(service.members.get(socket).id);
    for(const kind of ['shield']){const spot=service.arena.state.pickups.find(s=>s.kind===kind);p.x=spot.x;p.y=spot.y;service.step();}
    service.arena.input(p.id,{seq:0,x:1,y:0,fire:false,dodge:1});service.step();
    assert.equal(p.hitShield,1);assert.ok(p.dodgeReadyAt>service.arena.state.time);
    const record=room.karma.bogEntry(visitor.account).combat;assert.ok(record.dodgeCooldownLeft>2.4);assert.equal(record.hitShield,1);
    service.close(socket);const replacement=peer();assert.ok(service.open(replacement,{digest:visitor.account,team:'karma'}));
    p=service.arena.state.players.get(service.members.get(replacement).id);assert.equal(p.hitShield,1);assert.equal(p.dodgeSerial,1);assert.ok(p.dodgeReadyAt>service.arena.state.time+2.3);
    advance(service.arena,.2);p.shieldUntil=0;hit(service.arena,p);assert.equal(p.hitShield,0);service.step();
    assert.equal(room.karma.bogEntry(visitor.account).combat.hitShield,0,'consumption is saved before a close');
    service.close(replacement);const again=peer();assert.ok(service.open(again,{digest:visitor.account,team:'karma'}));
    p=service.arena.state.players.get(service.members.get(again).id);assert.equal(p.hitShield,0);
  }finally{service?.dispose();clearInterval(room.timer);}
});

test('replaying a turn followed by an idle hop uses the new facing, including unsent commands',()=>{
  const {sim,p}=fixture(),copy=walkingActor(sim.snapshot().players.find(q=>q.id===p.id)),nav={walkable:()=>true,clearLine:()=>true};
  combatWalkStep(copy,nav,1/60,1/60,{x:0,y:1});
  const before=copy.y;combatWalkStep(copy,nav,1/60,2/60,{x:0,y:0,dodge:1});
  assert.equal(copy.dodgeX,0);assert.equal(copy.dodgeY,1);assert.ok(Math.abs(copy.y-before-RULES.dodgeDistance/15)<1e-9);
});
