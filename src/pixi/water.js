// boss 4 Nov: real damped height fields, bank reflections and interpolated GPU light, in the island's flat palette.
// RG/BA pack previous/current signed heights into ordinary RGBA8. No float textures, readbacks, filters or render targets.
import {BufferImageSource, Container, GlProgram, Graphics, Mesh, MeshGeometry, Shader} from 'pixi.js';
import {PALETTE} from './palette.js';
import {TILT} from './camera.js';
import {COAST_SURF} from './surf.js';

export const WATER_STEP = 1 / 60;
const LIMIT = 4, clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const rgb = n => new Float32Array([n >> 16 & 255, n >> 8 & 255, n & 255].map(v => v / 255));

// Renderer-independent solver, also used by qa/water.test.mjs. Dry neighbours mirror the wet cell (zero normal flux).
export function createWaveField({width, height, cols, rows, wet, damping = .991, open = false}) {
  const count = cols * rows, active = [], neighbours = new Int32Array(count * 4), distance = new Float32Array(count);
  const dx = width / (cols - 1), dy = height / (rows - 1), speed = Math.min(dx, dy) * .47;
  const cx = (speed / dx) ** 2, cy = (speed / dy) ** 2;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = y * cols + x;
    if (!wet[i]) continue;
    active.push(i); distance[i] = 1e6;
    for (const [k, j] of [x ? i - 1 : -1, x < cols - 1 ? i + 1 : -1, y ? i - cols : -1, y < rows - 1 ? i + cols : -1].entries()) {
      neighbours[i * 4 + k] = j >= 0 && wet[j] ? j : i;
      if (j >= 0 && !wet[j]) distance[i] = Math.min(distance[i], k < 2 ? dx / 2 : dy / 2);
    }
  }
  // Two chamfer sweeps measure the real bank, including every islet. Used by the shore foam shader.
  for (let pass = 0; pass < 2; pass++) for (let k = 0; k < count; k++) {
    const i = pass ? count - k - 1 : k, x = i % cols, y = Math.floor(i / cols);
    if (!wet[i]) continue;
    for (const [j, d] of [[x ? i - 1 : -1, dx], [x < cols - 1 ? i + 1 : -1, dx], [y ? i - cols : -1, dy], [y < rows - 1 ? i + cols : -1, dy]]) {
      if (j >= 0 && wet[j]) distance[i] = Math.min(distance[i], distance[j] + d);
    }
  }
  let previous = new Float32Array(count), current = new Float32Array(count), next = new Float32Array(count), steps = 0;
  const kicks = new Float32Array(count);
  const packed = new Uint8Array(count * 4), indices = new Int32Array(active);
  function impulse(x, y, strength = .5, radius = 2) {
    if (![x, y, strength, radius].every(Number.isFinite)) return false;
    const gx = x / dx, gy = y / dy, rx = Math.max(1.3, radius / dx), ry = Math.max(1.3, radius / dy);
    let hit = false;
    for (let y0 = Math.max(0, Math.floor(gy - ry)); y0 <= Math.min(rows - 1, Math.ceil(gy + ry)); y0++) {
      for (let x0 = Math.max(0, Math.floor(gx - rx)); x0 <= Math.min(cols - 1, Math.ceil(gx + rx)); x0++) {
        const i = y0 * cols + x0, d = ((x0 - gx) / rx) ** 2 + ((y0 - gy) / ry) ** 2;
        if (!wet[i] || d >= 1) continue;
        // Queue the force for the NEXT fixed step. An event cannot rewrite an already interpolated frame.
        kicks[i] = clamp(kicks[i] + clamp(strength, -1.5, 1.5) * (1 - d) ** 2 * (1 - 4 * d), -1.5, 1.5); hit = true;
      }
    }
    return hit;
  }
  function step() {
    for (let k = 0; k < indices.length; k++) {
      const i = indices[k], h = current[i], n = i * 4;
      let value = h + (h - previous[i]) * damping + cx * (current[neighbours[n]] + current[neighbours[n + 1]] - 2 * h)
        + cy * (current[neighbours[n + 2]] + current[neighbours[n + 3]] - 2 * h) - h * .0002 + kicks[i];
      kicks[i] = 0;
      // Absorb at the edge of the open sea, reflect at the coast. Closed pools have reflective outer boundaries.
      if (open) {
        const x = i % cols, y = (i / cols) | 0, edge = Math.min(x, y, cols - 1 - x, rows - 1 - y);
        if (edge < 8) value *= .88 + edge * .014;
      }
      next[i] = clamp(value, -LIMIT, LIMIT);
    }
    const old = previous; previous = current; current = next; next = old; steps++;
  }
  function pack() {
    for (let i = 0; i < count; i++) {
      const a = Math.round((previous[i] / (2 * LIMIT) + .5) * 65535), b = Math.round((current[i] / (2 * LIMIT) + .5) * 65535), k = i * 4;
      packed[k] = a >> 8; packed[k + 1] = a & 255; packed[k + 2] = b >> 8; packed[k + 3] = b & 255;
    }
    return packed;
  }
  return {cols, rows, dx, dy, wet, distance, indices, packed, impulse, step, pack,
    clear() {previous.fill(0); current.fill(0); next.fill(0); kicks.fill(0);},
    get current() {return current;}, get previous() {return previous;}, get steps() {return steps;}};
}

