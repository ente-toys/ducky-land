// Neon island (theme id `neon`, "Tickytown"): a city at dusk, built in one pass from the approved concept
// (concepts/themes/concepts/05-neon.png), following concepts/themes/THEME-CONTRACT.md and the library build
// (scripts/themes/library-world.mjs):
//   public/pixi-art/themes/neon/  ground.svg, ground-rN-cN.svg tiles, deck SVGs, reuse/ (home art copied in), art.json
//   assets/world/themes/neon/          world.json, walk-world.json, harbor.json, placements.json, paths.json
// Layout is written in CONCEPT pixels (the 1536x1024 picture) and mapped to world units by T().
// Props come from scripts/themes/neon-gen.sh + neon-trace-all.sh.
// Rebuild: node scripts/themes/neon-world.mjs, then node scripts/themes/neon-finish.mjs.
// Finish installs the locked centre, flattens inherited gradients, and resolves all 40 sleepers with engine rules.
// boss 6 Nov: big and spacious (~1.8x home's land), wide paths, a round centre plaza (zones.centre) whose landmark is a
// placeholder clock tower, 4 open activity areas, 3 open stall rows, 40 sleepers, 4 jetties, arched bridges.
import {readFileSync, writeFileSync, mkdirSync, copyFileSync} from 'node:fs';
import {geometry} from '../../assets/world/island-geometry.mjs';

const ART = 'public/pixi-art/themes/neon/', DATA = 'assets/world/themes/neon/';
mkdirSync(ART + 'reuse', {recursive: true}); mkdirSync(DATA, {recursive: true});
const S = 4.6, OX = 670, OY = 700;
const r1 = v => Math.round(v * 10) / 10;
const T = ([x, y]) => [r1(OX + (x - 78) * S), r1(OY + (y - 60) * S)];
const TS = v => v * S;

// ---------- geometry helpers ----------
function catmull(pts, closed, n = 10) {
  const out = [], N = pts.length, P = i => pts[closed ? (i + N) % N : Math.max(0, Math.min(N - 1, i))];
  for (let i = 0; i < (closed ? N : N - 1); i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => .5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  if (!closed) out.push(pts[N - 1]);
  return out.map(([x, y]) => [r1(x), r1(y)]);
}
// rounded blocky outline: densify the corners, then chaikin (city blocks with soft corners, like the concept's quay)
function chaikin(p, it) {
  for (let k = 0; k < it; k++) p = p.flatMap((a, i) => {const b = p[(i + 1) % p.length]; return [[.75 * a[0] + .25 * b[0], .75 * a[1] + .25 * b[1]], [.25 * a[0] + .75 * b[0], .25 * a[1] + .75 * b[1]]];});
  return p.map(([x, y]) => [r1(x), r1(y)]);
}
function densify(p, step) {
  const out = [];
  p.forEach((a, i) => {const b = p[(i + 1) % p.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);});
  return out;
}
const area = p => p.reduce((s, a, i) => {const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1];}, 0) / 2;
function offset(p, d) {
  const sgn = area(p) > 0 ? 1 : -1, N = p.length;
  return p.map((a, i) => {
    const pr = p[(i - 1 + N) % N], nx = p[(i + 1) % N], tx = nx[0] - pr[0], ty = nx[1] - pr[1], l = Math.hypot(tx, ty) || 1;
    return [r1(a[0] - sgn * ty / l * d), r1(a[1] + sgn * tx / l * d)];
  });
}
const d = p => 'M' + p.map(([x, y]) => `${x} ${y}`).join(' L');
const dz = p => d(p) + ' Z';
const segDist = (x, y, a, b) => {const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);};
const lineDist = (x, y, l) => Math.min(...l.slice(1).map((b, i) => segDist(x, y, l[i], b)));
const inPolyF = (x, y, p) => {let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c;};
let seed = 11; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

// ---------- the blocky city coast (concept px), harbour basin cut into the south quay ----------
const COAST_C = [[110,170],[200,170],[200,110],[330,110],[330,70],[620,70],[620,95],[1000,95],[1000,60],[1300,60],[1300,110],[1420,110],[1420,250],[1460,250],
  [1460,560],[1430,560],[1430,620],[1475,650],[1478,745],[1400,785],[1250,790],[1150,765],[1080,745],[1080,850],[500,850],[500,745],[390,745],[390,700],
  [230,700],[230,650],[110,650],[110,500],[78,500],[78,300],[110,300]];
const EDGE = chaikin(densify(COAST_C.map(T), 400), 3);   // the quay top edge = where land ends
const GRASS = offset(EDGE, 80);                            // lawn inside the stone quay band
const WALK_COAST = offset(EDGE, 35);

// ---------- inland water: the harbour basin (a stone-walled canal pool) and the park pond ----------
const BASIN_C = [548, 700, 1032, 782];   // x0 y0 x1 y1 concept px
const BASIN = chaikin(densify([[BASIN_C[0], BASIN_C[1]], [BASIN_C[2], BASIN_C[1]], [BASIN_C[2], BASIN_C[3]], [BASIN_C[0], BASIN_C[3]]].map(T), 300), 3);
const POND = {x: T([1300, 300])[0], y: T([1300, 300])[1], rx: TS(62), ry: TS(34)};

// ---------- paths (concept px) ----------
const MAIN = 250, MINOR = 200;   // home's paths are ~120 wide: these are 1.7x to 2x
const CEN = [768, 400];
const PATHS_C = [
  [CEN, [620, 320], [480, 250], [330, 205], [250, 205]],                           // 0 NW diagonal -> flower park
  [CEN, [920, 320], [1080, 250], [1180, 190], [1240, 130], [1240, 80]],            // 1 NE diagonal -> north pier
  [CEN, [560, 410], [380, 420], [220, 402], [92, 400]],                            // 2 west avenue -> west pier
  [CEN, [980, 410], [1180, 420], [1340, 410], [1450, 402]],                        // 3 east avenue -> east pier
  [CEN, [768, 560], [768, 700]],                                                   // 4 south steps -> basin bridge
  [[768, 775], [768, 812], [780, 845]],                                            // 5 basin bridge -> harbor jetty
  [[510, 655], [768, 655], [1060, 655]],                                           // 6 north quay
  [[535, 655], [535, 740], [545, 815], [768, 815], [1030, 815], [1040, 740], [1040, 655]],   // 7 side + south quays
  [[380, 420], [345, 540], [312, 700]],                                            // 8 west -> SW islet bridge
  [[1180, 420], [1215, 560], [1280, 690], [1300, 770]],                            // 9 east -> beach -> SE islet bridge
  [[250, 205], [170, 290], [165, 402]],                                            // 10 flower park loop
  [[480, 250], [560, 152], [768, 140], [960, 152], [1080, 250]],                   // 11 north street
  [[560, 410], [585, 540], [525, 655]],                                            // 12 west -> quay
  [[980, 410], [955, 540], [1055, 655]],                                           // 13 east -> quay
];
const PATHS = PATHS_C.map((l, i) => ({line: catmull(l.map(T), false, 8), w: [0, 1, 2, 3, 4, 5, 6].includes(i) ? MAIN : MINOR}));
// plazas: the round centre (the landmark goes here), paved squares
const PLAZAS = [{c: [...CEN, 178, 108], pave: 'crossing'}].map(p => ({...p, x: T(p.c)[0], y: T(p.c)[1], rx: TS(p.c[2]), ry: TS(p.c[3])}));
const CENTRE = PLAZAS[0];
// boss 6 Nov: OPEN room for later activities and stalls. Nothing is placed on any of them.
const ACT = [
  {id: 'activity-1', name: 'Lantern square', c: [462, 548, 68, 52], kind: 'tiles'},
  {id: 'activity-2', name: 'Pond park lawn', c: [1112, 330, 70, 46], kind: 'lawn'},
  {id: 'activity-3', name: 'Flower park lawn', c: [312, 312, 78, 50], kind: 'lawn'},
  {id: 'activity-4', name: 'Arcade square', c: [1098, 560, 72, 52], kind: 'tiles'},
].map(a => ({...a, x: T(a.c)[0], y: T(a.c)[1], rx: TS(a.c[2]), ry: TS(a.c[3])}));
for (const a of ACT) if (a.kind !== 'lawn') PLAZAS.push({c: a.c, pave: a.kind, x: a.x, y: a.y, rx: a.rx, ry: a.ry, open: true});
const LAWNS = ACT.filter(a => a.kind === 'lawn');
const STALL_ROWS = [
  {id: 'stalls-1', name: 'West avenue night market', path: 2, t: [.5, .86], side: 1},
  {id: 'stalls-2', name: 'East avenue night market', path: 3, t: [.42, .74], side: -1},
  {id: 'stalls-3', name: 'North street stall row', path: 11, t: [.3, .72], side: 1},
].map(r => {
  const l = PATHS[r.path].line, i0 = Math.round(r.t[0] * (l.length - 1)), i1 = Math.round(r.t[1] * (l.length - 1)), seg = l.slice(i0, i1 + 1);
  const off = k => seg.map((a, i) => {const pr = seg[Math.max(0, i - 1)], nx = seg[Math.min(seg.length - 1, i + 1)], tx = nx[0] - pr[0], ty = nx[1] - pr[1], L = Math.hypot(tx, ty) || 1; return [r1(a[0] - r.side * ty / L * k), r1(a[1] + r.side * tx / L * k)];});
  const inner = off(PATHS[r.path].w / 2 - 6), outer = off(PATHS[r.path].w / 2 + 190), mid = off(PATHS[r.path].w / 2 + 95);
  return {...r, poly: [...inner, ...outer.reverse()], mid, x: mid[mid.length >> 1][0], y: mid[mid.length >> 1][1]};
});
const BEACH = catmull([[1185,640],[1300,598],[1440,585],[1510,640],[1510,800],[1300,815],[1150,790],[1120,705]].map(T), true, 8);
const BEACH_BB = {x0: Math.min(...BEACH.map(p => p[0])), x1: Math.max(...BEACH.map(p => p[0])), y0: Math.min(...BEACH.map(p => p[1])), y1: Math.max(...BEACH.map(p => p[1]))};

