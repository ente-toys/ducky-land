import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeRoom,addPlayer,fakeSocket} from './room-harness.mjs';
import {LiveSledRoom} from '../worker/sled-room.js';
import {IslandRoom} from '../worker/index.js';
import {connectSled} from '../server/pages-auth.js';
import {mapOf} from '../src/world/island-maps.js';
import {SLED,SLED_ISLAND,SLED_ZONE,SLED_WATCH_RADIUS} from '../src/features/sled-race/rules.js';
import {landingSpot,podiumFront,podiumTop} from '../src/features/sled-race/hill.js';

const hill=()=>mapOf(SLED_ISLAND).world.zones[SLED_ZONE];
const peer=()=>{const s=fakeSocket();s.serializeAttachment=v=>{s.saved=v;};s.deserializeAttachment=()=>s.saved;return s;};
async function setup(n=1){
  const room=await makeRoom(),{x,y}=hill();
  const players=Array.from({length:n},(_,i)=>addPlayer(room,9700+i,{islandId:SLED_ISLAND,x:x+i*10,y}));
  const sled=room.sled=new LiveSledRoom(room);
  return {room,sled,players,done(){sled.dispose();clearInterval(room.timer);}};
}

test('only players walking near the sled hill on the snow island may join',async()=>{
  const {room,sled,players,done}=await setup();
  try{
    assert.ok(sled.admitted(players[0].account));
    players[0].actor.x+=SLED_WATCH_RADIUS+100;
    assert.equal(sled.admitted(players[0].account),null);
    const away=addPlayer(room,9790,{islandId:'home',...hill()});
    assert.equal(sled.admitted(away.account),null);
    assert.equal(sled.admitted('no-such-session'),null);
  }finally{done();}
});

test('a nearby player watches the lobby, joins a seat, readies up and can leave the seat',async()=>{
  const {sled,players,done}=await setup();
  try{
    const socket=peer();
    assert.equal(sled.open(socket,{digest:players[0].account}),true);
    assert.deepEqual(socket.saved,{sled:{digest:players[0].account}});
    assert.equal(socket.notes.find(m=>m.type==='sled-welcome').id,players[0].account);
    assert.equal(sled.lobby.seats.size,0,'watching only');
    sled.message(socket,JSON.stringify({type:'sled-join'}));
    assert.ok(sled.lobby.seats.has(players[0].account));
    sled.message(socket,JSON.stringify({type:'sled-ready'}));
    assert.equal(sled.lobby.seats.get(players[0].account).ready,true);
    assert.ok(socket.notes.some(m=>m.type==='sled-state'&&m.seats[0]?.ready));
    sled.message(socket,JSON.stringify({type:'sled-leave'}));
    assert.equal(sled.lobby.seats.size,0);
    assert.ok(sled.members.has(socket),'still watching');
    sled.close(socket);
    assert.equal(sled.members.size,0);
  }finally{done();}
});

test('a lone ready player races bots, and the result is saved to their sled profile',async()=>{
  const {sled,players,done}=await setup();
  try{
    const socket=peer(),me=players[0].account;
    sled.open(socket,{digest:me});sled.message(socket,JSON.stringify({type:'sled-join'}));sled.message(socket,JSON.stringify({type:'sled-ready'}));
    const t0=Date.now()/1000;sled.lobby.tick(t0);sled.lobby.tick(t0+SLED.waitSeconds);
    assert.equal(sled.lobby.phase,'countdown');
    sled.lobby.tick(t0+SLED.waitSeconds+SLED.botCountdown);
    assert.equal(sled.lobby.phase,'racing');
    assert.equal(sled.lobby.input(me,{steer:1}),true);
    let t=t0+SLED.waitSeconds+SLED.botCountdown,finished=null;
    while(!finished&&t<t0+400){t+=.5;finished=sled.lobby.tick(t).finished;}
    assert.ok(finished);
    sled.finish(finished);
    const profile=sled.profile(me);
    assert.equal(profile.races,1);
    assert.ok(socket.notes.some(m=>m.type==='sled-medals'));
  }finally{done();}
});

