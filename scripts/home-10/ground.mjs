// Home 10, ground lane. Idempotent: reads src/pixi/home-expansion.json as the shore and homes lanes left it, rewrites only the
// ground lane's entries, and writes it back. Run from the repo root:  node scripts/home-10/ground.mjs
//
// Owns: tiles (48 ground tiles, repainted under public/pixi-art/home-expansion-g/), groundDecals (grass tufts, pebbles, small
// flowers and path-edge stones, the same decal art as the original centre), plants everywhere on the expanded land (trees,
// bushes, flowers, orchard apples; art under /pixi-art/plants/), small detail props in the verges / commons / coast-walk /
// river-banks zones, sleepers (the expanded land's sleeping Duckies), and the three river-crossing decks' art.
// Reads at run time and never writes: coast, water, riverWater, rivers, roads, decks (other than river-crossing-*), walkways,
// openSpaces, places, communities, obstacles and every prop the other lanes own. The design system is the original centre:
// one outline ink #39472d, flat fills, trees in groves of 3 to 7 beside paths, water and squares, ~2.2 trees and ~2.5 sleepers
// per million square units, grass detail on every lawn, wide cream paths with stones.
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {inPoly} from '../../rive/web/island-geometry.mjs';
import {sleepHalfWidths} from '../../src/pixi/sleep-spots.js';

const FILE = 'src/pixi/home-expansion.json', ART = 'public/pixi-art/home-expansion-g', WEB = '/pixi-art/home-expansion-g';
const E = JSON.parse(readFileSync(FILE, 'utf8'));
mkdirSync(ART, {recursive: true});
const INK = '#39472d', GRASS = '#93b72f', SAND = '#fde48c', SAND_DARK = '#e4c567', CREAM = '#fff0c7', WATER = '#6ec9de', FOAM = '#97dce5';
const r3 = v => Math.round(v * 10) / 10;

// ---------- deterministic noise ----------
const hash = (...n) => {let h = 2166136261; for (const v of n) {h ^= Math.round(v * 7) | 0; h = Math.imul(h, 16777619); h ^= h >>> 13;} return ((h >>> 0) % 1e6) / 1e6;};
const halton = (i, b) => {let f = 1, r = 0; for (; i > 0; i = Math.floor(i / b)) {f /= b; r += f * (i % b);} return r;};

// ---------- geometry ----------
const segDist = (x, y, a, b) => {const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);};
const polyDist = (x, y, p, closed = true) => {let d = Infinity; for (let i = 0; i < p.length - (closed ? 0 : 1); i++) d = Math.min(d, segDist(x, y, p[i], p[(i + 1) % p.length])); return d;};
const area = p => Math.abs(p.reduce((s, a, i) => {const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - a[1] * b[0];}, 0) / 2);
function sample(p, step = 18) {   // Catmull-Rom through the points, sampled every ~step units
  const out = [];
  for (let i = 0; i < p.length - 1; i++) {
    const b = p[i], c = p[i + 1], a = p[i - 1] ?? b, e = p[i + 2] ?? c, n = Math.max(2, Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]) / step));
    for (let j = 0; j < n; j++) {const t = j / n, u = 1 - t; out.push([0, 1].map(k => u ** 3 * b[k] + 3 * u * u * t * (b[k] + (c[k] - a[k]) / 6) + 3 * u * t * t * (c[k] - (e[k] - b[k]) / 6) + t ** 3 * c[k]));}
  }
  out.push(p.at(-1)); return out;
}
function curve(p, close = false) {
  let d = `M${p[0].map(r3)}`;
  for (let i = 0; i < (close ? p.length : p.length - 1); i++) {
    const b = p[i], c = p[(i + 1) % p.length], a = i ? p[i - 1] : close ? p.at(-1) : b, e = p[i + 2] ?? (close ? p[(i + 2) % p.length] : c);
    d += `C${r3(b[0] + (c[0] - a[0]) / 6)},${r3(b[1] + (c[1] - a[1]) / 6)} ${r3(c[0] - (e[0] - b[0]) / 6)},${r3(c[1] - (e[1] - b[1]) / 6)} ${c.map(r3)}`;
  }
  return d + (close ? 'Z' : '');
}
const poly = p => 'M' + p.map(v => v.map(r3).join(',')).join('L') + 'Z';

