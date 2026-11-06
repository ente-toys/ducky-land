// Contact sheet of the library theme's SVG pieces (QA): node scripts/themes/library-sheet.mjs out.png [height]
import sharp from 'sharp'; import {readdirSync} from 'node:fs';
const D = 'public/pixi-art/themes/library/', H = +(process.argv[3] || 360);
const files = readdirSync(D).filter(f => f.endsWith('.svg') && !f.startsWith('ground') && !f.startsWith('jetty')).sort();
const comps = []; let x = 20, y = 20, rowH = 0; const W = 2400;
for (const f of files) {
  const buf = await sharp(D + f, {density: 144}).resize({height: H, width: 520, fit: 'inside'}).png().toBuffer(), m = await sharp(buf).metadata();
  if (x + m.width > W) {x = 20; y += rowH + 20; rowH = 0;}
  comps.push({input: buf, left: x, top: y}); x += m.width + 20; rowH = Math.max(rowH, m.height);
}
await sharp({create: {width: W, height: y + rowH + 20, channels: 4, background: '#93b72f'}}).composite(comps).png().toFile(process.argv[2]);
console.log(files.join(' '));
