// Outline-weight check: home props (top row) and library props (bottom row) at the SAME world scale as the game draws
// them, zoomed Z px per world unit, on lawn. Then a close-up of the library forecourt from the preview renderer.
//   node scripts/themes/library-compare.mjs   ->  ../concepts/themes/library-compare.png
import sharp from 'sharp';
const Z = 2.2, L = 'public/pixi-art/themes/library/', P = 'public/pixi-art/';
const home = [[P + 'detail/street--lamp-lantern.svg', 432, 1837, .24 * .47], [P + 'detail/street--bench-wood.svg', 818, 463, .24 * .75], [P + 'plants/tree-1.svg', 260, 360, 1.265],
  [P + 'detail/buildings--stall-bread.svg', 1732, 1545, .24 * 1.25], [P + 'detail/street--planter-flowers.svg', 534, 795, .24 * .7], [P + 'plants/bush-2.svg', 168, 110, 1.3]];
const lib = [['pencil-lamp', .44], ['book-bench', .62], ['lantern-tree', .74], ['book-stall-red', 1.25], ['inkwell-planter', .32], ['tower-2', .78], ['book-slide', .63], ['toy-blocks', .47]];
async function row(items) {
  const out = []; let x = 30;
  for (const [src, w, h, s] of items) {
    const ww = Math.round(w * s * Z), hh = Math.round(h * s * Z);
    out.push({input: await sharp(src, {density: 300}).resize(ww, hh, {fit: 'fill'}).png().toBuffer(), left: x, h: hh}); x += ww + 40;
  }
  return {out, w: x};
}
const libItems = [];
for (const [n, s] of lib) {const svg = (await import('node:fs')).readFileSync(L + n + '.svg', 'utf8'), v = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/); libItems.push([L + n + '.svg', +v[1], +v[2], s]);}
const a = await row(home), b = await row(libItems);
const rowH = r => Math.max(...r.out.map(o => o.h));
const H1 = rowH(a) + 40, H2 = rowH(b) + 40, W = Math.max(a.w, b.w);
const comps = [...a.out.map(o => ({input: o.input, left: o.left, top: H1 - 20 - o.h})), ...b.out.map(o => ({input: o.input, left: o.left, top: H1 + H2 - 20 - o.h}))];
const lineup = await sharp({create: {width: W, height: H1 + H2, channels: 4, background: '#93B72F'}}).composite([
  {input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H1 + H2}"><rect y="${H1 - 2}" width="${W}" height="4" fill="#FFF0C7"/></svg>`), left: 0, top: 0}, ...comps]).png().toBuffer();
// close-up of the island renders at the same zoom: home ground+library tile are compared via their own crops
const libClose = await sharp('../concepts/themes/library-gen/island-only.png').extract({left: 760, top: 470, width: 520, height: 330}).resize({width: W}).png().toBuffer();
const lm = await sharp(libClose).metadata();
await sharp({create: {width: W, height: H1 + H2 + lm.height + 20, channels: 4, background: '#ffffff'}})
  .composite([{input: lineup, left: 0, top: 0}, {input: libClose, left: 0, top: H1 + H2 + 20}]).png().toFile('../concepts/themes/library-compare.png');
console.log('library-compare.png', W, H1 + H2 + lm.height + 20);
