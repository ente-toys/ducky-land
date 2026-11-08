// Home 10, ground lane. Idempotent: reads src/pixi/home-expansion.json as the shore and homes lanes left it, rewrites only the
// ground lane's entries, and writes it back. Run from the repo root:  node scripts/home-10/ground.mjs
//
// Owns: tiles (48 ground tiles, repainted under public/pixi-art/home-expansion-g/), groundDecals (grass tufts, pebbles, small
// flowers and path-edge stones, the same decal art as the original centre: the one scripted layer the boss allows), and the
// three river-crossing decks' art. Trees, bushes, flowers and sleepers are NOT scripted (boss 8 Nov): every prop is left
// exactly as the other lanes and int-big have it. Reads at run time and never writes: coast, riverWater, rivers, roads, decks
// (other than river-crossing-*), walkways, props. The shore lane's new coast (the old harbour inlet filled in as land, a new
// east beach at x 7492-7625) and its Millrill ponds are read from shore.json and painted even before shore.mjs has run.
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {inPoly} from '../../rive/web/island-geometry.mjs';
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
// The shore lane's hand-written coast and ponds: applied here to a copy for painting, if shore.mjs has not run yet.
const SHORE = ['scripts/home-10/shore.json', '../ducky-home-shore/scripts/home-10/shore.json'].find(existsSync);
const S = SHORE ? JSON.parse(readFileSync(SHORE, 'utf8')) : null;
const same = (p, q) => Math.round(p[0]) === q[0] && Math.round(p[1]) === q[1];   // as shore.mjs matches its anchors
const coast = E.coast.map(p => [...p]);
if (S && !coast.some(p => same(p, S.coast.points[0]))) {
  const i = coast.findIndex(p => same(p, S.coast.after)), j = coast.findIndex(p => same(p, S.coast.before));
  if (i >= 0 && j > i) coast.splice(i + 1, j - i - 1, ...S.coast.points);
}
const riverWater = (E.riverWater ?? []).map(w => (S?.riverWater.set ?? []).find(s => s.id === w.id) ?? w);
for (const s of S?.riverWater.set ?? []) if (!riverWater.some(w => w.id === s.id)) riverWater.push(s);
// boss 8 Nov: the canal's square end cut a sand notch into the fork where Clover Run leaves it; this hand-drawn patch makes the
// fork one body of water, its outer edge curving from the canal's north bank into Clover Run's east bank
const FORK = {id: 'fork-canal-clover', x: 3700, y: 3620, rx: 1, ry: 1, poly: [[3680, 3560], [3712, 3572], [3722, 3610], [3718, 3650], [3708, 3675], [3660, 3690], [3640, 3640]]};
if (!riverWater.some(w => w.id === FORK.id)) riverWater.push(FORK);
const onLand = (x, y) => inPoly(x, y, coast);
const seaSegs = coast.map((a, i) => [a, coast[(i + 1) % coast.length]]);
const seaCells = new Map();
for (const sg of seaSegs) {const [a, b] = sg; for (let t = 0; t <= 1; t += .25) {const k = `${Math.floor((a[0] + (b[0] - a[0]) * t) / 400)},${Math.floor((a[1] + (b[1] - a[1]) * t) / 400)}`; const l = seaCells.get(k) ?? seaCells.set(k, new Set()).get(k); l.add(sg);}}

const coastDist = (x, y) => {
  const gx = Math.floor(x / 400), gy = Math.floor(y / 400); let d = Infinity;
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (const [a, b] of seaCells.get(`${gx + i},${gy + j}`) ?? []) d = Math.min(d, segDist(x, y, a, b));
  return Math.min(d, 800);
};
const inCentre = (x, y, pad = 0) => inPoly(x, y, centre) || (pad > 0 && polyDist(x, y, centre) < pad);
const waters = [...riverWater.map(w => w.poly), E.water?.poly].filter(Boolean);
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

