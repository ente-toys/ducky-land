// boss 5 Nov: "make the other islands real, just copies of ours; we are only on one, and take a boat to go to another".
// The world map: 300 stable island identities. Finished themes surround Home;
// the remaining islands use its map. Pure data shared by client, server and tests.
// Coordinates here are 'map' coordinates; each island plays in its own local coordinates (the home map), and
// offsetOf(a, b) turns one island's local coordinates into the other's.
import world from '../../rive/web/world.json' with {type: 'json'};
import READY from '../../rive/web/themes/index.js';   // the delivered themes, for their map sizes (boss 6 Nov: themed islands are bigger)

export const ISLAND_COUNT = 300;
const W = world.width, H = world.height;
// Append a theme here when it is finished. This is the only finish-order list.
export const FINISHED_THEMES = ['sunflower', 'pink', 'library', 'community', 'fair', 'neon', 'cathedral', 'canal', 'waterfall', 'goldmine'];
export const TEST_THEMES = FINISHED_THEMES.slice(0, 3);
// Existing save identities and display metadata, not placement or finish order.
// Future themes need only FINISHED_THEMES; this table preserves the first ten IDs.
export const THEMED_ISLANDS = [
  ['blossom', 'sunflower', 'Sunbob Fields', 0xf2c53d],
  ['sunset', 'pink', 'Rosybutton Bay', 0xf29bb7],
  ['isle-251', 'library', 'Pagepond', 0xd9b578],
  ['isle-250', 'community', 'Campfire Commons', 0xb98cf0],
  ['isle-170', 'fair', 'Waddlewish Fair', 0xf29bb7],
  ['isle-230', 'neon', 'Tickytown', 0xf29bb7],
  ['isle-176', 'cathedral', 'Bellovo Piazza', 0xd9b578],
  ['isle-56', 'canal', 'Puddlelace', 0x6ec9de],
  ['isle-93', 'waterfall', 'Ribbonfall Cove', 0x7fd6c8],
  ['isle-163', 'goldmine', 'Nuggetnook', 0xd9b578],
];
export const sizeOfTheme = theme => {const w = theme && theme !== 'home' ? READY?.[theme]?.world : null; return w?.width > 0 && w?.height > 0 ? {width: w.width, height: w.height} : {width: W, height: H};};
const PREFIX = ['Puddle', 'Breadcrumb', 'Feather', 'Waddle', 'Quack', 'Sunny', 'Clover', 'Pebble', 'Maple', 'Honey',
  'Bubble', 'Drizzle', 'Biscuit', 'Tulip', 'Mango', 'Coconut', 'Lily', 'Ripple', 'Willow', 'Marsh'];
const SUFFIX = ['Isle', 'Island', 'Cay', 'Key', 'Atoll', 'Bay', 'Reef', 'Rock', 'Point', 'Haven', 'Shoal', 'Holm', 'Shore', 'Lagoon', 'Cove'];
const ACCENTS = [0xf29bb7, 0xffa14f, 0x9fd4ff, 0xb98cf0, 0x8fdc8a, 0xffd36e, 0xff8a7a, 0x7fd6c8];
const TINTS = [0xFFFFFF, 0xFFFFFF, 0xFFE9B8, 0xE2F5B8, 0xFFD9C4, 0xF2E2FF, 0xD9F0FF, 0xFFF3A8];

