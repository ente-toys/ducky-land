import test from 'node:test';
import assert from 'node:assert/strict';
import {ISLETS} from '../src/world/islets.js';
import {isletWalk} from '../src/world/islet-walk.js';
import {MATERIALS, buildSpot, scatterMaterials, strandedIslet} from '../src/gameplay/boat-build.js';
import {canSail} from '../src/gameplay/islands.js';
import {inPoly} from '../assets/world/island-geometry.mjs';
import {makeRoom, addPlayer} from './room-harness.mjs';

// a walkable point on the islet's shore where a boat can be built
function shoreOf(walk) {
  for (const [x, y] of walk.world.coast) {
    const p = walk.nav.nearest(x, y, 300);
    if (p && buildSpot(walk.id, {x: p[0], y: p[1]})) return {x: p[0], y: p[1]};
  }
  return null;
}
// the walkable point farthest from the islet's coast
function inlandOf(walk) {
  const coast = walk.world.coast, {x0, y0, x1, y1} = walk.box;
  const toCoast = (x, y) => Math.min(...coast.map((a, k) => {
    const b = coast[(k + 1) % coast.length], dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t);
  }));
  let best = null, far = -1;
  for (let y = y0; y <= y1; y += 16) for (let x = x0; x <= x1; x += 16) {
    if (!walk.nav.walkable(x, y) || !inPoly(x, y, coast)) continue;
    const d = toCoast(x, y);
    if (d > far) {far = d; best = {x, y};}
  }
  return best;
}
const clearAround = (room, walk) => {
  const pad = 900, {x0, y0, x1, y1} = walk.box;
  room.boats = room.boats.filter(b => b.islandId !== walk.id || b.x < x0 - pad || b.x > x1 + pad || b.y < y0 - pad || b.y > y1 + pad);
};

test('every islet scatters one of each material on its land and has a buildable shore', () => {
  for (const islet of ISLETS) {
    const walk = isletWalk(islet.id);
    for (let n = 0; n < 50; n++) {
      const items = scatterMaterials(walk);
      assert.deepEqual(items.map(item => item.kind), MATERIALS, `${islet.id}: one of each`);
      for (const item of items) {
        assert.ok(walk.nav.walkable(item.x, item.y) && inPoly(item.x, item.y, walk.world.coast), `${islet.id}: ${item.kind} on land`);
        assert.ok(Math.hypot(item.x - walk.land.x, item.y - walk.land.y) >= 400, `${islet.id}: ${item.kind} away from the jetty`);
      }
    }
    const shore = shoreOf(walk);
    assert.ok(shore, `${islet.id}: has a shore to build from`);
    const spot = buildSpot(walk.id, shore);
    assert.ok(canSail(spot.x, spot.y, walk.id) && !inPoly(spot.x, spot.y, walk.world.coast), `${islet.id}: the boat floats at sea`);
    assert.equal(strandedIslet(walk.id, {mode: 'walking', ...shore}, []), walk, `${islet.id}: no boat means stranded`);
    assert.equal(strandedIslet(walk.id, {mode: 'walking', ...shore}, [{islandId: walk.id, ...spot, occupant: null}]), null, `${islet.id}: a free boat there means not stranded`);
  }
});

test('room server: a stranded player builds a boat at the shore that only they can take', async () => {
  const walk = isletWalk((ISLETS.find(i => i.art === 'tree-and-rowboat') ?? ISLETS[0]).id), shore = shoreOf(walk);
  const room = await makeRoom();
  clearAround(room, walk);
  const builder = addPlayer(room, 7101, {islandId: walk.id, ...shore});
  const other = addPlayer(room, 7102, {islandId: walk.id, ...shore});
  try {
    Object.assign(builder.actor, inlandOf(walk));
    room.webSocketMessage(builder.socket, JSON.stringify({type: 'build', seq: 1}));
    assert.equal(room.boats.filter(b => b.owner).length, 0, 'no boat inland');
    assert.match(builder.socket.notes.at(-1).text, /edge of the island/);

    Object.assign(builder.actor, shore);
    room.connections.get(builder.socket).lastBuild = -Infinity;
    room.webSocketMessage(builder.socket, JSON.stringify({type: 'build', seq: 2}));
    const built = room.boats.find(b => b.owner === 'load-7101');
    assert.ok(built, 'built at the shore');
    assert.ok(canSail(built.x, built.y, walk.id));
    assert.deepEqual(builder.socket.notes.at(-1), {type: 'boat-built', boatId: built.id, x: built.x, y: built.y});

    room.connections.get(builder.socket).lastBuild = -Infinity;
    room.webSocketMessage(builder.socket, JSON.stringify({type: 'build', seq: 3}));
    assert.equal(room.boats.filter(b => b.owner).length, 1, 'no second boat while yours waits');

    room.broadcast();
    const sent = JSON.parse(builder.socket.last), seen = JSON.parse(other.socket.last);
    assert.ok(sent.boats.some(b => b.id === built.id && b.built && !('owner' in b)), 'everyone sees the boat, never the account');
    assert.deepEqual(sent.self.ownBoats, [built.id]);
    assert.deepEqual(seen.self.ownBoats, []);

    room.webSocketMessage(other.socket, JSON.stringify({type: 'board', seq: 1, boatId: built.id}));
    assert.match(other.socket.notes.at(-1).text, /Someone else built/);
    room.webSocketMessage(builder.socket, JSON.stringify({type: 'board', seq: 4, boatId: built.id}));
    for (let k = 0; k < 400 && builder.actor.mode === 'walking'; k++) room.step();
    assert.equal(builder.actor.mode, 'sailing', 'the builder sails off in it');
    assert.equal(built.occupant, builder.actor.id);
  } finally {clearInterval(room.timer);}
});
