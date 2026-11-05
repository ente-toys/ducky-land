// boss 5 Nov: catches a moved prop or sleeper without a regenerated walking map. Rebuilds the map exactly the way
// scripts/walk-world.mjs does (keep the two in step) and compares it with the committed rive/web/walk-world.json,
// which the socket server walks on. Fix a failure with:  node scripts/walk-world.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';

test('rive/web/walk-world.json matches a fresh build from the current placements and sleepers', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const vite = await createServer({root, server:{middlewareMode:true, hmr:false, watch:null}, appType:'custom', logLevel:'error'});
  try {
    const load = p => vite.ssrLoadModule(p);
    const world = (await load('/rive/web/world.json')).default;
    const {geometry} = await load('/rive/web/island-geometry.mjs');
    const P = await load('/src/pixi/placements.js'), {sleepHalfWidths} = await load('/src/pixi/sleeper.js'), {harborClear, harborWorld} = await load('/src/pixi/islands.js');
    const tw = P.trimWorld(world), props = P.createPlacements(tw, geometry({...tw, obstacles: []}).walkable).filter(harborClear), local = harborWorld(P.walkWorld(tw, props));
    const beds = P.sleepSpots(local, props, geometry(local).walkable, sleepHalfWidths(.88 * .24 * 3));
    const walk = {...local, obstacles: [...local.obstacles, ...beds.map(P.sleeperFootprint)]};
    const fresh = Object.fromEntries(['width', 'height', 'coast', 'obstacles', 'walkways', 'bridges', 'islets', 'water', 'boardwalk'].filter(k => k in walk).map(k => [k, walk[k]]));
    const saved = JSON.parse(readFileSync(new URL('../rive/web/walk-world.json', import.meta.url)));
    // through JSON, as the script writes it, so -0 and undefined compare the way the file stores them
    const built = JSON.parse(JSON.stringify(fresh));
    for (const key of Object.keys(built)) assert.deepEqual(saved[key], built[key], `walk-world.json "${key}" is stale: run node scripts/walk-world.mjs`);
    assert.deepEqual(Object.keys(saved).sort(), Object.keys(built).sort());
  } finally { await vite.close(); }
});
