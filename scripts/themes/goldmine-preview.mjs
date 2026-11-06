// Nuggetnook static art-manifest preview. Writes only public/pixi-art/themes/goldmine/.
// Actual in-game screenshots are produced separately by goldmine-ingame.mjs.
import sharp from 'sharp';
import {readFileSync} from 'node:fs';
import {geometry} from '../../rive/web/island-geometry.mjs';
const ART = 'public/pixi-art/themes/goldmine/', DATA = 'rive/web/themes/goldmine/';
const art = JSON.parse(readFileSync(ART + 'art.json', 'utf8')), harbor = JSON.parse(readFileSync(DATA + 'harbor.json', 'utf8'));
const walk = JSON.parse(readFileSync(DATA + 'walk-world.json', 'utf8'));
const K = +(process.env.K || .25), WALK = process.argv.includes('--walk');
const W = Math.round(art.width * K), H = Math.round(art.height * K);
const cache = new Map();
async function raster(src, w, h, flip) {
  const key = `${src}|${Math.round(w)}|${Math.round(h)}|${flip}`;
  if (cache.has(key)) return cache.get(key);
  let img = sharp(src, {density: Math.min(2400, Math.max(30, 72 * K * 4))}).resize(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), {fit: 'fill'});
  if (flip) img = img.flop();
  const buf = await img.png().toBuffer(); cache.set(key, buf); return buf;
}
const comps = [];
// Same turquoise water and wave lattice used beneath Home.
const water=readFileSync('public/pixi-art/water-texture.svg','utf8').replace(/<\?xml[^>]*>/,'');
const inner=water.slice(water.indexOf('>')+1).replace('</svg>','');
const sea=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${art.width} ${art.height}"><defs><pattern id="sea" width="256" height="160" patternUnits="userSpaceOnUse">${inner}</pattern></defs><rect width="100%" height="100%" fill="url(#sea)"/></svg>`);
comps.push({input:await sharp(sea).png().toBuffer(),left:0,top:0});
async function add(src, x, y, w, h, flip = false) {
  const L = Math.round(x * K), T = Math.round(y * K), ww = Math.round(w * K), hh = Math.round(h * K);
  if (ww < 1 || hh < 1 || L > W || T > H || L + ww < 0 || T + hh < 0) return;
  const buf = await raster(src, ww, hh, flip);
  // crop anything that hangs off the canvas
  const cl = Math.max(0, -L), ct = Math.max(0, -T), cw = Math.min(ww - cl, W - Math.max(0, L)), ch = Math.min(hh - ct, H - Math.max(0, T));
  if (cw <= 0 || ch <= 0) return;
  const input = cl || ct || cw < ww || ch < hh ? await sharp(buf).extract({left: cl, top: ct, width: cw, height: ch}).toBuffer() : buf;
  comps.push({input, left: Math.max(0, L), top: Math.max(0, T)});
}
// ground: the full ground SVG (the tiles are crops of it)
comps.push({input: await sharp(ART + 'ground.svg', {density: 72 * K}).resize(W, H).png().toBuffer(), left: 0, top: 0});
for (const f of art.flats) await add(ART + f.src, f.topLeft ? f.x : f.x - f.width / 2, f.topLeft ? f.y : f.y - f.height, f.width, f.height, f.flip);
{const dk=art.previewHarbor; await add(ART+dk.src,dk.x,dk.y,dk.width,dk.height);}
for (const f of art.floating ?? []) await add(ART+f.src,f.x-f.width/2,f.y-f.height/2,f.width,f.height);
for (const dk of art.decks) await add(ART + dk.src, dk.x, dk.y, dk.width, dk.height);
// boats (bottom layer of the standing things), then props and Duckies sorted by y
const things = art.props.map(p => ({...p, kind: 'prop'}));
for (const b of harbor.boats) things.push({src: 'public/pixi-art/boat-sail.svg', x: b.x, y: b.y + 30, width: 188, height: 188 * 1.15, anchor: {x: .5, y: .82}, scale: 1, raw: true});
const geo = geometry(walk);
// The 40 sleeping Duckies (world.json sleepSpots), drawn from the game's own pose sprites at the game's size
{
  const world = JSON.parse(readFileSync(DATA + 'world.json', 'utf8')), poses = JSON.parse(readFileSync('src/pixi/sleep-poses.json', 'utf8'));
  for (const [pose, list] of Object.entries(world.sleepSpots ?? {})) for (const spot of list) {
    const p = poses.poses[pose], tree = pose === 'nod' ? art.props.find(q => q.id === spot[0]) : null;
    const [x, y, flip] = tree ? [tree.x + spot[1], tree.y + 14, spot[2]] : spot;
    const u = p.k * .81 * (.88 * .24 * 3) / 3, [x0, , x1, y1] = p.box;
    for (const layer of p.layers) {
      const f = 'public' + layer.src, m = await sharp(f).metadata(), w = m.width / poses.F * u, h = m.height / poses.F * u;
      const cx = (x0 + x1) / 2 * u, left = flip ? x - (w - cx) : x - cx;
      things.push({src: f, raw: true, x, y: y + .01, width: w, height: h, anchor: {x: (x - left) / w, y: y1 * u / h}, scale: 1, flip});
    }
  }
}
things.sort((a, b) => a.y - b.y);
for (const t of things) {
  const w = t.width * t.scale, h = t.height * t.scale;
  await add(t.buf ?? (t.raw ? t.src : ART + t.src), t.x - w * t.anchor.x, t.y - h * t.anchor.y, w, h, t.flip);
}
if (WALK) {
  const cells = []; const STEP = 30;
  for (let y = 0; y < art.height; y += STEP) for (let x = 0; x < art.width; x += STEP) if (!geo.walkable(x, y)) cells.push(`<rect x="${x}" y="${y}" width="${STEP}" height="${STEP}"/>`);
  const ob = walk.obstacles.map(o => o.poly ? `<path d="M${o.poly.join(' L')} Z"/>` : `<ellipse cx="${o.x}" cy="${o.y}" rx="${o.rx}" ry="${o.ry}"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${art.width} ${art.height}"><g fill="#ff0000" opacity=".22">${cells.join('')}</g><g fill="none" stroke="#ff00ff" stroke-width="6">${ob}</g></svg>`;
  comps.push({input: await sharp(Buffer.from(svg)).png().toBuffer(), left: 0, top: 0});
}
const island = await sharp({create: {width: W, height: H, channels: 4, background: art.sea}}).composite(comps).png().toBuffer();
if (process.env.OUT) {await sharp(island).png().toFile(process.env.OUT); console.log('wrote', process.env.OUT); process.exit(0);}
await sharp(island).resize(1200,900,{fit:'fill'}).png().toFile('../concepts/themes/work/goldmine/preview.png');
await sharp(island).png().toFile('../concepts/themes/work/goldmine/goldmine-preview.png');
console.log('goldmine preview',W,H,things.length);
