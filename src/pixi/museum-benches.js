const RINGS = [[149, 106], [225, 168], [306, 238], [391, 310], [478, 386], [568, 464], [661, 547], [760, 633], [861, 722]];
export const C = {x: 768, y: 470};
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
const BAND = {inner: {sIn: 410, sOut: 456}, outer: {sIn: 686, sOut: 732}};
export const DIMS = {seat: 28, top: 70, u: 1.5};
const bench = (deg, span, band) => ({deg, span, ...BAND[band], back: BAND[band].sOut + 5});
export const MUSEUM_BENCHES = [
  bench(169, 20, 'inner'), bench(11, 20, 'inner'),
  bench(134, 20, 'inner'), bench(46, 20, 'inner'),
  bench(129, 14, 'outer'), bench(51, 14, 'outer'),
];
const arcPts = (b, s, n = 12) => Array.from({length: n + 1}, (_, i) => ground(b.deg - b.span / 2 + b.span * i / n, s));
export const benchFootprint = b => [...arcPts(b, b.sIn - 4), ...arcPts(b, b.back + 6).reverse()].map(([x, y]) => [Math.round(x), Math.round(y)]);
export const benchAnchor = b => ground(b.deg, (b.sIn + b.sOut) / 2);
export function benchBox(b) {
  const pts = [b.sIn - 3, b.back + 6].flatMap(s => arcPts(b, s, 24)).flatMap(([x, y]) => [[x, y + 3], [x, y - DIMS.top - 3]]);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return [Math.floor(Math.min(...xs)) - 6, Math.floor(Math.min(...ys)) - 6, Math.ceil(Math.max(...xs)) + 6, Math.ceil(Math.max(...ys)) + 6];
}
export const benchFile = (b, i) => `bench-${i + 1}`;
