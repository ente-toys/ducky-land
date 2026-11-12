import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeRoom,addPlayer} from './room-harness.mjs';
import {mapOf} from '../src/world/island-maps.js';
import {WORLD_ISLANDS,WORLD_GEO} from '../src/world/world-map.js';
import {BOAT_CHANNEL,coastGaps} from '../src/world/sphere-shores.js';
import {canSail,boardingPoint,destinationsFor,landingSpot,canDock} from '../src/gameplay/islands.js';
import {RoomClient} from '../src/multiplayer/room-client.js';
import {getPlayerKarma} from '../src/features/bog-combat/karma.js';
import {BOG_ISLAND,KARMA_REQUIRED,bogLandingNotice} from '../src/features/bog-combat/entry.js';
import {LiveBogRoom} from '../worker/bog-room.js';
import {connectBog} from '../server/pages-auth.js';

const bog=mapOf(BOG_ISLAND),from='isle-176';
function aboard(room,n,islandId,point){
 const p=addPlayer(room,n,{islandId,...point,mode:'sailing'});
 const boat=room.boats.find(b=>b.islandId===islandId&&!b.occupant);
 Object.assign(boat,{...point,occupant:p.actor.id});p.actor.boatId=boat.id;
 return {...p,boat};
}
function stop(room){clearInterval(room.timer);room.bog?.dispose();}
function balance(room,player,value){
 room.sql.exec('INSERT OR REPLACE INTO karma_balances VALUES(?,?)',player.account,value);
 room.karma.balances.delete(player.account);
}

test('Bog uses its approved map at its saved polar slot, with the same afloat and walkable harbour contract as Pagepond/Bellovo',()=>{
 assert.equal(getPlayerKarma(),0);assert.equal(KARMA_REQUIRED,5);
 assert.equal(bog.id,'bog');assert.equal(bog.width,8400);assert.equal(bog.height,8200);
 assert.equal(WORLD_ISLANDS.find(i=>i.id===BOG_ISLAND).lat,-Math.PI/2);
 for(const id of [BOG_ISLAND,'isle-176','isle-251']){
  const m=mapOf(id),n=m.nav();assert.ok(n.walkable(m.HARBOR.land.x,m.HARBOR.land.y));
  assert.ok(n.route(m.spawn.x,m.spawn.y,m.HARBOR.land.x,m.HARBOR.land.y).length);
  assert.ok(canSail(m.HARBOR.water.x,m.HARBOR.water.y,id));assert.ok(m.boatSpots().length>=3);
  for(const p of m.boatSpots()){
   assert.ok(canSail(p.x,p.y,id),'hull clearance');
   const deck=boardingPoint({...p,islandId:id});assert.ok(n.walkable(deck.x,deck.y));
  }
 }
 for(const {a,b,gap}of coastGaps(WORLD_ISLANDS,WORLD_GEO.Rw))assert.ok(gap>=BOAT_CHANNEL,`${a}/${b}: ${gap}`);
});

for(const karma of [0,4,5,6])test(`normal boat harbour arrival with ${karma} karma ${karma<5?'stays at sea':'lands and can board the arrival boat again'}`,async()=>{
 const room=await makeRoom();
 try{
  const d=destinationsFor(from).find(d=>d.destination===BOG_ISLAND);assert.ok(d);
  const p=aboard(room,7000+karma,from,d.dock);balance(room,p,karma);
  p.actor.karma=karma<5?999:0;
  room.step();
  if(karma<5){
   assert.equal(p.actor.mode,'sailing');assert.equal(p.actor.islandId,from);
   assert.equal(p.boat.occupant,p.actor.id);assert.equal(p.actor.docking,false);
   const notice=p.socket.notes.find(n=>n.type==='travel-notice');
   assert.equal(notice.text,bogLandingNotice(BOG_ISLAND,karma));assert.match(notice.text,new RegExp(`you have ${karma}`));
   room.step();assert.equal(p.socket.notes.filter(n=>n.type==='travel-notice').length,1,'no notice spam');
  }else{
   assert.equal(p.actor.mode,'walking');assert.equal(p.actor.islandId,BOG_ISLAND);
   assert.deepEqual([p.actor.x,p.actor.y],[bog.HARBOR.land.x,bog.HARBOR.land.y]);assert.equal(p.boat.occupant,null);
   assert.equal(room.karma.balance(p.account),karma-5);assert.equal(p.actor.karma,karma-5);
   room.step();assert.equal(room.karma.balance(p.account),karma-5,'one charge per landing');
   room.webSocketMessage(p.socket,JSON.stringify({type:'board',seq:1,islandId:BOG_ISLAND,boatId:p.boat.id}));room.step();
   assert.equal(p.actor.mode,'sailing');assert.equal(p.actor.boatId,p.boat.id);assert.equal(p.boat.occupant,p.actor.id);
  }
 }finally{stop(room);}
});