// boss 5 Nov: shared, interpolated sampling keeps plants attached to the displayed wave.
export function waveHeight(f, x, y, mix = 1) {
  if (!Number.isFinite(x + y) || x < 0 || y < 0 || x > f.dx * (f.cols - 1) || y > f.dy * (f.rows - 1)) return 0;
  const gx = x / f.dx, gy = y / f.dy, ix = Math.floor(gx), iy = Math.floor(gy), u = gx - ix, v = gy - iy;
  const h = (x, y) => {const i = Math.min(y, f.rows - 1) * f.cols + Math.min(x, f.cols - 1); return f.previous[i] * (1 - mix) + f.current[i] * mix;};
  return (h(ix, iy) * (1 - u) + h(ix + 1, iy) * u) * (1 - v) + (h(ix, iy + 1) * (1 - u) + h(ix + 1, iy + 1) * u) * v;
}
// boss 5 Nov: bounded ambient sources run on simulation time, with no catch-up burst offscreen.
export function inlandLife(field, time, tick, emit) {
  const ids = field.indices; if (!ids.length) return;
  if (tick % 18 === 0) for (let k = 0; k < 3; k++) {
    const i = ids[(Math.floor(tick / 18) * 37 + k * 193) % ids.length];
    emit(i % field.cols * field.dx, Math.floor(i / field.cols) * field.dy, Math.sin(time * .7 + k * 2) * .025, 28);
  }
  if (tick % 313 === 97) {
    const i = ids[(Math.floor(tick / 313) * 997 + 271) % ids.length];
    emit(i % field.cols * field.dx, Math.floor(i / field.cols) * field.dy, .24, 14);
  }
}

