// boss 8 Nov: "we can allow them to go in boat, for that you have to open up this". Home's rivers that reach the sea open
// through a mouth, a boat sails in from the harbour, under the arched bridges and back, and never leaves the water.
import test from 'node:test';
import assert from 'node:assert/strict';
import E from '../src/pixi/home-expansion.json' with {type: 'json'};
import {HOME_MAP} from '../src/pixi/island-maps.js';
import {canSail, harborOf, setSailDestination, sailStep} from '../src/pixi/islands.js';
import {inPoly} from '../assets/world/island-geometry.mjs';

const clover = E.riverWater.find(w => w.id === 'clover-run').poly, canal = E.riverWater.find(w => w.id === 'old-shore-canal').poly;
function sail(actor, to) {
  assert.ok(setSailDestination(actor, to.x, to.y), `a route to ${to.x},${to.y}`);
  const seen = [];
  for (let i = 0; i < 20000 && (actor.sailTarget || actor.sailRoute?.length); i++) {
    sailStep(actor, 1 / 20, {x: 0, y: 0});
    assert.ok(canSail(actor.x, actor.y, 'home'), `the boat stays on water at ${Math.round(actor.x)},${Math.round(actor.y)}`);
    seen.push({x: actor.x, y: actor.y});
  }
  assert.ok(Math.hypot(actor.x - to.x, actor.y - to.y) < 2, `arrived at ${to.x},${to.y} (at ${Math.round(actor.x)},${Math.round(actor.y)})`);
  return seen;
}

test('a boat sails from Home\'s harbour up Clover Run and the canal, under the arched bridges, and back', () => {
  const harbour = harborOf('home').water, actor = {islandId: 'home', mode: 'sailing', ...harbour, turn: 0};
  const upriver = {x: 2300, y: 3600};   // the old shore canal, past the fork and three bridges
  assert.ok(inPoly(upriver.x, upriver.y, canal) && HOME_MAP.landAt(3200, 4500) && !HOME_MAP.landAt(upriver.x, upriver.y));
  const out = sail(actor, upriver);
  assert.ok(out.some(p => p.y > 5560 && p.y < 5700 && p.x > 2950 && p.x < 3180), 'out through Clover Run\'s mouth');
  assert.ok(out.some(p => inPoly(p.x, p.y, clover) && p.y < 5000), 'up Clover Run');
  for (const id of ['river-crossing-1', 'river-crossing-2']) {   // under each bridge on the way
    const {a, b} = E.arches.find(r => Math.hypot((r.a[0] + r.b[0]) / 2 - E.riverBridges.find(v => v.id === id).x, (r.a[1] + r.b[1]) / 2 - E.riverBridges.find(v => v.id === id).y) < 1);
    const seg = p => {const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / (dx * dx + dy * dy))); return Math.hypot(p.x - a[0] - t * dx, p.y - a[1] - t * dy);};
    assert.ok(out.some(p => seg(p) < 30), `under ${id}`);
  }
  sail(actor, harbour);
});

test('Home\'s rivers stay closed to walkers, and Millrill opens to boats', () => {
  const n = HOME_MAP.nav();
  for (const [x, y] of [[3094, 5300], [3500, 3540], [1622, 3483]]) assert.equal(n.walkable(x, y), false, `${x},${y} is water`);
  for (const [x, y] of [[5470, 1420], [6150, 1880]]) assert.equal(canSail(x, y, 'home'), true, `${x},${y} joins the new eastern mouth`);
});

// Boss item 12: physically sail all the way into the pond/river network and back.
test('a harbour boat reaches Lily Pond, the race lake and Millrill Pond', () => {
 const harbour=harborOf('home').water;
 for(const to of [{x:1640,y:2630},{x:4130,y:1537},{x:6150,y:1900}]) {
  const actor={islandId:'home',mode:'sailing',...harbour,turn:0};
  sail(actor,to);sail(actor,harbour);
 }
});
