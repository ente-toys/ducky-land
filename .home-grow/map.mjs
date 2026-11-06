import sharp from 'sharp';import {readFileSync} from 'node:fs';
const S = .25, d = JSON.parse(readFileSync('.home-grow/data.json')), extra = JSON.parse(readFileSync(process.argv[2] ?? '.home-grow/empty.json'));
const old = JSON.parse(readFileSync('src/pixi/walk-shapes.json')).coast;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${5800*S}" height="${4400*S}">`;
for (let x = 0; x <= 5800; x += 500) svg += `<line x1="${x*S}" y1="0" x2="${x*S}" y2="${4400*S}" stroke="#fff" stroke-opacity=".35"/><text x="${x*S+2}" y="12" font-size="11" fill="#fff">${x}</text>`;
for (let y = 0; y <= 4400; y += 500) svg += `<line x1="0" y1="${y*S}" x2="${5800*S}" y2="${y*S}" stroke="#fff" stroke-opacity=".35"/><text x="2" y="${y*S-2}" font-size="11" fill="#fff">${y}</text>`;
svg += `<polygon points="${old.map(p => p.map(v => v*S).join(',')).join(' ')}" fill="none" stroke="#f00" stroke-width="1" stroke-dasharray="4 3"/>`;
for (const p of d.props) { const tree = /tree/.test(p.asset), bush = /bush/.test(p.asset);
  svg += `<circle cx="${p.x*S}" cy="${p.y*S}" r="${tree ? 4 : 3}" fill="${tree ? '#063' : bush ? '#3a3' : '#444'}"/>`;
  if (tree || bush || /bench|stall|library|picnic|planter|lamp/i.test(p.asset + p.name)) svg += `<text x="${p.x*S+4}" y="${p.y*S+3}" font-size="8" fill="#000">${tree ? p.id : bush ? 'b' : (p.asset||p.name).slice(0,8)}</text>`; }
for (const b of d.base) svg += `<circle cx="${b.x*S}" cy="${b.y*S}" r="7" fill="#ff0" stroke="#000"/><text x="${b.x*S-8}" y="${b.y*S-9}" font-size="10" font-weight="bold" fill="#000">${b.pose}</text>`;
for (const [pose, list] of Object.entries(extra)) for (const s of list) { const t = typeof s[0] === 'string' ? d.props.find(p => p.id === s[0]) : null; const x = t ? t.x : s[0], y = t ? t.y : s[1];
  svg += `<circle cx="${x*S}" cy="${y*S}" r="8" fill="#f0f" stroke="#000"/><text x="${x*S-8}" y="${y*S-10}" font-size="11" font-weight="bold" fill="#f0f">${pose}</text>`; }
svg += '</svg>';
await sharp('.home-grow/ground-big.png').composite([{input: Buffer.from(svg)}]).png().toFile(process.argv[3] ?? '.home-grow/map.png');