const half = p => (p.width ?? 0) * (p.scale ?? 1) / 2;
const placed = E.props;   // every prop stays exactly as the other lanes left it
// the orchard apple art, outlined in the one ink (art only; no tree is placed by this script)
writeFileSync('public/pixi-art/plants/tree-apple.svg', readFileSync('public/pixi-art/home-expansion-c/apple-tree-1589.svg', 'utf8').replace(/#8b4b32/gi, INK).replace(/#885931/gi, INK));
const xs = coast.map(p => p[0]), ys = coast.map(p => p[1]);
const [X0, X1, Y0, Y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];

// ---------- ground detail decals: the centre's own tufts, flowers and pebbles, by the centre's rule ----------
const H = 130, CELL = .6 * H, DECALS = {'grass-tuft-1': [44, 26], 'grass-tuft-2': [34, 22], 'grass-tuft-3': [56, 24], 'flower-dot-1': [20, 18], 'flower-dot-2': [26, 18],
  'flower-dot-3': [22, 16], 'pebble-1': [22, 14], 'pebble-2': [34, 16], 'pebble-3': [28, 18], 'sand-speck-1': [16, 8], 'sand-speck-2': [22, 10], 'edge-stone-1': [30, 18]};
const EDGE_KIT = ['grass-tuft-1', 'grass-tuft-3', 'flower-dot-2', 'grass-tuft-2', 'pebble-1', 'flower-dot-1', 'grass-tuft-3', 'pebble-3', 'flower-dot-3', 'pebble-2', 'grass-tuft-1', 'flower-dot-2'];
const LAWN_KIT = ['grass-tuft-2', 'flower-dot-1', 'grass-tuft-1', 'flower-dot-3', 'pebble-1', 'grass-tuft-3', 'flower-dot-2'];
const decals = [], dgrid = new Map(), dk = (x, y) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
const near = (x, y, d) => {const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const q of dgrid.get(`${gx + a},${gy + b}`) ?? []) if (Math.hypot(q[0] - x, q[1] - y) < d) return true; return false;};
const solidAll = placed;
const pgrid = new Map(); for (const p of solidAll) if (Number.isFinite(p.x) && !/flower/.test(p.asset ?? '')) {const k = `${Math.floor(p.x / 400)},${Math.floor(p.y / 400)}`; (pgrid.get(k) ?? pgrid.set(k, []).get(k)).push(p);}
const nearProp = (x, y) => {const gx = Math.floor(x / 400), gy = Math.floor(y / 400); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const p of pgrid.get(`${gx + a},${gy + b}`) ?? []) if (Math.hypot(x - p.x, (y - p.y) * 1.8) < half(p) * .42 + 20 && !(p.asset ?? '').startsWith('tree') || (p.asset ?? '').startsWith('tree') && Math.hypot(x - p.x, (y - p.y) * 1.8) < 40) return true; return false;};
const trees = placed.filter(p => Number.isFinite(p.x) && /^(tree|apple-tree)/.test(p.asset ?? ''));
const nearTree = (x, y) => trees.some(t => Math.abs(t.x - x) < 230 && Math.abs(t.y - y) < 170);
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
  // boss 8 Nov: the centre's lawn is plain green with SPARSE tufts; detail gathers at path edges, water, the shore and tree clumps
  const edge = rd < 110 || c < 260 || wd < 160 || nearTree(x, y), keep = halton(i, 5) < (edge ? .85 : .035);
  if (!keep || near(x, y, edge ? CELL : CELL * 2) || nearProp(x, y)) continue;
  const sand = c < 95, pick = halton(i, 7), kit = sand ? ['sand-speck-1', 'sand-speck-2', 'sand-speck-1', 'pebble-1', 'pebble-3'] : edge ? EDGE_KIT : LAWN_KIT;
  decal(kit[Math.floor(pick * kit.length)], x, y, i);
}

