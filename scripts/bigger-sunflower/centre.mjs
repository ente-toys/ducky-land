// boss 8 Nov, Sunbob's inner island: three buildings only (barn, windmill, honey stall), the freed pads turned back into lawn,
// field and trees, and a two-row sunflower fence along the ring canal's inner bank. Run from the repo root after boats.mjs:
//   node scripts/bigger-sunflower/centre.mjs
// Idempotent: it removes what it added last time (ids centre-fill-*, ring-fence-*) and adds it again from centre-data.mjs.
import {readFileSync, writeFileSync, readdirSync} from 'node:fs';
import {geometry, inShape, inPoly} from '../../assets/world/island-geometry.mjs';
import {resolveSleepSpots, sleepHalfWidths} from '../../src/pixi/sleep-spots.js';
import {REMOVE_PROPS, MOVE_PROPS, SLEEP_MOVES, LIFT_FLATS, FIELDS, FIELD_ROWS, FIELD_KEEP, REMOVE_FLATS, REMOVE_GROUND_GROUPS, FILL, FENCE} from './centre-data.mjs';

const A = 'public/pixi-art/themes/sunflower/', D = 'assets/world/themes/sunflower/';
const read = p => JSON.parse(readFileSync(p)), save = (p, x) => writeFileSync(p, JSON.stringify(x, null, 1) + '\n');
const art = read(A + 'art.json'), world = read(D + 'world.json'), walk = read(D + 'walk-world.json');
const r1 = v => Math.round(v * 10) / 10;

// ---------- the removed stall and pads ----------
const gone = art.props.filter(p => REMOVE_PROPS.includes(p.id));
art.props = art.props.filter(p => !REMOVE_PROPS.includes(p.id) && !/^(centre-fill|centre-field|ring-fence)-/.test(p.id));
art.flats = art.flats.filter(f => !REMOVE_FLATS.includes(f.id));
const lifted = LIFT_FLATS.map(id => art.flats.find(f => f.id === id) ?? art.decks.find(d => d.id === id));
art.flats = art.flats.filter(f => !LIFT_FLATS.includes(f.id)); art.decks = art.decks.filter(d => !LIFT_FLATS.includes(d.id));
art.decks.splice(art.decks.findIndex(d => d.id === 'centre-back') + 1, 0, ...lifted.map(f => ({...f, resolution: f.resolution ?? 2})));   // flats draw at 2
// a moved prop takes its walk footprint along: the obstacle just above its base, or one named after it (a bench's outline)
const owns = (o, p) => o.name === p.id || (o.x === p.x && p.y - o.y >= 0 && p.y - o.y < 60);
for (const p of art.props) if (MOVE_PROPS[p.id]) {
  const [x, y] = MOVE_PROPS[p.id], dx = x - p.x, dy = y - p.y;
  if (dx || dy) for (const m of [world, walk]) m.obstacles = m.obstacles.map(o => !owns(o, p) ? o : {...o, ...(o.x !== undefined ? {x: o.x + dx, y: o.y + dy} : {}), ...(o.poly ? {poly: o.poly.map(([a, b]) => [a + dx, b + dy])} : {})});
  p.x = x; p.y = y;
}
// sleeping Duckies whose spot lay on the fence line sleep a little inland ([x, y, flip], by pose and index in world.sleepSpots)
for (const [pose, moves] of Object.entries(SLEEP_MOVES)) for (const [i, spot] of Object.entries(moves)) world.sleepSpots[pose][i] = spot;
const ownObstacle = o => /^(centre-fill|centre-field|ring-fence)-/.test(o.name ?? '');
// a removed prop's footprint sits just above its base (12 for a stall, 9 for a tree; original obstacles carry no name)
const stallFoot = o => gone.some(p => o.x === p.x && p.y - o.y > 0 && p.y - o.y < 15);
for (const m of [world, walk]) m.obstacles = m.obstacles.filter(o => !ownObstacle(o) && !stallFoot(o));
// the pads (and the old plaza stones) are drawn in every original ground tile: cut each group out, so what lies under it shows
function cutGroup(svg, open) {
  const at = svg.indexOf(open); if (at < 0) return svg;
  const tag = /<g[\s>]|<\/g>/g; tag.lastIndex = at; let depth = 0, m;
  while ((m = tag.exec(svg))) {if (m[0] === '</g>') {if (--depth === 0) return svg.slice(0, at) + svg.slice(m.index + 4);} else depth++;}
  throw Error('unbalanced ' + open);
}
let tiles = 0;
for (const name of readdirSync(A + 'bigger').filter(n => /^original-ground-\d+\.svg$/.test(n))) {
  const before = readFileSync(A + 'bigger/' + name, 'utf8'); let svg = before;
  for (const id of REMOVE_GROUND_GROUPS) svg = cutGroup(svg, id);
  if (svg !== before) {writeFileSync(A + 'bigger/' + name, svg); tiles++;}
}

