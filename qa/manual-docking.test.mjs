import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRoom,addPlayer} from './room-harness.mjs';
import {boardingPoint, boatSpots, canDock, canSail, sailStep} from '../src/gameplay/islands.js';
import {isletWalk} from '../src/world/islet-walk.js';
import {IslandRoom} from '../worker/index.js';
import {cameraGame} from './helpers/pixi-engine.mjs';

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

test('tapping a nearby beach docks at the selected spot even within harbor range', async t => {
  const room = await makeRoom();
  t.after(() => clearInterval(room.timer));
  const boat = room.boats.find(boat => boat.id === 'home-0');
  const {actor, socket} = addPlayer(room, 9878, {...boat, mode:'sailing'});
  actor.boatId = boat.id;
  boat.occupant = actor.id;
  assert.ok(canDock(actor));

  const shore = {x:3990, y:5820};
  const game = cameraGame(actor);
  Object.assign(game.camera, shore);
  game.room = {player: actor, disembark: target => {
    assert.deepEqual(target, shore);
    room.webSocketMessage(socket, JSON.stringify({type:'disembark', seq:1, ...target}));
  }};
  game.tap({x:game.width/2, y:game.height/2});
  for (let i=0; i<50 && actor.mode==='sailing'; i++) room.step();
  assert.equal(actor.mode, 'walking');
  assert.deepEqual({x:actor.x,y:actor.y}, shore);
  assert.deepEqual(boardingPoint(boat), shore);
  assert.ok(canSail(boat.x, boat.y, boat.islandId));
  assert.ok(Math.hypot(boat.x-shore.x, boat.y-shore.y)<150);
  assert.ok(boat.parked);

  const restored = new IslandRoom(room.ctx);
  const parked = restored.boats.find(saved => saved.id === boat.id);
  assert.deepEqual(parked, boat);
  room.webSocketMessage(socket, JSON.stringify({type:'board', seq:2, boatId:boat.id}));
  room.step();
  assert.equal(actor.mode, 'sailing');
  assert.equal(boat.occupant, actor.id);
});

test('Dock at the far side of a detached islet leaves the boat by that shore', async t => {
  const room = await makeRoom();
  t.after(() => clearInterval(room.timer));
  const islet = isletWalk('sea-1-1');
  const {actor, socket} = addPlayer(room, 9879, {islandId:islet.id, x:2586, y:13778, mode:'sailing'});
  const boat = room.boats.find(boat => boat.islandId === islet.id);
  Object.assign(boat, {x:actor.x, y:actor.y, occupant:actor.id});
  actor.boatId = boat.id;
  assert.ok(canSail(actor.x, actor.y, actor.islandId));

  room.webSocketMessage(socket, JSON.stringify({type:'disembark', seq:1, x:islet.land.x, y:islet.land.y}));
  room.step();
  assert.equal(actor.mode, 'sailing', 'the distant jetty is out of reach');
  room.webSocketMessage(socket, JSON.stringify({type:'disembark', seq:2}));
  for (let i=0; i<50 && actor.mode==='sailing'; i++) room.step();
  assert.equal(actor.mode, 'walking');
  assert.ok(islet.nav.walkable(actor.x, actor.y));
  assert.ok(Math.hypot(actor.x-islet.land.x, actor.y-islet.land.y)>1000);
  assert.ok(Math.hypot(actor.x-boat.x, actor.y-boat.y)<150);
  assert.deepEqual(boardingPoint(boat), {x:actor.x,y:actor.y});
});

test('restoring the room frees a stranded sailor and removes blocked parked boats', async t => {
  const room = await makeRoom();
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
