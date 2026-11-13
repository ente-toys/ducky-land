import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createNavigation} from '../src/world/navigation.js';
import {DUCK_RADIUS, EASE_IN, EASE_OUT, RUN_SPEED, WALK_SPEED, separateActors, setWalkDestination, walkStep} from '../src/gameplay/player-motion.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const world = {...read('../assets/world/world.json'), ...read('../assets/world/walk-world.json')};
const nav = createNavigation(world);
const ZERO = {x:0, y:0}, DIRS = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]], TICKS = [1/60, .05];
const OPEN = (() => {
  for (let y = 200; y < world.height; y += 50) for (let x = 200; x < world.width; x += 50) {
    let ok = true;
    for (let r = 10; r <= 240 && ok; r += 10) for (let k = 0; k < 24 && ok; k++) ok = nav.walkable(x+Math.cos(k*Math.PI/12)*r, y+Math.sin(k*Math.PI/12)*r);
    if (ok) return [x, y];
  }
})();
const duck = (x, y) => ({x, y, previousX:x, previousY:y, turn:0, path:[], until:0, action:0, travel:0, emoteVersion:0});

function hold(x, y, input, seconds, dt) {
  const a = duck(x, y), steps = [];
  for (let t = 0; t < seconds; t += dt) {
    walkStep(a, nav, dt, t, input);
    assert.ok(nav.walkable(a.x, a.y), `off walkable ground at ${a.x},${a.y}`);
    assert.ok(nav.clearLine([a.previousX, a.previousY], [a.x, a.y]), 'a step crossed a blocked spot');
    steps.push([a.x-a.previousX, a.y-a.previousY]);
  }
  const moving = steps.filter(s => Math.hypot(...s) > .01);
  const flips = moving.slice(1).filter((s, i) => s[0]*moving[i][0]+s[1]*moving[i][1] < 0).length;
  return {a, distance:Math.hypot(a.x-x, a.y-y), flips};
}

function shallowHits(edges) {
  const out = [];
  for (const [a, b] of edges) {
    const length = Math.hypot(b[0]-a[0], b[1]-a[1]);
    if (length < 150) continue;
    const tx = (b[0]-a[0])/length, ty = (b[1]-a[1])/length, mid = [(a[0]+b[0])/2, (a[1]+b[1])/2];
    const start = [[mid[0]-ty*30, mid[1]+tx*30], [mid[0]+ty*30, mid[1]-tx*30]].find(p => nav.walkable(...p));
    if (!start || world.obstacles.some(o => !o.poly && Math.hypot(o.x-start[0], o.y-start[1]) < Math.max(o.rx, o.ry)+150)) continue;
    for (const d of DIRS) {
      const l = Math.hypot(...d), along = Math.abs(d[0]/l*tx + d[1]/l*ty);
      if (nav.walkable(start[0]+d[0]/l*60, start[1]+d[1]/l*60) || along < Math.cos(50*Math.PI/180) || along > Math.cos(10*Math.PI/180)) continue;
      out.push({start, input:{x:d[0], y:d[1]}});
    }
  }
  return out;
}

function glides(hits) {
  for (const dt of TICKS) {
    let gliding = 0;
    for (const {start, input} of hits) {
      const {distance, flips} = hold(...start, input, 1, dt);
      assert.equal(flips, 0, 'the duck jittered back and forth along the wall');
      if (distance > 100) gliding++;
    }
    assert.ok(gliding >= hits.length*.9, `only ${gliding} of ${hits.length} shallow hits glide at dt ${dt}`);
  }
}

test('keyboard walking glides along curved coast at shallow angles instead of stopping dead', () => {
  const hits = [0, 1, 2, 3].flatMap(offset => {
    const coast = world.coast.filter((_, i) => i%4 === offset);
    return shallowHits(coast.map((p, i) => [p, coast[(i+1)%coast.length]]));
  });
  assert.ok(hits.length >= 12, `${hits.length} coast scenarios`);
  glides(hits);
  assert.ok(hits.filter(h => !h.input.x || !h.input.y).length >= 4);
});