test('Dock, forged karma packets and pending beach landings cannot bypass the gate; unrelated islands remain open',async()=>{
 const room=await makeRoom();
 try{
  const p=aboard(room,7100,BOG_ISLAND,bog.HARBOR.water);balance(room,p,4);p.actor.karma=999;
  room.webSocketMessage(p.socket,JSON.stringify({type:'disembark',seq:1,karma:999}));room.step();
  assert.equal(p.actor.mode,'sailing');assert.match(p.socket.notes.find(n=>n.type==='travel-notice').text,/You need 5 karma to land on Booquack Bog/);
  let beach;
  for(let y=700;y<7400&&!beach;y+=80)for(let x=400;x<8000;x+=80){
   const q={islandId:BOG_ISLAND,mode:'sailing',x,y};
   if(canSail(x,y,BOG_ISLAND)&&!canDock(q)){const spot=landingSpot(q);if(spot?.islandId===BOG_ISLAND&&!spot.islet){beach={q,spot};break;}}
  }
  assert.ok(beach);Object.assign(p.actor,beach.q);Object.assign(p.boat,beach.q);
  const info=room.connections.get(p.socket);info.landing={...beach.spot,approach:beach.q};
  room.step();assert.equal(p.actor.mode,'sailing');assert.equal(info.landing,null);
  balance(room,p,5);info.landing={...beach.spot,approach:beach.q};room.step();
  assert.equal(p.actor.mode,'walking');assert.ok(bog.nav().walkable(p.actor.x,p.actor.y));
  balance(room,p,0);
  const home=mapOf('home'),other=aboard(room,7101,'home',home.HARBOR.water);other.actor.docking=true;room.step();
  assert.equal(other.actor.mode,'walking');
 }finally{stop(room);}
});

test('room client remembers the landed vessel and returns through the existing board command',()=>{
 const client=new RoomClient(()=>{});client.id='self';client.mode='sailing';client.player={boatId:'arrived'};
 const p={id:'self',mode:'walking',islandId:BOG_ISLAND,...bog.HARBOR.land};
 client.snapshot({epoch:'new',tick:1,players:[p],self:{ack:0,path:[],emoteLeft:0},islandId:BOG_ISLAND,boats:[{id:'arrived',...bog.HARBOR.water},{id:'other',...bog.HARBOR.water}]});
 let command;client.board=id=>{command=id;return true;};assert.equal(client.returnToBoat(),true);assert.equal(command,'arrived');
 client.boats[0].occupant='other-duck';client.returnToBoat();assert.equal(command,'other');client.dispose();
});

