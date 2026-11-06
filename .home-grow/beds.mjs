// resolve home's sleep spots on the GROWN coast, the way scripts/walk-world.mjs will after the merge
import {createServer} from 'vite';
import {readFileSync, writeFileSync} from 'node:fs';
const vite = await createServer({server: {middlewareMode: true, hmr: false, watch: null}, appType: 'custom', logLevel: 'error'});
try {
  const load = p => vite.ssrLoadModule(p);
  const world = (await load('/rive/web/world.json')).default;
  const {geometry} = await load('/rive/web/island-geometry.mjs');
  const P = await load('/src/pixi/placements.js'), {sleepHalfWidths} = await load('/src/pixi/sleeper.js'), {harborClear, harborWorld} = await load('/src/pixi/islands.js');
  const S = await load('/src/pixi/sleep-spots.js');
  const grown = JSON.parse(readFileSync('rive/web/home-bigger/walk-shapes.json', 'utf8'));
  const extra = JSON.parse(readFileSync(process.argv[2] ?? 'rive/web/home-sleep-extra.json', 'utf8'));
  const tw = P.trimWorld(world), props = P.createPlacements(tw, geometry({...tw, obstacles: []}).walkable).filter(harborClear);
  const local = harborWorld({...P.walkWorld(tw, props), coast: grown.coast});
  const spots = Object.fromEntries(Object.entries(S.SLEEP_SPOTS).map(([k, v]) => [k, [...v, ...(extra[k] ?? [])]]));
  const sizes = sleepHalfWidths(.88 * .24 * 3), walk = geometry(local).walkable;
  const steps = (x, y) => x > 2780 && x < 3060 && y > 1340 && y < 1660;
  const beds = P.sleepSpots(local, props, walk, sizes);   // the merged code path is checked below with all spots
  const all = S.resolveSleepSpots(local, props, walk, sizes, {spots, home: true, steps, warn: false,
    pathDist: undefined, avoid: [{x: 2820, y: 2390, rx: 0, ry: 0}]});
  writeFileSync('.home-grow/data.json', JSON.stringify({props: props.map(p => ({id: p.id, name: p.name, asset: p.asset, x: p.x, y: p.y, w: p.width * p.scale, h: p.height * p.scale})), sizes, base: beds.map(b => ({...b})), baseBad: beds.bad}));
  console.log('sizes', sizes, 'base beds', beds.length, 'bad', beds.bad);
} finally { await vite.close(); }
