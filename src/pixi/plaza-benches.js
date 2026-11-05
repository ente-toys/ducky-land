// boss 5 Nov: the plaza's straight benches become THREE curved ones (bench-options.png, style B): each an arc of the outer
// paving ring, centred on the fountain, a slatted backrest on its outer side so the sitter faces the fountain. Uneven spots
// between the path entries (W 178, N -88, NE -40, E 22, SSW 114 degrees on this ring): north-west (below the stall, now it
// stepped out), east, south. The south-west gap is left open: any arc there sits in the SSW lamp's column. Pure geometry, shared by placements.js (sprite + footprint) and
// scripts/plaza-bench-arc.mjs (draws the SVGs). Angles in degrees, s = radius in x units, the ring squashed by K in y.
export const ARC = {x: 2820, y: 2370, k: .766, sIn: 402, sOut: 442, back: 446, seat: 17, top: 47};
export const PLAZA_BENCHES = [{deg: -132, span: 26}, {deg: -10, span: 22}, {deg: 80, span: 30}];
export const ground = (deg, s) => {const a = deg * Math.PI / 180; return [ARC.x + Math.cos(a) * s, ARC.y + Math.sin(a) * s * ARC.k];};
const arcPts = (b, s, n = 12) => Array.from({length: n + 1}, (_, i) => ground(b.deg - b.span / 2 + b.span * i / n, s));
// what a Ducky bumps into: the seat band and its backrest, inner edge out to the rail
export const benchFootprint = b => ({poly: [...arcPts(b, ARC.sIn - 4), ...arcPts(b, ARC.back + 4).reverse()].map(([x, y]) => [Math.round(x), Math.round(y)])});
// the depth point: the middle of the seat on the ground
export const benchAnchor = b => ground(b.deg, (ARC.sIn + ARC.sOut) / 2);
// the drawn box in world units (ground y minus height), padded for the outline: the SVG's viewBox and the sprite's size
export function benchBox(b) {
  const pts = [ARC.sIn - 3, ARC.back + 4].flatMap(s => arcPts(b, s, 24)).flatMap(([x, y]) => [[x, y + 2], [x, y - ARC.top - 2]]);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x0 = Math.floor(Math.min(...xs)) - 4, y0 = Math.floor(Math.min(...ys)) - 4;
  return {x: x0, y: y0, w: Math.ceil(Math.max(...xs)) + 4 - x0, h: Math.ceil(Math.max(...ys)) + 4 - y0};
}
export const benchFile =b => `plaza--bench-arc-${b.deg < 0 ? 'm' + -b.deg : b.deg}`;