const VERTEX = `
#version 300 es
precision highp sampler2D;
in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
out vec3 vLight;
out float vHeight;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform sampler2D uField;
uniform vec2 uTexel;
uniform vec2 uSize;
uniform vec2 uOrigin;
uniform vec3 uWater;
uniform vec3 uCream;
uniform vec3 uInk;
uniform float uMix;
uniform float uTime;
uniform float uCalm;
uniform float uSea;
uniform float uInland;
float heightAt(vec2 uv) {
  vec4 f = texture(uField, clamp(uv, vec2(0.), vec2(1.)) * (1. - uTexel) + uTexel * .5);
  return (mix(dot(f.rg, vec2(65280., 255.)), dot(f.ba, vec2(65280., 255.)), uMix) / 65535. - .5) * 8.;
}
void main() {
  vUV = aUV;
  vec2 p = uOrigin + aUV * uSize;
  float h = heightAt(aUV);
  vec2 gradient = vec2(heightAt(aUV + vec2(uTexel.x, 0.)) - heightAt(aUV - vec2(uTexel.x, 0.)),
    heightAt(aUV + vec2(0., uTexel.y)) - heightAt(aUV - vec2(0., uTexel.y)));
  float inside = step(0., aUV.x) * step(aUV.x, 1.) * step(0., aUV.y) * step(aUV.y, 1.);
  gradient *= mix(1., inside, uSea);
  float motion = 1. - uCalm;
  float a = dot(p, vec2(.009, .013)) - uTime * .67;
  float b = dot(p, vec2(-.016, .007)) - uTime * .43;
  float swell = (sin(a) * .6 + sin(b) * .4) * motion;
  vec3 normal = normalize(vec3(-gradient.x * 3.8 + cos(a) * .1 * motion, -gradient.y * 3.8 + cos(b) * .08 * motion, 1.));
  float light = dot(normal, normalize(vec3(-.4, -.65, 1.)));
  float bands = smoothstep(-.7, .8, swell + h * .35);
  vec3 color = mix(uWater, mix(uWater, uInk, .17), .10 + .24 * bands);
  color = mix(color, uCream, max(0., light - .80) * 1.1);
  // Light is evaluated once per grid vertex, then smoothly interpolated. Retina pixels only sample the mask.
  float caustic = sin(p.x * .032 + sin(p.y * .018 - uTime * .22) + h * .8)
    + sin(p.y * .037 - p.x * .009 + uTime * .18 + h * .65);
  color = mix(color, uCream, smoothstep(1.65, 1.95, caustic) * (.035 + .045 * motion));
  color = mix(color, uCream, smoothstep(.08, .5, length(gradient)) * .24 * motion);
  vLight = color; vHeight = h;
  gl_Position = vec4((uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix * vec3(aPosition, 1.)).xy, 0., 1.);
}`;
const FRAGMENT = `
#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUV;
in vec3 vLight;
in float vHeight;
out vec4 finalColor;
uniform sampler2D uMask;
uniform vec2 uSize;
uniform vec2 uOrigin;
uniform vec3 uWater;
uniform vec3 uCream;
uniform vec4 uColor;
uniform float uTime;
uniform float uCalm;
uniform float uSea;
uniform float uInland;
${COAST_SURF}
void main() {
  vec4 mask = texture(uMask, clamp(vUV, vec2(0.), vec2(1.)));
  float inside = step(0., vUV.x) * step(vUV.x, 1.) * step(0., vUV.y) * step(vUV.y, 1.);
  float coverage = mix(mask.r, mix(1., mask.r, inside), uSea);
  if (coverage < .008 && (uSea < .5 || mask.b < .004 || mask.a < .5)) discard;
  vec3 color = vLight;
  if (uSea > .5) {
    // boss 5 Nov: coast-wide flat surf, including a sand-only retreating wet band.
    vec2 p = uOrigin + vUV * uSize;
    float d = mask.r > .5 ? mask.g * 240. : -mask.b * 240.;
    vec3 surf = coastSurf(p, d, uTime, uCalm);
    color = d < 85. ? mix(uWater, uCream, .19) : uWater;
    if (d < 0.) {color = vec3(.76, .65, .36); coverage = surf.y * .26 * mask.a;}
    if (d > 0. && d < 140. && vHeight > .025 && vHeight < .042 && uCalm < .5) color = uCream;
    if (surf.x > .5) {color = uCream; coverage = max(coverage, .88 * mask.a);}
    if (uCalm > .5 && d < 0.) coverage = 0.;

  }
  // boss 5 Nov: inland water uses crisp flat marks, never interpolated lighting or ocean foam.
  if (uInland > .5) {
    vec2 p = uOrigin + vUV * uSize;
    vec3 hi = mix(uWater, vec3(1.), .38);
    float depth = mask.g * 240.;
    color = depth < 24. ? mix(uWater, vec3(1.), .18) : depth > 100. ? mix(uWater, vec3(.20,.48,.56), .24) : uWater;
    // boss 5 Nov: broad broken caustic threads, coloured flat rather than shaded.
    float weave = sin(p.x * .034 + sin(p.y * .023 + uTime * .18)) + sin(p.y * .041 - p.x * .012 - uTime * .23);
    if (weave > 1.35 && weave < 1.52 && uCalm < .5) color = mix(color, hi, .48);
    // Bridge and rooted reeds reflect as separated wavy strips below the drawing.
    float bend = sin(p.y * .13 + uTime * 1.1) * 5. * (1. - uCalm);
    float bridgeU = clamp((p.x - 1188.) / 904., 0., 1.);
    float bridgeY = 2670. - 88. * 4. * bridgeU * (1. - bridgeU);
    bool bridge = p.x > 1198. + bend && p.x < 2082. + bend && p.y > bridgeY && p.y < bridgeY + 52.;
    bool reeds = (p.x > 3675. + bend && p.x < 3740. + bend && p.y > 1650. && p.y < 1690.) || (p.x > 4570. + bend && p.x < 4615. + bend && p.y > 1630. && p.y < 1665.);
    if ((bridge || reeds) && mod(p.y + bend * .3, 13.) < 4.) color = bridge ? vec3(.36,.56,.51) : vec3(.36,.60,.42);
    float lap = 3. + (sin(uTime * .8 + p.x * .013 + p.y * .009) + vHeight) * (1. - uCalm);
    if (mask.g * 240. < lap) color = hi;
    vec2 dash = mod(p + vec2(-uTime * 7., sin(uTime * .6 + p.x * .012) * 3. + vHeight * 8.), vec2(113., 79.));
    bool glint = dash.x < 18. && abs(dash.y - 39.) < 1.4;
    bool crest = vHeight > .025 && vHeight < .045;
    if ((glint || crest) && uCalm < .5) color = hi;
  }
  float alpha = coverage * (uInland > .5 ? 1. : mix(.46, 1., uSea));
  finalColor = vec4(color * alpha, alpha) * uColor;
}`;

