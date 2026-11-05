// boss 5 Nov: "make the other islands real, just copies of ours; we are only on one, and take a boat to go to another".
// The world map: 300 islands, every one an exact copy of the home island (same size, same way up), placed on a map that
// wraps round the globe east-west. Pure data (no pixi) so the game, the room server and the tests all share it.
// Coordinates here are 'map' coordinates; each island plays in its own local coordinates (the home map), and
// offsetOf(a, b) turns one island's local coordinates into the other's.
import world from '../../rive/web/world.json' with {type: 'json'};

export const ISLAND_COUNT = 300;
const W = world.width, H = world.height;
const PREFIX = ['Puddle', 'Breadcrumb', 'Feather', 'Waddle', 'Quack', 'Sunny', 'Clover', 'Pebble', 'Maple', 'Honey',
  'Bubble', 'Drizzle', 'Biscuit', 'Tulip', 'Mango', 'Coconut', 'Lily', 'Ripple', 'Willow', 'Marsh'];
const SUFFIX = ['Isle', 'Island', 'Cay', 'Key', 'Atoll', 'Bay', 'Reef', 'Rock', 'Point', 'Haven', 'Shoal', 'Holm', 'Shore', 'Lagoon', 'Cove'];
const ACCENTS = [0xf29bb7, 0xffa14f, 0x9fd4ff, 0xb98cf0, 0x8fdc8a, 0xffd36e, 0xff8a7a, 0x7fd6c8];
const TINTS = [0xFFFFFF, 0xFFFFFF, 0xFFE9B8, 0xE2F5B8, 0xFFD9C4, 0xF2E2FF, 0xD9F0FF, 0xFFF3A8];

function layout(seed = 11) {
  let n = seed >>> 0;
  const rnd = () => ((n = (n * 1664525 + 1013904223) >>> 0) / 4294967296);
  const cx = W / 2, cy = H / 2;
  // the map: wide enough that 300 full-size islands fit with open sea between them
  const COLS = 20, ROWS = 15, sx = W * 2, sy = H * 2, hc = 10, hr = 7;
  const x0 = cx - (hc + .5) * sx, SX = COLS * sx, SY = ROWS * sy;
  const bounds = {x0, y0: cy - (hr + .5) * sy, x1: x0 + SX, y1: cy - (hr + .5) * sy + SY};
  const Rw = SX / (2 * Math.PI), LAT = .96;   // the map wraps once round a ball of this radius; islands stay within ~55 deg
  const latOf = y => -(y - cy) / Rw;
  const wrapd = (v, p) => v - p * Math.round(v / p);
  const out = [{index: 0, id: 'home', name: 'Home Island', x: cx, y: cy, accent: 0xffda69, tint: 0xFFFFFF}];
  // spaced by their real distance on the ball (east-west shrinks by cos(latitude)) so no two copies ever touch, on the
  // globe or in the sea you sail across
  const room = (x, y) => out.every(i => {
    const c = Math.cos((latOf(i.y) + latOf(y)) / 2);
    return Math.hypot(wrapd(i.x - x, SX) * c / W, (i.y - y) / H) > 1.02;
  });
  for (let t = 0; out.length < ISLAND_COUNT && t < 200000; t++) {
    const lat = Math.asin((rnd() * 2 - 1) * Math.sin(LAT - H * .5 / Rw)), x = x0 + rnd() * SX, y = cy - lat * Rw;   // even over the ball's area
    if (room(x, y)) out.push({index: out.length, x, y});
  }
  const names = PREFIX.flatMap(p => SUFFIX.map(s => `${p} ${s}`)).sort(() => rnd() - .5);
  for (const island of out.slice(1)) Object.assign(island, {
    id: `isle-${island.index}`, name: names[island.index], accent: ACCENTS[Math.floor(rnd() * ACCENTS.length)], tint: TINTS[Math.floor(rnd() * TINTS.length)]});
  // Ashwin's two islands keep their names: the two nearest neighbours of home
  const byDistance = out.slice(1).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
  Object.assign(byDistance[0], {id: 'blossom', name: 'Blossom Island', accent: 0xf29bb7});
  Object.assign(byDistance[1], {id: 'sunset', name: 'Sunset Island', accent: 0xffa14f});
  return {islands: out, bounds, Rw, SX, wrapd};
}

const MAP = layout();
export const WORLD_ISLANDS = MAP.islands;
export const MAP_BOUNDS = MAP.bounds;
const byId = new Map(WORLD_ISLANDS.map(island => [island.id, island]));
export const worldIsland = id => byId.get(id);
// how far island b sits from island a, in a's local coordinates (east-west takes the short way round the globe)
export function offsetOf(a, b) {
  const A = byId.get(a), B = byId.get(b);
  return {x: MAP.wrapd(B.x - A.x, MAP.SX), y: B.y - A.y};
}
// the islands you can sail to from this one: its four nearest, plus any island that counts this one among its four
// nearest, so every route also runs back the other way and the whole world is one connected sea
const nearest = id => WORLD_ISLANDS.filter(island => island.id !== id).map(island => ({island, ...offsetOf(id, island.id)}))
  .sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y)).slice(0, 4);
const LINKS = new Map(WORLD_ISLANDS.map(island => [island.id, new Set()]));
for (const island of WORLD_ISLANDS) for (const {island: other} of nearest(island.id)) {LINKS.get(island.id).add(other.id); LINKS.get(other.id).add(island.id);}
const NEIGHBOURS = new Map();
export function neighboursOf(id) {
  if (!NEIGHBOURS.has(id)) NEIGHBOURS.set(id, [...LINKS.get(id)].map(other => ({island: byId.get(other), ...offsetOf(id, other)}))
    .sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y)));
  return NEIGHBOURS.get(id);
}
// boss 5 Nov ("I went to another island, but I am going under the island"): the live copy a point stands in (a point in
// the current island's local coordinates; copies as archipelago.js places them, centre x/y). The copies are drawn after
// the real island, so a boat, Ducky or name board out in a neighbour's waters is drawn again inside that copy's pass,
// sorted among its jetty, sign and trees, instead of hidden under the whole copy. On the real island: none.
export function copyHolding(x, y, copies, pad = 300) {
  if (Math.abs(x - W / 2) < W / 2 && Math.abs(y - H / 2) < H / 2) return null;
  let best = null, distance = Infinity;
  for (const copy of copies) {
    if (Math.abs(x - copy.x) >= W / 2 + pad || Math.abs(y - copy.y) >= H / 2 + pad) continue;
    const d = Math.hypot((x - copy.x) / W, (y - copy.y) / H);
    if (d < distance) {distance = d; best = copy;}
  }
  return best;
}
