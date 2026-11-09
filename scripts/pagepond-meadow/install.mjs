// Install only the boss-picked meadow pieces. Existing Pagepond entries stay intact.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = name => JSON.parse(fs.readFileSync(path.join(root, name)));
const write = (name, value) => fs.writeFileSync(path.join(root, name), JSON.stringify(value) + '\n');
const placement = read('scripts/pagepond-meadow/placements.json');
const source = process.argv[2];
const artPath = 'public/pixi-art/themes/library/art.json';
const assetBase = 'pagepond/meadow/';
if (source) {
  const dest = path.join(root, 'public/pixi-art/themes/library', assetBase);
  fs.mkdirSync(dest, {recursive: true});
  for (const name of Object.keys(placement.assetManifest)) fs.copyFileSync(path.join(source, name), path.join(dest, name));
}
const upsert = (list, items) => {
  const ids = new Set(items.map(p => p.id));
  return [...list.filter(p => !ids.has(p.id)), ...items];
};
const art = read(artPath);
const floors = placement.floorTiles.toSorted((a, b) => a.order - b.order).map(p => ({...p, src: assetBase + p.src, topLeft: true}));
const props = placement.props.map(p => ({...p, src: assetBase + p.src, ...(p.animation?.type === 'bob' ? {boat: true} : {})}));
art.flats = upsert(art.flats, floors);
art.props = upsert(art.props, props);
write(artPath, art);
for (const name of ['world.json', 'walk-world.json']) {
  const dest = 'rive/web/themes/library/' + name, world = read(dest);
  // The padded, overlapping treads have a narrow neck between 32-unit grid
  // centres. A 24-unit grid resolves the visible walking route without
  // widening its water collision or adding an invisible bridge.
  world.navigationCellSize = 24;
  world.water = upsert(world.water, placement.waterRegions);
  world.obstacles = upsert(world.obstacles, placement.solidFootprints);
  if (world.props) world.props = upsert(world.props, props);
  write(dest, world);
}
