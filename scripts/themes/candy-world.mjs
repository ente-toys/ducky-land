// Candy Coast (theme id `candy`, "Candy Coast"): builds the whole island from the approved concept
// (concepts/themes/concepts/04-candy.png) in one pass, following concepts/themes/THEME-CONTRACT.md. Same build as
// scripts/themes/library-world.mjs (its helpers and checks), with the candy's own coast, places and props:
//   public/pixi-art/themes/candy/  ground.svg, ground-rN-cN.svg tiles, deck SVGs, reuse/ (home props copied in), art.json
//   rive/web/themes/candy/         world.json, walk-world.json, harbor.json, placements.json, paths.json
// The layout is written in CONCEPT pixels (1536x1024 picture) and mapped to world units by T().
// Run:  node scripts/themes/candy-world.mjs   (then node scripts/themes/candy-preview.mjs)
// Boss 6 Nov: BIG and spacious (land ~1.8x home), wide paths, a big round centre plaza (zones.centre) whose landmark is a
// The base pass reserves stable prop ids; candy-centre and candy-finish install locked Candy 5, 40 sleepers and clear activity areas
// (activity-N) and open stall rows (stalls-N) left empty for later.
import {readFileSync, writeFileSync, mkdirSync, copyFileSync} from 'node:fs';
import {geometry} from '../../rive/web/island-geometry.mjs';

const ART = 'public/pixi-art/themes/candy/', DATA = 'rive/web/themes/candy/';
mkdirSync(ART + 'reuse', {recursive: true}); mkdirSync(DATA, {recursive: true});
const W = 7250, HH = 4850, S = 4.5, OX = 420, OY = 420;
const r1 = v => Math.round(v * 10) / 10;
const T = ([x, y]) => [r1(OX + (x - 60) * S), r1(OY + (y - 35) * S)];
const TS = v => v * S;

