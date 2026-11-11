// Palette C is the final, fill-only overlay after any Bog geometry/art generator.
// Its authored colour mappings live in layout.json, alongside the map palette.
import fs from 'node:fs';

const root = 'public/pixi-art/themes/bog-arena/';
const layout = JSON.parse(fs.readFileSync('scripts/bog-environment/layout.json', 'utf8'));
const colour = layout.paletteC;
if (!colour) throw Error('Missing approved Bog palette C in layout.json');
const repaint = (svg, fills) => svg.replace(/\bfill=(['"])(#[\da-f]{6})\1/gi,
  (attribute, quote, fill) => fills[fill.toLowerCase()] ? `fill=${quote}${fills[fill.toLowerCase()]}${quote}` : attribute);
let changed = 0;
function write(file, svg) {
  if (fs.readFileSync(file, 'utf8') === svg) return;
  fs.writeFileSync(file, svg);
  changed++;
}
write(root + 'ground.svg', repaint(fs.readFileSync(root + 'ground.svg', 'utf8'), colour.groundFills));
for (const name of fs.readdirSync(root + 'home').filter(name => name.endsWith('.svg'))) {
  // Keep the complete existing foliage kit, its tint families and all water.
  if (/^(?:tree|bush)-/.test(name)) continue;
  const fills = {...colour.stoneFills};
  if (name !== 'p2-site-a-pond.svg') Object.assign(fills, colour.roofFills);
  if (/^(?:wz-|cover-)/.test(name)) Object.assign(fills, colour.woodFills);
  write(root + 'home/' + name, repaint(fs.readFileSync(root + 'home/' + name, 'utf8'), fills));
}
const manifestFile = root + 'art.json';
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
manifest.shadowColor = Number.parseInt(colour.shadowColor.slice(1), 16);
manifest.shadowAlpha = colour.shadowAlpha;
write(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
// The review-only fallback is a viewport of the same exact ground drawing.
write('public/pixi-art/globe/bog-arena-ground.svg', fs.readFileSync(root + 'ground.svg', 'utf8')
  .replace('width="8400" height="8200"', 'width="1024" height="1000"'));
console.log(`Bog palette C: ${changed} files repainted; geometry, strokes, foliage and water preserved.`);
