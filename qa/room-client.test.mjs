import assert from 'node:assert/strict';
import test from 'node:test';
import {RoomClient,OfflineFleet} from '../src/pixi/room-client.js';
import {mapOf} from '../src/pixi/island-maps.js';
import {ISLANDS} from '../src/pixi/islands.js';
// Home is the sole Home-map island after the duplicate islands were removed.
const PLAIN=ISLANDS.find(island => island.id!=='home' && mapOf(island.id).home)?.id ?? 'home';
import {destinationsFor,harborOf,boatSpots,boatHome,boatSlot,MOORING_CLEAR} from '../src/pixi/islands.js';
import {JUMP_SECONDS,JUMP_CROUCH,JUMP_AIR,JUMP_LAND,JUMP_RISE,jumpHeight,jumpPose,startJump,walkStep} from '../src/pixi/player-motion.js';

function setup() {
  const events=[],sent=[];
  const room=new RoomClient(()=>{},()=>{},()=>{},()=>{},state=>events.push(state));
  room.id='player';
  room.socket={readyState:WebSocket.OPEN,send:data=>sent.push(JSON.parse(data)),close(){}};
  room.configure({route:(x,y,tx,ty)=>[[tx,ty]],clearLine:()=>true},{width:5800,height:4400});
  return {room,events,sent};
}
const packet=(tick,islandId='home',mode='walking')=>({epoch:'epoch',tick,islandId,online:2,
  players:[{id:'player',islandId,mode,x:mode==='sailing'?3960:1800,y:mode==='sailing'?6400:430,turn:0,action:0,emoteVersion:0,travel:0}],
  boats:[{id:'home-0',islandId,x:mode==='sailing'?3960:1800,y:mode==='sailing'?6400:430,turn:0,occupant:mode==='sailing'?'player':null}],
  self:{ack:0,path:[],emoteLeft:0},
});

test('ice reduced-motion input changes preserve corrected interpolation and resend without steering changes',()=>{
  const {room,sent}=setup();
  room.snapshot(packet(1));
  room.offsetX=12;room.offsetY=-4;
  const before=room.view();
  room.step(1/60,{x:1,y:0,reducedMotion:true});
  assert.deepEqual(room.prev,{x:before.x,y:before.y,turn:before.turn});
  assert.equal(sent.at(-1).reducedMotion,true);
  assert.equal(room.player.reducedMotion,true);
  const count=sent.length;
  room.step(1/60,{x:1,y:0,reducedMotion:false});
  assert.equal(sent.length,count+1);
  assert.equal(sent.at(-1).reducedMotion,false);
  assert.equal(room.player.reducedMotion,false);
  room.dispose();
});

test('jump prediction keeps walking, prevents repeated jumps, reconciles and lands remote ducks',()=>{
  const {room,sent}=setup();
  room.snapshot(packet(1));
  room.destination(1900,430);
  const path=room.player.path;
  assert.equal(room.jump(),true);
  assert.equal(room.player.jumpLeft,JUMP_SECONDS);
  assert.equal(room.player.path,path);
  const count=sent.length;
  assert.equal(room.jump(),false);
  assert.equal(sent.length,count);
  room.step(.1,{x:1,y:0});
  assert.ok(room.player.x>1800);
  assert.ok(room.player.jumpLeft<JUMP_SECONDS);
  const acknowledged=packet(2);
  acknowledged.players[0].jumpLeft=.2;
  acknowledged.players.push({...acknowledged.players[0],id:'remote',jumpLeft:.4});
  acknowledged.self.ack=room.seq;
  room.snapshot(acknowledged);
  assert.equal(room.player.jumpLeft,.2);
  assert.equal(room.poses(performance.now()/1000+.8).find(duck=>duck.id==='remote').jumpLeft,0);
  room.snapshot(packet(3,'home','sailing'));
  assert.equal(room.jump(),false);
  room.reset();
  assert.equal(room.jump(),false);
  room.dispose();
});