// ---------- geometry helpers (as library-world.mjs) ----------
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
const area = p => p.reduce((s, a, i) => {const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1];}, 0) / 2;
function offset(p, d) {   // d > 0 moves a closed polygon INWARD
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
let seed = 404; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

// ---------- coast (concept px): the round-cornered candy island of the concept, a beach cove in the south-east ----------
const COAST_C = [[145,148],[258,104],[370,70],[500,86],[620,57],[736,35],[866,72],[1008,60],[1130,54],[1250,91],[1378,124],[1432,205],[1468,321],[1445,432],[1472,540],[1451,663],[1360,750],[1240,792],[1132,814],[1020,789],[908,814],[800,784],[694,813],[576,789],[458,810],[342,783],[235,752],[146,704],[104,615],[80,516],[98,418],[78,325],[110,244]];
const EDGE = catmull(COAST_C.map(T), true, 8);   // where the land ends (sand)
const GRASS = offset(EDGE, 95);                  // the lawn starts inside a sand shore, like home
const WALK_COAST = offset(EDGE, 35);              // the walk map: inset 35 like home

// ---------- pond (west garden) ----------
const POND = {x: T([292, 446])[0], y: T([292, 446])[1], rx: TS(78), ry: TS(36)};

// ---------- paths (concept px) ----------
const MAIN = 220, MINOR = 186;   // boss 6 Nov: home's paths are ~120 wide; these are 1.5x to 1.8x
const PATHS_C = [
  [[655,500],[590,430],[530,350],[488,284]],                                          // 0 centre -> teacup garden
  [[865,500],[930,430],[1000,350],[1052,276]],                                        // 1 centre -> falls
  [[508,190],[600,140],[700,118],[820,118],[930,135],[1010,176]],                     // 2 north walk behind the cupcake
  [[1168,196],[1260,170],[1360,176],[1462,214]],                                      // 3 falls -> north-east pier
  [[336,202],[250,190],[180,192],[145,180]],                                           // 4 teacup garden -> north-west pier
  [[612,566],[500,548],[400,530],[300,536],[200,548],[96,560]],                      // 5 centre -> pond garden -> west lookout
  [[910,566],[1010,520],[1080,460],[1128,420]],                                       // 6 centre -> parade square
  [[160,700],[320,676],[480,693],[640,724],[760,718],[880,693],[1040,690],[1180,712],[1280,694]],   // 7 the candy lane (stalls)
  [[760,610],[760,702]],                                                             // 8 centre -> candy lane
  [[512,690],[512,812]],                                                             // 9 candy lane -> west islet bridge
  [[1000,690],[1000,812]],                                                           // 10 candy lane -> east islet bridge
  [[210,548],[192,620],[160,700]],                                                   // 11 pond garden -> candy lane
  [[1290,452],[1310,530],[1320,600]],                                                // 12 parade square -> beach
  [[160,700],[176,735]],                                                             // 13 candy lane -> harbor jetty
];
const PATHS = PATHS_C.map((l, i) => ({line: catmull(l.map(T), false, 8), w: [0, 1, 7, 8, 13].includes(i) ? MAIN : MINOR}));
// plazas [cx, cy, rx, ry] concept px
const CENTRE_C = [760, 550, 180, 90];
const PLAZAS = [
  {id: 'centre', c: CENTRE_C, pave: 'centre'},     // the big round centre plaza (landmark: placeholder)
  {id: 'sugarGarden', c: [425, 232, 100, 52], pave: 'rings'},
  {id: 'falls', c: [1092, 226, 96, 50], pave: 'rings'},
  {id: 'cupcake-steps', c: [760, 452, 70, 22], pave: 'tiles'},
].map(p => ({...p, x: T(p.c)[0], y: T(p.c)[1], rx: TS(p.c[2]), ry: TS(p.c[3])}));
// boss 6 Nov: OPEN areas for later activities (30+ Duckies each), nothing placed on them
const ACT = [
  {id: 'activity-1', name: 'West lawn', c: [226, 318, 86, 56], kind: 'lawn'},
  {id: 'activity-2', name: 'Parade square', c: [1236, 406, 104, 54], kind: 'tiles'},
  {id: 'activity-3', name: 'Ribbon lawn', c: [470, 618, 82, 38], kind: 'lawn'},
  {id: 'activity-4', name: 'Fireworks lawn', c: [1086, 600, 78, 42], kind: 'lawn'},
].map(a => ({...a, x: T(a.c)[0], y: T(a.c)[1], rx: TS(a.c[2]), ry: TS(a.c[3])}));
for (const a of ACT) if (a.kind !== 'lawn') PLAZAS.push({id: a.id, c: a.c, pave: a.kind, x: a.x, y: a.y, rx: a.rx, ry: a.ry, open: true});
const LAWNS = ACT.filter(a => a.kind === 'lawn');
// open stall rows: paved bands along the candy lane, left empty for later stalls
const STALL_ROWS = [
  {id: 'stalls-1', name: 'Candy lane stall row (north-west)', path: 7, t: [.12, .4], side: -1},
  {id: 'stalls-2', name: 'Candy lane stall row (north-east)', path: 7, t: [.6, .9], side: -1},
  {id: 'stalls-3', name: 'Candy lane stall row (south)', path: 7, t: [.62, .86], side: 1},
].map(r => {
  const l = PATHS[r.path].line, i0 = Math.round(r.t[0] * (l.length - 1)), i1 = Math.round(r.t[1] * (l.length - 1)), seg = l.slice(i0, i1 + 1);
  const off = k => seg.map((a, i) => {const pr = seg[Math.max(0, i - 1)], nx = seg[Math.min(seg.length - 1, i + 1)], tx = nx[0] - pr[0], ty = nx[1] - pr[1], L = Math.hypot(tx, ty) || 1; return [r1(a[0] - r.side * ty / L * k), r1(a[1] + r.side * tx / L * k)];});
  const inner = off(PATHS[r.path].w / 2 - 6), outer = off(PATHS[r.path].w / 2 + 200), mid = off(PATHS[r.path].w / 2 + 100);
  return {...r, poly: [...inner, ...outer.reverse()], mid, x: mid[mid.length >> 1][0], y: mid[mid.length >> 1][1]};
});
// the south-east beach (sand over the lawn, clipped to the land)
const BEACH = catmull([[1200,560],[1290,522],[1420,500],[1520,540],[1520,800],[1380,840],[1250,850],[1170,780],[1160,650]].map(T), true, 8);
const BEACH_BB = {x0: Math.min(...BEACH.map(p => p[0])), x1: Math.max(...BEACH.map(p => p[0])), y0: Math.min(...BEACH.map(p => p[1])), y1: Math.max(...BEACH.map(p => p[1]))};

// ---------- islets, jetties, bridges ----------
const BB = {x0: Math.min(...EDGE.map(p => p[0])), x1: Math.max(...EDGE.map(p => p[0])), y0: Math.min(...EDGE.map(p => p[1])), y1: Math.max(...EDGE.map(p => p[1]))};
const MIDX = (BB.x0 + BB.x1) / 2, MIDY = (BB.y0 + BB.y1) / 2;
const coastBotAt = x => Math.max(...EDGE.filter(p => Math.abs(p[0] - x) < 40 && p[1] > MIDY).map(p => p[1]));
const coastLeftAt = y => Math.min(...EDGE.filter(p => Math.abs(p[1] - y) < 40 && p[0] < MIDX).map(p => p[0]));
const coastRightAt = y => Math.max(...EDGE.filter(p => Math.abs(p[1] - y) < 40 && p[0] > MIDX).map(p => p[0]));
const RX = () => BB.x0 + rnd() * (BB.x1 - BB.x0), RY = () => BB.y0 + rnd() * (BB.y1 - BB.y0);
const ISLET_RX = 380, ISLET_RY = 150, BR_LEN = 411 * .75;
const islets = [], walkways = [], decks = [], arches = [];
const JETTY1 = {file: 'public/pixi-art/bridge-jetty-1.svg', vb: [3222.39, 3276.877, 229.2164, 476.233], a: [3320, 3319], b: [3320, 3730], w: 115};
const JETTY5 = {file: 'public/pixi-art/bridge-jetty-5.svg', vb: [5004.9592, 1492.5089, 494.0617, 277.2587], a: [5034.08, 1638.41], b: [5469.9, 1681.99], w: 84};
function deck(name, J, at, sx, sy) {
  const inner = readFileSync(J.file, 'utf8').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const [vx, vy, vw, vh] = J.vb, map = ([x, y]) => [at[0] + (x - J.a[0]) * sx, at[1] + (y - J.a[1]) * sy];
  const c1 = map([vx, vy]), c2 = map([vx + vw, vy + vh]);
  const x0 = Math.min(c1[0], c2[0]), y0 = Math.min(c1[1], c2[1]), w = Math.abs(c2[0] - c1[0]), h = Math.abs(c2[1] - c1[1]);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${r1(w)}" height="${r1(h)}" viewBox="${r1(x0)} ${r1(y0)} ${r1(w)} ${r1(h)}" stroke-linecap="round" stroke-linejoin="round">\n<title>Candy Coast ${name} (home jetty art, re-placed)</title>\n<g transform="translate(${r1(at[0])} ${r1(at[1])}) scale(${sx} ${sy}) translate(${-J.a[0]} ${-J.a[1]})">${inner}</g></svg>\n`;
  writeFileSync(ART + name + '.svg', svg);
  decks.push({src: name + '.svg', x: r1(x0), y: r1(y0), width: r1(w), height: r1(h)});
  const b = map(J.b);
  walkways.push({a: [r1(at[0]), r1(at[1])], b: [r1(b[0]), r1(b[1])], w: J.w});
  arches.push({a: [r1(at[0]), r1(at[1])], b: [r1(b[0]), r1(b[1])], r: r1(70 * Math.abs(sy)), w: J.w});
  return {a: at, b};
}
// two south islets, each joined by an arched wooden bridge from the end of a path (foot on the coast, arch out to the islet)
for (const [i, cx] of [[1, 512], [2, 1000]]) {
  const fx = T([cx, 0])[0], fy = coastBotAt(fx) - 40;
  const br = deck(`islet-bridge-${i}`, {...JETTY1, a: JETTY1.b, b: JETTY1.a}, [fx, fy], 1, -.75);
  islets.push([r1(fx), r1(br.b[1] + ISLET_RY * .45), ISLET_RX, ISLET_RY]);
}
// north-west + north-east piers (home jetty 5, 70%), south-east pier off the beach (home jetty 1, flipped south)
const nwy = T([0, 172])[1], ney = T([0, 212])[1];
const west = deck('jetty-northwest', JETTY5, [coastLeftAt(nwy) + 40, nwy], -.7, 1);
const east = deck('jetty-northeast', JETTY5, [coastRightAt(ney) - 40, ney], .7, 1);
const sx = T([1380, 0])[0], sFoot = [sx, coastBotAt(sx) - 30];
const south = deck('jetty-southeast', {...JETTY1, a: JETTY1.b, b: JETTY1.a}, sFoot, 1, -.8);
// the harbor jetty (drawn by the engine) runs south from the candy lane's west end
const hx = T([190, 0])[0], hFoot = [hx, coastBotAt(hx) - 40], hTip = [hx, hFoot[1] + 360];

PATHS[13].line = catmull([T([160,700]), hFoot], false, 8);
PATHS[3].line = catmull([T([1168,196]), T([1260,182]), T([1360,190]), east.a], false, 8);

// ---------- inland water ----------
const water = [{x: POND.x, y: POND.y, rx: POND.rx, ry: POND.ry}];
const bridges = [];

// ---------- props ----------
const onPath = (n, t) => {const l = PATHS[n].line; return l[Math.round(t * (l.length - 1))];};
const SPAWNS_C = {plaza: [760, 650], sugarGarden: [425, 270], falls: [1092, 262], 'pond-garden': [300, 506], 'candy-lane': [640, 696], beach: [1330, 640], cupcake: [760, 470], 'north-walk': [760, 118]};
const warn = [], props = [], obstacles = [];
let pid = 0;
const ASSET = {};
function asset(name, src, w, h, ay = 1) {ASSET[name] = {src, w, h, ax: .5, ay};}
const svgSize = f => {const s = readFileSync(f, 'utf8').slice(0, 600), m = s.match(/viewBox="([\d.\s-]+)"/); const v = m[1].trim().split(/\s+/).map(Number); return [v[2], v[3]];};
const OWN = ['cupcake', 'centre-placeholder', 'sugar-playground', 'falls', 'sundae-kiosk', 'stall-pink', 'stall-blue', 'stall-yellow', 'stall-mint', 'bakery-kiosk',
  'candy-arch', 'lollipop-tree', 'bunting', 'candy-lamp', 'gumdrop-planter', 'bouquets'];
for (const n of OWN) {const [w, h] = svgSize(ART + n + '.svg'); asset(n, n + '.svg', w, h, (h - 6) / h);}
const REUSE = {plants: ['tree-1', 'tree-2', 'tree-3', 'tree-4', 'tree-5', 'bush-1', 'bush-2', 'bush-3', 'bush-4', 'bush-5', 'bush-6', 'flower-1', 'flower-2', 'flower-3'],
  detail: ['street--bench-wood', 'street--bench-park', 'street--umbrella-garden', 'street--umbrella-cafe', 'beach--towel-striped', 'beach--towel-sun', 'beach--beach-ball',
    'beach--shell-scallop', 'beach--starfish-orange', 'beach--sandcastle-small', 'beach--bucket', 'nature--reeds', 'nature--cattails', 'nature--lily-pad-flower', 'nature--lily-pad-large',
    'nature--rock-round', 'street--picnic-blanket'],
  decals: ['grass-tuft-1', 'grass-tuft-2', 'grass-tuft-3', 'flower-dot-1', 'flower-dot-2', 'flower-dot-3', 'pebble-1', 'sand-speck-1', 'sand-speck-2']};
const manifest = JSON.parse(readFileSync('assets/manifest.json', 'utf8'));
for (const [dir, list] of Object.entries(REUSE)) for (const n of list) {
  copyFileSync(`public/pixi-art/${dir}/${n}.svg`, `${ART}reuse/${n}.svg`);
  const key = n.includes('--') ? n.split('--')[1] : n;
  if (dir === 'detail') {const a = manifest.assets.find(x => x.name === key); asset(key, `reuse/${n}.svg`, a.size.width, a.size.height, a.anchor.y / a.size.height);}
  else {const [w, h] = svgSize(`public/pixi-art/${dir}/${n}.svg`); asset(key, `reuse/${n}.svg`, w, h, 1);}
}
// world size of each kind (one Ducky = 130 tall)
const SCALE = {cupcake: 1.12, 'centre-placeholder': 1, 'sugar-playground': 1.12, falls: 1.18, 'sundae-kiosk': .92, 'stall-pink': 1, 'stall-blue': 1, 'stall-yellow': 1, 'stall-mint': 1,
  'bakery-kiosk': .9, 'candy-arch': .85, 'lollipop-tree': .5, bunting: .62, 'candy-lamp': .46, 'gumdrop-planter': .44, bouquets: .5,
  tree: 1.265, bush: 1.3, flower: 1.6, 'bench-wood': .18, 'bench-park': .18, 'umbrella-garden': .29, 'umbrella-cafe': .29, 'towel-striped': .26, 'towel-sun': .26,
  'beach-ball': .2, 'shell-scallop': .19, 'starfish-orange': .19, 'sandcastle-small': .24, bucket: .17, reeds: .24, cattails: .24, 'lily-pad-flower': .2, 'lily-pad-large': .2,
  'rock-round': .2, 'picnic-blanket': .3};
const FOOT = {cupcake: 'hall', 'candy-arch': 'arch', bunting: 'arch', 'lollipop-tree': 'pole', 'candy-lamp': 'pole', bouquets: 'pole', 'towel-striped': 'none', 'towel-sun': 'none', 'picnic-blanket': 'none',
  'lily-pad-flower': 'none', 'lily-pad-large': 'none', 'shell-scallop': 'none', 'starfish-orange': 'none', 'beach-ball': 'low', reeds: 'none', cattails: 'none', flower: 'none', 'umbrella-garden': 'pole', 'umbrella-cafe': 'pole'};
const kindOf = n => /^tree-/.test(n) ? 'tree' : /^bush-/.test(n) ? 'bush' : /^flower-/.test(n) ? 'flower' : n;
const NICE = {cupcake: 'Cupcake cafe', 'centre-placeholder': 'Ice cream fountain placeholder', 'sugar-playground': 'Frosting playground', falls: 'Chocolate waterfall', 'sundae-kiosk': 'Sundae kiosk',
  'stall-pink': 'Egg stall', 'stall-blue': 'Cupcake stall', 'stall-yellow': 'Sweet stall', 'stall-mint': 'Toy stall', 'bakery-kiosk': 'Ticket booth', 'candy-arch': 'Ribbon arch',
  'lollipop-tree': 'Lollipop tree', bunting: 'Bunting', 'candy-lamp': 'Candy-cane lamp', 'gumdrop-planter': 'Gumdrop bush', bouquets: 'Candy bouquet'};
function put(name, cp, zone, {flip = false, world = false, mult = 1, nudge = true} = {}) {
  const [x, y] = world ? cp : T(cp), a = ASSET[name], k = kindOf(name), s = r1((SCALE[k] ?? 1) * mult * 1000) / 1000;
  const w = a.w * s, h = a.h * s;
  const p = {id: `candy-${pid++}`, name: NICE[name] || (k === 'tree' ? 'Tree' : k === 'bush' ? 'Bush' : k === 'flower' ? 'Flowers' : name.replace(/-/g, ' ')), asset: name, src: a.src,
    x: r1(x), y: r1(y), width: a.w, height: a.h, anchor: {x: .5, y: r1(a.ay * 1000) / 1000}, scale: s, flip, zone};
  props.push(p);
  const f = FOOT[k] ?? (k === 'tree' ? 'trunk' : k === 'bush' ? 'bush' : 'base');
  if (nudge && !['none', 'arch', 'hall'].includes(f)) {   // keep the walking line and the spawns clear
    const rad = f === 'trunk' ? 31 : f === 'pole' ? 18 : Math.min(150, w * .42);
    for (let it = 0; it < 12; it++) {
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
    if (Math.hypot(p.x - x, p.y - y) > 140) warn.push(`${name} nudged ${Math.round(Math.hypot(p.x - x, p.y - y))}`);
  }
  if (f === 'trunk') obstacles.push({x: p.x, y: r1(p.y - 9), rx: 31, ry: 22});
  else if (f === 'bush') obstacles.push({x: p.x, y: r1(p.y - 14), rx: r1(w * .36), ry: r1(Math.min(30, h * .25))});
  else if (f === 'base') obstacles.push({x: p.x, y: r1(p.y - Math.min(w, 300) * .14), rx: r1(w * .42), ry: r1(Math.min(w, 300) * .17)});
  else if (f === 'low') obstacles.push({x: p.x, y: r1(p.y - h * .3), rx: r1(w * .4), ry: r1(h * .28)});
  else if (f === 'pole') obstacles.push({x: p.x, y: r1(p.y - 8), rx: 18, ry: 12});
  else if (f === 'arch') {for (const sx of [-1, 1]) obstacles.push({x: r1(p.x + sx * w * .37), y: r1(p.y - 12), rx: r1(Math.max(22, w * .08)), ry: 18});}
  else if (f === 'hall') {   // the cupcake: its base polygon, the front steps stay walkable
    const L = p.x - w * .44, R = p.x + w * .44, top = p.y - h * .3, base = p.y - h * .1;
    obstacles.push({poly: [[L, top], [R, top], [R, base], [p.x + w * .14, base], [p.x + w * .14, p.y - h * .06], [p.x - w * .14, p.y - h * .06], [p.x - w * .14, base], [L, base]].map(q => q.map(r1))});
  }
  return p;
}

// the egg-top cupcake (north of the centre plaza) and the centre plaza's placeholder landmark
const cupcake = put('cupcake', [760, 450], 'cupcake');
const placeholder = put('centre-placeholder', [760, 532], 'plaza', {nudge: false});
// lamps and wish flags round the centre plaza rim, between the paths that leave it
const C0 = PLAZAS[0];
const rim = (ang, pad) => [r1(C0.x + Math.cos(ang) * (C0.rx + pad)), r1(C0.y + Math.sin(ang) * (C0.ry + pad * .55))];
const pathClear = (x, y, m) => PATHS.every(p => lineDist(x, y, p.line) > p.w / 2 + m);
{
  const kinds = ['candy-lamp', 'lollipop-tree', 'bunting', 'candy-lamp', 'bouquets'];
  let n = 0;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 14) {
    const [x, y] = rim(a, 70);
    if (Math.abs(x - cupcake.x) < 560 && y < C0.y) continue;   // the cupcake side
    if (!pathClear(x, y, 50)) continue;
    put(kinds[n++ % kinds.length], [x, y], 'plaza', {world: true, nudge: false});
  }
  // the candy stalls stand round the plaza, just outside its rim
  const st = ['stall-pink', 'stall-blue', 'bakery-kiosk', 'stall-yellow', 'stall-mint'];
  let k = 0;
  for (const a of [Math.PI * .62, Math.PI * .38, Math.PI * .7, Math.PI * .3, Math.PI * .76, Math.PI * .24]) {
    const [x, y] = rim(a, 260);
    if (!pathClear(x, y, 140)) {warn.push(`plaza stall at ${Math.round(a * 180 / Math.PI)} deg skipped (path)`); continue;}
    put(st[k++ % st.length], [x, y], 'plaza', {world: true, flip: x > C0.x});
  }
}
// ribbon arches over the paths (the posts stand either side of the walk)
put('candy-arch', onPath(8, .55), 'plaza', {world: true});
put('candy-arch', onPath(0, .5), 'sugarGarden', {world: true});
put('candy-arch', onPath(1, .5), 'falls', {world: true});
put('candy-arch', onPath(11, .5), 'pond-garden', {world: true});
// teacup garden
put('sugar-playground', [418, 226], 'sugarGarden');
put('gumdrop-planter', [340, 262], 'sugarGarden'); put('gumdrop-planter', [510, 262], 'sugarGarden', {flip: true});
put('stall-pink', [535, 215], 'sugarGarden'); put('bouquets', [330, 205], 'sugarGarden');
put('candy-lamp', [372, 290], 'sugarGarden'); put('candy-lamp', [478, 292], 'sugarGarden'); put('bench-wood', [430, 300], 'sugarGarden');
// falls
put('falls', [1094, 222], 'falls');
put('stall-blue', [990, 222], 'falls'); put('bakery-kiosk', [1188, 238], 'falls', {flip: true});
put('gumdrop-planter', [1030, 282], 'falls'); put('gumdrop-planter', [1160, 282], 'falls', {flip: true});
put('candy-lamp', [1012, 182], 'falls'); put('candy-lamp', [1176, 182], 'falls'); put('bouquets', [1130, 290], 'falls');
// parade square (open, activity-2): the goose float waits at its north rim, wish flags round it
put('sundae-kiosk', [1230, 336], 'parade');
for (const c of [[1120, 380], [1350, 380], [1130, 452], [1345, 455]]) put('lollipop-tree', c, 'parade');
put('bunting', [1300, 338], 'parade'); put('bunting', [1165, 340], 'parade', {flip: true});
// pond garden (west)
put('reeds', [222, 440], 'pond-garden'); put('cattails', [362, 432], 'pond-garden'); put('reeds', [340, 476], 'pond-garden'); put('cattails', [236, 478], 'pond-garden');
put('lily-pad-flower', [280, 446], 'pond-garden'); put('lily-pad-large', [312, 456], 'pond-garden'); put('lily-pad-large', [262, 432], 'pond-garden');
put('bench-park', [292, 398], 'pond-garden'); put('gumdrop-planter', [196, 400], 'pond-garden'); put('gumdrop-planter', [392, 404], 'pond-garden', {flip: true});
put('candy-lamp', [178, 510], 'pond-garden'); put('candy-lamp', [410, 500], 'pond-garden');
// the candy lane: wish flags and lamps along it, a few stalls between the open stall rows, the ticket booth at the harbor end
for (const t of [.05, .45, .55, .95]) {const [x, y] = onPath(7, t); put('candy-lamp', [x, y - 150], 'candy-lane', {world: true});}
for (const t of [.05, .2, .35, .5, .95]) {const [x, y] = onPath(7, t); put('lollipop-tree', [x, y + 150], 'candy-lane', {world: true});}
put('stall-yellow', [690, 650], 'candy-lane'); put('stall-mint', [836, 650], 'candy-lane', {flip: true});
put('bakery-kiosk', [242, 650], 'candy-lane'); put('bouquets', [300, 652], 'candy-lane');
// beach (south-east)
put('umbrella-garden', [1250, 680], 'beach', {mult: .6}); put('umbrella-cafe', [1420, 620], 'beach', {mult: .6});
put('picnic-blanket', [1215, 720], 'beach'); put('picnic-blanket', [1400, 680], 'beach', {flip: true}); put('beach-ball', [1320, 700], 'beach');
put('sandcastle-small', [1380, 700], 'beach'); put('bucket', [1402, 712], 'beach');
put('shell-scallop', [1260, 770], 'beach'); put('starfish-orange', [1330, 742], 'beach'); put('towel-striped', [1440, 560], 'beach'); put('bouquets', [1370, 560], 'beach');
// north walk: lamps behind the cupcake, bunting at the north-west pier foot
for (const t of [.12, .45, .78]) {const [x, y] = onPath(2, t); put('candy-lamp', [x, y - 135], '', {world: true});}
for (const [n, t] of [[4, .5], [3, .5], [5, .35], [5, .75], [6, .5], [12, .5], [11, .2]]) {const [x, y] = onPath(n, t); put('candy-lamp', [x + 125, y + 30], '', {world: true});}
// islets: a tree, bouquets and tulips on each
islets.forEach(([cx, cy], i) => {
  const sd = i ? 1 : -1;
  put(i ? 'tree-2' : 'tree-1', [cx + sd * 200, cy - 20], 'islets', {world: true});
  put('bouquets', [cx - sd * 150, cy - 30], 'islets', {world: true, nudge: false});
  put('gumdrop-planter', [cx + sd * 40, cy + 70], 'islets', {world: true, nudge: false});
  put('flower-2', [cx - sd * 260, cy + 50], 'islets', {world: true});
});

// ---------- scatter trees, bushes, flowers on free lawn ----------
const SLEEPERS = [];
const PLZ = (x, y, pad) => [...PLAZAS, ...LAWNS].some(p => ((x - p.x) / (p.rx + pad)) ** 2 + ((y - p.y) / (p.ry + pad)) ** 2 < 1)
  || STALL_ROWS.some(r => inPolyF(x, y, r.poly) || lineDist(x, y, r.mid) < 100 + pad);
const LAWN_IN = offset(GRASS, 70);
function free(x, y, room, pathPad = 90) {
  if (!inPolyF(x, y, LAWN_IN)) return false;
  if (inPolyF(x, y, BEACH)) return false;
  if (PATHS.some(p => lineDist(x, y, p.line) < p.w / 2 + pathPad)) return false;
  if (PLZ(x, y, 60)) return false;
  if (((x - POND.x) / (POND.rx + 150)) ** 2 + ((y - POND.y) / (POND.ry + 150)) ** 2 < 1) return false;
  if (Object.values(SPAWNS_C).some(c => Math.hypot(T(c)[0] - x, T(c)[1] - y) < 160)) return false;
  if (Math.hypot(x - hFoot[0], y - hFoot[1]) < 260 || Math.hypot(x - sFoot[0], y - sFoot[1]) < 200) return false;
  if (SLEEPERS.some(o => Math.hypot(x - o.x, (y - o.y) * 1.6) < o.r * 1.8 + room * .5 + 80 || (y > o.y - 40 && y - o.y < 480 && Math.abs(x - o.x) < o.r + 190))) return false;
  return !props.some(p => Math.hypot(p.x - x, (p.y - y) * 1.5) < room + Math.min(200, p.width * p.scale * .45));
}
const behindDeck = (x, y) => walkways.some(w => {const t = Math.max(0, Math.min(1, ((x - w.a[0]) * (w.b[0] - w.a[0]) + (y - w.a[1]) * (w.b[1] - w.a[1])) / ((w.b[0] - w.a[0]) ** 2 + (w.b[1] - w.a[1]) ** 2))), px = w.a[0] + t * (w.b[0] - w.a[0]), py = w.a[1] + t * (w.b[1] - w.a[1]); return Math.abs(x - px) < 230 && y - py > -60 && y - py < 520;});
const cupcakeBox = (x, y) => Math.abs(x - cupcake.x) < cupcake.width * cupcake.scale * .62 && y > cupcake.y - cupcake.height * cupcake.scale * 1.05 && y < cupcake.y + 160;
let trees = 0;
for (let tries = 0; tries < 30000 && trees < 68; tries++) {
  const x = RX(), y = RY();
  if (cupcakeBox(x, y) || !free(x, y, 210, 70) || behindDeck(x, y) || PLZ(x, y - 200, 0) || PLZ(x, y - 380, -40)) continue;
  put(['tree-1', 'tree-2', 'tree-4', 'tree-5', 'tree-1', 'tree-3'][trees % 6], [x, y], '', {world: true, flip: rnd() < .5}); trees++;
}
let bushes = 0;
for (let tries = 0; tries < 30000 && bushes < 58; tries++) {
  const x = RX(), y = RY();
  if (cupcakeBox(x, y) || !free(x, y, 85, 55) || behindDeck(x, y)) continue;
  put(`bush-${1 + bushes % 6}`, [x, y], '', {world: true, flip: rnd() < .5}); bushes++;
}

// ---------- sleeping Duckies (boss 6 Nov): 40 spots, home's poses (src/pixi/sleep-spots.js SLEEP_SPOTS shape) ----------
seed = 2026;
const POSES = JSON.parse(readFileSync('src/pixi/sleep-poses.json', 'utf8')).poses;
const SR = Object.fromEntries(Object.entries(POSES).map(([n, p]) => [n, (p.box[2] - p.box[0]) * p.k * .81 * (.88 * .24 * 3) / 3 / 2]));
const sleepAvoid = [...PLAZAS, ...LAWNS].map(p => ({x: r1(p.x), y: r1(p.y), rx: r1(p.rx + 110), ry: r1(p.ry + 80)}));
for (const r of STALL_ROWS) for (let i = 0; i < r.mid.length; i += 3) sleepAvoid.push({x: r.mid[i][0], y: r.mid[i][1], rx: 240, ry: 180});
sleepAvoid.push({x: r1(cupcake.x), y: r1(cupcake.y + 40), rx: 360, ry: 150});   // the cupcake's front steps
const sleepSpots = {nod: [], hammock: [], rock: [], leaf: [], book: [], chair: [], wing: [], box: []};
const SLEEP_N = {nod: 6, hammock: 3, rock: 4, leaf: 6, book: 6, chair: 3, wing: 7, box: 5};   // 40
{
  const geoS = geometry({coast: WALK_COAST, obstacles, walkways, bridges, islets, water});
  const coastD = (x, y) => Math.min(...EDGE.map((a, i) => segDist(x, y, a, EDGE[(i + 1) % EDGE.length])));
  const pathD = (x, y) => Math.min(...PATHS.map(p => lineDist(x, y, p.line)));
  const solid = props.filter(p => !/lily/i.test(p.asset));
  const halfW = p => p.width * p.scale / 2;
  const avoided = (x, y) => sleepAvoid.some(e => ((x - e.x) / e.rx) ** 2 + ((y - e.y) / e.ry) ** 2 < 1);
  const placed = SLEEPERS;
  const crowded = (x, y, r, pose) => placed.some(o => Math.hypot(o.x - x, (o.y - y) * 1.3) < Math.max(300, o.r + r + 100) + 40 || (o.pose === pose && Math.hypot(o.x - x, o.y - y) < (pose === 'chair' ? 700 : 760)));
  const why = (x, y, r, pose) => {
    if (!geoS.walkable(x, y) || !geoS.walkable(x - r * .8, y) || !geoS.walkable(x + r * .8, y)) return 'not ground';
    if (islets.some(a => ((x - a[0]) / (a[2] + 60)) ** 2 + ((y - a[1]) / (a[3] + 60)) ** 2 < 1)) return 'islet';
    if (walkways.some(b => segDist(x, y, b.a, b.b) < b.w / 2 + 90)) return 'deck';
    if (Math.hypot(x - hFoot[0], y - hFoot[1]) < 300) return 'harbor';
    if (PATHS.some(p => lineDist(x, y, p.line) < Math.max(60 + r * .35, p.w / 2 + r * .75 + 30))) return 'path';
    if (pose !== 'chair' && !inPolyF(x, y, LAWN_IN)) return 'shore';
    if (avoided(x, y)) return 'avoid';
    if (((x - POND.x) / (POND.rx + r + 60)) ** 2 + ((y - POND.y) / (POND.ry + r + 50)) ** 2 < 1) return 'water';
    if (coastD(x, y) < r * .6 + 70) return 'coast';
    if (solid.some(p => Math.hypot(x - p.x, (y - p.y) * 1.6) < halfW(p) * .8 + r + 12
      || (p.y > y - 20 && p.y - y < p.height * p.scale * .9 + 40 && Math.abs(x - p.x) < halfW(p) + r * .7))) return 'prop';
    return crowded(x, y, r, pose) ? 'near' : null;
  };
  const randomIn = (bb, n, test) => [...Array(n)].map(() => ({x: bb.x0 + rnd() * (bb.x1 - bb.x0), y: bb.y0 + rnd() * (bb.y1 - bb.y0), w: 0})).filter(p => test(p.x, p.y));
  const lawn = (x, y) => !inPolyF(x, y, BEACH);
  const anchorsOf = {
    chair: () => randomIn(BEACH_BB, 2500, (x, y) => inPolyF(x, y, BEACH)),
    book: () => [...props.filter(p => /stall|ticket|cupcake|teacup|falls|goose|candy-arch/.test(p.asset) && p.zone !== 'islets'), ...props.filter(p => /tulip|bunting|lollipop-tree/.test(p.asset) && p.zone !== 'islets')],
    hammock: () => props.filter(p => kindOf(p.asset) === 'tree' && !p.zone),
    rock: () => props.filter(p => kindOf(p.asset) === 'bush'),
    leaf: () => [...props.filter(p => (kindOf(p.asset) === 'bush' || p.asset === 'gumdrop-planter') && lawn(p.x, p.y)).sort(() => rnd() - .5), ...props.filter(p => kindOf(p.asset) === 'tree' && !p.zone), ...randomIn(BB, 6000, lawn)],
    wing: () => randomIn(BB, 90000, lawn),
    box: () => randomIn(BB, 30000, lawn),
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
    const anchors = pose === 'book' || pose === 'leaf' ? anchorsOf[pose]() : anchorsOf[pose]().sort(() => rnd() - .5);
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
seed = 77;
let deco = 0;
for (let tries = 0; tries < 20000 && deco < 26; tries++) {
  const x = RX(), y = RY();
  if (cupcakeBox(x, y) || !free(x, y, 80, 40) || behindDeck(x, y)) continue;
  put(['gumdrop-planter', 'bouquets', 'gumdrop-planter', 'lollipop-tree'][deco % 4], [x, y], '', {world: true, flip: rnd() < .5, mult: .9}); deco++;
}
let flowers = 0;
for (let tries = 0; tries < 8000 && flowers < 190; tries++) {
  const x = RX(), y = RY();
  if (!free(x, y, 40, 40)) continue;
  put(`flower-${1 + flowers % 3}`, [x, y], '', {world: true}); flowers++;
}

// ---------- flats (ground decals) ----------
const flats = [];
for (let n = 0, tries = 0; n < 1100 && tries < 60000; tries++) {
  const x = RX(), y = RY();
  if (!inPolyF(x, y, offset(GRASS, 30)) || PATHS.some(p => lineDist(x, y, p.line) < p.w / 2 + 20) || PLZ(x, y, 20) || inPolyF(x, y, BEACH)) continue;
  if (((x - POND.x) / (POND.rx + 50)) ** 2 + ((y - POND.y) / (POND.ry + 40)) ** 2 < 1) continue;
  const k = ['grass-tuft-1', 'grass-tuft-2', 'grass-tuft-3', 'grass-tuft-1', 'flower-dot-1', 'flower-dot-2', 'flower-dot-3', 'pebble-1'][n % 8];
  const [w, h] = svgSize(`public/pixi-art/decals/${k}.svg`);
  flats.push({src: `reuse/${k}.svg`, x: r1(x), y: r1(y), width: w, height: h, flip: rnd() < .5}); n++;
}
for (let n = 0, tries = 0; n < 220 && tries < 16000; tries++) {   // sand specks on the beach and round the shore
  const x = RX(), y = RY();
  if (!inPolyF(x, y, offset(EDGE, 20)) || (inPolyF(x, y, offset(GRASS, -20)) && !inPolyF(x, y, BEACH))) continue;
  const k = ['sand-speck-1', 'sand-speck-2'][n % 2], [w, h] = svgSize(`public/pixi-art/decals/${k}.svg`);
  flats.push({src: `reuse/${k}.svg`, x: r1(x), y: r1(y), width: w, height: h}); n++;
}

// Short grass within the reserved lawns is flat paint, never a standing obstacle.
for (const lawn of LAWNS) for(let i=0;i<26;i++) {
  const a=rnd()*Math.PI*2,r=Math.sqrt(rnd())*.91,k=`grass-tuft-${1+i%3}`;
  const [w,h]=svgSize(`public/pixi-art/decals/${k}.svg`);
  flats.push({src:`reuse/${k}.svg`,x:r1(lawn.x+Math.cos(a)*r*lawn.rx),y:r1(lawn.y+Math.sin(a)*r*lawn.ry),width:w*.8,height:h*.8,flip:rnd()<.5});
}
// Home-like small pebbles sit beside curved lanes, leaving the whole walking width clear.
for (const path of PATHS) for(let i=3;i<path.line.length-2;i+=5){
 const p=path.line[i],q=path.line[i+1],len=Math.hypot(q[0]-p[0],q[1]-p[1]),side=i%2?-1:1;
 const x=p[0]-(q[1]-p[1])/len*(path.w/2+28)*side,y=p[1]+(q[0]-p[0])/len*(path.w/2+28)*side;
 if(!inPolyF(x,y,LAWN_IN)||PLZ(x,y,12)||inPolyF(x,y,BEACH))continue;
 const [w,h]=svgSize('public/pixi-art/decals/pebble-1.svg');
 flats.push({src:'reuse/pebble-1.svg',x:r1(x),y:r1(y),width:w*1.2,height:h*1.2,flip:rnd()<.5});
}

// ---------- ground SVG ----------
const C = {ink: '#39472D', grass: '#9CC63E', grassShade: '#90BD38', grassDeep: '#7FAE31', sand: '#FDE48C', sandShade: '#E4C567', sandLip: '#D9B85A',
  water: '#6EC9DE', waterHi: '#C9F1EE', halo: '#A6E3DE', pave: '#FBE8BA', paveLine: '#E6CB8A', pink: '#F6C9D2', aqua: '#BFE8E4', mint: '#C8E7A5'};
const g = [];
g.push(`<path d="${dz(EDGE)}" fill="${C.halo}" stroke="${C.halo}" stroke-width="130" stroke-linejoin="round" opacity=".6"/>`);
g.push(`<path d="${dz(EDGE)}" fill="none" stroke="${C.waterHi}" stroke-width="46" stroke-linejoin="round" opacity=".8"/>`);
for (const [cx, cy, rx, ry] of islets) g.push(`<ellipse cx="${cx}" cy="${cy + 10}" rx="${rx + 80}" ry="${ry + 70}" fill="${C.halo}" opacity=".6"/>`);
// sand shore with a soft lip on its south edges, then the lawn
const shift = (p, dy) => p.map(([x, y]) => [x, r1(y + dy)]);
g.push(`<path d="${dz(shift(EDGE, 18))}" fill="${C.sandLip}"/>`);
g.push(`<path d="${dz(EDGE)}" fill="${C.sand}" stroke="${C.sandShade}" stroke-width="6" stroke-linejoin="round"/>`);
g.push(`<path d="${dz(offset(EDGE, 34))}" fill="none" stroke="${C.sandShade}" stroke-width="5" stroke-dasharray="40 70" opacity=".6"/>`);
g.push(`<path d="${dz(GRASS)}" fill="${C.grass}" stroke="${C.grassDeep}" stroke-width="8" stroke-linejoin="round"/>`);
for (let n = 0, tries = 0; n < 40 && tries < 2000; tries++) {
  const x = RX(), y = RY();
  if (!inPolyF(x, y, offset(GRASS, 180))) continue;
  g.push(`<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(90 + rnd() * 220)}" ry="${r1(40 + rnd() * 90)}" fill="${C.grassShade}" opacity=".7"/>`); n++;
}
// beach over the lawn in the south-east cove
g.push(`<clipPath id="land"><path d="${dz(offset(EDGE, -2))}"/></clipPath>`);
g.push(`<g clip-path="url(#land)"><path d="${dz(BEACH)}" fill="${C.sandShade}"/><path d="${dz(offset(BEACH, 14))}" fill="${C.sand}"/></g>`);
// paths: grass-deep rim, sand-shade rim, sand
const pathLayer = (extra, color) => PATHS.map(p => `<path d="${d(p.line)}" fill="none" stroke="${color}" stroke-width="${p.w + extra}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
const plazaLayer = (extra, color) => PLAZAS.map(p => `<ellipse cx="${p.x}" cy="${p.y}" rx="${r1(p.rx + extra / 2)}" ry="${r1(p.ry + extra / 2)}" fill="${color}"/>`).join('');
g.push(pathLayer(10, '#627847') + plazaLayer(10, '#627847'));
g.push(pathLayer(5, '#DDC67A') + plazaLayer(5, '#DDC67A'));
g.push(pathLayer(0, '#FFF0C5') + plazaLayer(0, '#FFF0C5'));
// Candy ribbon insets, drawn on the same continuous soft path curves.
for(const p of PATHS) g.push(`<path d="${d(p.line)}" fill="none" stroke="#F7BDCD" stroke-width="${p.w-28}" stroke-dasharray="48 62" stroke-linecap="butt" stroke-linejoin="round"/>`);

PLAZAS.forEach((p, i) => {
  const ix = r1(p.rx - 26), iy = r1(p.ry - 20);
  g.push(`<clipPath id="pz${i}"><ellipse cx="${p.x}" cy="${p.y}" rx="${ix}" ry="${iy}"/></clipPath>`);
  g.push(`<ellipse cx="${p.x}" cy="${p.y}" rx="${ix}" ry="${iy}" fill="${C.pave}" stroke="${C.paveLine}" stroke-width="5"/>`);
  const lines = [];
  if (p.pave === 'centre') {   // pastel rings and spokes: a candyground compass under the landmark
    for (const [k, col] of [[.86, C.pink], [.7, C.pave], [.56, C.aqua], [.42, C.pave], [.24, C.pink]]) g.push(`<ellipse cx="${p.x}" cy="${p.y}" rx="${r1(ix * k)}" ry="${r1(iy * k)}" fill="${col}" stroke="${C.paveLine}" stroke-width="5"/>`);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) lines.push(`M${r1(p.x + Math.cos(a) * ix * .24)} ${r1(p.y + Math.sin(a) * iy * .24)} L${r1(p.x + Math.cos(a) * ix)} ${r1(p.y + Math.sin(a) * iy)}`);
    // a scalloped pink border inside the rim
    const sc = []; for (let a = 0; a < Math.PI * 2; a += Math.PI / 40) sc.push(`<circle cx="${r1(p.x + Math.cos(a) * ix * .95)}" cy="${r1(p.y + Math.sin(a) * iy * .95)}" r="16" fill="${C.pink}" stroke="${C.paveLine}" stroke-width="3"/>`);
    g.push(sc.join(''));
  } else if (p.pave === 'tiles') {
    for (let x = p.x - p.rx; x < p.x + p.rx; x += 96) lines.push(`M${r1(x)} ${r1(p.y - p.ry)} L${r1(x + 40)} ${r1(p.y + p.ry)}`);
    for (let y = p.y - p.ry; y < p.y + p.ry; y += 62) lines.push(`M${r1(p.x - p.rx)} ${r1(y)} L${r1(p.x + p.rx)} ${r1(y)}`);
  } else {
    g.push(`<ellipse cx="${p.x}" cy="${p.y}" rx="${r1(ix * .8)}" ry="${r1(iy * .8)}" fill="${i % 2 ? C.aqua : C.pink}" opacity=".7"/>`);
    for (const k of [.3, .55, .8]) lines.push(`M${r1(p.x - ix * k)} ${p.y} A${r1(ix * k)} ${r1(iy * k)} 0 1 0 ${r1(p.x + ix * k)} ${p.y} A${r1(ix * k)} ${r1(iy * k)} 0 1 0 ${r1(p.x - ix * k)} ${p.y}`);
  }
  g.push(`<path d="${lines.join(' ')}" stroke="${C.paveLine}" stroke-width="4" fill="none" clip-path="url(#pz${i})"/>`);
});
LAWNS.forEach((a, i) => {   // open lawns: a mown oval with light stripes
  g.push(`<clipPath id="lawn${i}"><ellipse cx="${a.x}" cy="${a.y}" rx="${r1(a.rx)}" ry="${r1(a.ry)}"/></clipPath>`);
  g.push(`<ellipse cx="${a.x}" cy="${a.y}" rx="${r1(a.rx)}" ry="${r1(a.ry)}" fill="#A6CE48" stroke="${C.grassDeep}" stroke-width="3" opacity=".95"/>`);
  const st = []; for (let x = a.x - a.rx; x < a.x + a.rx; x += 110) st.push(`M${r1(x)} ${r1(a.y - a.ry)} L${r1(x + 70)} ${r1(a.y + a.ry)}`);
  g.push(`<path d="${st.join(' ')}" stroke="#AED053" stroke-width="42" fill="none" clip-path="url(#lawn${i})" opacity=".7"/>`);
});
STALL_ROWS.forEach((r, i) => {   // open stall rows: candy-striped paving
  g.push(`<path d="${dz(r.poly)}" fill="${C.sandShade}" stroke="#627847" stroke-width="8" stroke-linejoin="round"/>`);
  g.push(`<path d="${dz(r.poly)}" fill="${C.pave}" stroke="${C.paveLine}" stroke-width="5" stroke-linejoin="round"/>`);
  g.push(`<clipPath id="stall${i}"><path d="${dz(r.poly)}"/></clipPath>`);
  const xs = r.poly.map(q => q[0]), ys = r.poly.map(q => q[1]), L = [], B = [];
  for (let x = Math.min(...xs), k = 0; x < Math.max(...xs); x += 84, k++) {L.push(`M${r1(x)} ${Math.min(...ys)} L${r1(x)} ${Math.max(...ys)}`); if (k % 2) B.push(`<rect x="${r1(x)}" y="${Math.min(...ys)}" width="84" height="${r1(Math.max(...ys) - Math.min(...ys))}" fill="${C.pink}" opacity=".55"/>`);}
  for (let y = Math.min(...ys); y < Math.max(...ys); y += 64) L.push(`M${Math.min(...xs)} ${r1(y)} L${Math.max(...xs)} ${r1(y)}`);
  g.push(`<g clip-path="url(#stall${i})">${B.join('')}</g><path d="${L.join(' ')}" stroke="${C.paveLine}" stroke-width="4" fill="none" clip-path="url(#stall${i})"/>`);
});
// pond: sand bank, ink edge, water, highlight
g.push(`<ellipse cx="${POND.x}" cy="${POND.y}" rx="${r1(POND.rx + 26)}" ry="${r1(POND.ry + 22)}" fill="${C.sandShade}"/>`);
g.push(`<ellipse cx="${POND.x}" cy="${POND.y}" rx="${r1(POND.rx + 14)}" ry="${r1(POND.ry + 12)}" fill="${C.sand}"/>`);
g.push(`<ellipse cx="${POND.x}" cy="${POND.y}" rx="${r1(POND.rx + 3)}" ry="${r1(POND.ry + 3)}" fill="${C.ink}" opacity=".55"/>`);
g.push(`<ellipse cx="${POND.x}" cy="${POND.y}" rx="${POND.rx}" ry="${POND.ry}" fill="${C.water}"/>`);
g.push(`<path d="M${r1(POND.x - POND.rx * .7)} ${r1(POND.y - POND.ry * .35)} Q${POND.x} ${r1(POND.y - POND.ry * .8)} ${r1(POND.x + POND.rx * .6)} ${r1(POND.y - POND.ry * .45)}" fill="none" stroke="${C.waterHi}" stroke-width="8" stroke-linecap="round"/>`);
// islets: sand oval, lawn on top
for (const [cx, cy, rx, ry] of islets) {
  g.push(`<ellipse cx="${cx}" cy="${cy + 16}" rx="${rx}" ry="${ry}" fill="${C.sandLip}"/>`);
  g.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${C.sand}" stroke="${C.sandShade}" stroke-width="6"/>`);
  g.push(`<ellipse cx="${cx}" cy="${cy - 4}" rx="${rx - 70}" ry="${ry - 45}" fill="${C.grass}" stroke="${C.grassDeep}" stroke-width="6"/>`);
}
g.push(`<ellipse cx="${hFoot[0]}" cy="${r1(hFoot[1] - 40)}" rx="150" ry="70" fill="${C.sand}" stroke="${C.sandShade}" stroke-width="6"/>`);
const foam = [];
for (let i = 0; i < EDGE.length; i += 9) {
  const o = offset(EDGE, -(75 + (i % 3) * 30))[i], o2 = offset(EDGE, -(75 + (i % 3) * 30))[(i + 3) % EDGE.length];
  if (rnd() < .6) foam.push(`M${o[0]} ${o[1]} L${o2[0]} ${o2[1]}`);
}
g.push(`<path d="${foam.join(' ')}" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" opacity=".6" fill="none"/>`);

const body = g.join('\n');
const head = (vb, w, h, t) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb}" stroke-linecap="round" stroke-linejoin="round">\n<title>${t}</title>\n<desc>Candy Coast (Candy Coast) ground. Built by scripts/themes/candy-world.mjs. World coordinates.</desc>\n`;
writeFileSync(ART + 'ground.svg', head(`0 0 ${W} ${HH}`, W, HH, 'Candy Coast ground') + body + '\n</svg>\n');
const tiles = [];
const TC = Math.ceil(W / 1450), TR = Math.ceil(HH / 1467), TW = Math.ceil(W / TC), TH = Math.ceil(HH / TR);
for (let r = 0; r < TR; r++) for (let c = 0; c < TC; c++) {
  const x = c * TW, y = r * TH, w = Math.min(TW, W - x), h = Math.min(TH, HH - y);
  writeFileSync(`${ART}ground-r${r}-c${c}.svg`, head(`${x} ${y} ${w} ${h}`, w, h, `Candy Coast ground tile ${r + 1}, ${c + 1}`) + body + '\n</svg>\n');
  tiles.push({src: `ground-r${r}-c${c}.svg`, x, y, width: w, height: h});
}

// ---------- data ----------
const zones = {};
for (const [k, c] of Object.entries(SPAWNS_C)) {const [x, y] = T(c); zones[k] = {x: r1(x), y: r1(y), spawn: [r1(x), r1(y)]};}
zones.islets = {x: islets[0][0], y: islets[0][1], spawn: [islets[0][0], r1(islets[0][1] - 40)]};
// boss 6 Nov: the centre plaza (its landmark is a placeholder the boss will swap: replace the 'centre-placeholder' prop)
zones.centre = {name: 'Centre plaza', x: r1(C0.x), y: r1(C0.y), rx: r1(C0.rx), ry: r1(C0.ry), landmark: placeholder.id, placeholder: true, spawn: zones.plaza.spawn};
for (const a of ACT) zones[a.id] = {name: a.name, kind: a.kind === 'lawn' ? 'lawn' : 'paved', x: r1(a.x), y: r1(a.y), rx: r1(a.rx), ry: r1(a.ry), spawn: [r1(a.x), r1(a.y)]};
for (const r of STALL_ROWS) zones[r.id] = {name: r.name, kind: 'stall-row', x: r.x, y: r.y, poly: r.poly, line: r.mid, spawn: [r.x, r.y]};
const world = {width: W, height: HH, theme: 'candy', name: 'Candy Coast', coast: EDGE, water, bridges, obstacles: [], islets, walkways, arches, zones, sleepSpots, sleepAvoid,
  paths: PATHS.map(p => p.line), props: props.map(p => ({name: p.name, x: p.x, y: p.y, zone: p.zone}))};
const walk = {width: W, height: HH, coast: WALK_COAST, obstacles, walkways, bridges, islets, water};
const boats = [
  {x: hTip[0] - 150, y: hTip[1] - 60, turn: Math.PI}, {x: hTip[0] + 150, y: hTip[1] - 40, turn: Math.PI}, {x: hTip[0] - 480, y: hTip[1] + 20, turn: Math.PI},
  {x: r1(west.b[0] - 40), y: r1(west.b[1] + 150), turn: -Math.PI / 2}, {x: r1(east.b[0] + 40), y: r1(east.b[1] + 150), turn: Math.PI / 2},
  {x: r1(south.b[0] + 150), y: r1(south.b[1] - 20), turn: Math.PI}, {x: r1(south.b[0] - 150), y: r1(south.b[1] + 40), turn: Math.PI},
  ...islets.map(([cx, cy, rx], i) => ({x: r1(cx + (i ? 1 : -1) * (rx + 160)), y: r1(cy + 10), turn: i ? Math.PI / 2 : -Math.PI / 2})),
].map(b => ({x: r1(b.x), y: r1(b.y), turn: r1(b.turn * 1e4) / 1e4}));
const harbor = {jetty: {foot: hFoot.map(r1), tip: hTip.map(r1), width: 104}, boats, spawn: zones.plaza.spawn};
const art = {width: W, height: HH, sea: '#8CC8CD', ground: {tiles}, decks, flats,
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
  const tall = p.height * p.scale > 160 && !/flower|reeds|cattails|lily/.test(p.asset);
  const top = p.y - p.height * p.scale * p.anchor.y, overDeck = walkways.some(w => Math.abs(p.x - (w.a[0] + w.b[0]) / 2) < Math.abs(w.a[0] - w.b[0]) / 2 + w.w / 2 + p.width * p.scale / 2 && top < Math.max(w.a[1], w.b[1]) + 10 && p.y > Math.min(w.a[1], w.b[1]));
  if (tall && overDeck && p.zone !== 'islets') warn.push(`${p.asset} ${p.id} may hide a Ducky on a deck (${p.x},${p.y})`);
  if (walkways.some(w => segDist(p.x, p.y, w.a, w.b) < w.w / 2 + 30)) warn.push(`${p.asset} ${p.id} stands on a deck`);
}
const geo = geometry(walk);
const errs = [];
const bare = geometry({...walk, obstacles: []});
for (const p of props) if (kindOf(p.asset) !== 'flower' && !/lily|reeds|cattails/.test(p.asset) && !bare.walkable(p.x, p.y - 4)) errs.push(`${p.asset} ${p.id} not on walkable land (${p.x},${p.y})`);
const sp = zones.plaza.spawn; if (!geo.walkable(...sp)) errs.push('plaza spawn not walkable ' + sp);
for (const [k, z] of Object.entries(zones)) if (!geo.walkable(...z.spawn)) errs.push(`zone ${k} spawn not walkable`);
const allX = [...EDGE, ...islets.map(i => [i[0] - i[2], i[1] - i[3]]), ...islets.map(i => [i[0] + i[2], i[1] + i[3]])];
const mx = Math.min(...allX.map(p => p[0])), Mx = Math.max(...allX.map(p => p[0])), my = Math.min(...allX.map(p => p[1])), My = Math.max(...allX.map(p => p[1]));
if (mx < 350 || my < 350 || Mx > W - 350 || My > HH - 350) errs.push(`sea margin: land spans x ${mx}-${Mx}, y ${my}-${My}`);
const landAt = (x, y) => inPolyF(x, y, EDGE) || islets.some(a => ((x - a[0]) / a[2]) ** 2 + ((y - a[1]) / a[3]) ** 2 < 1);
if (landAt(...hTip)) errs.push('harbor tip on land');
for (const b of boats) if (landAt(b.x, b.y)) errs.push('boat on land ' + JSON.stringify(b));
for (let i = 0; i < boats.length; i++) for (let j = i + 1; j < boats.length; j++) if (Math.hypot(boats[i].x - boats[j].x, boats[i].y - boats[j].y) < 300) errs.push(`boats ${i},${j} closer than 300`);
const STEP = 24, GW = Math.ceil(W / STEP), GH = Math.ceil(HH / STEP), ok = new Uint8Array(GW * GH), seen = new Uint8Array(GW * GH);
for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) ok[j * GW + i] = geo.walkable(i * STEP + STEP / 2, j * STEP + STEP / 2) ? 1 : 0;
const cell = ([x, y]) => Math.floor(y / STEP) * GW + Math.floor(x / STEP);
const q = [cell(sp)]; seen[q[0]] = 1;
while (q.length) {const c = q.pop(), i = c % GW, j = (c - i) / GW; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {const n = (j + dj) * GW + i + di; if (i + di >= 0 && i + di < GW && j + dj >= 0 && j + dj < GH && ok[n] && !seen[n]) {seen[n] = 1; q.push(n);}}}
let reach = 0, total = 0; for (let k = 0; k < ok.length; k++) {total += ok[k]; reach += seen[k];}
for (const [k, z] of Object.entries(zones)) if (!seen[cell(z.spawn)]) errs.push(`zone ${k} not reachable from the plaza`);
for (const [n, p] of PATHS.entries()) {const bad = p.line.filter(q => !geo.walkable(...q)); if (bad.length > 2) errs.push(`path ${n}: ${bad.length} centre points blocked e.g. ${bad[0]}`);}
for (const w of walkways) if (!seen[cell(w.b)] && !seen[cell(w.a)]) errs.push('walkway unreachable ' + JSON.stringify(w.a));
const nS = Object.values(sleepSpots).reduce((s, l) => s + l.length, 0);
console.log(`coast area ${(Math.abs(area(EDGE)) / 1e6).toFixed(2)}M (home 11.09M), map ${W}x${HH}, sleepers ${nS}`);
console.log(`props ${props.length} (trees ${trees}, bushes ${bushes}, flowers ${flowers}, deco ${deco}), flats ${flats.length}, obstacles ${obstacles.length}, decks ${decks.length}`);
console.log(`walkable cells ${total}, reachable from plaza ${reach} (${(100 * reach / total).toFixed(1)}%)`);
if (warn.length) console.log('placement warnings:\n  ' + warn.join('\n  '));
console.log(errs.length ? 'PROBLEMS:\n  ' + errs.join('\n  ') : 'walk map OK');


await import('./candy-polish.mjs');
await import('./candy-detail.mjs');
await import('./candy-finish.mjs');
