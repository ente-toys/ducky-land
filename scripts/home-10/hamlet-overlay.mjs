// Proof helper: the GPT blueprint laid over the world at its hamlet mapping, with roads (red), water (blue), coast (black) and
// props of other zones (magenta dots). Usage: node scripts/home-10/hamlet-overlay.mjs <hamlet> <out.png>
import {readFileSync, writeFileSync} from 'node:fs';
import sharp from 'sharp';
const [h, out] = process.argv.slice(2);
const E = JSON.parse(readFileSync('src/pixi/home-expansion.json'));
const P = JSON.parse(readFileSync('scripts/home-10/homes.json'));
const M = P.hamlets?.[h]?.map ?? {at: E.communities.find(c => c.id === h).center, bp: [768, 512], k: 1.34};
const BP = `../concepts/themes/work/hamlets/gpt/${h}.png`;
const W = 1536, Hh = 1024, s = 1 / M.k;   // output in blueprint pixels, padded
const pad = 300, toPx = ([x, y]) => [(x - M.at[0]) / M.k + M.bp[0] + pad, (y - M.at[1]) / M.k + M.bp[1] + pad];
const pl = pts => pts.map(p => toPx(p).map(v => v.toFixed(1)).join(',')).join(' ');
let g = '';
g += `<polygon points="${pl(E.coast)}" fill="none" stroke="#000" stroke-width="4"/>`;
for (const w of E.riverWater ?? []) g += `<polygon points="${pl(w.poly)}" fill="#29f" fill-opacity=".35" stroke="#06f" stroke-width="3"/>`;
for (const r of E.roads) g += r.poly ? `<polygon points="${pl(r.poly)}" fill="#f00" fill-opacity=".25" stroke="#f00"/>` : `<polyline points="${pl(r.points)}" fill="none" stroke="${r.kind === 'main' ? '#f00' : '#f80'}" stroke-opacity=".55" stroke-width="${r.width / M.k}" stroke-linecap="round"/>`;
for (const p of E.props) if (p.zone !== h) {const [x, y] = toPx([p.x, p.y]); g += `<circle cx="${x}" cy="${y}" r="5" fill="#f0f"/>`;}
for (const p of E.props) if (p.zone === h && p.footprint) {const [x, y] = toPx([p.footprint.x, p.footprint.y]); g += `<ellipse cx="${x}" cy="${y}" rx="${p.footprint.rx / M.k}" ry="${p.footprint.ry / M.k}" fill="none" stroke="#0f0" stroke-width="2"/>`;}
for (const w of E.walkways ?? []) g += `<polyline points="${pl([w.a, w.b])}" stroke="#a50" stroke-opacity=".6" stroke-width="${w.w / M.k}"/>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W + 2 * pad}" height="${Hh + 2 * pad}">${g}</svg>`;
await sharp({create: {width: W + 2 * pad, height: Hh + 2 * pad, channels: 4, background: '#ddd'}})
  .composite([{input: BP, left: pad, top: pad}, {input: Buffer.from(svg), left: 0, top: 0}]).png().toFile(out);
console.log(out);