// ---------- islets, jetties, bridges ----------
const BB = {x0: Math.min(...EDGE.map(p => p[0])), x1: Math.max(...EDGE.map(p => p[0])), y0: Math.min(...EDGE.map(p => p[1])), y1: Math.max(...EDGE.map(p => p[1]))};
const MIDX = (BB.x0 + BB.x1) / 2, MIDY = (BB.y0 + BB.y1) / 2;
const coastTopAt = x => Math.min(...EDGE.filter(p => Math.abs(p[0] - x) < 60 && p[1] < MIDY).map(p => p[1]));
const coastBotAt = x => Math.max(...EDGE.filter(p => Math.abs(p[0] - x) < 60 && p[1] > MIDY).map(p => p[1]));
const coastLeftAt = y => Math.min(...EDGE.filter(p => Math.abs(p[1] - y) < 60 && p[0] < MIDX).map(p => p[0]));
const coastRightAt = y => Math.max(...EDGE.filter(p => Math.abs(p[1] - y) < 60 && p[0] > MIDX).map(p => p[0]));
const RX = () => BB.x0 + rnd() * (BB.x1 - BB.x0), RY = () => BB.y0 + rnd() * (BB.y1 - BB.y0);
const ISLET_RX = 470, ISLET_RY = 210, BR_LEN = 411 * .8;
const islets = [], walkways = [], decks = [], arches = [];
const JETTY1 = {file: 'public/pixi-art/bridge-jetty-1.svg', vb: [3222.39, 3276.877, 229.2164, 476.233], a: [3320, 3319], b: [3320, 3730], w: 115};
const JETTY5 = {file: 'public/pixi-art/bridge-jetty-5.svg', vb: [5004.9592, 1492.5089, 494.0617, 277.2587], a: [5034.08, 1638.41], b: [5469.9, 1681.99], w: 84};
function deck(name, J, at, sx, sy) {
  const inner = readFileSync(J.file, 'utf8').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const [vx, vy, vw, vh] = J.vb, map = ([x, y]) => [at[0] + (x - J.a[0]) * sx, at[1] + (y - J.a[1]) * sy];
  const c1 = map([vx, vy]), c2 = map([vx + vw, vy + vh]);
  const x0 = Math.min(c1[0], c2[0]), y0 = Math.min(c1[1], c2[1]), w = Math.abs(c2[0] - c1[0]), h = Math.abs(c2[1] - c1[1]);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${r1(w)}" height="${r1(h)}" viewBox="${r1(x0)} ${r1(y0)} ${r1(w)} ${r1(h)}" stroke-linecap="round" stroke-linejoin="round">\n<title>Tickytown ${name} (home jetty art, re-placed)</title>\n<g transform="translate(${r1(at[0])} ${r1(at[1])}) scale(${sx} ${sy}) translate(${-J.a[0]} ${-J.a[1]})">${inner}</g></svg>\n`;
  writeFileSync(ART + name + '.svg', svg);
  decks.push({src: name + '.svg', x: r1(x0), y: r1(y0), width: r1(w), height: r1(h)});
  const b = map(J.b), ww = r1(J.w * Math.abs(J === JETTY5 ? sy : sx));
  walkways.push({a: [r1(at[0]), r1(at[1])], b: [r1(b[0]), r1(b[1])], w: ww});
  arches.push({a: [r1(at[0]), r1(at[1])], b: [r1(b[0]), r1(b[1])], r: r1(70 * Math.abs(J === JETTY5 ? sx : sy)), w: ww});
  return {a: at, b};
}
const FLIP1 = {...JETTY1, a: JETTY1.b, b: JETTY1.a};
// two south islets joined by arched wooden bridges (foot on the coast, running south)
for (const [i, cx] of [[1, 312], [2, 1300]]) {
  const fx = T([cx, 0])[0], fy = coastBotAt(fx) - 40;
  const br = deck(`islet-bridge-${i}`, FLIP1, [fx, fy], 1, -.8);
  islets.push([r1(fx), r1(br.b[1] + ISLET_RY * .55), ISLET_RX, ISLET_RY]);
}
// three piers: west + east (home jetty 5, 70%), north (home jetty 1 running north)
const wy = T([0, 400])[1], ey = T([0, 402])[1], nx = T([1240, 0])[0];
const west = deck('jetty-west', JETTY5, [coastLeftAt(wy) + 40, wy], -.7, 1);
const east = deck('jetty-east', JETTY5, [coastRightAt(ey) - 40, ey], .7, 1);
const north = deck('jetty-north', JETTY1, [nx, coastTopAt(nx) + 40 - 411 * .85], 1, .85);
// the arched bridge over the harbour basin (on the south steps' line)
const bx = T([768, 0])[0], by0 = T([0, BASIN_C[1]])[1] - 70, by1 = T([0, BASIN_C[3]])[1] + 70;
deck('basin-bridge', JETTY1, [bx, by0], 1.25, (by1 - by0) / 411);
// the harbor jetty (drawn by the engine) runs south from the south quay
const hx = T([780, 0])[0], hFoot = [hx, coastBotAt(hx) - 40], hTip = [hx, hFoot[1] + 380];

const water = [{x: POND.x, y: POND.y, rx: POND.rx, ry: POND.ry}];
{const xs = BASIN.map(p => p[0]), ys = BASIN.map(p => p[1]); water.push({x: r1((Math.min(...xs) + Math.max(...xs)) / 2), y: r1((Math.min(...ys) + Math.max(...ys)) / 2), rx: r1((Math.max(...xs) - Math.min(...xs)) / 2), ry: r1((Math.max(...ys) - Math.min(...ys)) / 2), poly: BASIN});}
const bridges = [{x: bx, y: r1((by0 + by1) / 2), w: 150, h: r1(by1 - by0)}];

// ---------- props ----------
const SPAWNS_C = {plaza: [768, 505], 'lantern-square': [462, 548], 'pond-park': [1112, 330], 'flower-park': [312, 312], 'arcade-square': [1098, 560],
  'north-street': [768, 152], quay: [640, 662], beach: [1330, 690], 'west-avenue': [220, 402], 'east-avenue': [1340, 410]};
const warn = [];
const props = [], obstacles = [];
let pid = 0;
const ASSET = {};
const svgSize = f => {const s = readFileSync(f, 'utf8').slice(0, 800), m = s.match(/viewBox="([\d.\s-]+)"/); const v = m[1].trim().split(/\s+/).map(Number); return [v[2], v[3]];};
// Tickytown's own props: world height in Ducky heights (1 Ducky = 130)
const OWN = {'clock-tower': 7.4, 'shop-noodle': 3.7, 'shop-boba': 3.7, 'shop-cat': 3.7, 'shop-arcade': 3.6, 'shop-cupcake': 3.7, 'shop-star': 3.6,
  'noodle-kiosk': 2.3, 'vending-pink': 1.45, 'vending-mint': 1.45, 'capsule-seat': 1.15, 'neon-lamp': 2.0, 'lantern-arch': 1.9, 'sign-board': 1.4, 'planter-box': .8};
