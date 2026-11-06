import {islandArrow} from './explore-camera.js';
import {visibleWrapOffsets} from './world-texture-layout.js';
// boss 5 Nov: the zoom-out story, "like Google Earth". Zooming out past the home island the flat world curls into a globe
// floating in space; drag spins it, and it turns slowly when left alone. Style (boss ref, a cartoon Earth): flat blue sea
// with lighter shallow bands following every coast, a glowing rim, a pin on where you are, and the 30,000 Duckies
// shown alive as ripples and hearts. One world texture (every island at its true place on a wrapping map) feeds the globe.
import {Container, GlProgram, Graphics, Mesh, MeshGeometry, RenderTexture, Shader, Sprite, Text, Texture} from 'pixi.js';
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
uniform vec2 uLL;       // the point facing us on the sphere: longitude, latitude (radians)
uniform vec3 uSph;      // the sphere in world units: centre x, centre y, radius (the world wraps once round it)
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
  vec3 nearCol = mix(uSea, c.rgb / max(c.a, .001), c.a);   // on screen the real scene (islands drawn live) over plain game water: no blocky map halos
  vec2 e = min(suv, 1. - suv);
  return mix(far, nearCol, max(smoothstep(.02, .045, uZoom), smoothstep(0., .04, min(e.x, e.y))));   // soften the seam where the real scene ends
}
// the planet: the same flat world bent onto a globe. With a huge radius it IS the flat view; as the radius shrinks the
// edges curl away and space shows round it, so the pull-out into space is one continuous move.
vec3 planet(vec2 uv) {
  vec2 px = (uv - .5) * uRes;
  float Rp = uR * uRes.y, d = length(px) / Rp, onePx = 1. / Rp;
  float detail = smoothstep(.02, .045, uZoom);
  float ball = (1. - smoothstep(1., 4., uR)) * (1. - detail);                     // space and shading only once it reads as a ball
  // space: plain navy with fine twinkling stars (boss 5 Nov: the two rings round the globe removed)
  vec2 sp = uv * uRes + vec2(-uLL.x, uLL.y) * 90. * ball;   // stars drift a little as the globe turns
  vec3 space = vec3(.07, .09, .22);
  float st = hash(floor(sp / 2.)), tw = .5 + .5 * sin(uTime * 1.7 + st * 40.);
  space += vec3(1., .95, .8) * step(.9975, st) * tw * step(1.03, d);
  float air = exp(-max(d - 1., 0.) * Rp / 7.) * step(1., d);   // a thin soft atmosphere, falls off within ~20px
  space = mix(space, vec3(.36, .68, 1.), air * .7);
  if (d >= 1.) return mix(ground(uCam + px / uZoom), space, ball);
  vec2 dir = d > 0. ? px / length(px) : vec2(0.);
  vec2 gA = uCam + uSpin + mix(px, dir * asin(d) * Rp, ball) / uZoom;   // up close exactly the flat view, bending as it becomes a ball
  // a real sphere: the screen point on the ball, tilted by the latitude facing us, turned by the longitude, read as a
  // longitude/latitude on the world map (which wraps exactly once round the ball)
  vec3 v = vec3(px.x / Rp, -px.y / Rp, sqrt(max(0., 1. - d * d)));
  float cl = cos(uLL.y), sl = sin(uLL.y);
  vec3 r1 = vec3(v.x, cl * v.y + sl * v.z, -sl * v.y + cl * v.z);
  float lon = uLL.x + atan(r1.x, r1.z), lat = asin(clamp(r1.y, -1., 1.));
  vec2 gS = vec2(uSph.x + lon * uSph.z, uSph.y - lat * uSph.z);
  gS.x = gA.x + (gS.x - gA.x) - uBounds.z * floor((gS.x - gA.x) / uBounds.z + .5);   // same wrap as gA: no seam where the map joins
  vec2 g = mix(gA, gS, ball);
  vec3 paint = vec3(.2, .52, .86);                        // boss 5 Nov: one even sea colour (the painted patches made a seam)
  vec3 ocean = mix(uSea, paint, ball);                    // open sea deepens to cartoon-Earth blue as it becomes a ball
  // The atlas is an overview: stop magnifying it as islands become large enough
  // for live vector artwork, even while the horizon is still slightly curved.
  vec3 col = mix(ground(g), world((g - uBounds.xy) / uBounds.zw, ocean), ball * (1. - detail));
  // flat cartoon light: one soft-edged shadow on the far side, a lighter cap on the lit side, a bright inner rim
  float z = sqrt(1. - d * d);
  vec3 n = vec3(px.x / Rp, -px.y / Rp, z), L = normalize(vec3(-.5, .5, .72));
  float lit = dot(n, L);
  col = mix(col, col * vec3(.72, .8, .98), (1. - smoothstep(.12, .3, lit)) * ball);
  col = mix(col, col + vec3(.06, .07, .08), smoothstep(.8, .95, lit) * ball);
  col = mix(col, vec3(.55, .82, 1.), pow(smoothstep(.94, 1., d), 2.) * .45 * ball);   // a light touch of air just inside the edge
  return col;
}
void main() {
  finalColor = vec4(planet(vUV), 1.);
}`;

// The world texture: every island at its true place on a map that wraps both ways, each sitting in two flat bands of
// lighter water that follow its coast (the cartoon-Earth shallows), drawn under the island art itself.
// boss 6 Nov: each island in its own map's art and coast (a themed island once its art has loaded, home's until then)
function buildWorldTexture(app, islands, bounds, arch, worldSize) {
  const W = 4096, H = 2048, span = {x: bounds.x1 - bounds.x0, y: bounds.y1 - bounds.y0};
  const kx = W / span.x, ky = H / span.y;
  const box = new Container(), bands = new Graphics();
  box.addChild(bands);
  // the map wraps a sphere (longitude across, latitude down), which squeezes things toward the poles; each island is
  // drawn wider by the same amount so it looks its true shape on the ball
  const cyW = (bounds.y0 + bounds.y1) / 2, Rw = span.x / (2 * Math.PI);
  const widen = island => 1 / Math.max(.3, Math.cos((island.y - cyW) / Rw));
  const coast = (island, grow, ox, oy) => {
    const c = Math.cos(island.rot), s = Math.sin(island.rot), wd = widen(island);
    const m = arch.sizeOf ? arch.sizeOf(island.id) : null, size = m ?? worldSize, line = m && !m.home ? m.walk.coast : shapes.coast;
    return line.flatMap(([x, y]) => {
      const dx = (x - size.width / 2) * island.scale * grow * island.flip, dy = (y - size.height / 2) * island.scale * grow;
      return [(island.x - bounds.x0 + (dx * c - dy * s) * wd) * kx + ox, (island.y - bounds.y0 + dx * s + dy * c) * ky + oy];
    });
  };
  const layouts = islands.map(island => {
    const size = arch.sizeOf ? arch.sizeOf(island.id) : worldSize;
    const c = Math.abs(Math.cos(island.rot)), s = Math.abs(Math.sin(island.rot));
    // Include the outermost shallow band as well as the island artwork in the bounds.
    const rx = (size.width * c + size.height * s) * island.scale * 1.42 * widen(island) * kx / 2;
    const ry = (size.width * s + size.height * c) * island.scale * 1.42 * ky / 2;
    return {island, offsets: visibleWrapOffsets((island.x - bounds.x0) * kx, (island.y - bounds.y0) * ky, rx, ry, W, H)};
  });
  for (const grow of [1.42, 1.2]) for (const {island, offsets} of layouts) for (const [ox, oy] of offsets) bands.poly(coast(island, grow, ox, oy)).fill({color: 0xFFFFFF, alpha: .16});   // a light tint over whatever the sea is
  for (const {island, offsets} of layouts) for (const [ox, oy] of offsets) {
    const s = new Sprite(arch.textureOf ? arch.textureOf(island.id) : arch.texture), size = arch.sizeOf ? arch.sizeOf(island.id) : worldSize;
    s.anchor.set(.5);
    s.position.set((island.x - bounds.x0) * kx + ox, (island.y - bounds.y0) * ky + oy);
    s.width = size.width * island.scale * kx; s.height = size.height * island.scale * ky;
    s.scale.x *= island.flip; s.rotation = island.rot; s.tint = island.map && island.map !== 'home' ? 0xFFFFFF : island.tint ?? 0xFFFFFF;
    const holder = new Container(); holder.addChild(s); holder.scale.x = widen(island);   // widen in map space, after the turn
    holder.position.set(s.x, s.y); s.position.set(0, 0);
    box.addChild(holder);
  }
  const rt = RenderTexture.create({width: W, height: H, addressMode: 'repeat', scaleMode: 'linear'});
  app.renderer.render({container: box, target: rt, clear: true});
  box.destroy({children: true});
  return rt;
}

// the 'you are here' pin: a sun-yellow drop with an ink outline and a cream dot, a 'You' tag above it
function makePin() {
  const pin = new Container({label: 'You are here'});
  const arrow=new Graphics().poly([-18,-9,3,-9,3,-18,23,0,3,18,3,9,-18,9]).fill(PALETTE.sun).stroke({color:PALETTE.ink,width:3,join:'round'});
  const tag=new Text({text:'Your island',style:{fontFamily:'ui-rounded, system-ui, sans-serif',fontSize:13,fontWeight:'700',fill:PALETTE.ink}});
  tag.anchor.set(.5);
  const label=new Container();
  label.addChild(new Graphics().roundRect(-49,-12,98,24,12).fill(PALETTE.cream).stroke({color:PALETTE.ink,width:2}),tag);
  label.y=38;
  pin.addChild(arrow,label);pin.body=arrow;
  return pin;
}

export function createWorldView(app, scene) {
  let rt = RenderTexture.create({width: 2, height: 2, resolution: Math.min(app.renderer.resolution, 2)}), w = 0, h = 0, worldTex = null, worldVersion = -1;
  const geometry = new MeshGeometry({positions: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), indices: new Uint32Array([0, 1, 2, 0, 2, 3])});
  const blank = RenderTexture.create({width: 2, height: 2});
  const shader = new Shader({glProgram: GlProgram.from({vertex: VERTEX, fragment: FRAGMENT, name: 'ducky-world-view', preferredFragmentPrecision: 'highp'}), resources: {
    uScene: rt.source, uWorld: blank.source, viewUniforms: {
      uTime: {value: 0, type: 'f32'}, uZoom: {value: 1, type: 'f32'}, uR: {value: .43, type: 'f32'},
      uCam: {value: new Float32Array([0, 0]), type: 'vec2<f32>'}, uRes: {value: new Float32Array([1, 1]), type: 'vec2<f32>'},
      uBounds: {value: new Float32Array([0, 0, 1, 1]), type: 'vec4<f32>'}, uSpin: {value: new Float32Array([0, 0]), type: 'vec2<f32>'},
      uSea: {value: new Float32Array([0x6E / 255, 0xC9 / 255, 0xDE / 255]), type: 'vec3<f32>'},
      uLL: {value: new Float32Array([0, 0]), type: 'vec2<f32>'}, uSph: {value: new Float32Array([0, 0, 1]), type: 'vec3<f32>'},
    },
  }});
  const mesh = new Mesh({geometry, shader, label: 'World view'});
  mesh.visible = false;
  app.stage.addChildAt(mesh, app.stage.getChildIndex(scene) + 1);
  // boss 5 Nov (ref: Kaspersky cybermap): the world is busy. A Ducky doing something shows as a soft warm glow that
  // blooms and fades with one thin ring easing out; now and then a rounded heart pops up and drifts away.
  const life = new Container({label: 'Ducky activity'}), rings = new Graphics();
  const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 64;
  const gc = glowCanvas.getContext('2d'), grad = gc.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,240,190,1)'); grad.addColorStop(.35, 'rgba(255,214,90,.55)'); grad.addColorStop(1, 'rgba(255,214,90,0)');
  gc.fillStyle = grad; gc.fillRect(0, 0, 64, 64);
  const glowTex = Texture.from(glowCanvas);
  const heartG = new Graphics().svg('<svg viewBox="0 0 24 24"><path d="M12 21.3c-.4 0-.8-.1-1.1-.4C6.6 17.2 2.5 13.9 2.5 9.4 2.5 6.4 4.8 4 7.7 4c1.8 0 3.3.9 4.3 2.3C13 4.9 14.5 4 16.3 4c2.9 0 5.2 2.4 5.2 5.4 0 4.5-4.1 7.8-8.4 11.5-.3.3-.7.4-1.1.4z" fill="#FF6F8E"/></svg>');
  const heartTex = app.renderer.generateTexture({target: heartG, resolution: 4}); heartG.destroy();
  const glows = new Container(), hearts = new Container();
  life.addChild(glows, rings, hearts);
  const sprite = (pool, tex) => {const sp = pool.children.find(c => !c.visible) ?? pool.addChild(new Sprite(tex)); sp.anchor.set(.5); sp.visible = true; return sp;};
  const pin = makePin();
  app.stage.addChildAt(life, app.stage.getChildIndex(mesh) + 1);
  app.stage.addChildAt(pin, app.stage.getChildIndex(life) + 1);
  life.visible = pin.visible = false;
  const u = shader.resources.viewUniforms.uniforms;
  const ease = x => {x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x);};
  const out = x => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);   // ease-out: quick start, soft landing
  const pop = x => {x = Math.max(0, Math.min(1, x)); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);};   // small overshoot
  const wrap = (v, p) => v - p * Math.round(v / p);
  let seed = 7;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const ripples = [];
  let lastT = 0, rippleDue = 0, hover = false, hoverK = 1;
  return {
    pinIn: 0,   // 0..1, how far the 'You' pin has come in (engine.js fades the name tags out by the same amount)
    // t: 0 at the island, 1 fully zoomed out. cam: the camera's world point. me: where the player is (world units).
    update(t, width, height, time, cam, arch, worldSize, floorZoom, idle, me) {
      const on = t > .001;
      mesh.visible = on;
      if (!on) {
        scene.visible = true; life.visible = false; this.pinIn = 0; this.worldAt=null;
        const here=arch?.islands.find(i=>i.home);
        if(here) {
          const target={x:width/2+(here.x-cam.x)*cam.zoom,y:height/2+(here.y-cam.y)*cam.zoom,face:1};
          pin.visible=target.x<0||target.x>width||target.y<0||target.y>height;
          const guide=islandArrow(target,width,height);pin.position.set(guide.x,guide.y);pin.body.rotation=guide.angle;pin.alpha=1;pin.scale.set(1);
        } else pin.visible=false;
        return;
      }
      if (arch?.texture && (!worldTex || worldVersion !== arch.version)) {   // rebuilt when a themed island's snapshot arrives
        const old = worldTex; worldVersion = arch.version;
        worldTex = buildWorldTexture(app, arch.islands, arch.bounds, arch, worldSize);
        shader.resources.uWorld = worldTex.source;
        if (old) setTimeout(() => old.destroy(true), 0);   // unbound first, then freed (no 'destroyed while bound' warning)
      }
      if (width !== w || height !== h) {w = width; h = height; rt.resize(w, h); mesh.scale.set(w, h); shader.resources.uScene = rt.source;}
      if (t < .97) {scene.visible = true; app.renderer.render({container: scene, target: rt, clear: true}); this.liveCopies?.(rt);}   // the real islands round the camera (not needed once it is all globe)
      scene.visible = false;
      const b = arch.bounds, spanX = b.x1 - b.x0, spanY = b.y1 - b.y0;
      // boss 5 Nov: "actual 3D rotation". The globe is a real sphere the world wraps round exactly once, a fixed size in
      // world units, so its radius on screen follows the zoom: huge (flat) up close, a ball in space at the floor zoom.
      // Panning the camera turns the ball: east-west is longitude, north-south tilts it (stopped short of the poles).
      const Rw = spanX / (2 * Math.PI), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;   // the world wraps once round the ball
      const R = Rw * cam.zoom / h, Rp = R * h, ball = ease((4 - R) / 3) * (1 - ease((cam.zoom - .02) / .025));
      this.roll = 0;   // the idle turn moves the camera itself (engine.js), so nothing is ever offset from where it really is
      const lon0 = (cam.x + this.roll - cx) / Rw, lat0 = -(cam.y - cy) / Rw;
      u.uLL[0] = lon0; u.uLL[1] = lat0; u.uSph[0] = cx; u.uSph[1] = cy; u.uSph[2] = Rw;
      u.uR = R; u.uSpin[0] = this.roll; u.uSpin[1] = 0;
      u.uTime = time; u.uZoom = cam.zoom;
      u.uCam[0] = cam.x; u.uCam[1] = cam.y; u.uRes[0] = w; u.uRes[1] = h;
      u.uBounds[0] = b.x0; u.uBounds[1] = b.y0; u.uBounds[2] = spanX; u.uBounds[3] = spanY;
      // the shader's own mapping, screen offset -> world point, so the pin and hearts sit exactly where the shader draws
      const cl = Math.cos(lat0), sl = Math.sin(lat0);
      const gOf = (px, py) => {
        const len = Math.hypot(px, py), d = Math.min(len / Rp, 1), as = len > 0 ? Math.asin(d) * Rp / len : 1;
        const ax = cam.x + this.roll + (px + (px * as - px) * ball) / cam.zoom, ay = cam.y + (py + (py * as - py) * ball) / cam.zoom;
        const vx = px / Rp, vy = -py / Rp, vz = Math.sqrt(Math.max(0, 1 - d * d));
        const r1y = cl * vy + sl * vz, r1z = -sl * vy + cl * vz;
        const sx = cx + (lon0 + Math.atan2(vx, r1z)) * Rw, sy = cy - Math.asin(Math.max(-1, Math.min(1, r1y))) * Rw;
        const sxw = ax + wrap(sx - ax, spanX);   // same wrap as the shader
        return [ax + (sxw - ax) * ball, ay + (sy - ay) * ball];
      };
      this.worldAt=point=>gOf(point.x-w/2,point.y-h/2);
      this.globe = {w, h, Rp, Rw, ball, cl, sl, lat0, cameraY: cam.y};   // for grab-dragging (engine.js)
      // where a world point sits on screen: start from the sphere's answer, then a few Newton steps on the shader mapping
      const project = (x, y) => {
        const lon = wrap(x - cam.x - this.roll, spanX) / Rw, lat = -(y - cy) / Rw;
        const wx = Math.sin(lon) * Math.cos(lat), wy = Math.sin(lat), wz = Math.cos(lon) * Math.cos(lat);
        const vy = cl * wy - sl * wz, vz = sl * wy + cl * wz;
        if (ball > .5 && vz < 0) return {x: 0, y: 0, face: -1};   // round the back of the ball
        let px = wx * Rp * ball + (x - cam.x) * cam.zoom * (1 - ball), py = -vy * Rp * ball + (y - cam.y) * cam.zoom * (1 - ball);
        for (let it = 0; it < 4; it++) {
          const [gx, gy] = gOf(px, py), ex = wrap(x - gx, spanX), ey = y - gy;
          if (Math.abs(ex) + Math.abs(ey) < .5) break;
          const e = .5, [gx1, gy1] = gOf(px + e, py), [gx2, gy2] = gOf(px, py + e);
          const a = (gx1 - gx) / e, b = (gx2 - gx) / e, c = (gy1 - gy) / e, dd = (gy2 - gy) / e, det = a * dd - b * c;
          if (Math.abs(det) < 1e-12) break;
          px += (dd * ex - b * ey) / det; py += (-c * ex + a * ey) / det;
        }
        const d = Math.hypot(px, py) / Rp;
        return {x: w / 2 + px, y: h / 2 + py, face: ball > .5 ? Math.sqrt(Math.max(0, 1 - d * d)) : 1 - ball * d};
      };
      const islands = arch.islands, dt = Math.min(.1, Math.max(0, time - lastT)); lastT = time;
      const busy = ease((ball - .25) / .4);
      life.visible = busy > .01; life.alpha = busy;
      if (busy > .01) {
        const pick = () => {const i = islands[Math.floor(rand() * islands.length)], a = rand() * 6.283, r = rand() * .25 * worldSize.width * i.scale; return {x: i.x + Math.cos(a) * r, y: i.y + Math.sin(a) * r * .7};};
        for (rippleDue -= dt; rippleDue < 0; rippleDue += .035) ripples.push({...pick(), at: time, heart: rand() < .7, dur: 2 + rand() * .8});   // boss 5 Nov: the hearts are the 30,000 stars, so lots of them
        const px = Math.min(1.5, Math.max(1, Rp / 240));   // hearts and ripples stay a friendly size at every zoom   // sizes follow the globe
        for (const c of glows.children) c.visible = false;
        for (const c of hearts.children) c.visible = false;
        rings.clear();
        for (let i = ripples.length - 1; i >= 0; i--) {
          const r = ripples[i], age = (time - r.at) / r.dur;
          if (age >= 1) {ripples.splice(i, 1); continue;}
          const p = project(r.x, r.y);
          if (p.face < .08) continue;
          const f = ease(p.face / .3), sq = .45 + .55 * p.face;   // everything flattens toward the rim
          const fade = ease(age / .12) * (1 - ease((age - .35) / .65));
          const g = sprite(glows, glowTex);
          g.position.set(p.x, p.y); g.scale.set((.14 + out(age) * .18) * px, (.14 + out(age) * .18) * px * sq); g.alpha = fade * .85 * f;
          const k = out(age), rr = (2.5 + k * 11) * px;
          rings.ellipse(p.x, p.y, rr, rr * sq).stroke({color: 0xFFF3C4, width: 1.1 * px, alpha: (1 - k) * .55 * f});
          if (r.heart) {
            // the pop: a damped spring from nothing up past full size and back, a little tilt that settles, a burst of
            // four sparkles, then a slow rise that shrinks and fades away
            const sec = (time - r.at), spring = 1 - Math.exp(-sec * 9) * Math.cos(sec * 22);
            const hs = sprite(hearts, heartTex), lift = out((sec - .35) / 1.4), gone = ease((sec - 1.1) / .6);
            hs.position.set(p.x + Math.sin(sec * 4 + r.x) * 1.5 * px * lift, p.y - (8 + lift * 22) * px);
            hs.scale.set(Math.max(0, spring) * (1 - gone * .35) * .9 * px);
            hs.rotation = Math.exp(-sec * 7) * Math.sin(sec * 18) * .35;
            hs.alpha = (1 - gone) * f;
            const burst = ease(sec / .06) * (1 - ease((sec - .1) / .35));
            if (burst > .01) for (let n = 0; n < 4; n++) {
              const a = n * 1.571 + .785, d = (7 + out(sec / .45) * 9) * px;
              rings.circle(p.x + Math.cos(a) * d, p.y - 8 * px + Math.sin(a) * d, 1.6 * px).fill({color: 0xFF8FA6, alpha: burst * f});
            }
          }
        }
      } else ripples.length = 0;
      // the pin: the player's world point projected onto the globe the same way the shader bends the map
      this.pinIn = ease((t - .12) / .15);
      const here=arch.islands.find(i=>i.home);
      if (here) {
        const p=project(here.x,here.y);
        const lon=wrap(here.x-cam.x,spanX)/Rw,lat=-(here.y-cy)/Rw;
        // A point behind the globe still has a useful direction on its tangent plane.
        const direction={x:w/2+Math.sin(lon)*Rp,y:h/2-(cl*Math.sin(lat)-sl*Math.cos(lat)*Math.cos(lon))*Rp};
        const guide=islandArrow(p,w,h,direction);
        pin.position.set(guide.x,guide.y);pin.body.rotation=guide.angle;
        pin.visible=true;pin.alpha=1;pin.scale.set(1);
      } else pin.visible=false;
    },
    // boss 6 Nov: the 'You' pin is a button. Hit box covers the drop and the tag with room for a finger (at least 64 x 96 px).
    renderGuide() {if(pin.visible) app.renderer.render({container:pin,clear:false});},
    pinAt() {return false;},
    hoverPin(on) {hover = on;},
    pinPoint() {return pin.visible ? {x: pin.x, y: pin.y, alpha: pin.alpha, scale: pin.scale.x} : null;},   // QA readback
    // grab-drag on the ball: how far to move the camera so the spot under the finger stays under the finger
    grab(from, to, camera) {
      const g = this.globe;
      if (!g || g.ball < .3) return null;
      // Multiple input events can arrive before the next rendered frame. Use
      // the accumulated target latitude rather than the previous frame's tilt.
      const lat=camera ? g.lat0-(camera.y-g.cameraY)/g.Rw : g.lat0;
      const cl=Math.cos(lat), sl=Math.sin(lat);
      const at = p => {
        let px = p.x - g.w / 2, py = p.y - g.h / 2; const d = Math.hypot(px, py) / g.Rp;
        if (d > .97) {px *= .97 / d; py *= .97 / d;}
        const vx = px / g.Rp, vy = -py / g.Rp, vz = Math.sqrt(Math.max(0, 1 - (vx * vx + vy * vy)));
        return {lon: Math.atan2(vx, -sl * vy + cl * vz), lat: Math.asin(Math.max(-1, Math.min(1, cl * vy + sl * vz)))};
      };
      const a = at(from), b = at(to);
      const delta=a.lon-b.lon;
      return {dx: Math.atan2(Math.sin(delta),Math.cos(delta)) * g.Rw, dy: -(a.lat - b.lat) * g.Rw};
    },
    destroy() {mesh.destroy(); life.destroy({children: true}); glowTex.destroy(true); heartTex.destroy(true); pin.destroy({children: true}); shader.destroy(); rt.destroy(true); blank.destroy(true); worldTex?.destroy(true); geometry.destroy();},
  };
}
