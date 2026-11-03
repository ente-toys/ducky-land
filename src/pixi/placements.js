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
  return {...point, asset: asset.name, src: original.enhancedAssets[asset.file] || urls[`../../${asset.file}`],
    width: asset.size.width, height: asset.size.height, resolution: .5,
    anchor: {x: asset.anchor.x / asset.size.width, y: asset.anchor.y / asset.size.height}, scale: .24};
}

export function createPlacements(world, walkable) {
  const props = original.props.map(prop => {
    if (prop.zone === 'lighthouse-beach') return prop;
    const asset = byName.get(replacements[prop.name]);
    return asset ? place(asset, prop) : prop;
  });
  const zones = ['bread-forest','pond','library','plaza','race-lake','lighthouse-beach','islets'];
  const details = library.assets.filter(asset => ['food','nature','beach','street'].includes(asset.category)
    && !/^(tree-|fence-|sand-edge|bench-|lamp-|sign)/.test(asset.name));
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
