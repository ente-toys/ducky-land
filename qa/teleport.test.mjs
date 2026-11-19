import test from 'node:test';
import assert from 'node:assert/strict';
import {addPlayer, makeRoom} from './room-harness.mjs';
import {ISLANDS, boardingPoint, boatSpots} from '../src/gameplay/islands.js';
import {atTeleporter, TELEPORTERS} from '../src/gameplay/teleport.js';
import {mapOf} from '../src/world/island-maps.js';
import {BOG_ISLAND} from '../src/features/bog-combat/entry.js';

function playerAtMachine(room, balance, islandId='home') {
  const player=addPlayer(room,1,{islandId,...TELEPORTERS.get(islandId).arrival});
  room.sql.exec('INSERT INTO karma_balances VALUES(?,?)',player.account,balance);
  return player;
}

function request(room, player, destination, islandId=player.actor.islandId, seq=++player.seq) {
  room.webSocketMessage(player.socket,JSON.stringify({type:'teleport',islandId,destination,seq}));
  assert.equal(JSON.parse(player.socket.last).self.ack,seq);
}

test('every main island has a reachable machine beside its harbor', () => {
  assert.equal(TELEPORTERS.size,ISLANDS.length);
  for (const {id} of ISLANDS) {
    const map=mapOf(id), nav=map.nav(), machine=TELEPORTERS.get(id);
    assert.ok(nav.walkable(machine.x,machine.y),id);
    assert.ok(nav.walkable(machine.arrival.x,machine.arrival.y),id);
    assert.ok(atTeleporter({mode:'walking',islandId:id,...machine.arrival},nav),id);
    assert.ok(nav.route(map.HARBOR.land.x,map.HARBOR.land.y,machine.arrival.x,machine.arrival.y).length,id);
    for (const boat of boatSpots(id)) {
      const deck=boardingPoint({...boat,islandId:id},nav);
      assert.ok(Math.hypot(deck.x-machine.x,deck.y-machine.y)>225,id);
    }
  }
});

test('teleport debits exactly two feathers and persists the arrival', async () => {
  const room=await makeRoom({transactional:true}), p=playerAtMachine(room,2);
  const info=room.connections.get(p.socket);
  Object.assign(info,{boarding:'home-0',input:{x:1,y:0}});
  p.actor.path=[{x:1,y:1}];
  request(room,p,'sunset');
  assert.equal(p.actor.islandId,'sunset');
  assert.equal(p.actor.karma,0);
  assert.deepEqual(p.actor.path,[]);
  assert.deepEqual(info.input,{x:0,y:0});
  assert.equal(info.boarding,null);
  assert.deepEqual(room.savedLocation(p.account),{islandId:'sunset',...TELEPORTERS.get('sunset').arrival,turn:0});
  const restored=new room.constructor(room.ctx);
  assert.equal(restored.karma.balance(p.account),0);
  assert.equal(restored.savedLocation(p.account).islandId,'sunset');
  request(room,p,'sunset','home',p.seq);
  request(room,p,'blossom','home');
  assert.equal(p.actor.islandId,'sunset');
  assert.equal(room.karma.balance(p.account),0);
});

test('teleport rejects invalid trips without changing saved state or balance', async () => {
  const room=await makeRoom({transactional:true}), p=playerAtMachine(room,2);
  request(room,p,BOG_ISLAND);
  assert.match(p.socket.notes.findLast(note => note.type==='travel-notice').text,/7 golden feathers/);
  request(room,p,'unknown');
  request(room,p,'home');
  p.actor.mode='sailing';
  request(room,p,'sunset');
  p.actor.mode='walking';
  p.actor.x+=500;
  request(room,p,'sunset');
  assert.equal(p.actor.islandId,'home');
  assert.equal(room.karma.balance(p.account),2);
  assert.equal(room.savedLocation(p.account),null);
});

test('Bog teleports charge seven on entry and two on exit', async () => {
  const room=await makeRoom({transactional:true}), p=playerAtMachine(room,9);
  request(room,p,BOG_ISLAND);
  assert.equal(p.actor.islandId,BOG_ISLAND);
  assert.equal(p.actor.karma,2);
  assert.equal(room.karma.bogEntry(p.account).lives,5);
  assert.equal(room.chargeBogLanding(p.socket,room.connections.get(p.socket),BOG_ISLAND),true);
  assert.equal(p.actor.karma,2);
  request(room,p,'home','home');
  assert.equal(p.actor.islandId,BOG_ISLAND);
  assert.equal(room.karma.balance(p.account),2);
  request(room,p,'home');
  assert.equal(p.actor.islandId,'home');
  assert.equal(p.actor.karma,0);
  assert.equal(room.karma.bogEntry(p.account),null);
});

test('a failed arrival write rolls back the feather debit', async () => {
  const room=await makeRoom({transactional:true}), p=playerAtMachine(room,7);
  room.saveLocation=() => {throw Error('fixture write failure');};
  assert.throws(() => room.karma.payTeleport(p.account,'home',{
    islandId:BOG_ISLAND,...TELEPORTERS.get(BOG_ISLAND).arrival,turn:0,mode:'walking',
  }),/fixture write failure/);
  const restored=new room.constructor(room.ctx);
  assert.equal(restored.karma.balance(p.account),7);
  assert.equal(restored.karma.bogEntry(p.account),null);
  assert.equal(restored.savedLocation(p.account),null);
});