test('jump arc lands exactly, respects reduced motion and keeps ground collision rules',()=>{
  const actor={x:0,y:0,action:0,turn:0,path:[],until:0,travel:0};
  assert.equal(startJump(actor),true);
  assert.equal(jumpHeight(JUMP_SECONDS),0);
  assert.equal(jumpHeight(0),0);
  const apex=JUMP_SECONDS-JUMP_CROUCH-JUMP_AIR/2;   // jumpLeft at the top of the flight
  assert.equal(jumpHeight(apex),JUMP_RISE);
  assert.ok(jumpHeight(apex,true)>0 && jumpHeight(apex,true)<jumpHeight(apex));
  for(let i=0;i<40;i++) walkStep(actor,{clearLine:()=>false,walkable:()=>false},.05,i*.05,{x:1,y:0});
  assert.equal(actor.jumpLeft,0);
  assert.deepEqual([actor.x,actor.y],[0,0]);
  assert.equal(startJump(actor),true);
  assert.equal(startJump({...actor,mode:'sailing',jumpLeft:0}),false);
});

test('the jump crouches, stretches up, leans the way it walks, squashes on landing and settles (boss 6 Nov)',()=>{
  const at=t=>jumpPose(JUMP_SECONDS-t,false,{turn:Math.PI/2,moving:true});   // walking right
  assert.ok(JUMP_SECONDS>=.45 && JUMP_SECONDS<=.6);
  const crouch=at(JUMP_CROUCH*.95);
  assert.equal(crouch.phase,'crouch'); assert.equal(crouch.lift,0);
  assert.ok(crouch.sy<.8 && crouch.sx>1.15,'anticipation squash before takeoff');
  const rising=at(JUMP_CROUCH+JUMP_AIR*.15);
  assert.equal(rising.phase,'air');
  assert.ok(rising.sy>1.1 && rising.sx<.95,'stretched on the way up');
  assert.ok(at(JUMP_CROUCH+JUMP_AIR*.6).rotation>.03,'leans into the walking direction');
  assert.ok(jumpPose(JUMP_SECONDS-JUMP_CROUCH-JUMP_AIR*.6,false,{turn:-Math.PI/2,moving:true}).rotation<-.03,'and the other way walking left');
  // ease-out up, ease-in down: the first fifth of the flight climbs more than the fifth before the top
  const lift=u=>at(JUMP_CROUCH+JUMP_AIR*u).lift;
  assert.ok(lift(.2)-lift(0)>lift(.5)-lift(.3));
  assert.ok(lift(.8)-lift(1)>lift(.6)-lift(.8),'falls faster at the end');
  const top=at(JUMP_CROUCH+JUMP_AIR/2);
  assert.ok(top.shadowScale<.6 && top.shadow<.1,'the shadow shrinks and fades at the top');
  const land=at(JUMP_CROUCH+JUMP_AIR+.001);
  assert.equal(land.phase,'land'); assert.equal(land.lift,0);
  assert.ok(land.sy<.75 && land.sx>1.2,'squash on landing');
  const settled=at(JUMP_SECONDS-.0001);
  assert.ok(Math.abs(settled.sy-1)<.01 && Math.abs(settled.sx-1)<.01,'settles back to rest');
  assert.deepEqual(jumpPose(0),{lift:0,sx:1,sy:1,rotation:0,shadow:0,shadowScale:1,phase:'ground'});
  const calm=jumpPose(JUMP_SECONDS-JUMP_CROUCH-JUMP_AIR*.2,true);
  assert.equal(calm.sx,1); assert.equal(calm.rotation,0);   // reduced motion: a small lift only
});