const textCache = new Map();
function svgText(src) {
  if (!textCache.has(src)) textCache.set(src, fetch(src).then(r => {if (!r.ok) throw Error(`Water mask ${r.status}: ${src}`); return r.text();}));
  return textCache.get(src);
}
async function raster(src, rect, width, height, edit) {
  const doc = new DOMParser().parseFromString(await svgText(src), 'image/svg+xml'), svg = doc.documentElement;
  if (doc.querySelector('parsererror')) throw Error(`Invalid water art: ${src}`);
  svg.setAttribute('viewBox', `${rect.x} ${rect.y} ${rect.width} ${rect.height}`);
  svg.setAttribute('width', width); svg.setAttribute('height', height); edit?.(svg);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], {type: 'image/svg+xml'}));
  try {
    const image = new Image(); image.src = url; await image.decode(); return image;
  } finally {URL.revokeObjectURL(url);}
}
function canvas(width, height) {
  const c = document.createElement('canvas'); c.width = width; c.height = height;
  return [c, c.getContext('2d', {willReadFrequently: true})];
}
const isBlue = (r, g, b) => b > 130 && b > r * 1.3 && g > r * 1.2;
async function artMask(src, rect, width, height, edit, upper = false) {
  const [c, ctx] = canvas(width, height); ctx.drawImage(await raster(src, rect, width, height, edit), 0, 0);
  const pixels = ctx.getImageData(0, 0, width, height).data, mask = new Uint8Array(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    const yes = upper ? pixels[i] > 180 && pixels[i + 2] > 180 && pixels[i + 1] < 90 : isBlue(pixels[i], pixels[i + 1], pixels[i + 2]);
    mask[i] = yes ? pixels[i + 3] : 0; mask[i + 3] = 255;
  }
  c.width = c.height = 1;
  return {width, height, data: mask};
}
async function groundMask(tiles, rect, scale, sea = false) {
  const width = Math.ceil(rect.width * scale), height = Math.ceil(rect.height * scale), [c, ctx] = canvas(width, height);
  for (const tile of tiles) {
    const x = Math.max(rect.x, tile.x), y = Math.max(rect.y, tile.y), right = Math.min(rect.x + rect.width, tile.x + tile.width), bottom = Math.min(rect.y + rect.height, tile.y + tile.height);
    if (right <= x || bottom <= y) continue;
    const crop = {x, y, width: right - x, height: bottom - y}, w = Math.ceil(crop.width * scale), h = Math.ceil(crop.height * scale);
    ctx.drawImage(await raster(tile.src, crop, w, h), (x - rect.x) * scale, (y - rect.y) * scale, crop.width * scale, crop.height * scale);
  }
  const pixels = ctx.getImageData(0, 0, width, height).data, data = new Uint8Array(width * height * 4), wet = new Uint8Array(width * height);
  for (let i = 0; i < wet.length; i++) wet[i] = (sea && pixels[i * 4 + 3] < 128) || isBlue(pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2]) ? 1 : 0;
  // Keep only border-connected sea. Inland blue water must never get an ocean foam band.
  if (sea) {
    const queue = new Int32Array(wet.length), reached = new Uint8Array(wet.length); let start = 0, end = 0;
    const visit = i => {if (wet[i] && !reached[i]) {reached[i] = 1; queue[end++] = i;}};
    for (let x = 0; x < width; x++) {visit(x); visit((height - 1) * width + x);}
    for (let y = 0; y < height; y++) {visit(y * width); visit(y * width + width - 1);}
    while (start < end) {
      const i = queue[start++], x = i % width, y = (i / width) | 0;
      if (x) visit(i - 1); if (x < width - 1) visit(i + 1); if (y) visit(i - width); if (y < height - 1) visit(i + width);
    }
    wet.set(reached);
  }
  for (let i = 0; i < wet.length; i++) {data[i * 4] = wet[i] * 255; data[i * 4 + 3] = !sea || wet[i] || (pixels[i * 4] > 180 && pixels[i * 4 + 1] > 150 && pixels[i * 4 + 2] < pixels[i * 4 + 1] * .85) ? 255 : 0;}
  c.width = c.height = 1;
  return {width, height, data};
}
export function maskGrid(mask, cols, rows, shape) {
  const wet = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const u = x / (cols - 1), v = y / (rows - 1), i = (Math.round(v * (mask.height - 1)) * mask.width + Math.round(u * (mask.width - 1))) * 4;
    wet[y * cols + x] = shape ? Number(shape(u, v)) : Number(mask.data[i] > 100);
  }
  // Fill enclosed dry marks (old painted glints/reeds), while leaving the outer bank shape intact.
  const dry = new Uint8Array(wet.length), queue = new Int32Array(wet.length); let a = 0, b = 0;
  const visit = i => {if (!wet[i] && !dry[i]) {dry[i] = 1; queue[b++] = i;}};
  for (let x = 0; x < cols; x++) {visit(x); visit((rows - 1) * cols + x);}
  for (let y = 0; y < rows; y++) {visit(y * cols); visit(y * cols + cols - 1);}
  while (a < b) {
    const i = queue[a++], x = i % cols, y = (i / cols) | 0;
    if (x) visit(i - 1); if (x < cols - 1) visit(i + 1); if (y) visit(i - cols); if (y < rows - 1) visit(i + cols);
  }
  // The sea must retain enclosed islands as dry cells.
  if (!mask.sea && !shape) for (let i = 0; i < wet.length; i++) if (!dry[i]) wet[i] = 1;
  return wet;
}
function source(data, width, height) {
  return new BufferImageSource({resource: data, width, height, format: 'rgba8unorm', alphaMode: 'no-premultiply-alpha', scaleMode: 'linear', autoGenerateMipmaps: false, addressMode: 'clamp-to-edge'});
}
function waterGeometry(width, height, cols, rows, sea, wet) {
  // One vertex per simulated sample. A padded outer ring continues the sea beyond the world without repeating it.
  const nx = cols + (sea ? 2 : 0), ny = rows + (sea ? 2 : 0), positions = new Float32Array(nx * ny * 2), uvs = new Float32Array(positions.length);
  const indices = [];
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const px = sea && x === 0 ? -24000 : sea && x === nx - 1 ? width + 24000 : (x - Number(sea)) / (cols - 1) * width;
    const py = sea && y === 0 ? -24000 : sea && y === ny - 1 ? height + 24000 : (y - Number(sea)) / (rows - 1) * height;
    const i = (y * nx + x) * 2; positions[i] = px; positions[i + 1] = py; uvs[i] = px / width; uvs[i + 1] = py / height;
    if (x === nx - 1 || y === ny - 1) continue;
    const gx = x - Number(sea), gy = y - Number(sea), i0 = gy * cols + gx;
    if (!sea && gx >= 0 && gy >= 0 && gx < cols - 1 && gy < rows - 1 && !wet[i0] && !wet[i0 + 1] && !wet[i0 + cols] && !wet[i0 + cols + 1]) continue;
    const a = y * nx + x;
    indices.push(a, a + 1, a + nx, a + 1, a + nx + 1, a + nx);
  }
  return new MeshGeometry({positions, uvs, indices: new Uint32Array(indices)});
}
// High-resolution shore distance avoids grid-shaped foam when the camera is close to the coast.
export function shoreDistance(mask, worldWidth, worldHeight) {
  const {width, height, data} = mask, d = new Float32Array(width * height), dx = worldWidth / width, dy = worldHeight / height, diagonal = Math.hypot(dx, dy);
  for (let i = 0; i < d.length; i++) d[i] = data[i * 4] ? 1e6 : 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (!d[i]) continue;
    if (x) d[i] = Math.min(d[i], d[i - 1] + dx);
    if (y) {d[i] = Math.min(d[i], d[i - width] + dy); if (x) d[i] = Math.min(d[i], d[i - width - 1] + diagonal); if (x < width - 1) d[i] = Math.min(d[i], d[i - width + 1] + diagonal);}
  }
  for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) {
    const i = y * width + x;
    if (!d[i]) continue;
    if (x < width - 1) d[i] = Math.min(d[i], d[i + 1] + dx);
    if (y < height - 1) {d[i] = Math.min(d[i], d[i + width] + dy); if (x) d[i] = Math.min(d[i], d[i + width - 1] + diagonal); if (x < width - 1) d[i] = Math.min(d[i], d[i + width + 1] + diagonal);}
    data[i * 4 + 1] = Math.round(Math.min(1, d[i] / 240) * 255);
  }
}
// boss 5 Nov: dry-side distances reference only connected ocean, never inland blue.
export function coastDistance(mask, width, height) {
  shoreDistance(mask, width, height);
  const inverse = {width: mask.width, height: mask.height, data: new Uint8Array(mask.data.length)};
  for (let i = 0; i < mask.data.length; i += 4) inverse.data[i] = mask.data[i] ? 0 : 255;
  shoreDistance(inverse, width, height);
  for (let i = 0; i < mask.data.length; i += 4) mask.data[i + 2] = mask.data[i] ? 0 : inverse.data[i + 1];
}
function makeBody({id, rect, cols, rows, mask, parent, sea = false, shape, zIndex}) {
  mask.sea = sea;
  const field = createWaveField({...rect, cols, rows, wet: maskGrid(mask, cols, rows, shape), damping: sea ? .992 : .988, open: sea});
  const heights = source(field.pack(), cols, rows);
  if (sea) coastDistance(mask, rect.width, rect.height);
  else if (id === 'pond' || id === 'cove') shoreDistance(mask, rect.width, rect.height);
  const clip = source(mask.data, mask.width, mask.height);
  const geometry = waterGeometry(rect.width, rect.height, cols, rows, sea, field.wet);
  const shader = new Shader({glProgram: GlProgram.from({vertex: VERTEX, fragment: FRAGMENT, name: 'island-height-water', preferredFragmentPrecision: 'highp'}), resources: {
    uField: heights, uMask: clip, waterUniforms: {
      uTexel: {value: new Float32Array([1 / cols, 1 / rows]), type: 'vec2<f32>'},
      uSize: {value: new Float32Array([rect.width, rect.height]), type: 'vec2<f32>'},
      uOrigin: {value: new Float32Array([rect.x, rect.y]), type: 'vec2<f32>'},
      uWater: {value: rgb(PALETTE.water), type: 'vec3<f32>'}, uCream: {value: rgb(PALETTE.cream), type: 'vec3<f32>'}, uInk: {value: rgb(PALETTE.ink), type: 'vec3<f32>'},
      uInland: {value: Number(id === 'pond' || id === 'cove'), type: 'f32'},
      uMix: {value: 0, type: 'f32'}, uTime: {value: 0, type: 'f32'}, uCalm: {value: 0, type: 'f32'}, uSea: {value: Number(sea), type: 'f32'},
    },
  }});
  const mesh = new Mesh({geometry, shader, label: `Water - ${id}`}); mesh.position.set(rect.x, rect.y); if (zIndex !== undefined) mesh.zIndex = zIndex;
  parent.addChild(mesh);
  return {id, rect, field, mesh, shader, heights, clip, geometry, sea, dirty: false, sources: [], tick: 0,
    contains(x, y) {const u = (x - rect.x) / rect.width, v = (y - rect.y) / rect.height;
      return u >= 0 && u <= 1 && v >= 0 && v <= 1 && mask.data[(Math.round(v * (mask.height - 1)) * mask.width + Math.round(u * (mask.width - 1))) * 4] > 128;},
    uniforms: shader.resources.waterUniforms.uniforms,
    dispose() {mesh.destroy(); shader.destroy(); heights.destroy(); clip.destroy(); geometry.destroy();}};
}
const empty = reason => ({active: false, reason, stats: {cpuMs: 0, cells: 0, steps: 0}, update() {}, splash() {return false;}, edge() {}, lily() {}, fountainSplash() {}, pause() {}, dispose() {}});

