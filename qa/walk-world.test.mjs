import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'vite';
import {HOME_SLEEP_TOTAL} from '../src/world/home/sleep-spots.js';

test('assets/world/walk-world.json matches a fresh build from the current placements and sleepers', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const vite = await createServer({root, configLoader:'native', cacheDir:join(tmpdir(),'ducky-live-vite-qa'), server:{middlewareMode:true, hmr:false, ws:false, watch:null}, appType:'custom', logLevel:'error'});
  try {
    const load = p => vite.ssrLoadModule(p);
    const world = (await load('/assets/world/world.json')).default;
    const {geometry} = await load('/assets/world/island-geometry.mjs');
    const P = await load('/src/world/home/placements.js'), {sleepHalfWidths} = await load('/src/rendering/pixi/environment/sleeper.js'), {harborClear} = await load('/src/gameplay/islands.js');
    const tw = P.trimWorld(world), props = P.createPlacements(tw, geometry({...tw, obstacles: []}).walkable).filter(harborClear), local = P.walkWorld(tw, props);
    const beds = P.sleepSpots(local, props, geometry(local).walkable, sleepHalfWidths(.88 * .24 * 3));
    assert.equal(beds.length, HOME_SLEEP_TOTAL, 'Home resolves all 100 residents');
    assert.equal(beds.bad.length, 0, 'no Home bed is silently dropped');
    const {createSimulation} = await load('/src/gameplay/simulation.js');
    const residents = createSimulation(local, 8612, {sleepingNpcs:true,npcCount:beds.length});
    assert.equal(residents.ducks.filter(d=>d.sleeping).length,HOME_SLEEP_TOTAL, 'Home allocates 100 actual NPCs');
    const walk = {...local, obstacles: [...local.obstacles, ...beds.map(P.sleeperFootprint)]};
    const fresh = Object.fromEntries(['width', 'height', 'origin', 'coast', 'obstacles', 'walkways', 'bridges', 'islets', 'water', 'boardwalk'].filter(k => k in walk).map(k => [k, walk[k]]));
    const saved = JSON.parse(readFileSync(new URL('../assets/world/walk-world.json', import.meta.url)));
    const built = JSON.parse(JSON.stringify(fresh));
    for (const key of Object.keys(built)) assert.deepEqual(saved[key], built[key], `walk-world.json "${key}" is stale`);
    assert.deepEqual(Object.keys(saved).sort(), Object.keys(built).sort());
  } finally { await vite.close(); }
});
