import {mapPoint} from '../src/pixi/sphere-coordinates.js';
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
const sizeAndNav = id => mapOf ? {width: mapOf(id).width, height: mapOf(id).height, cx:mapOf(id).cx, cy:mapOf(id).cy, origin:mapOf(id).origin, nav: mapOf(id).nav()} : {width: world.width, height: world.height, nav: homeNav};
const SX = MAP_BOUNDS.x1 - MAP_BOUNDS.x0, wrap = v => v - SX * Math.round(v / SX);

function drawnCopies(current) {   // archipelago.js place(): the same maths, island by island
  const here = worldIsland(current), me = sizeAndNav(current), cx = me.cx, cy = me.cy;
  return WORLD_ISLANDS.filter(island => island.id !== current).map(island => {
    const m = sizeAndNav(island.id),p=mapPoint(island.id,current,{x:m.cx,y:m.cy}),x=p.x,y=p.y;
    return {id: island.id, ox: x - m.cx, oy: y - m.cy, ...m};   // the copy's map origin (renderLiveCopies)
  });
}

const CURRENT = ['home', ...neighboursOf('home').map(n => n.island.id), 'isle-93', 'isle-250'];
for (const current of [...new Set(CURRENT)]) test(`every island drawn round ${current} is solid where it has ground`, () => {
  const b = seaBoundsFor(current);
  let checked = 0;
  for (const copy of drawnCopies(current)) {
    if (copy.ox + copy.width < b.x0 || copy.ox > b.x1 || copy.oy + copy.height < b.y0 || copy.oy > b.y1) continue;   // outside the sea: never reachable
    for (let x = copy.origin.x+100; x < copy.origin.x+copy.width; x += 200) for (let y = copy.origin.y+100; y < copy.origin.y+copy.height; y += 200) {
      if (!copy.nav.walkable(x, y)) continue;
      // Raised Canal decks intentionally carry walkers above sailable water.
      // Ground beside and beyond those explicit crossings must still block boats.
      const own=mapOf?.(copy.id),raised=[...(own?.world.walkways??[]),...(own?.walk?.walkways??[])].some(w=>{if(!w.boatPassUnder)return false;const dx=w.b[0]-w.a[0],dy=w.b[1]-w.a[1],t=Math.max(0,Math.min(1,((x-w.a[0])*dx+(y-w.a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-w.a[0]-t*dx,y-w.a[1]-t*dy)<w.w/2;});
      // boss 8 Nov (sailable rivers): home's bridges (the walk map's bridge cut-outs over water) carry walkers over boats too
      const overBridge=(own?.home?own.walk.bridges??[]:[]).some(b=>((x-b.x)/(b.w/2))**2+((y-b.y)/(b.h/2))**2<1);
      if(raised||overBridge)continue;
      checked++;
      const at=mapPoint(copy.id,current,{x,y});
      assert.equal(canSail(at.x,at.y,current), false, `${copy.id} ground at its local ${x},${y} (${Math.round(copy.ox + x)},${Math.round(copy.oy + y)} round ${current}) is sailable`);
    }
  }
  assert.ok(checked > 1000, `checked ${checked} ground points`);
});
