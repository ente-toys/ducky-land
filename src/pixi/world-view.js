// boss 5 Nov: the zoom-out story, "like Google Earth". Zooming out past the home island the flat world curls into a globe
// floating in space; drag spins it, and it turns slowly when left alone. Style (boss ref, a cartoon Earth): flat blue sea
// with lighter shallow bands following every coast, a glowing rim, a pin on where you are, and the 30,000 Duckies
// shown alive as ripples and hearts. One world texture (every island at its true place on a wrapping map) feeds the globe.
import {Container, GlProgram, Graphics, Mesh, MeshGeometry, RenderTexture, Shader, Sprite, Text} from 'pixi.js';
import shapes from './walk-shapes.json' with {type: 'json'};
import {PALETTE} from './palette.js';

const VERTEX = `
#version 300 es
in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  vUV = aUV;
  gl_Position = vec4((uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix * vec3(aPosition, 1.)).xy, 0., 1.);
}`;

const FRAGMENT = `
#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uScene;
uniform sampler2D uWorld;
uniform float uTime;
uniform vec2 uCam;      // camera point, world units
uniform float uZoom;    // flat-view zoom (screen px per world unit)
uniform vec2 uRes;      // screen size, px
uniform vec4 uBounds;   // world map x0, y0, width, height (world units)
uniform float uR;       // planet radius as a share of the screen height
uniform vec2 uSpin;     // world-units offset the globe has rolled by
uniform vec3 uSea;      // the game's water
float hash(vec2 p) {return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
}
vec3 world(vec2 uv, vec3 sea) {   // the wrapping island map; transparent = open sea
  vec4 c = texture(uWorld, fract(uv));
  return mix(sea, c.rgb / max(c.a, .001), c.a);
}
// near the camera the real rendered scene, farther out the world map of the same islands
vec3 ground(vec2 g) {
  vec2 suv = ((g - uCam) * uZoom + uRes * .5) / uRes;
  vec3 far = world((g - uBounds.xy) / uBounds.zw, uSea);
  if (suv.x < 0. || suv.x > 1. || suv.y < 0. || suv.y > 1.) return far;
  vec4 c = texture(uScene, suv);
  vec3 nearCol = mix(far, c.rgb / max(c.a, .001), c.a);
  vec2 e = min(suv, 1. - suv);
  return mix(far, nearCol, smoothstep(0., .04, min(e.x, e.y)));   // soften the seam where the real scene ends
}
// the planet: the same flat world bent onto a globe. With a huge radius it IS the flat view; as the radius shrinks the
// edges curl away and space shows round it, so the pull-out into space is one continuous move.
vec3 planet(vec2 uv) {
  vec2 px = (uv - .5) * uRes;
  float Rp = uR * uRes.y, d = length(px) / Rp, onePx = 1. / Rp;
  float ball = smoothstep(4., 1., uR);                     // space and shading only once it reads as a ball
  // space: plain navy with fine twinkling stars (boss 5 Nov: the two rings round the globe removed)
  vec2 sp = uv * uRes;
  vec3 space = vec3(.07, .09, .22);
  float st = hash(floor(sp / 2.)), tw = .5 + .5 * sin(uTime * 1.7 + st * 40.);
  space += vec3(1., .95, .8) * step(.9975, st) * tw * step(1.03, d);
  float glow = pow(smoothstep(1. + 34. * onePx, 1., d), 2.2) * step(1., d);
  space = mix(space, vec3(.5, .84, 1.), glow * .95);       // the glowing rim of air (boss ref)
  if (d >= 1.) return mix(ground(uCam + px / uZoom), space, ball);
  vec2 dir = d > 0. ? px / length(px) : vec2(0.);
  vec2 g = uCam + uSpin + dir * asin(d) * Rp / uZoom;     // near the middle: the flat view, unchanged
  vec2 m = g / uBounds.zw * 7.;                           // painted sea: big soft patches of lighter and deeper blue
  float wash = noise(m) * .65 + noise(m * 2.3 + 5.) * .35;
  vec3 paint = mix(vec3(.16, .45, .82), vec3(.3, .64, .93), smoothstep(.3, .75, wash));
  vec3 ocean = mix(uSea, paint, ball);                    // open sea deepens to cartoon-Earth blue as it becomes a ball
  vec3 col = mix(ground(g), world((g - uBounds.xy) / uBounds.zw, ocean), ball);
  // flat cartoon light: one soft-edged shadow on the far side, a lighter cap on the lit side, a bright inner rim
  float z = sqrt(1. - d * d);
  vec3 n = vec3(px.x / Rp, -px.y / Rp, z), L = normalize(vec3(-.5, .5, .72));
  float lit = dot(n, L);
  col = mix(col, col * vec3(.72, .8, .98), (1. - smoothstep(.12, .3, lit)) * ball);
  col = mix(col, col + vec3(.06, .07, .08), smoothstep(.8, .95, lit) * ball);
  col = mix(col, vec3(.72, .92, 1.), pow(smoothstep(.82, 1., d), 1.6) * .75 * ball);   // bright inner rim
  return col;
}
void main() {
  finalColor = vec4(planet(vUV), 1.);
}`;

