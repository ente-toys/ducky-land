import homeOriginalWorld from './home-original-world.json';
import expansion from './home-expansion.json';
import {geometry} from '../../rive/web/island-geometry.mjs';
import library from '../../assets/manifest.json';
import original from './art-manifest.json';
import layout from './layout.json';
import rawPaths from './paths.json';   // footpath centre lines, sampled from the painted curves in the ground tiles (boss 3 Nov: the old corner-only lines missed the bends by up to 85)
import shapes from './walk-shapes.json';   // boss 4 Nov: the client's coast and race-lake outlines, traced from the art (walk-map overlay)
import {inShape} from '../../rive/web/island-geometry.mjs';
import {SLEEP_SPOTS as BASE_SLEEP_SPOTS, resolveSleepSpots, sleeperFootprint} from './sleep-spots.js';
import homeSleepExtra from '../../rive/web/home-sleep-extra.json';
import homeExtraProps from '../../rive/web/home-extra-props.json';
const SLEEP_SPOTS = Object.fromEntries(Object.entries(BASE_SLEEP_SPOTS).map(([pose, spots]) => [pose, [...spots, ...(homeSleepExtra[pose] ?? [])]]));
import {PLAZA_BENCHES, benchFootprint, benchAnchor, benchBox, benchFile} from './plaza-benches.js';
const footpaths = rawPaths.filter(l => !(l[0][0] === 3940 && l[0][1] === 3260));   // round 4: the east jetty's stub path went with its islet
const segDist = (x, y, a, b) => {const dx = b[0]-a[0], dy = b[1]-a[1], t = Math.max(0, Math.min(1, ((x-a[0])*dx + (y-a[1])*dy) / (dx*dx + dy*dy))); return Math.hypot(x-a[0]-t*dx, y-a[1]-t*dy);};
const pathDist = (x, y) => Math.min(...footpaths.flatMap(l => l.slice(1).map((b, i) => segDist(x, y, l[i], b))));   // GPT's placement pass (boss 3 Nov): remove / move / swap on top of the base placement

const urls = import.meta.glob('../../assets/**/*.svg', {eager: true, query: '?url', import: 'default'});
const byName = new Map(library.assets.map(asset => [asset.name, asset]));
// These are the original page's post-load substitutions, formerly in assets.js.
const replacements = {
  'Drip tree': 'tree-oak', 'Hill tree': 'tree-round', 'Plaza bench': 'bench-wood',
  'Race bench': 'bench-park', 'Plaza lantern': 'lamp-lantern', 'Plaza planter': 'planter-flowers',
  'Beach shell': 'shell-scallop', 'Coast rock': 'rock-boulder', 'Racing sailboat': 'sailboat',
  'Blue racing sailboat': 'rowboat', 'Beach umbrella': 'umbrella-garden',
  'Beach blanket': 'picnic-blanket', 'Outdoor reading': 'picnic-table',
};

// boss 3 Nov, fix 7: ONE scale sheet (world-restyle/STYLE.md section 8). H = one standing Ducky = 130 world units.
// Each multiplier scales that kind's base placement scale (.24 library props, 1 original props, PLANT_SCALE plants).
export const H = 130;
const SCALE_SHEET = {
  'lamp-lantern': .47,                                             // round 4: 1.6H tall with a thicker post (was 2.76H, sticks)
  'Little library': 1.2,                                           // round 4: the library bigger, a real landmark (1.3 crowded the hill)
  'bench-wood': .75, 'bench-park': .72, 'Pond bench': .72,         // boss 3 Nov: benches were twice too big; now about 1.1H wide
  'Market stall': 1.25, 'Market bunting': 1.25,                    // 2.52H tall, 3.05H wide
  'planter-flowers': .7, 'bin-recycling': .6,                      // 1.03H, .69H
  'picnic-table': .6,                                              // boss 3 Nov: same seat scale as the benches, 1.8H wide (was 3H)
  'Forest picnic': 1.25, 'Beach blanket': 1.25,                    // flat, 2.2H wide
  'Rubber duck lighthouse': 1.3, 'Beach umbrella': 1.2,            // 4.7H (tallest landmark), 2.18H
  'Coast rock': .9, 'Beach shell': .8, 'rock-boulder': .65, 'rock-flat': .55,   // rocks .5-.8H wide, shells .3H
  'flower-poppy': .85, cupcake: .8, 'ice-cream-double': .65,       // small groups .3-.6H tall
  tree: 1.1,                                                       // 3.5H, bottom of fix 7's 3.5-5H (STYLE 14: was held at 3.2H)
};
const FOUNTAIN = {scale: 1.05, resolution: 2.5};                     // boss 3 Nov: keep the previous fountain, no redraw
function sized(p) {
  const m = SCALE_SHEET[p.asset] ?? SCALE_SHEET[p.name] ?? (/^tree-/.test(p.asset) ? SCALE_SHEET.tree : 1);
  return m === 1 ? p : {...p, scale: p.scale * m, resolution: (p.resolution ?? 1) * Math.max(1, m), grow: m};   // boss 4 Nov: grow scales a moved footprint too
}

