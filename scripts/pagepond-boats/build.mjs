// Moorings are rendered by the same live/offline fleet and approved SVG views
// as Home, so these replacements can actually be boarded and sailed.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {paperboatMoorings, retiredBoatIds} from './config.mjs';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, data) => {
  const indent = fs.readFileSync(file, 'utf8').match(/\n([ \t]+)"/)?.[1];
  fs.writeFileSync(file, JSON.stringify(data, null, indent) + '\n');
};
const artFile = 'public/pixi-art/themes/library/art.json';
const art = read(artFile);
art.props = art.props.filter(p => !retiredBoatIds.has(p.id));
write(artFile, art);
const worldFile = 'assets/world/themes/library/world.json', world = read(worldFile);
world.props = art.props;
world.boatWater = JSON.parse(execFileSync(process.env.PAGEPOND_PYTHON ?? 'python3',
  ['scripts/pagepond-boats/water.py'], {encoding: 'utf8', maxBuffer: 50 * 1024 * 1024}));
write(worldFile, world);
const walkFile = 'assets/world/themes/library/walk-world.json', walk = read(walkFile);
walk.boatWater = world.boatWater;
write(walkFile, walk);
fs.writeFileSync('assets/world/themes/library/placements.json', JSON.stringify(art.props) + '\n');
const harborFile = 'assets/world/themes/library/harbor.json', harbor = read(harborFile);
for (const {x, y, turn} of paperboatMoorings) {
  if (!harbor.boats.some(b => b.x === x && b.y === y)) harbor.boats.push({x, y, turn});
}
write(harborFile, harbor);
console.log('Pagepond: three paperboat decorations replaced by approved playable Home boats.');