// The world texture: every island at its true place on a map that wraps both ways, each sitting in two flat bands of
// lighter water that follow its coast (the cartoon-Earth shallows), drawn under the island art itself.
function buildWorldTexture(app, islands, bounds, islandTexture, worldSize) {
  const W = 4096, H = 2048, span = {x: bounds.x1 - bounds.x0, y: bounds.y1 - bounds.y0};
  const kx = W / span.x, ky = H / span.y;
  const box = new Container(), bands = new Graphics();
  box.addChild(bands);
  const coast = (island, grow, ox, oy) => {
    const c = Math.cos(island.rot), s = Math.sin(island.rot);
    return shapes.coast.flatMap(([x, y]) => {
      const dx = (x - worldSize.width / 2) * island.scale * grow * island.flip, dy = (y - worldSize.height / 2) * island.scale * grow;
      return [(island.x - bounds.x0 + dx * c - dy * s) * kx + ox, (island.y - bounds.y0 + dx * s + dy * c) * ky + oy];
    });
  };
  const copies = [];
  for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) copies.push([ox, oy]);
  for (const grow of [1.42, 1.2]) for (const island of islands) for (const [ox, oy] of copies) bands.poly(coast(island, grow, ox, oy)).fill({color: 0xFFFFFF, alpha: .16});   // a light tint over whatever the sea is
  for (const island of islands) for (const [ox, oy] of copies) {
    const s = new Sprite(islandTexture);
    s.anchor.set(.5);
    s.position.set((island.x - bounds.x0) * kx + ox, (island.y - bounds.y0) * ky + oy);
    s.width = worldSize.width * island.scale * kx; s.height = worldSize.height * island.scale * ky;
    s.scale.x *= island.flip; s.rotation = island.rot; s.tint = island.tint ?? 0xFFFFFF;
    box.addChild(s);
  }
  const rt = RenderTexture.create({width: W, height: H, addressMode: 'repeat', scaleMode: 'linear'});
  app.renderer.render({container: box, target: rt, clear: true});
  box.destroy({children: true});
  return rt;
}

// the 'you are here' pin: a sun-yellow drop with an ink outline and a cream dot, a 'You' tag above it
function makePin() {
  const pin = new Container({label: 'You are here'});
  const shadow = new Graphics().ellipse(0, 0, 9, 3.5).fill({color: 0x000000, alpha: .25});
  const drop = new Graphics()
    .moveTo(0, 0).bezierCurveTo(-4, -10, -15, -18, -15, -30).arc(0, -30, 15, Math.PI, 0).bezierCurveTo(15, -18, 4, -10, 0, 0)
    .fill(PALETTE.sun).stroke({color: PALETTE.ink, width: 3, join: 'round'});
  drop.circle(0, -30, 6).fill(PALETTE.cream).stroke({color: PALETTE.ink, width: 2});
  const tag = new Text({text: 'You', style: {fontFamily: 'ui-rounded, system-ui, sans-serif', fontSize: 13, fontWeight: '700', fill: PALETTE.ink}});
  tag.anchor.set(.5);
  const tagBg = new Graphics().roundRect(-20, -11, 40, 22, 11).fill(PALETTE.cream).stroke({color: PALETTE.ink, width: 2});
  const label = new Container(); label.addChild(tagBg, tag); label.position.set(0, -64);
  const body = new Container(); body.addChild(drop, label);
  pin.addChild(shadow, body);
  pin.body = body;
  return pin;
}

