import test, {before} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {geometry, inPoly, inShape, shapeIndex} from '../assets/world/island-geometry.mjs';
import {HOME_MAP} from '../src/world/island-maps.js';
import routes from '../src/world/home/home-routes.json' with {type: 'json'};
import expansion from '../src/world/home/home-expansion.json' with {type: 'json'};
import rawWorld from '../assets/world/world.json' with {type: 'json'};

let bushes, local, props;
before(async () => {
  const vite = await createServer({configFile: false, cacheDir: '/private/tmp/home-bushes-test', optimizeDeps: {noDiscovery: true},
    server: {middlewareMode: true, hmr: false, ws: false, watch: null}, logLevel: 'error'});
  try {
    const P = await vite.ssrLoadModule('/src/world/home/placements.js');
    props = P.createPlacements();
    // Inspect every actual rendered shrub, including the hamlets' shrub-round.
    bushes = props.filter(p => /bush|shrub/i.test([p.asset, p.name, p.src].join(' ')));
    local = P.walkWorld(P.trimWorld(rawWorld), props);
  } finally { await vite.close(); }
});

const segmentDistance = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const intersects = (a, b, c, d) => cross(a,b,c) * cross(a,b,d) <= 0 && cross(c,d,a) * cross(c,d,b) <= 0
  && Math.max(a[0],b[0]) >= Math.min(c[0],d[0]) && Math.max(c[0],d[0]) >= Math.min(a[0],b[0])
  && Math.max(a[1],b[1]) >= Math.min(c[1],d[1]) && Math.max(c[1],d[1]) >= Math.min(a[1],b[1]);
const bounds = p => {
  const w = p.width * p.scale, h = p.height * p.scale;
  return [p.x - w * p.anchor.x, p.y - h * p.anchor.y, p.x + w * (1 - p.anchor.x), p.y + h * (1 - p.anchor.y)];
};
const corners = ([x0,y0,x1,y1]) => [[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
const insideBox = ([x,y], [x0,y0,x1,y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
function boxSegmentDistance(box, a, b) {
  if ([a,b].some(p => insideBox(p, box))) return 0;
  const c = corners(box);
  return Math.min(...c.map((p,i) => {
    const q = c[(i+1)%4];
    return intersects(a,b,p,q) ? 0 : Math.min(segmentDistance(p,a,b),segmentDistance(a,p,q),segmentDistance(b,p,q));
  }));
}

test('all 215 Home bush bases are solid across their width in the client and room walking maps', () => {
  assert.equal(bushes.length, 215, 'no existing bush is dropped');
  const client = geometry(local).walkable, room = HOME_MAP.nav().walkable;
  const ground = geometry({...local, obstacles: []}).walkable;
  for (const p of bushes) {
    assert.ok(p.footprint, p.id + ' has its own ground footprint');
    assert.ok(ground(p.x,p.y), p.id + ' remains on dry ground');
    for (let ix = -4; ix <= 4; ix++) for (const dy of [0, -.1, -.2]) {
      const x = p.x + ix / 4 * .44 * p.width * p.scale, y = p.y + dy * p.height * p.scale;
      assert.equal(client(x,y), false, `${p.id} client base ${ix},${dy}`);
      assert.equal(room(x,y), false, `${p.id} room base ${ix},${dy}`);
    }
  }
});

test('no Home bush art overlaps a painted path or lane, including curved bends and lane ends', () => {
  for (const p of bushes) {
    const box = bounds(p);
    for (const r of routes) for (let i = 1; i < r.samples.length; i++) {
      const a = r.samples[i-1], b = r.samples[i], pad = r.width / 2;
      if (Math.min(a[0],b[0])-pad > box[2] || Math.max(a[0],b[0])+pad < box[0]
        || Math.min(a[1],b[1])-pad > box[3] || Math.max(a[1],b[1])+pad < box[1]) continue;
      assert.ok(boxSegmentDistance(box,a,b) > pad, `${p.id} overlaps ${r.id}`);
    }
  }
});

test('Home bush art clears all five painted hamlet courts and respects their grass holes', () => {
  const courts = expansion.roads.filter(r => r.rings);
  assert.equal(courts.length, 5);
  for (const p of bushes) for (const court of courts) {
    const box = bounds(p);
    for (const corner of corners(box)) assert.equal(inPoly(...corner,court.rings[0])
      && !court.rings.slice(1).some(r => inPoly(...corner,r)), false, `${p.id} sits on ${court.id}`);
    for (const ring of court.rings) for (let i = 0; i < ring.length; i++)
      assert.ok(boxSegmentDistance(box,ring[i],ring[(i+1)%ring.length]) > 0, `${p.id} crosses ${court.id}`);
  }
});

test('bush collisions preserve at least two walking widths across every Home lane', () => {
  // Shared geometry uses a 16-unit duck radius: two collision diameters = 64.
  const near = shapeIndex(bushes.map(p => p.footprint), 16), halfLane = 32;
  for (const r of routes) {
    assert.ok(r.width >= halfLane * 2, r.id + ' retains its full authored width');
    for (let i = 1; i < r.samples.length; i++) {
      const a = r.samples[i-1], b = r.samples[i], dx = b[0]-a[0], dy = b[1]-a[1], len = Math.hypot(dx,dy);
      if (!len) continue;
      for (const t of [0,.5,1]) for (const side of [-halfLane,0,halfLane]) {
        const x = a[0]+dx*t-dy/len*side, y = a[1]+dy*t+dx/len*side;
        assert.equal(near(x,y).some(o => inShape(x,y,o,16)), false, `${r.id} stays two ducks wide at ${x},${y}`);
      }
    }
  }
});
