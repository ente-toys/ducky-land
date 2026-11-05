// boss 5 Nov: the sea between islands. A layered cloud bank thickens as you sail out, then parts round a destination so the
// island shows through the gap; the islands are drawn like the jetty islets (shallows, surf, sand rim, grass, real plants) and
// each one's name sign pops up once as it comes out of the clouds, then stands on its dock.
import {Assets, Container, Graphics, Sprite} from 'pixi.js';
import {PALETTE} from './palette.js';
import {sampleRing} from './shore.js';
import lines from './shore-lines.json' with {type: 'json'};
import world from '../../rive/web/world.json' with {type: 'json'};
import {ISLAND_SCALE, SEA_ISLANDS} from './islands.js';

const hash = i => {const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s);};
const smooth = (a, b, x) => {const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t);};
const hex = c => '#' + c.toString(16).padStart(6, '0');
const inRing = (x, y, p) => {let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c;};
const svgTexture = (svg, resolution = 1) => Assets.load({src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), data: {resolution}});
// Recolour a piece of the house art (same drawing, new leaves) and size its raster, so a pink tree is still the GPT tree.
async function recoloured(src, swaps, width, height, resolution) {
  let svg = await (await fetch(src)).text();
  for (const [from, to] of swaps) svg = svg.replaceAll(from, to).replaceAll(from.toLowerCase(), to);
  if (width) svg = svg.replace(/<svg\b([^>]*?)(\swidth="[^"]*")?(\sheight="[^"]*")?>/, (m, a) => `<svg${a.replace(/\s(width|height)="[^"]*"/g, '')} width="${width}" height="${height}">`);
  return svgTexture(svg, resolution);
}