const SCALE = {};
for (const [n, hd] of Object.entries(OWN)) {const [w, h] = svgSize(ART + n + '.svg'); ASSET[n] = {src: n + '.svg', w, h, ay: (h - 6) / h}; SCALE[n] = hd * 130 / h;}
const REUSE = {plants: ['tree-1', 'tree-2', 'tree-3', 'tree-4', 'tree-5', 'bush-1', 'bush-2', 'bush-3', 'bush-4', 'bush-5', 'bush-6', 'flower-1', 'flower-2', 'flower-3'],
  detail: ['street--bench-wood', 'street--bench-park', 'street--umbrella-cafe', 'street--picnic-table', 'street--bin-litter', 'street--bollard', 'nature--tree-palm', 'nature--tree-coconut-palm', 'nature--tree-blossom',
    'beach--towel-striped', 'beach--towel-sun', 'beach--beach-ball', 'beach--shell-scallop', 'beach--starfish-orange', 'beach--sandcastle-small', 'beach--bucket', 'nature--reeds', 'nature--lily-pad-flower', 'nature--lily-pad-large', 'nature--rock-round'],
  decals: ['grass-tuft-1', 'grass-tuft-2', 'grass-tuft-3', 'flower-dot-1', 'flower-dot-2', 'flower-dot-3', 'pebble-1', 'sand-speck-1', 'sand-speck-2']};
const manifest = JSON.parse(readFileSync('assets/manifest.json', 'utf8'));
for (const [dir, list] of Object.entries(REUSE)) for (const n of list) {
  copyFileSync(`public/pixi-art/${dir}/${n}.svg`, `${ART}reuse/${n}.svg`);
  if (dir === 'decals') continue;
  const key = n.includes('--') ? n.split('--')[1] : n;
  if (dir === 'detail') {const a = manifest.assets.find(x => x.name === key); ASSET[key] = {src: `reuse/${n}.svg`, w: a.size.width, h: a.size.height, ay: a.anchor.y / a.size.height}; SCALE[key] = a.size.ducky_units.height * 130 / a.size.height;}
  else {const [w, h] = svgSize(`public/pixi-art/${dir}/${n}.svg`); ASSET[key] = {src: `reuse/${n}.svg`, w, h, ay: 1};}
}
const kindOf = n => /^tree-\d/.test(n) ? 'tree' : /^bush-/.test(n) ? 'bush' : /^flower-/.test(n) ? 'flower' : n;
Object.assign(SCALE, {tree: 1.265, bush: 1.3, flower: 1.6});
const FOOT = {'clock-tower': 'bldg', 'shop-noodle': 'bldg', 'shop-boba': 'bldg', 'shop-cat': 'bldg', 'shop-arcade': 'bldg', 'shop-cupcake': 'bldg', 'shop-star': 'bldg', 'noodle-kiosk': 'base',
  'lantern-arch': 'posts', 'neon-lamp': 'pole', 'towel-striped': 'none', 'towel-sun': 'none', 'shell-scallop': 'none', 'starfish-orange': 'none', 'lily-pad-flower': 'none', 'lily-pad-large': 'none', reeds: 'none', flower: 'none',
  'umbrella-cafe': 'pole', 'tree-palm': 'trunk', 'tree-coconut-palm': 'trunk', 'tree-blossom': 'trunk', 'beach-ball': 'low', bollard: 'pole'};
const NICE = {'clock-tower': 'Clock tower (placeholder landmark)', 'shop-noodle': 'Noodle shop', 'shop-boba': 'Boba shop', 'shop-cat': 'Cat cafe', 'shop-arcade': 'Game arcade', 'shop-cupcake': 'Cupcake bakery',
  'shop-star': 'Star gift shop', 'noodle-kiosk': 'Noodle kiosk', 'vending-pink': 'Vending cabinet', 'vending-mint': 'Vending cabinet', 'capsule-seat': 'Capsule seat', 'neon-lamp': 'Street lamp', 'lantern-arch': 'Lantern string',
  'sign-board': 'Sign board', 'planter-box': 'Planter box', 'tree-palm': 'Palm tree', 'tree-coconut-palm': 'Palm tree', 'tree-blossom': 'Blossom tree'};
function put(name, cp, zone, {flip = false, world = false, mult = 1, nudge = true} = {}) {
  const [x, y] = world ? cp : T(cp), a = ASSET[name], k = kindOf(name), s = r1((SCALE[k] ?? SCALE[name] ?? 1) * mult * 1000) / 1000;
  const w = a.w * s, h = a.h * s;
  const p = {id: `neon-${pid++}`, name: NICE[name] || (k === 'tree' ? 'Tree' : k === 'bush' ? 'Bush' : k === 'flower' ? 'Flowers' : name.replace(/-/g, ' ')), asset: name, src: a.src,
    x: r1(x), y: r1(y), width: a.w, height: a.h, anchor: {x: .5, y: r1(a.ay * 1000) / 1000}, scale: s, flip, zone};
  const f = FOOT[name] ?? FOOT[k] ?? (k === 'tree' ? 'trunk' : k === 'bush' ? 'bush' : 'base');
  if (nudge && f !== 'none') {
    const rad = f === 'trunk' ? 31 : f === 'pole' ? 18 : Math.min(260, w * .46);
    for (let it = 0; it < 14; it++) {
      let moved = false;
      for (const q of PATHS) {
        const l = q.line, need = q.w / 2 - 22 + rad;
        let best = null;
        for (let i = 1; i < l.length; i++) {const A = l[i - 1], B = l[i], dx = B[0] - A[0], dy = B[1] - A[1], t = Math.max(0, Math.min(1, ((p.x - A[0]) * dx + (p.y - 10 - A[1]) * dy) / (dx * dx + dy * dy || 1))), cx = A[0] + t * dx, cy = A[1] + t * dy, dd = Math.hypot(p.x - cx, p.y - 10 - cy); if (!best || dd < best.dd) best = {dd, cx, cy};}
        if (best.dd < need) {const ux = (p.x - best.cx) / (best.dd || 1), uy = (p.y - 10 - best.cy) / (best.dd || 1), m = need - best.dd + 4; p.x = r1(p.x + (best.dd ? ux : 1) * m); p.y = r1(p.y + (best.dd ? uy : 0) * m); moved = true;}
      }
      for (const c of Object.values(SPAWNS_C)) {const [sx, sy] = T(c), dd = Math.hypot(p.x - sx, p.y - sy); if (dd < 90 + rad) {p.x = r1(sx + (p.x - sx) / (dd || 1) * (92 + rad)); p.y = r1(sy + (p.y - sy) / (dd || 1) * (92 + rad)); moved = true;}}
      if (!moved) break;
    }
    if (Math.hypot(p.x - x, p.y - y) > 160) warn.push(`${name} nudged ${Math.round(Math.hypot(p.x - x, p.y - y))}`);
  }
  props.push(p);
  if (f === 'trunk') obstacles.push({x: p.x, y: r1(p.y - 9), rx: 31, ry: 22});
  else if (f === 'bush') obstacles.push({x: p.x, y: r1(p.y - 14), rx: r1(w * .36), ry: r1(Math.min(30, h * .25))});
  else if (f === 'bldg') obstacles.push({x: p.x, y: r1(p.y - w * .2), rx: r1(w * .47), ry: r1(w * .22)});
  else if (f === 'base') obstacles.push({x: p.x, y: r1(p.y - Math.min(w, 260) * .14), rx: r1(w * .42), ry: r1(Math.min(w, 260) * .17)});
  else if (f === 'low') obstacles.push({x: p.x, y: r1(p.y - h * .3), rx: r1(w * .4), ry: r1(h * .28)});
  else if (f === 'pole') obstacles.push({x: p.x, y: r1(p.y - 8), rx: 18, ry: 12});
  else if (f === 'posts') for (const sx of [-.41, .41]) obstacles.push({x: r1(p.x + sx * w), y: r1(p.y - 8), rx: 22, ry: 14});
  return p;
}
const near = (p, list, r) => list.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < r);
const inOpen = (x, y, pad = 0) => [...PLAZAS, ...LAWNS].some(p => ((x - p.x) / (p.rx + pad)) ** 2 + ((y - p.y) / (p.ry + pad)) ** 2 < 1)
  || STALL_ROWS.some(r => inPolyF(x, y, r.poly) || lineDist(x, y, r.mid) < 95 + pad);

