import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRoom,addPlayer} from './room-harness.mjs';
import {boatSpots, canSail, sailStep} from '../src/pixi/islands.js';
import {IslandRoom} from '../worker/index.js';

test('holding WASD into shore stays aboard until Dock is explicitly requested',async()=>{
  const room=await makeRoom();
  const {x,y}=boatSpots()[0];
  const {actor,socket}=addPlayer(room,9876,{x,y,mode:'sailing'});
  const boat=room.boats.find(b=>b.id==='home-5');
  Object.assign(boat,{x:actor.x,y:actor.y,occupant:actor.id});actor.boatId=boat.id;
  try {
    room.webSocketMessage(socket,JSON.stringify({type:'input',seq:1,x:1,y:0}));
    room.step();
    assert.ok(actor.travel>0,'starts in water and sails toward the shore');
    for(let i=0;i<50;i++)room.step();
    assert.equal(actor.travel,0,'boat reaches shore and stops');
    assert.equal(actor.mode,'sailing','continued shoreward input does not auto-dock');
    assert.equal(boat.occupant,actor.id);
    room.webSocketMessage(socket,JSON.stringify({type:'disembark',seq:2}));
    for(let i=0;i<50 && actor.mode==='sailing';i++)room.step();
    assert.equal(actor.mode,'walking');assert.equal(boat.occupant,null);assert.equal(boat.parked,true);
    assert.ok(room.boats.includes(boat),'explicit landing still preserves the arrival boat');
  } finally {clearInterval(room.timer);}
});

test('restoring the room frees a stranded sailor and removes blocked parked boats', async t => {
  const room = await makeRoom();
  // Positions observed in saved Home boats in production.
  const stranded = {x:4052.81, y:6034.56};
  const blockedParking = {x:3044.54, y:4215.79};
  assert.ok(!canSail(stranded.x, stranded.y));
  assert.ok(!canSail(blockedParking.x, blockedParking.y));
  const {actor, socket} = addPlayer(room, 9877, {...stranded, mode:'sailing'});
  const boat = room.boats.find(boat => boat.id === 'home-8');
  Object.assign(boat, {...stranded, occupant:actor.id});
  actor.boatId = boat.id;
  const parked = {...boat, ...blockedParking, id:'home-4~blocked', occupant:null, parked:true};
  room.boats.push(parked);
  room.saveBoats();
  socket.deserializeAttachment = () => room.connections.get(socket);

  const restored = new IslandRoom({...room.ctx, getWebSockets:() => [socket]});
  t.after(() => clearInterval(restored.timer));
  const sailor = restored.connections.get(socket).actor;
  const recovered = restored.boats.find(boat => boat.id === sailor.boatId);
  assert.equal(sailor.mode, 'sailing');
  assert.equal(recovered.occupant, sailor.id);
  assert.deepEqual([recovered.x, recovered.y], [sailor.x, sailor.y]);
  assert.ok(canSail(recovered.x, recovered.y));
  assert.ok(!restored.boats.some(boat => boat.id === parked.id));
  assert.equal(restored.sql.exec('SELECT id FROM boat_states WHERE id=?', parked.id).toArray().length, 0);
  for (const spot of boatSpots()) {
    assert.ok(restored.boats.some(boat => !boat.occupant && boat.islandId === 'home' &&
      boat.x === spot.x && boat.y === spot.y), 'the berth stays filled');
  }

  const direction = [{x:1,y:0}, {x:-1,y:0}, {x:0,y:1}, {x:0,y:-1}]
    .find(input => sailStep({...sailor}, .05, input));
  assert.ok(direction);
  restored.webSocketMessage(socket, JSON.stringify({type:'input', seq:1, ...direction}));
  restored.step();
  assert.ok(sailor.travel > 0, 'steering moves the recovered boat');
  assert.deepEqual([recovered.x, recovered.y], [sailor.x, sailor.y]);
});
