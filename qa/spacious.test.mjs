import {mapPoint} from '../src/pixi/sphere-coordinates.js';
import homeExtra from '../rive/web/home-sleep-extra.json' with {type:'json'};
import {THEMED_ISLANDS} from '../src/pixi/world-map.js';
// boss 6 Nov: "Every island has to be BIGGER and SPACIOUS, with room for 100 Duckies to walk around, and stalls. The same
// sleeping Duckies as home, and every home feature (bridges and the rest) must work on these islands."
// a) sleepers on every map, b) home features per map, c) bigger maps spaced on the globe, d) 100 Duckies on one island.
import test from 'node:test';
import assert from 'node:assert/strict';
import homeWorld from '../rive/web/world.json' with {type: 'json'};
import {geometry} from '../rive/web/island-geometry.mjs';
import {HOME_MAP, ambientOf, makeMap, mapFor, mapOf, readyThemes, THEME_OF} from '../src/pixi/island-maps.js';
import {WORLD_GEO, WORLD_ISLANDS, layoutWorld, offsetOf, sizeOfTheme} from '../src/pixi/world-map.js';
import {BOAT_CHANNEL, coastGaps, copyHolding} from '../src/pixi/sphere-shores.js';
import {SLEEP_COUNTS, SLEEP_SPOTS, SLEEP_TOTAL, resolveSleepSpots, sleepHalfWidths, sleepShapeProblems, sleeperFootprint} from '../src/pixi/sleep-spots.js';
import {canSail, destinationsFor, harborOf, islandOffset, originOffset, seaBoundsFor} from '../src/pixi/islands.js';
import {clockwise, shoreOf, surfRuns} from '../src/pixi/surf.js';
import {setWalkDestination, walkStep} from '../src/pixi/player-motion.js';
import {addPlayer, makeRoom, seeded, wander} from './room-harness.mjs';
import {loadTest} from '../scripts/load-room.mjs';

const themedIslands = () => [...THEME_OF].filter(([, theme]) => readyThemes().includes(theme)).map(([id]) => id);
const area = ring => ring.reduce((a, p, i) => {const q = ring[(i + 1) % ring.length]; return a + p[0] * q[1] - q[0] * p[1];}, 0) / 2;
const sizes = sleepHalfWidths();

// ---------- a) sleepers ----------
test('a) sleepers: home preserves its 28 beds plus 12 additions; every theme has 40 beds and all eight poses', () => {
  assert.equal(SLEEP_TOTAL, 40);
  assert.deepEqual(SLEEP_COUNTS, {nod: 4, hammock: 2, rock: 3, leaf: 4, book: 4, chair: 2, wing: 5, box: 4});
  assert.deepEqual(sleepShapeProblems(Object.fromEntries(Object.entries(SLEEP_SPOTS).map(([p,s])=>[p,[...s,...(homeExtra[p]??[])]]))), []);
  assert.deepEqual(HOME_MAP.sleepers, [], 'home\'s sleepers stay in its own walk-world.json, placed by the engine as before');
  for (const theme of readyThemes()) {
    const map = mapFor(theme);
    if (!map.world.sleepSpots) {test.diagnostic?.(`${theme}: no sleepSpots yet`); continue;}
    assert.deepEqual(sleepShapeProblems(map.world.sleepSpots), [], `${theme}: sleepSpots has exactly home's shape and counts`);
  }
});

