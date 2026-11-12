import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root = 'public/pixi-art/themes/bog-arena/';
const halo = (x, y, rx, ry) => `<g data-detail="ember-halo" fill="#ff8a2b" stroke="none"><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" opacity="0.12"/><ellipse cx="${x}" cy="${y}" rx="${rx * .8}" ry="${ry * .8}" opacity="0.25"/></g>`;
const highlight = (x, y, w, h) => `<path data-detail="ember-highlight" d="M${x} ${y}h${w}v${h}h-${w}Z" fill="#ffc15a" stroke="none"/>`;

export function glowGoogleSvg(svg, name) {
  svg = svg.replace(/ data-build="google-ember"/, '')
    .replace(/<g data-detail="ember-halo"[^>]*>[\s\S]*?<\/g>/g, '')
    .replace(/<path data-detail="ember-highlight"[^>]*\/>/g, '')
    .replace(/<ellipse data-detail="pumpkin-glow-pool"[^>]*\/>/g, '');
  let panes = 0;
  const pane = (d, x, y, w, h) => {
    const re = new RegExp(`<path d="${d}" fill="#[a-fA-F0-9]{6}"\\s*/>`);
    if (!re.test(svg)) return;
    svg = svg.replace(re, () => halo(x + w / 2, y + h / 2, w / 2 + 10, h / 2 + 10)
      + `<path d="${d}" fill="#ff8a2b"/>` + highlight(x + 2, y + 2, Math.max(2, w * .3), h - 4));
    panes++;
  };
  if (/^(?:wz-google-(?:ne|se)-(?:hall|annex)|google-(?:ne|se)-(?:hall|annex)-team)\.svg$/.test(name)) {
    pane('M169 129V107H191V129Z', 169, 107, 22, 22);
    pane('M92 227V178H129V227Z', 92, 178, 37, 49);
    pane('M231 227V178H268V227Z', 231, 178, 37, 49);
    pane('M138 175h10v15h-10Z', 138, 175, 10, 15);
    pane('M219 155H280V228H219Z', 219, 155, 61, 73);
  } else if (name === 'google-porch.svg') {
    pane('M305 102l15-12 15 12v31l-15 6-15-6Z', 305, 102, 30, 31);
  } else if (name === 'google-yard-gate.svg') {
    pane('M105 106l15-12 15 12v31l-15 6-15-6Z', 105, 106, 30, 31);
  } else if (name === 'google-lantern.svg') {
    svg = svg.replace('<path d="M13 78H52V134Q32 147 13 134Z"', halo(32.5, 108, 31.5, 40) + '<path d="M13 78H52V134Q32 147 13 134Z"');
    svg = svg.replace('fill="#dfbf93"', 'fill="#ff8a2b"')
      .replace('fill="#b49d77"', 'fill="#e67b28"')
      .replace('stroke="#fff6b0"', 'stroke="#ffc15a"');
    panes++;
  } else if (name === 'google-annex.svg') {
    pane('M67 196h58v70h-58Z', 67, 196, 58, 70);
    pane('M142 196h58v70h-58Z', 142, 196, 58, 70);
    pane('M236 306V225Q258 193 280 225V306Z', 236, 225, 44, 81);
    pane('M-14 18L0 8L14 18V44L0 50L-14 44Z', -14, 18, 28, 26);
    svg = svg.replace(/stroke="#fff(?:2ad|6b0)"/g, 'stroke="#ffc15a"');
  } else if (name === 'google-se-hall.svg') {
    svg = svg.replace(/<rect x="(190|253)" y="89" width="36" height="21" fill="#[a-fA-F0-9]{6}"\s*\/>/g,
      (_, x) => { panes++; return halo(+x + 18, 99.5, 26, 18) + `<rect x="${x}" y="89" width="36" height="21" fill="#ff8a2b"/>` + highlight(+x + 2, 91, 10, 17); });
    for (const [x, c] of [[88, 127], [200, 239], [312, 351]]) pane(`M${x} 359V289Q${c}.0 257 ${x + 78} 289V359Z`, x, 280, 78, 79);
    svg = svg.replace(/stroke="#fff2ad"/g, 'stroke="#ffc15a"');
  }
  svg = svg.replace(/(<g data-detail="pumpkin"[^>]*>)/g,
    '$1<ellipse data-detail="pumpkin-glow-pool" cx="0" cy="15" rx="31" ry="7" fill="#ff8a2b" opacity="0.18" stroke="none"/>')
    .replace(/fill="#(?:dfc9a6|ffe438)"/g, 'fill="#ffb23a"');
  assert.ok(panes, `No light sources found in ${name}`);
  return svg.replace('<svg ', '<svg data-build="google-ember" ');
}

export function applyGoogleGlow() {
  const names = fs.readdirSync(root + 'home').filter(name =>
    /^(?:wz-)?google-(?:ne|se)-(?:hall|annex)(?:-team)?\.svg$/.test(name)
    || ['google-annex.svg', 'google-se-hall.svg', 'google-porch.svg', 'google-lantern.svg', 'google-yard-gate.svg'].includes(name));
  for (const name of names) {
    const file = root + 'home/' + name;
    fs.writeFileSync(file, glowGoogleSvg(fs.readFileSync(file, 'utf8'), name));
  }
  const src = 'home/google-door-glow.svg';
  fs.writeFileSync(root + src, '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100" viewBox="0 0 300 100"><title>Faint ember pool at the Google hall door</title><ellipse cx="150" cy="50" rx="150" ry="50" fill="#ff8a2b" opacity="0.18"/></svg>\n');
  const art = JSON.parse(fs.readFileSync(root + 'art.json', 'utf8'));
  const flats = art.props.filter(p => /^google-(ne|se)-hall$/.test(p.id)).map(p => ({
    id: p.id + '-door-glow', src, x: p.x, y: p.y + 150,
    width: 300, height: 100,
  }));
  assert.equal(flats.length, 2);
  for (const file of [root + 'art.json', 'scripts/bog-environment/layout.json']) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    data.flats = [...data.flats.filter(p => !/^google-(ne|se)-hall-door-glow$/.test(p.id ?? '')), ...flats];
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  }
  console.log(`BUILD10: ${names.length} Google SVGs lit, two flat hall-door pools. Cover unchanged.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) applyGoogleGlow();
