// Copies GPT's hamlet SVG kits into the repo: the layout to scripts/home-10/hamlets/<h>.json and each SVG to
// public/pixi-art/home-hamlets/<h>/, its width/height set to the largest world size it is drawn at (crisp rasters).
// Usage: node scripts/home-10/hamlets-sync.mjs <hamlet...>
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
const SRC = '../concepts/themes/work/hamlets/svg-codex', K = JSON.parse(readFileSync('scripts/home-10/homes.json')).hamlets ?? {};
for (const h of process.argv.slice(2)) {
  const L = JSON.parse(readFileSync(`${SRC}/${h}/layout.json`)), k = K[h]?.map?.k ?? 1.34;
  mkdirSync('scripts/home-10/hamlets', {recursive: true}); mkdirSync(`public/pixi-art/home-hamlets/${h}`, {recursive: true});
  writeFileSync(`scripts/home-10/hamlets/${h}.json`, JSON.stringify(L, null, 1));
  const widest = {};
  for (const o of L.objects) widest[o.file] = Math.max(widest[o.file] ?? 0, o.width * k);
  for (const [f, w] of Object.entries(widest)) {
    if (!existsSync(`${SRC}/${h}/${f}`)) {console.warn('missing', h, f); continue;}
    let s = readFileSync(`${SRC}/${h}/${f}`, 'utf8');
    const vb = s.match(/viewBox="([^"]+)"/)[1].trim().split(/[\s,]+/).map(Number), W = Math.ceil(w), H = Math.ceil(w * vb[3] / vb[2]);
    s = s.replace(/<svg\b[^>]*>/, t => t.replace(/\s(width|height)="[^"]*"/g, '').replace('<svg', `<svg width="${W}" height="${H}"`));
    writeFileSync(`public/pixi-art/home-hamlets/${h}/${f}`, s);
  }
  console.log(h, L.objects.length, 'objects', Object.keys(widest).length, 'svgs');
}
