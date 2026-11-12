import sharp from 'sharp';import {readFileSync, writeFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
const S = .5, W = 5800 * S | 0, H = 4400 * S | 0, at = p => fileURLToPath(new URL(p, import.meta.url));
const art = JSON.parse(readFileSync(at('../src/pixi/art-manifest.json')));
const comps = [];
for (const t of art.ground.tiles) comps.push({input: await sharp(at('../public' + t.src), {density: 72 * S}).resize(Math.round(t.width * S), Math.round(t.height * S)).png().toBuffer(), left: Math.round(t.x * S), top: Math.round(t.y * S)});
const px = await sharp({create: {width: W, height: H, channels: 4, background: {r: 0, g: 0, b: 0, alpha: 0}}}).composite(comps).raw().toBuffer();
const wet = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) {const r = px[i * 4], b = px[i * 4 + 2], a = px[i * 4 + 3]; wet[i] = a < 128 || b - r > 40 ? 1 : 0;}
const sea = new Uint8Array(W * H), stack = [];
for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
while (stack.length) {const i = stack.pop(); if (sea[i] || !wet[i]) continue; sea[i] = 1; const x = i % W;
  if (x > 0) stack.push(i - 1); if (x < W - 1) stack.push(i + 1); if (i >= W) stack.push(i - W); if (i < W * (H - 1)) stack.push(i + W);}
const land = i => !sea[i];
const label = new Int32Array(W * H).fill(-1), blobs = [];
for (let s = 0; s < W * H; s++) if (land(s) && label[s] < 0) {
  let n = 0, start = s; stack.push(s); label[s] = blobs.length;
  while (stack.length) {const i = stack.pop(); n++; const x = i % W;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < W * H && land(j) && label[j] < 0) {label[j] = blobs.length; stack.push(j);}}
  blobs.push({n, start});
}
const D = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
function trace(id, start) {
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && label[y * W + x] === id;
  let x = start % W, y = start / W | 0, dir = 6; const sx = x, sy = y, out = [];
  do {out.push([x, y]); let k = 0;
    for (; k < 8; k++) {const d = (dir + 6 + k) % 8, nx = x + D[d][0], ny = y + D[d][1]; if (inside(nx, ny)) {x = nx; y = ny; dir = d; break;}}
    if (k === 8) break;
  } while ((x !== sx || y !== sy) && out.length < 1e6);
  return out;
}
function simplify(p, eps) {
  const dp = (a, b) => {let best = 0, k = -1; const [x1, y1] = p[a], [x2, y2] = p[b], L = Math.hypot(x2 - x1, y2 - y1) || 1;
    for (let i = a + 1; i < b; i++) {const d = Math.abs((x2 - x1) * (y1 - p[i][1]) - (x1 - p[i][0]) * (y2 - y1)) / L; if (d > best) {best = d; k = i;}}
    return best > eps ? [...dp(a, k).slice(0, -1), ...dp(k, b)] : [p[a], p[b]];};
  let far = 0; for (let i = 0; i < p.length; i++) if (Math.hypot(p[i][0] - p[0][0], p[i][1] - p[0][1]) > Math.hypot(p[far][0] - p[0][0], p[far][1] - p[0][1])) far = i;
  return [...dp(0, far).slice(0, -1), ...dp(far, p.length - 1).slice(0, -1)];
}
const rings = blobs.map((b, id) => ({...b, ring: b.n > 2000 ? trace(id, b.start) : null})).filter(b => b.ring).sort((a, b) => b.n - a.n);
const world = ring => simplify(ring, 1.2).map(([x, y]) => [Math.round((x + .5) / S), Math.round((y + .5) / S)]);
const [coast, ...islets] = rings.map(b => world(b.ring));
writeFileSync(at('../src/pixi/shore-lines.json'), JSON.stringify({coast, islets}));
console.log('shore-lines.json coast', coast.length, 'points, islets', islets.map(i => i.length).join(' '));