// ---------- what the other lanes left (read at run time) ----------
const centre = JSON.parse(readFileSync('src/pixi/walk-shapes.json', 'utf8')).coast;   // the original island's drawn land
const coast = E.coast;
// The old harbour bay (west end of the east inlet). The shore lane takes the sea out; the ground is painted as lawn either way,
// closed on the east by a soft curved beach, so the inlet ends in a cove at x ~6,300 until the shore lane's coast arrives.
const BAY_X = 6300;
let bayRun = null;
function bayPolygon() {
  const inBay = ([x, y]) => x < BAY_X && x > 5300 && y > 1150 && y < 2100;
  let i0 = -1, i1 = -1;
  for (let i = 0; i < coast.length; i++) if (inBay(coast[i])) {if (i0 < 0) i0 = i; i1 = i;}
  if (i0 < 0) return null;
  const run = coast.slice(i0, i1 + 1), top = run[0], bot = run.at(-1);
  if (inPoly((top[0] + bot[0]) / 2 - 300, (top[1] + bot[1]) / 2, coast)) return null;   // already land (the shore lane closed it)
  bayRun = [i0, i1];
  const mid = [BAY_X + 110, (top[1] + bot[1]) / 2];
  const beach = sample([bot, [BAY_X + 70, bot[1] - (bot[1] - top[1]) * .25], mid, [BAY_X + 70, top[1] + (bot[1] - top[1]) * .25], top], 40);
  return {poly: [...run, ...beach.slice(1, -1)], beach};
}
const bayShape = bayPolygon(), bay = bayShape?.poly ?? null;
const onLand = (x, y) => inPoly(x, y, coast) || (bay && inPoly(x, y, bay));
// the shoreline that still meets the sea: the coast without the bay's old edges, plus the bay's new beach
const seaSegs = [];
for (let i = 0; i < coast.length; i++) if (!bayRun || i < bayRun[0] || i >= bayRun[1]) seaSegs.push([coast[i], coast[(i + 1) % coast.length]]);
if (bayShape) for (let i = 0; i < bayShape.beach.length - 1; i++) seaSegs.push([bayShape.beach[i], bayShape.beach[i + 1]]);
const seaCells = new Map();
for (const sg of seaSegs) {const [a, b] = sg; for (let t = 0; t <= 1; t += .25) {const k = `${Math.floor((a[0] + (b[0] - a[0]) * t) / 400)},${Math.floor((a[1] + (b[1] - a[1]) * t) / 400)}`; const l = seaCells.get(k) ?? seaCells.set(k, new Set()).get(k); l.add(sg);}}
const coastDist = (x, y) => {
  const gx = Math.floor(x / 400), gy = Math.floor(y / 400); let d = Infinity;
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (const [a, b] of seaCells.get(`${gx + i},${gy + j}`) ?? []) d = Math.min(d, segDist(x, y, a, b));
  return Math.min(d, 800);
};
const inCentre = (x, y, pad = 0) => inPoly(x, y, centre) || (pad > 0 && polyDist(x, y, centre) < pad);
const waters = [...(E.riverWater ?? []).map(w => w.poly), E.water?.poly].filter(Boolean);
const waterDist = (x, y) => {let d = Infinity; for (const w of waters) {if (inPoly(x, y, w)) return -1; d = Math.min(d, polyDist(x, y, w));} return d;};
const roadWidth = r => Math.max(r.width ?? 56, r.kind === 'main' ? 128 : 104);
const roads = (E.roads ?? []).map(r => ({...r, line: sample(r.points, 24), W: roadWidth(r)}));
// spatial hash of road samples for fast distance
const GRID = 200, roadCells = new Map();
for (const r of roads) for (let i = 0; i < r.line.length - 1; i++) {
  const a = r.line[i], b = r.line[i + 1], k = `${Math.floor(a[0] / GRID)},${Math.floor(a[1] / GRID)}`;
  (roadCells.get(k) ?? roadCells.set(k, []).get(k)).push([a, b, r.W]);
}
function roadEdgeDist(x, y) {   // distance from the painted path's edge (negative on the path)
  let d = Infinity; const gx = Math.floor(x / GRID), gy = Math.floor(y / GRID);
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (const [a, b, W] of roadCells.get(`${gx + i},${gy + j}`) ?? []) d = Math.min(d, segDist(x, y, a, b) - W / 2);
  return d;
}
const decks = (E.decks ?? []).filter(d => Number.isFinite(d.x));
const inDeck = (x, y, pad) => decks.some(d => x > d.x - pad && x < d.x + d.width + pad && y > d.y - pad && y < d.y + d.height + pad);
const walkways = E.walkways ?? [];
const onWalkway = (x, y, pad) => walkways.some(b => segDist(x, y, b.a, b.b) < b.w / 2 + pad);
const open = E.openSpaces ?? [], places = [...(E.places ?? []), ...(E.commons ?? []).map(c => ({id: c.id, point: c.point}))];

// ---------- the owned entries: drop them, keep everything else exactly as it is ----------
const OWNED_ZONES = new Set(['verges', 'commons', 'coast-walk', 'river-banks']);
const PLANT = /^(tree-|bush-|flower-|apple-tree)/;
const isOwned = p => String(p.id).startsWith('ground-') || OWNED_ZONES.has(p.zone) || PLANT.test(p.asset ?? '');
const keepDetail = E.props.filter(p => OWNED_ZONES.has(p.zone) && !PLANT.test(p.asset ?? '') && !String(p.id).startsWith('ground-'));
const others = E.props.filter(p => !isOwned(p));
const half = p => (p.width ?? 0) * (p.scale ?? 1) / 2;
const BUILDING = /house|cottage|farmhouse|studio|townhouse|bakery|cafe|windmill|glasshouse|gazebo|pergola|lighthouse|stall|mender|pond-house|barn|shed|hall|shop/i;
const isBuilding = p => BUILDING.test(p.asset ?? p.name ?? '') || half(p) > 140;
// how far a point stands from a placed prop's base (0 = touching), and whether it would sit inside a building's drawing
function propClear(x, y, p, r) {
  if (!Number.isFinite(p.x)) return true;
  const f = p.footprint ?? {x: p.x, y: p.y - 8, rx: Math.max(16, half(p) * .6), ry: 22};
  if (((x - f.x) / (f.rx + r)) ** 2 + ((y - f.y) / (f.ry + r * .6)) ** 2 < 1) return false;
  if (isBuilding(p)) {   // the body and its front yard stay clear (front = south, the side that faces the lane)
    const w = half(p) + r + 40, h = (p.height ?? 300) * (p.scale ?? 1);
    if (Math.abs(x - p.x) < w && y > p.y - h * .55 && y < p.y + 230 + r) return false;
  }
  return true;
}
const obstacles = (E.obstacles ?? []).filter(o => !String(o.id ?? '').startsWith('ground-'));

// ---------- the base test every placement passes ----------
function ground(x, y, r, {road = 30, water = 50, coastPad = 90} = {}) {
  if (!onLand(x, y) || inCentre(x, y, 140 + r)) return false;
  if (coastDist(x, y) < r + coastPad) return false;
  if (waterDist(x, y) < r + water) return false;
  if (roadEdgeDist(x, y) < r + road) return false;
  if (inDeck(x, y, r + 30) || onWalkway(x, y, r + 40)) return false;
  if (open.some(o => Math.hypot(x - o.point[0], y - o.point[1]) < o.radius + r + 50)) return false;
  if (places.some(o => Math.hypot(x - o.point[0], y - o.point[1]) < 150 + r)) return false;
  if (obstacles.some(o => ((x - o.x) / (o.rx + r)) ** 2 + ((y - o.y) / (o.ry + r)) ** 2 < 1)) return false;
  return true;
}
// Kept where they still stand on open ground (the homes and shore lanes may have built over some).
const detail = keepDetail.filter(p => onLand(p.x, p.y) && !inDeck(p.x, p.y, 10) && roadEdgeDist(p.x, p.y) > -10 && others.every(o => propClear(p.x, p.y, o, 0)) && !(bay && inPoly(p.x, p.y, bay) && p.zone !== 'river-banks'));
const placed = [...others, ...detail];
const clearOfProps = (x, y, r, list = placed) => list.every(p => propClear(x, y, p, r));

