import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRoom,addPlayer} from './room-harness.mjs';
import {boatSpots,boardingPoint,navOf} from '../src/gameplay/islands.js';
import {RoomClient} from '../src/multiplayer/room-client.js';

// Any free boat can be taken by anyone, including one another player built.
test('a player can board a free boat that someone else built',async t=>{
  const room=await makeRoom();t.after(()=>clearInterval(room.timer));
  const spot=boatSpots('home')[0];
  const boat={id:'built-by-other',islandId:'home',...spot,occupant:null,owner:'someone-else',ownershipVersion:1};
  room.boats.push(boat);
  const deck=boardingPoint(boat,navOf('home'));
  const {actor,socket}=addPlayer(room,4242,{islandId:'home',x:deck.x,y:deck.y});
  room.webSocketMessage(socket,JSON.stringify({type:'board',seq:1,boatId:boat.id}));
  for(let i=0;i<40&&actor.mode!=='sailing';i++)room.step();
  assert.ok(!socket.notes.some(n=>n.type==='travel-notice'),JSON.stringify(socket.notes.filter(n=>n.type==='travel-notice')));
  assert.equal(actor.mode,'sailing');
  assert.equal(boat.occupant,actor.id);
});

test('the Take boat list includes free boats other players built',()=>{
  const room=new RoomClient(()=>{},()=>{},()=>{},()=>{},()=>{});
  try{
    room.ownBoats=new Set();
    const boats=[{id:'theirs',built:true,occupant:null},{id:'public',occupant:null},{id:'busy',occupant:'rider'}];
    assert.deepEqual(room.usableBoats(boats).map(b=>b.id),['theirs','public']);
  }finally{room.dispose();}
});
