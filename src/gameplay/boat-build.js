// Stranded on an islet with no boat (e.g. after losing every life in the bog): the player collects wood, rope and
// sail cloth scattered on the islet, then builds a boat at any point of its shore. Pure logic, shared by the
// browser and the Worker.
import {inPoly} from '../../assets/world/island-geometry.mjs';
import {placeIslet} from '../world/islet-placement.js';
import {isletWalks} from '../world/islet-walk.js';
import {canSail, navOf} from './islands.js';

export const MATERIALS = ['wood', 'rope', 'sail'];
export const MATERIAL_NAMES = {wood: 'wood', rope: 'rope', sail: 'sail cloth'};
export const PICKUP_RADIUS = 90;
export const BUILD_COOLDOWN = 5000;
export const BOAT_UNVEIL = .22;   // seconds into the build smoke when the new boat shows (the big cloud)
const FREE_BOAT_RADIUS = 600, SHORE_REACH = 200, SPREAD = 700, DOCK_GAP = 500, BOARD_REACH = 260;
const HIDE_MIN = 350, HIDE_PAD = 60, LAND_MARGIN = 70, SAMPLES = 4000, CANDIDATES = 160;
const BOAT_ROOM = 90;   // more water than a sailing boat needs, so the built boat floats clear of the sand

export const isletUnder = (islandId, p) => isletWalks(islandId).find(w => w.nav.walkable(p.x, p.y)) ?? null;

// The islet the walking player stands on, when no free boat waits anywhere around it.
export function strandedIslet(islandId, actor, boats) {
  if (!actor || actor.mode !== 'walking') return null;
  const walk = isletUnder(islandId, actor);
  if (!walk) return null;
  const {x0, y0, x1, y1} = walk.box, pad = FREE_BOAT_RADIUS;
  const freeBoat = boats.some(boat => !boat.occupant && boat.islandId === islandId &&
    boat.x >= x0 - pad && boat.x <= x1 + pad && boat.y >= y0 - pad && boat.y <= y1 + pad);
  return freeBoat ? null : walk;
}

// The camera looks north, so ground just north of a tall piece (the mountain, a tree) is drawn behind it.
// Obstacles are ground footprints: the box above each, about as tall as it is wide, counts as hidden.
const hiddenBoxes = walk => walk.world.obstacles.map(({poly}) => {
  const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
  const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
  return {x0: left - HIDE_PAD, x1: right + HIDE_PAD, y0: top - Math.max((right - left) * 1.2, HIDE_MIN), y1: bottom + HIDE_PAD};
});

// Drawn water that the walk data doesn't model (a stream, a pond) and the bridge over it, as boxes in the islet
// art's 1024 design space, measured from the named SVG layers (04: water + stream-bridge, 07: heart-pond).
const DRAWN_WATER = {'04-small-mountain': [[443, 452, 605, 779]], '07-pink-blossom': [[288, 617, 417, 710]]};
const drawnWater = new Map();
function drawnWaterOf(walk) {
  const {islet} = walk, k = islet.width / 1024;
  if (!drawnWater.has(islet.id)) drawnWater.set(islet.id, (DRAWN_WATER[islet.art] ?? []).map(([x0, y0, x1, y1]) =>
    [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => {
      const p = placeIslet(walk.id, islet, [(x - 512) * k, (y - 512) * k]);
      return [p.x, p.y];
    })));
  return drawnWater.get(islet.id);
}

// the item's spot and a ring around it, all of which must be solid land
const FOOTPRINT = [[0, 0], ...Array.from({length: 8}, (_, k) => [Math.cos(k * Math.PI / 4) * LAND_MARGIN, Math.sin(k * Math.PI / 4) * LAND_MARGIN])];

// One of each material on a visible patch of the islet's land (inside the coast, clear of pools, streams and the
// bridges over them), away from the jetty and spread apart: random among spots SPREAD apart, else the farthest.
export function scatterMaterials(walk, random = Math.random) {
  const {x0, y0, x1, y1} = walk.box;
  const water = [...walk.world.water.map(({poly}) => poly), ...drawnWaterOf(walk)], hidden = hiddenBoxes(walk);
  const onLand = (x, y) => FOOTPRINT.every(([dx, dy]) => walk.nav.walkable(x + dx, y + dy) &&
    inPoly(x + dx, y + dy, walk.world.coast) && !water.some(poly => inPoly(x + dx, y + dy, poly)));
  const inView = (x, y) => !hidden.some(b => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1);
  const land = [];
  for (let tries = 0; tries < SAMPLES && land.length < CANDIDATES; tries++) {
    const x = Math.round(x0 + random() * (x1 - x0)), y = Math.round(y0 + random() * (y1 - y0));
    if (Math.hypot(x - walk.land.x, y - walk.land.y) >= DOCK_GAP && inView(x, y) && onLand(x, y)) land.push({x, y});
  }
  const spots = [], gapOf = p => Math.min(...spots.map(s => Math.hypot(s.x - p.x, s.y - p.y)));
  while (spots.length < MATERIALS.length && land.length) {
    const roomy = land.filter(p => gapOf(p) >= SPREAD);
    const pick = roomy.length ? roomy[Math.floor(random() * roomy.length)] : land.reduce((a, b) => gapOf(b) > gapOf(a) ? b : a);
    spots.push(pick);
    land.splice(land.indexOf(pick), 1);
  }
  return spots.map((p, i) => ({kind: MATERIALS[i], ...p, taken: false}));
}

// Open sea next to the islet shore the player stands on (not an inland pool or lagoon), with room for a boat
// and a shore point to board from.
export function buildSpot(islandId, actor) {
  const walk = isletUnder(islandId, actor);
  if (!walk) return null;
  const nav = navOf(islandId), coast = walk.world.coast;
  for (let r = 60; r <= SHORE_REACH; r += 30) {
    for (let k = 0; k < 24; k++) {
      const a = k * Math.PI / 12, x = Math.round(actor.x + Math.cos(a) * r), y = Math.round(actor.y + Math.sin(a) * r);
      // facing out to sea, the way sailing sets turn
      if (!inPoly(x, y, coast) && canSail(x, y, islandId, BOAT_ROOM) && nav.nearest(x, y, BOARD_REACH)) return {x, y, turn: Math.atan2(x - actor.x, y - actor.y)};
    }
  }
  return null;
}