test('keyboard walking glides around pond and lake edges and stops on a square hit without creeping', () => {
  const pond = world.water.find(o => !o.poly), lake = world.water.find(o => o.poly);
  const rings = [Array.from({length:48}, (_, k) => {const a = k*Math.PI/24; return [pond.x+Math.cos(a)*(pond.rx+20), pond.y+Math.sin(a)*(pond.ry+20)];}), lake?.poly ?? []];
  const hits = shallowHits(rings.flatMap(ring => ring.map((p, i) => [p, ring[(i+4)%ring.length]]).filter((_, i) => i % 2 === 0)));
  assert.ok(hits.length >= 6, `${hits.length} lake scenarios`);
  glides(hits);
  const top = [pond.x, pond.y-pond.ry-45];
  for (const dt of TICKS) {
    const {distance, flips} = hold(...top, {x:0, y:1}, 1.5, dt);
    assert.ok(distance < 40 && flips === 0, `a square hit should stop, moved ${distance}`);
  }
});

test('walking into prop footprints from every direction never tunnels or leaves walkable ground', () => {
  const props = world.obstacles.filter(o => !o.poly && o.rx < 90 && o.ry < 90).slice(0, 25);
  assert.ok(props.length >= 10);
  for (const o of props) for (const d of DIRS) {
    const l = Math.hypot(...d), start = [o.x-d[0]/l*(Math.max(o.rx, o.ry)+60), o.y-d[1]/l*(Math.max(o.rx, o.ry)+60)];
    if (!nav.walkable(...start)) continue;
    for (const dt of TICKS) hold(...start, {x:d[0], y:d[1]}, 1.2, dt);
  }
});

test('speed eases in over 0.1 s and out over 0.12 s on the keyboard, and keeps action and travel honest', () => {
  const [x, y] = [OPEN[0]-200, OPEN[1]];
  for (const dt of TICKS) {
    const a = duck(x, y), travel = [];
    for (let t = 0; t < 1.2; t += dt) { walkStep(a, nav, dt, t, {x:1, y:0}); travel.push(a.travel); assert.equal(a.action, 1); }
    assert.ok(travel[0] < WALK_SPEED*.7 && travel[0] > 0, `first step ${travel[0]}`);
    travel.forEach((v, i) => assert.ok(!i || v >= travel[i-1]-1e-9, 'speed dipped while easing in'));
    assert.ok(Math.abs(travel[Math.ceil(EASE_IN/dt)+1]-WALK_SPEED) < 1e-6, 'full speed right after the ease-in');
    const released = [];
    for (let t = 1.2; t < 1.7; t += dt) { walkStep(a, nav, dt, t, ZERO); released.push([a.travel, a.action]); }
    assert.ok(released[0][0] > 0 && released[0][0] < WALK_SPEED && released[0][1] === 1, 'keeps sliding a moment after the key is let go');
    const stop = released.findIndex(([v]) => v === 0);
    assert.ok(stop > 0 && stop*dt <= EASE_OUT+dt+1e-9, `stopped after ${stop*dt}`);
    assert.ok(released.slice(stop).every(([v, action]) => v === 0 && action === 0));
  }
});

test('Shift runs at 1.7x with the same ease, never faster, eases back to a walk and never runs a route (boss 6 Nov)', () => {
  assert.ok(Math.abs(RUN_SPEED/WALK_SPEED-1.7) < 1e-9);
  const [x, y] = [OPEN[0]-200, OPEN[1]];
  for (const dt of TICKS) {
    const a = duck(x, y), travel = [];
    for (let t = 0; t < .6; t += dt) { walkStep(a, nav, dt, t, {x:1, y:0, run:true}); travel.push(a.travel); }
    assert.ok(travel[0] < RUN_SPEED*.7, 'eased in');
    assert.ok(Math.abs(travel[Math.ceil(EASE_IN/dt)+1]-RUN_SPEED) < 1e-6, 'full run right after the same 0.1 s ease-in');
    assert.ok(travel.every(v => v <= RUN_SPEED+1e-6), 'never above the run speed');
    const walk = [];
    for (let t = .6; t < 1; t += dt) { walkStep(a, nav, dt, t, {x:1, y:0}); walk.push(a.travel); }
    assert.ok(walk[0] < RUN_SPEED && walk[0] > WALK_SPEED, 'let go of Shift: slows down, no snap');
    assert.ok(Math.abs(walk.at(-1)-WALK_SPEED) < 1e-6, 'back to a walk');
    const b = duck(x, y);
    for (let t = 0; t < .5; t += dt) walkStep(b, nav, dt, t, {x:1, y:0, run:'yes'});
    assert.ok(b.travel <= WALK_SPEED+1e-6, 'only a real true runs');
    const c = duck(x, y);
    setWalkDestination(c, nav, x+400, y);
    for (let t = 0; t < .5; t += dt) {walkStep(c, nav, dt, t, {x:0, y:0, run:true}); assert.ok(c.travel <= WALK_SPEED+1e-6, 'a route never runs');}
  }
});

