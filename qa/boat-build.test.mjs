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

test('room server: a stranded player cannot add a boat to the fixed fleet', async () => {
  const walk = isletWalk((ISLETS.find(i => i.art === 'tree-and-rowboat') ?? ISLETS[0]).id), shore = shoreOf(walk);
  const room = await makeRoom();
  clearAround(room, walk);
  const player = addPlayer(room, 7101, {islandId: walk.id, ...shore});
  try {
    const before = room.boats.map(({id}) => id);
    room.webSocketMessage(player.socket, JSON.stringify({type: 'build', seq: 1}));
    assert.deepEqual(room.boats.map(({id}) => id), before);
    assert.equal(player.socket.notes.at(-1).text, 'Use an existing boat to travel between islands.');
  } finally {clearInterval(room.timer);}
});