test('a sled socket comes back after the room hibernates',async()=>{
  const room=await makeRoom(),{x,y}=hill(),p=addPlayer(room,9750,{islandId:SLED_ISLAND,x,y});
  const sock=peer();sock.saved={sled:{digest:p.account}};
  // the player's own island socket carries its connection, as the main room saves it
  const info=room.connections.get(p.socket);p.socket.deserializeAttachment=()=>JSON.parse(JSON.stringify(info));
  const restored=new IslandRoom({...room.ctx,getWebSockets:()=>[p.socket,sock]});
  try{
    assert.ok(restored.sled?.members.has(sock));
    assert.notEqual(sock.readyState,3);
  }finally{restored.sled?.dispose();room.sled?.dispose();clearInterval(restored.timer);clearInterval(room.timer);}
});

test('the sled route forwards signed-in players to the island room',async()=>{
  assert.ok(JSON.parse(readFileSync('public/_routes.json')).include.includes('/sled-room'));
  let forwarded=null;
  const env={ISLAND:{idFromName:()=>'id',get:()=>({fetch:async r=>{forwarded=r;return new Response(null,{status:200});}})}};
  const request=(headers={})=>new Request('https://ducky.example/sled-room',{headers:{Upgrade:'websocket',Origin:'https://ducky.example',Cookie:'__Host-ducky_session='+'a'.repeat(43),...headers}});
  assert.equal((await connectSled({request:request({Origin:'https://evil.example'}),env})).status,403);
  assert.equal((await connectSled({request:new Request('https://ducky.example/sled-room',{headers:{Upgrade:'websocket',Origin:'https://ducky.example'}}),env})).status,401);
  await connectSled({request:request(),env});
  assert.equal(new URL(forwarded.url).pathname,'/sled-room');
  assert.ok(forwarded.headers.get('X-Session-Digest'));
});

test('after a race every racer comes back on the plaza below the finish line',async()=>{
  const {room,sled,players,done}=await setup(2);
  try{
    for(const p of players)p.actor.sledding=true;
    sled.land([{id:players[0].account,name:'a',bot:false,place:1,dnf:false},{id:players[1].account,name:'b',bot:false,place:2,dnf:false}]);
    players.forEach((p,i)=>{
      const spot=landingSpot(i);
      assert.deepEqual([p.actor.x,p.actor.y,p.actor.sledding],[spot.x,spot.y,false]);
      assert.ok(room.navFor(SLED_ISLAND).walkable(p.actor.x,p.actor.y),'on walkable snow');
    });
  }finally{done();}
});
test('anyone in front of the podium can jump up onto a free block; up there walking only turns them; a jump brings them down',async()=>{
  const {room,players,done}=await setup(2);
  try{
    const [a,b]=players,front=podiumFront(1);
    for(const p of players)Object.assign(p.actor,{x:front.x+(p===a?0:20),y:front.y});
    room.webSocketMessage(a.socket,JSON.stringify({type:'jump',seq:1}));
    assert.equal(a.actor.podium,1);assert.deepEqual([a.actor.x,a.actor.y],[podiumTop(1).x,podiumTop(1).y]);
    room.webSocketMessage(b.socket,JSON.stringify({type:'jump',seq:1}));
    assert.ok(b.actor.podium&&b.actor.podium!==1,'the next duck takes a free block');
    a.actor.jumpLeft=0;
    room.webSocketMessage(a.socket,JSON.stringify({type:'input',seq:2,x:1,y:0}));
    assert.deepEqual([a.actor.x,a.actor.y,a.actor.podium],[podiumTop(1).x,podiumTop(1).y,1],'walking only turns');
    assert.equal(a.actor.turn,Math.atan2(1,0));
    room.webSocketMessage(a.socket,JSON.stringify({type:'jump',seq:3}));
    assert.equal(a.actor.podium,null);assert.deepEqual([a.actor.x,a.actor.y],[front.x,front.y]);
    assert.ok(room.navFor(SLED_ISLAND).walkable(a.actor.x,a.actor.y),'back on the snow');
  }finally{done();}
});
