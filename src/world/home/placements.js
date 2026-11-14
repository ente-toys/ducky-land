import {solidBuilding} from './building-footprints.js';
import homeRoutes from './home-routes.json';
import homeOriginalWorld from './home-original-world.json';
import expansion from './home-expansion.json';
import {geometry} from '../../../assets/world/island-geometry.mjs';
import library from '../../../assets/manifest.json';
import original from './art-manifest.json';
import layout from './layout.json';
import rawPaths from './paths.json';
import shapes from './walk-shapes.json';
import {inShape} from '../../../assets/world/island-geometry.mjs';
import {SLEEP_SPOTS as BASE_SLEEP_SPOTS, resolveSleepSpots, homeSleeperFootprint as sleeperFootprint} from './sleep-spots.js';
import homeSleepExtra from '../../../assets/world/home-sleep-extra.json';
import homeSleepOuter from '../../../assets/world/home-sleep-outer.json';
import homeSleepMore from '../../../assets/world/home-sleep-more.json';
import homeExtraProps from '../../../assets/world/home-extra-props.json';
const SLEEP_SPOTS = Object.fromEntries(Object.entries(BASE_SLEEP_SPOTS).map(([pose, spots]) => [pose, [...spots, ...(homeSleepExtra[pose] ?? [])]]));
import {PLAZA_BENCHES, benchFootprint, benchAnchor, benchBox, benchFile} from './plaza-benches.js';
const footpaths = rawPaths.filter(l => !(l[0][0] === 3940 && l[0][1] === 3260));
const segDist = (x, y, a, b) => {const dx = b[0]-a[0], dy = b[1]-a[1], t = Math.max(0, Math.min(1, ((x-a[0])*dx + (y-a[1])*dy) / (dx*dx + dy*dy))); return Math.hypot(x-a[0]-t*dx, y-a[1]-t*dy);};
const reviewPathClear = (x,y,pad=0) => !homeRoutes.some(r => r.samples.slice(1).some((b,i)=>segDist(x,y,r.samples[i],b)<r.width/2+pad));
const pathDist = (x, y) => Math.min(...footpaths.flatMap(l => l.slice(1).map((b, i) => segDist(x, y, l[i], b))));

const byName = new Map(library.assets.map(asset => [asset.name, asset]));
const replacements = {
  'Drip tree': 'tree-oak', 'Hill tree': 'tree-round', 'Plaza bench': 'bench-wood',
  'Race bench': 'bench-park', 'Plaza lantern': 'lamp-lantern', 'Plaza planter': 'planter-flowers',
  'Beach shell': 'shell-scallop', 'Coast rock': 'rock-boulder', 'Racing sailboat': 'sailboat',
  'Blue racing sailboat': 'rowboat', 'Beach umbrella': 'umbrella-garden',
  'Beach blanket': 'picnic-blanket', 'Outdoor reading': 'picnic-table',
};

export const H = 130;
const SCALE_SHEET = {
  'lamp-lantern': .47,
  'Little library': 1.2,
  'bench-wood': .75, 'bench-park': .72, 'Pond bench': .72,
  'Market stall': 1.25, 'Market bunting': 1.25,
  'planter-flowers': .7, 'bin-recycling': .6,
  'picnic-table': .6,
  'Forest picnic': 1.25, 'Beach blanket': 1.25,
  'Rubber duck lighthouse': 1.3, 'Beach umbrella': 1.2,
  'Coast rock': .9, 'Beach shell': .8, 'rock-boulder': .65, 'rock-flat': .55,
  'flower-poppy': .85, cupcake: .8, 'ice-cream-double': .65,
  tree: 1.1,
};
const FOUNTAIN = {scale: 1.05, resolution: 2.5};
function sized(p) {
  const m = SCALE_SHEET[p.asset] ?? SCALE_SHEET[p.name] ?? (/^tree-/.test(p.asset) ? SCALE_SHEET.tree : 1);
  return m === 1 ? p : {...p, scale: p.scale * m, resolution: (p.resolution ?? 1) * Math.max(1, m), grow: m};
}

function place(asset, point) {
  const src = asset.name === 'rowboat' ? '/pixi-art/rowing-hull.svg'
    : original.enhancedAssets[asset.file];
  return {...point, asset: asset.name, src,
    width: asset.size.width, height: asset.size.height, resolution: .5,
    anchor: {x: asset.anchor.x / asset.size.width, y: asset.anchor.y / asset.size.height}, scale: .24};
}

const PLANTS = {
  'tree-1': [260, 360], 'tree-2': [180, 360], 'bush-1': [130, 100], 'bush-2': [168, 110], 'bush-3': [116, 104],
  'tree-3': [300, 380], 'tree-4': [200, 280], 'tree-5': [150, 380], 'bush-4': [140, 100], 'bush-5': [170, 110], 'bush-6': [120, 96],
  'flower-1': [48, 36], 'flower-2': [48, 36], 'flower-3': [44, 36],
};
const PLANT_SCALE = {tree: 1.15, bush: 1.3, flower: 1.6};
function plant(kind, point) {
  const [width, height] = PLANTS[kind];
  return {...point, asset: kind, src: `/pixi-art/plants/${kind}.svg`, width, height, resolution: 5,
    anchor: {x: .5, y: 1}, scale: PLANT_SCALE[kind.split('-')[0]]};
}