test('click-to-move eases in and brakes into the exact target without overshooting any path point', () => {
  const [x, y] = world.zones.plaza.spawn;
  for (const dt of TICKS) for (const [tx, ty] of [[OPEN[0]+200, OPEN[1]], [world.zones.library.spawn[0], world.zones.library.spawn[1]], [world.zones.pond.spawn[0], world.zones.pond.spawn[1]]]) {
    const a = duck(x, y), end = setWalkDestination(a, nav, tx, ty), points = a.path.slice();
    assert.ok(end, 'route found');
    const travel = [];
    let t = 0;
    while (a.path.length && t < 30) {
      const left = a.path.length;
      walkStep(a, nav, dt, t += dt, ZERO);
      travel.push(a.travel);
      assert.ok(nav.walkable(a.x, a.y));
      assert.equal(a.action, a.travel > .001 ? 1 : 0);
      const on = points.some((p, i) => {const q = i ? points[i-1] : [x, y], dx = p[0]-q[0], dy = p[1]-q[1], k = Math.max(0, Math.min(1, ((a.x-q[0])*dx+(a.y-q[1])*dy)/(dx*dx+dy*dy||1))); return Math.hypot(a.x-q[0]-dx*k, a.y-q[1]-dy*k) < 1e-6;});
      assert.ok(on, 'left the route');
      assert.ok(a.path.length <= left);
    }
    assert.deepEqual([a.x, a.y], end, 'arrived exactly');
    assert.ok(travel[0] < WALK_SPEED*.7, 'eased in');
    assert.ok(travel.at(-1) < WALK_SPEED*.6, `braked into the target, last ${travel.at(-1)}`);
    walkStep(a, nav, dt, t += dt, ZERO);
    assert.equal(a.action, 0);
    assert.equal(a.travel, 0);
    assert.equal(a.pace, 0);
  }
});

test('a click far out at sea (or mid-pond) walks to the nearest shore toward the click, cheaply', () => {
  const [x, y] = world.zones.plaza.spawn;
  const ponds = world.water.flatMap(o => [[0, 0], [0, -.3], [.3, 0]].map(([u, v]) => [o.x+u*o.rx, o.y+v*o.ry])).filter(p => !nav.nearest(...p));
  assert.ok(ponds.length, 'a lake has a middle more than 150 px from its banks');
  for (const [tx, ty] of [[world.origin.x-500,2400], [world.origin.x-500,world.origin.y-500], [2900,world.origin.y+world.height+500], [world.origin.x+world.width+500,1680], ...ponds]) {
    assert.equal(nav.nearest(tx, ty), null, `${tx},${ty} is more than 150 px out`);
    const path = nav.route(x, y, tx, ty);
    assert.ok(path.length, `walks toward ${tx},${ty}`);
    const end = path.at(-1);
    const time = f => Math.min(...[0, 1, 2].map(() => {const t = performance.now(); f(); return performance.now()-t;}));
    if (tx === world.origin.x-500 || tx === ponds[0][0]) {
      const extra = time(() => nav.route(x, y, tx, ty)) - time(() => nav.route(x, y, ...end));
      assert.ok(extra < 30, `the shore search costs ${extra.toFixed(1)} ms`);
    }
    assert.ok(nav.walkable(...end));
    assert.ok(Math.hypot(end[0]-tx, end[1]-ty) < Math.hypot(x-tx, y-ty), 'ends closer to the click');
    const l = Math.hypot(tx-end[0], ty-end[1]);
    assert.ok(!nav.walkable(end[0]+(tx-end[0])/l*30, end[1]+(ty-end[1])/l*30), 'stops at the water line');
    const a = duck(x, y);
    setWalkDestination(a, nav, tx, ty);
    for (let t = 0; a.path.length && t < 40; t += .05) walkStep(a, nav, .05, t, ZERO);
    assert.deepEqual([a.x, a.y], end);
  }
});