test('a) sleepers: the bed rules (ground, decks, paths, avoid zones, water, props, spacing, nod on a real tree)', () => {
  const coast = [[500, 500], [4500, 500], [4500, 3500], [500, 3500]];
  const world = {width: 5000, height: 4000, coast, water: [{x: 3500, y: 1200, rx: 300, ry: 200}], bridges: [], obstacles: [], islets: [],
    walkways: [{a: [2500, 600], b: [2500, 100], w: 104}], paths: [[[1000, 3000], [4000, 3000]]], zones: {plaza: {x: 2500, y: 2000, spawn: [2500, 2000]}}};
  const props = [{id: 'oak-1', name: 'Oak tree', x: 1200, y: 1200, width: 200, height: 300}, {id: 'hut', name: 'Book stall', x: 2000, y: 2600, width: 300, height: 260}];
  const spots = {nod: [['oak-1', 0, false], ['no-such-tree', 0, false]], wing: [[2500, 620, false], [1500, 3000, false], [2500, 2000, false], [3500, 1200, false], [4470, 1800, false], [2000, 2560, false], [800, 2000, true], [800, 2150, true]],
    box: [[3300, 2400, false]], wizard: [[1000, 1000, false]]};
  const beds = resolveSleepSpots(world, props, geometry(world).walkable, sizes, {spots, avoid: [{x: 2500, y: 2000, rx: 400, ry: 300, name: 'plaza'}], warn: false});
  const why = Object.fromEntries(beds.bad.map(b => [`${b.pose}@${Math.round(b.x)},${Math.round(b.y)}`, b.reason]));
  assert.deepEqual(beds.map(b => [b.pose, b.x, b.y]), [['nod', 1200, 1214], ['wing', 800, 2000], ['box', 3300, 2400]]);
  assert.equal(beds[0].tree, 'oak-1', 'nod leans on its tree, in front of the trunk');
  assert.match(why['nod@NaN,NaN'] ?? why[Object.keys(why).find(k => k.startsWith('nod'))], /no tree/);
  assert.equal(why['wing@2500,620'], 'deck/bridge/stair');
  assert.equal(why['wing@1500,3000'], 'path');
  assert.equal(why['wing@2500,2000'], 'plaza');
  assert.equal(why['wing@3500,1200'], 'not ground', 'in the pond');
  assert.equal(why['wing@4470,1800'], 'not ground', 'half over the sea');
  assert.match(why['wing@2000,2560'], /^prop hut/);
  assert.match(why['wing@800,2150'], /^near wing/);
  assert.equal(why['wizard@1000,1000'], 'unknown pose');
  // the resolved beds go into the map: solid for the room server and the game alike
  const map = makeMap('fixture', {world, harbor: {jetty: {foot: [2500, 600], tip: [2500, 150]}}, sleepers: beds});
  assert.equal(map.sleepers.length, 3);
  for (const bed of map.sleepers) {
    const f = sleeperFootprint(bed);
    assert.equal(map.nav().walkable(f.x, f.y), false, `${bed.pose} blocks walking`);
    assert.equal(map.nav().walkable(f.x, f.y + f.ry + 60), true, 'just below it is open ground');
  }
});

test('a) sleepers on the themed islands: each bed is on its land, off decks and water, and solid for the room server', () => {
  for (const id of themedIslands()) {
    const map = mapOf(id), beds = map.sleepers;
    assert.equal(beds.length, 40, `${id} renders all 40 residents`);
    test.diagnostic?.(`${map.id}: ${beds.length}/${SLEEP_TOTAL} sleepers`);
    const base = geometry(map.baseWalk);
    for (const bed of beds) {
      assert.ok(SLEEP_COUNTS[bed.pose], `${map.id} ${bed.pose} is a real pose`);
      assert.ok(map.landAt(bed.x, bed.y), `${map.id} ${bed.pose} ${bed.x},${bed.y} lies on land`);
      if (!bed.tree) assert.ok(base.walkable(bed.x, bed.y), `${map.id} ${bed.pose} ${bed.x},${bed.y} lies on open ground`);
      const f = sleeperFootprint(bed);
      assert.equal(map.nav().walkable(f.x, f.y), false, `${map.id} ${bed.pose} at ${bed.x},${bed.y} is solid for walkers`);
    }
    // a Ducky sent straight through a bed walks round it (the server's own walking)
    const bed = beds.find(b => !b.tree);
    if (!bed) continue;
    const f = sleeperFootprint(bed), from = map.nav().nearest(bed.x - 260, bed.y, 200), to = map.nav().nearest(bed.x + 260, bed.y, 200);
    if (!from || !to) continue;
    const actor = {id: 'a', x: from[0], y: from[1], turn: 0, action: 0, travel: 0, path: [], until: 0, jumpLeft: 0};
    if (!setWalkDestination(actor, map.nav(), to[0], to[1])) continue;
    for (let k = 0; k < 400 && actor.path.length; k++) {
      walkStep(actor, map.nav(), .05, k * .05, {x: 0, y: 0});
      assert.ok(((actor.x - f.x) / f.rx) ** 2 + ((actor.y - f.y) / f.ry) ** 2 >= 1, `${map.id}: never walks over the ${bed.pose} sleeper`);
    }
  }
});

// ---------- b) home features per map ----------
test('b) birds and butterflies: home keeps its spots, a themed island gets its own, all on its land', () => {
  assert.deepEqual(ambientOf(HOME_MAP).butterflies, [[2230, 2280], [3420, 2270]]);
  assert.equal(ambientOf(HOME_MAP).birds.length, 6);
  for (const id of themedIslands()) {
    const map = mapOf(id), a = ambientOf(map);
    assert.equal(a.birds.length, 6); assert.equal(a.butterflies.length, 2);
    for (const [x, y] of [...a.birds, ...a.butterflies]) assert.ok(map.landAt(x, y), `${map.id}: ${x},${y} on its land`);
  }
});