test('Shift sends a run flag with keyboard input and changing it alone resends input (boss 6 Nov)',()=>{
  const {room,sent}=setup();
  room.snapshot(packet(1));
  room.step(1/60,{x:1,y:0});
  assert.equal(sent.at(-1).type,'input'); assert.equal(sent.at(-1).run,undefined);
  room.step(1/60,{x:1,y:0,run:true});
  assert.equal(sent.at(-1).run,true);
  room.step(1/60,{x:1,y:0});
  assert.equal(sent.at(-1).run,undefined);
  room.dispose();
});

test('position corrections remain continuous at snapshots and between prediction steps',()=>{
  const {room}=setup();
  room.snapshot(packet(1));
  room.step(1/60,{x:0,y:0});
  room.setAlpha(.5);
  const before=room.view().x;
  const next=packet(2);
  next.players[0].x+=20;
  room.snapshot(next);
  assert.equal(room.view().x,before,'receiving a snapshot does not move the rendered duck');
  room.setAlpha(1);
  const endOfStep=room.view().x;
  room.step(1/60,{x:0,y:0});
  room.setAlpha(0);
  assert.equal(room.view().x,endOfStep,'starting a step does not jump to the newly decayed correction');
  room.setAlpha(1);
  assert.ok(room.view().x>endOfStep,'the correction still converges toward the server');
  const late=packet(3);
  late.players[0].x-=20;
  room.snapshot(late);
  const beforeWalk=room.view().x;
  room.step(1/60,{x:1,y:0});
  assert.ok(room.view().x>beforeWalk,'catching up to the server does not pull a walking duck backwards');
  room.dispose();
});

test('repeated server corrections do not kick walking speed forward and back',()=>{
  const {room}=setup();
  room.snapshot(packet(1));
  room.setAlpha(1);
  const input={x:1,y:0};
  for(let i=0;i<12;i++)room.step(1/60,input);
  let previousStep=245/60;
  for(let i=0;i<120;i++){
    const before=room.view().x;
    if(i%6===0){
      const next=packet(2+i);
      Object.assign(next.players[0],room.player,{x:room.player.x+(i%12===0?-8:8)});
      next.self.ack=room.seq;
      room.snapshot(next);
      assert.ok(Math.abs(room.view().x-before)<1e-9,'snapshot preserves the drawn position');
    }
    room.step(1/60,input);
    const step=room.view().x-before;
    assert.ok(step>0,'walking never reverses');
    assert.ok(Math.abs(step-previousStep)<.8,'network corrections accelerate smoothly');
    previousStep=step;
  }
  room.stopInput();
  for(let i=0;i<180;i++)room.step(1/60,{x:0,y:0});
  assert.ok(Math.hypot(room.offsetX,room.offsetY)<.001,'correction settles after stopping');
  room.dispose();
});

test('nearby friends choose the closest live account, retain it, and respect saves, dismissals and reconnects',()=>{
  const {room}=setup();
  const candidates=[];
  room.onNearby=player=>candidates.push(player);
  const next=packet(1);
  Object.assign(next.players[0],{accountId:'1',login:'self'});
  next.players.push(
    {...next.players[0],id:'far',accountId:'2',login:'far',x:1970},
    {...next.players[0],id:'close',accountId:'3',login:'close',x:1900},
    {...next.players[0],id:'npc',accountId:undefined,login:undefined,x:1801},
    {...next.players[0],id:'other-island',accountId:'4',login:'other',islandId:'blossom',x:1801},
  );
  room.snapshot(next);
  assert.equal(candidates.length,0,'friends must load before prompting');
  room.setFriends([]);
  assert.equal(candidates.at(-1).id,'close');
  next.tick++;
  next.players.find(player=>player.id==='far').x=1810;
  room.snapshot(next);
  assert.equal(candidates.length,1,'a nearer arrival does not replace the current prompt');
  room.dismissFriend('3');
  assert.equal(candidates.at(-1).id,'far');
  room.setFriends([{accountId:'2'}]);
  assert.equal(candidates.at(-1),null);
  room.reset();
  room.id='player';
  next.tick++;
  room.snapshot(next);
  assert.equal(candidates.at(-1),null,'reconnecting keeps saved and dismissed accounts excluded');
  room.clearFriends();
  room.setFriends([]);
  assert.equal(candidates.at(-1).id,'far');
  next.tick++;
  next.players=next.players.filter(player=>player.id!=='far');
  room.snapshot(next);
  assert.equal(candidates.at(-1).id,'close');
  next.tick++;
  next.players.find(player=>player.id==='close').x=1981;
  room.snapshot(next);
  assert.equal(candidates.at(-1),null);
  room.dispose();
});

