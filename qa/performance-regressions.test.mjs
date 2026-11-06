import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRoom, addPlayer} from './room-harness.mjs';
import {RoomClient} from '../src/pixi/room-client.js';
import {IslandRoom} from '../worker/index.js';

test('delta updates preserve poses, remove departed players and reset after island and privacy changes', async () => {
  const room = await makeRoom();
  const viewer = addPlayer(room, 0, {x: 2980, y: 2005});
  const peer = addPlayer(room, 1, {x: 3000, y: 2005});
  const info = room.connections.get(viewer.socket);
  info.deltas = true;
  const messages = [];
  viewer.socket.send = text => messages.push(JSON.parse(text));
  room.broadcast();
  const full = messages.at(-1);
  assert.equal(full.type, 'snapshot');
  const client = new RoomClient(() => {});
  client.id = viewer.actor.id;
  client.snapshot(full);
  peer.actor.x += 5;
  room.broadcast();
  const delta = messages.at(-1);
  assert.equal(delta.type, 'delta');
  assert.equal(delta.baseTick, full.tick);
  assert.deepEqual(delta.players.changed, [{id: peer.actor.id, x: peer.actor.x}]);
  assert.deepEqual(delta.boats.changed, []);
  assert.ok(JSON.stringify(delta).length < JSON.stringify(full).length);
  room.connections.delete(peer.socket);
  room.broadcast();
  assert.deepEqual(messages.at(-1).players.removed, [peer.actor.id]);
  info.expires = 0;
  room.broadcast();
  assert.equal(messages.at(-1).type, 'snapshot');
  assert.ok(messages.at(-1).players.every(player => !('login' in player)));
  info.islandId = 'blossom'; info.actor = null;
  room.broadcast();
  assert.equal(messages.at(-1).type, 'snapshot');
  assert.equal(messages.at(-1).islandId, 'blossom');
  client.dispose();
});

test('boat persistence migrates the legacy fleet, writes only changed boats, and restores deletions', async () => {
  const room = await makeRoom();
  const legacy = structuredClone(room.boats);
  legacy[0].x += 123;
  legacy[0].parked = true;
  room.sql.exec('DELETE FROM boat_states');
  room.sql.exec('INSERT OR REPLACE INTO boats VALUES(1,?)', JSON.stringify(legacy));
  const migrated = new IslandRoom(room.ctx);
  assert.equal(migrated.boats.find(boat => boat.id === legacy[0].id).x, legacy[0].x);
  assert.equal(room.sql.exec('SELECT state FROM boats WHERE id=1').toArray().length, 0);
  const calls = [];
  const original = migrated.sql.exec;
  migrated.sql = {exec(query, ...args) {calls.push(query); return original(query, ...args);}};
  migrated.boats.find(boat => boat.id === legacy[0].id).x += 10;
  migrated.saveBoats();
  assert.equal(calls.filter(query => query.startsWith('INSERT OR REPLACE INTO boat_states')).length, 1);
  const restored = new IslandRoom(room.ctx);
  assert.equal(restored.boats.find(boat => boat.id === legacy[0].id).x, legacy[0].x + 10);
  migrated.boats.push({...migrated.boats[0], id: 'test-extra', occupant: null});
  migrated.saveBoats();
  migrated.boats.pop(); migrated.saveBoats();
  assert.equal(room.sql.exec('SELECT id FROM boat_states WHERE id=?', 'test-extra').toArray().length, 0);
});


test('the client merges partial movement and departures, then reconnects on a missing baseline', t => {
  const originalSocket = globalThis.WebSocket, originalLocation = globalThis.location;
  const sockets = [];
  globalThis.location = {href: 'http://localhost/'};
  globalThis.WebSocket = class {
    static OPEN = 1;
    constructor() {this.readyState = 1; sockets.push(this);}
    send() {}
    close() {}
  };
  const client = new RoomClient(() => {});
  t.after(() => {client.dispose(); globalThis.WebSocket = originalSocket; globalThis.location = originalLocation;});
  client.connect(false);
  const receive = packet => sockets[0].onmessage({data: JSON.stringify(packet)});
  const pose = {id: 'peer', islandId: 'home', mode: 'walking', x: 2980, y: 2005, turn: 0, action: 0, emoteVersion: 0, outfit: {cap: 1}};
  receive({type: 'snapshot', epoch: 'epoch', tick: 1, islandId: 'home', players: [pose], boats: [], self: null});
  const delta = {type: 'delta', epoch: 'epoch', tick: 2, baseTick: 1, islandId: 'home', players: {changed: [{id: 'peer', x: 2990}], removed: []}, boats: {changed: [], removed: []}, self: null};
  receive(delta);
  assert.equal(client.snapshotPlayers.get('peer').x, 2990);
  assert.deepEqual(client.snapshotPlayers.get('peer').outfit, {cap: 1});
  receive({...delta, tick: 3, baseTick: 2, players: {changed: [], removed: ['peer']}});
  assert.equal(client.tracks.size, 0);
  receive({...delta, tick: 4, baseTick: 1});
  assert.equal(sockets.length, 2);
});
