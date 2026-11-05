// boss 5 Nov: 300 home islands (30k stars = 300 islands), all the same island for now; themes come later.
// One snapshot of the home island is reused for 299 copies laid out as a GTA-style world map,
// and the bird's-eye view zooms the camera out far enough to see the whole archipelago.
import {Container, Filter, GlProgram, Graphics, Rectangle, Sprite, Text} from 'pixi.js';
import shapes from './walk-shapes.json' with {type: 'json'};

export const ISLAND_COUNT = 300;
const hash = i => {const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s);};

// boss 5 Nov: a GTA-style world map (refs: GTA V/VI map shots). A few big landmasses made of islands packed edge to edge,
// archipelago chains curling between them, lone islets in open sea; seeded so everyone sees the same world. Home sits in
// the middle of the biggest landmass. 30,000 Duckies (100 per island) show as tiny yellow dots once you zoom out far.
export function archipelagoLayout(world, seed = 11) {
  let n = seed >>> 0;
  const rnd = () => ((n = (n * 1664525 + 1013904223) >>> 0) / 4294967296);
  const W = world.width, H = world.height, cx = W / 2, cy = H / 2;
  const out = [{index: 0, home: true, x: cx, y: cy, scale: 1, flip: 1, rot: 0}];
  const clear = (x, y, s, gap) => out.every(i => Math.hypot((i.x - x) / W, (i.y - y) / H) > (i.scale + s) * .5 * gap);
  const add = (x, y, s) => out.push({index: out.length, home: false, x, y, scale: s, flip: rnd() < .5 ? -1 : 1, rot: (rnd() - .5) * 1.2});
  // landmasses: centre, radius (in island widths), how many islands
  const lands = [[0, 0, 4.2, 95], [-11, -7, 3, 50], [10, -7, 2.7, 40], [-9, 8, 2.4, 32], [9, 8, 2.1, 25]];
  const landInfo = [];
  for (const [lx, ly, r, count] of lands) {
    landInfo.push({x: cx + lx * W, y: cy + ly * H, r});
    const lobes = Array.from({length: 5}, () => ({a: rnd() * 6.28, k: 2 + Math.floor(rnd() * 4), m: .1 + rnd() * .15}));
    const edge = a => r * (1 + lobes.reduce((t, l) => t + Math.sin(a * l.k + l.a) * l.m, 0));
    let placed = 0;
    for (let t = 0; placed < count && t < 20000; t++) {
      const a = rnd() * 6.28, d = Math.sqrt(rnd()) * edge(a), s = .55 + rnd() * .5;
      const x = cx + (lx + Math.cos(a) * d) * W, y = cy + (ly + Math.sin(a) * d * .8) * H;
      if (clear(x, y, s, .4)) {add(x, y, s); placed++;}   // packed tight: neighbours touch, so they read as one landmass
    }
  }
  // archipelago chains: small islands strung along gentle arcs between and around the landmasses
  for (let c = 0; c < 9 && out.length < 270; c++) {
    let x = cx + (rnd() - .5) * 34 * W, y = cy + (rnd() - .5) * 30 * H, a = rnd() * 6.28;
    for (let k = 0; k < 7 && out.length < 270; k++) {
      a += (rnd() - .5) * .9; x += Math.cos(a) * W * 1.1; y += Math.sin(a) * H * 1.1;
      const s = .3 + rnd() * .25; if (clear(x, y, s, .9)) add(x, y, s);
    }
  }
  // lone islets in open sea fill the rest
  for (let t = 0; out.length < ISLAND_COUNT && t < 40000; t++) {
    const x = cx + (rnd() - .5) * 40 * W, y = cy + (rnd() - .5) * 34 * H, s = .22 + rnd() * .25;
    if (clear(x, y, s, 1.6)) add(x, y, s);
  }
  const pad = 2 * W;
  const bounds = {x0: Math.min(...out.map(i => i.x - W * i.scale / 2)) - pad, y0: Math.min(...out.map(i => i.y - H * i.scale / 2)) - pad,
    x1: Math.max(...out.map(i => i.x + W * i.scale / 2)) + pad, y1: Math.max(...out.map(i => i.y + H * i.scale / 2)) + pad};
  return {islands: out, bounds, rnd, lands: landInfo};
}

