import {mapPoint} from '../src/world/sphere-coordinates.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import READY from '../src/world/delivered-themes.js';
import {HOME_MAP, THEME_OF, TEST_THEMES, mapFor, mapOf, mapsVersion, readyThemes, registerMap, themeOfIsland} from '../src/world/island-maps.js';
import {ISLANDS, boatSpots, canSail, createBoats, crossIsland, destinationsFor, fillMoorings, harborOf, islandOffset, landingApproach,
  landingSpot, originOffset, retireBoat, sailRoute, sailStep, seaBoundsFor, setSailDestination, boardingPoint} from '../src/gameplay/islands.js';
import {offsetOf, worldIsland} from '../src/world/world-map.js';

const ZERO = {x: 0, y: 0};
const themedIslands = () => [...THEME_OF].filter(([, theme]) => readyThemes().includes(theme)).map(([id]) => id);

test('registry: home is today\'s map, the three islands nearest home carry the three themes, unknown themes fall back to home', () => {
  assert.equal(mapFor('home'), HOME_MAP);
  assert.equal(HOME_MAP.width, 11000); assert.equal(HOME_MAP.height, 8250);
  assert.ok(HOME_MAP.nav().walkable(HOME_MAP.JETTY.foot.x,HOME_MAP.JETTY.foot.y));
  assert.ok(canSail(HOME_MAP.HARBOR.water.x,HOME_MAP.HARBOR.water.y));
  assert.equal(mapFor('no-such-theme'), HOME_MAP);
  assert.equal(mapOf('home'), HOME_MAP);
  for (const [id,theme] of [['blossom','sunflower'],['sunset','pink'],['isle-251','library'],['isle-250','community']]) assert.equal(THEME_OF.get(id),theme);
  for (const island of ISLANDS) {
    const theme = themeOfIsland(island.id), map = mapOf(island.id);
    if (readyThemes().includes(theme)) assert.equal(map.id, theme, `${island.id} plays ${theme}`);
    else assert.equal(map, HOME_MAP, `${island.id} plays the home map until its theme is delivered`);
  }
  for (const theme of readyThemes()) {
    const m = mapFor(theme);
    assert.equal(m.art,READY[theme].art, `${theme} delivered art url`);
    assert.ok(m.nav().walkable(m.spawn.x, m.spawn.y), `${theme} spawn is walkable`);
    assert.ok(m.nav().walkable(m.HARBOR.land.x, m.HARBOR.land.y), `${theme} jetty end is walkable`);
  }
});

test('registry: a broken theme never breaks the game, it plays home', () => {
  const before = mapsVersion(), keep = READY.pink ?? null;
  assert.equal(registerMap('pink', {world: {width: 10, height: 10}, harbor: {}}), false);
  assert.equal(mapFor('pink'), HOME_MAP);
  assert.ok(mapsVersion() > before, 'the sea caches are thrown away');
  assert.equal(mapOf(THEME_OF.size ? [...THEME_OF].find(([, t]) => t === 'pink')[0] : 'home'), HOME_MAP);
  if (keep) registerMap('pink', keep);
});

test('per-theme moorings: every themed island holds its own map\'s boats, and refills them there', () => {
  const islands = themedIslands();
  if (!islands.length) return;
  const boats = createBoats();
  for (const id of islands) {
    const spots = boatSpots(id), mine = boats.filter(b => b.islandId === id);
    assert.equal(mine.length, spots.length, `${id}: one boat per mooring`);
    assert.ok(spots.length >= 3);
    for (const [slot, spot] of spots.entries()) {
      assert.ok(mine.some(b => b.x === spot.x && b.y === spot.y), `${id} mooring ${slot} holds a boat`);
      assert.ok(canSail(spot.x, spot.y, id), `${id} mooring ${slot} (${spot.x},${spot.y}) floats`);
    }
    for (const boat of mine) {const deck = boardingPoint(boat); assert.ok(mapOf(id).nav().walkable(deck.x, deck.y) || mapOf(id).nav().nearest(deck.x, deck.y, 30), `${boat.id} is boarded from ${id}'s own ground`);}
    const spot = spots[0], boat = mine.find(b => b.x === spot.x && b.y === spot.y);
    boat.occupant = 'duck'; Object.assign(boat, {x: spot.x + 420, y: spot.y + 420});
    assert.equal(fillMoorings(boats), true);
    assert.ok(boats.some(b => b !== boat && !b.occupant && b.islandId === id && b.x === spot.x && b.y === spot.y), `${id} mooring 0 refilled at its own spot`);
    retireBoat(boats, boat);
  }
  const old = createBoats().map(b => islands.includes(b.islandId) ? {...b, x: HOME_MAP.boatSpots()[0].x, y: HOME_MAP.boatSpots()[0].y} : b);
  fillMoorings(old);
  for (const id of islands) for (const spot of boatSpots(id)) assert.ok(old.some(b => b.islandId === id && !b.occupant && b.x === spot.x && b.y === spot.y), `${id} refilled from an old save`);
});