export function createWorldView(app, scene) {
  let rt = RenderTexture.create({width: 2, height: 2}), w = 0, h = 0, worldTex = null;
  const geometry = new MeshGeometry({positions: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), indices: new Uint32Array([0, 1, 2, 0, 2, 3])});
  const blank = RenderTexture.create({width: 2, height: 2});
  const shader = new Shader({glProgram: GlProgram.from({vertex: VERTEX, fragment: FRAGMENT, name: 'ducky-world-view', preferredFragmentPrecision: 'highp'}), resources: {
    uScene: rt.source, uWorld: blank.source, viewUniforms: {
      uTime: {value: 0, type: 'f32'}, uZoom: {value: 1, type: 'f32'}, uR: {value: .43, type: 'f32'},
      uCam: {value: new Float32Array([0, 0]), type: 'vec2<f32>'}, uRes: {value: new Float32Array([1, 1]), type: 'vec2<f32>'},
      uBounds: {value: new Float32Array([0, 0, 1, 1]), type: 'vec4<f32>'}, uSpin: {value: new Float32Array([0, 0]), type: 'vec2<f32>'},
      uSea: {value: new Float32Array([0x6E / 255, 0xC9 / 255, 0xDE / 255]), type: 'vec3<f32>'},
    },
  }});
  const mesh = new Mesh({geometry, shader, label: 'World view'});
  mesh.visible = false;
  app.stage.addChildAt(mesh, app.stage.getChildIndex(scene) + 1);
  // boss 5 Nov (ref: Kaspersky cybermap): the world is busy. Duckies doing things pop as sun-yellow ripples on islands,
  // now and then a little coral heart floats up. No flying arcs (boss).
  const life = new Graphics({label: 'Ducky activity'});
  const pin = makePin();
  app.stage.addChildAt(life, app.stage.getChildIndex(mesh) + 1);
  app.stage.addChildAt(pin, app.stage.getChildIndex(life) + 1);
  life.visible = pin.visible = false;
  const u = shader.resources.viewUniforms.uniforms;
  const ease = x => {x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x);};
  const wrap = (v, p) => v - p * Math.round(v / p);
  let seed = 7;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const ripples = [];
  let lastT = 0, rippleDue = 0;
  const heart = (g, x, y, s, color, alpha) => g.moveTo(x, y + s * .9).bezierCurveTo(x - s * 1.4, y - s * .2, x - s * .6, y - s * 1.3, x, y - s * .4)
    .bezierCurveTo(x + s * .6, y - s * 1.3, x + s * 1.4, y - s * .2, x, y + s * .9).fill({color, alpha});
  return {
    // t: 0 at the island, 1 fully zoomed out. cam: the camera's world point. me: where the player is (world units).
    update(t, width, height, time, cam, arch, worldSize, floorZoom, idle, me) {
      const on = t > .001;
      mesh.visible = on;
      if (!on) {scene.visible = true; life.visible = pin.visible = false; return;}
      if (!worldTex && arch?.texture) {
        worldTex = buildWorldTexture(app, arch.islands, arch.bounds, arch.texture, worldSize);
        shader.resources.uWorld = worldTex.source;
      }
      if (width !== w || height !== h) {w = width; h = height; rt.resize(w, h); mesh.scale.set(w, h); shader.resources.uScene = rt.source;}
      scene.visible = true; app.renderer.render({container: scene, target: rt, clear: true}); scene.visible = false;   // the real islands round the camera
      const b = arch.bounds, spanX = b.x1 - b.x0, spanY = b.y1 - b.y0;
      // the globe is a fixed size in world units, so its radius on screen follows the zoom exactly: huge (flat) up close,
      // a ball in space at the floor zoom. One continuous move, like Google Earth.
      const R = .43 * cam.zoom / floorZoom, Rp = R * h, ball = ease((4 - R) / 3);
      this.roll = (this.roll || 0) + (idle ? ease((t - .9) / .1) * spanX / 3600 : 0);   // turns slowly when left alone
      u.uR = R; u.uSpin[0] = this.roll; u.uSpin[1] = 0;
      u.uTime = time; u.uZoom = cam.zoom;
      u.uCam[0] = cam.x; u.uCam[1] = cam.y; u.uRes[0] = w; u.uRes[1] = h;
      u.uBounds[0] = b.x0; u.uBounds[1] = b.y0; u.uBounds[2] = spanX; u.uBounds[3] = spanY;
      // where a world point sits on the globe right now (the same bend as the shader), and how much it faces us
      const project = (x, y) => {
        const dx = wrap(x - cam.x - this.roll, spanX), dy = wrap(y - cam.y, spanY);
        const len = Math.hypot(dx, dy), arc = Math.min(len * cam.zoom / Rp, Math.PI / 2);
        const k = len > 0 ? Math.sin(arc) * Rp / len : 0;
        return {x: w / 2 + dx * k, y: h / 2 + dy * k, face: Math.cos(arc)};
      };
      const islands = arch.islands, dt = Math.min(.1, Math.max(0, time - lastT)); lastT = time;
      const busy = ease((ball - .25) / .4);
      life.visible = busy > .01; life.alpha = busy; life.clear();
      if (busy > .01) {
        const pick = () => {const i = islands[Math.floor(rand() * islands.length)], a = rand() * 6.283, r = rand() * .25 * worldSize.width * i.scale; return {x: i.x + Math.cos(a) * r, y: i.y + Math.sin(a) * r * .7};};
        for (rippleDue -= dt; rippleDue < 0; rippleDue += .06) ripples.push({...pick(), at: time, heart: rand() < .18});
        const px = Math.max(1, Rp / 240);   // ripple size follows the globe
        for (let i = ripples.length - 1; i >= 0; i--) {
          const r = ripples[i], age = (time - r.at) / 1.6;
          if (age >= 1) {ripples.splice(i, 1); continue;}
          const p = project(r.x, r.y);
          if (p.face < .08) continue;
          const f = ease(p.face / .3), sq = .45 + .55 * p.face;   // rings flatten toward the rim
          for (const lag of [0, .28]) {
            const k = (age - lag) / (1 - lag);
            if (k <= 0) continue;
            life.ellipse(p.x, p.y, (3 + k * 24) * px, (3 + k * 24) * px * sq).stroke({color: lag ? 0xFFF6D8 : 0xFFD21F, width: 2.6 * px, alpha: (1 - k) * f});
          }
          life.circle(p.x, p.y, 3 * px).fill({color: 0xFFD21F, alpha: (1 - age) * f}).stroke({color: 0xFFF6D8, width: 1.2 * px, alpha: (1 - age) * f});
          if (r.heart) heart(life, p.x, p.y - (8 + age * 30) * px, 6 * px, PALETTE.coral, ease((1 - age) * 3) * f);
        }
      } else ripples.length = 0;
      // the pin: the player's world point projected onto the globe the same way the shader bends the map
      if (me) {
        const p = project(me.x, me.y);
        pin.position.set(p.x, p.y);
        pin.alpha = ease((t - .12) / .15) * ease(p.face / .25);
        pin.visible = pin.alpha > .01;
        pin.body.y = -Math.abs(Math.sin(time * 3)) * 6;
        pin.scale.set(.8 + .2 * p.face);
      } else pin.visible = false;
    },
    destroy() {mesh.destroy(); life.destroy(); pin.destroy({children: true}); shader.destroy(); rt.destroy(true); blank.destroy(true); worldTex?.destroy(true); geometry.destroy();},
  };
}
