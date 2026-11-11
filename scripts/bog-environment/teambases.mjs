// BUILD7, after colour.mjs: the approved E1 / G1 base-yard art only.
// Read the delivered Home-derived pieces; never rebuild geometry or blockers.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = 'public/pixi-art/themes/bog-arena/';
const layoutFile = 'scripts/bog-environment/layout.json';
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const save = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n');
const art = read(root + 'art.json'), layout = read(layoutFile);
const bases = ['privacy-nw', 'privacy-sw', 'google-ne', 'google-se'];
const baseOf = p => bases.find(b => p.id?.startsWith(b + '-'));
const originalProps = structuredClone(art.props);
const palettes = {
  google: {
    ink: '#39272f', wall: '#754051', base: '#572c3d', chimney: '#a26269',
    stone: '#d1a28f', cap: '#ffe3b8', roof: '#f13e43', roofSide: '#ba2b3b',
    trim: '#f5cda5', gold: '#f6c13a', window: '#ffad24', wood: '#a95432',
    court: '#7c4c40',
  },
  privacy: {
    ink: '#39362a', wall: '#fffbed', base: '#eadfc2', chimney: '#fff6dc',
    stone: '#f4e8c9', cap: '#fff9e5', roof: '#42c3ef', roofSide: '#229bca',
    trim: '#ffd132', gold: '#ffd132', window: '#ffe52a', wood: '#cc982e',
    court: '#866048',
  },
};
const group = (p, body, width = 1.8) => `<g stroke="${p.ink}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
const halo = (x, y, rx = 15, ry = 5) => `<g data-detail="halo"><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#ffd429"/><ellipse cx="${x}" cy="${y}" rx="${rx - 4}" ry="${Math.max(1.5, ry - 2.6)}" fill="#fffbed"/></g>`;
const horn = (x, y, flip = false, scale = 1) => `<g data-detail="horn" transform="translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})"><path d="M0 0C-17-2-21-20-9-35C-12-20-6-19 2-13C10-8 9 0 0 0Z" fill="#bc2a3d"/><path d="M-12-23Q-13-12-5-8" fill="none" stroke="#f36c60" stroke-width="2"/></g>`;
const tail = (x, y, scale = 1) => `<g data-detail="devil-tail-vane" transform="translate(${x} ${y}) scale(${scale})"><path d="M0 27V6M0 12C-17 16-22 1-12-3C-5-6-3 2 4 1L22-8" fill="none" stroke="#39272f" stroke-width="6"/><path d="M0 27V6M0 12C-17 16-22 1-12-3C-5-6-3 2 4 1L22-8" fill="none" stroke="#ef4b4e" stroke-width="3"/><path d="M14-10L31-14L26 2L22-6Z" fill="#ef4b4e"/><circle cx="0" cy="23" r="3" fill="#f6c13a"/></g>`;
const wings = (x, y) => `<g data-detail="angel-wings" transform="translate(${x} ${y})"><path d="M-3 0Q-15-15-30-10Q-35-5-24 1Q-31 5-19 8Q-23 13-12 13Q-4 12-3 0ZM3 0Q15-15 30-10Q35-5 24 1Q31 5 19 8Q23 13 12 13Q4 12 3 0Z" fill="#ffffff"/></g>`;
const pumpkin = (x, y, scale = 1) => `<g data-detail="pumpkin" transform="translate(${x} ${y}) scale(${scale})"><path d="M0-11Q-5-21 3-21L5-15" fill="#8ba744"/><path d="M-4-12C-23-17-25 13-8 15Q0 20 8 15C25 13 23-17 4-12Z" fill="#ff9a12"/><path d="M-6-10Q-14 2-6 13M6-10Q14 2 6 13" fill="none" stroke="#da6415"/><path d="M-15-2L-5-1L-10-8ZM15-2L5-1L10-8ZM-12 5L-5 8L0 5L5 8L12 5Q8 17 0 14Q-8 17-12 5Z" fill="#ffe438" stroke-width="1"/><path d="M18 13q13 6 13-5q-1-6-6-2q-3 3 1 4" fill="none" stroke="#a0b348"/></g>`;
const flower = (x, y, scale = 1) => `<g transform="translate(${x} ${y}) scale(${scale})" stroke-width="1"><path d="M-2-3C-6-10 2-12 4-6C11-8 13 0 7 2C11 9 3 12 0 6C-7 11-11 3-5 0C-11-5-6-9-2-3Z" fill="#fffef2"/><circle r="2.6" fill="#ffdc32"/></g>`;
const hedge = (x, y, width = 68, flowers = true) => `<g data-detail="flower-hedge" transform="translate(${x} ${y})"><path d="M0 2Q-6-10 7-12Q7-25 20-20Q29-31 39-20Q53-25 55-13Q${width}-17 ${width} 1Z" fill="#83b442"/><path d="M5 2Q12-7 21-2Q32-10 44-2Q56-7 ${width - 2} 2" fill="none" stroke="#5e8f38"/>${flowers ? flower(16, -13, .67) + flower(35, -18, .7) + flower(54, -10, .65) : ''}</g>`;
const box = (x, y) => `<g data-detail="flower-box" transform="translate(${x} ${y})"><path d="M-29 0H29L26 12H-26Z" fill="#d8ac3b"/>${hedge(-28, 0, 56)}<path d="M-25 8H25" fill="none" stroke="#fff0ad"/></g>`;
const splat = (x, y, scale = 1) => `<g data-detail="yellow-paint" transform="translate(${x} ${y}) scale(${scale})" fill="#ffe02b" stroke="none"><path d="M-5-6Q-13-19-17-10Q-20-5-10 0Q-21 8-13 12Q-9 16-3 6Q1 19 7 13Q11 10 5 3Q21 8 18-1Q17-8 6-5Q11-20 3-18Q-3-18-5-6Z"/><circle cx="18" cy="12" r="2.7"/><circle cx="-19" cy="-18" r="2.6"/></g>`;
const cracks = (p, small = false) => `<g data-detail="stone-cracks" fill="none" stroke="${p.ink}" stroke-width="${small ? 1.3 : 2}"><path d="M38 112l7 9-6 9 13 6M188 111l-8 11 7 8-5 13"/></g>`;
const recolor = (svg, paints) => svg.replace(/#[\da-f]{6}/gi, c => paints[c.toLowerCase()] ?? c);
function append(svg, body) { return svg.replace(/<\/svg>\s*$/, body + '</svg>\n'); }

function building(svg, team, id) {
  const p = palettes[team], evil = team === 'google';
  svg = recolor(svg, {
    '#39472d': p.ink, '#f5ddb9': p.wall, '#ddc5a2': p.base, '#e9d1ae': p.chimney,
    '#006b73': p.roof, '#00535d': p.roofSide, '#fff0d2': p.trim,
    '#ffe02b': p.window, '#ffe36b': '#ffdf52', '#c99337': p.wood,
    '#be8b33': p.wood, '#a78958': evil ? '#a32536' : '#208fb7',
    '#bca477': evil ? '#9d6470' : '#d4c9aa', '#b78a4d': p.gold,
    '#c58e50': p.gold, '#9f713e': evil ? '#6a343e' : '#c4a141',
    '#d3a955': p.gold, '#93729e': evil ? '#a86c78' : '#c5bca1',
    '#d9b8df': p.trim, '#81c1c6': p.window,
  });
  // Existing board paths remain on the small cover cottages. They become gold
  // shutters for G1 and burnt orange shutters for E1, at the same window bounds.
  svg = recolor(svg, {'#dfac4b': evil ? '#db8434' : '#e9b737', '#c28b36': evil ? '#aa542f' : '#c39024'});
  if (evil && id.endsWith('-hall')) {
    // Home's curved hall roof shares seam paths with a straight-roof cottage.
    // Keep the seam paths but clip their loose ends to the existing roof fill.
    const roof = svg.match(/<path d="([^"]+)" fill="#f13e43"\/>/)[1];
    svg = svg.replace('</title>', `</title><defs><clipPath id="team-roof-seams"><path d="${roof}"/></clipPath></defs>`)
      .replace('<g fill="none" stroke="#a32536"', '<g clip-path="url(#team-roof-seams)" fill="none" stroke="#a32536"');
  }
  let detail;
  if (evil) {
    detail = horn(69, 93, false, .8) + horn(291, 93, true, .8)
      + horn(31, 130, false, .6) + horn(329, 130, true, .6)
      + tail(180, 15, .72)
      + `<path d="M76 164h16m-8 0v16h-9m206 57h-11v14h12M82 246l10-10-3-12M272 151l-10 10 3 9-10 8" fill="none" stroke="#b7757e" stroke-width="2"/>`
      + `<g data-detail="devil-pennants"><path d="M49 145H70V199L59 189L49 199Z" fill="#cf3447"/><path d="M290 145H311V199L301 189L290 199Z" fill="#cf3447"/><path d="M52 150H67M293 150H308" fill="none" stroke="#f5cda5"/><path d="M57 175q-8-8 1-8q9 0 4-8m-3 3 3-5 3 5M299 175q-8-8 1-8q9 0 4-8m-3 3 3-5 3 5" fill="none" stroke="#f5cda5" stroke-width="2"/></g>`
      + (id.endsWith('-annex') ? pumpkin(81, 280, 1) + pumpkin(277, 282, .8) : '');
  } else {
    detail = halo(279, 5, 16, 4.2) + halo(180, 145, 13, 3.6)
      + wings(180, 158) + box(110, 230) + box(249, 230)
      + splat(90, 153, .5) + splat(267, 151, .45);
    if (id.endsWith('-hall')) detail += hedge(74, 282, 61) + hedge(225, 282, 61);
  }
  return append(svg, group(p, detail));
}

