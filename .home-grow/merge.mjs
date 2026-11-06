// The merge, applied in memory (src/ is not edited): a vite plugin that serves the merged files.
import {readFileSync, existsSync} from 'node:fs';
const ROOT = '/Users/pragadees.xd/Downloads/Ducky Land/aswin-ducky-land/';
const must = (s, a, b) => {if (!s.includes(a)) throw new Error('merge anchor missing: ' + a.slice(0, 60)); return s.replace(a, b);};
export const patches = {
  'src/pixi/placements.js': s => {
    s = must(s, "import {SLEEP_SPOTS, resolveSleepSpots, sleeperFootprint} from './sleep-spots.js';",
      "import {SLEEP_SPOTS, resolveSleepSpots, sleeperFootprint} from './sleep-spots.js';\nimport homeGrown from '../../rive/web/home-extra-props.json';   // boss 6 Nov: plants on the land added round home\nimport homeSleepExtra from '../../rive/web/home-sleep-extra.json';   // boss 6 Nov: 12 more sleepers there (40 in all)");
    s = must(s, '  return consolidate(applyLayout(props).map(sized), world, walkable);', '  return [...consolidate(applyLayout(props).map(sized), world, walkable), ...homeGrown.props.map(p => ({...p, anchor: {...p.anchor}}))];');
    s = must(s, 'resolveSleepSpots(world, props, walkable, sizes, {spots: SLEEP_SPOTS,', 'resolveSleepSpots(world, props, walkable, sizes, {spots: Object.fromEntries(Object.entries(SLEEP_SPOTS).map(([pose, list]) => [pose, [...list, ...(homeSleepExtra[pose] ?? [])]])),');
    return s;
  },
  'src/pixi/engine.js': s => must(s, '      const decals = decalsFor(world, props, geometry({...world, obstacles: []}).walkable);',
    '      const oldLand = geometry({...world, obstacles: []}).walkable, grownLand = {...world, coast: local.coast};\n      const decals = [...decalsFor(world, props, oldLand), ...decalsFor(grownLand, props, geometry({...grownLand, obstacles: []}).walkable).filter(d => !oldLand(d.x, d.y))];   // boss 6 Nov: tufts on the added land too'),
  'src/pixi/simulation.js': s => must(s, "for(let i=0;i<29;i++){const zone=i===0?'plaza':zones[Math.floor((i-1)/4)]", "for(let i=0;i<41;i++){const zone=i===0?'plaza':zones[Math.floor((i-1)/4)%zones.length]"),
};
export const swaps = {
  'src/pixi/walk-shapes.json': 'rive/web/home-bigger/walk-shapes.json',
  'src/pixi/shore-lines.json': 'rive/web/home-bigger/shore-lines.json',
  'rive/web/walk-world.json': 'rive/web/home-bigger/walk-world.json',
};
export function mergePlugin({walkWorld = true} = {}) {
  return {name: 'home-bigger-merge', enforce: 'pre', load(id) {
    const file = id.split('?')[0];
    if (!file.startsWith(ROOT)) return null;
    const rel = file.slice(ROOT.length);
    if (swaps[rel] && (walkWorld || rel !== 'rive/web/walk-world.json') && existsSync(ROOT + swaps[rel])) return readFileSync(ROOT + swaps[rel], 'utf8');
    if (patches[rel]) return patches[rel](readFileSync(file, 'utf8'));
    return null;
  }};
}
