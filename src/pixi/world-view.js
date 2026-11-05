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
uniform float uFlat;
uniform float uTime;
uniform float uAspect;
uniform float uHeight;
uniform vec2 uCam;
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
vec3 flatScene(vec2 uv) {
  vec4 c = texture(uScene, uv);
  return mix(uSea, c.rgb / max(c.a, .001), c.a);
}
// a pitched camera over an endless sea of islands: ray from the eye through the pixel, hit the sea plane
vec3 horizon(vec2 uv) {
  vec2 p = (uv - .5) * vec2(uAspect, 1.) * 2.;            // -aspect..aspect, -1..1, y down
  float pitch = mix(1.5708, .38, uTilt);                   // straight down -> looking out to the horizon
  float s = sin(pitch), c = cos(pitch), fov = .75;
  vec3 ray = vec3(p.x * fov, 0., 0.) + vec3(0., c, -s) + vec3(0., -s, -c) * (p.y * fov);   // right, forward, up(-y)
  ray.z -= dot(p, p) * .045 * uTilt;                       // the world curves away: a rounded horizon
  vec3 skyLow = vec3(.78, .93, 1.), skyHigh = vec3(.22, .52, .9);
  if (ray.z >= -.004) {
    float up = clamp(ray.z * 3.5, 0., 1.);
    vec3 sky = mix(skyLow, skyHigh, up);
    float cl = clouds(vec2(p.x * 1.6 + uTime * .015, ray.z * 14.), .52);
    return mix(sky, vec3(1.), cl * .9);
  }
  float t = uHeight / -ray.z;                              // distance to the sea along the ray
  vec2 g = uCam + vec2(ray.x, ray.y) * t;                  // ground point, in world-texture units
  vec3 col = world(g);
  float far = 1. - exp(-t * .55 / uHeight * .12);
  col = mix(col, skyLow, smoothstep(.15, 1., far) * .85);  // distance haze toward the horizon
  float low = clouds(g * 3. + vec2(uTime * .01, 0.), .62) * (1. - far);
  return mix(col, vec3(1.), low * .55 * uTilt);
}
// the planet: orthographic globe, the island map wrapped round it and spinning slowly, like Google Earth
vec3 planet(vec2 uv) {
  vec2 p = (uv - .5) * vec2(uAspect, 1.);
  float R = .43, r = length(p) / R;
  vec2 cell = floor(uv * vec2(uAspect, 1.) * 200.);
  float star = step(.9965, hash(cell)) * (.55 + .45 * sin(uTime * 2. + hash(cell + 7.) * 6.28));
  vec3 space = mix(vec3(.03, .06, .17), vec3(.08, .13, .32), uv.y) + star;
  float halo = exp(-max(r - 1., 0.) * 6.) * step(1., r);
  space = mix(space, vec3(.45, .8, 1.), halo * .75);
  if (r >= 1.) return space;
  vec3 n = vec3(p.x / R, -p.y / R, sqrt(1. - r * r));
  float tiltAxis = .32, ca = cos(tiltAxis), sa = sin(tiltAxis);   // axis leaned toward us a little
  n = vec3(n.x, n.y * ca - n.z * sa, n.y * sa + n.z * ca);
  float lon = atan(n.x, n.z) + uTime * .06, lat = asin(clamp(n.y, -1., 1.));
  vec3 col = world(vec2(lon / 6.2831853 + .5, .5 - lat / 3.1415927));
  float cl = clouds(vec2(lon * 2.2, lat * 3.) + vec2(uTime * .03, 0.), .64);
  col = mix(col, vec3(1.), cl * .75);
  vec3 sn = vec3(p.x / R, -p.y / R, sqrt(1. - r * r));
  float light = clamp(dot(sn, normalize(vec3(-.45, .5, .75))), 0., 1.);
  col *= .5 + .6 * light;
  col = mix(col, vec3(.6, .88, 1.), pow(1. - sn.z, 2.4) * .75);   // blue atmosphere at the rim
  return col;
}
void main() {
  vec3 col = horizon(vUV);
  if (uFlat > 0.) col = mix(col, flatScene(vUV), uFlat);
  if (uPlanet > 0.) col = mix(col, planet(vUV), uPlanet);
  finalColor = vec4(col, 1.);
}`;

// The world texture: every island of the archipelago drawn big on a map that wraps left-right (for the spinning globe)
// and repeats both ways (for the endless sea under the horizon view).
function buildWorldTexture(app, islands, bounds, islandTexture, worldSize) {
  const W = 4096, H = 2048, span = {x: bounds.x1 - bounds.x0, y: bounds.y1 - bounds.y0};
  const box = new Container(), BIG = 1.6;   // islands drawn bigger than the map spacing so the world reads full
  for (const island of islands) for (const dx of [-W, 0, W]) {
    const s = new Sprite(islandTexture);
    s.anchor.set(.5);
    s.position.set((island.x - bounds.x0) / span.x * W + dx, (island.y - bounds.y0) / span.y * H);
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
      uTilt: {value: 0, type: 'f32'}, uPlanet: {value: 0, type: 'f32'}, uFlat: {value: 1, type: 'f32'}, uTime: {value: 0, type: 'f32'},
      uAspect: {value: 1, type: 'f32'}, uHeight: {value: 1, type: 'f32'}, uCam: {value: new Float32Array([.5, .5]), type: 'vec2<f32>'},
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
      if (!worldTex && arch?.texture) {worldTex = buildWorldTexture(app, arch.islands, arch.bounds, arch.texture, worldSize); shader.resources.uWorld = worldTex.source;}
      if (width !== w || height !== h) {w = width; h = height; rt.resize(w, h); mesh.scale.set(w, h); shader.resources.uScene = rt.source;}
      const flat = 1 - ease(t / .12);   // the real island scene for the first moment, then the 3D view takes over
      if (flat > 0) {scene.visible = true; app.renderer.render({container: scene, target: rt, clear: true});}
      scene.visible = false;
      const b = arch.bounds;
      u.uTilt = ease((t - .04) / .5); u.uPlanet = ease((t - .78) / .2); u.uFlat = flat; u.uTime = time; u.uAspect = w / h;
      u.uHeight = .004 + Math.pow(t, 1.6) * .14;               // the camera climbs as you zoom out (world-texture units)
      u.uCam[0] = (cam.x - b.x0) / (b.x1 - b.x0); u.uCam[1] = (cam.y - b.y0) / (b.y1 - b.y0) + u.uHeight * 1.2;   // look ahead of where you are
    },
    destroy() {mesh.destroy(); shader.destroy(); rt.destroy(true); blank.destroy(true); worldTex?.destroy(true); geometry.destroy();},
  };
}