// ---------- plants ----------
// GPT's plant set, the same art and the same scales as the centre (placements.js PLANTS / PLANT_SCALE); trees flip and tint
// like the centre's replanted lawn so a grove never looks stamped. The orchard apple keeps its fruit, outlined in the one ink.
const PLANTS = {'tree-1': [260, 360], 'tree-2': [180, 360], 'tree-3': [300, 380], 'tree-4': [200, 280], 'tree-5': [150, 380], 'tree-apple': [300, 380],
  'bush-1': [130, 100], 'bush-2': [168, 110], 'bush-3': [116, 104], 'bush-4': [140, 100], 'bush-5': [170, 110], 'bush-6': [120, 96],
  'flower-1': [48, 36], 'flower-2': [48, 36], 'flower-3': [44, 36]};
const SCALE = {tree: 1.15, bush: 1.3, flower: 1.6};
const apple = readFileSync('public/pixi-art/home-expansion-c/apple-tree-1589.svg', 'utf8').replace(/#8b4b32/gi, INK).replace(/#885931/gi, INK);
writeFileSync('public/pixi-art/plants/tree-apple.svg', apple);
const TINTS = [0xFFFFFF, 0xF4FAEC, 0xFFF7EA];
let serial = 0;
const out = [];
function plant(kind, x, y, zone, k = 1) {
  const [width, height] = PLANTS[kind], type = kind.split('-')[0], n = serial++;
  const p = {id: `ground-${type}-${n}`, name: kind, asset: kind, src: `/pixi-art/plants/${kind}.svg`, x: r3(x), y: r3(y), width, height,
    scale: +(SCALE[type] * k * (.9 + .2 * hash(x, y, 3))).toFixed(3), anchor: {x: .5, y: 1}, resolution: 5, zone,
    flip: hash(x, y, 5) > .5, tint: TINTS[n % 3]};
  out.push(p); placed.push(p); return p;
}
const zoneAt = (x, y) => {
  let best = 'verges', bd = 900;
  for (const c of E.communities ?? []) {const d = Math.hypot(x - c.center[0], y - c.center[1]); if (d < bd) {bd = d; best = c.id;}}
  for (const c of E.commons ?? []) {const d = Math.hypot(x - c.point[0], y - c.point[1]); if (d < Math.min(bd, 700)) {bd = d; best = 'commons';}}
  return best;
};
const trunkOK = (x, y, list) => ground(x, y, 34, {road: 26, water: 40, coastPad: 120}) && clearOfProps(x, y, 34, list) && list.filter(p => /^tree/.test(p.asset)).every(p => Math.hypot(x - p.x, (y - p.y) * 1.25) > 95);

// The expanded land's area, from the coast (plus the bay lawn) minus the original centre.
const landArea = area(coast) + (bay ? area(bay) : 0) - area(centre);
const TARGET = {trees: Math.round(2.2e-6 * landArea), sleepers: Math.round(2.5e-6 * landArea), bushes: Math.round(1.0e-6 * landArea)};

// 1) Orchards: the two fruit commons get rows of apples (an orchard is the one place trees stand in rows).
for (const id of ['cider-grove', 'north-orchard']) {
  const c = (E.commons ?? []).find(c => c.id === id); if (!c) continue;
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
    const x = c.point[0] + (col - 1) * 230 + (row % 2) * 70 + (hash(row, col, 1) - .5) * 40, y = c.point[1] + (row - 1) * 175 + (hash(row, col, 2) - .5) * 30;
    if (trunkOK(x, y, placed)) plant('tree-apple', x, y, 'commons', .82);
  }
}
// 2) Groves of 3 to 7 beside paths, water and squares. Candidates on a grid are scored by what they stand beside; the best
//    are taken with room between groves, so a grove is always about something.
const cands = [];
const xs = coast.map(p => p[0]), ys = coast.map(p => p[1]);
const [X0, X1, Y0, Y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
for (let x = X0; x < X1; x += 110) for (let y = Y0; y < Y1; y += 110) {
  const jx = x + (hash(x, y, 7) - .5) * 80, jy = y + (hash(x, y, 8) - .5) * 80;
  if (!trunkOK(jx, jy, placed)) continue;
  const rd = roadEdgeDist(jx, jy), wd = waterDist(jx, jy), cd = coastDist(jx, jy);
  let s = 0;
  if (rd > 60 && rd < 330) s += 3 - Math.abs(rd - 170) / 90;
  if (wd > 60 && wd < 380) s += 2.6 - Math.abs(wd - 180) / 110;
  if (cd > 200 && cd < 520) s += .8;
  for (const c of E.communities ?? []) {const d = Math.hypot(jx - c.center[0], jy - c.center[1]); if (d > 380 && d < 760) s += 1.2;}
  for (const p of others) if (isBuilding(p) && p.y > jy + 150 && p.y - jy < 520 && Math.abs(p.x - jx) < 420) s += 1.4;   // behind a house
  s += hash(jx, jy, 9) * .8;
  if (s > .6) cands.push({x: jx, y: jy, s});
}
cands.sort((a, b) => b.s - a.s);
const groves = [];
const MIX = [['tree-1', 'tree-2', 'tree-1', 'tree-3'], ['tree-3', 'tree-4', 'tree-3'], ['tree-2', 'tree-5', 'tree-2', 'tree-1'], ['tree-5', 'tree-5', 'tree-4'], ['tree-1', 'tree-4', 'tree-2']];
let trees = out.filter(p => p.asset.startsWith('tree')).length;
for (const c of cands) {
  if (trees >= TARGET.trees) break;
  if (groves.some(g => Math.hypot(c.x - g.x, c.y - g.y) < 760)) continue;
  const n = 3 + Math.floor(hash(c.x, c.y, 11) * 5), mix = MIX[Math.floor(hash(c.x, c.y, 12) * MIX.length)], members = [];
  const lean = hash(c.x, c.y, 13) * Math.PI * 2;
  for (let i = 0, tries = 0; members.length < n && tries < 40; tries++, i++) {
    // a loose cluster: golden-angle spiral, squashed in depth so canopies overlap the way the centre's do
    const a = lean + i * 2.39996, rr = i ? 120 + 34 * Math.sqrt(i) + hash(c.x, i, 14) * 40 : 0;
    const x = c.x + Math.cos(a) * rr * 1.15, y = c.y + Math.sin(a) * rr * .72;
    if (!trunkOK(x, y, placed)) continue;
    members.push(plant(mix[members.length % mix.length], x, y, zoneAt(x, y), .92 + .16 * hash(x, y, 15)));
  }
  if (members.length < 3) {for (const m of members) {out.splice(out.indexOf(m), 1); placed.splice(placed.indexOf(m), 1);} continue;}
  trees += members.length;
  const g = {x: c.x, y: c.y, members}; groves.push(g);
  // one or two bushes and a flower clump at the grove's sunny (south) edge
  for (let k = 0; k < 1 + (members.length > 4); k++) {
    const a = Math.PI * (.25 + .5 * hash(c.x, k, 16)), x = c.x + Math.cos(a) * 260, y = c.y + Math.sin(a) * 150 + 40;
    if (ground(x, y, 50) && clearOfProps(x, y, 50)) plant(`bush-${1 + Math.floor(hash(x, y, 17) * 6)}`, x, y, zoneAt(x, y), .9);
  }
}
// 3) Yards: each home gets a bush on one side and a flower clump on the other, read from the homes lane's houses.
const homes = others.filter(p => p.communityRole === 'home' || /house|cottage|farmhouse|studio|townhouse/.test(p.asset ?? ''));
for (const [i, h] of homes.entries()) {
  const side = i % 2 ? 1 : -1, w = half(h);
  const bx = h.x + side * (w + 40), by = h.y + 10;
  if (ground(bx, by, 40, {road: 18}) && clearOfProps(bx, by, 36, placed.filter(p => p !== h))) plant(`bush-${1 + (i * 5) % 6}`, bx, by, h.zone ?? zoneAt(bx, by), .85);
  const fx = h.x - side * (w + 30), fy = h.y + 22;
  for (let k = 0; k < 3; k++) {const x = fx + (k - 1) * 22, y = fy + (k % 2) * 8; if (ground(x, y, 14, {road: 12}) && clearOfProps(x, y, 12, placed.filter(p => p !== h))) plant(`flower-${1 + (i + k) % 3}`, x, y, h.zone ?? zoneAt(x, y), .9);}
}
// 4) Loose bushes and flower clumps where lanes meet the lawn, up to the centre's bush rate.
let bushes = out.filter(p => p.asset.startsWith('bush')).length;
for (let i = 1; i < 40000 && bushes < TARGET.bushes; i++) {
  const x = X0 + halton(i, 2) * (X1 - X0), y = Y0 + halton(i, 3) * (Y1 - Y0), rd = roadEdgeDist(x, y);
  if (rd < 40 || rd > 150 || !ground(x, y, 50) || !clearOfProps(x, y, 60) || out.some(p => Math.hypot(p.x - x, p.y - y) < 420 && p.asset.startsWith('bush'))) continue;
  plant(`bush-${1 + Math.floor(halton(i, 5) * 6)}`, x, y, zoneAt(x, y), .85); bushes++;
  for (let k = 0; k < 3; k++) {const fx = x + 70 + k * 20, fy = y + 14 + (k % 2) * 8; if (ground(fx, fy, 12, {road: 10}) && clearOfProps(fx, fy, 10)) plant(`flower-${1 + (i + k) % 3}`, fx, fy, zoneAt(fx, fy), .9);}
}

// ---------- detail props kept from the commons, verges, coast walk and river banks ----------
// Kept where they still stand on open ground (the homes and shore lanes may have built over some); the old per-house flower
// pairs and lone verge bushes are replaced by the planting above.
// The picnic lawns get the furniture that makes them a place to stop: a bench and a lamp where the lane meets the green.
const extra = [];
const bench = assetLike('bench-wood'), lamp = assetLike('lamp-lantern');
function assetLike(name) {return E.props.find(p => p.asset === name) ?? null;}
for (const c of E.commons ?? []) {
  if (!bench) break;
  for (let k = 0; k < 8; k++) {
    const a = k * .785 + .3, x = c.point[0] + Math.cos(a) * 300, y = c.point[1] + Math.sin(a) * 200;
    if (!ground(x, y, 60, {road: 20}) || !clearOfProps(x, y, 70, [...placed, ...extra])) continue;
    extra.push({...bench, id: `ground-bench-${c.id}`, x: r3(x), y: r3(y), zone: 'commons', footprint: {x: r3(x), y: r3(y - 10), rx: 70, ry: 24}});
    break;
  }
}
placed.push(...extra);

// ---------- sleeping Duckies ----------
// Each pose in a spot that suits it: nod against a grove trunk, hammock and leaf on the shady grove lawn, book by a bench, a
// picnic table or a house side, chair on the beach facing the sea, rock beside a bush, wing and box on quiet lawn.
// The same rules as sleep-spots.js (same pose >= 900 apart, any two >= 300) so none is dropped on load.
const SIZES = sleepHalfWidths(.88 * .24 * 3);
import sleepExtra from '../../rive/web/home-sleep-extra.json' with {type: 'json'};
import {SLEEP_SPOTS} from '../../src/pixi/sleep-spots.js';
const base = Object.entries(SLEEP_SPOTS).flatMap(([pose, l]) => [...l, ...(sleepExtra[pose] ?? [])].filter(s => typeof s[0] === 'number').map(s => ({pose, x: s[0], y: s[1], r: SIZES[pose]})));
const beds = [];
const solid = [...placed, ...out].filter(p => !/lily|bunting|banner|boat/i.test(p.asset ?? p.name ?? ''));
function sleeperOK(x, y, pose, onTree = false) {
  const r = SIZES[pose];
  if (!onTree) {
  if (!ground(x, y, r * .8 + 20, {road: 40, coastPad: pose === 'chair' ? 30 : 60})) return false;
  for (const p of solid) {
    if (!Number.isFinite(p.x)) continue;
    const hw = half(p);
    if (Math.hypot(x - p.x, (y - p.y) * 1.6) < hw * (isBuilding(p) ? .35 : .8) + r + 30) return false;
    if (p.y > y - 30 && p.y - y < (p.height ?? 0) * (p.scale ?? 1) * .95 && Math.abs(x - p.x) < hw + r * .7) return false;
    if (isBuilding(p) && Math.abs(x - p.x) < hw + r + 20 && y > p.y - 40 && y < p.y + 200) return false;   // never on a doorstep
  }
  }
  for (const s of [...base, ...beds]) {
    if (Math.hypot(s.x - x, (s.y - y) * 1.3) < Math.max(330, s.r + r + 130)) return false;
    if (s.pose === pose && Math.hypot(s.x - x, s.y - y) < (pose === 'chair' ? 880 : 920)) return false;
  }
  return true;
}
function bed(pose, x, y, flip, tree) {beds.push({pose, x: r3(x), y: r3(y), r: SIZES[pose], flip, tree});}
const planTrees = out.filter(p => p.asset.startsWith('tree'));
// nod: one per grove, against its front tree's trunk (the bed point is in front of the trunk base, as sleep-spots.js puts it)
for (const g of groves) {
  const t = [...g.members].sort((a, b) => b.y - a.y)[0], x = t.x, y = t.y + 14;
  if (sleeperOK(x, y, 'nod', true) && roadEdgeDist(x, y) > 40) bed('nod', x, y, hash(x, y, 21) > .5, t.id);
}
const want = {hammock: .1, leaf: .12, book: .16, chair: .08, rock: .12, wing: .2, box: .22};
const goal = Math.max(0, TARGET.sleepers - beds.length);
const spots = {
  hammock: () => groves.flatMap(g => [[g.x - 230, g.y + 190], [g.x + 240, g.y + 170]]),
  leaf: () => groves.flatMap(g => [[g.x + 40, g.y + 260], [g.x - 300, g.y + 40]]),
  book: () => [...placed.filter(p => /bench|picnic|table|sign|library/.test(p.asset ?? '')).flatMap(p => [[p.x + 150, p.y + 60], [p.x - 150, p.y + 60], [p.x, p.y + 140]]),
    ...homes.flatMap(h => [[h.x + half(h) + 110, h.y - 30], [h.x - half(h) - 110, h.y - 30]])],
  chair: () => {const c = []; for (let i = 0; i < coast.length; i += 3) {const [x, y] = coast[i], n = coast[(i + 1) % coast.length], m = coast[(i + coast.length - 1) % coast.length], dx = n[0] - m[0], dy = n[1] - m[1], l = Math.hypot(dx, dy) || 1; for (const s of [1, -1]) {const px = x - dy / l * 115 * s, py = y + dx / l * 115 * s; if (onLand(px, py)) c.push([px, py, x > px]);}} return c;},
  rock: () => out.filter(p => p.asset.startsWith('bush')).flatMap(p => [[p.x + half(p) + 80, p.y + 20], [p.x - half(p) - 80, p.y + 20]]),
  wing: () => {const c = []; for (let i = 1; i < 3000; i++) c.push([X0 + halton(i, 2) * (X1 - X0), Y0 + halton(i, 3) * (Y1 - Y0)]); return c;},
  box: () => {const c = []; for (let i = 3001; i < 6000; i++) c.push([X0 + halton(i, 2) * (X1 - X0), Y0 + halton(i, 3) * (Y1 - Y0)]); return c;},
};
for (const [pose, share] of Object.entries(want)) {
  let n = 0; const quota = Math.round(goal * share);
  for (const [x, y, f] of spots[pose]()) {
    if (n >= quota) break;
    if (!sleeperOK(x, y, pose)) continue;
    bed(pose, x, y, f ?? hash(x, y, 22) > .5); n++;
  }
}
// top up with the lawn poses until the rate is reached: a dense even sweep of the land, taking whichever pose still has room
const lawn = []; for (let i = 1; i < 40000; i++) lawn.push([X0 + halton(i, 2) * (X1 - X0), Y0 + halton(i, 3) * (Y1 - Y0)]);
for (const [x, y] of lawn) {
  if (beds.length >= TARGET.sleepers) break;
  for (const pose of ['wing', 'box', 'leaf', 'book', 'rock', 'hammock']) if (sleeperOK(x, y, pose)) {bed(pose, x, y, hash(x, y, 23) > .5); break;}
}

// ---------- ground detail decals: the centre's own tufts, flowers and pebbles, by the centre's rule ----------
const H = 130, CELL = .6 * H, DECALS = {'grass-tuft-1': [44, 26], 'grass-tuft-2': [34, 22], 'grass-tuft-3': [56, 24], 'flower-dot-1': [20, 18], 'flower-dot-2': [26, 18],
  'flower-dot-3': [22, 16], 'pebble-1': [22, 14], 'pebble-2': [34, 16], 'pebble-3': [28, 18], 'sand-speck-1': [16, 8], 'sand-speck-2': [22, 10], 'edge-stone-1': [30, 18]};
const GRASS_KIT = ['grass-tuft-1', 'grass-tuft-2', 'grass-tuft-3', 'grass-tuft-1', 'grass-tuft-2', 'flower-dot-1', 'flower-dot-2', 'flower-dot-3', 'grass-tuft-3', 'pebble-2'];
const decals = [], dgrid = new Map(), dk = (x, y) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
const near = (x, y, d) => {const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const q of dgrid.get(`${gx + a},${gy + b}`) ?? []) if (Math.hypot(q[0] - x, q[1] - y) < d) return true; return false;};
const solidAll = [...placed, ...out];
const pgrid = new Map(); for (const p of solidAll) if (Number.isFinite(p.x) && !/flower/.test(p.asset ?? '')) {const k = `${Math.floor(p.x / 400)},${Math.floor(p.y / 400)}`; (pgrid.get(k) ?? pgrid.set(k, []).get(k)).push(p);}
const nearProp = (x, y) => {const gx = Math.floor(x / 400), gy = Math.floor(y / 400); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const p of pgrid.get(`${gx + a},${gy + b}`) ?? []) if (Math.hypot(x - p.x, (y - p.y) * 1.8) < half(p) * .42 + 20 && !(p.asset ?? '').startsWith('tree') || (p.asset ?? '').startsWith('tree') && Math.hypot(x - p.x, (y - p.y) * 1.8) < 40) return true; return false;};
function decal(kind, x, y, i) {const [w, h] = DECALS[kind]; decals.push({src: `/pixi-art/decals/${kind}.svg`, x: r3(x), y: r3(y), width: w * 1.5, height: h * 1.5, flip: halton(i, 11) > .5}); (dgrid.get(dk(x, y)) ?? dgrid.set(dk(x, y), []).get(dk(x, y))).push([x, y]);}
// a) path-edge stones and the odd pebble on the path, like the centre's lanes
let si = 0;
for (const r of roads) {
  const line = sample(r.points, 20);
  for (let i = 2; i < line.length - 2; i += 1) {
    const [x, y] = line[i], [ax, ay] = line[i - 1], [bx, by] = line[i + 1], l = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / l, ny = (bx - ax) / l;
    si++; if (hash(x, y, 31) > .2) continue;
    const side = hash(x, y, 32) > .5 ? 1 : -1, onPath = hash(x, y, 33) < .25, off = onPath ? r.W * (.12 + .2 * hash(x, y, 34)) : r.W / 2 + 14 + 20 * hash(x, y, 35);
    const px = x + nx * off * side, py = y + ny * off * side;
    if (!onLand(px, py) || inCentre(px, py, 30) || waterDist(px, py) < 20 || inDeck(px, py, 6) || onWalkway(px, py, 10) || near(px, py, 70) || nearProp(px, py)) continue;
    if (!onPath && roadEdgeDist(px, py) < 4) continue;
    decal(onPath ? (hash(x, y, 36) > .5 ? 'pebble-1' : 'pebble-2') : (hash(x, y, 36) > .35 ? 'edge-stone-1' : 'grass-tuft-2'), px, py, si);
  }
}
// b) grass detail on every lawn (the centre's decalsFor rule: one per ~cell, denser along paths and the shore)
for (let i = 1; i < 260000; i++) {
  const x = X0 + halton(i, 2) * (X1 - X0), y = Y0 + halton(i, 3) * (Y1 - Y0);
  if (!onLand(x, y) || inCentre(x, y, 40)) continue;
  const rd = roadEdgeDist(x, y); if (rd < 8) continue;
  const c = coastDist(x, y); if (c < 40) continue;
  const wd = waterDist(x, y); if (wd < 30) continue;
  if (inDeck(x, y, 10) || onWalkway(x, y, 30)) continue;
  const edge = rd < 110 || c < 260 || wd < 160, keep = halton(i, 5) < (edge ? .9 : .42);
  if (!keep || near(x, y, CELL) || nearProp(x, y)) continue;
  const sand = c < 95, pick = halton(i, 7), kit = sand ? ['sand-speck-1', 'sand-speck-2', 'sand-speck-1', 'pebble-1', 'pebble-3'] : GRASS_KIT;
  decal(kit[Math.floor(pick * kit.length)], x, y, i);
}

