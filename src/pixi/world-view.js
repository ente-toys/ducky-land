// boss 5 Nov: the zoom-out story (storyboards V4 + V1, "like Google Earth"). Zooming out past the home island the camera
// pitches up: a sea full of islands runs out to a curved horizon with sky and clouds, the world repeating so there are
// always lots of islands in view. Zoom out all the way and it becomes our planet, covered in big islands and spinning.
// One world texture (every island drawn big on a wrapping map) feeds both; this screen quad does the 3D in a shader.
import {Container, GlProgram, Mesh, MeshGeometry, RenderTexture, Shader, Sprite} from 'pixi.js';

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
uniform float uTilt;
uniform float uPlanet;
uniform float uTime;
uniform float uAspect;
uniform vec2 uCam;      // camera point, world units
uniform float uZoom;    // flat-view zoom (screen px per world unit)
uniform vec2 uRes;      // screen size, px
uniform vec4 uBounds;   // world map x0, y0, width, height (world units)
uniform float uR;       // planet radius as a share of the screen height
uniform vec2 uSpin;     // world-units offset the globe has rolled by
uniform vec3 uSea;
float hash(vec2 p) {return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
}
float clouds(vec2 p, float lo) {return smoothstep(lo, lo + .2, noise(p) * .62 + noise(p * 2.4) * .38);}
vec3 world(vec2 uv) {   // the wrapping island map; transparent = open sea
  vec4 c = texture(uWorld, fract(uv));
  return mix(uSea, c.rgb / max(c.a, .001), c.a);
}
// a pitched camera over an endless sea of islands. At pitch 90 it matches the flat game view pixel for pixel, so the tilt
// starts seamlessly; near the camera it samples the real rendered scene, farther out the world map of the same islands.
vec3 ground(vec2 g) {
  vec2 suv = ((g - uCam) * uZoom + uRes * .5) / uRes;
  vec3 far = world((g - uBounds.xy) / uBounds.zw);
  if (suv.x < 0. || suv.x > 1. || suv.y < 0. || suv.y > 1.) return far;
  vec4 c = texture(uScene, suv);
  vec3 nearCol = mix(uSea, c.rgb / max(c.a, .001), c.a);
  vec2 e = min(suv, 1. - suv);
  return mix(far, nearCol, smoothstep(0., .04, min(e.x, e.y)));   // soften the seam where the real scene ends
}
vec3 horizon(vec2 uv) {
  vec2 p = (uv - .5) * vec2(uAspect, 1.) * 2.;            // y down, -1..1 over the screen height
  float pitch = mix(1.5708, .42, uTilt), s = sin(pitch), c = cos(pitch), fov = .5;
  float h = uRes.y / (2. * uZoom * fov);                   // camera height so pitch 90 == the flat view
  float rf = c - p.y * fov * s, rz = -s - p.y * fov * c;   // forward and up parts of the ray (right part = p.x*fov)
  rz -= dot(p, p) * .05 * uTilt;                           // the world curves away: a rounded horizon
  vec3 skyLow = vec3(.78, .93, 1.), skyHigh = vec3(.24, .54, .92);
  if (rz >= -.002) {
    float up = clamp(rz * 3., 0., 1.);
    vec3 sky = mix(skyLow, skyHigh, up);
    return mix(sky, vec3(1.), clouds(vec2(p.x * 1.4 + uTime * .012, rz * 12.), .55) * .85);
  }
  float t = h / -rz;
  vec2 g = uCam + vec2(p.x * fov * t, -(rf * t - h * c / s));   // world point under this pixel
  vec3 col = ground(g);
  float dist = t / h;                                      // 1 straight below, grows toward the horizon
  col = mix(col, skyLow, smoothstep(2.5, 14., dist) * .8 * uTilt);   // haze
  return col;
}
// the planet: the same flat world bent onto a globe. With a huge radius it IS the flat view; as the radius shrinks the
// edges curl away and space shows round it, so the pull-out into space is one continuous move. It rolls slowly (spin).
vec3 planet(vec2 uv) {
  vec2 px = (uv - .5) * uRes;
  float Rp = uR * uRes.y, d = length(px) / Rp;
  vec2 cell = floor(uv * uRes / 4.);
  float star = step(.9965, hash(cell)) * (.55 + .45 * sin(uTime * 2. + hash(cell + 7.) * 6.28));
  vec3 space = mix(vec3(.03, .06, .17), vec3(.08, .13, .32), uv.y) + star;
  space = mix(space, vec3(.45, .8, 1.), exp(-max(d - 1., 0.) * 6.) * step(1., d) * .75);
  if (d >= 1.) return space;
  vec2 g = uCam + uSpin + (d > 0. ? px / length(px) : vec2(0.)) * asin(d) * Rp / uZoom;   // near the middle: the flat view, unchanged
  vec3 col = ground(g);
  float z = sqrt(1. - d * d);
  vec3 n = vec3(px / Rp * vec2(1., -1.), z);
  float light = clamp(dot(n, normalize(vec3(-.45, .5, .75))), 0., 1.);
  float ball = smoothstep(4., 1., uR);                    // shading and rim only once it reads as a ball
  col *= mix(1., .5 + .6 * light, ball);
  col = mix(col, vec3(1.), clouds(g / uBounds.zw * 7. + vec2(uTime * .02, 0.), .66) * .7 * ball);
  return mix(col, vec3(.6, .88, 1.), pow(1. - z, 2.4) * .75 * ball);   // blue atmosphere at the rim
}
void main() {
  vec3 col = uPlanet > .5 ? planet(vUV) : horizon(vUV);
  finalColor = vec4(col, 1.);
}`;

// The world texture: every island of the archipelago drawn big on a map that wraps left-right (for the spinning globe)
// and repeats both ways (for the endless sea under the horizon view).
function buildWorldTexture(app, islands, bounds, islandTexture, worldSize, BIG = 1, reps = 1) {
  const W = 4096, H = 2048, span = {x: (bounds.x1 - bounds.x0) * reps, y: (bounds.y1 - bounds.y0) * reps};   // reps: the world tiled reps x reps
  const box = new Container();
  for (let rx = 0; rx < reps; rx++) for (let ry = 0; ry < reps; ry++) for (const island of islands) for (const dx of [-W, 0, W]) {
    const s = new Sprite(islandTexture), ox = rx * (bounds.x1 - bounds.x0), oy = ry * (bounds.y1 - bounds.y0);
    s.anchor.set(.5);
    s.position.set((island.x - bounds.x0 + ox) / span.x * W + dx, (island.y - bounds.y0 + oy) / span.y * H);
    s.width = worldSize.width * island.scale * BIG * W / span.x; s.height = worldSize.height * island.scale * BIG * H / span.y;
    s.scale.x *= island.flip; s.rotation = island.rot;
    box.addChild(s);
  }
  const rt = RenderTexture.create({width: W, height: H, addressMode: 'repeat', scaleMode: 'linear'});
  app.renderer.render({container: box, target: rt, clear: true});
  box.destroy({children: true});
  return rt;
}

export function createWorldView(app, scene) {
  let rt = RenderTexture.create({width: 2, height: 2}), w = 0, h = 0, worldTex = null;
  const geometry = new MeshGeometry({positions: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), indices: new Uint32Array([0, 1, 2, 0, 2, 3])});
  const blank = RenderTexture.create({width: 2, height: 2});
  const shader = new Shader({glProgram: GlProgram.from({vertex: VERTEX, fragment: FRAGMENT, name: 'ducky-world-view', preferredFragmentPrecision: 'highp'}), resources: {
    uScene: rt.source, uWorld: blank.source, viewUniforms: {
      uTilt: {value: 0, type: 'f32'}, uPlanet: {value: 0, type: 'f32'}, uTime: {value: 0, type: 'f32'},
      uAspect: {value: 1, type: 'f32'}, uZoom: {value: 1, type: 'f32'}, uR: {value: .43, type: 'f32'},
      uCam: {value: new Float32Array([0, 0]), type: 'vec2<f32>'}, uRes: {value: new Float32Array([1, 1]), type: 'vec2<f32>'},
      uBounds: {value: new Float32Array([0, 0, 1, 1]), type: 'vec4<f32>'}, uSpin: {value: new Float32Array([0, 0]), type: 'vec2<f32>'},
      uSea: {value: new Float32Array([0x6E / 255, 0xC9 / 255, 0xDE / 255]), type: 'vec3<f32>'},
    },
  }});
  const mesh = new Mesh({geometry, shader, label: 'World view'});
  mesh.visible = false;
  app.stage.addChildAt(mesh, app.stage.getChildIndex(scene) + 1);
  const u = shader.resources.viewUniforms.uniforms;
  const ease = x => {x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x);};
  return {
    // t: 0 at the island, 1 fully zoomed out. cam: the camera's world point. archipelago: islands, bounds and texture.
    update(t, width, height, time, cam, arch, worldSize) {
      const on = t > .001;
      mesh.visible = on;
      if (!on) {scene.visible = true; return;}
      if (!worldTex && arch?.texture) {
        worldTex = buildWorldTexture(app, arch.islands, arch.bounds, arch.texture, worldSize, 1);     // true positions and sizes
        shader.resources.uWorld = worldTex.source;
      }
      if (width !== w || height !== h) {w = width; h = height; rt.resize(w, h); mesh.scale.set(w, h); shader.resources.uScene = rt.source;}
      scene.visible = true; app.renderer.render({container: scene, target: rt, clear: true}); scene.visible = false;   // the real islands round the camera
      const b = arch.bounds;
      // tilt up to the horizon, hold, then tip back to straight down as you climb; then the flat world curls into the globe
      u.uTilt = ease(t / .3) * (1 - ease((t - .48) / .2));
      const p = ease((t - .68) / .3);
      u.uPlanet = t > .68 ? 1 : 0; u.uR = 8 * Math.pow(.43 / 8, p);   // radius 8 screens (flat) down to .43 (a ball in space)
      const spin = ease((t - .85) / .15); this.roll = (this.roll || 0) + spin * .016 * (b.x1 - b.x0) / 60;
      u.uSpin[0] = this.roll; u.uSpin[1] = 0;
      u.uTime = time; u.uAspect = w / h; u.uZoom = cam.zoom;
      u.uCam[0] = cam.x; u.uCam[1] = cam.y; u.uRes[0] = w; u.uRes[1] = h;
      u.uBounds[0] = b.x0; u.uBounds[1] = b.y0; u.uBounds[2] = b.x1 - b.x0; u.uBounds[3] = b.y1 - b.y0;
    },
    destroy() {mesh.destroy(); shader.destroy(); rt.destroy(true); blank.destroy(true); worldTex?.destroy(true); geometry.destroy();},
  };
}
