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
const roads = (E.roads ?? []).filter(r => r.points).map(r => ({...r, line: sample(r.points, 24), W: roadWidth(r)}));
// boss 8 Nov: a hamlet's square and lane are polygons off GPT's blueprint, painted in the same cream as every lane
const polyRoads = (E.roads ?? []).filter(r => r.poly), frames = Object.values(E.hamletFrames ?? {});
const inFrame = (x, y) => frames.some(f => x > f[0] && x < f[2] && y > f[1] && y < f[3]);
// spatial hash of road samples for fast distance
const GRID = 200, roadCells = new Map();
for (const r of roads) for (let i = 0; i < r.line.length - 1; i++) {
  const a = r.line[i], b = r.line[i + 1], k = `${Math.floor(a[0] / GRID)},${Math.floor(a[1] / GRID)}`;
  (roadCells.get(k) ?? roadCells.set(k, []).get(k)).push([a, b, r.W]);
}
function roadEdgeDist(x, y) {   // distance from the painted path's edge (negative on the path)
  let d = Infinity; const gx = Math.floor(x / GRID), gy = Math.floor(y / GRID);
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (const [a, b, W] of roadCells.get(`${gx + i},${gy + j}`) ?? []) d = Math.min(d, segDist(x, y, a, b) - W / 2);
  for (const r of polyRoads) if (inPoly(x, y, r.poly)) return -1; else if (Math.abs(x - r.poly[0][0]) < 3000) d = Math.min(d, polyDist(x, y, r.poly));
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
const GRASS_KIT = ['grass-tuft-1', 'grass-tuft-2', 'grass-tuft-3', 'grass-tuft-1', 'grass-tuft-2', 'flower-dot-1', 'flower-dot-2', 'flower-dot-3', 'grass-tuft-3', 'pebble-2'];
const decals = [], dgrid = new Map(), dk = (x, y) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
const near = (x, y, d) => {const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const q of dgrid.get(`${gx + a},${gy + b}`) ?? []) if (Math.hypot(q[0] - x, q[1] - y) < d) return true; return false;};
const solidAll = placed;
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
  if (!onLand(x, y) || inCentre(x, y, 40) || inFrame(x, y)) continue;   // a hamlet carries GPT's own tufts and pebbles
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
const landPaths = [curve(coast.filter((_, i) => i % 2 === 0), true)];
for (const d of landPaths) g += `<path d="${d}" fill="none" stroke="${FOAM}" stroke-width="140" stroke-linejoin="round"/>`;
for (const d of landPaths) g += `<path d="${d}" fill="none" stroke="${SAND_DARK}" stroke-width="104" stroke-linejoin="round"/>`;
for (const d of landPaths) g += `<path d="${d}" fill="none" stroke="${SAND}" stroke-width="92" stroke-linejoin="round"/>`;
for (const d of landPaths) g += `<path d="${d}" fill="${GRASS}"/>`;
for (const d of landPaths) g += `<path d="${d}" fill="none" stroke="#7da52b" stroke-width="5" stroke-opacity=".55"/>`;
const roadD = roads.map(r => ({d: curve(r.points), W: r.W})), polyD = polyRoads.map(r => curve(r.poly.filter((_, i) => i % 2 === 0 || r.poly.length < 40), true));
g += `<g fill="none" stroke-linecap="round" stroke-linejoin="round">`;
for (const {d, W} of roadD) g += `<path d="${d}" stroke="#80a82c" stroke-width="${W + 22}" stroke-opacity=".5"/>`;
for (const d of polyD) g += `<path d="${d}" fill="#80a82c" fill-opacity=".5" stroke="#80a82c" stroke-width="22" stroke-opacity=".5"/>`;
for (const {d, W} of roadD) g += `<path d="${d}" stroke="${SAND_DARK}" stroke-width="${W + 6}" transform="translate(0 4)"/>`;
for (const d of polyD) g += `<path d="${d}" fill="${SAND_DARK}" stroke="${SAND_DARK}" stroke-width="6" transform="translate(0 4)"/>`;
for (const {d, W} of roadD) g += `<path d="${d}" stroke="${SAND}" stroke-width="${W}"/>`;
for (const d of polyD) g += `<path d="${d}" fill="${SAND}" stroke="none"/>`;
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

// ---------- write back only the owned keys ----------
const {sleepers: _drop, ...keep} = E;   // the scripted sleepers are gone (boss 8 Nov)
writeFileSync(FILE, JSON.stringify({...keep, tiles, decks: newDecks, groundDecals: [...decals, ...(E.hamletDecals ?? []).map(({hamlet, ...d}) => d)]}, null, 2) + '\n');
execFileSync('node', ['scripts/walk-world.mjs'], {stdio: 'inherit'});
console.log(JSON.stringify({decals: decals.length, tiles: tiles.length, shore: Boolean(S), coastPoints: coast.length}));