test('landing on a themed island: sail from home to its jetty, dock, and step onto its ground', () => {
  for (const id of themedIslands()) {
    const paths = [['home']], seen = new Set(['home']);let path;
    for(let n=0;n<paths.length&&!path;n++) for(const d of destinationsFor(paths[n].at(-1))) {
      if(seen.has(d.destination))continue;seen.add(d.destination);const next=[...paths[n],d.destination];
      if(d.destination===id){path=next;break;}paths.push(next);
    }
    assert.ok(path,`connected sailing route from home to ${id}`);
    const a = {id:'me',islandId:'home',mode:'sailing',...HOME_MAP.HARBOR.water,turn:0,path:[]};
    for(const hop of path.slice(1)) {
      const d=destinationsFor(a.islandId).find(d=>d.destination===hop);
      assert.ok(setSailDestination(a,d.dock.x,d.dock.y),`a route from ${a.islandId} to ${hop}`);
      let crossed=false;
      for(let i=0;i<6000&&!crossed;i++) {
        assert.ok(canSail(a.x,a.y,a.islandId),`afloat on the way to ${hop}`);
        sailStep(a,.05,ZERO);crossed=crossIsland(a);if(!a.sailTarget&&!crossed)break;
      }
      assert.ok(crossed,`reached ${hop}`);assert.equal(a.islandId,hop);
    }
    assert.equal(a.islandId, id);
    assert.deepEqual({x: a.x, y: a.y}, harborOf(id).water, 'beside that island\'s own jetty');
    assert.ok(canSail(a.x, a.y, id));
    const land = harborOf(id).land;
    assert.ok(mapOf(id).nav().walkable(land.x, land.y), 'the jetty end you step onto is walkable');
    assert.ok(mapOf(id).nav().route(land.x, land.y, mapOf(id).spawn.x, mapOf(id).spawn.y).length, 'and it leads to the plaza');
    const spot = landingSpot({islandId: id, ...harborOf(id).water});
    assert.ok(spot && spot.islandId === id && mapOf(id).nav().walkable(spot.x, spot.y), 'Dock lands you on its ground');
  }
});

test('sailing round a themed island: never on its land, coast to coast in its own coordinates', () => {
  for (const id of themedIslands()) {
    const m = mapOf(id), b = seaBoundsFor(id);
    const off = (x, y) => {for (let r = 0; r < 1500; r += 25) for (const [dx, dy] of [[0, -r], [0, r], [-r, 0], [r, 0]]) if (canSail(x + dx, y + dy, id)) return {x: x + dx, y: y + dy}; return null;};
    const west = off(m.origin.x - 250, m.cy), east = off(m.origin.x + m.width + 250, m.cy);
    assert.ok(west && east, `${id}: sea on both sides`);
    for (const [from, to] of [[west, east], [{x: m.cx, y: m.origin.y - 250}, {x: m.cx, y: m.origin.y + m.height + 250}]]) {
      const a = {islandId: id, mode: 'sailing', ...(canSail(from.x, from.y, id) ? from : off(from.x, from.y)), path: []}, goal = canSail(to.x, to.y, id) ? to : off(to.x, to.y);
      assert.ok(setSailDestination(a, goal.x, goal.y), `${id}: a route round the island`);
      for (let i = 0; i < 8000 && a.sailTarget; i++) {
        sailStep(a, .05, ZERO);
        assert.ok(!m.landAt(a.x, a.y), `${id}: on its land at ${Math.round(a.x)},${Math.round(a.y)}`);
        assert.ok(a.x >= b.x0 && a.x <= b.x1 && a.y >= b.y0 && a.y <= b.y1);
      }
      assert.ok(Math.hypot(a.x - goal.x, a.y - goal.y) < 2, `${id}: arrived round the far side`);
    }
  }
});