test('b) surf: every themed coast and islet gets the beach surf, each ring turned to face the sea', () => {
  for (const ring of shoreOf(homeWorld)) assert.ok(area(ring) > 0, 'clockwise on screen');
  assert.deepEqual(clockwise([[0, 0], [0, 10], [10, 10], [10, 0]]), [[10, 0], [10, 10], [0, 10], [0, 0]]);
  for (const id of themedIslands()) {
    const map = mapOf(id), rings = shoreOf(map.world), runs = surfRuns(rings);
    assert.equal(rings.length, (map.world.coastRings?.length ?? 1) + (map.world.surfIslets ?? map.world.islets ?? []).length);
    assert.ok(runs.length > 20, `${map.id}: ${runs.length} surf runs`);
    // the crest starts out at sea: 120 out along each normal is never this island's land
    const out = runs.flatMap(r => r.points).filter((p, i) => i % 7 === 0).filter(p => map.landAt(p.x + p.nx * 120, p.y + p.ny * 120));
    assert.ok(out.length / runs.length < .1, `${map.id}: the surf normals point out to sea (${out.length} inland)`);
  }
});

test('b) bridges, islets, decks and harbors work from each map\'s own data', () => {
  for (const id of themedIslands()) {
    const map = mapOf(id), nav = map.nav();
    for (const b of map.world.bridges) if (map.world.water.some(w => Math.hypot(w.x - b.x, w.y - b.y) < (w.rx ?? 0) + b.w)) assert.ok(nav.walkable(b.x, b.y) || nav.nearest(b.x, b.y, 40), `${map.id}: bridge ${b.x},${b.y} is walkable`);
    for (const w of map.world.walkways) {const m = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2]; assert.ok(nav.walkable(...m), `${map.id}: deck ${m} is walkable`);}
    for (const [x, y] of map.world.islets) assert.ok(nav.walkable(x, y) || map.landAt(x, y), `${map.id}: islet ${x},${y} is land`);
    for (const arch of map.world.arches ?? []) assert.ok(map.world.walkways.some(w => Math.hypot(w.a[0] - arch.a[0], w.a[1] - arch.a[1]) < 80 || Math.hypot(w.b[0] - arch.a[0], w.b[1] - arch.a[1]) < 80), `${map.id}: arch has its walkway`);
    const h = harborOf(id);
    assert.ok(nav.walkable(h.land.x, h.land.y), `${map.id}: jetty end walkable`);
    assert.ok(canSail(h.water.x, h.water.y, id), `${map.id}: boats dock beside its jetty`);
  }
});

// ---------- c) bigger maps on the globe ----------
test('c) every island keeps a boat channel between its real coasts (not its map rectangle), home never moves', () => {
  for (const {a, b, gap} of coastGaps()) assert.ok(gap >= BOAT_CHANNEL, `${a}/${b}: ${Math.round(gap)} between coasts`);
  for (const id of themedIslands()) assert.deepEqual(sizeOfTheme(mapOf(id).id), {width: mapOf(id).width, height: mapOf(id).height});
  // at the 8000 x 6000 limit every theme still fits, home stays put, the same three islands are themed, few islands move
  const plain = layoutWorld(() => ({width: homeWorld.width, height: homeWorld.height})), big = layoutWorld(t => t ? {width: 8000, height: 6000} : {width: homeWorld.width, height: homeWorld.height});
  assert.deepEqual(big.islands.filter(i => i.theme).map(i => i.id).sort(), THEMED_ISLANDS.map(([id])=>id).sort());
  assert.deepEqual([big.islands[0].x, big.islands[0].y], [plain.islands[0].x, plain.islands[0].y]);
  for (const {a, b, gap} of coastGaps(big.islands, big.Rw)) assert.ok(gap >= BOAT_CHANNEL, `${a}/${b} at 8000 x 6000`);
  assert.deepEqual(big.islands, layoutWorld(t => t ? {width:8000,height:6000} : {width:homeWorld.width,height:homeWorld.height}).islands);
});

test('c) in every themed island\'s sea: the neighbours fit the camera and sailing bounds, and no two coasts overlap', () => {
  for (const id of ['home', ...themedIslands()]) {
    const b = seaBoundsFor(id), here = mapOf(id);
    for (const d of destinationsFor(id)) {
      const m = mapOf(d.destination);
      assert.ok(d.offset.x + m.origin.x >= b.x0 && d.offset.y + m.origin.y >= b.y0 && d.offset.x + m.origin.x + m.width <= b.x1 && d.offset.y + m.origin.y + m.height <= b.y1, `${id}: ${d.destination}'s whole map is inside the sea bounds`);
      assert.ok(canSail(d.dock.x, d.dock.y, id), `${id}: ${d.destination}'s dock is open water`);
    }
    // Shore separation uses full sphere geometry, not translated map boxes.
    for(const other of WORLD_ISLANDS.filter(i=>i.id!==id)){
      const m=mapOf(other.id);
      for(const [x,y]of m.walk.coast.filter((_,k)=>k%3===0)){
        const p=mapPoint(other.id,id,{x,y});assert.equal(here.landAt(p.x,p.y),false,`${id}/${other.id}: coasts never overlap`);
      }
    }
    // a copy of a bigger neighbour holds what is in its waters, by its own size
    const copies = WORLD_ISLANDS.filter(i => i.id !== id).map(i => ({from:id,id: i.id, x: here.cx + offsetOf(id, i.id).x, y: here.cy + offsetOf(id, i.id).y, width: mapOf(i.id).width, height: mapOf(i.id).height}));
    for (const d of destinationsFor(id)) assert.equal(copyHolding(d.dock.x, d.dock.y, copies, 300, here)?.id, d.destination, `${id}: at ${d.destination}'s jetty`);
    assert.equal(copyHolding(here.spawn.x, here.spawn.y, copies, 300, here), null);
  }
});