function place(asset, point) {
  const src = asset.name === 'rowboat' ? '/pixi-art/rowing-hull.svg'
    : original.enhancedAssets[asset.file] || urls[`../../${asset.file}`];
  return {...point, asset: asset.name, src,
    width: asset.size.width, height: asset.size.height, resolution: .5,
    anchor: {x: asset.anchor.x / asset.size.width, y: asset.anchor.y / asset.size.height}, scale: .24};
}

// Boss 3 Nov: GPT's minimal plant set (2 trees, 3 bushes, 3 flowers), one shared scale (Ducky = 130 world units, STYLE 1).
const PLANTS = {
  'tree-1': [260, 360], 'tree-2': [180, 360], 'bush-1': [130, 100], 'bush-2': [168, 110], 'bush-3': [116, 104],
  'tree-3': [300, 380], 'tree-4': [200, 280], 'tree-5': [150, 380], 'bush-4': [140, 100], 'bush-5': [170, 110], 'bush-6': [120, 96],   // round 4: GPT's new oak, bushy tree, birch and three shrubs
  'flower-1': [48, 36], 'flower-2': [48, 36], 'flower-3': [44, 36],
};
// boss 3 Nov: trees smaller (about 2 Duckies), bushes a touch smaller, flowers as they were (trees x1.1 in SCALE_SHEET)
const PLANT_SCALE = {tree: 1.15, bush: 1.3, flower: 1.6};
function plant(kind, point) {
  const [width, height] = PLANTS[kind];
  return {...point, asset: kind, src: `/pixi-art/plants/${kind}.svg`, width, height, resolution: 5,   // rasterised 5x: drawn 1.6x and zoomed up to 1.8x on 2x screens
    anchor: {x: .5, y: 1}, scale: PLANT_SCALE[kind.split('-')[0]]};
}

// boss 3 Nov (a): every bridge is an arch. The five jetties were planks baked into the ground tiles; they are now their own
// SVGs drawn in WORLD coordinates (place at the viewBox origin, scale 1). The pond bridge stays prop-16. All six sit in the
// ground layer, under the Duckies. A, B and R are the arch ends and its rise (world-restyle/jobs/bridges/NOTES.md).
export const JETTIES = [
  [1, 3222.39, 3276.877, 229.2164, 476.233], [2, 870.0355, 2996.0389, 337.9679, 475.3502], [3, 2208.9189, 3220.4091, 209.3931, 665.9182],   // round 4b viewBoxes
  [5, 5004.9592, 1492.5089, 494.0617, 277.2587],   // round 4: jetty 4 and its islet are gone, so the piers stop reading as a row
].map(([n, x, y, width, height]) => ({src: `/pixi-art/bridge-jetty-${n}.svg`, x, y, width, height, resolution: 1.5}));
const ARCHES = [
  {a: [1188, 2630], b: [2092, 2630], r: 88, w: 112, squash: 72 / 112},   // pond: the deck top is drawn 72 deep for 112 of walkway
  // round 4: every jetty humps R = 70 (was 40-44), so a Ducky visibly climbs it
  {a: [3320, 3319], b: [3320, 3730], r: 70, w: 115}, {a: [1137.84, 3066.05], b: [940.19, 3417.43], r: 70, w: 84},
  {a: [2320.86, 3264.02], b: [2288.93, 3859.97], r: 70, w: 84},
  {a: [5034.08, 1638.41], b: [5469.9, 1681.99], r: 70, w: 84},
  ...(expansion.arches ?? []),
];
// Where to draw a Ducky's feet: on a deck it rides up the arch, lift = R * 4t(1-t); off a bridge it is the plain world y.
// boss 6 Nov: a themed island passes its own arches (world.json `arches`, the same {a, b, r, w} format)
export function deckY(x, y, arches = ARCHES) {
  for (const {a, b, r, w, squash} of arches) {
    const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy, t = ((x - a[0]) * dx + (y - a[1]) * dy) / len2;
    if (t <= 0 || t >= 1) continue;
    const side = ((x - a[0]) * dy - (y - a[1]) * dx) / Math.sqrt(len2);
    if (Math.abs(side) > w / 2 + 12) continue;
    const k = 4 * t * (1 - t), ease = Math.min(1, k * 4);   // the pond squash fades in over the landings, so a Ducky never jumps
    return (squash ? a[1] + (y - a[1]) * (1 - ease * (1 - squash)) : y) - r * k;
  }
  return y;
}

// round 4: the east islet (3930, 3830), its jetty and stub path are gone from the ground art; drop them from the walkable world too
// boss 4 Nov: the race lake is its drawn water (lake-race.svg), not the old oval; x/y/rx/ry are the outline's bounds
const LAKE = {x: 4130, y: 1537, rx: 538, ry: 296, poly: shapes.lake};
export const trimWorld = w => ({...w, islets: w.islets.filter(a => a[0] !== 3930), walkways: w.walkways.filter(b => b.a[0] !== 3940),
  water: w.water.map(o => o.x === 4140 && o.y === 1520 ? LAKE : o)});
