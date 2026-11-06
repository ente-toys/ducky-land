// the merged walk-world.json, built exactly the way scripts/walk-world.mjs builds it (with the merge applied in memory)
import {createServer} from 'vite';
import {writeFileSync} from 'node:fs';
import {mergePlugin} from './merge.mjs';
const vite = await createServer({root: '/Users/pragadees.xd/Downloads/Ducky Land/aswin-ducky-land', configFile: false, plugins: [mergePlugin({walkWorld: false})], server: {middlewareMode: true, hmr: false, watch: null}, appType: 'custom', logLevel: 'error'});
try {
  const load = p => vite.ssrLoadModule(p);
  const world = (await load('/rive/web/world.json')).default;
  const {geometry} = await load('/rive/web/island-geometry.mjs');
  const P = await load('/src/pixi/placements.js'), {sleepHalfWidths} = await load('/src/pixi/sleeper.js'), {harborClear, harborWorld} = await load('/src/pixi/islands.js');
  const tw = P.trimWorld(world), props = P.createPlacements(tw, geometry({...tw, obstacles: []}).walkable).filter(harborClear), local = harborWorld(P.walkWorld(tw, props));
  const beds = P.sleepSpots(local, props, geometry(local).walkable, sleepHalfWidths(.88 * .24 * 3));
  const walk = {...local, obstacles: [...local.obstacles, ...beds.map(P.sleeperFootprint)]};
  const out = Object.fromEntries(['width', 'height', 'coast', 'obstacles', 'walkways', 'bridges', 'islets', 'water', 'boardwalk'].filter(k => k in walk).map(k => [k, walk[k]]));
  if (process.argv[2] !== '--dry') writeFileSync('rive/web/home-bigger/walk-world.json', JSON.stringify(out));
  const byPose = {}; for (const b of beds) byPose[b.pose] = (byPose[b.pose] ?? 0) + 1;
  console.log('beds', beds.length, JSON.stringify(byPose), 'dropped', JSON.stringify(beds.bad), 'props', props.length, 'obstacles', out.obstacles.length);
  writeFileSync('.home-grow/data.json', JSON.stringify({props: props.map(p => ({id: p.id, name: p.name, asset: p.asset, x: p.x, y: p.y, w: p.width * p.scale, h: p.height * p.scale})), base: beds.map(b => ({...b}))}));
} finally { await vite.close(); }
