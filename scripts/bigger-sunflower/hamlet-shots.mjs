// Proof shots: each hamlet close up (k .5) beside GPT's blueprint, and the whole island at k .14.
// node scripts/bigger-sunflower/hamlet-shots.mjs [out-dir] [hamlet ...]
import sharp from 'sharp';
import {readFileSync, mkdirSync} from 'node:fs';
import {render, A} from './render.mjs';
import {config, mapper} from './hamlets.mjs';
const OUT = process.argv[2] ?? '/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/sunbob-check/homes';
const GPT = '/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/sunbob-check/gpt/';
const only = process.argv.slice(3), art = JSON.parse(readFileSync(A + 'art.json'));
mkdirSync(OUT, {recursive: true});
for (const h of Object.keys(config)) {
  if (only.length && !only.includes(h)) continue;
  const W = mapper(h), [x0, y0] = W([0, 0]), [x1, y1] = W([1536, 1024]), k = .5, w = Math.round((x1 - x0) * k), ht = Math.round((y1 - y0) * k);
  const shot = `${OUT}/${h}-game.png`;
  await render(art, shot, {x: x0, y: y0, k, w, h: ht});
  const bp = await sharp(GPT + h + '.png').resize(w, ht).png().toBuffer(), game = await sharp(shot).png().toBuffer();
  await sharp({create: {width: w * 2 + 24, height: ht, channels: 3, background: '#ffffff'}})
    .composite([{input: bp, left: 0, top: 0}, {input: game, left: w + 24, top: 0}]).png().toFile(`${OUT}/${h}-vs-blueprint.png`);
  console.log(h, `${OUT}/${h}-vs-blueprint.png`);
}
if (!only.length || only.includes('island')) {await render(art, `${OUT}/island-k014.png`); console.log('island', `${OUT}/island-k014.png`);}
