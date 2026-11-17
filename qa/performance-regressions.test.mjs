import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRoom, addPlayer, fakeSocket} from './room-harness.mjs';
import {RoomClient} from '../src/multiplayer/room-client.js';
import {IslandRoom} from '../worker/index.js';
import {mapOf} from '../src/world/island-maps.js';

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
  legacy[0].x -= 123;
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

test('globe subscriptions follow the view across welcomes and reconnects', t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const originalSocket = globalThis.WebSocket, originalLocation = globalThis.location;
  const sockets = [];
  globalThis.location = {href: 'http://localhost/'};
  globalThis.WebSocket = class {
    static OPEN = 1;
    readyState = 1;
    sent = [];
    constructor(url) {this.url = url; sockets.push(this);}
    send(text) {this.sent.push(JSON.parse(text));}
    receive(packet) {this.onmessage({data:JSON.stringify(packet)});}
    close() {this.readyState = 3; this.onclose?.({code:1006});}
  };
  const client = new RoomClient(() => {});
  t.after(() => {client.dispose(); globalThis.WebSocket = originalSocket; globalThis.location = originalLocation;});
  const pins = [{id:'friend', islandId:'sunset', x:20, y:40, mode:'walking'}];
  const feed = subscriptionId => ({type:'globe-players', subscriptionId, players:pins});
  const snapshot = {type:'snapshot', epoch:'room', tick:1, players:[], boats:[], self:null};
  const subscriptions = socket => socket.sent.filter(message => message.type === 'globe-subscription');

  client.connect(false);
  const first = sockets[0];
  assert.equal(first.url.searchParams.get('globeFeed'), '1');
  client.setGlobeOpen(true);
  assert.deepEqual(first.sent, []);
  first.receive({type:'welcome', id:null, globeFeed:true});
  assert.deepEqual(subscriptions(first), [{type:'globe-subscription', open:true, subscriptionId:1}]);
  first.receive(feed(1));
  first.receive(snapshot);
  assert.deepEqual(client.globePlayers, pins);
  assert.equal(client.tick, 1);

  client.setGlobeOpen(false);
  client.setGlobeOpen(true);
  assert.deepEqual(subscriptions(first).slice(1).map(({open,subscriptionId}) => [open,subscriptionId]), [[false,2],[true,3]]);
  first.receive(feed(1));
  assert.deepEqual(client.globePlayers, []);
  first.receive(feed(3));
  assert.deepEqual(client.globePlayers, pins);

  first.close();
  assert.deepEqual(client.globePlayers, []);
  t.mock.timers.tick(350);
  const second = sockets[1];
  second.receive({type:'welcome', id:null, globeFeed:true});
  assert.equal(subscriptions(second)[0].subscriptionId, 3);
  first.receive(feed(3));
  assert.deepEqual(client.globePlayers, []);
  second.receive(feed(3));
  assert.deepEqual(client.globePlayers, pins);

  client.setGlobeOpen(false);
  second.close();
  t.mock.timers.tick(350);
  const third = sockets[2];
  third.receive({type:'welcome', id:null, globeFeed:true});
  assert.deepEqual(subscriptions(third), []);
  assert.deepEqual(client.globePlayers, []);

  client.connect(false, true);
  const legacy = sockets[3];
  legacy.receive({type:'welcome', id:null});
  legacy.receive({...snapshot, globePlayers:pins});
  assert.deepEqual(client.globePlayers, []);
  client.setGlobeOpen(true);
  assert.deepEqual(client.globePlayers, pins);
  assert.deepEqual(subscriptions(legacy), []);
  legacy.receive({...snapshot, tick:2, globePlayers:[]});
  assert.deepEqual(client.globePlayers, []);
});

test('the globe timer runs once per room and stops after the last subscriber leaves', async t => {
  const room = await makeRoom();
  t.mock.timers.enable({apis: ['setInterval']});
  const viewer = addPlayer(room, 0, {x:2980, y:2005});
  const peer = addPlayer(room, 1, {x:2990, y:2005});
  let saved;
  viewer.socket.serializeAttachment = info => {saved = info;};
  viewer.socket.deserializeAttachment = () => saved;
  for (const player of [viewer, peer]) room.connections.get(player.socket).globeFeed = true;
  const subscribe = (player, open, subscriptionId) => room.webSocketMessage(player.socket, JSON.stringify({type:'globe-subscription', open, subscriptionId}));
  const feeds = player => player.socket.notes.filter(message => message.type === 'globe-players');
  subscribe(viewer, true, 1);
  assert.equal(feeds(viewer).length, 1);
  const timer = room.globeTimer;
  subscribe(peer, true, 1);
  assert.equal(room.globeTimer, timer);
  t.mock.timers.tick(499);
  assert.equal(feeds(viewer).length, 1);
  t.mock.timers.tick(1);
  assert.equal(feeds(viewer).length, 2);
  assert.equal(feeds(peer).length, 2);
  const attachment = saved;
  room.webSocketClose(peer.socket);
  subscribe(viewer, false, 2);
  assert.equal(room.globeTimer, null);
  t.mock.timers.tick(500);
  assert.equal(feeds(viewer).length, 2);

  saved = attachment;
  room.ctx.getWebSockets = () => [viewer.socket];
  const restored = new IslandRoom(room.ctx);
  assert.ok(restored.globeTimer);
  t.mock.timers.tick(500);
  assert.equal(feeds(viewer).length, 3);
  assert.equal(feeds(viewer).at(-1).subscriptionId, 1);
  restored.webSocketClose(viewer.socket);
  assert.equal(restored.globeTimer, null);
});