// ---------- the fill: the centre's own trees and field rows ----------
const baseline = read('scripts/bigger-sunflower/baseline/art.json');   // the original centre's pieces, as templates
const like = src => baseline.props.find(p => p.src === src);
const added = [], obstacles = [];
FILL.forEach(([src, x, y, scale, flip], i) => {
  const base = like(src), id = `centre-fill-${i + 1}`;
  added.push({id, name: base.name, src, x, y, width: base.width, height: base.height, anchor: base.anchor, scale, flip});
  if (base.name === 'Tree') obstacles.push({name: id, x, y: y - 9, rx: 31, ry: 22});   // the centre trees' trunk footprint
});

// ---------- the sunflower fields: each wedge between the plaza's paths is one solid field ----------
const keepInField = new Set([...FIELD_KEEP, ...FIELDS.map(f => f.scarecrow).filter(s => typeof s === 'string')]);
const inField = (x, y) => FIELDS.some(f => inPoly(x, y, f.poly));
const cleared = art.props.filter(p => !keepInField.has(p.id) && inField(p.x, p.y));
art.props = art.props.filter(p => !cleared.includes(p));
for (const m of [world, walk]) m.obstacles = m.obstacles.filter(o => !cleared.some(p => owns(o, p)));
const scarecrow = art.props.find(p => p.name === 'Scarecrow'), row = like(FIELD_ROWS.src);
FIELDS.forEach((f, i) => {
  const xs = f.poly.map(q => q[0]), ys = f.poly.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (Array.isArray(f.scarecrow)) added.push({...scarecrow, id: `centre-field-scarecrow-${i + 1}`, x: f.scarecrow[0], y: f.scarecrow[1]});
  const standing = [...FIELD_KEEP, typeof f.scarecrow === 'string' ? f.scarecrow : null].map(id => art.props.find(p => p.id === id)).filter(Boolean)
    .concat(Array.isArray(f.scarecrow) ? [{x: f.scarecrow[0], y: f.scarecrow[1]}] : []);
  let n = 0;
  // each row runs edge to edge: where the row's line crosses the field, pieces are spread evenly from one edge to the other, their
  // centres FIELD_ROWS.reach in from each edge (so a piece's leaves end at the path's edge), never further apart than stepX
  const crossings = y => {const xs = []; for (let k = 0; k < f.poly.length; k++) {const a = f.poly[k], b = f.poly[(k + 1) % f.poly.length];
    if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]));} return xs.sort((p, q) => p - q);};
  for (let r = 0, y = y0 + 40; y <= y1 - 10; r++, y += FIELD_ROWS.stepY) {
    const xs = crossings(y);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = xs[k] + FIELD_ROWS.reach, b = xs[k + 1] - FIELD_ROWS.reach;
      if (b < a - 80) continue;   // too narrow here for a piece
      const count = b <= a ? 1 : Math.ceil((b - a) / FIELD_ROWS.stepX) + 1, gap = count > 1 ? (b - a) / (count - 1) : 0;
      // even rows: evenly from edge to edge; odd rows: both edges and the midpoints between, so the rows stagger like the centre's
      const at = count === 1 ? [(a + b) / 2] : r % 2 ? [a, ...Array.from({length: count - 1}, (_, j) => a + gap * (j + .5)), b] : Array.from({length: count}, (_, j) => a + gap * j);
      for (const px of at) {
        const x = Math.round(px);
        if (standing.some(p => Math.abs(p.x - x) < 130 && y - p.y > -40 && y - p.y < 90)) continue;   // never over a trunk or a scarecrow's post
        added.push({id: `centre-field-${i + 1}-${++n}`, name: 'Sunflower row', src: row.src, x, y: Math.round(y), width: row.width, height: row.height, anchor: row.anchor, scale: FIELD_ROWS.scale, flip: true});
      }
    }
  }
  // a field is solid, as the centre's fields always were: walkers keep to the paths
  for (const m of [world, walk]) m.obstacles.push({name: `centre-field-${i + 1}`, poly: f.poly});
});

