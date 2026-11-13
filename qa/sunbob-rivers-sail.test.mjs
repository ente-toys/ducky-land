import test from 'node:test';
import assert from 'node:assert/strict';
import {mapFor} from '../src/world/island-maps.js';
import {canSail, harborOf, setSailDestination, sailStep} from '../src/gameplay/islands.js';

const id = 'blossom', map = mapFor('sunflower');
function sail(actor, to, seen) {
  assert.ok(setSailDestination(actor, to[0], to[1]), `a route to ${to}`);
  for (let i = 0; i < 20000 && (actor.sailTarget || actor.sailRoute?.length); i++) {
    sailStep(actor, 1 / 20, {x: 0, y: 0});
    assert.ok(canSail(actor.x, actor.y, id), `the boat stays on water at ${Math.round(actor.x)},${Math.round(actor.y)}`);
    seen.push({x: actor.x, y: actor.y});
  }
  assert.ok(Math.hypot(actor.x - to[0], actor.y - to[1]) < 2, `arrived at ${to} (at ${Math.round(actor.x)},${Math.round(actor.y)})`);
}
const IN_WEST = [[-1400, 1480], [-1050, 1340], [-700, 1280], [-350, 1300], [0, 1500], [300, 1510], [700, 1450], [1090, 1470]];
const RING = [[1220, 1467], [1619, 1301], [2013, 1173], [2452, 1196], [2779, 1047], [3107, 974], [3455, 952], [3804, 869], [4229, 670], [4756, 530],
  [5288, 541], [5649, 655], [6077, 729], [6493, 698], [6972, 517], [7223, 383], [7373, 322], [7534, 345], [7587, 481], [7567, 652], [7491, 947],
  [7351, 1364], [7244, 1849], [7194, 2346], [7106, 2736], [6915, 3071], [6841, 3359], [6796, 3548], [6666, 3725], [6085, 3821], [5669, 3904],
  [5441, 4049], [5166, 4201], [4850, 4307], [4454, 4406], [4053, 4550], [3647, 4641], [3251, 4751], [2779, 4866], [2288, 4806], [1824, 4613],
  [1314, 4386], [904, 4093], [585, 3738], [417, 3352], [406, 2883], [511, 2472], [667, 2081], [895, 1710], [1220, 1467]];
const OUT_NORTH = [[1619, 1301], [2013, 1173], [2452, 1196], [2779, 1047], [3107, 974], [3455, 952], [3804, 869], [4229, 670], [4320, 340], [4250, 100],
  [4200, -160], [4300, -450], [4280, -700], [4160, -1000]];

test('a boat sails from Sunbob\'s harbour in through Willowcup Run, round the whole ring canal, and out through Millseed Brook', () => {
  const harbour = harborOf(id).water, actor = {islandId: id, mode: 'sailing', ...harbour, turn: 0}, seen = [];
  for (const p of [...IN_WEST, ...RING, ...OUT_NORTH]) sail(actor, p, seen);
  assert.ok(seen.some(p => p.x < -1000 && p.y > 1250 && p.y < 1500), 'in through the west mouth');
  assert.ok(seen.some(p => p.y < -750 && p.x > 4100 && p.x < 4400), 'out through the north mouth');
  for (const {a, b} of map.world.arches) {
    const dx = b[0] - a[0], dy = b[1] - a[1], seg = p => {const t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / (dx * dx + dy * dy))); return Math.hypot(p.x - a[0] - t * dx, p.y - a[1] - t * dy);};
    assert.ok(seen.some(p => seg(p) < 40), `under the bridge ${a} - ${b}`);
  }
  assert.deepEqual(RING[0], RING.at(-1));
  sail(actor, [harbour.x, harbour.y], seen);
});

test('Sunbob\'s bridges carry walkers and let boats under, its pond stays closed, and no surf runs across a mouth', () => {
  const nav = map.nav();
  assert.equal(map.world.arches.length, 14);
  for (const w of map.world.walkways) assert.ok(w.boatPassUnder, 'a boat passes under every deck');
  for (const {a, b} of map.world.arches) {
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    assert.ok(nav.walkable(...m), `the deck at ${m} is walkable`);
    assert.ok([0, 15, -15, 30, -30].some(dx => [0, 15, -15, 30, -30].some(dy => canSail(m[0] + dx, m[1] + dy, id))), `a boat fits under the deck at ${m}`);
    assert.deepEqual(nav.route(map.spawn.x, map.spawn.y, ...m).at(-1), m, `the deck at ${m} is reachable on foot`);
  }
  const pond = map.world.water[0];
  assert.equal(canSail(pond.x, pond.y, id), false, 'the centre pond never reaches the sea');
  for (const [x, y] of [[4300, -450], [0, 1500], [700, 1450], [3455, 952]]) assert.equal(nav.walkable(x, y), false, `${x},${y} is water`);
  assert.equal(map.world.riverMouths.length, 2);
});
