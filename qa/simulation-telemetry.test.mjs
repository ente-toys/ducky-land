import assert from 'node:assert/strict';
import test from 'node:test';
import {BOAT_GAP, canSail, harborOf} from '../src/gameplay/islands.js';
import {SAIL_ROUTE_WORK_PER_TICK, SailRouteQueue} from '../worker/sail-route-queue.js';
import {IslandSimulation, SeaSimulation} from '../worker/simulation.js';
import {addPlayer, makeRoom} from './room-harness.mjs';

test('snapshot deltas survive cell changes and backpressure while identity changes send a full snapshot', async () => {
  const {ctx} = await makeRoom();
  ctx.storage.kv = new Map([['simulation-key', JSON.stringify(['delta-test', 'home'])]]);
  const namespace = {idFromName: name=>name,get:()=>({fetch:async()=>new Response(null,{status:204})})};
  const {room} = new IslandSimulation(ctx, {ISLAND:namespace,WORLD_PRESENCE:namespace});
  const viewer = addPlayer(room, 0, {x:1000,y:1000});
  const peer = addPlayer(room, 1, {x:2200,y:1000});
  for (let n=2;n<40;n++) addPlayer(room,n,{x:2500,y:1000});
  const info=room.connections.get(viewer.socket);
  info.deltas=true;
  const sendAck = tick => room.webSocketMessage(viewer.socket, JSON.stringify({type:'snapshot-ack',epoch:room.epoch,tick}));
  const lastDelta = () => viewer.socket.notes.findLast(message=>message.type==='delta');

  room.broadcast(viewer.socket);
  const initial=JSON.parse(viewer.socket.last);
  assert.equal(initial.players.find(p=>p.id===peer.actor.id).positionSampleMs,1000);
  viewer.actor.x=1030;
  room.broadcast(viewer.socket);
  assert.equal(lastDelta().baseTick,initial.tick);
  assert.deepEqual(lastDelta().players.changed.find(p=>p.id===peer.actor.id),{id:peer.actor.id,positionSampleMs:0});

  room.broadcast(viewer.socket);
  const outstanding=lastDelta().tick;
  room.broadcast(viewer.socket);
  assert.equal(lastDelta().tick,outstanding);
  assert.equal(info.snapshotMissed,true);
  room.timer='manual';
  sendAck(outstanding);
  room.broadcast(viewer.socket);
  assert.equal(lastDelta().baseTick,outstanding);
  assert.equal(info.snapshotMissed,false);
  room.timer=null;

  info.digest=null;
  room.broadcast(viewer.socket);
  const guest=JSON.parse(viewer.socket.last);
  assert.ok(guest.tick>initial.tick);
  assert.ok(guest.players.every(p=>!('login' in p) && !('accountId' in p)));
});

