import assert from 'node:assert/strict';
import test from 'node:test';
import {RoomClient} from '../src/pixi/room-client.js';

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