export function createArchipelago(app, scene, layer, world) {
  const layout = archipelagoLayout(world), {islands, bounds} = layout;
  const people = new Graphics({label: '30,000 Duckies'});
  const root = new Container({label: 'Archipelago'});
  layer.addChildAt(root, 0);   // under the home island's water and ground
  root.addChild(people);
  // boss 5 Nov: zoomed far out the world reads like a school world atlas: every island a pastel 'country' with an ink
  // border, pale shallows round the coasts, a faint grid, and names on the landmasses and oceans
  const atlas = new Container({label: 'World atlas'}); atlas.visible = false;
  const PASTEL = [0xF6C9A8, 0xF4E3A1, 0xC8E6A0, 0xA9D8C8, 0xF2B6C6, 0xD9C3EC, 0xFBD48C, 0xB9E2F2, 0xE8D3B0, 0xCFE8B5];
  const coast = (island, grow = 1) => {
    const c = Math.cos(island.rot), s = Math.sin(island.rot);
    return shapes.coast.flatMap(([x, y]) => {
      const ox = (x - world.width / 2) * island.scale * grow * island.flip, oy = (y - world.height / 2) * island.scale * grow;
      return [island.x + ox * c - oy * s, island.y + ox * s + oy * c];
    });
  };
  const grid = new Graphics(), shallows = new Graphics(), lands = new Graphics(), b = bounds;
  for (let x = Math.ceil(b.x0 / 20000) * 20000; x < b.x1; x += 20000) grid.moveTo(x, b.y0).lineTo(x, b.y1);
  for (let y = Math.ceil(b.y0 / 20000) * 20000; y < b.y1; y += 20000) grid.moveTo(b.x0, y).lineTo(b.x1, y);
  grid.stroke({color: 0xFFFFFF, width: 260, alpha: .35});
  for (const island of islands) shallows.poly(coast(island, 1.55)).fill({color: 0xBFEFF7, alpha: .7});
  islands.forEach((island, i) => lands.poly(coast(island)).fill(island.home ? 0xFFD525 : PASTEL[Math.floor(hash(i * 1.7) * PASTEL.length)]).stroke({color: 0x39452F, width: 220, alpha: .8}));
  atlas.addChild(grid, shallows, lands);
  const label = (text, x, y, size, color, italic = false) => {
    const t = new Text({text, style: {fontFamily: 'Georgia, serif', fontSize: 64, fontStyle: italic ? 'italic' : 'normal', fontWeight: italic ? '400' : '700', fill: color,
      stroke: {color: 0xFFFFFF, width: italic ? 0 : 6}, letterSpacing: italic ? 2 : 6, align: 'center'}});
    t.anchor.set(.5); t.position.set(x, y); t.scale.set(size / 64); atlas.addChild(t);
  };
  const NAMES = ['QUACKLAND', 'PUDDLE ISLES', 'FEATHERFIELD', 'WADDLE BAY', 'BREADCRUMB REACH'];
  layout.lands.forEach((l, i) => label(NAMES[i], l.x, l.y - l.r * world.height * .3, i ? 2600 : 3600, 0x2E3826));
  label('Big Quack Ocean', (b.x0 + b.x1) / 2, b.y0 + (b.y1 - b.y0) * .1, 3200, 0x1F6F8B, true);
  label('Paddle Sea', b.x0 + (b.x1 - b.x0) * .14, (b.y0 + b.y1) / 2, 2600, 0x1F6F8B, true);
  label('Bread Sea', b.x0 + (b.x1 - b.x0) * .86, (b.y0 + b.y1) / 2 + 6000, 2600, 0x1F6F8B, true);
  label('Sleepy Strait', (b.x0 + b.x1) / 2, b.y1 - (b.y1 - b.y0) * .1, 2600, 0x1F6F8B, true);
  root.addChild(atlas);
  let texture = null;
  return {
    bounds, count: islands.length,
    // snapshot the home island as it is drawn now (ground, props, everything), once, at a small size
    build() {
      if (texture) return;
      const keep = {x: scene.position.x, y: scene.position.y, sx: scene.scale.x, sy: scene.scale.y};
      scene.position.set(0, 0); scene.scale.set(1, 1); root.visible = false;
      texture = app.renderer.generateTexture({target: scene, frame: new Rectangle(0, 0, world.width, world.height), resolution: .14});
      scene.position.set(keep.x, keep.y); scene.scale.set(keep.sx, keep.sy); root.visible = true;
      for (const island of islands) if (!island.home) {
        const s = new Sprite(texture);
        s.anchor.set(.5); s.position.set(island.x, island.y);
        s.width = world.width * island.scale; s.height = world.height * island.scale; s.scale.x *= island.flip; s.rotation = island.rot;
        root.addChild(s);
      }
      // 30,000 Duckies: 100 tiny yellow dots per island, scattered over its land
      const r = layout.rnd;
      for (const island of islands) for (let k = 0; k < 100; k++) {
        const a = r() * 6.28, d = Math.sqrt(r()), c = Math.cos(island.rot), sn = Math.sin(island.rot);
        const ox = Math.cos(a) * d * world.width * island.scale * .36, oy = Math.sin(a) * d * world.height * island.scale * .32;
        people.rect(island.x + ox * c - oy * sn - 90, island.y + ox * sn + oy * c - 90, 180, 180);
      }
      people.fill(0xE8A000); root.addChild(atlas); root.addChild(people);   // atlas over the island art, dots on top
    },
    // the dots and the atlas only show when zoomed far out (they would cover the islands up close)
    update(zoom) {
      const far = Math.max(0, Math.min(1, (.012 - zoom) / .006));
      people.alpha = far; people.visible = far > 0;
      atlas.alpha = far; atlas.visible = far > 0;
      for (const s of root.children) if (s !== people && s !== atlas) s.alpha = 1 - far * .92;
    },
    destroy() {root.destroy({children: true}); texture?.destroy(true);},
  };
}