// the centre landmark (placeholder: the boss is still choosing it)
const tower = put('clock-tower', [CEN[0], CEN[1] - 2], 'centre', {nudge: false});
// shop blocks round the centre, as in the concept (nudged off the paths)
const SHOPS = [['shop-noodle', [560, 370], false], ['shop-boba', [985, 370], true], ['shop-cupcake', [640, 545], false], ['shop-arcade', [900, 545], true],
  ['shop-star', [700, 250], false], ['shop-cat', [845, 250], true], ['shop-noodle', [420, 352], true], ['shop-star', [1350, 525], true],
  ['shop-cat', [235, 565], false], ['shop-boba', [1060, 120], false], ['shop-arcade', [430, 150], false], ['shop-cupcake', [1360, 220], true]];
for (const [n, c, f] of SHOPS) {
  const [x, y] = T(c);
  if (inOpen(x, y, 60)) warn.push(`${n} on an open area at ${c}`);
  put(n, c, 'shops', {flip: f});
}
// vending cabinets and planters beside the shop doors, lamps along every path, capsule seats round the centre
for (const s of props.filter(p => /^shop-/.test(p.asset))) {
  const side = s.flip ? -1 : 1, w = s.width * s.scale;
  const v = [s.x + side * (w * .62), s.y + 6];
  if (!inOpen(...v, 30)) put(rnd() < .5 ? 'vending-pink' : 'vending-mint', v, 'shops', {world: true, flip: s.flip});
}
const LAMPS = [];
PATHS.forEach((q, n) => {
  const l = q.line; let acc = 0, side = 1;
  for (let i = 1; i < l.length; i++) {
    acc += Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]);
    if (acc < 520) continue; acc = 0; side = -side;
    const A = l[i - 1], B = l[i], tx = B[0] - A[0], ty = B[1] - A[1], L = Math.hypot(tx, ty) || 1;
    const x = l[i][0] - side * ty / L * (q.w / 2 + 40), y = l[i][1] + side * tx / L * (q.w / 2 + 40);
    if (!inPolyF(x, y, offset(EDGE, 70)) || inOpen(x, y, 40) || near([x, y], LAMPS, 300) || inPolyF(x, y, offset(BASIN, -90)) || ((x - CENTRE.x) / (CENTRE.rx + 40)) ** 2 + ((y - CENTRE.y) / (CENTRE.ry + 40)) ** 2 < 1) continue;
    if (props.some(p => Math.hypot(p.x - x, p.y - y) < Math.max(90, p.width * p.scale * .5))) continue;
    if (walkways.some(w => segDist(x, y, w.a, w.b) < w.w / 2 + 60)) continue;
    LAMPS.push([x, y]); put('neon-lamp', [x, y], 'lamps', {world: true, nudge: false});
  }
});
// the centre's ring: capsule seats and lamps on its rim, between the four roads
for (const ang of [.5, 2.64, 3.64, 5.78]) {
  const x = CENTRE.x + Math.cos(ang) * (CENTRE.rx + 70), y = CENTRE.y + Math.sin(ang) * (CENTRE.ry + 60);
  put('capsule-seat', [x, y], 'centre', {world: true, flip: Math.cos(ang) > 0});
}
// the noodle kiosk corner (west) with lantern strings, sign boards
put('noodle-kiosk', [300, 480], 'kiosk');
put('lantern-arch', [215, 470], 'kiosk');
put('noodle-kiosk', [1000, 230], 'kiosk', {flip: true});
put('lantern-arch', [400, 625], 'lanterns'); put('lantern-arch', [1160, 625], 'lanterns', {flip: true});
put('lantern-arch', [880, 210], 'lanterns'); put('lantern-arch', [195, 250], 'lanterns');
put('sign-board', [680, 600], 'signs'); put('sign-board', [860, 600], 'signs', {flip: true}); put('sign-board', [1240, 480], 'signs');
// basin quay: cafe tables and benches on the quay corners, capsule seats looking at the water
for (const [c, n, f] of [[[690, 612], 'bench-wood', false], [[850, 612], 'bench-wood', true], [[1100, 700], 'capsule-seat', true],
  [[478, 690], 'umbrella-cafe', false], [[1060, 805], 'umbrella-cafe', true], [[600, 830], 'capsule-seat', false]]) put(n, c, 'quay', {flip: f, nudge: !(n === 'capsule-seat' && c[0] === 600)});
// islets: a lantern string and a bench each, trees round the back
islets.forEach(([cx, cy, rx, ry], i) => {
  put('lantern-arch', [cx - rx * .3, cy - ry * .05], 'islets', {world: true, nudge: false, flip: i === 1});
  put('bench-park', [cx + rx * .35, cy + ry * .25], 'islets', {world: true, nudge: false});
  put('tree-blossom', [cx + rx * .5, cy - ry * .45], 'islets', {world: true, nudge: false});
  put('tree-2', [cx - rx * .62, cy - ry * .4], 'islets', {world: true, nudge: false});
  put('planter-box', [cx + rx * .05, cy + ry * .55], 'islets', {world: true, nudge: false});
});
// the beach: palms, towels, a sandcastle
for (const [c, n, f] of [[[1240, 650], 'tree-palm', false], [[1430, 625], 'tree-coconut-palm', true], [[1435, 735], 'tree-palm', true], [[1180, 740], 'tree-coconut-palm', false],
  [[1350, 760], 'towel-striped', false], [[1405, 700], 'towel-sun', false], [[1270, 755], 'sandcastle-small', false], [[1320, 640], 'beach-ball', false], [[1450, 690], 'shell-scallop', false], [[1220, 700], 'starfish-orange', false],
  [[1380, 650], 'umbrella-cafe', false], [[1385, 735], 'bucket', false]]) put(n, c, 'beach', {flip: f, nudge: !/towel|shell|starfish/.test(n)});
// the pond: reeds and lilies
for (const [dx, dy, n] of [[-58, 22, 'reeds'], [55, 26, 'reeds'], [-20, -5, 'lily-pad-flower'], [22, 6, 'lily-pad-large'], [-34, 10, 'lily-pad-large']]) put(n, [1300 + dx, 300 + dy], 'pond', {nudge: false});

// ---------- scatter trees, bushes, flowers on free lawn ----------
const SLEEPERS = [];
function free(x, y, room, pathPad = 90) {
  if (!inPolyF(x, y, offset(GRASS, 60)) || !inPolyF(x, y, WALK_COAST)) return false;
  if (inPolyF(x, y, BEACH)) return false;
  if (PATHS.some(p => lineDist(x, y, p.line) < p.w / 2 + pathPad)) return false;
  if (inOpen(x, y, 60)) return false;
  if (inPolyF(x, y, offset(BASIN, -140)) || ((x - POND.x) / (POND.rx + 150)) ** 2 + ((y - POND.y) / (POND.ry + 150)) ** 2 < 1) return false;
  if (Object.values(SPAWNS_C).some(c => Math.hypot(T(c)[0] - x, T(c)[1] - y) < 160)) return false;
  if (Math.hypot(x - hFoot[0], y - hFoot[1]) < 300) return false;
  if (walkways.some(w => segDist(x, y, w.a, w.b) < w.w / 2 + 160)) return false;
  if (SLEEPERS.some(o => Math.hypot(x - o.x, (y - o.y) * 1.6) < o.r * 1.8 + room * .5 + 80 || (y > o.y - 40 && y - o.y < 480 && Math.abs(x - o.x) < o.r + 190))) return false;
  return !props.some(p => Math.hypot(p.x - x, (p.y - y) * 1.5) < room + Math.min(240, p.width * p.scale * .5));
}
const behindDeck = (x, y) => walkways.some(w => {const t = Math.max(0, Math.min(1, ((x - w.a[0]) * (w.b[0] - w.a[0]) + (y - w.a[1]) * (w.b[1] - w.a[1])) / ((w.b[0] - w.a[0]) ** 2 + (w.b[1] - w.a[1]) ** 2))), px = w.a[0] + t * (w.b[0] - w.a[0]), py = w.a[1] + t * (w.b[1] - w.a[1]); return Math.abs(x - px) < 230 && y - py > -60 && y - py < 520;});
// a tall thing standing in front of a shop hides it: keep trees off the shop fronts
const shopFront = (x, y) => props.some(p => FOOT[p.asset] === 'bldg' && Math.abs(x - p.x) < p.width * p.scale * .7 && y > p.y - p.height * p.scale && y < p.y + 330);
let trees = 0;
for (let tries = 0; tries < 25000 && trees < 58; tries++) {
  const x = RX(), y = RY();
  if (shopFront(x, y) || !free(x, y, 220, 70) || behindDeck(x, y) || inOpen(x, y - 200, 0) || inOpen(x, y - 380, -40)) continue;
  put(['tree-1', 'tree-2', 'tree-blossom', 'tree-4', 'tree-5', 'tree-3', 'tree-2', 'tree-blossom'][trees % 8], [x, y], '', {world: true, flip: rnd() < .5, nudge: false}); trees++;
}
let bushes = 0;
for (let tries = 0; tries < 25000 && bushes < 60; tries++) {
  const x = RX(), y = RY();
  if (shopFront(x, y) || !free(x, y, 85, 55) || behindDeck(x, y)) continue;
  put(`bush-${1 + bushes % 6}`, [x, y], '', {world: true, flip: rnd() < .5, nudge: false}); bushes++;
}