// boss 4 Nov: what the client sim walks on. The coast is traced from the ground tiles' shoreline, inset 35 so a dry margin stays
// (the old one sat 20-160 inside the sand); the south-west jetty gets a deck-wide step-on. Props were placed on the old coast,
// so only the sim gets these. The socket server still walks on world.json.
export const walkWorld = (world, props) => ({...world, coast: expansion.coast, obstacles: [...obstaclesFor(props, homeOriginalWorld), ...(expansion.obstacles ?? [])],
  water: [...world.water, ...(expansion.riverWater ?? [])], bridges: [...world.bridges, ...(expansion.riverBridges ?? [])],
  walkways: [...world.walkways, ...(expansion.walkways ?? []), {a: [1165, 3000], b: [1095, 3098], w: 120}, {a: [1092, 3060], b: [942, 3405], w: 110}]});   // boss 4 Nov verify: + the drawn deck's centre line (the old strip hugged the right rail)

// Ground under a point, for the engine's one contact-shadow recipe (fix 4): sand areas from the ground art, else grass.
const inEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
const SAND = [[2820, 2390, 562, 398], [4775, 2654, 478, 540], [4132, 1530, 682, 447], [1640, 2630, 470, 300]];   // plaza, beach, race-lake ring, pond bank
export function groundAt(x, y, world) {
  if (world.water.some(o => inShape(x, y, o))) return 'water';
  return SAND.some(s => inEllipse(x, y, ...s)) || world.islets.some(a => !inEllipse(x, y, a[0], a[1], a[2] * .6, a[3] * .6) && inEllipse(x, y, ...a))
    || pathDist(x, y) < 64 ? 'sand' : 'grass';
}