test('multi-point routes have rounded corners that stay walkable', () => {
  const zones = Object.values(world.zones).map(z => z.spawn);
  let corners = 0, soft = 0;
  for (const from of zones.slice(0, 2)) for (const to of zones) {
    if (from === to) continue;
    const path = nav.route(...from, ...to);
    if (!path.length) continue;
    const pts = [from, ...path];
    pts.slice(1).forEach((p, i) => assert.ok(nav.clearLine(pts[i], p), 'route segment blocked'));
    for (let i = 1; i < pts.length-1; i++) {
      const a = Math.atan2(pts[i][1]-pts[i-1][1], pts[i][0]-pts[i-1][0]), b = Math.atan2(pts[i+1][1]-pts[i][1], pts[i+1][0]-pts[i][0]);
      const turn = Math.abs(Math.atan2(Math.sin(b-a), Math.cos(b-a)));
      corners++;
      if (turn < Math.PI/6) soft++;
    }
  }
  assert.ok(corners > 10);
  assert.ok(soft/corners > .75, `${soft} of ${corners} corners turn under 30 degrees`);
});

test('two ducks walking at each other pass with gentle spacing, and stacked ducks ease apart', () => {
  const [x, y] = OPEN;
  for (const dt of TICKS) {
    const a = duck(x-150, y), b = duck(x+150, y);
    setWalkDestination(a, nav, x+150, y);
    setWalkDestination(b, nav, x-150, y);
    let closest = Infinity;
    for (let t = 0; t < 4; t += dt) {
      walkStep(a, nav, dt, t, ZERO); walkStep(b, nav, dt, t, ZERO);
      separateActors([a, b], nav, dt);
      closest = Math.min(closest, Math.hypot(a.x-b.x, a.y-b.y));
      assert.ok(nav.walkable(a.x, a.y) && nav.walkable(b.x, b.y));
    }
    assert.ok(closest > DUCK_RADIUS, `came within ${closest} px`);
    assert.ok(Math.hypot(a.x-x-150, a.y-y) < 60 && Math.hypot(b.x-x+150, b.y-y) < 60, 'both got past each other');
  }
  const stack = [duck(x, y), duck(x, y), duck(x+5, y+3)], sleeper = {...duck(x+20, y), sleeping:true};
  for (let t = 0; t < 2; t += .05) { stack.forEach(d => walkStep(d, nav, .05, t, ZERO)); separateActors([...stack, sleeper], nav, .05); }
  for (let i = 0; i < stack.length; i++) for (const other of [...stack.slice(i+1), sleeper]) assert.ok(Math.hypot(stack[i].x-other.x, stack[i].y-other.y) > DUCK_RADIUS*2-1);
  assert.deepEqual([sleeper.x, sleeper.y], [x+20, y], 'sleepers never get pushed');
  assert.ok(stack.every(d => nav.walkable(d.x, d.y)));
});

test('a duck pressed against the shore is never pushed into the sea', () => {
  const coast = world.coast.filter((_,i)=>i%4===0), edges = coast.map((p, i) => [p, coast[(i+1)%coast.length]]).filter(([p, q]) => Math.hypot(q[0]-p[0], q[1]-p[1]) > 150);
  let checked = 0;
  for (const [p, q] of edges) {
    const l = Math.hypot(q[0]-p[0], q[1]-p[1]), nx = -(q[1]-p[1])/l, ny = (q[0]-p[0])/l, mid = [(p[0]+q[0])/2, (p[1]+q[1])/2];
    const sign = [1, -1].find(s => nav.walkable(mid[0]+nx*s*30, mid[1]+ny*s*30) && !nav.walkable(mid[0]-nx*s*60, mid[1]-ny*s*60));
    if (!sign) continue;
    let edge = 30; while (edge > 1 && nav.walkable(mid[0]+nx*sign*(edge-1), mid[1]+ny*sign*(edge-1))) edge--;
    const shore = duck(mid[0]+nx*sign*edge, mid[1]+ny*sign*edge), pusher = duck(shore.x+nx*sign*10, shore.y+ny*sign*10);
    if (!nav.walkable(pusher.x, pusher.y)) continue;
    for (let t = 0; t < 1; t += .05) separateActors([pusher, shore], nav, .05);
    assert.ok(nav.walkable(shore.x, shore.y) && nav.walkable(pusher.x, pusher.y));
    checked++;
  }
  assert.ok(checked >= 10);
});