// Masks come from the CURRENT tiled art, not the older world polygon or ground.svg. All setup is recoverable.
export async function createWater({app, world, art, layer, objects, props, motion}) {
  const gl = app.renderer.gl;
  if (!gl || gl.isContextLost() || gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) < 2 || gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) < 1) return empty('WebGL unavailable');
  const bodies = [], roots = [], actors = new Map();
  let disposed = false, reduced = motion.matches, accumulator = 0, time = 0, pulseTime = 0, steps = 0;
  const stats = {cpuMs: 0, cells: 0, steps: 0, splashes: 0, droppedTime: 0}, samples = [];
  try {
    const pond = world.water[0], rect = {x: pond.x - pond.rx - 35, y: pond.y - pond.ry - 35, width: pond.rx * 2 + 70, height: pond.ry * 2 + 70};
    const seaRect = {x: 0, y: 0, width: world.width, height: world.height};
    const seaMask = await groundMask(art.ground.tiles, seaRect, .5, true);
    // Render the sea above the painted shallow water, but clip out every land pixel and both inland pools.
    const sea = makeBody({id: 'sea', rect: seaRect, cols: 241, rows: 183, mask: seaMask, parent: layer, sea: true}); bodies.push(sea);
    bodies.push(makeBody({id: 'pond', rect, cols: 97, rows: 65, mask: await groundMask(art.ground.tiles, rect, 1.2), parent: layer}));
    const coveRect = {x: 3560, y: 1210, width: 1140, height: 650};
    bodies.push(makeBody({id: 'cove', rect: coveRect, cols: 121, rows: 73,
      mask: await artMask('/pixi-art/lake-race.svg', coveRect, 1368, 780), parent: layer}));
    const fountain = props.find(p => p.asset === 'fountain-wishing');
    let fountainRoot;
    if (fountain) {
      // Same standing transform as the prop. One root keeps both surfaces registered even with ?tilt=.
      fountainRoot = new Container({label: 'Water - fountain surfaces'}); fountainRoot.position.set(fountain.x - 240 * fountain.scale, fountain.y - 300 * fountain.scale);
      fountainRoot.scale.set(fountain.scale); fountainRoot.zIndex = fountain.y + .5; objects.addChild(fountainRoot); roots.push(fountainRoot);
      const fountainRect = {x: 0, y: 0, width: 480, height: 480};
      const edit = svg => {svg.querySelector('#upper-water')?.setAttribute('fill', '#FF00FF'); svg.querySelector('#jet')?.remove();};
      for (const [id, x, y, rx, ry, upper] of [['pool', 240, 290, 180, 137.87234, false], ['bowl', 240, 223, 96, 73.531915, true]]) {
        const mask = await artMask(fountain.src, fountainRect, 720, 720, edit, upper);
        const body = makeBody({id, rect: fountainRect, cols: 81, rows: 81, mask, parent: fountainRoot,
          shape: (u, v) => ((u * 480 - x) / rx) ** 2 + ((v * 480 - y) / ry) ** 2 < 1
            && (upper ? ((u * 480 - 240) / 61) ** 2 + ((v * 480 - 209) / 47) ** 2 > 1
              : ((u * 480 - 240) / 36) ** 2 + ((v * 480 - 297) / 40) ** 2 > 1)});
        body.fountain = fountain; bodies.push(body);
      }
    }
    // Compile, link and upload BEFORE claiming success. Pixi's lazy compilation otherwise fails on the first game frame.
    const program = bodies[0].shader.glProgram;
    const compiled = [];
    try {
      for (const [type, code] of [[gl.VERTEX_SHADER, program.vertex], [gl.FRAGMENT_SHADER, program.fragment]]) {
        const shader = gl.createShader(type); compiled.push(shader); gl.shaderSource(shader, code); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
      }
      const linked = gl.createProgram();
      try {compiled.forEach(s => gl.attachShader(linked, s)); gl.linkProgram(linked); if (!gl.getProgramParameter(linked, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(linked));}
      finally {gl.deleteProgram(linked);}
    } finally {compiled.forEach(s => gl.deleteShader(s));}
    stats.cells = bodies.reduce((sum, b) => sum + b.field.indices.length, 0);
    const pondBody = bodies.find(b => b.id === 'pond'), cove = bodies.find(b => b.id === 'cove');
    // Small fixed wakes under the bridge posts and jetties, physically propagated by the same field as clicks.
    for (const x of [pond.x - pond.rx * .82, pond.x + pond.rx * .82]) pondBody.sources.push({x, y: pond.y + 25, strength: .055, radius: 16, phase: x * .01});
    for (const b of world.walkways) for (const t of [.22, .72]) for (const side of [-1, 1]) {
      const dx = b.b[0] - b.a[0], dy = b.b[1] - b.a[1], len = Math.hypot(dx, dy);
      sea.sources.push({x: b.a[0] + dx * t - dy / len * b.w * .52 * side, y: b.a[1] + dy * t + dx / len * b.w * .52 * side, strength: .06, radius: 36, phase: t + side});
    }
    cove.sources.push({x: 4498, y: 1362, strength: .2, radius: 22, phase: 0});
    // Three pads painted into the spring cove, plus the two tiny landing posts, also displace the surface.
    for (const [x, y] of [[3702, 1627], [3744, 1671], [4591, 1625], [3930, 1768], [4020, 1860]]) cove.sources.push({x, y, strength: .045, radius: 14, phase: x * .03});
    // boss 5 Nov: pads seed gentle rings into their own connected pond.
    for (const p of art.floating || []) if (/lily|pad/i.test(p.src || p.asset || '')) {
      for (const b of [pondBody, cove]) if (b.contains(p.x, p.y)) b.sources.push({x:p.x, y:p.y, strength:.065, radius:14, phase:p.x*.017});
    }
    const fall = new Graphics({label: 'Water - spring flow'}); layer.addChild(fall); roots.push(fall);

    function splashBody(b, x, y, strength, radius) {
      if (!b.mesh.visible) return false;
      const hit = b.field.impulse(x - b.rect.x, y - b.rect.y, strength, radius); b.dirty ||= hit; if (hit) stats.splashes++; return hit;
    }
    function nearest(b, x, y, radius) {
      const f = b.field, gx = (x - b.rect.x) / f.dx, gy = (y - b.rect.y) / f.dy;
      if (gx < -radius / f.dx || gy < -radius / f.dy || gx > f.cols + radius / f.dx || gy > f.rows + radius / f.dy) return null;
      let best = radius * radius, result = null;
      for (let iy = Math.max(0, Math.floor(gy - radius / f.dy)); iy <= Math.min(f.rows - 1, Math.ceil(gy + radius / f.dy)); iy++) {
        for (let ix = Math.max(0, Math.floor(gx - radius / f.dx)); ix <= Math.min(f.cols - 1, Math.ceil(gx + radius / f.dx)); ix++) {
          if (!f.wet[iy * f.cols + ix]) continue;
          const d = ((ix - gx) * f.dx) ** 2 + ((iy - gy) * f.dy) ** 2;
          if (d <= best) {best = d; result = [b.rect.x + ix * f.dx, b.rect.y + iy * f.dy];}
        }
      }
      return result;
    }
    function update(dt, t, view) {
      if (disposed || document.hidden) {accumulator = 0; return;}
      const start = performance.now(), calm = motion.matches;
      if (view) for (const b of bodies) {
        const f = b.field, prop = b.fountain, s = prop?.scale || 1, sy = prop ? s / TILT : 1;
        const ox = prop ? prop.x - 240 * s : b.rect.x, oy = prop ? prop.y - 300 * s : b.rect.y;
        const x0 = Math.max(0, Math.floor(((view.x - ox) / s - f.dx * 2) / f.dx)), y0 = Math.max(0, Math.floor(((view.y - oy) / sy - f.dy * 2) / f.dy));
        const x1 = Math.min(f.cols - 1, Math.ceil(((view.x + view.width - ox) / s + f.dx * 2) / f.dx)), y1 = Math.min(f.rows - 1, Math.ceil(((view.y + view.height - oy) / sy + f.dy * 2) / f.dy));
        let visible = b.sea && (view.x < 0 || view.y < 0 || view.x + view.width > world.width || view.y + view.height > world.height);
        for (let y = y0; y <= y1 && !visible; y++) for (let x = x0; x <= x1; x++) if (f.wet[y * f.cols + x]) {visible = true; break;}
        b.mesh.visible = visible;
      }
      if (calm !== reduced) {reduced = calm; accumulator = 0; bodies.forEach(b => {b.field.clear(); b.dirty = true;});}
      if (!reduced) {
        accumulator += Math.min(Math.max(0, Number.isFinite(dt) ? dt : 0), .1);
        let count = 0;
        while (accumulator + 1e-9 >= WATER_STEP && count < 6) {
          time += WATER_STEP; pulseTime += WATER_STEP;
          if (pulseTime >= .16) {
            pulseTime -= .16;
            for (const b of bodies) for (const s of b.sources) {
              if (!b.sea && !b.fountain && Math.sin(time * 3.2 + s.phase) < .88) continue;
              splashBody(b, s.x, s.y, s.strength * (.8 + .2 * Math.sin(time * 2 + s.phase)), s.radius);
            }
          }
          // Incoming ocean swell is injected at the OPEN outer boundary, then travels and reflects off the painted coast.
          if (steps % 6 === 0) for (let i = 0; i < 14; i++) {
            const x = (i + .5) * world.width / 14;
            splashBody(sea, x, 130, Math.sin(time * .9 - x * .002) * .025, 110);
            splashBody(sea, x, world.height - 130, Math.sin(time * .8 + x * .0015) * .025, 110);
          }
          // boss 5 Nov: invisible bodies do no solver work, upload or ambient catch-up.
          for (const b of bodies) if (b.mesh.visible) {
            if (b.id === 'pond' || b.id === 'cove') inlandLife(b.field, b.tick * WATER_STEP, b.tick++, (x,y,s,r) => splashBody(b, x + b.rect.x, y + b.rect.y, s, r));
            b.field.step(); b.dirty = true;
          }
          accumulator -= WATER_STEP; count++; steps++;
        }
        if (accumulator >= WATER_STEP) {stats.droppedTime += accumulator; accumulator %= WATER_STEP;}
      } else accumulator = 0;
      for (const b of bodies) {
        if (b.dirty && b.mesh.visible) {b.field.pack(); b.heights.update(); b.dirty = false;}
        b.uniforms.uMix = reduced ? 1 : accumulator / WATER_STEP; b.uniforms.uTime = reduced ? 0 : time + accumulator; b.uniforms.uCalm = Number(reduced);
      }
      fall.clear();
      if (!reduced && cove.mesh.visible) {
        // Cream streaks accelerate along the existing shelf ribbon. Impact comes from the cove height field.
        for (let i = 0; i < 4; i++) {
          const u = (time * 1.25 + i / 4) % 1, y = 1203 + 145 * u * u, x = y < 1260 ? 4479 + Math.sin(u * 7) * 8 : 4497;
          fall.moveTo(x, y).lineTo(x + 1, y + 5 + u * 6).stroke({color: PALETTE.cream, width: 2.5, alpha: .65 * Math.sin(u * Math.PI), cap: 'round'});
        }
      }
      stats.steps = steps; stats.cpuMs = performance.now() - start; samples.push(stats.cpuMs); if (samples.length > 240) samples.shift();
    }
    function fountainSplash(x, y, strength, id = 'pool') {
      if (disposed || reduced || document.hidden) return;
      const b = bodies.find(b => b.id === id); if (b) splashBody(b, x, y, strength, id === 'pool' ? 10 : 7);
    }
    function splash(x, y, strength = .65, radius = 23) {
      if (disposed || reduced || document.hidden || ![x, y, strength, radius].every(Number.isFinite)) return false;
      let hit = false;
      for (const b of bodies) {
        let px = x, py = y;
        if (b.fountain) {px = (x - b.fountain.x) / b.fountain.scale + 240; py = (y - b.fountain.y + 300 * b.fountain.scale) * TILT / b.fountain.scale;}
        const ix = Math.round((px - b.rect.x) / b.field.dx), iy = Math.round((py - b.rect.y) / b.field.dy);
        if (ix < 0 || iy < 0 || ix >= b.field.cols || iy >= b.field.rows || !b.field.wet[iy * b.field.cols + ix] || !b.contains(px, py)) continue;
        hit = splashBody(b, px, py, strength, radius) || hit;
      }
      return hit;
    }
    function edge(poses) {
      if (disposed || reduced || document.hidden) return;
      const ids = new Set();
      for (const p of poses) {
        const id = p.id; ids.add(id); const last = actors.get(id);
        if (!last) {actors.set(id, {x: p.x, y: p.y, time}); continue;}
        const distance = Math.hypot(p.x - last.x, p.y - last.y);
        if (time - last.time < .16 || distance < 12) continue;
        if (distance < 150) for (const b of bodies) {
          if (b.fountain || !b.mesh.visible) continue;
          const near = nearest(b, p.x, p.y, 38);
          if (near) splashBody(b, ...near, .12, b.sea ? 32 : 16);
        }
        Object.assign(last, {x: p.x, y: p.y, time});
      }
      for (const id of actors.keys()) if (!ids.has(id)) actors.delete(id);
    }
    function lily(item, pose) {
      if (disposed || reduced || document.hidden || !item.sprite.visible) return;
      // boss 5 Nov: reeds stay rooted; floating pads bob and tip on the local field.
      const reed = /reeds|cattails/i.test(item.asset || item.name || item.src || '');
      for (const b of bodies) {
        if (b.sea || b.fountain || !b.mesh.visible) continue;
        const near = nearest(b, item.x, item.y, reed ? 65 : 45); if (!near) continue;
        const x = near[0] - b.rect.x, y = near[1] - b.rect.y, mix = accumulator / WATER_STEP;
        const h = waveHeight(b.field, x, y, mix), slope = waveHeight(b.field, x + b.field.dx, y, mix) - h;
        if (reed) item.sprite.skew.x += clamp(h * .12 + slope * .16, -.025, .025);
        else {item.sprite.y = pose.y + clamp(h * 9, -2.5, 2.5); item.sprite.rotation = pose.rotation + clamp(slope * .08, -.018, .018);}
        break;
      }
    }
    // Seed calm water immediately, avoiding a flat first second and a burst when returning to the tab.
    if (!reduced) for (const b of bodies) for (const s of b.sources) splashBody(b, s.x, s.y, s.strength, s.radius);
    return {active: true, stats, update, splash, edge, lily, fountainSplash,
      pause() {accumulator = 0;},
      metrics() {const a = [...samples].sort((a, b) => a - b); return {...stats, meanMs: a.reduce((s, n) => s + n, 0) / (a.length || 1), p95Ms: a[Math.floor(a.length * .95)] || 0};},
      dispose() {if (disposed) return; disposed = true; bodies.forEach(b => b.dispose()); roots.forEach(r => r.destroy({children: true})); actors.clear(); textCache.clear();}};
  } catch (error) {
    bodies.forEach(b => b.dispose()); roots.forEach(r => r.destroy({children: true})); textCache.clear();
    console.warn('Water simulation unavailable; using illustrated water.', error);
    return empty(String(error.message || error));
  }
}
