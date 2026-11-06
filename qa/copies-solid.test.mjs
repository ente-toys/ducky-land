// boss 6 Nov ("I am sailing on top of land"): what is DRAWN round you and what is SOLID must be the same islands at the same
// offsets. archipelago.js draws every other island centred at cx + wrap(dx), cy + dy (round the current island's centre); the
// sea (islands.js canSail, the room server's rule too) blocks every island inside the sea bounds. This walks every island
// drawn inside the sea round several current islands and asserts none of its walkable ground can be sailed on.
// Works on the single-map tree too (every island = the home map) and on the themed one (each island its own map).
import assert from 'node:assert/strict';
import test from 'node:test';
import {canSail, seaBoundsFor} from '../src/pixi/islands.js';
import {WORLD_ISLANDS, MAP_BOUNDS, worldIsland, neighboursOf} from '../src/pixi/world-map.js';
import {createNavigation} from '../src/pixi/navigation.js';
import world from '../rive/web/world.json' with {type: 'json'};
import walkWorld from '../rive/web/walk-world.json' with {type: 'json'};

let mapOf = null;
try {({mapOf} = await import('../src/pixi/island-maps.js'));} catch {/* single-map tree */}
const homeNav = createNavigation({...world, ...walkWorld});
const sizeAndNav = id => mapOf ? {width: mapOf(id).width, height: mapOf(id).height, nav: mapOf(id).nav()} : {width: world.width, height: world.height, nav: homeNav};
const SX = MAP_BOUNDS.x1 - MAP_BOUNDS.x0, wrap = v => v - SX * Math.round(v / SX);

function drawnCopies(current) {   // archipelago.js place(): the same maths, island by island
  const here = worldIsland(current), me = sizeAndNav(current), cx = me.width / 2, cy = me.height / 2;
  return WORLD_ISLANDS.filter(island => island.id !== current).map(island => {
    const m = sizeAndNav(island.id), x = cx + wrap(island.x - here.x), y = cy + island.y - here.y;
    return {id: island.id, ox: x - m.width / 2, oy: y - m.height / 2, ...m};   // the copy's map origin (renderLiveCopies)
  });
}

const CURRENT = ['home', ...neighboursOf('home').map(n => n.island.id), 'isle-93', 'isle-250'];
for (const current of [...new Set(CURRENT)]) test(`every island drawn round ${current} is solid where it has ground`, () => {
  const b = seaBoundsFor(current);
  let checked = 0;
  for (const copy of drawnCopies(current)) {
    if (copy.ox + copy.width < b.x0 || copy.ox > b.x1 || copy.oy + copy.height < b.y0 || copy.oy > b.y1) continue;   // outside the sea: never reachable
    for (let x = 100; x < copy.width; x += 200) for (let y = 100; y < copy.height; y += 200) {
      if (!copy.nav.walkable(x, y)) continue;
      checked++;
      assert.equal(canSail(copy.ox + x, copy.oy + y, current), false, `${copy.id} ground at its local ${x},${y} (${Math.round(copy.ox + x)},${Math.round(copy.oy + y)} round ${current}) is sailable`);
    }
  }
  assert.ok(checked > 1000, `checked ${checked} ground points`);
});
