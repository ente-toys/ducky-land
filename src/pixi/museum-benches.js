// boss 5 Nov ("fix the chairs"): the museum's straight side-on benches become curved ones that belong to the round room,
// the plaza's style B (scripts/arc-bench-draw.mjs): each an arc of one checker band of the floor, centred on the rings'
// centre under the Mona Lisa, a spindle backrest on its outer side so the sitter faces the painting. Six, mirrored: two on
// the inner band either side of the rope, one on the outer band in each front corner; the middle is left open for the
// walk from the arch to the rope. Pure geometry, shared by interior.js (sprite crop, depth, footprint) and
// scripts/museum-bench-arc.mjs (draws the SVGs). All numbers are in the room drawing's pixels (museum.svg, 1536x1024).
// The floor rings (museum.svg) share a centre and get rounder going out: [rx, ry] of each ring line.
const RINGS = [[149, 106], [225, 168], [306, 238], [391, 310], [478, 386], [568, 464], [661, 547], [760, 633], [861, 722]];
export const C = {x: 768, y: 470};
// how squashed the floor is at radius s (x units), read off the ring lines so an arc lies exactly on its band
export function squash(s) {
  const k = ([rx, ry]) => ry / rx;
  if (s <= RINGS[0][0]) return k(RINGS[0]);
  for (let i = 1; i < RINGS.length; i++) if (s <= RINGS[i][0]) {
    const [a, b] = [RINGS[i - 1], RINGS[i]], t = (s - a[0]) / (b[0] - a[0]);
    return k(a) + (k(b) - k(a)) * t;
  }
  return k(RINGS.at(-1));
}
export const ground = (deg, s) => {const a = deg * Math.PI / 180; return [C.x + Math.cos(a) * s, C.y + Math.sin(a) * s * squash(s)];};
// two bands: the inner one between the 391 and 478 rings, the outer one between 661 and 760; seat, then the backrest just outside it
const BAND = {inner: {sIn: 410, sOut: 456}, outer: {sIn: 686, sOut: 732}};
export const DIMS = {seat: 28, top: 70, u: 1.5};   // seat and backrest heights, and how much chunkier than the plaza's (room art is drawn larger)
const bench = (deg, span, band) => ({deg, span, ...BAND[band], back: BAND[band].sOut + 5});
// angles: 0 = right, 90 = toward you (the arch), 180 = left
export const MUSEUM_BENCHES = [
  bench(169, 20, 'inner'), bench(11, 20, 'inner'),
  bench(134, 20, 'inner'), bench(46, 20, 'inner'),
  bench(129, 14, 'outer'), bench(51, 14, 'outer'),
];
const arcPts = (b, s, n = 12) => Array.from({length: n + 1}, (_, i) => ground(b.deg - b.span / 2 + b.span * i / n, s));
// what a Ducky bumps into: the seat band and its backrest, inner edge out to the rail
export const benchFootprint = b => [...arcPts(b, b.sIn - 4), ...arcPts(b, b.back + 6).reverse()].map(([x, y]) => [Math.round(x), Math.round(y)]);
// the depth point: the middle of the seat on the ground
export const benchAnchor = b => ground(b.deg, (b.sIn + b.sOut) / 2);
// the drawn box [x0, y0, x1, y1] (ground y minus height), padded for the outline: the sprite's crop out of its sheet
export function benchBox(b) {
  const pts = [b.sIn - 3, b.back + 6].flatMap(s => arcPts(b, s, 24)).flatMap(([x, y]) => [[x, y + 3], [x, y - DIMS.top - 3]]);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return [Math.floor(Math.min(...xs)) - 6, Math.floor(Math.min(...ys)) - 6, Math.ceil(Math.max(...xs)) + 6, Math.ceil(Math.max(...ys)) + 6];
}
export const benchFile = (b, i) => `bench-${i + 1}`;
