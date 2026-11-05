// boss 5 Nov: boats moored round the little jetty islets (like the bridge islet by the beach), 1 to 5 per islet, picked at
// random each load. Decorative and client only; Ashwin takes it from here. Each boat bobs and rocks on the sea side of its
// islet, nose out, with a cream ripple under it. The boat is the wooden sailboat the boss picked.
import {Assets, Container, Sprite, Texture} from 'pixi.js';


// boss 5 Nov: the picked design is the wooden sailboat off the boat sheet (concepts/boats, design 1), cut out to public/pixi-art
const BOAT = '/pixi-art/boat-sail.png', BOAT_W = 125;   // boss 5 Nov: a little bigger (was 96)
let boatTex = null;
const boatReady = Assets.load(BOAT).then(t => (boatTex = t)).catch(() => null);
function drawBoat() {
  const root = new Container({label: 'Moored boat'}), boat = new Sprite(Texture.EMPTY);
  boat.anchor.set(.5, .82);
  const fit = t => {boat.texture = t; boat.scale.set(BOAT_W / t.width);};
  if (boatTex) fit(boatTex); else boatReady.then(t => t && fit(t));
  root.addChild(boat);
  return {root, boat};
}

// islets: [[x, y, rx, ry], ...]; island: {x, y} centre, so boats sit on the islet's sea side, away from the jetty
export function createMooredBoats(layer, islets, island, {coast = null, openSea = 5, sea = {x0: 300, x1: 2900, y0: 300, y1: 1500}, avoid = []} = {}, seed = Math.floor(Math.random() * 1e9)) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const boats = [];
  // boss 5 Nov: plus 5 boats moored just off the north-west beach, close enough to the sand that a Ducky can step aboard;
  // each sits a short way out along the coast's outward normal, spaced along the shore
  const inside = (px, py) => {let c = false; for (let i = 0, j = coast.length - 1; i < coast.length; j = i++) {const [xi, yi] = coast[i], [xj, yj] = coast[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c;} return c;};
  const spots = coast ? coast.map((p, i) => [p, coast[(i + 1) % coast.length]]).filter(([p]) => p[0] > sea.x0 && p[0] < sea.x1 && p[1] > sea.y0 && p[1] < sea.y1) : [];
  for (let placed = 0, tries = 0; placed < openSea && spots.length && tries < 300; tries++) {
    const [p, q] = spots[Math.floor(rnd() * spots.length)], t = rnd(), len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    let nx = -(q[1] - p[1]) / len, ny = (q[0] - p[0]) / len;
    const mx = p[0] + (q[0] - p[0]) * t, my = p[1] + (q[1] - p[1]) * t;
    if (inside(mx + nx * 40, my + ny * 40)) {nx = -nx; ny = -ny;}
    const d = 95 + rnd() * 40, bx = mx + nx * d, by = my + ny * d;
    if (inside(bx, by) || boats.some(o => Math.hypot(o.x - bx, o.y - by) < 320) || avoid.some(a => Math.hypot(a.x - bx, a.y - by) < a.r)) continue;   // boss 5 Nov: avoid = the live harbor
    const b = drawBoat(); b.root.position.set(bx, by); b.root.scale.x = nx < 0 ? -1 : 1;
    layer.addChild(b.root); boats.push({...b, x: bx, y: by, phase: rnd() * 6.28}); placed++;
  }
  for (const [x, y, rx, ry] of islets) {
    const n = 1 + Math.floor(rnd() * 5), out = Math.atan2(y - island.y, x - island.x);
    for (let i = 0; i < n; i++) {
      const a = out + (i - (n - 1) / 2) * .78 + (rnd() - .5) * .12, k = 1.2 + (i % 2) * .22 + rnd() * .08;   // boss 5 Nov: spread round the islet, never stacked
      const b = drawBoat();
      const bx = x + Math.cos(a) * (rx * k + 70), by = y + Math.sin(a) * (ry * k + 55);
      if (boats.some(o => Math.hypot(o.x - bx, o.y - by) < 135)) continue;
      b.root.position.set(bx, by); b.root.scale.x = Math.cos(a) < 0 ? -1 : 1;
      layer.addChild(b.root);
      boats.push({...b, x: bx, y: by, phase: rnd() * 6.28});
    }
  }
  return {
    count: boats.length,
    update(t, reduced, visible) {
      for (const b of boats) {
        b.root.visible = visible(b.x, b.y, 120);
        if (!b.root.visible) continue;
        b.root.y = b.y + (reduced ? 0 : Math.sin(t * 1.4 + b.phase) * 2.5);
        b.boat.rotation = reduced ? 0 : Math.sin(t * 1.1 + b.phase) * .05;
      }
    },
  };
}
