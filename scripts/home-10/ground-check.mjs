// Ground lane helper: resolves Home's beds exactly the way the game does (scripts/walk-world.mjs) and prints the ones it drops.
import {createServer} from 'vite';
const vite = await createServer({configLoader:'native',cacheDir:'/private/tmp/ducky-ground-check-vite',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'error'});
try {
  const load = p => vite.ssrLoadModule(p);
  const world = (await load('/rive/web/world.json')).default;
  const {geometry} = await load('/rive/web/island-geometry.mjs');
  const P = await load('/src/pixi/placements.js'), {sleepHalfWidths} = await load('/src/pixi/sleeper.js'), {harborClear, harborWorld} = await load('/src/pixi/islands.js');
  const tw = P.trimWorld(world), props = P.createPlacements(tw, geometry({...tw, obstacles: []}).walkable).filter(harborClear), local = harborWorld(P.walkWorld(tw, props));
  const beds = P.sleepSpots(local, props, geometry(local).walkable, sleepHalfWidths(.88 * .24 * 3));
  console.log(JSON.stringify({beds: beds.length, dropped: beds.bad.map(({pose, x, y, reason}) => ({pose, x, y, reason}))}));
} finally { await vite.close(); }