// ---------- sleeping Duckies (boss 6 Nov): 40 on every themed island, home's poses ----------
seed = 2026;
const POSES = JSON.parse(readFileSync('src/pixi/sleep-poses.json', 'utf8')).poses;
const SR = Object.fromEntries(Object.entries(POSES).map(([n, p]) => [n, (p.box[2] - p.box[0]) * p.k * .81 * (.88 * .24 * 3) / 3 / 2]));
const sleepAvoid = [...PLAZAS, ...LAWNS].map(p => ({x: r1(p.x), y: r1(p.y), rx: r1(p.rx + 110), ry: r1(p.ry + 80)}));
for (const r of STALL_ROWS) for (let i = 0; i < r.mid.length; i += 3) sleepAvoid.push({x: r.mid[i][0], y: r.mid[i][1], rx: 240, ry: 180});
const sleepSpots = {nod: [], hammock: [], rock: [], leaf: [], book: [], chair: [], wing: [], box: []};
const SLEEP_N = {nod: 6, hammock: 3, rock: 4, leaf: 6, book: 6, chair: 3, wing: 7, box: 5};
{
  const geoS = geometry({coast: WALK_COAST, obstacles, walkways, bridges, islets, water});
  const coastD = (x, y) => Math.min(...EDGE.map((a, i) => segDist(x, y, a, EDGE[(i + 1) % EDGE.length])));
  const pathD = (x, y) => Math.min(...PATHS.map(p => lineDist(x, y, p.line)));
  const solid = props.filter(p => !/lily/i.test(p.asset));
  const halfW = p => p.width * p.scale / 2;
  const avoided = (x, y) => sleepAvoid.some(e => ((x - e.x) / e.rx) ** 2 + ((y - e.y) / e.ry) ** 2 < 1);
  const LAWN_IN = offset(GRASS, 60);
  const placed = SLEEPERS;
  const crowded = (x, y, r, pose) => placed.some(o => Math.hypot(o.x - x, (o.y - y) * 1.3) < Math.max(300, o.r + r + 100) + 40 || (o.pose === pose && Math.hypot(o.x - x, o.y - y) < (pose === 'chair' ? 600 : 760)));
  const why = (x, y, r, pose) => {
    if (!geoS.walkable(x, y) || !geoS.walkable(x - r * .8, y) || !geoS.walkable(x + r * .8, y)) return 'not ground';
    if (islets.some(a => ((x - a[0]) / (a[2] + 60)) ** 2 + ((y - a[1]) / (a[3] + 60)) ** 2 < 1)) return 'islet';
    if (walkways.some(b => segDist(x, y, b.a, b.b) < b.w / 2 + 90)) return 'deck';
    if (Math.hypot(x - hFoot[0], y - hFoot[1]) < 300) return 'harbor';
    if (PATHS.some(p => lineDist(x, y, p.line) < Math.max(60 + r * .35, p.w / 2 + r * .75 + 30))) return 'path';
    if (pose !== 'chair' && !inPolyF(x, y, LAWN_IN)) return 'quay';
    if (avoided(x, y)) return 'avoid';
    if (inPolyF(x, y, offset(BASIN, -(r + 60))) || ((x - POND.x) / (POND.rx + r + 60)) ** 2 + ((y - POND.y) / (POND.ry + r + 50)) ** 2 < 1) return 'water';
    if (coastD(x, y) < r * .6 + 70) return 'coast';
    if (solid.some(p => Math.hypot(x - p.x, (y - p.y) * 1.6) < halfW(p) * .8 + r + 12
      || (p.y > y - 20 && p.y - y < p.height * p.scale * .9 + 40 && Math.abs(x - p.x) < halfW(p) + r * .7))) return 'prop';
    return crowded(x, y, r, pose) ? 'near' : null;
  };
  const randomIn = (bb, n, test) => [...Array(n)].map(() => ({x: bb.x0 + rnd() * (bb.x1 - bb.x0), y: bb.y0 + rnd() * (bb.y1 - bb.y0), w: 0})).filter(p => test(p.x, p.y));
  const lawn = (x, y) => !inPolyF(x, y, BEACH);
  const anchorsOf = {
    chair: () => randomIn(BEACH_BB, 2500, (x, y) => inPolyF(x, y, BEACH)),
    book: () => props.filter(p => /shop-|kiosk|vending|capsule|sign-board|lantern-arch|planter-box|bench|umbrella/.test(p.asset) && p.zone !== 'islets' && p.zone !== 'beach'),
    hammock: () => props.filter(p => kindOf(p.asset) === 'tree' && !p.zone),
    rock: () => props.filter(p => kindOf(p.asset) === 'bush'),
    leaf: () => [...props.filter(p => kindOf(p.asset) === 'bush' && lawn(p.x, p.y)).sort(() => rnd() - .5), ...props.filter(p => kindOf(p.asset) === 'tree' && !p.zone), ...randomIn(BB, 6000, lawn)],
    wing: () => randomIn(BB, 90000, lawn),
    box: () => [...props.filter(p => /vending|shop-/.test(p.asset)), ...randomIn(BB, 30000, lawn)],
  };
  for (const pose of ['chair', 'book', 'nod', 'hammock', 'rock', 'leaf', 'box', 'wing']) {
    const r = SR[pose];
    if (pose === 'nod') {
      const trees = props.filter(p => kindOf(p.asset) === 'tree' && !p.zone).sort(() => rnd() - .5);
      for (const t of trees) {
        if (sleepSpots.nod.length >= SLEEP_N.nod) break;
        const x = t.x, y = t.y + 14;
        if (!inPolyF(x, y + 30, LAWN_IN) || !geoS.walkable(x, y + 30) || !geoS.walkable(x - r, y + 30) || !geoS.walkable(x + r, y + 30) || pathD(x, y) < MINOR / 2 + r + 20 || avoided(x, y) || coastD(x, y) < 200) continue;
        if (solid.some(p => p !== t && ((p.y > y - 10 && p.y - y < p.height * p.scale * .9 && Math.abs(x - p.x) < halfW(p) + r * .6) || Math.hypot(x - p.x, (y - p.y) * 1.6) < halfW(p) * .6 + r))) continue;
        if (crowded(x, y, r, 'nod')) continue;
        sleepSpots.nod.push([t.id, 0, rnd() < .5]); placed.push({x, y, r, pose});
      }
      continue;
    }
    const anchors = pose === 'leaf' || pose === 'box' ? anchorsOf[pose]() : anchorsOf[pose]().sort(() => rnd() - .5);
    for (const a of anchors) {
      if (sleepSpots[pose].length >= SLEEP_N[pose]) break;
      const base = a.w === 0 ? 0 : halfW(a) * .8 + r + 30;
      let got = null;
      for (const dist of a.w === 0 ? [0] : [base, base + 40, base + 90]) for (const ang of [0, Math.PI, .5, Math.PI - .5, -.5, Math.PI + .5, Math.PI / 2]) {
        if (got) break;
        const x = r1(a.x + Math.cos(ang) * dist), y = r1(a.y + Math.sin(ang) * dist * .62 + (a.w === 0 ? 0 : 10));
        if (!why(x, y, r, pose)) got = [x, y];
      }
      if (!got) continue;
      const flip = pose === 'chair' ? true : a.w === 0 ? rnd() < .5 : got[0] > a.x;
      sleepSpots[pose].push([got[0], got[1], flip]); placed.push({x: got[0], y: got[1], r, pose});
    }
  }
  for (const [k, n] of Object.entries(SLEEP_N)) if (sleepSpots[k].length < n) warn.push(`sleep ${k}: only ${sleepSpots[k].length} of ${n}`);
}
let flowers = 0;
for (let tries = 0; tries < 8000 && flowers < 170; tries++) {
  const x = RX(), y = RY();
  if (!free(x, y, 40, 40)) continue;
  put(`flower-${1 + flowers % 3}`, [x, y], '', {world: true, nudge: false}); flowers++;
}
let planters = 0;
for (let tries = 0; tries < 8000 && planters < 18; tries++) {
  const x = RX(), y = RY();
  if (shopFront(x, y) || !free(x, y, 90, 30)) continue;
  put(['planter-box', 'bin-litter', 'planter-box'][planters % 3], [x, y], '', {world: true, flip: rnd() < .5, nudge: false}); planters++;
}

