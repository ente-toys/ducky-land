// Home vs library, same in-game zoom, plus both coasts drawn at the same scale with their areas.
// node scripts/themes/library-compare-big.mjs home9.png lib9.png home5.png lib5.png out.png
import sharp from 'sharp'; import {readFileSync} from 'node:fs';
const [,, h9, l9, h5, l5, out] = process.argv;
const area = p => Math.abs(p.reduce((s, a, i) => {const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1];}, 0) / 2);
const home = JSON.parse(readFileSync('rive/web/world.json', 'utf8')), lib = JSON.parse(readFileSync('rive/web/themes/library/world.json', 'utf8'));
const CW = 1400, CH = 900, k = .17;
const label = (t, w) => sharp(Buffer.from(`<svg width="${w}" height="60"><rect width="${w}" height="60" fill="#fff"/><text x="16" y="40" font-size="30" font-family="Arial" font-weight="bold" fill="#222">${t}</text></svg>`)).png().toBuffer();
const coast = (w, title, col) => {
  const d = 'M' + w.coast.map(([x, y]) => `${(x * k).toFixed(1)} ${(y * k).toFixed(1)}`).join(' L') + ' Z';
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}"><rect width="${CW}" height="${CH}" fill="#6EC9DE"/><g transform="translate(${(CW - w.width * k) / 2} 60)"><rect width="${w.width * k}" height="${w.height * k}" fill="none" stroke="#fff" stroke-dasharray="8 6" stroke-width="2"/><path d="${d}" fill="${col}" stroke="#39472D" stroke-width="3"/></g><text x="20" y="${CH - 30}" font-size="30" font-family="Arial" fill="#222">${title}: land ${(area(w.coast) / 1e6).toFixed(2)}M units², map ${w.width} x ${w.height} (same scale)</text></svg>`);
};
const tiles = [
  [await label('HOME, default zoom', CW), 0, 0], [await label('LIBRARY (Pagepond), same zoom', CW), CW + 20, 0],
  [await sharp(h9).resize(CW, CH).toBuffer(), 0, 60], [await sharp(l9).resize(CW, CH).toBuffer(), CW + 20, 60],
  [await label('HOME, zoomed out (zoom floor)', CW), 0, CH + 80], [await label('LIBRARY, same zoom', CW), CW + 20, CH + 80],
  [await sharp(h5).resize(CW, CH).toBuffer(), 0, CH + 140], [await sharp(l5).resize(CW, CH).toBuffer(), CW + 20, CH + 140],
  [await sharp(coast(home, 'Home', '#93B72F')).png().toBuffer(), 0, 2 * CH + 160], [await sharp(coast(lib, 'Library', '#93B72F')).png().toBuffer(), CW + 20, 2 * CH + 160],
];
await sharp({create: {width: 2 * CW + 20, height: 3 * CH + 160, channels: 4, background: '#ffffff'}}).composite(tiles.map(([input, left, top]) => ({input, left, top}))).png().toFile(out);
console.log('wrote', out);
