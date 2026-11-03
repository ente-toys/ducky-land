import library from '../../assets/manifest.json';
import original from './art-manifest.json';

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
const PLANT_SCALE = 1.6;
function plant(kind, point) {
  const [width, height] = PLANTS[kind];
  return {...point, asset: kind, src: `/pixi-art/plants/${kind}.svg`, width, height, resolution: 5,   // rasterised 5x: drawn 1.6x and zoomed up to 1.8x on 2x screens
    anchor: {x: .5, y: 1}, scale: PLANT_SCALE};
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
  if (true) return props;
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