// ---------- flats (ground decals) ----------
const flats = [];
for (let n = 0, tries = 0; n < 600 && tries < 40000; tries++) {
  const x = RX(), y = RY();
  if (!inPolyF(x, y, offset(GRASS, 30)) || PATHS.some(p => lineDist(x, y, p.line) < p.w / 2 + 20) || inOpen(x, y, 20) || inPolyF(x, y, BEACH) || inPolyF(x, y, offset(BASIN, -60))) continue;
  if (((x - POND.x) / (POND.rx + 50)) ** 2 + ((y - POND.y) / (POND.ry + 40)) ** 2 < 1) continue;
  const k = ['grass-tuft-1', 'grass-tuft-2', 'grass-tuft-3', 'grass-tuft-1', 'flower-dot-1', 'flower-dot-2', 'flower-dot-3', 'pebble-1'][n % 8];
  const [w, h] = svgSize(`public/pixi-art/decals/${k}.svg`);
  flats.push({src: `reuse/${k}.svg`, x: r1(x), y: r1(y), width: w, height: h, flip: rnd() < .5}); n++;
}
for (let n = 0, tries = 0; n < 70 && tries < 8000; tries++) {
  const x = BEACH_BB.x0 + rnd() * (BEACH_BB.x1 - BEACH_BB.x0), y = BEACH_BB.y0 + rnd() * (BEACH_BB.y1 - BEACH_BB.y0);
  if (!inPolyF(x, y, BEACH) || !inPolyF(x, y, offset(EDGE, 60))) continue;
  const k = ['sand-speck-1', 'sand-speck-2'][n % 2], [w, h] = svgSize(`public/pixi-art/decals/${k}.svg`);
  flats.push({src: `reuse/${k}.svg`, x: r1(x), y: r1(y), width: w, height: h}); n++;
}

// ---------- ground SVG ----------
const C = {ink: '#2B2F4F', quayTop: '#DCD5EC', quayLine: '#C3BADB', quaySide: '#8F90B8', quayDark: '#5D6190', grass: '#86B064', grassShade: '#79A35A', grassDeep: '#5F8A4E',
  sand: '#F6D894', sandShade: '#DDB873', pave: '#CDBCD9', paveLine: '#B19FC2', paveRim: '#8A84AE', asphalt: '#6E7099', stripe: '#F6EFDC',
  water: '#5B83B8', waterHi: '#9DBDE6', basinWall: '#9A9CC0', halo: '#5A78A8', light: '#FFE08A', lightPink: '#FFB6CF'};
const g = [];
g.push(`<path d="${dz(EDGE)}" fill="${C.halo}" stroke="${C.halo}" stroke-width="130" stroke-linejoin="round" opacity=".6"/>`);
g.push(`<path d="${dz(EDGE)}" fill="none" stroke="${C.waterHi}" stroke-width="40" stroke-linejoin="round" opacity=".55"/>`);
for (const [cx, cy, rx, ry] of islets) g.push(`<ellipse cx="${cx}" cy="${cy + 14}" rx="${rx + 110}" ry="${ry + 90}" fill="${C.halo}" opacity=".6"/>`);
// the stone quay: dark foot, block side with joints, cream-lavender top with a curb line
const shift = (p, dy) => p.map(([x, y]) => [x, r1(y + dy)]);
g.push(`<path d="${dz(shift(EDGE, 52))}" fill="${C.quayDark}" stroke="${C.ink}" stroke-width="5" stroke-linejoin="round"/>`);
g.push(`<path d="${dz(shift(EDGE, 30))}" fill="${C.quaySide}" stroke="${C.ink}" stroke-width="4" stroke-linejoin="round"/>`);
{
  const j = []; for (let i = 0; i < EDGE.length; i += 3) {const [x, y] = EDGE[i]; j.push(`M${x} ${r1(y + 6)} L${x} ${r1(y + 46)}`);}
  g.push(`<path d="${j.join(' ')}" stroke="${C.quayDark}" stroke-width="4" opacity=".7"/>`);
}
g.push(`<path d="${dz(EDGE)}" fill="${C.quayTop}" stroke="${C.ink}" stroke-width="5" stroke-linejoin="round"/>`);
g.push(`<path d="${dz(offset(EDGE, 34))}" fill="none" stroke="${C.quayLine}" stroke-width="5"/>`);
g.push(`<path d="${dz(GRASS)}" fill="${C.grass}" stroke="${C.grassDeep}" stroke-width="6" stroke-linejoin="round"/>`);
for (let n = 0, tries = 0; n < 40 && tries < 3000; tries++) {
  const x = RX(), y = RY();
  if (!inPolyF(x, y, offset(GRASS, 200))) continue;
  g.push(`<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(90 + rnd() * 230)}" ry="${r1(40 + rnd() * 90)}" fill="${C.grassShade}" opacity=".7"/>`); n++;
}
// beach over the quay in the south-east cove
g.push(`<clipPath id="land"><path d="${dz(offset(EDGE, -2))}"/></clipPath><clipPath id="beachclip"><path d="${dz(BEACH)}"/></clipPath>`);
g.push(`<g clip-path="url(#beachclip)"><path d="${dz(offset(EDGE, -90))}" fill="${C.water}"/><path d="${dz(offset(EDGE, -20))}" fill="${C.waterHi}" opacity=".8"/><path d="${dz(EDGE)}" fill="${C.sandShade}"/><path d="${dz(offset(EDGE, 12))}" fill="${C.sand}"/>`
  + `<path d="${dz(offset(EDGE, -40))}" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-dasharray="70 50" opacity=".7"/></g>`);