test('the sea reports sailing work and labels each measured phase', async (t) => {
  const {ctx} = await makeRoom();
  ctx.storage.kv = new Map([['simulation-key', JSON.stringify(['telemetry-test', 'sea'])]]);
  const namespace = {
    idFromName: (name) => name,
    get: () => ({fetch: async () => new Response(null, {status: 204})}),
  };
  const spans = [];
  const tracing = {
    enterSpan(name, run) {
      const attributes = {};
      spans.push({name, attributes});
      return run({
        setAttribute(key, value) {
          attributes[key] = value;
        },
        setAttributes(values) {
          Object.assign(attributes, values);
        },
      });
    },
  };
  const {room} = new SeaSimulation(ctx, {ISLAND: namespace, WORLD_PRESENCE: namespace}, tracing);
  const target = harborOf('home').water;
  const {x, y} = {x: target.x, y: target.y + BOAT_GAP + 100};
  assert.ok(canSail(x, y, 'home'));
  const {socket, actor} = addPlayer(room, 1, {islandId: 'home', x, y, mode: 'sailing'});
  actor.boatId = 'home-0~telemetry';
  room.boats = [{id: actor.boatId, islandId: 'home', x, y, occupant: actor.id, turn: 0}];

  room.timer = 'manual';
  const send = (type, seq, fields) => room.webSocketMessage(socket, JSON.stringify({type, seq, ...fields}));
  send('destination', 1, {x, y: y + 100});
  assert.equal(room.sailRoutes.size, 0, 'a water click does not queue a route');
  send('disembark', 2, {});
  assert.equal(room.sailRoutes.size, 1);
  assert.ok(!actor.sailTarget, 'the WebSocket handler queues the docking search');
  send('input', 3, {x: 1, y: 0});
  assert.equal(room.sailRoutes.size, 0, 'manual steering cancels queued work');

  send('disembark', 4, {});
  const start = Date.now();
  for (let sample = 0; room.sailRoutes.size && sample < 1500; sample++) {
    const units = room.health.routeWorkUnits;
    room.stepMovement(start + sample * 50);
    assert.ok(room.health.routeWorkUnits - units <= SAIL_ROUTE_WORK_PER_TICK);
  }
  assert.deepEqual(actor.sailTarget, target);
  room.boats.push({id: 'home-0~obstruction', islandId: 'home', x, y: actor.y - BOAT_GAP - 1, turn: 0});
  room.checkpointAt = 0;
  room.step();
  assert.ok(!actor.sailTarget, 'a blocked boat waits for its replacement route');
  assert.equal(room.sailRoutes.size, 1);
  const rerouteStart = start + 75_000;
  for (let sample = 0; room.sailRoutes.size && sample < 1500; sample++) {
    const units = room.health.routeWorkUnits;
    room.stepMovement(rerouteStart + sample * 50);
    assert.ok(room.health.routeWorkUnits - units <= SAIL_ROUTE_WORK_PER_TICK);
  }
  assert.equal(room.sailRoutes.size, 0);
  room.broadcast(socket);

  const reportStartedAt = room.reportStartedAt;
  const log = t.mock.method(console, 'info', () => {});
  room.reportHealth(reportStartedAt + 59_999);
  assert.equal(log.mock.callCount(), 0);
  room.reportHealth(reportStartedAt + 60_000);
  assert.equal(log.mock.callCount(), 1);
  const [message, report] = log.mock.calls[0].arguments;
  assert.equal(message, 'Room operation timings');
  assert.equal(report.island, 'sea');
  assert.equal(report.window_ms, 60_000);
  assert.equal(report.route_plans, 1);
  assert.equal(report.route_reroutes, 1);
  assert.ok(report.movement_steps >= 2);
  assert.ok(report.snapshot_broadcasts >= 1);
  assert.equal(report.checkpoint_attempts, 1);
  assert.equal(report.checkpoint_writes, 1);
  assert.equal(report.route_queue_depth, 0);
  assert.equal(report.route_queue_peak, 1);
  assert.ok(report.route_queue_wait_ms >= 0);
  assert.ok(report.route_latency_ms > 0);
  assert.ok(report.route_work_units > 0);
  assert.ok(report.snapshot_bytes > 0);

  for (const name of ['route_work', 'movement', 'snapshot', 'checkpoint']) {
    const span = spans.find((entry) => entry.name === 'room.' + name);
    assert.equal(span?.attributes['room.owner'], 'sea', name);
  }
  assert.ok(spans.find((entry) => entry.name === 'room.route_work').attributes['room.route.work_units'] > 0);
  room.reportHealth(reportStartedAt + 120_000);
  assert.equal(log.mock.calls[1].arguments[1].route_plans, 0);
  assert.equal(log.mock.calls[1].arguments[1].route_reroutes, 0);
});


test('a sliced route is discarded when its connection ownership changes', () => {
  const queue = new SailRouteQueue();
  const point = harborOf('home').water;
  const actor = {boatId: 'home-0~handoff', mode: 'sailing', islandId: 'home', ...point};
  const socket = {};
  const info = {actor};
  const room = {connections: new Map([[socket, info]]), boats: []};
  const health = {work: {route_plan: 0}, routeQueueWait: 0, routeWorkUnits: 0};
  const now = Date.now();
  queue.request(socket, info, point.x, point.y + 800, 'dock', now);
  queue.step(room, now + 50, health, 8);
  assert.equal(queue.size, 1, 'the route started but needs more work');
  const replacement = {...actor};
  room.connections.set(socket, {actor: replacement});
  queue.step(room, now + 100, health);
  assert.equal(queue.size, 0);
  assert.equal(actor.sailTarget, undefined);
  assert.equal(replacement.sailTarget, undefined);
});