// ---------- the ground tiles ----------
// Flat lawn, the coast's foam and sand like the centre, rivers with sandy banks, and the lanes painted from `roads` as the
// centre paints its own: wide cream with a darker lower edge and a soft darker grass rim. No soft blobs, no seams.
let g = '';
const landPaths = [curve(coast.filter((_, i) => i % 2 === 0), true), ...(bay ? [poly(bay)] : [])];
for (const d of landPaths) g += `<path d="${d}" fill="none" stroke="${FOAM}" stroke-width="140" stroke-linejoin="round"/>`;
for (const d of landPaths) g += `<path d="${d}" fill="none" stroke="${SAND_DARK}" stroke-width="104" stroke-linejoin="round"/>`;
for (const d of landPaths) g += `<path d="${d}" fill="none" stroke="${SAND}" stroke-width="92" stroke-linejoin="round"/>`;
for (const d of landPaths) g += `<path d="${d}" fill="${GRASS}"/>`;
for (const d of landPaths) g += `<path d="${d}" fill="none" stroke="#7da52b" stroke-width="5" stroke-opacity=".55"/>`;
const roadD = roads.map(r => ({d: curve(r.points), W: r.W}));
g += `<g fill="none" stroke-linecap="round" stroke-linejoin="round">`;
for (const {d, W} of roadD) g += `<path d="${d}" stroke="#80a82c" stroke-width="${W + 22}" stroke-opacity=".5"/>`;
for (const {d, W} of roadD) g += `<path d="${d}" stroke="${SAND_DARK}" stroke-width="${W + 6}" transform="translate(0 4)"/>`;
for (const {d, W} of roadD) g += `<path d="${d}" stroke="${SAND}" stroke-width="${W}"/>`;
g += `</g>`;
// water: sand bank, a dark bank line, the water, a pale inner edge and a few ripples
const wpaths = waters.map(w => poly(w));
g += `<defs><clipPath id="land">${landPaths.map(d => `<path d="${d}"/>`).join('')}</clipPath></defs><g clip-path="url(#land)">`;   // rivers stop at the shore, never painted over the sea
for (const d of wpaths) g += `<path d="${d}" fill="none" stroke="${SAND}" stroke-width="58" stroke-linejoin="round"/>`;
for (const d of wpaths) g += `<path d="${d}" fill="${WATER}" stroke="${SAND_DARK}" stroke-width="10" stroke-linejoin="round"/>`;
for (const d of wpaths) g += `<path d="${d}" fill="none" stroke="#8fd7e6" stroke-width="5" stroke-linejoin="round" transform="translate(0 6)" clip-path="none"/>`;
for (const r of E.rivers ?? []) {const a = sample(r.points, 40); for (let i = 3; i < a.length - 3; i += 6) {const [x, y] = a[i]; g += `<path d="M${r3(x - 22)} ${r3(y)}q22 -10 44 0" fill="none" stroke="#c4ece9" stroke-width="5" stroke-linecap="round"/>`;}}
g += '</g>';
const tiles = E.tiles.map(t => {
  const name = `ground-${Math.round((t.y - E.origin.y) / t.height)}-${Math.round((t.x - E.origin.x) / t.width)}.svg`;
  writeFileSync(`${ART}/${name}`, `<svg xmlns="http://www.w3.org/2000/svg" width="${t.width}" height="${t.height}" viewBox="${r3(t.x)} ${r3(t.y)} ${t.width} ${t.height}">${g}</svg>`);
  return {...t, src: `${WEB}/${name}`, bleed: 3};
});