test('an idle reconnect burst sends immediate baselines and one shared presence update', async t => {
  const room = await makeRoom();
  t.mock.timers.enable({apis: ['setTimeout']});
  const NativeResponse = globalThis.Response, OriginalPair = globalThis.WebSocketPair;
  let joinedSocket;
  globalThis.WebSocketPair = class {
    constructor() {this[0] = fakeSocket(); this[1] = joinedSocket = fakeSocket();}
  };
  globalThis.Response = class extends NativeResponse {
    constructor(body, options) {
      super(body, options?.status === 101 ? {...options, status:200} : options);
    }
  };
  t.after(() => {globalThis.Response = NativeResponse; globalThis.WebSocketPair = OriginalPair;});

  const spawn = mapOf('home').spawn;
  const viewer = addPlayer(room, 0, spawn);
  const players = Array.from({length:20}, (_, index) => addPlayer(room, index+1, spawn));
  room.connections.get(viewer.socket).deltas = true;
  const gameplay = [];
  viewer.socket.send = text => {
    const message = JSON.parse(text);
    if (message.type === 'snapshot' || message.type === 'delta') gameplay.push(message);
  };
  room.broadcast();
  const baseline = gameplay[0];
  assert.equal(baseline.online, 21);

  for (const player of players) room.webSocketClose(player.socket);
  const deadline = room.presenceTimer;
  t.mock.timers.tick(50);
  const join = account => {
    const url = 'https://island.example/room?globeFeed=1&play='+(account ? '1' : '0');
    const headers = {Upgrade:'websocket', ...(account ? {'X-Session-Digest':account} : {})};
    room.join(new Request(url, {headers}), Date.now());
    return joinedSocket;
  };
  for (const player of players.slice(0,18)) {
    const socket = join(player.account);
    const initial = JSON.parse(socket.last);
    const pose = initial.players.find(pose => pose.id === player.actor.id);
    assert.equal(pose.x, player.actor.x);
    assert.equal(pose.y, player.actor.y);
    room.webSocketMessage(socket, JSON.stringify({type:'updates'}));
    const deltaBase = JSON.parse(socket.last);
    assert.ok(deltaBase.tick > initial.tick);
    room.webSocketMessage(socket, JSON.stringify({type:'updates'}));
    assert.equal(JSON.parse(socket.last).tick, deltaBase.tick);
  }
  const spectator = join();
  assert.equal(JSON.parse(spectator.last).online, 20);
  room.webSocketMessage(spectator, JSON.stringify({type:'watch', islandId:'sunset'}));
  assert.equal(JSON.parse(spectator.last).islandId, 'sunset');
  assert.equal(room.presenceTimer, deadline);
  t.mock.timers.tick(49);
  assert.equal(gameplay.length, 1);
  t.mock.timers.tick(1);
  assert.equal(gameplay.length, 2);
  const batch = gameplay[1];
  assert.equal(batch.type, 'delta');
  assert.equal(batch.baseTick, baseline.tick);
  assert.equal(batch.online, 20);
  assert.deepEqual(batch.players.removed, players.slice(18).map(player => player.actor.id));
  assert.equal(room.presenceTimer, null);
  t.mock.timers.tick(200);
  assert.equal(gameplay.length, 2);
});

test('the normal movement broadcast absorbs pending presence changes', async t => {
  const room = await makeRoom();
  t.mock.timers.enable({apis: ['setTimeout', 'setInterval']});
  const spawn = mapOf('home').spawn;
  const viewer = addPlayer(room, 0, spawn);
  const peer = addPlayer(room, 1, {x:spawn.x+120, y:spawn.y});
  room.connections.get(viewer.socket).deltas = true;
  room.broadcast();
  const baseline = JSON.parse(viewer.socket.last);
  const deltas = () => viewer.socket.notes.filter(message => message.type === 'delta');

  room.webSocketMessage(viewer.socket, JSON.stringify({type:'input', seq:1, x:1, y:0}));
  t.mock.timers.tick(25);
  room.webSocketClose(peer.socket);
  assert.ok(room.presenceTimer);
  t.mock.timers.tick(25);
  t.mock.timers.tick(50);
  assert.equal(room.presenceTimer, null);
  const [first] = deltas();
  assert.equal(first.baseTick, baseline.tick);
  assert.equal(first.online, 1);
  assert.deepEqual(first.players.removed, [peer.actor.id]);
  assert.notEqual(viewer.actor.x, spawn.x);
  t.mock.timers.tick(25);
  assert.equal(deltas().length, 1);
  t.mock.timers.tick(25);
  t.mock.timers.tick(50);
  assert.equal(deltas().length, 2);
  assert.equal(deltas()[1].baseTick, first.tick);
});