// ---------- clouds ----------
// Flat cozy cumulus: ink rim, cream body, a sea-blue shade along the flat underside, one highlight. Baked once to textures.
function cloudSvg(seed) {
  const W = 560, H = 280, base = 214, bumps = [];
  let x = 78;
  for (let i = 0; x < W - 90; i++) {const r = 46 + hash(seed * 7 + i) * 58 * (1 - Math.abs(x - W / 2) / W); bumps.push([x, base - 18 - r * (.55 + hash(seed * 3 + i) * .35), r]); x += r * (.9 + hash(seed + i * 5) * .35);}
  const shape = bumps.map(([cx, cy, r]) => `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}"/>`).join('') + `<rect x="44" y="${base - 66}" width="${W - 88}" height="66" rx="33"/>`;
  const top = bumps.reduce((a, b) => (b[2] > a[2] ? b : a));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><clipPath id="c">${shape}</clipPath></defs>
<g fill="${hex(PALETTE.ink)}" stroke="${hex(PALETTE.ink)}" stroke-width="9" stroke-linejoin="round" opacity=".55">${shape}</g>
<g fill="#FFFBF1">${shape}</g>
<g clip-path="url(#c)"><ellipse cx="${W / 2}" cy="${base + 40}" rx="${W * .52}" ry="74" fill="#D9EEF2"/><ellipse cx="${W / 2}" cy="${base + 52}" rx="${W * .48}" ry="58" fill="#C4E4EB"/>
<ellipse cx="${(top[0] - top[2] * .3).toFixed(1)}" cy="${(top[1] - top[2] * .42).toFixed(1)}" rx="${(top[2] * .42).toFixed(1)}" ry="${(top[2] * .22).toFixed(1)}" fill="#FFFFFF"/></g>
</svg>`;
}
const BLUR = (w, h, fill) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${h / 7}"/></filter></defs><ellipse cx="${w / 2}" cy="${h / 2}" rx="${w * .3}" ry="${h * .26}" fill="${fill}" filter="url(#b)"/></svg>`;

// The bank: three depths over the open sea north of home (low and slow, mid, high and fast), on a jittered grid so it never
// reads as rows, plus a cap of clouds over each sea island that only parts as you come close. Density rises with distance
// from the home coast, so the bank thickens as you sail out. Each depth is a parallax plane around the camera.
const FIELD = {x0: -4000, x1: 9800, y0: -4400, y1: 320};   // past SEA_BOUNDS plus a zoomed-out view, so the drift wrap is never on screen
// low clouds sit in the sea haze (a blue-grey tint), high ones are whiter, bigger, faster and a touch see-through
const DEPTHS = [{f: 1, cell: [660, 440], alpha: 1, size: 1, drift: 7, shadow: .05, tint: 0xEAF4F5}, {f: 1.1, cell: [900, 580], alpha: 1, size: 1.3, drift: 10, shadow: .035, tint: 0xF5FAF9},
  {f: 1.22, cell: [1260, 800], alpha: .9, size: 1.7, drift: 14, shadow: 0, tint: 0xFFFFFF}];
const CAP = [[0, -40, 1.5], [-330, -120, 1.25], [320, -110, 1.3], [-210, 130, 1.2], [230, 150, 1.25], [10, -300, 1.35], [-430, 90, 1.05], [450, 70, 1.1], [20, 230, 1.15]];

async function createClouds(water, air) {
  const kinds = await Promise.all([1, 2, 3, 4, 5, 6].map(seed => svgTexture(cloudSvg(seed), 1)));
  const shadows = new Container({label: 'Cloud shadows'}), sky = new Container({label: 'Cloud bank'});
  sky.upright = true;   // drawn as seen, not stood up again by the engine's tilt pass
  water.addChild(shadows); air.addChild(sky);
  const clouds = [];
  const add = (depth, d, x, y, scale, cap) => {
    const sprite = new Sprite(kinds[Math.floor(hash(x * .37 + y * .11) * kinds.length)]);
    const flip = hash(x + y) > .5 ? 1 : -1;
    sprite.anchor.set(.5, .76); sprite.tint = depth.tint; sky.addChild(sprite);
    let shade = null;   // the cloud's own silhouette, inked flat on the water
    if (depth.shadow) {shade = new Sprite(sprite.texture); shade.anchor.set(.5, .76); shade.tint = PALETTE.ink; shadows.addChild(shade);}
    clouds.push({sprite, shade, flip, depth: d, f: depth.f, x, y, scale, cap, phase: hash(x * 3.1 + y) * 6.28, alpha: depth.alpha});
  };
  DEPTHS.forEach((depth, d) => {
    const [cw, ch] = depth.cell;
    for (let gy = FIELD.y1; gy > FIELD.y0; gy -= ch) for (let gx = FIELD.x0; gx < FIELD.x1; gx += cw) {
      const n = hash(gx * .013 + gy * .029 + d * 91);
      if (n < .18) continue;   // the odd empty cell keeps a natural gap
      add(depth, d, gx + (hash(n * 77) - .2) * cw * .8, gy - hash(n * 53) * ch * .7, depth.size * (.75 + hash(n * 31) * .5), false);
    }
  });
  // sky draws low under mid under high: the grid loop added them in that order already
  for (const island of SEA_ISLANDS) for (const [dx, dy, s] of CAP) add(DEPTHS[0], 0, island.x + dx, island.y + dy, s, true);
  const W = FIELD.x1 - FIELD.x0;
  return {
    count: clouds.length,
    // open[i]: how far the bank has parted round SEA_ISLANDS[i] (0 shut, 1 wide open)
    update(t, reduced, visible, anchor, camera, open) {
      for (const c of clouds) {
        let x = c.x, y = c.y;
        if (!reduced) {
          if (c.cap) {x += Math.sin(t * .11 + c.phase) * 26; y += Math.cos(t * .09 + c.phase) * 12;}
          else x = FIELD.x0 + ((x - FIELD.x0 + t * DEPTHS[c.depth].drift) % W + W) % W;
        }
        // Thickens out at sea: nothing over the home coast, full past y -1100.
        const dense = c.cap ? 1 : smooth(260, -1100, y);
        let px = camera.x + (x - camera.x) * c.f, py = camera.y + (y - camera.y) * c.f, v = dense;
        // Parting: inside 1300 of a sea island the bank slides outward (wider than tall) and shrinks away as you come close.
        for (let i = 0; i < SEA_ISLANDS.length; i++) {
          if (!open[i]) continue;
          const vx = px - SEA_ISLANDS[i].x, vy = py - SEA_ISLANDS[i].y, d = Math.hypot(vx * .8, vy) || 1;
          if (d > 1300) continue;
          const push = open[i] * (1300 - d) * (c.cap ? 1.1 : .75);
          px += vx / d * push * 1.25; py += vy / d * push * .8;
          v *= 1 - open[i] * smooth(1300, 300, d) * .85;
        }
        // A pocket of clear air round your own boat, so you always see where you are going.
        if (anchor) v *= smooth(200, 760, Math.hypot(px - anchor.x, (py - anchor.y) * 1.25));
        // Clouds grow in and shrink away rather than going see-through, so overlapping puffs stay clean cut-outs.
        const s = c.scale * (.3 + .7 * v) * (c.cap ? 1 : 1 + .35 * smooth(-900, -2300, y)), a = c.alpha * Math.min(1, v * 3), w = 300 * s;
        const show = a > .02 && visible(px, py, w);
        c.sprite.visible = show;
        if (show) {c.sprite.position.set(px, py); c.sprite.alpha = a; c.sprite.scale.set(s * c.flip, s);}
        if (c.shade) {
          const sx = px + 110 * c.f, sy = py + 170 * c.f, on = show && visible(sx, sy, w);   // on the water below and to the right
          c.shade.visible = on;
          if (on) {c.shade.position.set(sx, sy); c.shade.alpha = a * DEPTHS[c.depth].shadow; c.shade.scale.set(s * c.flip * 1.05, s * .9);}
        }
      }
    },
  };
}

// ---------- islands ----------
const S = ISLAND_SCALE;
// The real sand edge of the home coast (the same outline islands.js sails round, scaled), sampled with seaward normals.
const RING = sampleRing(lines.coast.map(([x, y]) => [(x - world.width / 2) * S, (y - world.height / 2) * S]), 14);
const ring = d => RING.flatMap(p => [p.x + p.nx * d, p.y + p.ny * d]);
const ringPts = d => RING.map(p => [p.x + p.nx * d, p.y + p.ny * d]);
const GRASS = ringPts(-30), INNER = ringPts(-62);
const THEMES = {
  blossom: {sand: PALETTE.sand, sandEdge: PALETTE.sandShade, grass: 0x93C93C, grassEdge: PALETTE.leaf, lawn: 0xA8D454, leaves: [['#4AA539', '#F29BB7'], ['#2B7A37', '#CC6A8E'], ['#89C332', '#FFD3E0']],
    flower: [['#F16E4B', '#EE86AA']], petals: [0xF7B3C9, 0xFFDCE6, 0xEE8FB0], glow: 0},
  sunset: {sand: 0xFDD98A, sandEdge: 0xE8B86A, grass: 0xA5C239, grassEdge: 0x7FA22E, lawn: 0xB9CF4A, leaves: [['#4AA539', '#FFA14F'], ['#2B7A37', '#D7672A'], ['#89C332', '#FFD27A']],
    flower: [], petals: null, glow: 0xFFA14F, warm: 0xFFE7C4},
  home: {sand: PALETTE.sand, sandEdge: PALETTE.sandShade, grass: PALETTE.grass, grassEdge: PALETTE.leaf, lawn: 0x9ED04A, leaves: [], flower: [], petals: null, glow: 0},   // seen from Blossom or Sunset: home green
};
// Island-local layout (0,0 = the island centre in islands.js; the dock pier runs south from y 150 to 205).
const LAYOUT = {
  blossom: {
    trees: [['tree-1', -205, -70, .78], ['tree-3', 45, -150, .74], ['tree-2', 215, -60, .8], ['tree-4', -60, -10, .66, true]],
    bushes: [['bush-flowering', -255, 45, .23], ['bush-flowering', 255, 60, .2]],
    flowers: [[-150, 70], [-120, 92], [-95, 66], [120, 82], [150, 60], [176, 88], [15, 40], [-20, 64]],
    sand: [['shell', -200, 1], ['shell', 210, 1], ['pebble', 120, 1], ['pebble', -260, 1]],
  },
  sunset: {
    trees: [['palm', -225, -35, .118], ['coconut', 238, -45, .11, true], ['tree-4', -30, -140, .7], ['tree-2', 120, -120, .72, true]],
    bushes: [['umbrella', -125, 62, .62], ['bush-2', -265, 40, .9]],
    flowers: [[-40, 44], [-12, 70], [28, 50], [-215, 82], [-190, 100], [250, 50]],
    sand: [['star', -190, 1], ['star', 225, 1], ['shell', 110, 1], ['pebble', -265, 1]],
  },
  home: {
    trees: [['tree-1', -200, -80, .78], ['tree-3', 50, -150, .74], ['tree-5', 220, -70, .7], ['tree-2', -50, -20, .66, true]],
    bushes: [['bush-2', -255, 45, .9], ['bush-2', 250, 60, .8]],
    flowers: [[-150, 70], [-120, 92], [-95, 66], [120, 82], [150, 60], [176, 88], [15, 40]],
    sand: [['shell', -200, 1], ['shell', 210, 1], ['pebble', 120, 1], ['pebble', -260, 1]],
  },
};
const SIGN = {x: 150, y: 140, rest: 1.3, big: 2.3};   // the name board stands on the sand just east of the dock
const DOCK = {x: 0, y0: 104, y1: 226, w: 80};

// One function so the harbor's shared jetty drawer can replace it: a humped-free plank jetty in the bridge-jetty style.
export function drawJetty(g, x, y0, y1, w) {
  const l = x - w / 2, r = x + w / 2, ink = {color: PALETTE.ink, width: 2.4, alpha: 1};
  g.rect(r - 4, y0 + 18, 16, y1 - y0 - 6).fill({color: PALETTE.ink, alpha: .15});                     // water shadow, east side
  g.rect(l - 10, y0 - 8, w + 20, 34).fill(PALETTE.sand).stroke({color: PALETTE.sandShade, width: 2.4});   // sand abutment
  g.rect(r, y0 + 12, 9, y1 - y0 - 8).fill(PALETTE.darkWood).stroke(ink);                                  // deck edge, the side you see
  g.roundRect(l, y0 + 4, w, y1 - y0, 4).fill(PALETTE.wood).stroke(ink);
  for (let y = y0 + 20; y < y1; y += 17) g.moveTo(l + 3, y).lineTo(r - 3, y).stroke({color: PALETTE.darkWood, width: 1.6, alpha: .7});
  for (const px of [l - 5, r + 5]) for (const py of [y0 + 30, (y0 + y1) / 2 + 12, y1 - 2]) g.roundRect(px - 5, py - 16, 10, 24, 3).fill(PALETTE.darkWood).stroke({...ink, width: 2});
  for (const px of [l - 5, r + 5]) g.moveTo(px, y0 + 18).lineTo(px, y1 - 14).stroke({color: PALETTE.darkWood, width: 2.2, alpha: .9});   // rope rail
  return g;
}

async function islandArt(theme) {
  const t = THEMES[theme], load = (src, resolution) => Assets.load({src, data: {resolution}});
  const plant = (kind, w, h) => (t.leaves.length ? recoloured(`/pixi-art/plants/${kind}.svg`, t.leaves, w, h, 3) : load(`/pixi-art/plants/${kind}.svg`, 3));
  // the detail art is drawn huge (2784 wide palms): raster it near the size it is shown
  const [tree1, tree2, tree3, tree4, tree5, bush2, flowerA, flowerB, bloom, palm, coconut, umbrella, shell, pebble, star, tuft1, tuft2] = await Promise.all([
    plant('tree-1', 260, 360), plant('tree-2', 180, 360), plant('tree-3', 300, 380), plant('tree-4', 200, 280), plant('tree-5', 150, 380), load('/pixi-art/plants/bush-2.svg', 3),
    theme === 'blossom' ? recoloured('/pixi-art/plants/flower-1.svg', t.flower, 48, 36, 6) : load(theme === 'home' ? '/pixi-art/plants/flower-2.svg' : '/pixi-art/plants/flower-1.svg', 6),
    load(theme === 'sunset' ? '/pixi-art/plants/flower-2.svg' : '/pixi-art/plants/flower-3.svg', 6),
    theme === 'blossom' ? load('/pixi-art/detail/nature--bush-flowering.svg', .5) : null,
    theme === 'sunset' ? load('/pixi-art/detail/nature--tree-palm.svg', .2) : null, theme === 'sunset' ? load('/pixi-art/detail/nature--tree-coconut-palm.svg', .2) : null,
    theme === 'sunset' ? load('/pixi-art/prop-47.svg', 2) : null,
    load('/pixi-art/prop-50.svg', 3), load('/pixi-art/decals/pebble-1.svg', 3), load('/pixi-art/detail/beach--starfish-orange.svg', .4),
    load('/pixi-art/decals/grass-tuft-1.svg', 3), load('/pixi-art/decals/grass-tuft-2.svg', 3),
  ]);
  return {'tree-1': tree1, 'tree-2': tree2, 'tree-3': tree3, 'tree-4': tree4, 'tree-5': tree5, bush2, flowerA, flowerB, 'bush-flowering': bloom, palm, coconut, umbrella, shell, pebble, star, tuft1, tuft2};
}

async function signTexture(name) {
  // The home wayfinding board (prop-82, LITTLE ISLE) with this island's name, centred, in its own Gilroy.
  let svg = await (await fetch('/pixi-art/prop-82.svg')).text();
  svg = svg.replace(/<text([^>]*?)x="[^"]*"/, '<text$1x="0" text-anchor="middle"').replace(/font-size="22"([^>]*)>LITTLE ISLE</, `font-size="20"$1>${name.toUpperCase()}<`);
  return svgTexture(svg, 3);
}

const revealed = new Set();   // a name pops once per visit to the page; after that the sign just stands there
const easeBack = p => 1 + 2.2 * (p - 1) ** 3 + 1.2 * (p - 1) ** 2;

async function buildIsland(destination, layers, art, sign, index) {
  const theme = THEMES[destination.destination] ? destination.destination : 'home', T = THEMES[theme], L = LAYOUT[theme];
  const {x: ox, y: oy} = SEA_ISLANDS[index];
  const ground = new Container({label: `${destination.name} ground`});
  ground.position.set(ox, oy);
  if (T.glow) {const glow = new Sprite(art.blob); glow.anchor.set(.5); glow.tint = T.glow; glow.alpha = .5; glow.position.set(0, -20); glow.width = 1700; glow.height = 1150; ground.addChild(glow);}
  const shallows = new Graphics().poly(ring(118)).fill({color: 0xA9E4EE, alpha: .35}).poly(ring(70)).fill({color: 0xB8EAF1, alpha: .45})
    .poly(ring(92)).stroke({color: PALETTE.cream, width: 3, alpha: .25}).poly(ring(140)).stroke({color: PALETTE.cream, width: 2.5, alpha: .14});
  const surf = [0, 1 / 3, 2 / 3].map(phase => ({phase, g: new Graphics({label: 'Island surf'})}));
  const sand = new Graphics().poly(ring(0)).fill(T.sand).stroke({color: T.sandEdge, width: 3.5})
    .poly(ring(-8)).stroke({color: PALETTE.cream, width: 3, alpha: .45});   // wet sand glint just inside the edge
  const grass = new Graphics().poly(GRASS.flat()).fill(T.grass).stroke({color: T.grassEdge, width: 3});
  for (let i = 0; i < 7; i++) {   // lighter lawn leaves, like the home lawns
    const a = i / 7 * 6.28 + hash(index * 9 + i), px = Math.cos(a) * 170 * (.4 + hash(i * 4 + index)), py = Math.sin(a) * 75 * (.4 + hash(i * 7 + index)) - 20;
    const rx = 70 + hash(i) * 50, ry = 26 + hash(i * 3) * 16;
    if ([[0, 0], [rx, 0], [-rx, 0], [0, ry], [0, -ry]].every(([dx, dy]) => inRing(px + dx, py + dy, INNER))) grass.ellipse(px, py, rx, ry).fill({color: T.lawn, alpha: .55});   // never spills onto the sand
  }
  if (T.petals) for (let i = 0; i < 60; i++) {   // fallen blossom on the lawn
    const px = (hash(i * 13.1) - .5) * 560, py = (hash(i * 7.7) - .5) * 300 - 10;
    if (inRing(px, py, GRASS)) grass.ellipse(px, py, 5, 3).fill(T.petals[i % 3]);
  }
  const decor = new Container();
  const flat = (tex, px, py, w, h, r = 0) => {const s = new Sprite(tex); s.anchor.set(.5); s.position.set(px, py); s.width = w; s.height = h; s.rotation = r; decor.addChild(s);};
  for (let i = 0; i < 26; i++) {const px = (hash(i * 3.3 + index) - .5) * 580, py = (hash(i * 5.9 + index) - .5) * 330; if (inRing(px, py, INNER)) flat(i % 2 ? art.tuft1 : art.tuft2, px, py, i % 2 ? 44 : 34, i % 2 ? 26 : 22);}
  // shells, pebbles and starfish on the rim: nearest rim point to each x along the south side
  for (const [kind, px] of L.sand) {
    const p = RING.filter(q => q.ny > .3).reduce((a, b) => (Math.abs(b.x - px) < Math.abs(a.x - px) ? b : a));
    const sx = p.x - p.nx * 15, sy = p.y - p.ny * 15;
    if (kind === 'star') flat(art.star, sx, sy, 34, 32, hash(px) * 2); else if (kind === 'shell') flat(art.shell, sx, sy, 34, 26); else flat(art.pebble, sx, sy, 22, 14);
  }
  const dock = drawJetty(new Graphics({label: 'Dock'}), DOCK.x, DOCK.y0, DOCK.y1, DOCK.w);
  ground.addChild(shallows, ...surf.map(s => s.g), sand, grass, decor, dock);
  layers.ground.addChild(ground);
  // Standing things go straight into the sorted objects layer, so boats and Duckies pass in front of and behind them.
  const standing = [];
  const stand = (tex, px, py, w, h, flip, anchorY = 1) => {
    if (!tex) return;
    const s = new Sprite(tex); s.anchor.set(.5, anchorY); s.position.set(ox + px, oy + py); s.width = w; s.height = h;
    if (flip) s.scale.x *= -1;
    if (T.warm) s.tint = T.warm;
    s.zIndex = oy + py; layers.objects.addChild(s); standing.push(s);
  };
  const SIZE = {'tree-1': [260, 360], 'tree-2': [180, 360], 'tree-3': [300, 380], 'tree-4': [200, 280], 'tree-5': [150, 380], palm: [2784, 2970], coconut: [2784, 2970]};
  for (const [kind, px, py, k, flip] of L.trees) stand(art[kind], px, py, SIZE[kind][0] * k, SIZE[kind][1] * k, flip, kind === 'palm' || kind === 'coconut' ? .97 : 1);
  for (const [kind, px, py, k] of L.bushes) {
    if (kind === 'umbrella') stand(art.umbrella, px, py, 240 * k, 235 * k, false, 211 / 235);
    else if (kind === 'bush-flowering') stand(art['bush-flowering'], px, py, art['bush-flowering'].width * k, art['bush-flowering'].height * k, px > 0, .95);
    else stand(art.bush2, px, py, 168 * k, 110 * k, false);
  }
  L.flowers.forEach(([px, py], i) => stand(i % 3 === 2 ? art.flowerB : art.flowerA, px, py, 62, 46, i % 2));
  // The name board: one sprite whose scale carries the pop; anchored at its post foot (prop-82's ground-contact origin).
  const board = new Sprite(sign);
  board.anchor.set(129 / 258, 120 / 129);
  board.position.set(ox + SIGN.x, oy + SIGN.y); board.zIndex = oy + SIGN.y; board.visible = false;
  layers.objects.addChild(board);
  // Blossom petals drifting off the trees (static on the lawn under reduced motion).
  let petals = null;
  if (T.petals) {
    petals = new Container({label: 'Blossom petals'}); petals.zIndex = oy + 170; petals.upright = true;
    for (let i = 0; i < 16; i++) {const p = new Graphics().ellipse(0, 0, 9, 5.5).fill(T.petals[i % 3]); p.seed = i; petals.addChild(p);}
    layers.objects.addChild(petals);
  }
  return {ground, standing, board, petals, surf, id: destination.destination, x: ox, y: oy, revealAt: revealed.has(destination.destination) ? -1 : null,
    destroy() {ground.destroy({children: true}); for (const s of [...standing, board]) s.destroy(); petals?.destroy({children: true});}};
}

// Surf round a sea island: the house surf (surf.js), three crests running in to the sand, foam only on the last stretch.
function drawSurf(island, t, reduced) {
  for (const {phase, g} of island.surf) {
    g.clear();
    const clock = (reduced ? .9 : t) / 6 + phase, age = clock - Math.floor(clock), fade = Math.min(1, age * 6, (1 - age) * 8);
    if (fade <= .01) continue;
    const off = 64 - 76 * (1 - (1 - age) ** 1.45);
    for (let k = 0; k <= RING.length; k++) {const p = RING[k % RING.length], d = off + Math.sin(p.along * 70 - age * 3) * 3 + 5; k ? g.lineTo(p.x + p.nx * d, p.y + p.ny * d) : g.moveTo(p.x + p.nx * d, p.y + p.ny * d);}
    g.stroke({color: PALETTE.cream, width: 12 + 9 * age, alpha: .16 * fade, join: 'round'});
    const foam = fade * Math.min(1, Math.max(0, (age - .55) * 8));
    if (foam <= .01) continue;
    let on = false;
    for (let k = 0; k <= RING.length; k++) {
      const p = RING[k % RING.length];
      if (Math.sin(p.along * 120 + age * 4) < -.45) {on = false; continue;}
      const d = off + Math.sin(p.along * 70 - age * 3) * 3, x = p.x + p.nx * d, y = p.y + p.ny * d;
      on ? g.lineTo(x, y) : g.moveTo(x, y); on = true;
    }
    g.stroke({color: PALETTE.cream, width: 3.5 + 2.5 * age, alpha: .9 * foam, cap: 'round', join: 'round'});
  }
}

export async function createSea(water, objects, air) {
  const ground = new Container({label: 'Sea islands'});
  const [clouds, blob] = await Promise.all([createClouds(water, air), svgTexture(BLUR(256, 128, '#ffffff'), 1)]);
  const arts = new Map(), artFor = theme => {if (!arts.has(theme)) arts.set(theme, islandArt(theme).then(art => Object.assign(art, {blob}))); return arts.get(theme);};   // loaded the first time that island is in sight
  water.addChild(ground);   // above the cloud shadows
  const signs = new Map();
  let islands = [], token = 0, lastSurf = -1;
  const open = new Float32Array(SEA_ISLANDS.length);
  return {
    clouds: clouds.count,
    async switchIsland(destinations) {
      const mine = ++token;
      for (const island of islands) island.destroy();
      islands = [];
      const built = await Promise.all(destinations.map(async (destination, i) => {
        if (!signs.has(destination.name)) signs.set(destination.name, signTexture(destination.name));
        const [art, sign] = await Promise.all([artFor(THEMES[destination.destination] ? destination.destination : 'home'), signs.get(destination.name)]);
        return buildIsland(destination, {ground, objects}, art, sign, i);
      }));
      if (mine !== token) {for (const island of built) island.destroy(); return;}
      islands = built;
    },
    update(t, reduced, visible, player, camera) {
      const anchor = player || camera;
      for (let i = 0; i < SEA_ISLANDS.length; i++) open[i] = anchor ? smooth(1100, 600, Math.hypot(anchor.x - SEA_ISLANDS[i].x, (anchor.y - SEA_ISLANDS[i].y) * 1.1)) : 0;
      clouds.update(t, reduced, visible, player, camera, open);
      const frame = Math.floor(t * 30);
      for (let i = 0; i < islands.length; i++) {
        const island = islands[i];
        const shown = visible(island.x, island.y - 100, 700), a = smooth(0, .12, open[i]);   // opaque almost at once: the parting cloud does the revealing, not a ghost fade
        island.ground.visible = shown && a > 0; island.ground.alpha = a;
        for (const s of island.standing) {s.visible = island.ground.visible; s.alpha = a;}
        if (island.ground.visible && frame !== lastSurf) drawSurf(island, t, reduced);
        // The name: first time the island clears the cloud it pops (scale + fade, .4 s), holds big, then settles on its post.
        if (island.revealAt === null && open[i] > .35) {island.revealAt = t; revealed.add(island.id);}
        const b = island.board;
        b.visible = shown && island.revealAt !== null;
        if (b.visible) {
          const age = island.revealAt < 0 ? 99 : t - island.revealAt, k = SIGN.rest;
          let scale = k, alpha = a;
          if (reduced) alpha = Math.min(a, age / .4);
          else if (age < .4) {scale = SIGN.big * easeBack(age / .4); alpha = Math.min(a, age / .4);}
          else if (age < 2.2) scale = SIGN.big;
          else if (age < 2.8) {const p = (age - 2.2) / .6, e = p * p * (3 - 2 * p); scale = SIGN.big + (k - SIGN.big) * e;}
          b.scale.set(Math.max(.001, scale)); b.alpha = alpha;
          b.zIndex = island.y + SIGN.y + (scale > k + .01 ? 5000 : 0);   // over the trees while it is big
        }
        if (island.petals) {
          island.petals.visible = island.ground.visible;
          if (island.petals.visible) for (let j = 0; j < island.petals.children.length; j++) {
            const p = island.petals.children[j], life = reduced ? .5 : (t * .12 + hash(j * 5.3)) % 1, sx = (hash(j * 2.1) - .5) * 520, sy = -260 + hash(j * 4.7) * 120;
            p.position.set(island.x + sx + life * 120 + Math.sin(t * 1.7 + j) * (reduced ? 0 : 14), island.y + sy + life * 330);
            p.rotation = reduced ? j : t * 2 + j; p.alpha = a * Math.min(1, life * 5, (1 - life) * 4);
          }
        }
      }
      if (frame !== lastSurf) lastSurf = frame;
    },
  };
}
