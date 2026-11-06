// Bellovo Piazza: is the walk map valid? Builds the same map the game and the room server build (island-maps.js
// makeMap), then flood-fills the walkable ground from the plaza spawn on a 20-unit grid and checks every zone spawn,
// both islets, every pier end and the harbor landing are reachable, and every boat spot is open sea.
//   node scripts/themes/cathedral-check.mjs
import {readFileSync} from 'node:fs';
import {makeMap} from '../../src/pixi/island-maps.js';

const read = p => JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8'));
const world = read('rive/web/themes/cathedral/world.json'), walk = read('rive/web/themes/cathedral/walk-world.json'), harbor = read('rive/web/themes/cathedral/harbor.json');
const map = makeMap('cathedral', {world, walk, harbor, art: '/pixi-art/themes/cathedral/art.json'});
const nav = map.nav(), G = 20, W = Math.ceil(world.width / G), H = Math.ceil(world.height / G);
const ok = new Uint8Array(W * H), seen = new Uint8Array(W * H);
for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) ok[r * W + c] = nav.walkable(c * G, r * G) ? 1 : 0;
const cell = (x, y) => Math.round(y / G) * W + Math.round(x / G);
const start = cell(map.spawn.x, map.spawn.y), queue = [start];
seen[start] = 1;
while (queue.length) {
  const i = queue.pop(), r = Math.floor(i / W), c = i % W;
  for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const rr = r + dr, cc = c + dc, j = rr * W + cc;
    if (rr >= 0 && rr < H && cc >= 0 && cc < W && ok[j] && !seen[j]) {seen[j] = 1; queue.push(j);}
  }
}
// a point counts as reached when a reached cell lies within 30 of it (the grid snaps)
const reached = (x, y) => {for (let dy = -40; dy <= 40; dy += G) for (let dx = -40; dx <= 40; dx += G) if (seen[cell(x + dx, y + dy)]) return true; return false;};
const fails = [];
if(map.sleepers.length!==40)fails.push('Expected 40 resolved sleepers, got '+map.sleepers.length);
for(const [name,z] of Object.entries(world.zones).filter(([n])=>/^(activity|stalls)-/.test(n))){for(let yy=z.y-z.ry*.55;yy<=z.y+z.ry*.55;yy+=65)for(let xx=z.x-z.rx*.65;xx<=z.x+z.rx*.65;xx+=65)if(!nav.walkable(xx,yy))fails.push(name+' blocked at '+xx+','+yy);}
// A real 100-person arrangement with 160-unit separation inside the centre plaza.
let crowd=[];for(let yy=world.zones.centre.y-500;yy<=world.zones.centre.y+500;yy+=165)for(let xx=world.zones.centre.x-900;xx<=world.zones.centre.x+900;xx+=165)if(nav.walkable(xx,yy))crowd.push([xx,yy]);
// More open spaces complete the crowd if the central placeholder takes a row.
for(const [n,z] of Object.entries(world.zones).filter(([n])=>/^activity-/.test(n)))for(let yy=z.y-z.ry*.65;yy<=z.y+z.ry*.65;yy+=165)for(let xx=z.x-z.rx*.65;xx<=z.x+z.rx*.65;xx+=165)if(nav.walkable(xx,yy))crowd.push([xx,yy]);
if(crowd.length<100)fails.push('Only '+crowd.length+' spacious crowd positions');
console.log('resolved sleepers',map.sleepers.length,'spaced crowd positions',crowd.length);
const want = (label, x, y) => {const w = nav.walkable(x, y), r = reached(x, y); if (!w || !r) fails.push(`${label} (${Math.round(x)},${Math.round(y)}) walkable=${w} reached=${r}`);};
for (const [name, z] of Object.entries(world.zones)) want(`zone ${name} spawn`, ...z.spawn);
world.islets.forEach(([x, y, , ry], i) => want(`islet ${i}`, x, y + ry * .45));
world.walkways.forEach((w, i) => want(`walkway ${i} end`, ...w.b));
want('harbor landing', map.HARBOR.land.x, map.HARBOR.land.y);
const wet = (x, y) => !map.landAt(x, y) && Array.from({length: 16}, (_, i) => i * Math.PI / 8).every(a => !map.landAt(x + Math.cos(a) * 46, y + Math.sin(a) * 46));
map.boatSpots().forEach((s, i) => {
  if (!wet(s.x, s.y)) fails.push(`boat ${i} (${s.x},${s.y}) not open sea`);
  if (!map.shoreFor(s.x, s.y, 260)) fails.push(`boat ${i} (${s.x},${s.y}) has no walkable shore within 260`);
});
const area = seen.reduce((a, b) => a + b, 0) * G * G, all = ok.reduce((a, b) => a + b, 0) * G * G;
console.log(`walkable ${(all / 1e6).toFixed(2)}M units², reached from the plaza ${(area / 1e6).toFixed(2)}M (${(100 * area / all).toFixed(1)}%), ${walk.obstacles.length} obstacles, ${map.boatSpots().length} boats`);
console.log(fails.length ? 'FAIL\n  ' + fails.join('\n  ') : 'PASS: every zone, islet, pier, the harbor and every boat is reachable');
// unreached walkable pockets (islands of walkable cells cut off by props)
const pockets = [];
const mark = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) if (ok[i] && !seen[i] && !mark[i]) {
  let n = 0; const q = [i]; mark[i] = 1; let sx = 0, sy = 0;
  while (q.length) {const k = q.pop(), r = Math.floor(k / W), c = k % W; n++; sx += c; sy += r;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {const rr = r + dr, cc = c + dc, j = rr * W + cc; if (rr >= 0 && rr < H && cc >= 0 && cc < W && ok[j] && !seen[j] && !mark[j]) {mark[j] = 1; q.push(j);}}}
  if (n > 3) pockets.push(`${n} cells near (${Math.round(sx / n * G)},${Math.round(sy / n * G)})`);
}
if (pockets.length) console.log('cut-off pockets:', pockets.join('; '));
process.exit(fails.length ? 1 : 0);
