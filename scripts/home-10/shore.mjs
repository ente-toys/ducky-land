// Shore lane apply step. It places nothing itself: it copies the hand-written entries in scripts/home-10/shore.json into
// src/pixi/home-expansion.json (keys: jetty, harborWater, boats 0-2, coast, riverWater, decks by id; islet sea-9-1's lon/lat in islets-data.json) and the same coast and
// jetty deck into assets/world/world.json and assets/world/walk-world.json. Idempotent; touches no other key or entry.
// Run from the repo root:  node scripts/home-10/shore.mjs
import {readFileSync, writeFileSync} from 'node:fs';
const P = JSON.parse(readFileSync('scripts/home-10/shore.json', 'utf8'));
const same = (p, q) => Math.round(p[0]) === q[0] && Math.round(p[1]) === q[1];

function patchCoast(coast) {
  const {after, before, points} = P.coast;
  const i = coast.findIndex(p => same(p, after)), j = coast.findIndex(p => same(p, before));
  if (i < 0 || j < 0 || j <= i) throw Error(`coast anchors not found (${i}, ${j})`);
  coast.splice(i + 1, j - i - 1, ...points);
}
function setById(list, entries) {
  for (const e of entries) {
    const k = list.findIndex(o => o.id === e.id);
    if (k >= 0) list[k] = e; else list.push(e);
  }
}

// home-expansion.json (pretty-printed)
const E = JSON.parse(readFileSync('src/pixi/home-expansion.json', 'utf8'));
E.jetty = P.harbour.jetty;
E.harborWater = P.harbour.harborWater;
E.boats.splice(0, 3, ...P.harbour.boats012);
patchCoast(E.coast);
setById(E.riverWater, P.riverWater.set);
setById(E.decks, P.decks.set);
writeFileSync('src/pixi/home-expansion.json', JSON.stringify(E, null, 2) + '\n');

// src/pixi/islets-data.json: one decorative islet moved off the new harbour's sailing corridor (lon/lat only)
const I = JSON.parse(readFileSync('src/pixi/islets-data.json', 'utf8'));
for (const e of P.islets.set) Object.assign(I.placements.find(o => o.id === e.id), {lon: e.lon, lat: e.lat});
writeFileSync('src/pixi/islets-data.json', JSON.stringify(I, null, 2) + '\n');

// world.json and walk-world.json (compact): the same coast; the server's jetty deck moves with the jetty
for (const file of ['assets/world/world.json', 'assets/world/walk-world.json']) {
  const W = JSON.parse(readFileSync(file, 'utf8'));
  patchCoast(W.coast);
  if (file.endsWith('walk-world.json')) {
    const {oldJettyWalkway: o, newJettyWalkway: n} = P.walkWorld;
    const k = W.walkways.findIndex(w => (same(w.a, o.a) && same(w.b, o.b)) || (same(w.a, n.a) && same(w.b, n.b)));
    if (k < 0) throw Error('jetty walkway not found in walk-world.json');
    W.walkways[k] = n;
  }
  writeFileSync(file, JSON.stringify(W));
}
console.log('shore lane applied');