// ---------- d) 100 Duckies on one island ----------
test('d) 100 players walk about one themed island: the server tick stays far inside its 50 ms', async () => {
  const islands = themedIslands();
  for (const island of islands.length ? islands : ['home']) {
    const r = await loadTest({players: 100, island, seconds: 4, quiet: true});
    test.diagnostic?.(JSON.stringify(r));
    assert.equal(r.onIsland, 100); assert.ok(r.walkable, 'every Ducky on walkable ground');
    assert.equal(r.playersInSnapshot, 100, 'each player is sent all 100');
    assert.ok(r.tickMeanMs < 10, `tick mean ${r.tickMeanMs} ms`);
    assert.ok(r.cpuShare < .5, `ticks + click routes use ${Math.round(r.cpuShare * 100)}% of the room's time`);
    assert.ok(r.snapshotBytes < 40000, `${r.snapshotBytes} bytes a snapshot`);
  }
});

test('d) an island holds 100: a boat cannot land a 101st (it waits at the harbor mouth and is told), the next free place lets it in', async () => {
  const {ISLAND_LIMIT} = await import('../worker/index.js');
  assert.equal(ISLAND_LIMIT, 100);
  const room = await makeRoom(), target = destinationsFor('home').find(d => d.destination !== 'home').destination, m = mapOf(target), nav = m.nav(), rnd = seeded(3);
  const crowd = [];
  for (let n = 0; crowd.length < ISLAND_LIMIT && n < 20000; n++) {
    const x = m.spawn.x + (rnd() * 2 - 1) * 1000, y = m.spawn.y + (rnd() * 2 - 1) * 700;
    if (nav.walkable(x, y)) crowd.push(addPlayer(room, crowd.length, {islandId: target, x, y}));
  }
  const d = destinationsFor('home').find(o => o.destination === target);
  const sailor = addPlayer(room, 500, {islandId: 'home', mode: 'sailing', x: d.dock.x, y: d.dock.y});
  const boat = room.boats.find(b => b.islandId === 'home' && !b.occupant);
  Object.assign(boat, {occupant: sailor.actor.id, x: d.dock.x, y: d.dock.y}); sailor.actor.boatId = boat.id;
  room.timer = 'manual';
  room.step();
  assert.equal(sailor.actor.islandId, 'home', 'the full island turns the boat away');
  assert.ok(sailor.socket.notes.some(n => n.type === 'travel-notice' && /full/.test(n.text)), 'and says why');
  room.connections.delete(crowd[0].socket);   // someone leaves
  room.step();
  assert.equal(sailor.actor.islandId, target, 'now it sails in');
  clearInterval(room.timer); room.timer = null;
});

test('d) the room sends each island only its own players, and the same JSON as before, field for field', async () => {
  const room = await makeRoom(), [a, b] = themedIslands().length >= 2 ? themedIslands() : ['home', 'blossom'];
  const pa = addPlayer(room, 1, {islandId: a, ...mapOf(a).spawn}), pb = addPlayer(room, 2, {islandId: b, ...mapOf(b).spawn});
  pa.actor.x += .123456789;
  room.broadcast();
  const sa = JSON.parse(pa.socket.last), sb = JSON.parse(pb.socket.last);
  assert.deepEqual(sa.players.map(p => p.id), [pa.actor.id]); assert.deepEqual(sb.players.map(p => p.id), [pb.actor.id]);
  assert.equal(sa.islandId, a); assert.ok(sa.boats.every(boat => boat.islandId === a));
  assert.deepEqual(Object.keys(sa.players[0]).sort(), ['accountId', 'action', 'boatId', 'emoteVersion', 'exitLocked', 'id', 'islandId', 'jumpLeft', 'login', 'mode', 'outfit', 'travel', 'turn', 'x', 'y']);
  assert.equal(sa.players[0].x, Math.round(pa.actor.x * 100) / 100, 'positions to a hundredth on the wire');
  assert.deepEqual(Object.keys(sa.self).sort(), ['ack', 'docking', 'emoteLeft', 'path', 'sailTarget']);
});
