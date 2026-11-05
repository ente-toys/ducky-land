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
float landAt(vec2 g) {return texture(uWorld, fract((g - uBounds.xy) / uBounds.zw)).a;}
float cloudCover(vec2 q) {   // crisp cartoon clouds: hard-edged puffs, not fog
  float n = noise(q) * .6 + noise(q * 2.1 + 3.7) * .3 + noise(q * 5.3) * .1;
  return smoothstep(.66, .69, n);
}
vec3 planet(vec2 uv) {
  vec2 px = (uv - .5) * uRes;
  float Rp = uR * uRes.y, d = length(px) / Rp;
  float ball = smoothstep(4., 1., uR);                     // space, light and clouds only once it reads as a ball
  // space: deep navy with a faint nebula and fine twinkling stars
  vec2 sp = uv * uRes;
  vec3 space = mix(vec3(.02, .04, .12), vec3(.06, .09, .24), uv.y);
  space += vec3(.12, .08, .2) * smoothstep(.55, 1., noise(uv * 3. + 11.)) * .35;
  float st = hash(floor(sp / 2.)), tw = .5 + .5 * sin(uTime * 1.7 + st * 40.);
  space += vec3(.9, .95, 1.) * step(.9975, st) * tw + vec3(.6, .7, 1.) * step(.9992, hash(floor(sp / 3.) + 5.)) * .8;
  float halo = exp(-max(d - 1., 0.) * 9.);                 // atmosphere glow hugging the rim
  space = mix(space, vec3(.42, .78, 1.), halo * step(1., d) * .85 * ball);
  if (d >= 1.) return mix(ground(uCam + px / uZoom), space, ball);
  vec2 dir = d > 0. ? px / length(px) : vec2(0.);
  vec2 g = uCam + uSpin + dir * asin(d) * Rp / uZoom;     // near the middle: the flat view, unchanged
  vec3 col = ground(g);
  if (ball > 0.) {
    float scale = uBounds.z / 260.;                        // ~ an island's width in world units
    float land = landAt(g), near = 0.;
    for (int i = 0; i < 8; i++) {float a = float(i) * .785; near = max(near, landAt(g + vec2(cos(a), sin(a)) * scale * 2.2));}
    vec3 deep = vec3(.09, .36, .62), shallow = vec3(.52, .9, .93);
    vec3 sea = mix(deep, shallow, smoothstep(0., 1., near) * .85);
    col = mix(col, mix(sea, col, land), ball);             // rich sea with turquoise shallows round the islands
    // light: sun from the upper left, soft terminator, ocean glint, cloud shadows
    float z = sqrt(1. - d * d);
    vec3 n = vec3(px.x / Rp, -px.y / Rp, z), L = normalize(vec3(-.55, .45, .7));
    float diff = clamp(dot(n, L) * .75 + .35, 0., 1.);
    vec2 cq = g / uBounds.zw * 11. + vec2(uTime * .015, 0.);
    float cloud = cloudCover(cq), shade = cloudCover(cq + vec2(.06, -.05));
    col *= mix(1., .78, shade * (1. - cloud) * ball);
    float glint = pow(clamp(dot(reflect(-L, n), vec3(0., 0., 1.)), 0., 1.), 60.) * (1. - land);
    col = col * mix(1., .35 + .75 * diff, ball) + glint * .55 * ball;
    col = mix(col, vec3(1.) * (.55 + .5 * diff), cloud * .92 * ball);
    float rim = pow(1. - z, 2.2);
    col = mix(col, vec3(.55, .85, 1.), rim * .8 * ball);   // the atmosphere thickens at the edge
  }
  return col;
}
void main() {
  vec3 col = planet(vUV);   // boss 5 Nov: Google Earth style, straight down, the flat world curling into the globe
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
    update(t, width, height, time, cam, arch, worldSize, floorZoom, idle) {
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
      // the globe is a fixed size in world units, so its radius on screen follows the zoom exactly: huge (flat) up close,
      // a ball in space at the floor zoom. One continuous move, like Google Earth.
      u.uTilt = 0; u.uPlanet = 1; u.uR = .43 * cam.zoom / floorZoom;
      this.roll = (this.roll || 0) + (idle ? ease((t - .9) / .1) * (b.x1 - b.x0) / 3600 : 0);   // turns slowly when left alone
      u.uSpin[0] = this.roll; u.uSpin[1] = 0;
      u.uTime = time; u.uAspect = w / h; u.uZoom = cam.zoom;
      u.uCam[0] = cam.x; u.uCam[1] = cam.y; u.uRes[0] = w; u.uRes[1] = h;
      u.uBounds[0] = b.x0; u.uBounds[1] = b.y0; u.uBounds[2] = b.x1 - b.x0; u.uBounds[3] = b.y1 - b.y0;
    },
    destroy() {mesh.destroy(); shader.destroy(); rt.destroy(true); blank.destroy(true); worldTex?.destroy(true); geometry.destroy();},
  };
}
