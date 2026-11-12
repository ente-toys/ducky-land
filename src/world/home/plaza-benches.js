export const ARC = {x: 2820, y: 2370, k: .766, sIn: 402, sOut: 442, back: 446, seat: 17, top: 47};
export const PLAZA_BENCHES = [{deg: -10, span: 22}, {deg: 80, span: 30}];
export const ground = (deg, s) => {const a = deg * Math.PI / 180; return [ARC.x + Math.cos(a) * s, ARC.y + Math.sin(a) * s * ARC.k];};
const arcPts = (b, s, n = 12) => Array.from({length: n + 1}, (_, i) => ground(b.deg - b.span / 2 + b.span * i / n, s));
export const benchFootprint = b => ({poly: [...arcPts(b, ARC.sIn - 4), ...arcPts(b, ARC.back + 4).reverse()].map(([x, y]) => [Math.round(x), Math.round(y)])});
export const benchAnchor = b => ground(b.deg, (ARC.sIn + ARC.sOut) / 2);
export function benchBox(b) {
  const pts = [ARC.sIn - 3, ARC.back + 4].flatMap(s => arcPts(b, s, 24)).flatMap(([x, y]) => [[x, y + 2], [x, y - ARC.top - 2]]);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x0 = Math.floor(Math.min(...xs)) - 4, y0 = Math.floor(Math.min(...ys)) - 4;
  return {x: x0, y: y0, w: Math.ceil(Math.max(...xs)) + 4 - x0, h: Math.ceil(Math.max(...ys)) + 4 - y0};
}
export const benchFile =b => `plaza--bench-arc-${b.deg < 0 ? 'm' + -b.deg : b.deg}`;
