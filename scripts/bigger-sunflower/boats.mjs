// boss 8 Nov ("we should allow them to go on boat in centre"): Sunbob's ring river and its two brooks open to the sea, the same
// way Home's did (scripts/home-10/ground.mjs, commit feat(home):sailable-rivers). Run from the repo root:
//   node scripts/bigger-sunflower/boats.mjs
// The full rebuild, in order: water-geometry.py (needs shapely: the brooks' width and course live there), then
// compose.mjs --build (it rewrites the extension ground tiles, then stops at the original tiles' deleted sources; that is
// expected), then this script, then centre.mjs, then theme-index.mjs and globe-perf/source-sizes.mjs + tile-large-art.mjs.
// It is idempotent: it strips what it added last time and adds it again from boats-data.mjs. It writes
//  - the two river mouths into the extension ground tiles (a smooth sandy flare, no square cut, no foam across the mouth),
//  - one arched footbridge deck per flat crossing (GPT's bridge-<dir>.svg, fitted by Home's archBridge),
//  - world.json and walk-world.json: boatWater (the sea-joined water boats sail), riverMouths (calm, no surf), the mouths as water,
//    the bridges' walk rectangles, walkways with boatPassUnder and arches. Land walking data is unchanged.
import {readFileSync, writeFileSync, readdirSync, existsSync} from 'node:fs';
import {coast} from './design.mjs';
import {inPoly} from '../../assets/world/island-geometry.mjs';
import {crossingCollision, waterways} from './water.mjs';
import {BRIDGES, KEPT_ARCHES, MOUTHS} from './boats-data.mjs';

const A = 'public/pixi-art/themes/sunflower/', D = 'assets/world/themes/sunflower/';
const read = p => JSON.parse(readFileSync(p)), save = (p, x) => writeFileSync(p, JSON.stringify(x, null, 1) + '\n');
const r3 = v => Math.round(v * 1000) / 1000, r2 = v => Math.round(v * 100) / 100;
const art = read(A + 'art.json'), world = read(D + 'world.json'), walk = read(D + 'walk-world.json');