g.push(`<g clip-path="url(#land)"><path d="${dz(BEACH)}" fill="none" stroke="${C.sandShade}" stroke-width="16"/></g>`);
// the basin quay apron (paved), under the paths
{const ap = offset(BASIN, -150); g.push(`<path d="${dz(ap)}" fill="${C.paveRim}"/><path d="${dz(offset(ap, 8))}" fill="${C.pave}"/>`);}
// paths and plazas: rim, paving
const pathLayer = (extra, color) => PATHS.map(p => `<path d="${d(p.line)}" fill="none" stroke="${color}" stroke-width="${p.w + extra}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
const plazaLayer = (extra, color) => PLAZAS.map(p => `<ellipse cx="${p.x}" cy="${p.y}" rx="${r1(p.rx + extra / 2)}" ry="${r1(p.ry + extra / 2)}" fill="${color}"/>`).join('');
g.push(pathLayer(16, C.grassDeep) + plazaLayer(16, C.grassDeep));
g.push(pathLayer(8, C.paveRim) + plazaLayer(8, C.paveRim));
g.push(pathLayer(0, C.pave) + plazaLayer(0, C.pave));
// paving joints along the paths (a light centre dash, like a city pavement)
g.push(PATHS.map(p => `<path d="${d(p.line)}" fill="none" stroke="${C.paveLine}" stroke-width="5" stroke-dasharray="40 60"/>`).join(''));
g.push(`<g clip-path="url(#land)"><path d="${dz(offset(BEACH, 70))}" fill="${C.sand}"/></g>`);
// Locked centre pieces are installed by neon-finish.mjs after the base map.
// open activity squares and lawns, stall rows
PLAZAS.forEach((p, i) => {
  if (p.pave !== 'tiles') return;
  g.push(`<clipPath id="pz${i}"><ellipse cx="${p.x}" cy="${p.y}" rx="${r1(p.rx - 26)}" ry="${r1(p.ry - 20)}"/></clipPath>`);
  g.push(`<ellipse cx="${p.x}" cy="${p.y}" rx="${r1(p.rx - 26)}" ry="${r1(p.ry - 20)}" fill="#D8CAE2" stroke="${C.paveLine}" stroke-width="5"/>`);
  const L = [];
  for (let x = p.x - p.rx; x < p.x + p.rx; x += 96) L.push(`M${r1(x)} ${r1(p.y - p.ry)} L${r1(x)} ${r1(p.y + p.ry)}`);
  for (let y = p.y - p.ry; y < p.y + p.ry; y += 64) L.push(`M${r1(p.x - p.rx)} ${r1(y)} L${r1(p.x + p.rx)} ${r1(y)}`);
  g.push(`<path d="${L.join(' ')}" stroke="${C.paveLine}" stroke-width="4" fill="none" clip-path="url(#pz${i})"/>`);
  g.push(`<ellipse cx="${p.x}" cy="${p.y}" rx="${r1(p.rx * .4)}" ry="${r1(p.ry * .4)}" fill="none" stroke="${C.lightPink}" stroke-width="10" opacity=".8"/>`);
});
LAWNS.forEach((a, i) => {
  g.push(`<clipPath id="lawn${i}"><ellipse cx="${a.x}" cy="${a.y}" rx="${r1(a.rx)}" ry="${r1(a.ry)}"/></clipPath>`);
  g.push(`<ellipse cx="${a.x}" cy="${a.y}" rx="${r1(a.rx)}" ry="${r1(a.ry)}" fill="#8FBA6B" stroke="${C.grassDeep}" stroke-width="5" stroke-dasharray="26 22"/>`);
  const st = []; for (let x = a.x - a.rx; x < a.x + a.rx; x += 110) st.push(`M${r1(x)} ${r1(a.y - a.ry)} L${r1(x + 70)} ${r1(a.y + a.ry)}`);
  g.push(`<path d="${st.join(' ')}" stroke="#9CC577" stroke-width="44" fill="none" clip-path="url(#lawn${i})" opacity=".7"/>`);
});
STALL_ROWS.forEach((r, i) => {
  g.push(`<path d="${dz(r.poly)}" fill="${C.paveRim}" stroke="${C.grassDeep}" stroke-width="10" stroke-linejoin="round"/>`);
  g.push(`<path d="${dz(r.poly)}" fill="#D8CAE2" stroke="${C.paveLine}" stroke-width="5" stroke-linejoin="round"/>`);
  g.push(`<clipPath id="stall${i}"><path d="${dz(r.poly)}"/></clipPath>`);
  const xs = r.poly.map(q => q[0]), ys = r.poly.map(q => q[1]), L = [];
  for (let x = Math.min(...xs); x < Math.max(...xs); x += 84) L.push(`M${r1(x)} ${Math.min(...ys)} L${r1(x)} ${Math.max(...ys)}`);
  for (let y = Math.min(...ys); y < Math.max(...ys); y += 64) L.push(`M${Math.min(...xs)} ${r1(y)} L${Math.max(...xs)} ${r1(y)}`);
  g.push(`<path d="${L.join(' ')}" stroke="${C.paveLine}" stroke-width="4" fill="none" clip-path="url(#stall${i})"/>`);
  g.push(`<path d="${d(r.mid)}" fill="none" stroke="${['#FFB937', '#F29BB7', '#6FD8C4'][i]}" stroke-width="8" stroke-dasharray="30 70" opacity=".85"/>`);
});
// harbour basin: stone wall, water, highlights
g.push(`<path d="${dz(offset(BASIN, -22))}" fill="${C.basinWall}" stroke="${C.ink}" stroke-width="5"/>`);
g.push(`<path d="${dz(shift(BASIN, 10))}" fill="${C.quayDark}"/>`);
g.push(`<path d="${dz(offset(BASIN, 4))}" fill="${C.water}" stroke="${C.ink}" stroke-width="4" opacity="1"/>`);
{const xs = BASIN.map(p => p[0]), ys = BASIN.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), L = [];
  for (let k = 0; k < 7; k++) {const y = y0 + 80 + k * (y1 - y0 - 160) / 6, x = x0 + 140 + ((k * 397) % (x1 - x0 - 500)); L.push(`M${r1(x)} ${r1(y)} L${r1(x + 160 + (k % 3) * 60)} ${r1(y)}`);}
  g.push(`<path d="${L.join(' ')}" stroke="${C.waterHi}" stroke-width="8" stroke-linecap="round"/>`);
  // warm sign reflections lying flat on the water (flat shapes, no glow)
  for (const [fx, col] of [[.18, C.lightPink], [.42, C.light], [.7, '#6FD8C4'], [.88, C.light]]) g.push(`<rect x="${r1(x0 + (x1 - x0) * fx)}" y="${r1(y0 + 40)}" width="34" height="${r1((y1 - y0) * .42)}" rx="14" fill="${col}" opacity=".45"/>`);
}
// pond
g.push(`<ellipse cx="${POND.x}" cy="${POND.y}" rx="${r1(POND.rx + 24)}" ry="${r1(POND.ry + 20)}" fill="${C.quayTop}" stroke="${C.ink}" stroke-width="4"/>`);
g.push(`<ellipse cx="${POND.x}" cy="${POND.y}" rx="${POND.rx}" ry="${POND.ry}" fill="${C.water}" stroke="${C.ink}" stroke-width="4"/>`);
g.push(`<path d="M${r1(POND.x - POND.rx * .6)} ${r1(POND.y - POND.ry * .35)} Q${POND.x} ${r1(POND.y - POND.ry * .75)} ${r1(POND.x + POND.rx * .5)} ${r1(POND.y - POND.ry * .4)}" fill="none" stroke="${C.waterHi}" stroke-width="8"/>`);
// islets: rounded stone blocks with a lawn top and a little paved round
for (const [cx, cy, rx, ry] of islets) {
  const blk = chaikin([[cx - rx - 40, cy - ry - 30], [cx + rx + 40, cy - ry - 30], [cx + rx + 40, cy + ry + 30], [cx - rx - 40, cy + ry + 30]], 4);
  g.push(`<path d="${dz(shift(blk, 46))}" fill="${C.quayDark}" stroke="${C.ink}" stroke-width="5"/><path d="${dz(shift(blk, 26))}" fill="${C.quaySide}" stroke="${C.ink}" stroke-width="4"/>`);
  g.push(`<path d="${dz(blk)}" fill="${C.quayTop}" stroke="${C.ink}" stroke-width="5"/>`);
  g.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx - 10}" ry="${ry - 12}" fill="${C.grass}" stroke="${C.grassDeep}" stroke-width="6"/>`);
  g.push(`<ellipse cx="${cx}" cy="${r1(cy + ry * .12)}" rx="${r1(rx * .5)}" ry="${r1(ry * .42)}" fill="${C.pave}" stroke="${C.paveRim}" stroke-width="6"/>`);
}
// flat warm light pools under every lamp and in front of every shop and kiosk (flat shapes, no glow)
for (const p of props) {
  if (p.asset === 'neon-lamp') g.push(`<ellipse cx="${p.x}" cy="${r1(p.y + 6)}" rx="96" ry="40" fill="${C.light}" opacity=".35"/>`);
  else if (/^shop-|kiosk/.test(p.asset)) g.push(`<ellipse cx="${p.x}" cy="${r1(p.y + 34)}" rx="${r1(p.width * p.scale * .42)}" ry="70" fill="${p.asset === 'shop-cat' || p.asset === 'shop-noodle' ? C.lightPink : C.light}" opacity=".32"/>`);
}
g.push(`<ellipse cx="${hFoot[0]}" cy="${r1(hFoot[1] - 40)}" rx="160" ry="74" fill="${C.pave}" stroke="${C.paveRim}" stroke-width="6"/>`);
const foam = [];
const FO = offset(EDGE, -95);
for (let i = 0; i < FO.length; i += 9) if (rnd() < .6) {const o = FO[i], o2 = FO[(i + 3) % FO.length]; foam.push(`M${o[0]} ${o[1]} L${o2[0]} ${o2[1]}`);}
g.push(`<path d="${foam.join(' ')}" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" opacity=".45" fill="none"/>`);

// ---------- map size: every piece of land and every mooring with 400+ of open sea round it ----------
const harborBoats = () => [
  {x: hTip[0] - 150, y: hTip[1] - 60, turn: Math.PI}, {x: hTip[0] + 150, y: hTip[1] - 40, turn: Math.PI}, {x: hTip[0] - 480, y: hTip[1] + 10, turn: Math.PI},
  {x: west.b[0] - 40, y: west.b[1] + 160, turn: -Math.PI / 2}, {x: east.b[0] + 40, y: east.b[1] + 160, turn: Math.PI / 2},
  {x: north.a[0] + 150, y: north.a[1] - 20, turn: Math.PI}, {x: north.a[0] - 160, y: north.a[1] + 20, turn: Math.PI},
  ...islets.map(([cx, cy, rx, ry], i) => ({x: cx + (i ? 1 : -1) * (rx + 200), y: cy - 10, turn: i ? Math.PI / 2 : -Math.PI / 2})),
].map(b => ({x: r1(b.x), y: r1(b.y), turn: r1(b.turn * 1e4) / 1e4}));
const boats = harborBoats();
const ext = [...EDGE, ...islets.flatMap(i => [[i[0] - i[2] - 40, i[1] - i[3] - 30], [i[0] + i[2] + 40, i[1] + i[3] + 80]]), ...boats.map(b => [b.x, b.y]), hTip, west.b, east.b, north.a];
const W = Math.ceil(Math.max(...ext.map(p => p[0])) + 420), HH = Math.ceil(Math.max(...ext.map(p => p[1])) + 420);
if (Math.min(...ext.map(p => p[0])) < 350 || Math.min(...ext.map(p => p[1])) < 350) console.log('MOVE OX/OY: min', Math.min(...ext.map(p => p[0])), Math.min(...ext.map(p => p[1])));

