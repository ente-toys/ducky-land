// boss 5 Nov: draws the three curved plaza benches (style B: slatted arc seat, backrest rails on the outer side) as SVGs in
// the house bench style: planks #C88941, shade #885931, outline #39472D, round joins. Drawn straight in world units, the
// ground seen top-down with height lifted up the screen, so each arc lies exactly on its paving ring.
// The drawing itself lives in scripts/arc-bench-draw.mjs (shared with the museum's benches).
// Run after changing src/pixi/plaza-benches.js:  node scripts/plaza-bench-arc.mjs
import {writeFileSync} from 'node:fs';
import {ARC, PLAZA_BENCHES, ground, benchBox, benchFile} from '../src/pixi/plaza-benches.js';

import {drawArcBench} from './arc-bench-draw.mjs';

const INK = '#39472D', LINE = 2.2, THIN = 1.5;
const f = n => Math.round(n * 10) / 10;

for (const b of PLAZA_BENCHES) {
  const box = benchBox(b), mid = (ARC.sIn + ARC.sOut) / 2;
  const out = drawArcBench(b, {ground, ...ARC, ink: INK, line: LINE, thin: THIN});
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${box.w}" height="${box.h}" viewBox="${box.x} ${box.y} ${box.w} ${box.h}" data-detail="1">
<title>Curved plaza bench at ${b.deg} degrees, backrest on the outer side, sitter faces the fountain</title>
<g stroke-linecap="round" stroke-linejoin="round">
${out.join('\n')}
</g>
</svg>
`;
  writeFileSync(new URL(`../public/pixi-art/detail/${benchFile(b)}.svg`, import.meta.url), svg);
  console.log(benchFile(b), box.w, 'x', box.h, 'mid', f(mid));
}
