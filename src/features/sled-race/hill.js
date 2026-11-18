// The sled hill island, north of the snow island and joined to its north shore by a bridge. Everyone on its plaza watches the
// race: the racers' ducks slide down its run live while the racers themselves play in the race scene. Only the plaza
// at the bottom and the bridge can be walked on; the hill itself is solid. The geometry (all in the snow island's
// own world units) is exported from the approved art by sled-race-art/island-hill/code/export_game.py.
import HILL from './hill-island.json' with {type: 'json'};
import {SLED} from './rules.js';

export const SLED_HILL = HILL;
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
function along(edge, u) {
  const f = Math.max(0, Math.min(1, u)) * (edge.length - 1), i = Math.min(edge.length - 2, Math.floor(f));
  return lerp(edge[i], edge[i + 1], f - i);
}

// A point on the run: u from the start at the top (0) to the finish line (1), v across it from its left edge (0) to
// its right (1).
export function runPoint(u, v) {
  const [x, y] = lerp(along(HILL.track.left, u), along(HILL.track.right, u), v);
  return {x, y};
}
// How wide the run is at u, in world units (narrower up the hill, where it is further away)
export function runWidth(u) {const a = runPoint(u, 0), b = runPoint(u, 1); return Math.hypot(b.x - a.x, b.y - a.y);}

// Where a racer of the race is on the island's run: down the hill by its share of the course, across it by its
// place across the track (the race's bends are straightened out).
export function racerOnHill(r, course) {
  const u = Math.max(0, Math.min(1, r.d / course.length));
  const v = Math.max(.06, Math.min(.94, (r.x - course.centre(Math.min(r.d, course.length))) / SLED.trackWidth + .5));
  return {...runPoint(u, v), u, v};
}

// Where a racer's duck comes back after the race: on the plaza below the finish line, spread out so they do not stack.
export function landingSpot(index = 0) {
  const [x, y] = HILL.runout, spread = ((index % 5) - 2) * 90, row = Math.floor(index / 5) * 80;
  return {x: x + spread, y: y + row};
}

// The podium is a prop anyone can jump onto: jumping from the snow just in front of it lands on the nearest free block
// (1st, 2nd, 3rd), and jumping again lands back on the snow in front of that block.
export const PODIUM_REACH = 260;
export function podiumBlockNear(x, y, taken = new Set()) {
  let best = null, gap = PODIUM_REACH;
  HILL.podium.forEach(([bx], i) => {
    const d = Math.hypot(x - bx, y - HILL.podiumFront);
    if (d < gap && !taken.has(i + 1)) {best = i + 1; gap = d;}
  });
  return best;
}
export function podiumTop(block) {const [x, y] = HILL.podium[block - 1]; return {x, y};}
export function podiumFront(block) {return {x: HILL.podium[block - 1][0], y: HILL.podiumFront};}

// The snow island's map with the hill island added (its delivered map already has room for it, north of the island):
// the plaza is walkable land, the bridge a walkway, the plaza's props solid, the whole hill solid for boats, and the
// race pop-up moves to the tube rental stall.
export function withSledHill(data) {
  const add = w => w && {
    ...w,
    lands: [...(w.lands ?? []), HILL.land],
    solidLand: [...(w.solidLand ?? []), HILL.outline],
    walkways: [...(w.walkways ?? []), HILL.walkway],
    obstacles: [...(w.obstacles ?? []), ...HILL.obstacles],
    zones: w.zones && {...w.zones, sledHill: {x: HILL.entry[0], y: HILL.entry[1], spawn: HILL.entry}},
  };
  return {...data, world: add(data.world), walk: add(data.walk)};
}