// the world laid out with each island's map size given by sizeOf(theme) (the delivered themes by default)
export function layoutWorld(sizeOf = sizeOfTheme, seed = 11, finished = FINISHED_THEMES) {
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
  Object.assign(byDistance[0], {id: 'blossom', name: 'Sunbob Fields', accent: 0xf2c53d});
  Object.assign(byDistance[1], {id: 'sunset', name: 'Rosybutton Bay', accent: 0xf29bb7});
  const isle251 = out.find(island => island.id === 'isle-251');   // themed islands carry their theme's name
  if (isle251) Object.assign(isle251, {name: 'Pagepond'});
  // Stable local island identities, ordered slots around Home. Reserve enough space for
  // any delivered map, then keep these centres fixed while the outer copies spread.
  const maxW = Math.max(8000, ...finished.map(t => sizeOf(t).width));
  const maxH = Math.max(6000, ...finished.map(t => sizeOf(t).height));
  const slots = [];
  for (let row=-10; row<=10; row++) for (let col=-10; col<=10; col++) {
    if (!row && !col) continue;
    slots.push({x: col * maxW * 1.15, y: row * maxH * 1.15});
  }
  slots.sort((a,b) => Math.hypot(a.x,a.y)-Math.hypot(b.x,b.y) || a.y-b.y || a.x-b.x);
  const claimed = new Set(['home']);
  finished.forEach((theme,k) => {
    const meta = THEMED_ISLANDS.find(row => row[1] === theme);
    const island = (meta && out.find(i => i.id === meta[0])) || byDistance.find(i => !claimed.has(i.id) && !THEMED_ISLANDS.some(row => row[0] === i.id));
    claimed.add(island.id);
    const slot=slots[k], scale=1+k*.002;
    Object.assign(island, {theme, name:meta?.[2] ?? READY[theme]?.world?.name ?? theme, accent:meta?.[3] ?? island.accent,
      x:cx+slot.x*scale, y:cy+slot.y*scale});
  });
  for (const island of out) Object.assign(island, sizeOf(island.theme));
  const radius = Math.max(...out.filter(i=>i.theme).map(i=>Math.hypot(i.x-cx,i.y-cy))) + 1200;
  const outside = i => {
    if (i.id==='home' || i.theme) return;
    const dx=wrapd(i.x-cx,SX), dy=i.y-cy, r=Math.hypot(dx,dy);
    if (r<radius) {i.x=cx+dx/r*radius; i.y=cy+dy/r*radius;}
  };
  out.forEach(outside);
  spread(out, {SX, latOf, wrapd, y0: bounds.y0, y1: bounds.y1, outside});
  return {islands: out, bounds, Rw, SX, wrapd};
}

// boss 6 Nov ("every island BIGGER and spacious"): a themed map may be up to 8000 x 6000, so two islands are spaced by their
// own two sizes: their centres stay at least 1.02 of the average of their sizes apart (the same rule the layout uses for two
// home-size islands, so with no bigger map nothing moves). Where a bigger map crowds a neighbour, the pair is pushed apart
// along the line between them: Home and finished themes stay fixed. Deterministic, so the
// game and the room server lay out the same world.
export const GAP = 1.02;
export const clearOf = (a, b, {SX, latOf, wrapd}) => {
  const c = Math.cos((latOf(a.y) + latOf(b.y)) / 2);
  return Math.max(Math.abs(wrapd(b.x - a.x, SX)) * c / ((a.width + b.width) / 2), Math.abs(b.y - a.y) / ((a.height + b.height) / 2));
};
function spread(out, geo) {
  const {SX, wrapd, y0, y1} = geo, mobility = i => i.id === 'home' || i.theme ? 0 : 1;
  for (let pass = 0; pass < 400; pass++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
      const a = out[i], b = out[j];
      if (Math.abs(wrapd(b.x - a.x, SX)) > (a.width + b.width) * 1.2 || Math.abs(b.y - a.y) > (a.height + b.height) * .6) continue;   // far apart: skip cheaply
      const d = clearOf(a, b, geo);
      if (d > GAP) continue;
      const ma = mobility(a), mb = mobility(b), total = ma + mb;
      if (!total) continue;
      let dx = wrapd(b.x - a.x, SX), dy = b.y - a.y;
      if (!dx && !dy) dx = 1;
      const k = (GAP * 1.01 / Math.max(d, 1e-6)) - 1;   // stretch the gap to just past the rule
      a.x -= dx * k * ma / total; a.y -= dy * k * ma / total;
      b.x += dx * k * mb / total; b.y += dy * k * mb / total;
      for (const o of [a, b]) o.y = Math.max(y0 + o.height / 2, Math.min(y1 - o.height / 2, o.y));
      moved = true;
    }
    out.forEach(geo.outside ?? (() => {}));
    if (!moved) break;
  }
}

const MAP = layoutWorld();
export const WORLD_ISLANDS = MAP.islands;
export const MAP_BOUNDS = MAP.bounds;
export const WORLD_GEO = {SX: MAP.SX, Rw: MAP.Rw, wrapd: MAP.wrapd, latOf: y => -(y - H / 2) / MAP.Rw};
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
// boss 6 Nov: each map has its own size (here = the real island's map, a copy's own width/height when it carries them).
export function copyHolding(x, y, copies, pad = 300, here = {width: W, height: H}) {
  if (Math.abs(x - here.width / 2) < here.width / 2 && Math.abs(y - here.height / 2) < here.height / 2) return null;
  let best = null, distance = Infinity;
  for (const copy of copies) {
    const cw = copy.width ?? W, ch = copy.height ?? H;
    if (Math.abs(x - copy.x) >= cw / 2 + pad || Math.abs(y - copy.y) >= ch / 2 + pad) continue;
    const d = Math.hypot((x - copy.x) / cw, (y - copy.y) / ch);
    if (d < distance) {distance = d; best = copy;}
  }
  return best;
}
