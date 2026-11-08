// A coarse map of the expanded island for siting the hamlets: per 20-unit cell, is it sea, beach, river or the original
// (inner) island, and how far is the nearest outer road. Pure data from design.mjs, water-geometry.json and the baseline.
import {readFileSync} from 'node:fs';
import {coast, bounds, lanes} from './design.mjs';
import {waterways} from './water.mjs';
const base = JSON.parse(readFileSync(new URL('./baseline/world.json', import.meta.url)));
export const inPoly = (x, y, p) => {let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) {const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;} return c;};
export const segDist = (x, y, a, b) => {const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);};
export const lineDist = (x, y, p) => {let d = Infinity; for (let i = 0; i < p.length - 1; i++) d = Math.min(d, segDist(x, y, p[i], p[i + 1])); return d;};
const S = 20, ox = bounds.origin.x, oy = bounds.origin.y, NX = bounds.width / S, NY = bounds.height / S;
const water = [...base.water.map(w => w.poly).filter(Boolean), ...waterways.water.map(w => w.poly)];
const wb = water.map(p => [Math.min(...p.map(q => q[0])), Math.min(...p.map(q => q[1])), Math.max(...p.map(q => q[0])), Math.max(...p.map(q => q[1]))]);
// the roads that stay: the main loop and the branches to the inner bridges (the old community lanes go with the old homes)
// the drawn centre line: roads.mjs's Catmull-Rom through the authored points; half widths as drawn (with its wobble)
const spline = p => {const out = []; for (let i = 0; i < p.length - 1; i++) {const a = p[Math.max(0, i - 1)], b = p[i], c = p[i + 1], d = p[Math.min(p.length - 1, i + 2)], n = Math.max(8, Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]) / 34));
  for (let j = 0; j < n; j++) {const t = j / n, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(k => .5 * (2 * b[k] + (-a[k] + c[k]) * t + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t2 + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * t3)));}} out.push(p.at(-1)); return out;};
export const keptRoads = lanes.map((p, i) => ({p: spline(p), half: i === 0 ? 120 : i < 8 ? 90 : 60}));
const kind = new Uint8Array(NX * NY), road = new Float32Array(NX * NY);   // 0 land, 1 sea, 2 beach, 3 water, 4 inner island
for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
  const x = ox + (i + .5) * S, y = oy + (j + .5) * S, n = j * NX + i;
  if (!inPoly(x, y, coast)) kind[n] = 1;
  else if (water.some((p, w) => x >= wb[w][0] && x <= wb[w][2] && y >= wb[w][1] && y <= wb[w][3] && inPoly(x, y, p))) kind[n] = 3;
  else if (inPoly(x, y, base.coast)) kind[n] = 4;
  else if (lineDist(x, y, [...coast, coast[0]]) < 200) kind[n] = 2;
  road[n] = Math.min(...keptRoads.map(r => lineDist(x, y, r.p) - r.half));
}
const cell = (x, y) => {const i = Math.floor((x - ox) / S), j = Math.floor((y - oy) / S); return i < 0 || j < 0 || i >= NX || j >= NY ? -1 : j * NX + i;};
export const siteKind = (x, y) => {const n = cell(x, y); return n < 0 ? 1 : kind[n];};
export const roadGap = (x, y) => {const n = cell(x, y); return n < 0 ? 1e9 : road[n];};
export const NAMES = ['land', 'sea', 'beach', 'water', 'inner'];