// ---------- the three river crossings: humpback footbridges like the centre's pond bridge ----------
function bridgeSVG(c, wk, r) {
  const horiz = Math.abs(wk.b[0] - wk.a[0]) > Math.abs(wk.b[1] - wk.a[1]), w = wk.w, k = t => 4 * t * (1 - t);
  const [xa, xb] = [Math.min(wk.a[0], wk.b[0]), Math.max(wk.a[0], wk.b[0])], [ya, yb] = [Math.min(wk.a[1], wk.b[1]), Math.max(wk.a[1], wk.b[1])];
  const cx = (xa + xb) / 2, cy = (ya + yb) / 2, post = 30, ink = (d, wid, col, extra = '') => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${wid + 4}" ${extra}/><path d="${d}" fill="none" stroke="${col}" stroke-width="${wid}" ${extra}/>`;
  let s = '', box;
  if (horiz) {
    box = [xa - 70, cy - w / 2 - r - post - 30, xb - xa + 140, w + r + post + 120];
    const N = 24, top = [], bot = [];
    for (let i = 0; i <= N; i++) {const t = i / N, x = xa + (xb - xa) * t; top.push([x, cy - w / 2 - r * k(t)]); bot.push([x, cy + w / 2 - r * k(t)]);}
    const fas = bot.map(([x, y]) => [x, y + 26]);
    s += `<ellipse cx="${cx}" cy="${cy + w / 2 + 24}" rx="${(xb - xa) * .5}" ry="22" fill="#4fa9c4" opacity=".55"/>`;
    s += `<path d="M${xa + 30},${cy + w / 2 + 26} ${fas.slice(2, -2).map(p => p.map(r3).join(',')).join(' ')} L${xb - 30},${cy + w / 2 + 26}Z" fill="#3f8ea6" stroke="${INK}" stroke-width="3"/>`;   // the arch's shade over the water
    for (const x of [xa - 46, xb + 4]) s += `<path d="M${x},${cy - w / 2 - 8}h42v${w + 40}h-42Z" fill="#e9ddb0" stroke="${INK}" stroke-width="4"/><path d="M${x},${cy}h42 M${x + 21},${cy - w / 2 - 8}v${w / 2 + 8} M${x + 12},${cy}v${w / 2 + 32}" stroke="#c9b98a" stroke-width="3"/>`;
    s += `<path d="${'M' + [...bot, ...[...fas].reverse()].map(p => p.map(r3).join(',')).join('L')}Z" fill="#b5773a" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
    s += `<path d="${'M' + [...top, ...[...bot].reverse()].map(p => p.map(r3).join(',')).join('L')}Z" fill="#e5ae63" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
    for (let i = 1; i < N * 2; i++) {const t = i / (N * 2), x = xa + (xb - xa) * t, l = r * k(t); s += `<path d="M${r3(x)},${r3(cy - w / 2 - l + 3)}V${r3(cy + w / 2 - l - 3)}" stroke="#c88941" stroke-width="3"/>`;}
    s += `<path d="${'M' + top.slice(0, 13).map(p => p.map(r3).join(',')).join('L')}" fill="none" stroke="#f3c983" stroke-width="5" opacity=".7" transform="translate(0 6)"/>`;
    for (const edge of [top, bot]) {
      const rail = edge.map(([x, y]) => [x, y - post]);
      for (let i = 0; i <= N; i += 4) s += ink(`M${r3(edge[i][0])},${r3(edge[i][1] + 2)}V${r3(rail[i][1])}`, 7, '#885931', 'stroke-linecap="round"');
      s += ink('M' + rail.map(p => p.map(r3).join(',')).join('L'), 7, '#c88941', 'stroke-linecap="round" stroke-linejoin="round"');
    }
  } else {
    box = [cx - w / 2 - 50, ya - r - post - 60, w + 100, yb - ya + r + post + 130];
    const N = 24, s0 = t => ya + (yb - ya) * t - r * k(t), L = cx - w / 2, R = cx + w / 2;
    s += `<path d="M${L - 10},${ya + 40}H${R + 26}V${yb - 30}H${L - 10}Z" fill="#4fa9c4" opacity=".5"/>`;
    for (const y of [ya - 40, yb - 6]) s += `<path d="M${L - 12},${y}h${w + 24}v46h-${w + 24}Z" fill="#e9ddb0" stroke="${INK}" stroke-width="4"/><path d="M${cx},${y}v46 M${L - 12},${y + 23}h${w + 24}" stroke="#c9b98a" stroke-width="3"/>`;
    const left = [], right = [];
    for (let i = 0; i <= N; i++) {const t = i / N; left.push([L, s0(t)]); right.push([R, s0(t)]);}
    s += `<path d="M${R},${s0(0)}${right.map(p => `L${p[0] + 12},${r3(p[1] + 14)}`).join('')}L${R},${yb}Z" fill="#b5773a" stroke="${INK}" stroke-width="4"/>`;   // the east face of the arch
    s += `<path d="${'M' + [...left, ...[...right].reverse()].map(p => p.map(r3).join(',')).join('L')}Z" fill="#e5ae63" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
    s += `<path d="M${L},${s0(0)}${left.slice(0, 13).map(p => `L${p[0]},${r3(p[1])}`).join('')}L${R},${r3(s0(.5))}L${R},${s0(0)}Z" fill="#d39a55"/>`;   // far ramp faces away: a shade darker
    for (let i = 1; i < N * 1.5; i++) {const y = s0(i / (N * 1.5)); s += `<path d="M${L + 3},${r3(y)}H${R - 3}" stroke="#c88941" stroke-width="3"/>`;}
    for (const x of [L, R]) {
      const pts = left.map(([, y]) => [x, y]);
      for (let i = 0; i <= N; i += 4) s += ink(`M${x},${r3(pts[i][1])}v-${post}`, 7, '#885931', 'stroke-linecap="round"');
      s += ink('M' + pts.map(([px, py]) => `${px},${r3(py - post)}`).join('L'), 7, '#c88941', 'stroke-linecap="round" stroke-linejoin="round"');
    }
  }
  return {box, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${r3(box[2])}" height="${r3(box[3])}" viewBox="${box.map(r3).join(' ')}" stroke-linecap="round" stroke-linejoin="round">${s}</svg>`};
}
const newDecks = E.decks.map(d => {
  if (!String(d.id ?? '').startsWith('river-crossing-')) return d;
  const c = (E.crossings ?? []).find(c => c.id === d.id), wk = walkways.find(v => Math.abs((v.a[0] + v.b[0]) / 2 - (d.x + d.width / 2)) < 2 && Math.abs((v.a[1] + v.b[1]) / 2 - (d.y + d.height / 2)) < 2)
    ?? (E.arches ?? []).find(v => Math.abs((v.a[0] + v.b[0]) / 2 - (d.x + d.width / 2)) < 40);
  const arch = (E.arches ?? []).find(v => wk && Math.abs(v.a[0] - wk.a[0]) < 1 && Math.abs(v.a[1] - wk.a[1]) < 1);
  if (!wk) return d;
  const {box, svg} = bridgeSVG(c, wk, arch?.r ?? 48);
  writeFileSync(`${ART}/${d.id}.svg`, svg);
  return {id: d.id, src: `${WEB}/${d.id}.svg`, x: r3(box[0]), y: r3(box[1]), width: r3(box[2]), height: r3(box[3]), resolution: 1.5};
});

