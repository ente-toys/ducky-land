// Library island preview: ground tiles + decks + flats + props (y-sorted) + moored boats + a few Duckies for scale,
// rendered from art.json exactly as the engine places them, then put beside the concept.
//   node scripts/themes/library-preview.mjs [--walk]     (--walk overlays the walk map: blocked = red, obstacles = outlines)
// Writes working PNGs under concepts/themes/work/library; OUT overrides the review image.
import sharp from 'sharp';
import {readFileSync} from 'node:fs';
import {geometry} from '../../rive/web/island-geometry.mjs';
const ART = 'public/pixi-art/themes/library/', DATA = 'rive/web/themes/library/';
const art = JSON.parse(readFileSync(ART + 'art.json', 'utf8')), harbor = JSON.parse(readFileSync(DATA + 'harbor.json', 'utf8'));
const walk = JSON.parse(readFileSync(DATA + 'walk-world.json', 'utf8'));
const K = +(process.env.K || .3), WALK = process.argv.includes('--walk');
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
// the engine's harbor jetty, stood in for by home's jetty 1 so the preview shows a pier there
{
  const {foot, tip} = harbor.jetty, len = Math.hypot(tip[0] - foot[0], tip[1] - foot[1]);
  await add('public/pixi-art/bridge-jetty-1.svg', foot[0] - 97.6, foot[1] - 30, 229.2, len + 60);
}
for(const f of art.floating??[])await add(ART+f.src,f.x-f.width/2,f.y-f.height/2,f.width,f.height);
for (const dk of art.decks) await add(ART + dk.src, dk.x, dk.y, dk.width, dk.height);
// Match loadThemeArt's contact shadows rather than judging a flatter renderer.
const shadowMarks=art.props.filter(p=>p.shadow!==false&&!/bunting|banner|flag|bridge|blanket|lily|shell|reeds|rug|path|paving/i.test(p.name??p.asset??p.src)).map(p=>{
 const rx=Math.max(8,Math.min(300,p.width*(p.scale??1)*.36)),ry=rx*.3;
 return `<ellipse cx="${p.x+rx*.06}" cy="${p.y+ry*.1}" rx="${rx}" ry="${ry}" fill="#3c5a2a" opacity=".15"/>`;
});
comps.push({input:await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${art.width} ${art.height}">${shadowMarks.join('')}</svg>`)).png().toBuffer(),left:0,top:0});
// boats (bottom layer of the standing things), then props and Duckies sorted by y
const things = art.props.map(p => ({...p, kind: 'prop'}));
for (const b of harbor.boats) things.push({src: 'public/pixi-art/boat-sail.svg', x: b.x, y: b.y + 30, width: 188, height: 188 * 1.15, anchor: {x: .5, y: .82}, scale: 1, raw: true});
const duckManifest=JSON.parse(readFileSync('public/pixi-duck/manifest.json','utf8'));
const view=duckManifest.views[1];
const ordered=[...view.parts.filter(p=>['foot','toe'].includes(p.role)),...view.parts.filter(p=>!['foot','toe','shadow'].includes(p.role))];
const duckSvg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="600" height="666" viewBox="0 0 600 666">${ordered.map(p=>`<image x="${p.rect[0]}" y="${p.rect[1]}" width="${p.rect[2]}" height="${p.rect[3]}" xlink:href="data:image/svg+xml;base64,${readFileSync('public'+p.url).toString('base64')}"/>`).join('')}</svg>`;
const beds = JSON.parse(readFileSync(ART+'resolved-sleepers.json','utf8'));
const geo = geometry({...walk,obstacles:[...walk.obstacles,...beds.map(b=>({x:b.x,y:b.y,rx:b.r+35,ry:45}))]});
let s = 11; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
for (let n = 0, tries = 0; n < +(process.env.DUCKS || 100) && tries < 50000; tries++) {
  const x = rnd() * art.width, y = rnd() * art.height;
  if (!geo.walkable(x, y)|| things.some(t=>Math.hypot(t.x-x,t.y-y)<160)) continue;
  things.push({buf: Buffer.from(duckSvg), x, y, width: 126.72, height: 140.66, anchor: {x: view.ground[0]/600, y: view.ground[1]/666}, scale: 1, flip: rnd() < .5}); n++;
}
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
if (process.env.GRID) {   // concept-pixel grid (the builder's T() mapping), for picking places
  const S = 4.5, OX = 800, OY = 1000, L = [];
  for (let c = 0; c <= 1550; c += 50) {const x = OX + (c - 65) * S; L.push(`<path d="M${x} 0 V${art.height}" stroke="#000" stroke-width="${c % 100 ? 2 : 5}" opacity=".35"/>`, c % 100 ? '' : `<text x="${x + 8}" y="${OY - 300}" font-size="70">${c}</text>`);}
  for (let c = 0; c <= 1000; c += 50) {const y = OY + (c - 120) * S; L.push(`<path d="M0 ${y} H${art.width}" stroke="#000" stroke-width="${c % 100 ? 2 : 5}" opacity=".35"/>`, c % 100 ? '' : `<text x="250" y="${y - 8}" font-size="70">${c}</text>`);}
  comps.push({input: await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${art.width} ${art.height}">${L.join('')}</svg>`)).png().toBuffer(), left: 0, top: 0});
}
if (WALK) {
  const cells = []; const STEP = 30;
  for (let y = 0; y < art.height; y += STEP) for (let x = 0; x < art.width; x += STEP) if (!geo.walkable(x, y)) cells.push(`<rect x="${x}" y="${y}" width="${STEP}" height="${STEP}"/>`);
  const ob = walk.obstacles.map(o => o.poly ? `<path d="M${o.poly.join(' L')} Z"/>` : `<ellipse cx="${o.x}" cy="${o.y}" rx="${o.rx}" ry="${o.ry}"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${art.width} ${art.height}"><g fill="#ff0000" opacity=".22">${cells.join('')}</g><g fill="none" stroke="#ff00ff" stroke-width="6">${ob}</g></svg>`;
  comps.push({input: await sharp(Buffer.from(svg)).png().toBuffer(), left: 0, top: 0});
}
const island = await sharp({create: {width: W, height: H, channels: 4, background: art.sea}}).composite(comps).png().toBuffer();
const out=process.env.OUT||'../concepts/themes/work/library/library-preview.png';
await sharp(island).png().toFile(out);
if(!WALK)await sharp(island).resize({width:1160}).png().toFile('../concepts/themes/work/library/preview.png');
console.log('preview',out,W,H,things.length);