export const JETTIES = expansion.homeArches ? [] : [
  [2, 870.0355, 2996.0389, 337.9679, 475.3502],
].map(([n, x, y, width, height]) => ({src: `/pixi-art/bridge-jetty-${n}.svg`, x, y, width, height, resolution: 1.5}));
const ARCHES = expansion.homeArches ?? [
  {a: [1188, 2630], b: [2092, 2630], r: 88, w: 112, squash: 72 / 112},
  {a: [1137.84, 3066.05], b: [1100, 3560], r: 70, w: 84},
  ...(expansion.arches ?? []),
];
export {deckX} from './bridge-projection.mjs';

export function deckY(x, y, arches = ARCHES) {
  for (const {a, b, r, w, squash} of arches) {
    const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy, t = ((x - a[0]) * dx + (y - a[1]) * dy) / len2;
    if (t <= 0 || t >= 1) continue;
    const side = ((x - a[0]) * dy - (y - a[1]) * dx) / Math.sqrt(len2);
    if (Math.abs(side) > w / 2 + 12) continue;
    const k = 4 * t * (1 - t), ease = Math.min(1, k * 4);
    return (squash ? a[1] + (y - a[1]) * (1 - ease * (1 - squash)) : y) - r * k;
  }
  return y;
}

const LAKE = {x: 4130, y: 1537, rx: 538, ry: 296, poly: shapes.lake};
const OLD_JETTY = new Set([3940, 3320, 2320, 5050]), OLD_PAD = new Set([3930, 3340, 2290, 5450]);
const trimWith = (w, jetty, pad) => ({...w, islets: w.islets.filter(a => !pad.has(a[0])), walkways: w.walkways.filter(b => !jetty.has(b.a[0])),
  water: w.water.map(o => o.x === 4140 && o.y === 1520 ? LAKE : o)});