function yardPiece(svg, team, kind) {
  const p = palettes[team], evil = team === 'google';
  svg = recolor(svg, {
    '#39472d': p.ink, '#ddc5a2': p.stone, '#f5ddb9': evil ? '#ddbaa0' : '#fffbed',
    '#e9d1ae': evil ? '#b9847a' : '#f5edda', '#fff0d2': p.cap,
    '#006b73': p.roof, '#00535d': evil ? '#71303e' : p.roofSide,
    '#63bab4': p.gold, '#93729e': evil ? '#945b62' : '#cabd9c',
    '#ffe22b': evil ? '#ffb525' : '#ffe22b',
  });
  let detail = '';
  if (kind === 'porch') {
    // Fascia and post shoes read as the same gold band as the G1 roofs.
    if (!evil) svg = svg.replace('d="M10 69H630V84H10Z" fill="#229bca"', 'd="M10 69H630V84H10Z" fill="#ffd132"');
    if (evil) {
      detail = horn(34, 40, false, .8) + horn(606, 40, true, .8)
        + `<g data-detail="red-pennants"><path d="M61 91Q118 121 174 91M466 91Q522 121 579 91" fill="none" stroke="#eab57f"/><path d="M67 95l9 28 21-17M103 108l13 28 18-24M139 109l17 23 12-36M472 96l12 28 19-17M508 108l14 28 18-25M546 106l17 24 10-33" fill="#ee4149"/></g>`
        + pumpkin(88, 178, 1) + pumpkin(550, 178, .95) + pumpkin(575, 184, .55);
    } else {
      detail = `<path d="M27 178H57V194H27ZM175 178H205V194H175ZM435 178H465V194H435ZM583 178H613V194H583Z" fill="#ffd132"/>`;
    }
  } else if (kind === 'gate') {
    detail = evil ? horn(28, 125, false, .7) + horn(212, 125, true, .7) + tail(120, 33, .65)
      + `<path d="M19 168l12 12-7 13 11 8M209 193l-8 13 9 14" fill="none" stroke="#945b62"/>`
      : halo(120, 25, 24, 6) + `<g transform="translate(120 67) scale(.7)">${wings(0, 0)}</g>`;
  } else if (kind === 'yard-wall') {
    if (evil) {
      detail = `<g data-detail="spiky-fence" fill="#6e303d"><path d="M38 72H202V86H38Z"/><path d="M41 75V32L49 13L57 32V75ZM69 75V32L77 13L85 32V75ZM97 75V32L105 13L113 32V75ZM125 75V32L133 13L141 32V75ZM153 75V32L161 13L169 32V75ZM181 75V32L189 13L197 32V75Z"/><path d="M49 26v38m28-38v38m28-38v38m28-38v38m28-38v38m28-38v38" stroke="#a75b67" stroke-width="1.5"/></g>`
        + `<path d="M64 90l-5 7 5 9M172 87l8 8-4 9" fill="none" stroke="#80525b"/>`;
    } else detail = hedge(41, 101, 68) + hedge(116, 101, 68);
  } else if (kind === 'lantern') {
    detail = evil ? horn(12, 73, false, .4) + horn(53, 73, true, .4) : halo(32, 43, 13, 3.5);
  } else {
    // Keep every crate and sack path and the full stone contact beneath it.
    // E1 uses cracked rose stone; G1 uses pale clean stone and a low flower lip.
    if (evil) detail = cracks(p);
    else detail = `<g transform="translate(17 113) scale(.7)">${hedge(0, 0, 68)}</g><g transform="translate(194 113) scale(.7)">${hedge(0, 0, 68)}</g>`;
  }
  return append(svg, group(p, detail, kind === 'lantern' ? 2.2 : 2.6));
}

