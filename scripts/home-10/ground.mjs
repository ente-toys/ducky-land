import {readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {inPoly} from '../../assets/world/island-geometry.mjs';
const FILE = 'src/pixi/home-expansion.json', ART = 'public/pixi-art/home-expansion-g', WEB = '/pixi-art/home-expansion-g';
const E = JSON.parse(readFileSync(FILE, 'utf8'));
mkdirSync(ART, {recursive: true});
const INK = '#39472d', GRASS = '#93b72f', SAND = '#fde48c', SAND_DARK = '#e4c567', CREAM = '#fff0c7', WATER = '#6ec9de', FOAM = '#97dce5';
const r3 = v => Math.round(v * 10) / 10;

const hash = (...n) => {let h = 2166136261; for (const v of n) {h ^= Math.round(v * 7) | 0; h = Math.imul(h, 16777619); h ^= h >>> 13;} return ((h >>> 0) % 1e6) / 1e6;};
const halton = (i, b) => {let f = 1, r = 0; for (; i > 0; i = Math.floor(i / b)) {f /= b; r += f * (i % b);} return r;};

const segDist = (x, y, a, b) => {const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);};
const polyDist = (x, y, p, closed = true) => {let d = Infinity; for (let i = 0; i < p.length - (closed ? 0 : 1); i++) d = Math.min(d, segDist(x, y, p[i], p[(i + 1) % p.length])); return d;};
const area = p => Math.abs(p.reduce((s, a, i) => {const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - a[1] * b[0];}, 0) / 2);
function sample(p, step = 18) {
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

const centre = JSON.parse(readFileSync('src/pixi/walk-shapes.json', 'utf8')).coast;
const SHORE = ['scripts/home-10/shore.json', '../ducky-home-shore/scripts/home-10/shore.json'].find(existsSync);
const S = SHORE ? JSON.parse(readFileSync(SHORE, 'utf8')) : null;
const same = (p, q) => Math.round(p[0]) === q[0] && Math.round(p[1]) === q[1];
const coast = E.coast.map(p => [...p]);
if (S && !coast.some(p => same(p, S.coast.points[0]))) {
  const i = coast.findIndex(p => same(p, S.coast.after)), j = coast.findIndex(p => same(p, S.coast.before));
  if (i >= 0 && j > i) coast.splice(i + 1, j - i - 1, ...S.coast.points);
}
const riverWater = (E.riverWater ?? []).map(w => (S?.riverWater.set ?? []).find(s => s.id === w.id) ?? w);
for (const s of S?.riverWater.set ?? []) if (!riverWater.some(w => w.id === s.id)) riverWater.push(s);
const FORK = {id: 'fork-canal-clover', x: 3700, y: 3620, rx: 1, ry: 1, poly: [[3680, 3556], [3728, 3566], [3766, 3598], [3788, 3648], [3790, 3700], [3784, 3748], [3776, 3786], [3740, 3770], [3690, 3730], [3628, 3705], [3622, 3640]]};
if (!riverWater.some(w => w.id === FORK.id)) riverWater.push(FORK);
const CORNER = {id: 'corner-canal-clover', x: 3580, y: 3790, rx: 1, ry: 1, poly: [[3520, 3770], [3560, 3772], [3600, 3760], [3615, 3800], [3632, 3840], [3640, 3858], [3610, 3864], [3578, 3856], [3550, 3830], [3530, 3805]]};
const ci = riverWater.findIndex(w => w.id === CORNER.id); if (ci >= 0) riverWater[ci] = CORNER; else riverWater.push(CORNER);
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
const polyRoads = (E.roads ?? []).filter(r => r.rings), frames = Object.values(E.hamletFrames ?? {});
const inFrame = (x, y) => frames.some(f => x > f[0] && x < f[2] && y > f[1] && y < f[3]);
const GRID = 200, roadCells = new Map();
for (const r of roads) for (let i = 0; i < r.line.length - 1; i++) {
  const a = r.line[i], b = r.line[i + 1], k = `${Math.floor(a[0] / GRID)},${Math.floor(a[1] / GRID)}`;
  (roadCells.get(k) ?? roadCells.set(k, []).get(k)).push([a, b, r.W]);
}
function roadEdgeDist(x, y) {
  let d = Infinity; const gx = Math.floor(x / GRID), gy = Math.floor(y / GRID);
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (const [a, b, W] of roadCells.get(`${gx + i},${gy + j}`) ?? []) d = Math.min(d, segDist(x, y, a, b) - W / 2);
  for (const r of polyRoads) if (Math.abs(x - r.rings[0][0][0]) < 3000) {if (r.rings.filter(q => inPoly(x, y, q)).length % 2) return -1; for (const q of r.rings) d = Math.min(d, polyDist(x, y, q));}
  return d;
}
const decks = (E.decks ?? []).filter(d => Number.isFinite(d.x));
const inDeck = (x, y, pad) => decks.some(d => x > d.x - pad && x < d.x + d.width + pad && y > d.y - pad && y < d.y + d.height + pad);
const walkways = E.walkways ?? [];
const onWalkway = (x, y, pad) => walkways.some(b => segDist(x, y, b.a, b.b) < b.w / 2 + pad);
const open = E.openSpaces ?? [], places = [...(E.places ?? []), ...(E.commons ?? []).map(c => ({id: c.id, point: c.point}))];

const half = p => (p.width ?? 0) * (p.scale ?? 1) / 2;
const placed = E.props;
const xs = coast.map(p => p[0]), ys = coast.map(p => p[1]);
const [X0, X1, Y0, Y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];

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
for (let i = 1; i < 260000; i++) {
  const x = X0 + halton(i, 2) * (X1 - X0), y = Y0 + halton(i, 3) * (Y1 - Y0);
  if (!onLand(x, y) || inCentre(x, y, 40) || inFrame(x, y)) continue;
  const rd = roadEdgeDist(x, y); if (rd < 8) continue;
  const c = coastDist(x, y); if (c < 40) continue;
  const wd = waterDist(x, y); if (wd < 30) continue;
  if (inDeck(x, y, 10) || onWalkway(x, y, 30)) continue;
  const edge = rd < 110 || c < 260 || wd < 160 || nearTree(x, y), keep = halton(i, 5) < (edge ? .85 : .035);
  if (!keep || near(x, y, edge ? CELL : CELL * 2) || nearProp(x, y)) continue;
  const sand = c < 95, pick = halton(i, 7), kit = sand ? ['sand-speck-1', 'sand-speck-2', 'sand-speck-1', 'pebble-1', 'pebble-3'] : edge ? EDGE_KIT : LAWN_KIT;
  decal(kit[Math.floor(pick * kit.length)], x, y, i);
}

const endOfGroup = (svg, k) => {let depth = 0; const re = /<g\b[^>]*>|<\/g>/g; re.lastIndex = k; for (let m; (m = re.exec(svg));) {if (m[0][1] === '/') depth--; else if (!m[0].endsWith('/>')) depth++; if (!depth) return re.lastIndex;} return -1;};
for (const name of ['ground-r2-c1.svg', 'ground-r2-c2.svg', 'ground-r1-c3.svg']) for (const dir of ['home-expansion/', '']) {
  const f = `public/pixi-art/${dir}${name}`, svg = readFileSync(f, 'utf8'), i = svg.indexOf('<g data-name="Islet sand"');
  if (i < 0) continue;
  let e = i; while (svg.startsWith('<g data-name="Islet', e)) {e = endOfGroup(svg, e); while (/\s/.test(svg[e])) e++;}
  writeFileSync(f, svg.slice(0, i) + svg.slice(e));
}

for (const dir of ['public/pixi-art/home-expansion', 'public/pixi-art']) for (const n of readdirSync(dir).filter(n => /^ground-r\d-c\d\.svg$/.test(n))) {
  const f = `${dir}/${n}`; writeFileSync(f, readFileSync(f, 'utf8').replaceAll('M4740 1640 L5050 1640 ', '').replaceAll('M4740 1640 L5050 1640', ''));}

let g = '';
const landPaths = [curve(coast.filter((_, i) => i % 2 === 0), true)];
for (const d of landPaths) g += `<path d="${d}" fill="none" stroke="${FOAM}" stroke-width="140" stroke-linejoin="round"/>`;
for (const d of landPaths) g += `<path d="${d}" fill="none" stroke="${SAND_DARK}" stroke-width="104" stroke-linejoin="round"/>`;
for (const d of landPaths) g += `<path d="${d}" fill="none" stroke="${SAND}" stroke-width="92" stroke-linejoin="round"/>`;
for (const d of landPaths) g += `<path d="${d}" fill="${GRASS}"/>`;
for (const d of landPaths) g += `<path d="${d}" fill="none" stroke="#7da52b" stroke-width="5" stroke-opacity=".55"/>`;
const roadD = roads.map(r => ({d: curve(r.points), W: r.W, lane: String(r.id ?? '').startsWith('homes-')})), polyD = polyRoads.map(r => r.rings.map(q => curve(q, true)).join(' '));
g += `<g fill="none" stroke-linecap="round" stroke-linejoin="round">`;
for (const {d, W, lane} of roadD) if (lane) g += `<path d="${d}" stroke="#80a82c" stroke-width="${W + 22}" stroke-opacity=".5"/>`;
for (const {d, W} of roadD) g += `<path d="${d}" stroke="${SAND_DARK}" stroke-width="${W + 6}" transform="translate(0 4)"/>`;
for (const d of polyD) g += `<path d="${d}" fill="${SAND_DARK}" fill-rule="evenodd" transform="translate(0 4)"/>`;
for (const {d, W} of roadD) g += `<path d="${d}" stroke="${SAND}" stroke-width="${W}"/>`;
for (const d of polyD) g += `<path d="${d}" fill="${SAND}" fill-rule="evenodd" stroke="none"/>`;
g += `</g>`;
const wpaths = waters.map(w => curve(w, true));
g += `<defs><clipPath id="land">${landPaths.map(d => `<path d="${d}"/>`).join('')}</clipPath>`;
wpaths.forEach((d, i) => {g += `<mask id="wm${i}" maskUnits="userSpaceOnUse" x="${X0 - 400}" y="${Y0 - 400}" width="${X1 - X0 + 800}" height="${Y1 - Y0 + 800}"><rect x="${X0 - 400}" y="${Y0 - 400}" width="${X1 - X0 + 800}" height="${Y1 - Y0 + 800}" fill="#fff"/>${wpaths.filter((_, j) => j !== i).map(o => `<path d="${o}" fill="#000"/>`).join('')}</mask>`;});
const MOUTHS = [
  [[2930, 5560], [3185, 5560], [3195, 5770], [2925, 5770]],
  [[3420, 5600], [4900, 5560], [4900, 5900], [4233, 6000], [3480, 5860]],
];
g += `<clipPath id="wet">${landPaths.map(d => `<path d="${d}"/>`).join('')}${MOUTHS.map(m => `<path d="${poly(m)}"/>`).join('')}</clipPath>`;
g += `</defs><g clip-path="url(#land)">`;
for (const d of wpaths) g += `<path d="${d}" fill="none" stroke="${SAND}" stroke-width="58" stroke-linejoin="round"/>`;
for (const d of wpaths) g += `<path d="${d}" fill="none" stroke="${SAND_DARK}" stroke-width="10" stroke-linejoin="round"/>`;
g += `</g><g clip-path="url(#wet)">`;
for (const d of wpaths) g += `<path d="${d}" fill="${WATER}"/>`;
g += `</g><g clip-path="url(#land)">`;
wpaths.forEach((d, i) => {g += `<path d="${d}" fill="none" stroke="#8fd7e6" stroke-width="5" stroke-linejoin="round" transform="translate(0 6)" mask="url(#wm${i})"/>`;});
for (const r of E.rivers ?? []) {const a = sample(r.points, 40); for (let i = 3; i < a.length - 3; i += 6) {const [x, y] = a[i]; g += `<path d="M${r3(x - 22)} ${r3(y)}q22 -10 44 0" fill="none" stroke="#c4ece9" stroke-width="5" stroke-linecap="round"/>`;}}
for (const [x, y] of [[6040, 1850], [6170, 1820], [6120, 1960], [6200, 960], [6300, 1040]]) g += `<path d="M${x - 22} ${y}q22 -10 44 0" fill="none" stroke="#c4ece9" stroke-width="5" stroke-linecap="round"/>`;
for (const [x, y, k] of [[6235, 1900, 1], [6262, 1868, .7], [5990, 1990, .8], [6330, 990, 1], [6150, 1060, .8]]) g += `<g transform="translate(${x} ${y}) scale(${k})"><path d="M0 0L13 -6A17 11 0 1 0 15 3Z" fill="#8cc63f" stroke="${INK}" stroke-width="3"/></g>`;
g += '</g>';
const tiles = E.tiles.map(t => {
  const name = `ground-${Math.round((t.y - E.origin.y) / t.height)}-${Math.round((t.x - E.origin.x) / t.width)}.svg`;
  writeFileSync(`${ART}/${name}`, `<svg xmlns="http://www.w3.org/2000/svg" width="${t.width}" height="${t.height}" viewBox="${r3(t.x)} ${r3(t.y)} ${t.width} ${t.height}">${g}</svg>`);
  return {...t, src: `${WEB}/${name}`, bleed: 3};
});

const BRIDGES = [
  {id: 'river-crossing-1', river: 'clover-run', a: [2950, 5497], b: [3245, 5497], r: 48, w: 100},
  {id: 'river-crossing-2', river: 'clover-run', a: [3729, 4478], b: [3487, 4350], r: 44, w: 100},
  {id: 'river-crossing-3', river: 'mill-stream', a: [5350, 1420], b: [5600, 1420], r: 48, w: 100},
  {id: 'river-crossing-4', river: 'mill-stream', a: [5733, 1805], b: [5772, 2070], r: 48, w: 100},
  {id: 'river-crossing-5', river: 'old-shore-canal', a: [3320, 3345], b: [3060, 3780], r: 70, w: 100},
  {id: 'river-crossing-6', river: 'old-shore-canal', a: [2322, 3345], b: [1980, 3800], r: 70, w: 100},
  {id: 'river-crossing-7', river: 'mill-stream', a: [5150, 1650], b: [5450, 1690], r: 30, w: 100},
];
const BRIDGE_ART = 'public/pixi-art/home-expansion-c/bridges', DEPTH = .62;
const BRIDGE_SILLS = {ns: [[120, 312], [120, 53]], ew: [[32, 168], [448, 168]], ne: [[90, 296], [395, 104]], nw: [[395, 296], [85, 104]]};
const PLANK = {ne: [1, DEPTH], nw: [1, -DEPTH]};
function archBridge({a, b}) {
  const [near, far] = a[1] >= b[1] ? [a, b] : [b, a], X = far[0] - near[0], Y = far[1] - near[1];
  const dir = Math.abs(Y) < Math.abs(X) * .25 ? 'ew' : Math.abs(X) < Math.abs(Y) * .25 ? 'ns' : X > 0 ? 'ne' : 'nw';
  const src = readFileSync(`${BRIDGE_ART}/bridge-${dir}.svg`, 'utf8'), [W, H] = src.match(/viewBox="0 0 (\d+) (\d+)"/).slice(1).map(Number);
  let [n0, f0] = BRIDGE_SILLS[dir];
  if (dir === 'ew' && X < 0) [n0, f0] = [f0, n0];
  const As = [f0[0] - n0[0], f0[1] - n0[1]];
  let sx, c, d;
  if (dir === 'ns') {sx = d = Math.abs(Y) / Math.abs(As[1]); c = 0;}
  else if (dir === 'ew') {sx = X / As[0]; d = 1; c = Y / As[0];}
  else {
    sx = X / As[0];
    const g = [X, Y / DEPTH], q = [g[1], -g[0]].map(v => v * Math.sign(g[1] || 1)), qs = [q[0], q[1] * DEPTH], p = PLANK[dir];
    const lam = sx * p[0] / qs[0], r1v = lam * qs[1], det = p[0] * As[1] - p[1] * As[0];
    c = (r1v * As[1] - p[1] * Y) / det; d = (p[0] * Y - As[0] * r1v) / det;
  }
  const e = near[0] - sx * n0[0], f = near[1] - c * n0[0] - d * n0[1];
  const T = ([x, y]) => [sx * x + e, c * x + d * y + f], cs = [[0, 0], [W, 0], [0, H], [W, H]].map(T);
  const xs = cs.map(q => q[0]), ys = cs.map(q => q[1]), box = [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
  const inner = src.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return {box, dir, crown: Math.round(24 * d), svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${r3(box[2])}" height="${r3(box[3])}" viewBox="${box.map(r3).join(' ')}"><g transform="matrix(${[sx, c, 0, d, e, f].map(v => Math.round(v * 1e4) / 1e4).join(' ')})">${inner}</g></svg>`};
}
const POND_OVERLAYS = new Set(['shore-millrill-pond', 'shore-millhead-pond']);
const newDecks = E.decks.filter(d => !String(d.id ?? '').startsWith('river-crossing-') && !POND_OVERLAYS.has(d.id));
for (const br of BRIDGES) {
  const {box, svg, crown} = archBridge(br); br.r = crown;
  writeFileSync(`${ART}/${br.id}.svg`, svg);
  newDecks.push({id: br.id, src: `${WEB}/${br.id}.svg`, x: r3(box[0]), y: r3(box[1]), width: r3(box[2]), height: r3(box[3]), resolution: 1.5});
}
const own = BRIDGES.filter(br => !br.centre), sameSeg = (v, q) => Math.hypot(v.a[0] - q.a[0], v.a[1] - q.a[1]) < 2 && Math.hypot(v.b[0] - q.b[0], v.b[1] - q.b[1]) < 2;
const oldArches = E.arches ?? [];
const arches = own.map(({a, b, r, w}) => ({a, b, w, r}));
const walkwaysOut = walkways.filter(v => !oldArches.some(q => sameSeg(v, q)) && !arches.some(q => sameSeg(v, q))).concat(arches.map(({a, b, w}) => ({a, b, w, boatPassUnder: true})));
const riverMouths = [[2930, 5450, 3195, 5980], [3400, 5480, 4920, 6060]];
const SAILABLE = ['clover-run', 'old-shore-canal', 'fork-canal-clover', 'quay-tidal-inlet'];
const boatWater = [...riverWater.filter(w => SAILABLE.includes(w.id)).map(w => w.poly), E.water.poly];
const diagonal = ({a, b}) => Math.abs(b[0] - a[0]) > 150 && Math.abs(b[1] - a[1]) > 150;
const deckBoxes = ({id, a, b, w}) => {
  if (!diagonal({a, b})) return [{id, x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, w: Math.abs(b[0] - a[0]) + w * .9, h: Math.abs(b[1] - a[1]) + w * .9}];
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 30), mid = n / 2;
  return Array.from({length: n + 1}, (_, i) => ({id: i === mid ? id : `${id}-${i}`, x: r3(a[0] + (b[0] - a[0]) * i / n), y: r3(a[1] + (b[1] - a[1]) * i / n), w: w * .9, h: w * .9}));
};
const riverBridges = (E.riverBridges ?? []).filter(v => !String(v.id).startsWith('river-crossing-')).concat(own.flatMap(deckBoxes));
const crossings = own.map(({id, river, a, b}) => ({id, river, x: (a[0] + b[0]) / 2 * .18 + 278, y: (a[1] + b[1]) / 2 * .18 + 204}));

const {sleepers: _drop, ...keep} = E;
writeFileSync(FILE, JSON.stringify({...keep, riverWater, boatWater, riverMouths, tiles, decks: newDecks, arches, walkways: walkwaysOut, riverBridges, crossings, groundDecals: [...decals, ...(E.hamletDecals ?? []).map(({hamlet, ...d}) => d)]}, null, 2) + '\n');
execFileSync('node', ['scripts/walk-world.mjs'], {stdio: 'inherit'});
console.log(JSON.stringify({decals: decals.length, tiles: tiles.length, shore: Boolean(S), coastPoints: coast.length}));