// ---------- the ground tiles ----------
// Flat lawn, the coast's foam and sand like the centre, rivers with sandy banks, and the lanes painted from `roads` as the
// centre paints its own: wide cream with a darker lower edge and a soft darker grass rim. No soft blobs, no seams.
let g = '';
const landPaths = [curve(coast.filter((_, i) => i % 2 === 0), true)];
for (const d of landPaths) g += `<path d="${d}" fill="none" stroke="${FOAM}" stroke-width="140" stroke-linejoin="round"/>`;
for (const d of landPaths) g += `<path d="${d}" fill="none" stroke="${SAND_DARK}" stroke-width="104" stroke-linejoin="round"/>`;
for (const d of landPaths) g += `<path d="${d}" fill="none" stroke="${SAND}" stroke-width="92" stroke-linejoin="round"/>`;
for (const d of landPaths) g += `<path d="${d}" fill="${GRASS}"/>`;
for (const d of landPaths) g += `<path d="${d}" fill="none" stroke="#7da52b" stroke-width="5" stroke-opacity=".55"/>`;
const roadD = roads.map(r => ({d: curve(r.points), W: r.W, lane: String(r.id ?? '').startsWith('homes-')}));
g += `<g fill="none" stroke-linecap="round" stroke-linejoin="round">`;
for (const {d, W, lane} of roadD) if (lane) g += `<path d="${d}" stroke="#80a82c" stroke-width="${W + 22}" stroke-opacity=".5"/>`;   // boss 8 Nov: the main paths carry no green rim, like the centre's
for (const {d, W} of roadD) g += `<path d="${d}" stroke="${SAND_DARK}" stroke-width="${W + 6}" transform="translate(0 4)"/>`;
for (const {d, W} of roadD) g += `<path d="${d}" stroke="${SAND}" stroke-width="${W}"/>`;
g += `</g>`;
// water: every river and pond is ONE body (boss 8 Nov). All banks are painted first, then every water fill over them, so where two
// bodies meet the water of one covers the other's bank and no stripe runs across the join. Shapes are smooth curves, never facets.
const wpaths = waters.map(w => curve(w, true));
g += `<defs><clipPath id="land">${landPaths.map(d => `<path d="${d}"/>`).join('')}</clipPath>`;
wpaths.forEach((d, i) => {g += `<mask id="wm${i}" maskUnits="userSpaceOnUse" x="${X0 - 400}" y="${Y0 - 400}" width="${X1 - X0 + 800}" height="${Y1 - Y0 + 800}"><rect x="${X0 - 400}" y="${Y0 - 400}" width="${X1 - X0 + 800}" height="${Y1 - Y0 + 800}" fill="#fff"/>${wpaths.filter((_, j) => j !== i).map(o => `<path d="${o}" fill="#000"/>`).join('')}</mask>`;});
g += `</defs><g clip-path="url(#land)">`;   // rivers stop at the shore, never painted over the sea
for (const d of wpaths) g += `<path d="${d}" fill="none" stroke="${SAND}" stroke-width="58" stroke-linejoin="round"/>`;
for (const d of wpaths) g += `<path d="${d}" fill="none" stroke="${SAND_DARK}" stroke-width="10" stroke-linejoin="round"/>`;
for (const d of wpaths) g += `<path d="${d}" fill="${WATER}"/>`;
wpaths.forEach((d, i) => {g += `<path d="${d}" fill="none" stroke="#8fd7e6" stroke-width="5" stroke-linejoin="round" transform="translate(0 6)" mask="url(#wm${i})"/>`;});   // the pale inner edge, never across another body
for (const r of E.rivers ?? []) {const a = sample(r.points, 40); for (let i = 3; i < a.length - 3; i += 6) {const [x, y] = a[i]; g += `<path d="M${r3(x - 22)} ${r3(y)}q22 -10 44 0" fill="none" stroke="#c4ece9" stroke-width="5" stroke-linecap="round"/>`;}}
// the two Millrill ponds: a few ripples and lily pads, placed by hand
for (const [x, y] of [[6040, 1850], [6170, 1820], [6120, 1960], [6200, 960], [6300, 1040]]) g += `<path d="M${x - 22} ${y}q22 -10 44 0" fill="none" stroke="#c4ece9" stroke-width="5" stroke-linecap="round"/>`;
for (const [x, y, k] of [[6235, 1900, 1], [6262, 1868, .7], [5990, 1990, .8], [6330, 990, 1], [6150, 1060, .8]]) g += `<g transform="translate(${x} ${y}) scale(${k})"><path d="M0 0L13 -6A17 11 0 1 0 15 3Z" fill="#8cc63f" stroke="${INK}" stroke-width="3"/></g>`;
g += '</g>';
const tiles = E.tiles.map(t => {
  const name = `ground-${Math.round((t.y - E.origin.y) / t.height)}-${Math.round((t.x - E.origin.x) / t.width)}.svg`;
  writeFileSync(`${ART}/${name}`, `<svg xmlns="http://www.w3.org/2000/svg" width="${t.width}" height="${t.height}" viewBox="${r3(t.x)} ${r3(t.y)} ${t.width} ${t.height}">${g}</svg>`);
  return {...t, src: `${WEB}/${name}`, bleed: 3};
});

