// boss 5 Nov ("fix the chairs"): draws the museum's six curved benches (the plaza's style B, scripts/arc-bench-draw.mjs) on
// the room's floor rings, each on its own transparent 1536x1024 sheet like the other room pieces, in the room's line weight.
// Run after changing src/pixi/museum-benches.js:  node scripts/museum-bench-arc.mjs
import {writeFileSync} from 'node:fs';
import {MUSEUM_BENCHES, DIMS, ground, benchBox, benchFile} from '../src/pixi/museum-benches.js';
import {drawArcBench} from './arc-bench-draw.mjs';

const INK = '#39452F', LINE = 2.226, THIN = 1.6;
MUSEUM_BENCHES.forEach((b, i) => {
  const out = drawArcBench(b, {ground, ...b, ...DIMS, ink: INK, line: LINE, thin: THIN, spindleDeg: 3.2 * 446 / b.back});   // spindles as far apart as the plaza's
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024" viewBox="0 0 1536 1024"><title>${benchFile(b, i)}: curved bench at ${b.deg} degrees, backrest on the outer side, sitter faces the Mona Lisa</title><g stroke-linecap="round" stroke-linejoin="round">
${out.join('\n')}
</g></svg>
`;
  writeFileSync(new URL(`../public/pixi-art/interiors/pieces/${benchFile(b, i)}.svg`, import.meta.url), svg);
  console.log(benchFile(b, i), benchBox(b).join(' '));
});
