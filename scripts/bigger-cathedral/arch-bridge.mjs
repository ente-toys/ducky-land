import {readFileSync,existsSync} from 'node:fs';
const A='public/pixi-art/themes/cathedral/';
const r3=v=>Math.round(v*1000)/1000;
const BRIDGE_ART = 'public/pixi-art/home-expansion-c/bridges', DEPTH = .62;
const BRIDGE_SILLS = {ns: [[120, 312], [120, 53]], ew: [[32, 168], [448, 168]], ne: [[90, 296], [395, 104]], nw: [[395, 296], [85, 104]]};
const PLANK = {ne: [1, DEPTH], nw: [1, -DEPTH]};
export function archBridge({a, b, w}) {
  const [near, far] = a[1] >= b[1] ? [a, b] : [b, a], X = far[0] - near[0], Y = far[1] - near[1];
  const dir = Math.abs(Y) < Math.abs(X) * .25 ? 'ew' : Math.abs(X) < Math.abs(Y) * .25 ? 'ns' : X > 0 ? 'ne' : 'nw';
  const own = `${A}bridges/bridge-${dir}.svg`, src = readFileSync(existsSync(own) ? own : `${BRIDGE_ART}/bridge-${dir}.svg`, 'utf8'), [W, H] = src.match(/viewBox="0 0 (\d+) (\d+)"/).slice(1).map(Number);
  let [n0, f0] = BRIDGE_SILLS[dir];
  if (dir === 'ew' && X < 0) [n0, f0] = [f0, n0];
  const As = [f0[0] - n0[0], f0[1] - n0[1]];
  let sx, c, d;
  if (dir === 'ns') {d = Math.abs(Y) / Math.abs(As[1]); sx = Math.min(d, w * 1.15 / 120); c = 0;}
  else if (dir === 'ew') {sx = X / As[0]; d = 1; c = Y / As[0];}
  else {
    sx = X / As[0];
    const g = [X, Y / DEPTH], q = [g[1], -g[0]].map(v => v * Math.sign(g[1] || 1)), qs = [q[0], q[1] * DEPTH], p = PLANK[dir];
    const lam = sx * p[0] / qs[0], r1v = lam * qs[1], det = p[0] * As[1] - p[1] * As[0];
    c = (r1v * As[1] - p[1] * Y) / det; d = (p[0] * Y - As[0] * r1v) / det;
  }
  const e = near[0] - sx * n0[0], f = near[1] - c * n0[0] - d * n0[1];
  const T = ([x, y]) => [sx * x + e, c * x + d * y + f], cs = [[0, 0], [W, 0], [0, H], [W, H]].map(T);
  const xs = cs.map(q => q[0]), ys = cs.map(q => q[1]), box = [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
  const inner = src.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return {box, dir, crown: Math.round(24 * d), svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${r3(box[2])}" height="${r3(box[3])}" viewBox="${box.map(r3).join(' ')}"><g transform="matrix(${[sx, c, 0, d, e, f].map(v => Math.round(v * 1e4) / 1e4).join(' ')})">${inner}</g></svg>`};
}
