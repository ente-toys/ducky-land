// boss 5 Nov: 300 home islands (30k stars = 300 islands), all the same island for now; themes come later.
// One snapshot of the home island is reused for 299 copies laid out in the shape of our Ducky,
// and the bird's-eye view zooms the camera out far enough to see the whole archipelago.
import {Container, Filter, GlProgram, Rectangle, Sprite} from 'pixi.js';
import map from './ducky-map.json' with {type: 'json'};

export const ISLAND_COUNT = 300;
const hash = i => {const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s);};

// boss 5 Nov: the 300 islands draw our exact Ducky (traced from the Figma Ducky, ducky-map.json). Small islands trace the
// outline, eyes, beak, tuft, wing seams and feet; bigger ones fill the body. Home is the body island nearest the middle.
export function archipelagoLayout(world) {
  const W = world.width, H = world.height, PX = 420;   // world units per map pixel
  const pts = map.points.map(([x, y, inner], i) => ({x: (x - map.center[0]) * PX, y: (y - map.center[1]) * PX, scale: inner ? .86 : .46, i}));
  const inner = pts.filter(p => p.scale > .5), near = inner.reduce((a, p) => Math.hypot(p.x, p.y) < Math.hypot(a.x, a.y) ? p : a, inner[0]);
  const out = [{index: 0, home: true, x: W / 2, y: H / 2, scale: 1, flip: 1}];
  for (const p of pts) if (p !== near) out.push({index: out.length, home: false, x: W / 2 + p.x - near.x, y: H / 2 + p.y - near.y, scale: p.scale, flip: hash(p.i) < .5 ? -1 : 1});
  const pad = 9000;
  const bounds = {x0: Math.min(...out.map(i => i.x - W * i.scale / 2)) - pad, y0: Math.min(...out.map(i => i.y - H * i.scale / 2)) - pad,
    x1: Math.max(...out.map(i => i.x + W * i.scale / 2)) + pad, y1: Math.max(...out.map(i => i.y + H * i.scale / 2)) + pad};
  return {islands: out, bounds};
}

export function createArchipelago(app, scene, layer, world) {
  const {islands, bounds} = archipelagoLayout(world);
  const root = new Container({label: 'Archipelago'});
  layer.addChildAt(root, 0);   // under the home island's water and ground
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
        s.width = world.width * island.scale; s.height = world.height * island.scale; s.scale.x *= island.flip;
        root.addChild(s);
      }
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