const body = g.join('\n');
const head = (vb, w, h, t) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb}" stroke-linecap="round" stroke-linejoin="round">\n<title>${t}</title>\n<desc>Tickytown (neon city at dusk) ground: stone quay coast, lawn, lavender paving, the round centre crossing, the harbour basin. Built by scripts/themes/neon-world.mjs. World coordinates.</desc>\n`;
writeFileSync(ART + 'ground.svg', head(`0 0 ${W} ${HH}`, W, HH, 'Tickytown ground') + body + '\n</svg>\n');
const tiles = [];
const TC = Math.ceil(W / 1450), TR = Math.ceil(HH / 1467), TW = Math.ceil(W / TC), TH = Math.ceil(HH / TR);
for (let r = 0; r < TR; r++) for (let c = 0; c < TC; c++) {
  const x = c * TW, y = r * TH, w = Math.min(TW, W - x), h = Math.min(TH, HH - y);
  writeFileSync(`${ART}ground-r${r}-c${c}.svg`, head(`${x} ${y} ${w} ${h}`, w, h, `Tickytown ground tile ${r + 1}, ${c + 1}`) + body + '\n</svg>\n');
  tiles.push({src: `ground-r${r}-c${c}.svg`, x, y, width: w, height: h});
}

// ---------- data ----------
const zones = {};
for (const [k, c] of Object.entries(SPAWNS_C)) {const [x, y] = T(c); zones[k] = {x: r1(x), y: r1(y), spawn: [r1(x), r1(y)]};}
zones.islets = {x: islets[0][0], y: islets[0][1], spawn: [islets[0][0], r1(islets[0][1] + 40)]};
// boss 6 Nov: the centre plaza; its landmark (now the placeholder clock tower, prop id below) is swapped when the boss picks one
zones.centre = {name: 'Centre crossing', x: r1(CENTRE.x), y: r1(CENTRE.y), rx: r1(CENTRE.rx), ry: r1(CENTRE.ry), spawn: zones.plaza.spawn, landmark: tower.id, placeholder: true};
for (const a of ACT) zones[a.id] = {name: a.name, kind: a.kind === 'lawn' ? 'lawn' : 'paved', x: r1(a.x), y: r1(a.y), rx: r1(a.rx), ry: r1(a.ry), spawn: [r1(a.x), r1(a.y)]};
for (const r of STALL_ROWS) zones[r.id] = {name: r.name, kind: 'stall-row', x: r.x, y: r.y, poly: r.poly, line: r.mid, spawn: [r.x, r.y]};
const world = {width: W, height: HH, theme: 'neon', name: 'Tickytown', coast: EDGE, water, bridges, obstacles: [], islets, walkways, arches, zones, sleepSpots, sleepAvoid,
  props: props.map(p => ({name: p.name, x: p.x, y: p.y, zone: p.zone}))};
const walk = {width: W, height: HH, coast: WALK_COAST, obstacles, walkways, bridges, islets, water};
const harbor = {jetty: {foot: hFoot.map(r1), tip: hTip.map(r1), width: 104}, boats, spawn: zones.plaza.spawn};
const art = {width: W, height: HH, sea: '#405B87', ground: {tiles}, decks, flats,
  props: props.map(({id, name, src, x, y, width, height, anchor, scale, flip}) => ({id, name, src, x, y, width, height, anchor, scale, flip}))};
writeFileSync(DATA + 'world.json', JSON.stringify(world));
writeFileSync(DATA + 'walk-world.json', JSON.stringify(walk));
writeFileSync(DATA + 'harbor.json', JSON.stringify(harbor, null, 1));
writeFileSync(DATA + 'placements.json', JSON.stringify(props, null, 0));
writeFileSync(DATA + 'paths.json', JSON.stringify(PATHS.map(p => p.line)));
writeFileSync(ART + 'art.json', JSON.stringify(art, null, 1));

// ---------- checks ----------
for (const p of props) {
  const inA = ACT.find(a => ((p.x - a.x) / a.rx) ** 2 + ((p.y - a.y) / a.ry) ** 2 < 1), inS = STALL_ROWS.find(r => inPolyF(p.x, p.y, r.poly));
  if (inA || inS) warn.push(`${p.asset} ${p.id} stands on open area ${(inA || inS).id}`);
  if (p.zone !== 'islets' && walkways.some(w => segDist(p.x, p.y, w.a, w.b) < w.w / 2 + 30)) warn.push(`${p.asset} ${p.id} stands on a deck`);
}
const geo = geometry(walk);
const errs = [];
const bare = geometry({...walk, obstacles: []});
for (const p of props) if (!/flower|lily|reeds|towel|shell|starfish/.test(p.asset) && !bare.walkable(p.x, p.y - 4)) errs.push(`${p.asset} ${p.id} not on walkable land (${p.x},${p.y})`);
for (const [k, z] of Object.entries(zones)) if (!geo.walkable(...z.spawn)) errs.push(`zone ${k} spawn not walkable`);
const landAt = (x, y) => inPolyF(x, y, EDGE) || islets.some(a => ((x - a[0]) / a[2]) ** 2 + ((y - a[1]) / a[3]) ** 2 < 1);
if (landAt(...hTip)) errs.push('harbor tip on land');
for (const b of boats) if (landAt(b.x, b.y)) errs.push('boat on land ' + JSON.stringify(b));
for (let i = 0; i < boats.length; i++) for (let j = i + 1; j < boats.length; j++) if (Math.hypot(boats[i].x - boats[j].x, boats[i].y - boats[j].y) < 300) errs.push(`boats ${i},${j} closer than 300`);
const STEP = 24, GW = Math.ceil(W / STEP), GH = Math.ceil(HH / STEP), ok = new Uint8Array(GW * GH), seen = new Uint8Array(GW * GH);
for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) ok[j * GW + i] = geo.walkable(i * STEP + STEP / 2, j * STEP + STEP / 2) ? 1 : 0;
const cell = ([x, y]) => Math.floor(y / STEP) * GW + Math.floor(x / STEP);
const q = [cell(zones.plaza.spawn)]; seen[q[0]] = 1;
while (q.length) {const c = q.pop(), i = c % GW, j = (c - i) / GW; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {const n = (j + dj) * GW + i + di; if (i + di >= 0 && i + di < GW && j + dj >= 0 && j + dj < GH && ok[n] && !seen[n]) {seen[n] = 1; q.push(n);}}}
let reach = 0, total = 0; for (let k = 0; k < ok.length; k++) {total += ok[k]; reach += seen[k];}
for (const [k, z] of Object.entries(zones)) if (!seen[cell(z.spawn)]) errs.push(`zone ${k} not reachable from the plaza`);
for (const [n, p] of PATHS.entries()) {const bad = p.line.filter(q => !geo.walkable(...q) && ((q[0] - CENTRE.x) / CENTRE.rx) ** 2 + ((q[1] - CENTRE.y) / CENTRE.ry) ** 2 > 1); if (bad.length > 2) errs.push(`path ${n}: ${bad.length} centre points blocked e.g. ${bad[0]}`);}
for (const w of walkways) if (!seen[cell(w.b)] && !seen[cell(w.a)]) errs.push('walkway unreachable ' + JSON.stringify(w.a));
const sleepers = Object.values(sleepSpots).reduce((s, l) => s + l.length, 0);
console.log(`map ${W} x ${HH}, coast area ${(Math.abs(area(EDGE)) / 1e6).toFixed(2)}M (home 11.09M), walkable ${(total * STEP * STEP / 1e6).toFixed(1)}M, reachable ${(100 * reach / total).toFixed(1)}%`);
console.log(`props ${props.length} (trees ${trees}, bushes ${bushes}, flowers ${flowers}, lamps ${LAMPS.length}), flats ${flats.length}, obstacles ${obstacles.length}, decks ${decks.length}, sleepers ${sleepers}`);
if (warn.length) console.log('warnings:\n  ' + warn.join('\n  '));
console.log(errs.length ? 'PROBLEMS:\n  ' + errs.join('\n  ') : 'walk map OK');