test('boarding and island changes clear prediction and boat interpolation without replaying old commands',()=>{
  const {room,events}=setup();
  room.snapshot(packet(1));
  room.destination(1850,430);
  assert.equal(room.pending.length,1);
  room.offsetX=12;
  room.snapshot(packet(2,'home','sailing'));
  assert.equal(room.pending.length,0);
  assert.equal(room.offsetX,0);
  assert.equal(room.emote(3),false);
  room.destination(3960,6500);
  assert.deepEqual(room.player.sailTarget,{x:3960,y:6500});
  room.snapshot(packet(3,'blossom','sailing'));
  assert.equal(room.pending.length,0);
  assert.equal(room.player.sailTarget,null);
  assert.equal(room.islandId,'blossom');
  room.snapshot(packet(2));
  assert.equal(room.islandId,'blossom');
  assert.equal(events.at(-1).islandId,'blossom');
  room.dispose();
});

test('sailing prediction uses bounded motion and sends the authoritative island with commands',()=>{
  // an island on the home map (boss 6 Nov: the nearest three are themed, with their own coasts)
  const {room,sent}=setup();
  room.snapshot(packet(1,PLAIN,'sailing'));
  room.step(.05,{x:0,y:1});
  assert.equal(room.player.y,6419);
  assert.equal(sent.at(-1).islandId,PLAIN);
  room.disembark();
  assert.equal(room.player.docking,true);
  room.step(.05,{x:1,y:0});
  assert.equal(room.player.docking,false);
  assert.equal(room.player.sailTarget,null);
  room.destination(3960,6500);
  room.stopInput();
  const next=packet(2,PLAIN,'sailing');
  next.self.sailTarget={x:3960,y:6500};
  room.snapshot(next);
  assert.equal(room.player.sailTarget,null,'unacknowledged stop survives reconciliation');
  room.dispose();
});

test('only spectators can request a different island',()=>{
  const {room,sent}=setup();
  room.watch('blossom');
  assert.equal(sent.length,0);
  room.id=null;
  room.watch('unknown');
  assert.equal(sent.length,0);
  room.watch('blossom');
  assert.deepEqual(sent,[{type:'watch',islandId:'blossom'}]);
  room.dispose();
});

test('the dock button asks the server to dock at the nearest shore',()=>{
  const {room,sent}=setup();
  const next=packet(1,'home','sailing');
  const target=destinationsFor('home')[0].dock;
  Object.assign(next.players[0],{x:target.x,y:target.y-250});
  room.snapshot(next);
  room.disembark();
  assert.equal(sent.at(-1).type,'disembark');   // boss 5 Nov: dock anywhere; the server picks the harbor or the nearest sand
  room.dispose();
});

// boss 6 Nov ("I took the boat already. Every island should have all the boats"): concepts/feel/boats-spec.md
const moored=(fleet,islandId)=>fleet.boats(islandId).filter(boat=>!boat.occupant && boatSpots(islandId).some(spot=>spot.x===boat.x && spot.y===boat.y));   // that island's own map's moorings
test('offline: every island starts with all its moored boats',()=>{
  const fleet=new OfflineFleet();
  for (const id of ['home',...destinationsFor('home').map(d=>d.destination)]) assert.equal(moored(fleet,id).length,boatSpots(id).length,id);
  assert.equal(new Set(fleet.list.map(boat=>boat.id)).size,fleet.list.length,'ids are never shared');
});

