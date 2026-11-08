// boss 5 Nov: one walking map for everyone. Builds rive/web/walk-world.json from exactly what the game walks on offline
// (restyled coast, moved props' footprints, lake shapes, museum, sleepers), so the socket server blocks the same places.
// Run after any change to placements or sleepers:  node scripts/walk-world.mjs
import {createServer} from 'vite';
import {writeFileSync} from 'node:fs';
const vite = await createServer({configLoader:'native',cacheDir:'/private/tmp/ducky-bigger-walk-vite',optimizeDeps:{noDiscovery:true},server: {middlewareMode: true}, appType: 'custom', logLevel: 'error'});
try {
  const load = p => vite.ssrLoadModule(p);
  const world = (await load('/rive/web/world.json')).default;
  const {geometry} = await load('/rive/web/island-geometry.mjs');
  const P = await load('/src/pixi/placements.js'), {sleepHalfWidths} = await load('/src/pixi/sleeper.js'), {harborClear, harborWorld} = await load('/src/pixi/islands.js');
  // boss 5 Nov: the server is the live game, so it walks the live harbor: the jetty deck, and the lawn at its foot cleared
  const tw = P.trimWorld(world), props = P.createPlacements(tw, geometry({...tw, obstacles: []}).walkable).filter(harborClear), local = harborWorld(P.walkWorld(tw, props));
  const beds = P.sleepSpots(local, props, geometry(local).walkable, sleepHalfWidths(.88 * .24 * 3));
  const walk = {...local, obstacles: [...local.obstacles, ...beds.map(P.sleeperFootprint)]};
  const out = Object.fromEntries(['width', 'height', 'origin', 'coast', 'obstacles', 'walkways', 'bridges', 'islets', 'water', 'boardwalk'].filter(k => k in walk).map(k => [k, walk[k]]));
  writeFileSync('rive/web/walk-world.json', JSON.stringify(out));
  console.log('walk-world.json', out.obstacles.length, 'obstacles', out.coast.length, 'coast points');
} finally { await vite.close(); }
