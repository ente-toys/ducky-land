export const WOOD = '#C88941', SHADE = '#885931';

export function drawArcBench(b, o) {
  const {ground, sIn, sOut, back, seat, top, ink, line, thin, u = 1, spindleDeg = 3.2} = o;
  const f = n => Math.round(n * 10) / 10;
  const pt = (deg, s, z) => {const [x, y] = ground(deg, s); return [x, y - z];};
  const d = pts => 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L') + ' Z';
  const poly = (pts, fill, w = line) => `<path d="${d(pts)}" fill="${fill}" stroke="${ink}" stroke-width="${w}"/>`;
  const band = (a0, a1, s0, s1, z, n = 16) => {
    const at = i => a0 + (a1 - a0) * i / n, out = [];
    for (let i = 0; i <= n; i++) out.push(pt(at(i), s0, z));
    for (let i = n; i >= 0; i--) out.push(pt(at(i), s1, z));
    return out;
  };
  const wall = (a0, a1, s, z0, z1, n = 16) => {
    const at = i => a0 + (a1 - a0) * i / n, out = [];
    for (let i = 0; i <= n; i++) out.push(pt(at(i), s, z1));
    for (let i = n; i >= 0; i--) out.push(pt(at(i), s, z0));
    return out;
  };
  const post = (deg, s, z0, z1, w) => {const [x, y0] = pt(deg, s, z0), [, y1] = pt(deg, s, z1); return [[x - w / 2, y1], [x + w / 2, y1], [x + w / 2, y0], [x - w / 2, y0]];};

  const a0 = b.deg - b.span / 2, a1 = b.deg + b.span / 2, out = [], T = 6 * u, R = 7 * u, depth = sOut - sIn;
  const seatPart = () => {
    for (const a of [a0 + 1.5, b.deg, a1 - 1.5]) for (const s of [sIn + 5 * u, sOut - 5 * u]) out.push(poly(post(a, s, 0, seat, 5 * u), SHADE));
    const p1 = sIn + f(depth / 3), p2 = sIn + f(depth * 2 / 3), planks = [[sIn, p1], [p1, p2], [p2, sOut]];
    for (const [s0, s1] of planks) out.push(poly(band(a0, a1, s0, s1, seat - T), SHADE));
    for (const [s0, s1] of planks) {
      out.push(`<path d="${d(band(a0, a1, s0, s1, seat))}" fill="${WOOD}"/>`);
      out.push(`<path d="${d(band(a1 - b.span * .16, a1, s0, s1, seat, 4))}" fill="${SHADE}"/>`);
      out.push(`<path d="${d(band(a0, a1, s0, s1, seat))}" fill="none" stroke="${ink}" stroke-width="${line}"/>`);
    }
  };
  const backPart = () => {
    const n = Math.round(b.span / spindleDeg);
    for (let i = 1; i < n; i++) out.push(poly(post(a0 + b.span * i / n, back, seat, top - R + 1, 3.4 * u), WOOD, thin));
    out.push(poly(wall(a0, a1, back, seat - 1, seat + 4 * u), SHADE));
    for (const a of [a0 + .6, a1 - .6]) out.push(poly(post(a, back, 0, top + 1, 6.5 * u), SHADE));
    out.push(poly(wall(a0, a1, back, top - R, top), WOOD));
    out.push(`<path d="${d(wall(a1 - b.span * .16, a1, back, top - R, top, 4))}" fill="${SHADE}"/>`);
    out.push(`<path d="${d(wall(a0, a1, back, top - R, top))}" fill="none" stroke="${ink}" stroke-width="${line}"/>`);
  };
  if (Math.sin(b.deg * Math.PI / 180) < -.5) {backPart(); seatPart();} else {seatPart(); backPart();}
  return out;
}