// ---------- the bridges: Home's archBridge (scripts/home-10/ground.mjs), unchanged but for the north-south deck width ----------
const BRIDGE_ART = 'public/pixi-art/home-expansion-c/bridges', DEPTH = .62;
const BRIDGE_SILLS = {ns: [[120, 312], [120, 53]], ew: [[32, 168], [448, 168]], ne: [[90, 296], [395, 104]], nw: [[395, 296], [85, 104]]};
const PLANK = {ne: [1, DEPTH], nw: [1, -DEPTH]};
function archBridge({a, b, w}) {
  const [near, far] = a[1] >= b[1] ? [a, b] : [b, a], X = far[0] - near[0], Y = far[1] - near[1];
  const dir = Math.abs(Y) < Math.abs(X) * .25 ? 'ew' : Math.abs(X) < Math.abs(Y) * .25 ? 'ns' : X > 0 ? 'ne' : 'nw';
  // boss 8 Nov: Sunbob's own redraw of a direction (bridges/bridge-ns.svg, GPT's arched north-south bridge) wins over Home's
  const own = `${A}bridges/bridge-${dir}.svg`, src = readFileSync(existsSync(own) ? own : `${BRIDGE_ART}/bridge-${dir}.svg`, 'utf8'), [W, H] = src.match(/viewBox="0 0 (\d+) (\d+)"/).slice(1).map(Number);
  let [n0, f0] = BRIDGE_SILLS[dir];
  if (dir === 'ew' && X < 0) [n0, f0] = [f0, n0];
  const As = [f0[0] - n0[0], f0[1] - n0[1]];
  let sx, c, d;
  // Sunbob: a long north-south span (the old south-west deck, 460) keeps a walk-wide deck instead of growing as wide as it is long
  if (dir === 'ns') {d = Math.abs(Y) / Math.abs(As[1]); sx = Math.min(d, w * 1.15 / 120); c = 0;}
  else if (dir === 'ew') {sx = X / As[0]; d = 1; c = Y / As[0];}
  else {
    sx = X / As[0];
    const g = [X, Y / DEPTH], q = [g[1], -g[0]].map(v => v * Math.sign(g[1] || 1)), qs = [q[0], q[1] * DEPTH], p = PLANK[dir];
    const lam = sx * p[0] / qs[0], r1v = lam * qs[1], det = p[0] * As[1] - p[1] * As[0];
    c = (r1v * As[1] - p[1] * Y) / det; d = (p[0] * Y - As[0] * r1v) / det;
  }
  // the ns sill sits at x 120: keep it centred on the crossing when the deck is narrowed
  const e = near[0] - sx * n0[0], f = near[1] - c * n0[0] - d * n0[1];
  const T = ([x, y]) => [sx * x + e, c * x + d * y + f], cs = [[0, 0], [W, 0], [0, H], [W, H]].map(T);
  const xs = cs.map(q => q[0]), ys = cs.map(q => q[1]), box = [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
  const inner = src.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return {box, dir, crown: Math.round(24 * d), svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${r3(box[2])}" height="${r3(box[3])}" viewBox="${box.map(r3).join(' ')}"><g transform="matrix(${[sx, c, 0, d, e, f].map(v => Math.round(v * 1e4) / 1e4).join(' ')})">${inner}</g></svg>`};
}
const replaced = new Set(BRIDGES.map(b => b.deck));
art.decks = art.decks.filter(d => !replaced.has(d.src) && !d.src.startsWith('bigger/arch-'));
for (const d of art.decks) if (KEPT_ARCHES.includes(d.src)) d.overBoats = true;
const arches = [], walkways = [], rects = [];
for (const br of BRIDGES) {
  const {box, svg, crown, dir} = archBridge(br), src = `bigger/arch-${br.id}.svg`;
  writeFileSync(A + src, svg);
  art.decks.push({src, x: r3(box[0]), y: r3(box[1]), width: r3(box[2]), height: r3(box[3]), resolution: 1.5, overBoats: true});
  arches.push({id: br.id, a: br.a, b: br.b, r: crown, w: br.w});
  walkways.push({id: br.id, a: br.a, b: br.b, w: br.w, boatPassUnder: true});
  // the road crossings walk on rectangles that follow the new, narrower deck; the original jetties keep their own walk data
  if (br.id.startsWith('river-crossing-')) rects.push(...crossingCollision(br));
  console.log(br.id, dir, 'crown', crown);
}

// ---------- the river mouths ----------
const bez = ([p0, p1, p2, p3], n = 16) => Array.from({length: n + 1}, (_, i) => {const t = i / n, u = 1 - t;
  return [0, 1].map(k => r2(u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]));});
const cubic = c => `M${c[0].join(' ')}C${c.slice(1).map(p => p.join(' ')).join(' ')}`;
const mouthPoly = m => [...bez(m.left), ...m.sea, ...bez(m.right).reverse()];
const pathOf = poly => 'M' + poly.map(p => p.join(' ')).join('L') + 'Z';
const land = 'M' + coast.map(p => p.join(' ')).join('L') + 'Z';
let mouthArt = `<!--river-mouths--><g id="river-mouths"><defs><mask id="mouth-sea" maskUnits="userSpaceOnUse" x="-2000" y="-1400" width="12000" height="8400"><rect x="-2000" y="-1400" width="12000" height="8400" fill="white"/><path d="${land}" fill="black"/></mask></defs>`;
for (const m of MOUTHS) {
  const fill = pathOf(mouthPoly(m)), banks = cubic(m.left) + cubic(m.right), L = bez(m.left), R = bez(m.right);
  // where the brook meets the sea: from a curved tide line just inside the beach, the water is the sea's own colour, so the two
  // waters meet on a soft bow and never along the straight coast line
  const l = L[13], r = R[13], bow = [(l[0] + r[0]) / 2 + m.tideBow[0], (l[1] + r[1]) / 2 + m.tideBow[1]];
  const tide = `M${l.join(' ')}Q${bow.join(' ')} ${r.join(' ')}`, sea = `${tide}L${[...R.slice(14), ...m.sea.slice().reverse(), ...L.slice(14).reverse()].map(q => q.join(' ')).join('L')}Z`;
  // on the land side: the brook's own bank recipe (green edge, sand rim, water, dark waterline), flaring out to the beach; past the
  // tide line the sea's colour runs unclipped out over the shoreline foam, so no foam or seam is drawn across the open mouth
  mouthArt += `<g clip-path="url(#new-land)"><path d="${banks}" fill="none" stroke="#496F3D" stroke-width="30"/><path d="${banks}" fill="none" stroke="#D8C17B" stroke-width="21"/>`
    + `<path d="${fill}" fill="#75CCD2"/></g><path d="${sea}" fill="${art.sea}"/><g clip-path="url(#new-land)"><path d="${tide}" fill="none" stroke="#C8EAE0" stroke-width="5" stroke-linecap="round" stroke-dasharray="46 30" opacity=".8"/>`
    + `<path d="${banks}" fill="none" stroke="#487E67" stroke-width="4"/>`
    + m.ripples.map(([x, y]) => `<path d="M${x - 21} ${y}q21 6 44 0" stroke="#C8EAE0" stroke-width="3.5" fill="none" opacity=".7"/>`).join('') + `</g>`;
  // each bank meets the sea in a small round sand point with the beach's foam rim, so the beach turns the corner into the river
  const tips = [L, R].map(B => {const i = B.findIndex(q => !inPoly(q[0], q[1], coast)); return B[i - 1].map((v, k) => r2((v + B[i][k]) / 2));});
  mouthArt += `<g mask="url(#mouth-sea)">${tips.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="11" fill="#FDE48C" stroke="#FFF0C7" stroke-width="8"/>`).join('')}</g>`;
}
mouthArt += '</g>';
const boxOf = m => {const p = mouthPoly(m); return [Math.min(...p.map(q => q[0])), Math.min(...p.map(q => q[1])), Math.max(...p.map(q => q[0])), Math.max(...p.map(q => q[1]))];};
let patched = 0;
for (const name of readdirSync(A + 'bigger').filter(n => /^ground-\d+-\d+\.svg$/.test(n))) {
  let svg = readFileSync(A + 'bigger/' + name, 'utf8');
  const old = svg.indexOf('<!--river-mouths-->'); if (old >= 0) svg = svg.slice(0, old) + '</svg>';   // what the last run added
  const [x, y, w, h] = svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  if (MOUTHS.some(m => {const b = boxOf(m); return b[0] - 40 < x + w && b[2] + 40 > x && b[1] - 40 < y + h && b[3] + 40 > y;})) {svg = svg.replace(/<\/svg>$/, mouthArt + '</svg>'); patched++;}
  writeFileSync(A + 'bigger/' + name, svg);
}

// ---------- the walk and boat data ----------
const mouthWater = MOUTHS.map(m => {const p = mouthPoly(m), b = boxOf(m);
  return {name: 'Sunbob river mouth', id: m.id, x: r2((b[0] + b[2]) / 2), y: r2((m.left[0][1] + m.right[0][1]) / 2), rx: 40, ry: 30, poly: p};});
const ids = new Set(BRIDGES.map(b => b.id));
for (const m of [world, walk]) {
  // the canals and brooks as water-geometry.json has them now (both brooks widened to 180 for boats), then the two mouths
  m.water = m.water.filter(w => w.name !== 'Sunbob river mouth' && w.name !== 'Sunbob canals and brooks').concat(waterways.water, mouthWater);
  m.bridges = m.bridges.filter(b => !(ids.has(b.name) && b.name.startsWith('river-crossing-'))).concat(rects);
  m.walkways = m.walkways.filter(w => !w.id).map(w => ({...w, boatPassUnder: true})).concat(walkways);
}
world.arches = world.arches.filter(a => !a.id).concat(arches);
// the water a boat may sail inside the coast: the ring canal and both brooks (every 'Sunbob canals and brooks' piece is joined
// to them) and the two mouths. The centre's pond (water[0]) never reaches the sea, so it stays closed.
world.boatWater = [...waterways.boatWater, ...mouthWater.map(w => w.poly)];
world.riverMouths = MOUTHS.map(m => m.calm);
save(A + 'art.json', art); save(D + 'world.json', world); save(D + 'walk-world.json', walk);
console.log(JSON.stringify({bridges: BRIDGES.length, mouths: MOUTHS.length, tilesPatched: patched, boatWater: world.boatWater.length, rects: rects.length}));