export const trimWorld = w => trimWith(w, OLD_JETTY, OLD_PAD);
const placeWorld = w => trimWith(w, new Set([3940, 3320, 2320]), new Set([3930, 3340, 2290]));
const archMid = ARCHES.map(({a, b}) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
const underArch = w => archMid.some(([x, y]) => Math.hypot((w.a[0] + w.b[0]) / 2 - x, (w.a[1] + w.b[1]) / 2 - y) < 60) ? {...w, boatPassUnder: true} : w;
export const walkWorld = (world, props) => ({...world, navigationCellSize: 24, coast: expansion.coast, obstacles: [...obstaclesFor(props, homeOriginalWorld), ...(expansion.obstacles ?? [])],
  water: [...world.water, ...(expansion.riverWater ?? [])], bridges: [...world.bridges.filter(b => !(b.x === 1640 && b.y === 2630)), ...(expansion.riverBridges ?? [])],
  walkways: [...world.walkways.map(underArch), ...(expansion.walkways ?? []).map(underArch), {a: [1165, 3000], b: [1095, 3098], w: 120, boatPassUnder: true}]});

const inEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
const SAND = [[2820, 2390, 562, 398], [4775, 2654, 478, 540], [4132, 1530, 682, 447], [1640, 2630, 470, 300]];
export function groundAt(x, y, world) {
  if (world.water.some(o => inShape(x, y, o))) return 'water';
  return SAND.some(s => inEllipse(x, y, ...s)) || world.islets.some(a => !inEllipse(x, y, a[0], a[1], a[2] * .6, a[3] * .6) && inEllipse(x, y, ...a))
    || !reviewPathClear(x,y) ? 'sand' : 'grass';
}

function createOriginalPlacements(world, walkable) {
  const props = original.props.filter(prop => !prop.name.startsWith('Wayfinding')).map(prop => {
    if (prop.zone === 'lighthouse-beach') return prop;
    if (prop.name === 'Drip fountain') return {...prop, asset: 'fountain-wishing', src: '/pixi-art/fountain-wishing.svg',
      y: 2370, width: 480, height: 480, anchor: {x: .5, y: .625}, ...FOUNTAIN};
    if (prop.name === 'Croissant tree' || prop.name === 'Baguette tree') return prop.id % 3 ? null : plant(prop.id % 2 ? 'tree-1' : 'tree-2', prop);
    if (prop.name === 'Drip tree' || prop.name === 'Hill tree') return plant(prop.id % 2 ? 'tree-2' : 'tree-1', prop);
    if (prop.name === 'Flower planter') return plant('bush-3', prop);
    if (prop.name === 'Library flowers') return plant(prop.id % 2 ? 'flower-1' : 'flower-3', prop);
    const asset = byName.get(replacements[prop.name]);
    if (asset?.name === 'sailboat') return null;
    return asset ? place(asset, prop) : prop;
  }).filter(Boolean);
  const zones = ['bread-forest','pond','library','plaza','race-lake','lighthouse-beach','islets'];
  const details = library.assets.filter(asset => ['nature'].includes(asset.category)
    && !/^(tree-|fence-|sand-edge|bench-|lamp-|sign|flag|bush-|grass-|log|stump|reeds|cattails|lily)/.test(asset.name));
  const trees = props.filter(p => /^tree-/.test(p.asset));
  trees.forEach((tree, i) => {
    const side = i % 2 ? -1 : 1;
    if (i % 3 === 0) {const x = tree.x + side * 150, y = tree.y + 30; if (walkable(x, y)) props.push(plant(['bush-1','bush-2'][i % 2], {id: `bush-${i}`, name: 'Bush', x, y, zone: tree.zone}));}
    if (i % 4 === 1) {const x = tree.x - side * 110, y = tree.y + 45; if (walkable(x, y)) props.push(plant(['flower-1','flower-2','flower-3'][i % 3], {id: `flower-${i}`, name: 'Flowers', x, y, zone: tree.zone}));}
  });
  details.forEach((asset, i) => {
    const zone = zones[i % zones.length];
    if (zone === 'lighthouse-beach' || zone === 'islets') return;
    const z = world.zones[zone], angle = i * 2.399963, radius = 190 + (i % 5) * 53;
    const x = z.x + Math.cos(angle) * radius, y = z.y + 180 + Math.sin(angle) * radius * .6;
    if (!walkable(x,y) || Math.hypot(x-z.spawn[0],y-z.spawn[1]) < 110) return;
    if (pathDist(x, y) < 100 || Math.hypot(x - 2820, y - 2350) < 360) return;
    props.push(place(asset, {id: `detail-${i}`, name: asset.name, x, y, zone}));
  });
  return [...consolidate(applyLayout(props).map(sized), world, walkable), ...homeExtraProps.props.map(p => ({...p, anchor: {...p.anchor}}))];
}

function applyLayout(props) {
  const gone = new Set(layout.remove.map(String)), byId = new Map(props.map(p => [String(p.id), p]));
  for (const {id, x, y} of layout.move || []) {const p = byId.get(String(id)); if (p) Object.assign(p, {x, y});}
  for (const {id, kind} of layout.swap || []) {const p = byId.get(String(id)); if (p && PLANTS[kind]) Object.assign(p, plant(kind, p));}
  const out = props.filter(p => !gone.has(String(p.id)));
  for (const a of layout.add || []) if (PLANTS[a.kind]) out.push(plant(a.kind, {id: `add-${out.length}`, name: a.kind, x: a.x, y: a.y, zone: a.zone}));
  for (const r of layout.rocks || []) {const asset = byName.get(r.kind); if (asset) out.push(place(asset, {id: `rock-${out.length}`, name: r.kind, x: r.x, y: r.y}));}
  return out;
}

const PLAZA = {x: 2820, y: 2390, rx: 562, ry: 398};
export const RING = {x: 2820, y: 2370, rx: 470, ry: 360};
const ENTRIES = [[2341, 2326], [2850, 1976], [3215, 2113], [3256, 2507], [2587, 2710]];
const DROP = new Set(['4', '5', '6', '7', '8', '9', '10', '11', '12', '15', '20', '21', '35', '42', '43', '44', '45']);
const STALL_SHIFT = [-40, -110];
const STALLS = {1: [2560 + STALL_SHIFT[0], 2112 + STALL_SHIFT[1]], 2: [1450, 1730]}, STALL_ZONE = {2: 'bread-forest', 3: 'lighthouse-beach'};
const isTree = p => /^tree-/.test(p.asset), isBush = p => /^bush-/.test(p.asset), isPlant = p => !!PLANTS[p.asset];
const SMALL = /^(flower-|rock-|mushroom|food|apple|baguette|croissant|cupcake|donut|egg|golden-bread|ice-cream|pear|seed-bag|bin-|planter-)/;
const ANCHOR = /^(bench-|tree-|bush-|picnic-)|Pond bench|Forest picnic|Little library|Market stall/;
const half = p => p.width * p.scale / 2;
const halton = (i, b) => {let f = 1, r = 0; for (; i > 0; i = Math.floor(i / b)) {f /= b; r += f * (i % b);} return r;};
const BENCH_ART = {front: 'street--bench-wood', back: 'street--bench-wood-back', left: 'street--bench-wood-left', right: 'street--bench-wood-right'};
const facingOf = (dx, dy) => Math.abs(dy) >= Math.abs(dx) ? (dy > 0 ? 'front' : 'back') : (dx > 0 ? 'right' : 'left');
function bench(id, x, y, look, zone) {
  const side = look === 'left' || look === 'right';
  return {id, name: 'Bench', asset: `bench-wood-${look}`, src: `/pixi-art/detail/${BENCH_ART[look]}.svg`, x, y, zone,
    width: 818, height: 463, anchor: {x: .5, y: 451 / 463}, scale: side ? .28 : .18, resolution: side ? 1.4 : .9, seat: true,
    footprint: side ? {x, y: y - 30, rx: 30, ry: 62} : {x, y: y - 10, rx: 70, ry: 24}};
}

function arcBench(b) {
  const [x, y] = benchAnchor(b), box = benchBox(b);
  return {id: `seat-plaza-${b.deg}`, name: 'Bench', asset: 'bench-arc', src: `/pixi-art/detail/${benchFile(b)}.svg`, x, y, zone: 'plaza',
    width: box.w, height: box.h, anchor: {x: (x - box.x) / box.w, y: (y - box.y) / box.h}, scale: 1, resolution: 2, seat: true, footprint: benchFootprint(b)};
}

const REPLANT_PLAZA = [['Market stall', 2560, 2112, 395, 326.25], ['Bench', 3006.14, 2076.62, 147.24, 83.34], ['Bench', 3221.04, 2306.14, 229.04, 129.64],
  ['Bench', 2986.76, 2682.95, 147.24, 83.34], ['Bench', 2457.99, 2533.74, 229.04, 129.64], ['Plaza lantern', 2374.13, 2242.74, 48.73, 207.21],
  ['Plaza lantern', 2962.39, 1971.06, 48.73, 207.21], ['Plaza lantern', 3195.17, 2579.29, 48.73, 207.21], ['Plaza lantern', 2483.28, 2678.6, 48.73, 207.21]].map(([name, x, y, width, height]) => ({name, x, y, width, height, scale: 1}));

function consolidate(out, world, walkable) {
  out = out.filter(p => !DROP.has(String(p.id)));
  const islet = (x, y) => world.islets.some(a => inEllipse(x, y, a[0], a[1], a[2] + 60, a[3] + 60));
  const jetty = (x, y, pad = 90) => world.walkways.some(b => segDist(x, y, b.a, b.b) < b.w / 2 + pad);
  const clear = (x, y, gap) => walkable(x, y) && pathDist(x, y) > gap && !islet(x, y) && !jetty(x, y);
  const wet = (x, y, pad) => world.water.some(o => inShape(x, y, o, pad));
  const coast = world.coast, coastDist = (x, y) => Math.min(...coast.map((a, i) => segDist(x, y, a, coast[(i + 1) % coast.length])));
  const byId = id => out.find(p => String(p.id) === String(id));
  const roomy = (x, y, r, list) => list.every(p => Math.hypot(x - p.x, (y - p.y) * 1.3) > r + half(p));
  const first = (cands, ok) => cands.find(c => ok(...c));
  const around = (x, y, step = 40, rings = 8) => [[x, y], ...Array.from({length: rings * 12}, (_, i) => {
    const r = step * (1 + Math.floor(i / 12)), a = (i % 12) * Math.PI / 6 + Math.floor(i / 12) * .3;
    return [x + Math.cos(a) * r, y + Math.sin(a) * r * .8];
  })];

  for (const [id, at] of Object.entries(STALLS)) {const p = byId(id); if (p) {[p.x, p.y] = at; p.zone = STALL_ZONE[id] || p.zone;}}
  const kiosk = byId(3), beachProps = out.filter(p => p.zone === 'lighthouse-beach' && !/shell|Coast rock/i.test(p.name));
  if (kiosk) {
    const spot = first([...around(4520, 2960, 45, 9), ...around(4600, 2300, 45, 9)], (x, y) => walkable(x, y) && !wet(x, y, 40) && pathDist(x, y) > 170
      && inEllipse(x, y, 4775, 2654, 440, 500) && x > PLAZA.x + PLAZA.rx + 6 * H && roomy(x, y, 1.2 * H, beachProps.filter(p => p !== kiosk))
      && beachProps.every(p => p === kiosk || !(Math.abs(p.x - x) < 260 + half(p) && p.y > y - 450 && p.y < y + 90)));
    if (spot) [kiosk.x, kiosk.y] = spot;
    [kiosk.x, kiosk.y] = [4540, 3030];
    const towel = byId(49); if (towel) [towel.x, towel.y] = [4790, 3120];
    kiosk.zone = 'lighthouse-beach';
  }
  const stalls = [1, 2, 3].map(byId).filter(Boolean);
  const tableAsset = byName.get('picnic-table'), cart = byId(2), woods = [];
  if (tableAsset && cart) {
    const ok = (x, y) => clear(x, y, 150) && roomy(x, y, .8 * H, stalls) && Math.abs(y - cart.y) < 120;
    const spot = first([...around(cart.x - 2.3 * H, cart.y + 20, 30, 6), ...around(cart.x + 2.3 * H, cart.y + 20, 30, 6)], ok);
    if (spot) {const t = place(tableAsset, {id: 'woods-table', name: 'Picnic table', x: spot[0], y: spot[1], zone: 'bread-forest'}); t.scale *= .6; t.footprint = {x: t.x, y: t.y - 14, rx: half(t) * .85, ry: 34}; woods.push(t); out.push(t);}
  }
  const blanket = byId(33);
  if (blanket) {
    const spot = first(around(1230, 2060, 40, 10), (x, y) => clear(x, y, 230) && roomy(x, y, 1.6 * H, [...stalls, ...woods]));
    if (spot) [blanket.x, blanket.y] = spot;
  }

  const seats = [], furniture = () => [...stalls, ...woods, ...seats, ...out.filter(p => /library|lighthouse|umbrella|fountain/i.test(p.name))];
  const seatOk = (x, y, gap = 118) => walkable(x, y) && !wet(x, y, 35) && pathDist(x, y) > gap && !islet(x, y) && !jetty(x, y)
    && roomy(x, y, H * .6, furniture().filter(p => !/fountain/i.test(p.name)));
  for (const b of PLAZA_BENCHES) seats.push(arcBench(b));
  const pond = world.water[0];
  for (const degs of [[-62, -48, -76, -118, -104, -132], [64, 50, 78, 116, 102, 130, 36, 144, 24, 156]]) {
    const spot = first(degs.flatMap(d => [45, 70, 95, 120].map(k => {const a = d * Math.PI / 180; return [pond.x + Math.cos(a) * (pond.rx + k), pond.y + Math.sin(a) * (pond.ry + k * .8)];})),
      (x, y) => seatOk(x, y, 100) && seats.every(s => Math.hypot(s.x - x, s.y - y) > 4 * H));
    if (spot) seats.push(bench(`seat-pond-${seats.length}`, spot[0], spot[1], facingOf(pond.x - spot[0], pond.y - spot[1]), 'pond'));
  }
  const beachSeat = first(around(5040, 2560, 40, 9), (x, y) => seatOk(x, y) && coastDist(x, y) > 140 && seats.every(s => Math.hypot(s.x - x, s.y - y) > 6 * H));
  if (beachSeat) seats.push(bench('seat-beach', ...beachSeat, 'right', 'lighthouse-beach'));
  const pathSeat = (line, t, side, look, zone) => {
    const l = footpaths[line];
    for (const dt of [0, .05, -.05, .1, -.1, .15, -.15, .2, -.2]) {
      const k = Math.max(1, Math.min(l.length - 2, Math.round((t + dt) * (l.length - 1)))), [ax, ay] = l[k - 1], [bx, by] = l[k + 1];
      const len = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / len * side, ny = (bx - ax) / len * side, [px, py] = l[k];
      const x = px + nx * (62 + .6 * H), y = py + ny * (62 + .6 * H) + (Math.abs(ny) > .7 && ny < 0 ? 10 : 0);
      const turn = look || facingOf(-nx, -ny);
      if (seatOk(x, y, 100) && seats.every(s => Math.hypot(s.x - x, s.y - y) > 6 * H)) {seats.push(bench(`seat-${zone}`, x, y, turn, zone)); return;}
    }
  };
  pathSeat(9, .5, -1, null, 'library');
  pathSeat(2, .6, -1, 'back', 'race-lake');
  out.push(...seats);

  const lampAsset = byName.get('lamp-lantern'), planterAsset = byName.get('planter-flowers');
  [0, 1, 3, 4].forEach((e, i) => {
    const [ex, ey] = ENTRIES[e], dx = ex - RING.x, dy = (ey - RING.y) / .77, len = Math.hypot(dx, dy), tx = -dy / len, ty = dx / len * .77;
    for (const [asset, s, kind] of [[lampAsset, 1, 'lamp'], [planterAsset, -1, 'planter']]) {
      if (!asset) continue;
      const at = k => [ex - dx / len * (20 + k) + tx * s * 112, ey - dy / len * (20 + k) + ty * s * 112];
      const free = (x, y) => seats.every(b => b.footprint?.poly
        ? b.footprint.poly.every(([u, v]) => Math.hypot(u - x, (v - y) * 1.3) > 70 && !(Math.abs(u - x) < 40 && v < y && v > y - 230))
        : Math.hypot(b.x - x, (b.y - y) * 1.3) > half(b) + 60);
      const [x, y] = [0, 40, 80, -30, 120, -60, -90].map(at).find(([x, y]) => free(x, y)) || at(0);
      const p = sized(place(asset, {id: `plaza-${kind}-${i}`, name: kind === 'lamp' ? 'Plaza lantern' : 'Plaza planter', x, y, zone: 'plaza'}));
      p.footprint = kind === 'lamp' ? {x, y: y - 6, rx: 16, ry: 14} : {x, y: y - 20, rx: 46, ry: 34};
      out.push(p);
    }
  });

  const nearestOnPath = (x, y) => footpaths.flatMap(l => l.slice(1).map((b, i) => {
    const a = l[i], dx = b[0]-a[0], dy = b[1]-a[1], t = Math.max(0, Math.min(1, ((x-a[0])*dx + (y-a[1])*dy) / (dx*dx + dy*dy)));
    return [a[0] + t*dx, a[1] + t*dy, -dy, dx];
  })).sort((m, n) => Math.hypot(x-m[0], y-m[1]) - Math.hypot(x-n[0], y-n[1]))[0];
  const plants = out.filter(isPlant);
  out = out.filter(p => !isPlant(p)).filter(p => {
    if (!SMALL.test(p.asset || '') || pathDist(p.x, p.y) > 90 || /^plaza-/.test(p.id)) return true;
    const [nx, ny, px, py] = nearestOnPath(p.x, p.y), len = Math.hypot(px, py), side = Math.sign((p.x-nx)*px + (p.y-ny)*py) || 1;
    for (const s of [side, -side]) {
      const x = nx + px / len * s * 105, y = ny + py / len * s * 105;
      if (clear(x, y, 90)) {p.x = x; p.y = y; return true;}
    }
    return false;
  });

  const onLand = (x, y) => world.coast.length && walkable(x, y) && !islet(x, y);
  const solid = [...out.filter(p => !SMALL.test(p.asset || '') && !/bridge|bunting|banner|reeds|boat|shell|Coast rock/i.test(p.asset || p.name)
    && !((p.zone === 'plaza' && !/fountain/i.test(p.name)) || String(p.id) === '1')), ...REPLANT_PLAZA];
  const sandy = (x, y, pad) => SAND.some(([cx, cy, rx, ry]) => inEllipse(x, y, cx, cy, rx + pad, ry + pad * .7)) || wet(x, y, pad + 60);
  const building = /library|lighthouse|Market stall|fountain/i;
  const roomFor = (x, y, r, tall) => solid.every(p => Math.hypot(x - p.x, (y - p.y) * 1.6) > r + half(p) + (building.test(p.name) ? 1.5 * H : 50)
    && !(tall && y > p.y && y - p.y < 470 && Math.abs(x - p.x) < r + half(p) * .7)
    && !(p.y > y && p.y - y < p.height * p.scale * .9 && Math.abs(x - p.x) < half(p) + r * .5));
  const spots = Array.from({length: 6000}, (_, i) => [300 + halton(i + 1, 2) * 5200, 450 + halton(i + 1, 3) * 3400]);
  const TREE_KINDS = ['tree-1', 'tree-2', 'tree-3', 'tree-4', 'tree-5'].filter(k => PLANTS[k]);
  const BUSH_KINDS = ['bush-1', 'bush-2', 'bush-3', 'bush-4', 'bush-5', 'bush-6'].filter(k => PLANTS[k]);
  const canopy = (kind, scale) => [PLANTS[kind][0] * scale / 2, PLANTS[kind][1] * scale];
  const nTrees = Math.max(24, plants.filter(isTree).length), nBushes = Math.max(10, plants.filter(isBush).length);
  const stairsClear = (x, y) => !(x > 2620 && x < 3220 && y > 1330 && y < 2000);
  const treeOk = (x, y) => stairsClear(x, y) && onLand(x, y) && coastDist(x, y) > H + 40 && pathDist(x, y) > 135 && !sandy(x, y, 100) && !jetty(x, y, 200)
    && !inEllipse(x, y, PLAZA.x, PLAZA.y, PLAZA.rx + 260, PLAZA.ry + 190) && roomFor(x, y, 150, true)
    && [[0, .5], [0, .85], [-.7, .6], [.7, .6]].every(([u, v]) => !wet(x + u * 150, y - v * 420, 30));
  const treeSpots = spots.filter(s => treeOk(...s));
  const gapAt = (x, y) => (coastDist(x, y) < 520 ? .85 : 1.08);
  let trees = [];
  for (let r = 1000; r >= 2.2 * H; r -= 15) {
    const got = [];
    for (const s of treeSpots) {
      if (got.length >= nTrees) break;
      if (s[1] < 1050 && got.filter(g => g[1] < 1050).length >= 6) continue;
      if (got.every(g => Math.hypot(g[0] - s[0], g[1] - s[1]) >= r * Math.max(gapAt(...s), gapAt(...g)))) got.push(s);
    }
    trees = got;
    if (got.length >= nTrees) break;
  }
  const grown = [];
  trees.forEach(([x, y], i) => {
    const near = grown.filter(g => Math.hypot(g.x - x, g.y - y) < 900).map(g => g.asset);
    const kind = TREE_KINDS.map((k, j) => TREE_KINDS[(i * 3 + j) % TREE_KINDS.length]).find(k => !near.includes(k)) || TREE_KINDS[i % TREE_KINDS.length];
    const p = sized(plant(kind, {id: `tree-${i}`, name: 'Tree', x, y, zone: ''}));
    p.scale *= .85 + .3 * halton(i + 3, 5); p.flip = halton(i + 1, 7) > .5; p.tint = [0xFFFFFF, 0xF4FAEC, 0xFFF7EA][i % 3];
    grown.push(p);
  });
  const inCanopy = (x, y, w, g) => {const [cw, ch] = canopy(g.asset, g.scale); return Math.abs(x - g.x) < cw + w + 30 && y > g.y - ch - 30 && y < g.y + 60;};
  const bushOk = (x, y, kind) => {
    const [w] = canopy(kind, PLANT_SCALE.bush);
    return onLand(x, y) && coastDist(x, y) > 170 && pathDist(x, y) > 125 && !sandy(x, y, 80) && !jetty(x, y, 120 + H)
      && !inEllipse(x, y, PLAZA.x, PLAZA.y, PLAZA.rx + 160, PLAZA.ry + 110) && roomFor(x, y, w, false)
      && grown.every(g => Math.hypot(g.x - x, g.y - y) > (isTree(g) ? 1.4 * H : 2.4 * H) && !inCanopy(x, y, w, g) && !(isTree(g) ? false : inCanopy(g.x, g.y, half(g), {asset: kind, scale: PLANT_SCALE.bush, x, y})));
  };
  let b = 0;
  for (const s of spots) {
    if (b >= nBushes) break;
    const kind = BUSH_KINDS[b % BUSH_KINDS.length];
    if (!bushOk(...s, kind) || grown.some(g => isBush(g) && Math.hypot(g.x - s[0], g.y - s[1]) < 5 * H)) continue;
    const p = plant(kind, {id: `bush-${b}`, name: 'Bush', x: s[0], y: s[1], zone: ''});
    p.scale *= .9 + .2 * halton(b + 2, 5); p.flip = halton(b + 1, 3) > .5;
    grown.push(p); b++;
  }
  const flowerKinds = plants.filter(p => /^flower-/.test(p.asset)).map(p => p.asset), flowers = [];
  const feet = [...seats.flatMap(s => [[s.x + 95, s.y + 12], [s.x - 95, s.y + 12]]), ...grown.filter(isTree).flatMap(t => [[t.x + 120, t.y + 30], [t.x - 120, t.y + 30]])];
  for (const [x, y] of feet) {
    if (flowers.length >= flowerKinds.length) break;
    if (!onLand(x, y) || pathDist(x, y) < 85 || wet(x, y, 40) || flowers.some(f => Math.hypot(f.x - x, f.y - y) < 700)
      || ![...grown, ...out.filter(p => !/bridge|bunting|banner|boat/i.test(p.asset || p.name))].every(g => Math.hypot(x - g.x, (y - g.y) * 1.6) > (isTree(g) ? 110 : half(g) + 50))) continue;
    flowers.push(plant(flowerKinds[flowers.length], {id: `flower-${flowers.length}`, name: 'Flowers', x, y, zone: ''}));
  }
  out.push(...grown, ...flowers);

  const anchors = out.filter(p => ANCHOR.test(p.asset || p.name)), placed = [...grown, ...flowers];
  const inPlaza = (x, y) => inEllipse(x, y, PLAZA.x, PLAZA.y, PLAZA.rx, PLAZA.ry);
  return out.filter(p => {
    if (!SMALL.test(p.asset || '') || isPlant(p) || /^plaza-/.test(p.id)) return true;
    const near = anchors.filter(a => inPlaza(a.x, a.y) === inPlaza(p.x, p.y)).map(a => [a, Math.hypot(p.x - a.x, p.y - a.y)]).sort((a, b) => a[1] - b[1])[0];
    if (!near || near[1] > 700) return false;
    const [a] = near, furn = /bench|stall|picnic/i.test(a.asset || a.name);
    if (furn) return false;
    const rx = half(a) * .8 + half(p) + 10, ry = rx * .45, base = Math.atan2((p.y - a.y) / .45, p.x - a.x);
    for (const turn of [0, .45, -.45, .9, -.9, 1.35, -1.35]) {
      const t = base + turn, x = a.x + Math.cos(t) * rx, y = a.y + Math.sin(t) * ry;
      if (placed.some(q => Math.hypot(q.x - x, q.y - y) < half(p) + half(q) + 6) || !clear(x, y, 90) || inEllipse(x, y, RING.x, RING.y, RING.rx + 40, RING.ry + 40)) continue;
      p.x = x; p.y = y; placed.push(p); return true;
    }
    return false;
  });
}

export const DECALS = {
  'grass-tuft-1': [44, 26], 'grass-tuft-2': [34, 22], 'grass-tuft-3': [56, 24], 'flower-dot-1': [20, 18], 'flower-dot-2': [26, 18],
  'flower-dot-3': [22, 16], 'pebble-1': [22, 14], 'pebble-2': [34, 16], 'pebble-3': [28, 18], 'sand-speck-1': [16, 8],
  'sand-speck-2': [22, 10], 'edge-stone-1': [30, 18],
};
export function decalsFor(world, props, walkable) {
  const coast = world.coast, coastDist = (x, y) => Math.min(...coast.map((a, i) => segDist(x, y, a, coast[(i + 1) % coast.length])));
  const solid = props.filter(p => !/bridge|lily|shell|boat|bunting/i.test(p.asset || p.name || ''));
  const cell = .6 * H, out = [], grid = new Map(), key = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  const GRASS = ['grass-tuft-1', 'grass-tuft-2', 'grass-tuft-3', 'grass-tuft-1', 'grass-tuft-2', 'flower-dot-1', 'flower-dot-2', 'flower-dot-3', 'pebble-1', 'pebble-2'];
  const SANDY = ['sand-speck-1', 'sand-speck-2', 'sand-speck-1', 'pebble-1', 'pebble-3'];
  for (let i = 1; i < 26000 && out.length < 1400; i++) {
    const x = 250 + halton(i, 2) * 5300, y = 400 + halton(i, 3) * 3600, d = pathDist(x, y);
    if (d < 70 || !walkable(x, y) || world.water.some(o => inShape(x, y, o, 45))) continue;
    if (inEllipse(x, y, RING.x, RING.y, RING.rx + 20, RING.ry + 20) || world.walkways.some(b => segDist(x, y, b.a, b.b) < b.w / 2 + 40)) continue;
    if (solid.some(p => Math.hypot(x - p.x, (y - p.y) * 1.8) < p.width * p.scale * .42 + 20)) continue;
    const c = coastDist(x, y), edge = d < 160 || c < 260, keep = halton(i, 5) < (edge ? .9 : .3);
    if (!keep || c < 40) continue;
    const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
    let near = false;
    for (let a = -1; a <= 1 && !near; a++) for (let b = -1; b <= 1 && !near; b++) for (const q of grid.get(`${gx + a},${gy + b}`) || []) if (Math.hypot(q[0] - x, q[1] - y) < cell) {near = true; break;}
    if (near) continue;
    const sand = groundAt(x, y, world) === 'sand', pick = halton(i, 7);
    const kind = d < 96 && !sand ? (pick < .45 ? 'edge-stone-1' : 'grass-tuft-2') : (sand ? SANDY : GRASS)[Math.floor(pick * (sand ? SANDY : GRASS).length)];
    (grid.get(key(x, y)) || grid.set(key(x, y), []).get(key(x, y))).push([x, y]);
    const k = 1.5;
    out.push({src: `/pixi-art/decals/${kind}.svg`, x, y, width: DECALS[kind][0] * k, height: DECALS[kind][1] * k, flip: halton(i, 11) > .5});
  }
  return out;
}

export function obstaclesFor(props, world) {
  const byProp = world.props.map(o => world.obstacles.find(b => b.x === o.x && o.y - b.y >= 0 && o.y - b.y < 30));
  const used = new Set(byProp.filter(Boolean)), out = [...world.obstacles.filter(b => !used.has(b) && !(b.x === 2820 && b.y === 2312))];
  for (const p of props) {
    const i = typeof p.id === 'number' ? p.id : -1, src = byProp[i], orig = world.props[i];
    const m = p.grow || 1;
    if (p.outlineKind && !p.footprint) continue;
    if (p.footprint) out.push(p.footprint);
    else if (src && !isPlant(p)) out.push({...src, x: p.x + (src.x - orig.x) * m, y: p.y + (src.y - orig.y) * m, rx: src.rx * m, ry: src.ry * m});
    else if (isTree(p)) out.push({x: p.x, y: p.y - 9, rx: 31, ry: 22});
    else if (isBush(p)) out.push({x: p.x, y: p.y - 8, rx: half(p) * .55, ry: 22});
  }
  return out;
}

export {SLEEP_SPOTS, sleeperFootprint};
export function sleepSpots(world, props, walkable, sizes) {
  const steps = (x, y) => x > 2780 && x < 3060 && y > 1340 && y < 1660;
  const beds = resolveSleepSpots(world, props, walkable, sizes, {spots: SLEEP_SPOTS, home: true, pathDist, steps,
    avoid: [{x: RING.x, y: RING.y, rx: RING.rx + 60, ry: RING.ry + 50, name: 'plaza'}]});
  const outer = resolveSleepSpots(world, props, walkable, sizes, {spots: homeSleepOuter, home: true, occupied: beds,
    pathDist: (x,y) => Math.min(...homeRoutes.map(r => Math.min(...r.samples.slice(1).map((b,i) => segDist(x,y,r.samples[i],b))) - r.width/2)),
    steps: (x,y) => expansion.roads.some(r => r.rings && inShape(x,y,{poly:r.rings[0]}))});
  const more = resolveSleepSpots(world, props, walkable, sizes, {spots: homeSleepMore, home: true, occupied: [...beds,...outer],
    pathDist: (x,y) => Math.min(...homeRoutes.map(r => Math.min(...r.samples.slice(1).map((b,i) => segDist(x,y,r.samples[i],b))) - r.width/2)),
    steps: (x,y) => expansion.roads.some(r => r.rings && inShape(x,y,{poly:r.rings[0]}))});
  const all = [...beds, ...outer, ...more];
  all.bad = [...beds.bad, ...outer.bad, ...more.bad];
  return all;
}

export const HOME_ORIGIN = expansion.origin;
export const HOME_TILES = [...expansion.tiles, ...original.ground.tiles.map(t=>({...t,src:t.src.replace('/pixi-art/','/pixi-art/home-expansion/')}))];
export function createUnoutlinedPlacements() {
  const base=placeWorld(homeOriginalWorld);
  return [...createOriginalPlacements(base, geometry({...base,obstacles:[]}).walkable).filter(p=>!(expansion.homeArches && p.id === 16)), ...expansion.props].map(p=>{const edit=expansion.reviewProps?.[p.id];if(!edit)return p;const q={...p,...edit};if(p.footprint&&!edit.footprint&&(edit.x!==undefined||edit.y!==undefined)){const dx=q.x-p.x,dy=q.y-p.y;q.footprint=p.footprint.poly?{poly:p.footprint.poly.map(([x,y])=>[x+dx,y+dy])}:{...p.footprint,x:p.footprint.x+dx,y:p.footprint.y+dy};}return q;});
}
export function createPlacements() {
  return createUnoutlinedPlacements().map(solidBuilding);
}
export function homeDecals(props) {
  const base=placeWorld(homeOriginalWorld), old=geometry({...base,obstacles:[]}).walkable;
  const originalProps=props.filter(p=>!String(p.id).startsWith('bigger-'));
  const grown={...base,coast:shapes.coast};
  return [...decalsFor(base,originalProps,old), ...decalsFor(grown,originalProps,geometry({...grown,obstacles:[]}).walkable).filter(d=>!old(d.x,d.y))].filter(d => !/grass|flower/.test(d.src) || reviewPathClear(d.x,d.y,8)).filter(d=>!(expansion.riverWater??[]).some(w=>inShape(d.x,d.y,w)));
}

export const HOME_DECKS = expansion.decks ?? [];
export const HOME_MOUTHS = expansion.riverMouths ?? [];
export const HOME_GROUND_DECALS = (expansion.groundDecals ?? []).filter(d=> !/grass|flower/.test(d.src) || reviewPathClear(d.x,d.y,8));
