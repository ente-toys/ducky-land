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

const E = JSON.parse(readFileSync('src/pixi/home-expansion.json', 'utf8'));
E.jetty = P.harbour.jetty;
E.harborWater = P.harbour.harborWater;
E.boats.splice(0, 3, ...P.harbour.boats012);
patchCoast(E.coast);
setById(E.riverWater, P.riverWater.set);
setById(E.decks, P.decks.set);
writeFileSync('src/pixi/home-expansion.json', JSON.stringify(E, null, 2) + '\n');

const I = JSON.parse(readFileSync('src/pixi/islets-data.json', 'utf8'));
for (const e of P.islets.set) Object.assign(I.placements.find(o => o.id === e.id), {lon: e.lon, lat: e.lat});
writeFileSync('src/pixi/islets-data.json', JSON.stringify(I, null, 2) + '\n');

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
