import assert from 'node:assert/strict';
import test from 'node:test';
import {BOAT_GAP, canSail, harborOf} from '../src/gameplay/islands.js';
import {SeaSimulation} from '../worker/simulation.js';
import {addPlayer, makeRoom} from './room-harness.mjs';

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
  const {x, y} = harborOf('home').water;
  const target = {x, y: y + BOAT_GAP + 400};
  assert.ok(canSail(target.x, target.y, 'home'));
  const {socket, actor} = addPlayer(room, 1, {islandId: 'home', x, y, mode: 'sailing'});
  actor.boatId = 'home-0~telemetry';
  room.boats = [{id: actor.boatId, islandId: 'home', x, y, occupant: actor.id, turn: 0}];

  room.timer = 'manual';
  room.webSocketMessage(socket, JSON.stringify({type: 'destination', seq: 1, ...target}));
  assert.ok(actor.sailTarget);
  room.boats.push({id: 'home-0~obstruction', islandId: 'home', x, y: y + BOAT_GAP + 1, turn: 0});
  room.checkpointAt = 0;

  room.step();
  room.broadcast(socket);

  const reportStartedAt = room.reportStartedAt;
  const info = t.mock.method(console, 'info', () => {});
  room.reportHealth(reportStartedAt + 59_999);
  assert.equal(info.mock.callCount(), 0);
  room.reportHealth(reportStartedAt + 60_000);
  assert.equal(info.mock.callCount(), 1);
  const [message, report] = info.mock.calls[0].arguments;
  assert.equal(message, 'Room operation timings');
  assert.equal(report.island, 'sea');
  assert.equal(report.window_ms, 60_000);
  assert.equal(report.route_plans, 1);
  assert.equal(report.route_reroutes, 1);
  assert.equal(report.movement_steps, 1);
  assert.equal(report.snapshot_broadcasts, 1);
  assert.equal(report.checkpoint_attempts, 1);
  assert.equal(report.checkpoint_writes, 1);
  assert.equal(report.route_queue_depth, 0);
  assert.equal(report.route_queue_wait_ms, 0);
  assert.ok(report.snapshot_bytes > 0);

  for (const name of ['route_plan', 'route_reroute', 'movement', 'snapshot', 'checkpoint']) {
    const span = spans.find((entry) => entry.name === 'room.' + name);
    assert.equal(span?.attributes['room.owner'], 'sea', name);
  }
  assert.equal(spans[0].attributes['room.route.reason'], 'destination');
  assert.equal(spans[0].attributes['room.route.found'], true);
  room.reportHealth(reportStartedAt + 120_000);
  assert.equal(info.mock.calls[1].arguments[1].route_plans, 0);
  assert.equal(info.mock.calls[1].arguments[1].route_reroutes, 0);
});
