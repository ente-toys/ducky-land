// Proof renders (boss 8 Nov): every bridge, both river mouths, the plaza, the sunflower fence (N, E, S, W) and the refilled centre
// at k .5, and the whole island at k .14.
//   node scripts/bigger-sunflower/boats-proof.mjs [only-id ...]
import {readFileSync, mkdirSync} from 'node:fs';
import {render} from './render.mjs';
import {BRIDGES, MOUTHS} from './boats-data.mjs';
const art = JSON.parse(readFileSync('public/pixi-art/themes/sunflower/art.json'));
const OUT = '/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/sunbob-check/boats/';
mkdirSync(OUT, {recursive: true});
const only = process.argv.slice(2);
const spots = [...BRIDGES.map(b => ['bridge-' + b.id, (b.a[0] + b.b[0]) / 2, (b.a[1] + b.b[1]) / 2]), ['bridge-original-5', 1506, 1362], ['bridge-original-6', 5307, 4211],
  ...MOUTHS.map(m => [m.id, (m.left[3][0] + m.right[3][0]) / 2, (m.left[3][1] + m.right[3][1]) / 2]), ['plaza', 3880, 2620], ['fence-north', 3000, 1300], ['fence-east', 6950, 2200], ['fence-south', 3300, 4550], ['fence-west', 700, 2900],
  ['centre-east', 5800, 2500], ['centre-north', 4300, 1600]];
for (const [id, x, y] of spots) if (!only.length || only.includes(id)) {const k = id === 'plaza' ? .6 : .5; await render(art, OUT + id + '.png', {x: x - 700 / k, y: y - 450 / k, k, w: 1400, h: 900});}
if (!only.length || only.includes('island')) await render(art, OUT + 'island.png');
console.log('proofs in', OUT);
