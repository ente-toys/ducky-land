// The 8 approved sleeping Duckies, split into SVG layers for Pixi.
// Run: node scripts/sleep-sprites.mjs -> public/pixi-duck/sleep/<pose>-<group>.svg + src/pixi/sleep-poses.json
// Rasterise in memory only to measure the existing boxes. SVG texture dimensions
// match the former PNGs, so F, pivots, pose scale and ground contact stay identical.
import sharp from 'sharp';
import {readFileSync, writeFileSync} from 'node:fs';
const SRC = new URL('../../sleeping-variants/svg/', import.meta.url), OUT = new URL('../public/pixi-duck/sleep/', import.meta.url);
const POSES = ['nod', 'leaf', 'wing', 'hammock', 'rock', 'book', 'chair', 'box'], F = .75;   // texture px per svg unit
// rig units per svg unit: the body's yellow area matched to a standing Ducky's, checked against head and tuft widths
// (the leaf, box and hammock hide yellow, the chair sits far back, so area alone over-sizes those four)
const K = {nod: .65, leaf: .95, wing: .78, hammock: .92, rock: .72, book: .78, chair: 1.15, box: .8};
const yellow = (r, g, b) => r > 230 && g > 185 && b < 140;
async function raster(svg, file) {
  const img = sharp(Buffer.from(svg), {density: 72 * F}).ensureAlpha();
  const {data, info} = await img.clone().raw().toBuffer({resolveWithObject: true});
  let area = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4; if (data[i + 3] < 40) continue;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    if (yellow(data[i], data[i + 1], data[i + 2])) area++;
  }
  if (file) writeFileSync(new URL(file, OUT), svg.replace(/<svg\b[^>]*>/, tag => tag.replace(/\bwidth="[^"]*"/, `width="${info.width}"`).replace(/\bheight="[^"]*"/, `height="${info.height}"`)));
  return {area: area / F / F, box: [x0 / F, y0 / F, (x1 + 1) / F, (y1 + 1) / F]};
}
const only = (s, keep, clip = '') => s.replace(/<g id="(duck|prop|zz)"[^>]*>.*?<\/g>/gs, m => m.startsWith(`<g id="${keep}"`) ? (clip ? `<g clip-path="url(#${clip})">${m}</g>` : m) : '');
// the standing Ducky's yellow, in rig units, sets every pose's size: the sleeper's body reads as big as a standing one
const stand = readFileSync(new URL('../public/pixi-duck/view-9-body-0.svg', import.meta.url), 'utf8');
const standArea = (await raster(stand.replace(/<svg([^>]*)>/, '<svg$1>'))).area * 1;   // svg units = rig units for the parts
const out = {standArea, F, poses: {}};
for (const name of POSES) {
  let s = readFileSync(new URL(`${name}.svg`, SRC), 'utf8');
  const [, W, H] = s.match(/viewBox="0 0 (\d+) (\d+)"/).map(Number);
  const order = [...s.matchAll(/<g id="(duck|prop|zz)"([^>]*)>/g)].map(m => ({id: m[1], pivot: (m[2].match(/data-pivot="([\d. ]+)"/)?.[1] || '').split(' ').filter(Boolean).map(Number)}));
  const pose = {W, H, layers: []};
  let box = [1e9, 1e9, -1e9, -1e9];
  for (const {id, pivot} of order) {
    const parts = id === 'prop' && name === 'hammock' ? [['posts', [[-50, 141], [769, W + 50]]], ['cloth', [[139, 771]]]] : [[id, null]];
    for (const [label, ranges] of parts) {
      let svg = only(s, id, ranges ? 'cut' : '');
      if (ranges) svg = svg.replace('</defs>', `<clipPath id="cut" clipPathUnits="userSpaceOnUse">${ranges.map(([a, b]) => `<rect x="${a}" y="-200" width="${b - a}" height="${H + 400}"/>`).join('')}</clipPath></defs>`);
      const r = await raster(svg, `${name}-${label}.svg`);
      if (label === 'duck') pose.area = r.area;
      if (label !== 'zz') box = [Math.min(box[0], r.box[0]), Math.min(box[1], r.box[1]), Math.max(box[2], r.box[2]), Math.max(box[3], r.box[3])];
      pose.layers.push({id: label, src: `/pixi-duck/sleep/${name}-${label}.svg`, ...(pivot.length ? {pivot} : {}), box: r.box.map(Math.round)});
    }
  }
  pose.box = box.map(Math.round);
  pose.k = K[name];   // area-only would be +Math.sqrt(standArea / pose.area).toFixed(3)   // rig units per svg unit
  out.poses[name] = pose;
  console.log(name, pose.k, pose.box);
}
const z = readFileSync(new URL('z-symbol.svg', SRC), 'utf8');
writeFileSync(new URL('z.svg', OUT), z.replace(/\bwidth="[^"]*"/, 'width="200"').replace(/\bheight="[^"]*"/, 'height="210"'));   // same 200 x 210 texture
writeFileSync(new URL('../src/pixi/sleep-poses.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