function createOriginalPlacements(world, walkable) {
  // Boss 2 + 3 Nov: no place-name signs, cities or flags on the island.
  const props = original.props.filter(prop => !prop.name.startsWith('Wayfinding')).map(prop => {
    if (prop.zone === 'lighthouse-beach') return prop;   // keeps its own art; the scale sheet still applies below
    if (prop.name === 'Drip fountain') return {...prop, asset: 'fountain-wishing', src: '/pixi-art/fountain-wishing.svg',
      y: 2370, width: 480, height: 480, anchor: {x: .5, y: .625}, ...FOUNTAIN};   // boss 4 Nov: garden fountain drawn in the plaza ring's perspective, centred on the ring
    if (prop.name === 'Croissant tree' || prop.name === 'Baguette tree') return prop.id % 3 ? null : plant(prop.id % 2 ? 'tree-1' : 'tree-2', prop);   // boss 3 Nov: bread trees were ugly; keep a third as green trees
    if (prop.name === 'Drip tree' || prop.name === 'Hill tree') return plant(prop.id % 2 ? 'tree-2' : 'tree-1', prop);
    if (prop.name === 'Flower planter') return plant('bush-3', prop);
    if (prop.name === 'Library flowers') return plant(prop.id % 2 ? 'flower-1' : 'flower-3', prop);
    const asset = byName.get(replacements[prop.name]);
    if (asset?.name === 'sailboat') return null;   // boss 4 Nov: no sailboat on the race lake
    return asset ? place(asset, prop) : prop;
  }).filter(Boolean);
  const zones = ['bread-forest','pond','library','plaza','race-lake','lighthouse-beach','islets'];
  const details = library.assets.filter(asset => ['nature'].includes(asset.category)   // round 4: no loose food on the grass (the goods are in the shops), no random street props (the furniture is placed on purpose below)
    && !/^(tree-|fence-|sand-edge|bench-|lamp-|sign|flag|bush-|grass-|log|stump|reeds|cattails|lily)/.test(asset.name));   // no flags; plants come from the GPT set   // boss 3 Nov: no city flags
  // A few bushes and flower clumps beside the trees, kept sparse on purpose (boss 3 Nov: minimal, no crowding).
  const trees = props.filter(p => /^tree-/.test(p.asset));
  trees.forEach((tree, i) => {
    const side = i % 2 ? -1 : 1;
    if (i % 3 === 0) {const x = tree.x + side * 150, y = tree.y + 30; if (walkable(x, y)) props.push(plant(['bush-1','bush-2'][i % 2], {id: `bush-${i}`, name: 'Bush', x, y, zone: tree.zone}));}
    if (i % 4 === 1) {const x = tree.x - side * 110, y = tree.y + 45; if (walkable(x, y)) props.push(plant(['flower-1','flower-2','flower-3'][i % 3], {id: `flower-${i}`, name: 'Flowers', x, y, zone: tree.zone}));}
  });
  // Boss 3 Nov (later): the small food, nature, beach and street props are back (no flags or signs).
  details.forEach((asset, i) => {
    const zone = zones[i % zones.length];
    if (zone === 'lighthouse-beach' || zone === 'islets') return;   // keep the jetty islets clear
    const z = world.zones[zone], angle = i * 2.399963, radius = 190 + (i % 5) * 53;
    const x = z.x + Math.cos(angle) * radius, y = z.y + 180 + Math.sin(angle) * radius * .6;
    if (!walkable(x,y) || Math.hypot(x-z.spawn[0],y-z.spawn[1]) < 110) return;
    if (pathDist(x, y) < 100 || Math.hypot(x - 2820, y - 2350) < 360) return;   // off the paths, clear of the fountain
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
  // boss 3 Nov: a handful of rocks on the open lawns, very few
  for (const r of layout.rocks || []) {const asset = byName.get(r.kind); if (asset) out.push(place(asset, {id: `rock-${out.length}`, name: r.kind, x: r.x, y: r.y}));}
  return out;
}

// boss 3 Nov, round 4 (boss notes b, c, d + the critics): consolidate. Every piece of furniture has a reason to stand where it
// stands: ONE stall on the plaza paving, a bakery cart in the woods, a kiosk on the beach; benches beside a path or facing the
// fountain, the pond or the sea, turned to match; trees and bushes spread evenly over the whole lawn. Deterministic.
const PLAZA = {x: 2820, y: 2390, rx: 562, ry: 398};   // the Cream plaza after the ground job shrank it to 0.78
export const RING = {x: 2820, y: 2370, rx: 470, ry: 360};   // the flagstone paving ring around the fountain (decals/plaza-paving.svg)
const ENTRIES = [[2341, 2326], [2850, 1976], [3215, 2113], [3256, 2507], [2587, 2710]];   // where the five footpaths cross the ring
const DROP = new Set(['4', '5', '6', '7', '8', '9', '10', '11', '12', '15', '20', '21', '35', '42', '43', '44', '45']);   // the old benches are re-placed as seats below
// gone: the old lamps and planters (re-placed below), the bunting, a pond reed where a bench goes, the library picnic table that
// stood on the path, the checkered finish arch (read as a flag), the croissant and donut lying on the grass, the stray table,
// blanket and planter details.
const STALL_SHIFT = [-40, -110];   // boss 5 Nov: the plaza stall stepped out, up and a little left, clear of the paving rings
const STALLS = {1: [2560 + STALL_SHIFT[0], 2112 + STALL_SHIFT[1]], 2: [1450, 1730]}, STALL_ZONE = {2: 'bread-forest', 3: 'lighthouse-beach'};
const isTree = p => /^tree-/.test(p.asset), isBush = p => /^bush-/.test(p.asset), isPlant = p => !!PLANTS[p.asset];
const SMALL = /^(flower-|rock-|mushroom|food|apple|baguette|croissant|cupcake|donut|egg|golden-bread|ice-cream|pear|seed-bag|bin-|planter-)/;
const ANCHOR = /^(bench-|tree-|bush-|picnic-)|Pond bench|Forest picnic|Little library|Market stall/;
const half = p => p.width * p.scale / 2;
// low-discrepancy points (Halton 2,3): the same island every load, no clumps from a random generator
const halton = (i, b) => {let f = 1, r = 0; for (; i > 0; i = Math.floor(i / b)) {f /= b; r += f * (i % b);} return r;};
// the bench at four facings (art job plaza, round 4): which way the sitter looks
const BENCH_ART = {front: 'street--bench-wood', back: 'street--bench-wood-back', left: 'street--bench-wood-left', right: 'street--bench-wood-right'};
const facingOf = (dx, dy) => Math.abs(dy) >= Math.abs(dx) ? (dy > 0 ? 'front' : 'back') : (dx > 0 ? 'right' : 'left');
function bench(id, x, y, look, zone) {
  const side = look === 'left' || look === 'right';
  return {id, name: 'Bench', asset: `bench-wood-${look}`, src: `/pixi-art/detail/${BENCH_ART[look]}.svg`, x, y, zone,
    width: 818, height: 463, anchor: {x: .5, y: 451 / 463}, scale: side ? .28 : .18, resolution: side ? 1.4 : .9, seat: true,   // side art is drawn narrow: .28 makes its length match the front bench seen at .82
    footprint: side ? {x, y: y - 30, rx: 30, ry: 62} : {x, y: y - 10, rx: 70, ry: 24}};
}

// a curved plaza bench: its art is drawn in world units around the ring, so the sprite sits at scale 1 with its anchor on the
// seat's middle (the depth point), and it blocks walking along its own arc
function arcBench(b) {
  const [x, y] = benchAnchor(b), box = benchBox(b);
  return {id: `seat-plaza-${b.deg}`, name: 'Bench', asset: 'bench-arc', src: `/pixi-art/detail/${benchFile(b)}.svg`, x, y, zone: 'plaza',
    width: box.w, height: box.h, anchor: {x: (x - box.x) / box.w, y: (y - box.y) / box.h}, scale: 1, resolution: 2, seat: true, footprint: benchFootprint(b)};
}

// the plaza's furniture before 5 Nov (stall, four straight benches, the entry lamps; planters never counted), kept only so the lawn's
// replant (part d) lands every tree exactly where it always has. Not drawn, not walked: [name, x, y, drawn width, drawn height]
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

  // (b) shops: the plaza stall on the paving's north-west edge facing the fountain; the bakery cart where the woods paths
  // meet; the beach kiosk on the sand, 2H off the umbrellas, well clear of the plaza rim. 4H clear around each.
  for (const [id, at] of Object.entries(STALLS)) {const p = byId(id); if (p) {[p.x, p.y] = at; p.zone = STALL_ZONE[id] || p.zone;}}
  const kiosk = byId(3), beachProps = out.filter(p => p.zone === 'lighthouse-beach' && !/shell|Coast rock/i.test(p.name));
  if (kiosk) {
    const spot = first([...around(4520, 2960, 45, 9), ...around(4600, 2300, 45, 9)], (x, y) => walkable(x, y) && !wet(x, y, 40) && pathDist(x, y) > 170
      && inEllipse(x, y, 4775, 2654, 440, 500) && x > PLAZA.x + PLAZA.rx + 6 * H && roomy(x, y, 1.2 * H, beachProps.filter(p => p !== kiosk))
      && beachProps.every(p => p === kiosk || !(Math.abs(p.x - x) < 260 + half(p) && p.y > y - 450 && p.y < y + 90)));   // nothing inside the kiosk's drawn box
    if (spot) [kiosk.x, kiosk.y] = spot;
    [kiosk.x, kiosk.y] = [4540, 3030];   // round 4: pinned on the open south-west sand, its own spot; the beach blanket moves aside for it
    const towel = byId(49); if (towel) [towel.x, towel.y] = [4790, 3120];
    kiosk.zone = 'lighthouse-beach';
  }
  const stalls = [1, 2, 3].map(byId).filter(Boolean);
  // the woods keep the cart and ONE seat: the picnic table 2H to its side (never in front), on the lawn off the path
  const tableAsset = byName.get('picnic-table'), cart = byId(2), woods = [];
  if (tableAsset && cart) {
    const ok = (x, y) => clear(x, y, 150) && roomy(x, y, .8 * H, stalls) && Math.abs(y - cart.y) < 120;
    const spot = first([...around(cart.x - 2.3 * H, cart.y + 20, 30, 6), ...around(cart.x + 2.3 * H, cart.y + 20, 30, 6)], ok);
    if (spot) {const t = place(tableAsset, {id: 'woods-table', name: 'Picnic table', x: spot[0], y: spot[1], zone: 'bread-forest'}); t.scale *= .6; t.footprint = {x: t.x, y: t.y - 14, rx: half(t) * .85, ry: 34}; woods.push(t); out.push(t);}
  }
  const blanket = byId(33);
  if (blanket) {   // the food blanket on the open lawn, 2H clear of the path and the stall
    const spot = first(around(1230, 2060, 40, 10), (x, y) => clear(x, y, 230) && roomy(x, y, 1.6 * H, [...stalls, ...woods]));
    if (spot) [blanket.x, blanket.y] = spot;
  }

  // (c) benches. Plaza: four on the paving ring facing the fountain, between the path entries, each turned to the fountain.
  // Pond: two on the bank facing the water. Beach: one facing the sea. Library and race lake: one each beside a path, turned to
  // the path (side art on a north-south path). Each tested against the paths so it is never on a route, 1H off other props.
  const seats = [], furniture = () => [...stalls, ...woods, ...seats, ...out.filter(p => /library|lighthouse|umbrella|fountain/i.test(p.name))];
  const seatOk = (x, y, gap = 118) => walkable(x, y) && !wet(x, y, 35) && pathDist(x, y) > gap && !islet(x, y) && !jetty(x, y)
    && roomy(x, y, H * .6, furniture().filter(p => !/fountain/i.test(p.name)));
  // boss 5 Nov: three curved benches on the outer paving ring (plaza-benches.js), in place of the four straight ones
  for (const b of PLAZA_BENCHES) seats.push(arcBench(b));
  const pond = world.water[0];
  for (const degs of [[-62, -48, -76, -118, -104, -132], [64, 50, 78, 116, 102, 130, 36, 144, 24, 156]]) {
    const spot = first(degs.flatMap(d => [45, 70, 95, 120].map(k => {const a = d * Math.PI / 180; return [pond.x + Math.cos(a) * (pond.rx + k), pond.y + Math.sin(a) * (pond.ry + k * .8)];})),
      (x, y) => seatOk(x, y, 100) && seats.every(s => Math.hypot(s.x - x, s.y - y) > 4 * H));
    if (spot) seats.push(bench(`seat-pond-${seats.length}`, spot[0], spot[1], facingOf(pond.x - spot[0], pond.y - spot[1]), 'pond'));
  }
  const beachSeat = first(around(5040, 2560, 40, 9), (x, y) => seatOk(x, y) && coastDist(x, y) > 140 && seats.every(s => Math.hypot(s.x - x, s.y - y) > 6 * H));
  if (beachSeat) seats.push(bench('seat-beach', ...beachSeat, 'right', 'lighthouse-beach'));   // looks east, out to sea
  // a bench at a path edge: offset half the path plus .6H from the centre line, the seat turned to the path
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
  pathSeat(9, .5, -1, null, 'library');     // beside the path east of the library, on its north verge, facing the path
  pathSeat(2, .6, -1, 'back', 'race-lake');   // beside the path to the race lake, on its north verge, looking out over the lake
  out.push(...seats);

  // plaza: a lamp and a planter at the four main path entries, one on each side of the path, so the square reads as designed
  const lampAsset = byName.get('lamp-lantern'), planterAsset = byName.get('planter-flowers');
  [0, 1, 3, 4].forEach((e, i) => {
    const [ex, ey] = ENTRIES[e], dx = ex - RING.x, dy = (ey - RING.y) / .77, len = Math.hypot(dx, dy), tx = -dy / len, ty = dx / len * .77;
    for (const [asset, s, kind] of [[lampAsset, 1, 'lamp'], [planterAsset, -1, 'planter']]) {
      if (!asset) continue;
      const at = k => [ex - dx / len * (20 + k) + tx * s * 112, ey - dy / len * (20 + k) + ty * s * 112];
      const free = (x, y) => seats.every(b => b.footprint?.poly   // boss 5 Nov: a curved bench is tested along its whole arc, and never in the lamp's column
        ? b.footprint.poly.every(([u, v]) => Math.hypot(u - x, (v - y) * 1.3) > 70 && !(Math.abs(u - x) < 40 && v < y && v > y - 230))
        : Math.hypot(b.x - x, (b.y - y) * 1.3) > half(b) + 60);
      const [x, y] = [0, 40, 80, -30, 120, -60, -90].map(at).find(([x, y]) => free(x, y)) || at(0);   // never against a bench
      const p = sized(place(asset, {id: `plaza-${kind}-${i}`, name: kind === 'lamp' ? 'Plaza lantern' : 'Plaza planter', x, y, zone: 'plaza'}));
      p.footprint = kind === 'lamp' ? {x, y: y - 6, rx: 16, ry: 14} : {x, y: y - 20, rx: 46, ry: 34};   // boss 5 Nov: the pot is 80 wide and tall, so a Ducky stops beside or behind it, never inside it
      out.push(p);
    }
  });

  // off the footpaths: a small group standing on a path slides out sideways to the nearer verge, or goes
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

  // (d) replant: an even blue-noise spread over the WHOLE lawn (dart throwing over Halton points, one minimum gap), a little
  // denser along the coast, open lawns kept around the plaza, at most 6 trees on the north rim. Never on a path, in water, on
  // sand, an islet or a jetty; trunks 1H inside the coast (crowns never over the sea), 1.5H off buildings, 1H off every bridge
  // and jetty walkway measured from the CANOPY; no plant's base inside another plant's canopy box. Kinds never repeat a neighbour.
  const onLand = (x, y) => world.coast.length && walkable(x, y) && !islet(x, y);
  // boss 5 Nov: the replant measures room against the plaza furniture AS IT STOOD before the curved benches and the stall
  // move (REPLANT_PLAZA), so a plaza tweak never reshuffles every tree and sleeper on the island
  const solid = [...out.filter(p => !SMALL.test(p.asset || '') && !/bridge|bunting|banner|reeds|boat|shell|Coast rock/i.test(p.asset || p.name)
    && !((p.zone === 'plaza' && !/fountain/i.test(p.name)) || String(p.id) === '1')), ...REPLANT_PLAZA];
  const sandy = (x, y, pad) => SAND.some(([cx, cy, rx, ry]) => inEllipse(x, y, cx, cy, rx + pad, ry + pad * .7)) || wet(x, y, pad + 60);
  const building = /library|lighthouse|Market stall|fountain/i;
  const roomFor = (x, y, r, tall) => solid.every(p => Math.hypot(x - p.x, (y - p.y) * 1.6) > r + half(p) + (building.test(p.name) ? 1.5 * H : 50)
    && !(tall && y > p.y && y - p.y < 470 && Math.abs(x - p.x) < r + half(p) * .7)
    && !(p.y > y && p.y - y < p.height * p.scale * .9 && Math.abs(x - p.x) < half(p) + r * .5));   // nor hide behind one
  const spots = Array.from({length: 6000}, (_, i) => [300 + halton(i + 1, 2) * 5200, 450 + halton(i + 1, 3) * 3400]);
  const TREE_KINDS = ['tree-1', 'tree-2', 'tree-3', 'tree-4', 'tree-5'].filter(k => PLANTS[k]);
  const BUSH_KINDS = ['bush-1', 'bush-2', 'bush-3', 'bush-4', 'bush-5', 'bush-6'].filter(k => PLANTS[k]);
  const canopy = (kind, scale) => [PLANTS[kind][0] * scale / 2, PLANTS[kind][1] * scale];   // half width, height
  const nTrees = Math.max(24, plants.filter(isTree).length), nBushes = Math.max(10, plants.filter(isBush).length);
  const stairsClear = (x, y) => !(x > 2620 && x < 3220 && y > 1330 && y < 2000);   // boss 4 Nov: no tree over the museum stairs
  const treeOk = (x, y) => stairsClear(x, y) && onLand(x, y) && coastDist(x, y) > H + 40 && pathDist(x, y) > 135 && !sandy(x, y, 100) && !jetty(x, y, 200)
    && !inEllipse(x, y, PLAZA.x, PLAZA.y, PLAZA.rx + 260, PLAZA.ry + 190) && roomFor(x, y, 150, true)
    && [[0, .5], [0, .85], [-.7, .6], [.7, .6]].every(([u, v]) => !wet(x + u * 150, y - v * 420, 30));   // the crown never hangs over a pond
  const treeSpots = spots.filter(s => treeOk(...s));
  const gapAt = (x, y) => (coastDist(x, y) < 520 ? .85 : 1.08);   // the coast frame a touch denser, the inner lawns more open
  let trees = [];
  for (let r = 1000; r >= 2.2 * H; r -= 15) {
    const got = [];
    for (const s of treeSpots) {
      if (got.length >= nTrees) break;
      if (s[1] < 1050 && got.filter(g => g[1] < 1050).length >= 6) continue;   // the north rim: at most 6
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
  // a plant's base must not sit inside another plant's canopy box (behind it or under it), with a margin
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
  // flowers sit at a bench end or a tree's foot, never touching another plant
  const flowerKinds = plants.filter(p => /^flower-/.test(p.asset)).map(p => p.asset), flowers = [];
  const feet = [...seats.flatMap(s => [[s.x + 95, s.y + 12], [s.x - 95, s.y + 12]]), ...grown.filter(isTree).flatMap(t => [[t.x + 120, t.y + 30], [t.x - 120, t.y + 30]])];
  for (const [x, y] of feet) {
    if (flowers.length >= flowerKinds.length) break;
    if (!onLand(x, y) || pathDist(x, y) < 85 || wet(x, y, 40) || flowers.some(f => Math.hypot(f.x - x, f.y - y) < 700)
      || ![...grown, ...out.filter(p => !/bridge|bunting|banner|boat/i.test(p.asset || p.name))].every(g => Math.hypot(x - g.x, (y - g.y) * 1.6) > (isTree(g) ? 110 : half(g) + 50))) continue;
    flowers.push(plant(flowerKinds[flowers.length], {id: `flower-${flowers.length}`, name: 'Flowers', x, y, zone: ''}));
  }
  out.push(...grown, ...flowers);

  // small groups: slide against the nearest anchor's base (an elliptical footprint), keep a little gap, never two on one spot
  const anchors = out.filter(p => ANCHOR.test(p.asset || p.name)), placed = [...grown, ...flowers];
  const inPlaza = (x, y) => inEllipse(x, y, PLAZA.x, PLAZA.y, PLAZA.rx, PLAZA.ry);
  return out.filter(p => {
    if (!SMALL.test(p.asset || '') || isPlant(p) || /^plaza-/.test(p.id)) return true;
    const near = anchors.filter(a => inPlaza(a.x, a.y) === inPlaza(p.x, p.y)).map(a => [a, Math.hypot(p.x - a.x, p.y - a.y)]).sort((a, b) => a[1] - b[1])[0];
    if (!near || near[1] > 700) return false;   // alone in open space
    const [a] = near, furn = /bench|stall|picnic/i.test(a.asset || a.name);
    if (furn) return false;   // boss 3 Nov (c): nothing crowds the furniture
    const rx = half(a) * .8 + half(p) + 10, ry = rx * .45, base = Math.atan2((p.y - a.y) / .45, p.x - a.x);
    for (const turn of [0, .45, -.45, .9, -.9, 1.35, -1.35]) {
      const t = base + turn, x = a.x + Math.cos(t) * rx, y = a.y + Math.sin(t) * ry;
      if (placed.some(q => Math.hypot(q.x - x, q.y - y) < half(p) + half(q) + 6) || !clear(x, y, 90) || inEllipse(x, y, RING.x, RING.y, RING.rx + 40, RING.ry + 40)) continue;
      p.x = x; p.y = y; placed.push(p); return true;
    }
    return false;
  });
}

// boss 3 Nov, critic fix: ground detail. Grass tufts, tiny flowers and pebbles on the lawns, specks on the sand, small stones
// on the path verges. Blue-noise spread (Poisson-disk feel, about .6H apart), three times denser along the path edges and the
// coast, never on a path, in water, under a prop's base or on the plaza paving. Art: world-restyle/jobs/decals (1 unit = 1 world).
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
    const k = 1.5;   // drawn at .3H, shown a touch bigger so they read at play zoom
    out.push({src: `/pixi-art/decals/${kind}.svg`, x, y, width: DECALS[kind][0] * k, height: DECALS[kind][1] * k, flip: halton(i, 11) > .5});
  }
  return out;
}

// boss 3 Nov: collision follows the props. Each original prop's world.json footprint moves with it; replanted plants get a trunk
// footprint; dropped props lose theirs. The client sim uses this. The socket server (worker/) still walks on world.json's list.
// boss 4 Nov: footprints fitted to the drawn art (walk-map overlay), by original prop id: the fountain basin, the plaza stall's
// counter, the beach kiosk's counter, the museum down to its bottom step (so a Ducky reaches the door), the lighthouse plinth.
// Plus scenery with no prop: the race lake's spring rocks and the two stone side walls of the museum steps. The sim pads every footprint by 16.
const FOOTPRINTS = {0: {x: 2817, y: 2370, rx: 205, ry: 146}, 1: {poly: [[2420, 2050], [2700, 2050], [2700, 2098], [2420, 2098]].map(([x, y]) => [x + STALL_SHIFT[0], y + STALL_SHIFT[1]])},
  3: {poly: [[4396, 2968], [4684, 2968], [4684, 3016], [4396, 3016]]},
  34: {poly: [[2631, 896], [3209, 896], [3209, 1124], [2631, 1124]]}, 46: {x: 4860, y: 2472, rx: 148, ry: 122}};
const SCENERY = [{poly: [[4390, 1225], [4450, 1192], [4490, 1185], [4560, 1218], [4600, 1262], [4615, 1300], [4590, 1340], [4520, 1340], [4410, 1290]]},   // boss 4 Nov verify: the spring slabs + boulders traced, the oval let a Ducky walk on the stream
  {poly: [[2817, 1380], [2800, 1625]]}, {poly: [[3023, 1380], [3037, 1625]]}];
export function obstaclesFor(props, world) {
  const byProp = world.props.map(o => world.obstacles.find(b => b.x === o.x && o.y - b.y >= 0 && o.y - b.y < 30));
  const used = new Set(byProp.filter(Boolean)), out = [...world.obstacles.filter(b => !used.has(b) && !(b.x === 2820 && b.y === 2312)), ...SCENERY];   // footprints with no prop stay; boss 4 Nov: not the old fountain's (38 above the prop, it never matched)
  for (const p of props) {
    const i = typeof p.id === 'number' ? p.id : -1, src = byProp[i], orig = world.props[i];
    const m = p.grow || 1;
    if (p.footprint || FOOTPRINTS[i]) out.push(p.footprint || FOOTPRINTS[i]);   // round 4: benches, lamps, planters and the woods table carry their own
    else if (src && !isPlant(p)) out.push({...src, x: p.x + (src.x - orig.x) * m, y: p.y + (src.y - orig.y) * m, rx: src.rx * m, ry: src.ry * m});
    else if (isTree(p)) out.push({x: p.x, y: p.y - 9, rx: 31, ry: 22});
    else if (isBush(p)) out.push({x: p.x, y: p.y - 8, rx: half(p) * .55, ry: 22});
  }
  return out;
}

// boss 5 Nov: where the 28 sleeping Duckies lie on home (sleep-spots.js holds the spots and the checks, shared with every
// themed island since boss 6 Nov). Home's own no-go places: its footpaths, the plaza paving ring and the museum stair.
export {SLEEP_SPOTS, sleeperFootprint};
export function sleepSpots(world, props, walkable, sizes) {
  const steps = (x, y) => x > 2780 && x < 3060 && y > 1340 && y < 1660;   // the museum stair
  return resolveSleepSpots(world, props, walkable, sizes, {spots: SLEEP_SPOTS, home: true, pathDist, steps,
    avoid: [{x: RING.x, y: RING.y, rx: RING.rx + 60, ry: RING.ry + 50, name: 'plaza'}]});
}

// Home grows around its original coordinate frame. Keep the original composition's inputs frozen.
export const HOME_ORIGIN = expansion.origin;
export const HOME_TILES = [...expansion.tiles, ...original.ground.tiles.map(t=>({...t,src:t.src.replace('/pixi-art/','/pixi-art/home-expansion/')}))];
export function createPlacements() {
  const base=trimWorld(homeOriginalWorld);
  return [...createOriginalPlacements(base, geometry({...base,obstacles:[]}).walkable), ...expansion.props];
}
export function homeDecals(props) {
  const base=trimWorld(homeOriginalWorld), old=geometry({...base,obstacles:[]}).walkable;
  const originalProps=props.filter(p=>!String(p.id).startsWith('bigger-'));
  const grown={...base,coast:shapes.coast};
  return [...decalsFor(base,originalProps,old), ...decalsFor(grown,originalProps,geometry({...grown,obstacles:[]}).walkable).filter(d=>!old(d.x,d.y))];
}

export const HOME_DECKS = expansion.decks ?? [];