test('offline: a taken boat refills its mooring once the sailor is clear, and only then',()=>{
  const fleet=new OfflineFleet(), spot=boatSpots()[4];
  assert.ok(fleet.take('home-4','me'));
  assert.equal(fleet.take('home-5','me'),null,'one boat at a time');
  assert.equal(fleet.sail('me',{x:spot.x+MOORING_CLEAR-20,y:spot.y,turn:0,islandId:'home'}),false,'still beside the mooring: no refill yet');
  assert.equal(moored(fleet,'home').length,9);
  assert.equal(fleet.sail('me',{x:spot.x+MOORING_CLEAR+40,y:spot.y,turn:0,islandId:'home'}),true);
  const fresh=fleet.boats('home').find(boat=>boat.id!=='home-4' && boatSlot(boat)===4 && boatHome(boat)==='home');
  assert.ok(fresh && !fresh.occupant,'a fresh boat waits at the mooring');
  assert.deepEqual([fresh.x,fresh.y],[spot.x,spot.y]);
  assert.equal(moored(fleet,'home').length,10);
  assert.equal(fleet.boats('home').length,11,'10 moored + 1 sailing');
  assert.ok(fleet.take(fresh.id,'friend'),'the next sailor takes the refill');
});

test('offline: crossing to another island refills home and keeps the boat where you landed',()=>{
  const fleet=new OfflineFleet(), away=destinationsFor('home')[0], there=away.destination, per=boatSpots(there).length;
  fleet.take('home-0','me');
  const water=harborOf(there).water;   // docked beside that island's own jetty, in its own coordinates
  assert.equal(fleet.sail('me',{x:water.x,y:water.y,turn:0,islandId:there}),true);
  assert.equal(moored(fleet,'home').length,10,'the jetty you left is full again');
  assert.equal(moored(fleet,there).length,per,'the island you reach already has all its boats');
  const boat=fleet.land('me');
  assert.equal(boat.id,'home-0');
  assert.ok(fleet.list.includes(boat));
  assert.deepEqual([boat.x,boat.y,boat.occupant],[water.x,water.y,null]);
  assert.equal(fleet.boats(there).length,per+1);
  assert.ok(fleet.take(boat.id,'friend'),'another sailor can take the parked arrival boat');
  assert.equal(fleet.boats('home').length,10);
});

test('offline: stepping off beside your own empty mooring ties the boat back up',()=>{
  const fleet=new OfflineFleet(), spot=boatSpots()[1];
  fleet.take('home-1','me');
  fleet.sail('me',{x:spot.x+60,y:spot.y+40,turn:1,islandId:'home'});
  fleet.land('me');
  const boat=fleet.list.find(boat=>boat.id==='home-1');
  assert.ok(boat && !boat.occupant);
  assert.deepEqual([boat.x,boat.y],[spot.x,spot.y]);
  assert.equal(fleet.boats('home').length,10);
});

test('a refilled boat appears at its mooring, never slides in from the sailing one',()=>{
  const {room}=setup(), spot=boatSpots()[2];
  const first=packet(1,'home','sailing');
  first.boats=[{id:'home-2',islandId:'home',x:spot.x+400,y:spot.y,turn:0,occupant:'player'}];
  room.snapshot(first);
  const next=packet(2,'home','sailing');
  next.boats=[...first.boats,{id:'home-2~a',islandId:'home',x:spot.x,y:spot.y,turn:spot.turn,occupant:null,spawnedAt:Date.now()}];
  room.snapshot(next);
  const fresh=room.boatPoses().find(boat=>boat.id==='home-2~a');
  assert.deepEqual([fresh.x,fresh.y],[spot.x,spot.y]);
  assert.equal(fresh.travel,0);
  room.dispose();
});