test('maps of another size: a small themed island lines up round its centre, sails, docks and refills', () => {
  const keep = READY.library ?? null, W = 3000, H = 2400, cx = W / 2, cy = H / 2;
  const coast = Array.from({length: 48}, (_, i) => [Math.round(cx + Math.cos(i / 48 * Math.PI * 2) * 1000), Math.round(cy + Math.sin(i / 48 * Math.PI * 2) * 650)]);
  const world = {width: W, height: H, coast, water: [], bridges: [], obstacles: [], islets: [], walkways: [], zones: {plaza: {x: cx, y: cy, spawn: [cx, cy]}}};
  assert.ok(registerMap('library', {world, harbor: {jetty: {foot: [cx, cy + 560], tip: [cx, cy + 1000], width: 104}}, art: '/pixi-art/themes/library/art.json'}));
  try {
    const id = [...THEME_OF].find(([, t]) => t === 'library')[0], m = mapOf(id);
    assert.equal(m.width, W);
    const o = originOffset('home', id), c = offsetOf('home', id);
    assert.ok(Math.hypot(o.x + W / 2 - c.x - HOME_MAP.cx, o.y + H / 2 - c.y - HOME_MAP.cy) < 1e-6);
    assert.deepEqual(islandOffset('home', id), o);
    assert.equal(canSail(o.x + cx, o.y + cy, 'home'), false, 'its middle is land, seen from home');
    assert.equal(canSail(o.x + cx + 1300, o.y + cy, 'home'), true, 'beside it is sea');
    const back = originOffset(id, 'home');
    const homeCentre=mapPoint('home',id,{x:HOME_MAP.cx,y:HOME_MAP.cy});
    const roundTrip=mapPoint(id,'home',homeCentre);assert.ok(Math.hypot(roundTrip.x-HOME_MAP.cx,roundTrip.y-HOME_MAP.cy)<1e-8);
    const plaza=mapPoint('home',id,{x:2820,y:2400});
    assert.equal(canSail(plaza.x,plaza.y,id), false, 'home\'s plaza is land, seen from it');
    assert.ok(boatSpots(id).length >= 3);
    for (const s of boatSpots(id).slice(0, 3)) assert.ok(Math.abs(s.x - cx) <= 160 && s.y > cy + 560, `berth ${s.x},${s.y} beside the south jetty`);
    for (const s of boatSpots(id)) assert.ok(canSail(s.x, s.y, id), `berth ${s.x},${s.y} floats`);
    const boats = createBoats();
    assert.equal(boats.filter(b => b.islandId === id).length, boatSpots(id).length);
    const dock = destinationsFor('home').find(d => d.destination === id)?.dock ?? mapPoint(id,'home',m.HARBOR.water);
    assert.ok(canSail(dock.x, dock.y, 'home'));
    const a = {islandId: 'home', mode: 'sailing', ...dock, path: []};
    if (destinationsFor('home').some(d => d.destination === id)) {assert.ok(crossIsland(a)); assert.equal(a.islandId, id); assert.deepEqual({x: a.x, y: a.y}, m.HARBOR.water);}
    const spot = landingSpot({islandId: id, x: cx, y: cy - 760});
    assert.ok(spot && spot.islandId === id && m.nav().walkable(spot.x, spot.y));
    const approach = landingApproach({islandId: id, x: cx, y: cy - 1000}, spot);
    assert.ok(canSail(approach.x, approach.y, id));
    const s = {islandId: id, mode: 'sailing', x: cx - 1300, y: cy, path: []};
    assert.ok(setSailDestination(s, cx + 1300, cy));
    for (let i = 0; i < 4000 && s.sailTarget; i++) {sailStep(s, .05, ZERO); assert.ok(!m.landAt(s.x, s.y));}
    assert.ok(Math.hypot(s.x - cx - 1300, s.y - cy) < 2);
    assert.ok(sailRoute(id, {x: cx - 1300, y: cy}, {x: cx + 1300, y: cy}).length > 1, 'round the coast, not through it');
  } finally {
    registerMap('library', keep);
  }
  assert.equal(worldIsland('home').id, 'home');
});
