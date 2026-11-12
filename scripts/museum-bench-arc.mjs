import {writeFileSync} from 'node:fs';
import {MUSEUM_BENCHES, DIMS, ground, benchBox, benchFile} from '../src/pixi/museum-benches.js';
import {drawArcBench} from './arc-bench-draw.mjs';

const INK = '#39452F', LINE = 2.226, THIN = 1.6;
MUSEUM_BENCHES.forEach((b, i) => {
  const out = drawArcBench(b, {ground, ...b, ...DIMS, ink: INK, line: LINE, thin: THIN, spindleDeg: 3.2 * 446 / b.back});
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024" viewBox="0 0 1536 1024"><title>${benchFile(b, i)}: curved bench at ${b.deg} degrees, backrest on the outer side, sitter faces the Mona Lisa</title><g stroke-linecap="round" stroke-linejoin="round">
${out.join('\n')}
</g></svg>
`;
  writeFileSync(new URL(`../public/pixi-art/interiors/pieces/${benchFile(b, i)}.svg`, import.meta.url), svg);
  console.log(benchFile(b, i), benchBox(b).join(' '));
});
