import assert from 'node:assert/strict';
import test from 'node:test';
import {RoomClient} from '../src/pixi/room-client.js';
import {destinationsFor} from '../src/pixi/islands.js';
import {JUMP_SECONDS,jumpHeight,startJump,walkStep} from '../src/pixi/player-motion.js';

function setup() {
  const events=[],sent=[];
  const room=new RoomClient(()=>{},()=>{},()=>{},()=>{},state=>events.push(state));
  room.id='player';
  room.socket={readyState:WebSocket.OPEN,send:data=>sent.push(JSON.parse(data)),close(){}};
  room.configure({route:(x,y,tx,ty)=>[[tx,ty]],clearLine:()=>true},{width:5800,height:4400});
  return {room,events,sent};
}
const packet=(tick,islandId='home',mode='walking')=>({epoch:'epoch',tick,islandId,online:2,
  players:[{id:'player',islandId,mode,x:1800,y:430,turn:0,action:0,emoteVersion:0,travel:0}],
  boats:[{id:'home-0',islandId,x:1800,y:430,turn:0,occupant:mode==='sailing'?'player':null}],
  self:{ack:0,path:[],emoteLeft:0},
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
  assert.equal(jumpHeight(JUMP_SECONDS/2),85);
  assert.ok(jumpHeight(JUMP_SECONDS/2,true)<jumpHeight(JUMP_SECONDS/2));
  for(let i=0;i<40;i++) walkStep(actor,{clearLine:()=>false,walkable:()=>false},.05,i*.05,{x:1,y:0});
  assert.equal(actor.jumpLeft,0);
  assert.deepEqual([actor.x,actor.y],[0,0]);
  assert.equal(startJump(actor),true);
  assert.equal(startJump({...actor,mode:'sailing',jumpLeft:0}),false);
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
  room.destination(1900,430);
  assert.deepEqual(room.player.sailTarget,{x:1900,y:430});
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
  const {room,sent}=setup();
  room.snapshot(packet(1,'sunset','sailing'));
  room.step(.05,{x:0,y:1});
  assert.equal(room.player.y,449);
  assert.equal(sent.at(-1).islandId,'sunset');
  room.disembark();
  assert.equal(room.player.docking,true);
  room.step(.05,{x:1,y:0});
  assert.equal(room.player.docking,false);
  assert.equal(room.player.sailTarget,null);
  room.destination(1800,550);
  room.stopInput();
  const next=packet(2,'sunset','sailing');
  next.self.sailTarget={x:1800,y:550};
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

test('the dock button approaches a nearby discovered island pier',()=>{
  const {room,sent}=setup();
  const next=packet(1,'home','sailing');
  const target=destinationsFor('home')[0].dock;
  Object.assign(next.players[0],{x:target.x,y:target.y-250});   // neighbour docks face north, so you arrive from the open water above
  room.snapshot(next);
  room.disembark();
  assert.equal(sent.at(-1).type,'destination');
  assert.deepEqual(room.player.sailTarget,target);
  room.dispose();
});