// ---------- write back only the owned keys ----------
const sleepers = {};
for (const b of beds) (sleepers[b.pose] ??= []).push(b.pose === 'nod' ? [b.tree, 0, b.flip] : [b.x, b.y, b.flip]);
const write = s => {
  const props = [...others, ...detail, ...extra, ...out];
  // keep the other lanes' prop order: theirs first, then the ground lane's
  const next = {...E, tiles, decks: newDecks, props, groundDecals: decals, sleepers: s};
  writeFileSync(FILE, JSON.stringify(next, null, 2) + '\n');
};
write(sleepers);
// The game resolves beds with the full walking map (trees' trunks, every footprint): drop any it would reject, then rebuild the
// socket server's walking map from the final placements and sleepers.
const report = JSON.parse(execFileSync('node', ['scripts/home-10/ground-check.mjs'], {encoding: 'utf8', maxBuffer: 1 << 26}).trim().split('\n').at(-1));
if (report.dropped.length) {
  const bad = new Set(report.dropped.map(b => `${b.pose}|${Math.round(b.x)}|${Math.round(b.y)}`));
  for (const pose of Object.keys(sleepers)) sleepers[pose] = sleepers[pose].filter(s => {
    const t = typeof s[0] === 'string' ? out.find(p => p.id === s[0]) : null, x = t ? t.x : s[0], y = t ? t.y + 14 : s[1];
    return !bad.has(`${pose}|${Math.round(x)}|${Math.round(y)}`);
  });
  write(sleepers);
}
execFileSync('node', ['scripts/walk-world.mjs'], {stdio: 'inherit'});
const count = Object.values(sleepers).reduce((s, l) => s + l.length, 0), treesOut = out.filter(p => p.asset.startsWith('tree'));
const inGroves = new Set(groves.flatMap(g => g.members.map(m => m.id)));
console.log(JSON.stringify(Object.fromEntries(Object.entries(sleepers).map(([k, l]) => [k, l.length]))));
console.log(JSON.stringify({landAreaM: +(landArea / 1e6).toFixed(1), trees: treesOut.length, treesPerM: +(treesOut.length / landArea * 1e6).toFixed(2),
  groves: groves.length, inGrovesPct: Math.round(100 * treesOut.filter(t => inGroves.has(t.id) || t.asset === 'tree-apple').length / treesOut.length),
  bushes: out.filter(p => p.asset.startsWith('bush')).length, flowers: out.filter(p => p.asset.startsWith('flower')).length,
  sleepers: count, sleepersPerM: +(count / landArea * 1e6).toFixed(2), droppedOnLoad: report.dropped.length, decals: decals.length,
  detailKept: detail.length, benches: extra.length, tiles: tiles.length, bay: Boolean(bay)}));
