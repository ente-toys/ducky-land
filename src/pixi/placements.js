import library from '../../assets/manifest.json';
import original from './art-manifest.json';
import layout from './layout.json';   // GPT's placement pass (boss 3 Nov): remove / move / swap on top of the base placement

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

function place(asset, point) {
  const src = asset.name === 'rowboat' ? '/pixi-art/rowing-hull.svg'
    : original.enhancedAssets[asset.file] || urls[`../../${asset.file}`];
  return {...point, asset: asset.name, src,
    width: asset.size.width, height: asset.size.height, resolution: .5,
    anchor: {x: asset.anchor.x / asset.size.width, y: asset.anchor.y / asset.size.height}, scale: .24};
}

// Boss 3 Nov: GPT's minimal plant set (2 trees, 3 bushes, 3 flowers), one shared scale (Ducky = 120 svg units).
const PLANTS = {
  'tree-1': [260, 360], 'tree-2': [180, 360], 'bush-1': [130, 100], 'bush-2': [168, 110], 'bush-3': [116, 104],
  'flower-1': [48, 36], 'flower-2': [48, 36], 'flower-3': [44, 36],
};
// boss 3 Nov: trees smaller (about 2 Duckies), bushes a touch smaller, flowers as they were
const PLANT_SCALE = {tree: 1.15, bush: 1.3, flower: 1.6};
function plant(kind, point) {
  const [width, height] = PLANTS[kind];
  return {...point, asset: kind, src: `/pixi-art/plants/${kind}.svg`, width, height, resolution: 5,   // rasterised 5x: drawn 1.6x and zoomed up to 1.8x on 2x screens
    anchor: {x: .5, y: 1}, scale: PLANT_SCALE[kind.split('-')[0]]};
}

export function createPlacements(world, walkable) {
  // Boss 2 + 3 Nov: no place-name signs, cities or flags on the island.
  const props = original.props.filter(prop => !prop.name.startsWith('Wayfinding')).map(prop => {
    if (prop.zone === 'lighthouse-beach') return prop;
    if (prop.name === 'Drip tree' || prop.name === 'Hill tree') return plant(prop.id % 2 ? 'tree-2' : 'tree-1', prop);
    if (prop.name === 'Flower planter') return plant('bush-3', prop);
    if (prop.name === 'Library flowers') return plant(prop.id % 2 ? 'flower-1' : 'flower-3', prop);
    const asset = byName.get(replacements[prop.name]);
    if (asset?.name === 'sailboat') {
      return place(asset, {...prop, x: world.water[1].x - 205});
    }
    return asset ? place(asset, prop) : prop;
  });
  const zones = ['bread-forest','pond','library','plaza','race-lake','lighthouse-beach','islets'];
  const details = library.assets.filter(asset => ['food','nature','beach','street'].includes(asset.category)
    && !/^(tree-|fence-|sand-edge|bench-|lamp-|sign|flag)/.test(asset.name));   // boss 3 Nov: no city flags
  // A few bushes and flower clumps beside the trees, kept sparse on purpose (boss 3 Nov: minimal, no crowding).
  const trees = props.filter(p => /^tree-/.test(p.asset));
  trees.forEach((tree, i) => {
    const side = i % 2 ? -1 : 1;
    if (i % 3 === 0) {const x = tree.x + side * 150, y = tree.y + 30; if (walkable(x, y)) props.push(plant(['bush-1','bush-2'][i % 2], {id: `bush-${i}`, name: 'Bush', x, y, zone: tree.zone}));}
    if (i % 4 === 1) {const x = tree.x - side * 110, y = tree.y + 45; if (walkable(x, y)) props.push(plant(['flower-1','flower-2','flower-3'][i % 3], {id: `flower-${i}`, name: 'Flowers', x, y, zone: tree.zone}));}
  });
  // Boss 3 Nov: fewer details. The scattered food, nature, beach and street pieces are off.
  if (true) return applyLayout(props);
  details.forEach((asset, i) => {
    const zone = asset.category === 'beach' ? 'lighthouse-beach' : asset.category === 'food' ? 'bread-forest' : zones[i % zones.length];
    if (zone === 'lighthouse-beach') return;
    const z = world.zones[zone], angle = i * 2.399963, radius = 190 + (i % 5) * 53;
    const x = z.x + Math.cos(angle) * radius, y = z.y + 180 + Math.sin(angle) * radius * .6;
    if (!walkable(x,y) || Math.hypot(x-z.spawn[0],y-z.spawn[1]) < 110) return;
    props.push(place(asset, {id: `detail-${i}`, name: asset.name, x, y, zone}));
  });
  return props;
}

function applyLayout(props) {
  const gone = new Set(layout.remove.map(String)), byId = new Map(props.map(p => [String(p.id), p]));
  for (const {id, x, y} of layout.move || []) {const p = byId.get(String(id)); if (p) Object.assign(p, {x, y});}
  for (const {id, kind} of layout.swap || []) {const p = byId.get(String(id)); if (p && PLANTS[kind]) Object.assign(p, plant(kind, p));}
  const out = props.filter(p => !gone.has(String(p.id)));
  for (const a of layout.add || []) if (PLANTS[a.kind]) out.push(plant(a.kind, {id: `add-${out.length}`, name: a.kind, x: a.x, y: a.y, zone: a.zone}));
  // boss 3 Nov: a handful of rocks on the open lawns, very few
  for (const r of layout.rocks || []) {const asset = byName.get(r.kind); if (asset) out.push(place(asset, {id: `rock-${out.length}`, name: r.kind, x: r.x, y: r.y}));}
  // boss 3 Nov: paired trees were touching; push any two trees closer than 330 apart sideways
  const trees = out.filter(p => /^tree-/.test(p.asset));
  for (let i = 0; i < trees.length; i++) for (let j = i + 1; j < trees.length; j++) {
    const a = trees[i], b = trees[j], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (d >= 330) continue;
    const push = (330 - d) / 2, dir = a.x <= b.x ? -1 : 1;
    a.x += dir * push; b.x -= dir * push;
  }
  return out;
}
