// Applies the hand-written homes patch (homes.json) to src/pixi/home-expansion.json. Places nothing itself. Idempotent.
// Run from the repo root: node <this> <path-to-homes.json>
import {readFileSync, writeFileSync} from 'node:fs';
import {applyHamlets} from './hamlets-apply.mjs';
const FILE = 'src/pixi/home-expansion.json';
const P = JSON.parse(readFileSync(process.argv[2]));
const E = JSON.parse(readFileSync(FILE));
const id = n => typeof n === 'number' ? `bigger-community-${n}` : n;
const byId = new Map(E.props.map(p => [p.id, p]));
const gone = new Set(P.removeProps.map(id));
E.props = E.props.filter(p => !gone.has(p.id));
const moveTo = (p, x, y) => {if (p.footprint) {p.footprint.x += x - p.x; p.footprint.y += y - p.y;} p.x = x; p.y = y;};
for (const [zone, list] of Object.entries(P.moveProps)) for (const [n, [x, y]] of Object.entries(list)) {
  const p = byId.get(id(+n)); if (!p) throw Error(`missing ${n}`); if (p.zone !== zone) throw Error(`${n} is ${p.zone}`); moveTo(p, x, y);}
for (const a of P.addProps) {
  const p = structuredClone(byId.get(id(a.copyOf))); delete p.communityRole;
  if (a.scale && p.footprint) {const k = a.scale / p.scale; p.footprint.rx *= k; p.footprint.ry *= k; p.footprint.y = p.y - (p.y - p.footprint.y) * k;}
  Object.assign(p, {id: a.id, zone: a.zone, scale: a.scale ?? p.scale}); moveTo(p, a.x, a.y);
  const i = E.props.findIndex(q => q.id === a.id); if (i >= 0) E.props[i] = p; else E.props.push(p);}
// boss 8 Nov (trees by hand): the groves are literal entries in homes.json addTrees, drawn with the centre's plant art at its
// sizes (placements.js PLANTS). A tree-* asset gets the centre's solid trunk (placements.js obstaclesFor).
const PLANT_SIZE = {'tree-1': [260, 360], 'tree-2': [180, 360], 'tree-3': [300, 380], 'tree-4': [200, 280], 'tree-5': [150, 380]};
E.props = E.props.filter(p => !String(p.id).startsWith('grove-'));
for (const t of P.addTrees ?? []) {
  const [width, height] = PLANT_SIZE[t.kind];
  E.props.push({id: t.id, name: 'Tree', asset: t.kind, src: `/pixi-art/plants/${t.kind}.svg`, x: t.x, y: t.y, width, height, scale: t.scale,
    anchor: {x: .5, y: 1}, resolution: 1.5, zone: 'groves', flip: t.flip, tint: t.tint});
}
// boss 8 Nov (apple trees): the old expansion apple art is swapped for the centre's plant art at the same spot, by hand
for (const t of P.swapTrees ?? []) {
  const p = byId.get(id(t.id)); if (!p || !E.props.includes(p)) throw Error(`swapTrees: missing ${t.id}`);
  const [width, height] = PLANT_SIZE[t.kind];
  Object.assign(p, {name: 'Tree', asset: t.kind, src: `/pixi-art/plants/${t.kind}.svg`, width, height, scale: t.scale, anchor: {x: .5, y: 1}, resolution: 1.5, flip: t.flip ?? false, tint: t.tint ?? 0xffffff});
}
// boss 8 Nov (benches): each expansion bench sits beside a path facing it, placed by hand; look picks the centre's facing art
const BENCH_ART = {front: 'street--bench-wood', back: 'street--bench-wood-back', left: 'street--bench-wood-left', right: 'street--bench-wood-right'};
for (const [n, s] of Object.entries(P.setProps ?? {})) {
  const p = byId.get(id(isNaN(n) ? n : +n)); if (!p || !E.props.includes(p)) throw Error(`setProps: missing ${n}`);
  moveTo(p, s.x, s.y);
  if (s.look) Object.assign(p, {asset: s.look === 'front' ? 'bench-wood' : `bench-wood-${s.look}`, src: `/pixi-art/detail/${BENCH_ART[s.look]}.svg`});
  if (/left|right/.test(s.look ?? '')) Object.assign(p, {scale: .28, resolution: 1.4});   // the centre's side benches: drawn narrow, .28 matches the front bench's length
}
const dead = new Set(P.removeObstacles.map(o => o.join(',')));
E.obstacles = E.obstacles.filter(o => !dead.has([o.x, o.y, o.rx, o.ry].join(',')) && !String(o.id ?? '').startsWith('homes-')).concat(P.addObstacles);
E.decks = E.decks.filter(d => !String(d.id ?? '').startsWith('homes-')).concat(P.addDecks);
for (const c of E.communities) Object.assign(c, P.communities[c.id] ?? {});
for (const p of E.places) if (P.places[p.id]) p.point = P.places[p.id];
const goneRoads = new Set(P.removeRoads), set = new Map(P.setRoads.map(r => [r.id, r]));
E.roads = E.roads.filter(r => !goneRoads.has(r.id)).map(r => set.get(r.id) ?? r);   // a reset road keeps its draw order
E.roads = E.roads.concat(P.setRoads.filter(r => !E.roads.includes(r)));
const hamlets = applyHamlets(E, P);   // boss 8 Nov: the five hamlets from GPT's blueprints
for (const [h, r] of Object.entries(hamlets)) console.log(h, JSON.stringify(r));
writeFileSync(FILE, JSON.stringify(E, null, 2));
console.log(`homes patch: ${E.props.length} props, ${E.obstacles.length} obstacles, ${E.decks.length} decks, ${E.roads.length} roads`);