// boss 5 Nov: the bird's-eye view bulges into a little planet. The flat map is wrapped onto a sphere (edges squeeze in),
// shaded toward the rim with a soft blue atmosphere, floating on a starry night sky.
const GLOBE_VERT = `in vec2 aPosition; out vec2 vTextureCoord;
uniform vec4 uInputSize; uniform vec4 uOutputFrame; uniform vec4 uOutputTexture;
void main(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}`;
const GLOBE_FRAG = `in vec2 vTextureCoord; out vec4 finalColor;
uniform sampler2D uTexture; uniform vec4 uInputSize; uniform vec4 uOutputFrame;
uniform float uRadius; uniform float uTime; uniform vec3 uSea;
float hash(vec2 p) {return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);}
void main(void) {
  vec2 frame = uOutputFrame.zw, uv = vTextureCoord * uInputSize.xy / frame;   // 0..1 over the screen
  vec2 p = (uv - 0.5) * vec2(frame.x / frame.y, 1.0);                       // height = 1, centred
  float r = length(p) / uRadius;
  vec3 sky = mix(vec3(0.05, 0.07, 0.17), vec3(0.11, 0.13, 0.30), uv.y);
  vec2 cell = floor(uv * frame / 3.0);
  float star = step(0.9975, hash(cell)) * (0.6 + 0.4 * sin(uTime * 2.0 + hash(cell + 3.0) * 6.28));
  sky += star;
  float halo = exp(-max(r - 1.0, 0.0) * 9.0) * step(1.0, r);                  // soft atmosphere just outside the rim
  sky = mix(sky, vec3(0.55, 0.85, 1.0), halo * 0.55);
  if (r >= 1.0) {finalColor = vec4(sky, 1.0); return;}
  float src = asin(r) / 1.5707963;                                            // wrap the flat map onto the sphere
  vec2 q = (r > 0.0 ? p / length(p) : vec2(0.0)) * src * uRadius;
  vec2 suv = q / vec2(frame.x / frame.y, 1.0) + 0.5;
  vec4 c = texture(uTexture, suv * frame / uInputSize.xy);
  vec3 col = mix(uSea, c.rgb / max(c.a, 0.001), c.a);
  float z = sqrt(1.0 - r * r);                                                // sphere normal, lit from the upper left
  vec3 n = vec3(p / uRadius, z);
  float light = clamp(dot(n, normalize(vec3(-0.45, -0.5, 0.75))), 0.0, 1.0);
  col *= 0.55 + 0.55 * light;
  col = mix(col, vec3(0.62, 0.88, 1.0), pow(1.0 - z, 3.0) * 0.6);            // blue haze toward the rim
  col += pow(max(light, 0.0), 24.0) * 0.18;                                    // a little shine
  finalColor = vec4(col, 1.0);
}`;
export function createGlobeFilter() {
  return new Filter({glProgram: GlProgram.from({vertex: GLOBE_VERT, fragment: GLOBE_FRAG, name: 'ducky-globe'}),
    resources: {globe: {uRadius: {value: .46, type: 'f32'}, uTime: {value: 0, type: 'f32'}, uSea: {value: new Float32Array([0x6E / 255, 0xC9 / 255, 0xDE / 255]), type: 'vec3<f32>'}}}});
}