// ---------- the river crossings: ONE arched footbridge per crossing, in the centre's bridge colours (boss 8 Nov) ----------
// Hand-picked: a and b are the deck's two landings (on dry bank, past the water), r the hump, w the walk width. The deck lies
// flat across its river along the path, rising r at mid-span; a near-vertical bridge also leans its hump sideways (the high
// oblique view), so it reads as an arch and never as a plank board. 5 and 6 replace the centre's two straight jetty pieces
// (placements.js JETTIES 1 and 3), whose walk arches stay in placements.js ARCHES.
const BRIDGES = [
  {id: 'river-crossing-1', river: 'clover-run', a: [2950, 5497], b: [3245, 5497], r: 48, w: 100},     // quay-pier lane, water x 3026-3169
  {id: 'river-crossing-2', river: 'clover-run', a: [3729, 4478], b: [3487, 4350], r: 44, w: 100},     // village loop, water 3674,4449 - 3540,4378
  {id: 'river-crossing-3', river: 'mill-stream', a: [5350, 1420], b: [5600, 1420], r: 48, w: 100},    // village loop, water x 5409-5537
  {id: 'river-crossing-4', river: 'mill-stream', a: [5733, 1805], b: [5772, 2070], r: 48, w: 100},    // village loop by Millrill Pond, water y 1867-2010
  {id: 'river-crossing-5', river: 'old-shore-canal', a: [3320, 3319], b: [3320, 3770], r: 70, w: 115, centre: true},   // was jetty 1, water y 3402-3734
  {id: 'river-crossing-6', river: 'old-shore-canal', a: [2320.86, 3264.02], b: [2288.93, 3859.97], r: 70, w: 84, centre: true},   // was jetty 3, water y 3449-3748
];
function archBridge({a, b, r}) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  let n = [-u[1], u[0]]; if (n[1] < 0 || (n[1] === 0 && n[0] < 0)) n = [-n[0], -n[1]];   // +n faces the camera (south, else east)
  const shear = .9 * Math.abs(u[1]), wd = Math.abs(u[1]) > .6 ? 84 : 72, th = 16, post = 30, N = Math.max(12, Math.round(L / 13));
  const vis = n[0] * shear - n[1] < 0 ? 1 : -1;   // the side whose edge the camera sees (south, or on a steep bridge the side the hump leans from)
  const z = t => r * 4 * t * (1 - t), at = (t, side, h = 0) => {const x = a[0] + u[0] * L * t + n[0] * side * wd / 2, y = a[1] + u[1] * L * t + n[1] * side * wd / 2, zz = z(t) + h; return [x + shear * z(t), y - zz];};   // posts and rails stand straight up; only the hump leans
  const ts = Array.from({length: N + 1}, (_, i) => i / N), P = pts => pts.map(p => p.map(r3).join(',')).join('L');
  const far = ts.map(t => at(t, -vis)), near = ts.map(t => at(t, vis)), nearLow = ts.map(t => at(t, vis, -th));
  const ink = (d, wid, col) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${wid + 4}"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${wid}"/>`;
  const rail = edge => {let o = ''; const tops = ts.map((t, i) => [edge[i][0], edge[i][1] - post]);
    for (let i = 0; i <= N; i += Math.max(1, Math.round(N / 6))) o += ink(`M${edge[i].map(r3)}L${tops[i].map(r3)}`, 6, '#885931');
    o += ink(`M${P(tops)}`, 7, '#c88941'); return o;};
  let s = '';
  // the deck's shade on the water, straight below it
  const sh = ts.map(t => [a[0] + u[0] * L * t, a[1] + u[1] * L * t, 4 * t * (1 - t) * wd / 2]), shL = sh.map(p => [p[0] - n[0] * p[2], p[1] - n[1] * p[2] + 10]), shR = sh.map(p => [p[0] + n[0] * p[2], p[1] + n[1] * p[2] + 10]);   // tapered to the landings, so it lies on the water
  s += `<path d="M${P(shL.slice(2, -2))}L${P([...shR.slice(2, -2)].reverse())}Z" fill="${INK}" fill-opacity=".14"/>`;
  s += rail(far);   // the far rail, behind the deck
  s += `<path d="M${P(near)}L${P([...nearLow].reverse())}Z" fill="#885931" stroke="${INK}" stroke-width="4"/>`;   // the edge the camera sees
  s += `<path d="M${P(far)}L${P([...near].reverse())}Z" fill="#c88941" stroke="${INK}" stroke-width="4"/>`;   // the deck
  for (let i = 1; i < N; i++) s += `<path d="M${far[i].map(r3)}L${near[i].map(r3)}" stroke="${INK}" stroke-width="1.6" stroke-opacity=".55"/>`;   // planks
  s += `<path d="M${P(far.slice(0, Math.ceil(N / 2)).map(p => [p[0], p[1] + 6]))}" fill="none" stroke="#e5ae63" stroke-width="4" opacity=".7"/>`;   // the light on the rising half
  s += rail(near);   // the near rail, over the deck
  const all = [...far, ...near, ...nearLow, ...shL, ...shR].flatMap(p => [p, [p[0], p[1] - post]]);
  const xs = all.map(p => p[0]), ys = all.map(p => p[1]), box = [Math.min(...xs) - 12, Math.min(...ys) - 12, Math.max(...xs) - Math.min(...xs) + 24, Math.max(...ys) - Math.min(...ys) + 24];
  return {box, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${r3(box[2])}" height="${r3(box[3])}" viewBox="${box.map(r3).join(' ')}" stroke-linecap="round" stroke-linejoin="round">${s}</svg>`};
}
const POND_OVERLAYS = new Set(['shore-millrill-pond', 'shore-millhead-pond']);   // painted here with the rivers now (shore.json decks note)
const newDecks = E.decks.filter(d => !String(d.id ?? '').startsWith('river-crossing-') && !POND_OVERLAYS.has(d.id));
for (const br of BRIDGES) {
  const {box, svg} = archBridge(br);
  writeFileSync(`${ART}/${br.id}.svg`, svg);
  newDecks.push({id: br.id, src: `${WEB}/${br.id}.svg`, x: r3(box[0]), y: r3(box[1]), width: r3(box[2]), height: r3(box[3]), resolution: 1.5});
}
// the walk data for the expansion's own bridges: arches (Duckies rise over them), walkways and the water cut-outs
const own = BRIDGES.filter(br => !br.centre), sameSeg = (v, q) => Math.hypot(v.a[0] - q.a[0], v.a[1] - q.a[1]) < 2 && Math.hypot(v.b[0] - q.b[0], v.b[1] - q.b[1]) < 2;
const oldArches = E.arches ?? [];
const arches = own.map(({a, b, r, w}) => ({a, b, w, r}));
const walkwaysOut = walkways.filter(v => !oldArches.some(q => sameSeg(v, q)) && !arches.some(q => sameSeg(v, q))).concat(arches.map(({a, b, w}) => ({a, b, w})));
const riverBridges = (E.riverBridges ?? []).filter(v => !String(v.id).startsWith('river-crossing-')).concat(own.map(({id, a, b, w}) => ({id,
  x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, w: Math.abs(b[0] - a[0]) + w * .9, h: Math.abs(b[1] - a[1]) + w * .9})));
const crossings = own.map(({id, river, a, b}) => ({id, river, x: (a[0] + b[0]) / 2 * .18 + 278, y: (a[1] + b[1]) / 2 * .18 + 204}));   // the plan frame (world * .18 + 278, 204), as the tests read it

// ---------- write back only the owned keys ----------
const {sleepers: _drop, ...keep} = E;   // the scripted sleepers are gone (boss 8 Nov)
writeFileSync(FILE, JSON.stringify({...keep, riverWater, tiles, decks: newDecks, arches, walkways: walkwaysOut, riverBridges, crossings, groundDecals: decals}, null, 2) + '\n');
execFileSync('node', ['scripts/walk-world.mjs'], {stdio: 'inherit'});
console.log(JSON.stringify({decals: decals.length, tiles: tiles.length, shore: Boolean(S), coastPoints: coast.length}));