// ---------- the sunflower fence ----------
for (const m of [world, walk]) m.obstacles.push(...obstacles);
const walkable = geometry({...world, ...walk}).walkable;
// the 40 sleeping Duckies keep their beds: no flower within reach of one (theme-index.mjs drops a bed a prop stands on)
const beds = resolveSleepSpots({...world, ...walk}, art.props.concat(added), walkable, sleepHalfWidths(), {spots: world.sleepSpots, avoid: world.sleepAvoid, warn: false});
const solid = [...world.obstacles];
const segDist = (x, y, a, b) => {const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l)); return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);};
const onPath = (x, y) => world.paths.some((p, i) => p.length > 1 && p.some((q, k) => k && segDist(x, y, p[k - 1], q) < (world.pathWidths[i] ?? 150) / 2 + 20));
const flower = like('detail/field-row-short.svg');
// Only the bridge openings break the rows. Anything else on the line was moved inland by hand (MOVE_PROPS, SLEEP_MOVES); this
// reports what is still there, so a new clash is seen, never silently gapped.
const fields = props => props.filter(p => p.name === 'Sunflower row');
let fence = 0, skipped = 0; const clashes = [];
FENCE.rows.forEach((line, row) => {
  const lens = line.slice(1).map((q, k) => Math.hypot(q[0] - line[k][0], q[1] - line[k][1])), total = lens.reduce((s, v) => s + v, 0);
  for (let s = row * FENCE.step / 2; s < total; s += FENCE.step) {
    let k = 0, t = s; while (t > lens[k]) t -= lens[k++];
    const a = line[k], b = line[k + 1], x = r1(a[0] + (b[0] - a[0]) * t / lens[k]), y = r1(a[1] + (b[1] - a[1]) * t / lens[k]);
    if (FENCE.gaps.some(([gx, gy, r]) => Math.hypot(x - gx, y - gy) < r)) {skipped++; continue;}
    const o = solid.find(o => inShape(x, y, o, 30) && !(o.poly && !o.name) && !/^centre-field-/.test(o.name ?? ''));   // (the sleepers are checked by theme-index.mjs: all 40 must resolve)
    if (o || !walkable(x, y) && !solid.some(o => o.poly && !o.name && inShape(x, y, o, 30))) clashes.push([x, y, o ? (o.name ?? `obstacle ${o.x},${o.y}`) : 'water']);
    added.push({id: `ring-fence-${++fence}`, name: 'Sunflower fence', src: FENCE.src, x, y, width: 224, height: 251, anchor: flower.anchor, scale: FENCE.scale, flip: fence % 2 === 0});
  }
});
if (clashes.length) console.log('fence clashes', JSON.stringify(clashes));
art.props.push(...added);
world.props = art.props;
save(A + 'art.json', art); save(D + 'world.json', world); save(D + 'walk-world.json', walk);
console.log(JSON.stringify({removed: gone.map(p => p.id), groundTilesCut: tiles, fill: FILL.length, fence, skipped}));