const sources = new Map();
for (const prop of art.props) {
  const base = baseOf(prop);
  if (!base) continue;
  const team = base.startsWith('google') ? 'google' : 'privacy';
  const kind = prop.id.slice(base.length + 1);
  let source;
  if (kind === 'hall' || kind === 'annex') source = `home/wz-${prop.id}.svg`;
  else if (kind === 'porch') source = 'home/p2-porch.svg';
  else if (kind === 'yard-gate') source = 'home/p2-yard-gate.svg';
  else if (kind.startsWith('yard-return')) source = 'home/p2-yard-wall.svg';
  else if (kind === 'lamp-0') source = 'home/lantern.svg';
  else if (kind.startsWith('wall-')) {
    // These two supplies differ by yard. Infer from the unchanged semantic name.
    source = `home/${prop.name}.svg`;
  } else throw Error(`Unexpected base piece: ${prop.id}`);
  const target = source.includes(`wz-${base}`)
    ? `home/${prop.id}-team.svg`
    : `home/${team}-${source.split('/').at(-1).replace(/^p2-/, '')}`;
  const s = fs.readFileSync(root + source, 'utf8');
  const detailKind = kind.startsWith('yard-return') ? 'yard-wall' : kind === 'yard-gate' ? 'gate' : kind === 'lamp-0' ? 'lantern' : kind;
  const themed = kind === 'hall' || kind === 'annex' ? building(s, team, prop.id) : yardPiece(s, team, detailKind);
  if (sources.has(target)) assert.equal(sources.get(target), themed);
  sources.set(target, themed);
  prop.src = target;
  const authored = layout.props.find(p => p.id === prop.id);
  assert.ok(authored, prop.id + ' must exist in authored layout');
  authored.src = target;
}
for (const [file, svg] of sources) fs.writeFileSync(root + file, svg);