test('production lobby and teams use the landed account, keep saved stats, and reject visitors still at sea',async()=>{
 const room=await makeRoom();
 const p=addPlayer(room,7200,{islandId:BOG_ISLAND,...bog.HARBOR.land}),service=new LiveBogRoom(room);
 balance(room,p,5);
 const peer=()=>({readyState:1,notes:[],send(text){this.notes.push(JSON.parse(text));},serializeAttachment(value){this.saved=value;},close(){this.readyState=3;}});
 try{
  const lobby=peer(),participant=peer();
  assert.equal(service.open(lobby,{digest:p.account}),true);assert.equal(lobby.notes.at(-1).type,'arena-lobby');
  assert.equal(service.open(participant,{digest:p.account,team:'google'}),true);
  const player=[...service.arena.state.players.values()].find(q=>!q.bot);assert.equal(player.profile,p.account);
  assert.equal(lobby.notes.at(-1).counts.google,1);
  service.message(participant,JSON.stringify({type:'arena-input',seq:0,x:1,y:0,run:true,fire:false}));
  for(let i=0;i<10;i++)service.step();assert.ok(player.x>6500);
  player.stats.tags=3;player.medalCase['first-splat']=true;service.close(participant);
  assert.equal(service.profile(p.account).stats.tags,3);assert.equal(service.profile(p.account).medalCase['first-splat'],true);
  const restored=new LiveBogRoom(room);assert.equal(restored.profile(p.account).stats.tags,3);restored.dispose();
  p.actor.mode='sailing';assert.equal(service.open(peer(),{digest:p.account,team:'privacy'}),false);
  p.actor.mode='walking';room.karma.endBogEntry(p.account);balance(room,p,4);p.actor.karma=999;assert.equal(service.open(peer(),{digest:p.account,team:'privacy'}),false);
  assert.equal(service.open(peer(),{digest:'untrusted',team:'privacy'}),false);
 }finally{service.dispose();stop(room);}
});

test('Pages routes the live combat socket through same-origin session auth, ignoring URL profile identity',async()=>{
 assert.ok(JSON.parse(readFileSync('public/_routes.json')).include.includes('/arena-room'));
 let routed;
 const env={ISLAND:{idFromName:name=>name,get:()=>({fetch:async request=>{routed=request;return Response.json({ok:true});}})}};
 const request=(headers={})=>new Request('https://ducky.example/arena-room?team=privacy&profile=forged',{headers:{Upgrade:'websocket',Origin:'https://ducky.example',Cookie:'__Host-ducky_session='+'a'.repeat(43),...headers}});
 assert.equal((await connectBog({request:request(),env})).status,200);
 assert.equal(new URL(routed.url).pathname,'/bog-room');assert.equal(new URL(routed.url).searchParams.get('profile'),null);
 assert.equal(routed.headers.get('X-Session-Digest').length,43);
 assert.equal((await connectBog({request:request({Origin:'https://other.example'}),env})).status,403);
 assert.equal((await connectBog({request:request({Cookie:''}),env})).status,401);
});


test('client reads room karma for the notice while leaving admission to the server',()=>{
 const notes=[],client=new RoomClient(()=>{},undefined,undefined,undefined,undefined,text=>notes.push(text));
 client.islandId=BOG_ISLAND;client.player={islandId:BOG_ISLAND,mode:'sailing',...bog.HARBOR.water,karma:999};
 const sent=[];client.send=command=>{sent.push(command);return true;};
 client.karma=4;assert.equal(getPlayerKarma({room:client}),4);client.disembark();
 assert.equal(notes.at(-1),'You need 5 karma to land on Booquack Bog (you have 4)');
 client.karma=5;client.disembark();assert.equal(notes.length,1);
 assert.deepEqual(sent,[{type:'disembark'},{type:'disembark'}],'no client-supplied balance or local admission');
 assert.equal(getPlayerKarma({karma:5}),5);assert.equal(getPlayerKarma({room:{karma:NaN}}),0);client.dispose();
});

test('hibernation restores karma before reopening a landed Bog socket',async()=>{
 const room=await makeRoom(),p=addPlayer(room,7300,{islandId:BOG_ISLAND,...bog.HARBOR.land});
 balance(room,p,5);room.karma.beginBogEntry(p.account);p.actor.karma=0;
 const info=room.connections.get(p.socket);
 p.socket.deserializeAttachment=()=>info;
 const arena={readyState:1,send(){},serializeAttachment(){},deserializeAttachment:()=>({bog:{digest:p.account,team:null,id:'restored'}}),close(){this.readyState=3;}};
 const {IslandRoom}=await import('../worker/index.js');
 let restored;
 try{
  restored=new IslandRoom({...room.ctx,getWebSockets:()=>[p.socket,arena]});
  assert.equal(restored.bog.members.has(arena),true);
  assert.equal(restored.connections.get(p.socket).actor.karma,0);
 }finally{if(restored)stop(restored);stop(room);}
});
