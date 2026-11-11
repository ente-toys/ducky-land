// BUILD8: run LAST after colour.mjs and teambases.mjs, then rebuild the Bog globe.
// Only explicit fill colours change. Every path, stroke and placement stays exact.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {applyGoogleGlow} from './glow.mjs';

const root = 'public/pixi-art/themes/bog-arena/';
const common = {
  // Cream-amber window panes and small lamps instead of lemon yellow.
  '#ffe02b': '#e6cda0', '#ffe22b': '#e6cda0', '#ffe52a': '#e6cda0',
  '#ffad24': '#dfbf93', '#ffb525': '#dfbf93', '#ffdf52': '#e9d7b6',
  '#ffe36b': '#e9d7b6', '#e6b719': '#b49d77', '#fff6b0': '#eee2c7',
  '#e5b527': '#ad9471', '#f8cb37': '#d3bb91',
  // Yellow-green foliage becomes sage, retaining separate light/shade shapes.
  '#b8de24': '#91b5a1', '#8dab29': '#668d7b', '#d5eb67': '#bdd4c1',
  '#a9cb33': '#91b5a1', '#78962d': '#668d7b', '#d0e967': '#bdd4c1',
  '#b6d93b': '#91b5a1', '#bde713': '#91b5a1', '#53622d': '#526b5c',
  '#83b442': '#82aa94', '#5e8f38': '#5e826e',
};
const sacks = {'#ffe36b': '#c5baa3', '#eac34c': '#a69a83', '#bd9553': '#8b7e68'};
const wood = {
  '#d1b051': '#b3a078', '#d19b49': '#b0926e', '#e4b161': '#c0a683',
  '#bd843e': '#977b5b', '#efc57b': '#d1bb98',
  '#c88e42': '#aa8b67', '#ae7837': '#927653', '#d7b56c': '#beac88',
  '#e4b464': '#c3a783', '#a87838': '#957954',
};
const google = {
  '#f13e43': '#71394f', '#ba2b3b': '#542c40',
  '#cf3447': '#7b4057', '#ee4149': '#81445b',
  '#bc2a3d': '#794257', '#ef4b4e': '#8a5263',
  '#ff9a12': '#b48b70', '#ffe438': '#dfc9a6',
  '#f6c13a': '#b29b76', '#db8434': '#b18a6b', '#a95432': '#956d59',
  '#8ba744': '#7c967d',
};
const privacy = {
  '#ffd132': '#c0ad83', '#ffd429': '#c8b68f', '#ffdc32': '#d2bc92',
  '#d8ac3b': '#b39c75', '#cc982e': '#ad916b', '#e9b737': '#c4ad80',
  '#c39024': '#9c845f', '#c4a141': '#a58e69', '#fff0ad': '#e8dcc0',
};
const ground = {
  '#9abf32': '#7eaa8e', '#b2d630': '#97b9a0', '#77ab46': '#719d83',
  '#b1d631': '#88b39b', '#abd335': '#88b39b',
};
const fills = /\bfill=(['"])(#[\da-f]{6})\1/gi;
const withoutFills = svg => svg.replace(fills, 'fill="COLOUR"');
let changed = 0;
function repaint(file, palette) {
  const before = fs.readFileSync(file, 'utf8');
  // BUILD7's fixed yellow paint marks are paint too. Leave them, like all live
  // paint effects and player art, at their original saturated team colours.
  const paint = [];
  const protectedSVG = before.replace(/<g\b[^>]*data-detail="yellow-paint"[^>]*>[\s\S]*?<\/g>/g,
    g => `__BOG_PAINT_${paint.push(g) - 1}__`);
  const after = protectedSVG.replace(fills, (attr, quote, colour) =>
    palette[colour.toLowerCase()] ? `fill=${quote}${palette[colour.toLowerCase()]}${quote}` : attr)
    .replace(/__BOG_PAINT_(\d+)__/g, (_, i) => paint[i]);
  assert.equal(withoutFills(after), withoutFills(before), file + ': non-fill mutation');
  if (after !== before) { fs.writeFileSync(file, after); changed++; }
}
for (const name of fs.readdirSync(root + 'home').filter(n => n.endsWith('.svg'))) {
  const palette = {...common};
  if (/(?:sacks|sandbag)/.test(name)) Object.assign(palette, sacks);
  if (/(?:crates|barrels)/.test(name)) Object.assign(palette, wood);
  if (name.startsWith('google-')) Object.assign(palette, google);
  if (name.startsWith('privacy-')) Object.assign(palette, privacy);
  repaint(root + 'home/' + name, palette);
}
repaint(root + 'ground.svg', ground);
// This review fallback is the same ground SVG, with only its root size changed.
const fallback = fs.readFileSync(root + 'ground.svg', 'utf8')
  .replace('width="8400" height="8200"', 'width="1024" height="1000"');
const fallbackFile = 'public/pixi-art/globe/bog-arena-ground.svg';
if (fs.readFileSync(fallbackFile, 'utf8') !== fallback) {
  fs.writeFileSync(fallbackFile, fallback); changed++;
}
console.log(`BUILD8: ${changed} SVGs repainted, fills only; palette C floor, sea, strokes, geometry and paint preserved.`);
// BUILD10 is the final, Google-only light pass after the scenery palette.
applyGoogleGlow();