// Match ground.py's existing seven-point court, using its exact curve samples.
// The tint is clipped to paving and inserted BEFORE all original ground detail.
function courtPath({x, y}) {
  const rx = 620, ry = 420;
  const points = [[x-rx,y-110],[x-rx*.65,y-ry],[x+rx*.4,y-ry*.9],
    [x+rx,y-100],[x+rx*.9,y+ry*.6],[x+rx*.2,y+ry],[x-rx*.65,y+ry*.8]];
  const q = [points.at(-1), ...points, points[0], points[1]], out = [];
  for (let i=1;i<q.length-2;i++) for (let j=0;j<16;j++) {
    const [a,b,c,d] = q.slice(i-1,i+3), t=j/16;
    out.push([0,1].map(k => (.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t)).toFixed(2)));
  }
  return 'M' + out.map(v => v.join(',')).join('L') + 'Z';
}
let ground = fs.readFileSync(root + 'ground.svg', 'utf8')
  .replace(/\s*<!-- BUILD7 COURTS -->[\s\S]*?<!-- END BUILD7 COURTS -->\s*/, '\n');
const courts = '\n  <!-- BUILD7 COURTS -->\n  <g id="team-base-courts" clip-path="url(#paving-clip)">'
  + bases.map(base => `<path id="${base}-court-tint" d="${courtPath(layout.areas[base])}" fill="${palettes[layout.areas[base].team].court}"/>`).join('')
  + '</g>\n  <!-- END BUILD7 COURTS -->\n';
assert.ok(ground.includes('<g id="rounded-stone-kerbs"'));
ground = ground.replace('<g id="rounded-stone-kerbs"', courts + '  <g id="rounded-stone-kerbs"');
fs.writeFileSync(root + 'ground.svg', ground);
fs.writeFileSync('public/pixi-art/globe/bog-arena-ground.svg', ground.replace('width="8400" height="8200"', 'width="1024" height="1000"'));

for (let i=0;i<art.props.length;i++) {
  const before = originalProps[i], after = art.props[i];
  assert.deepEqual({...after, src: before.src}, before, before.id + ' geometry changed');
  if (!baseOf(before)) assert.deepEqual(after, before, before.id + ' is outside a base');
}
save(root + 'art.json', art);
save(layoutFile, layout);
console.log(`BUILD7: ${sources.size} separate team SVGs, ${art.props.filter(baseOf).length} base props, four clipped courts. Every placement and footprint preserved.`);
