import sharp from 'sharp'; import {readFileSync} from 'node:fs';
const [,, inp, out] = process.argv, K = +(process.env.K||.3);
const w = JSON.parse(readFileSync('assets/world/themes/library/world.json', 'utf8')), art = JSON.parse(readFileSync('public/pixi-art/themes/library/art.json', 'utf8'));
const meta = await sharp(inp).metadata(), cells = [];
for (const [pose, list] of Object.entries(w.sleepSpots)) for (const s of list) {
  const t = pose === 'nod' ? art.props.find(p => p.id === s[0]) : null, x = t ? t.x : s[0], y = t ? t.y + 14 : s[1];
  const cw = 300, ch = 220, l = Math.max(0, Math.min(meta.width - cw, Math.round(x * K - cw / 2))), tp = Math.max(0, Math.min(meta.height - ch, Math.round(y * K - ch * .65)));
  const label = Buffer.from(`<svg width="${cw}" height="${ch}"><rect x="0" y="0" width="${cw}" height="22" fill="#000" opacity=".6"/><text x="6" y="16" font-size="15" fill="#fff" font-family="Arial">${pose} ${Math.round(x)},${Math.round(y)}</text><circle cx="${x * K - l}" cy="${y * K - tp}" r="4" fill="none" stroke="#f0f" stroke-width="2"/></svg>`);
  cells.push(await sharp(inp).extract({left: l, top: tp, width: cw, height: ch}).composite([{input: label, left: 0, top: 0}]).png().toBuffer());
}
const C = 7, R = Math.ceil(cells.length / C);
await sharp({create: {width: C * 304, height: R * 224, channels: 4, background: '#fff'}}).composite(cells.map((b, i) => ({input: b, left: (i % C) * 304, top: Math.floor(i / C) * 224}))).png().toFile(out);
console.log(cells.length, 'cells');
