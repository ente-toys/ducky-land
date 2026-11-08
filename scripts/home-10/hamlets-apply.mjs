// The five hamlets, copied from GPT's blueprints (scripts/home-10/hamlets/<h>.json, art in public/pixi-art/home-hamlets/<h>/).
// Called by homes-apply.mjs with the expansion E and the homes patch P. Places nothing by taste: every object sits where the
// blueprint drew it (map: blueprint pixel bp -> world point at, k world units per pixel), back to front by the layout's order.
// Hand fixes per hamlet live in homes.json: skip (files not placed), drop (ids left out), nudge ({id: [dx, dy]} world units),
// connect (hand lanes joining the hamlet lane to the main loop), roads (base road ids this hamlet replaces).
import {readFileSync, existsSync} from 'node:fs';
import {inPoly} from '../../rive/web/island-geometry.mjs';
const DECAL = /^(grass|pebble|path-stone|sand-specks|flowers?-tiny|flower-single|meadow|wild-pink|flowers-(daisy|pink)\.)/;
const HOME = /^(house|cottage)-(?!flowerbed)/;
const WORK = /^(bakery|bread-oven|bread-cart|garden-shed|bandstand|harvest-barn|barn|windmill|grain-silo|kiln|pottery-drying-rack|smokehouse|lighthouse|fishing-net-rack|rowing-boat-cradle|drying-fish-rack|bread-rack|seed-stall|vegetable-bed)/;
const BUILDING = /^(house|cottage-(?!flowerbed)|bakery|harvest-barn|barn|windmill|grain-silo|smokehouse|lighthouse|garden-shed|bandstand|bread-oven|kiln)/;
const TREE = /^(tree|oak|birch)/;
const NOSOLID = /smoke|^duck-sailboat|^square-paving/;
const r1 = v => Math.round(v * 10) / 10;
const svgBox = src => {const s = readFileSync('public' + src, 'utf8'), vb = s.match(/viewBox="([^"]+)"/)[1].trim().split(/[\s,]+/).map(Number); return vb;};
const segDist = (x, y, a, b) => {const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);};
const lineDist = (x, y, p) => {let d = Infinity; for (let i = 0; i < p.length - 1; i++) d = Math.min(d, segDist(x, y, p[i], p[i + 1])); return d;};

function footprintFor(file, x, y, w) {
  if (NOSOLID.test(file)) return null;
  if (TREE.test(file)) return {x, y: y - 10, rx: Math.max(12, w * .09), ry: 14};
  if (BUILDING.test(file)) {const rx = w * .4, ry = Math.min(70, Math.max(26, w * .14)); return {x, y: y - ry - 18, rx, ry};}
  if (/^fence|vegetable-fence/.test(file)) return {x, y: y - 8, rx: w * .5, ry: 12};
  if (/^(vegetable-bed|crop|wheat-bed|cabbage-bed|seedling-bed|square-flowerbed|cottage-flowerbed)/.test(file)) return {x, y: y - w * .12, rx: w * .45, ry: Math.min(60, w * .14)};
  return {x, y: y - Math.min(12, w * .08), rx: Math.max(10, w * .3), ry: Math.max(8, Math.min(24, w * .12))};
}

export function applyHamlets(E, P) {
  const report = {};
  const water = [...(E.riverWater ?? []).map(w => w.poly), E.water?.poly].filter(Boolean);
  for (const [h, cfg] of Object.entries(P.hamlets ?? {})) {
    const file = `scripts/home-10/hamlets/${h}.json`;
    const {at, bp, k} = cfg.map, W = ([px, py]) => [at[0] + (px - bp[0]) * k, at[1] + (py - bp[1]) * k];
    const rect = [W([0, 0]), W([1536, 1024])];
    // 1. clear the old hamlet: every expansion prop of this hamlet, the verges and any other zone's prop inside the frame
    const inRect = p => p.x > rect[0][0] && p.x < rect[1][0] && p.y > rect[0][1] && p.y < rect[1][1];
    const before = E.props.length;
    E.props = E.props.filter(p => !(p.zone === h || (inRect(p) && p.zone !== 'commons')));
    E.obstacles = E.obstacles.filter(o => !(o.x > rect[0][0] && o.x < rect[1][0] && o.y > rect[0][1] && o.y < rect[1][1] && !o.keep));
    E.roads = E.roads.filter(r => !(cfg.roads ?? []).includes(r.id));
    const com = E.communities.find(c => c.id === h);
    if (!existsSync(file)) {report[h] = {cleared: before - E.props.length, placed: 0}; if (com) {com.homes = []; com.workplaces = [];} continue;}
    const L = JSON.parse(readFileSync(file));
    // 2. the square and the lane, painted by ground.mjs as the centre's paths
    const square = L.square.map(W), lane = L.lane.map(W);
    E.roads.push({id: `hamlet-${h}-square`, kind: 'lane', poly: square, width: 0}, {id: `hamlet-${h}-lane`, kind: 'lane', poly: lane, width: 0});
    for (const c of cfg.connect ?? []) E.roads.push({kind: 'lane', width: 80, ...c, id: `hamlet-${h}-${c.id}`});
    const lines = E.roads.filter(r => r.points && !String(r.id).startsWith(`hamlet-${h}-`)).map(r => ({p: r.points, w: Math.max(r.width ?? 56, r.kind === 'main' ? 128 : 104)}));
    const conn = (cfg.connect ?? []).map(c => ({p: c.points, w: c.width ?? 80}));
    const onWater = (x, y, pad) => !inPoly(x, y, E.coast) || water.some(w => inPoly(x, y, w)) || water.some(w => {for (let i = 0; i < w.length; i++) if (segDist(x, y, w[i], w[(i + 1) % w.length]) < pad) return true; return false;});
    const onRoad = (x, y, pad) => [...lines, ...conn].some(l => lineDist(x, y, l.p) < l.w / 2 + pad) || inPoly(x, y, lane);
    const kept = E.props.filter(p => p.footprint && inRect(p));
    // 3. the objects, back to front
    const objs = [...L.objects].sort((a, b) => a.drawOrder - b.drawOrder), decals = [], placed = [], dropped = [];
    objs.forEach((o, i) => {
      if ((cfg.skip ?? []).includes(o.file) || (cfg.drop ?? []).includes(o.id)) return;
      const src = `/pixi-art/home-hamlets/${h}/${o.file}`; if (!existsSync('public' + src)) {dropped.push(o.id + ':nofile'); return;}
      const vb = svgBox(src), w = o.width * k, hgt = w * vb[3] / vb[2], name = o.file.replace(/\.svg$/, '');
      let [x, y] = W([o.x, o.y]); const n = cfg.nudge?.[o.id]; if (n) {x += n[0]; y += n[1];}
      if (DECAL.test(o.file) && o.width < 70) {
        if (onWater(x, y, 10) || (!/path-stone|pebble/.test(o.file) && onRoad(x, y, 0))) return;
        decals.push({src, x: r1(x), y: r1(y), width: r1(w), height: r1(hgt), hamlet: h}); return;
      }
      const fp = footprintFor(name, x, y, w);
      const r = fp ? Math.max(fp.rx * .6, 10) : 10;
      const bad = onWater(x, y - (fp ? fp.ry : 0), fp ? Math.min(fp.ry, 30) : 6) ? 'water' : fp && onRoad(fp.x, fp.y, Math.min(fp.ry, 20)) ? 'road'
        : fp && kept.find(q => Math.hypot(q.footprint.x - fp.x, (q.footprint.y - fp.y) * 2) < q.footprint.rx + fp.rx * .8) ? 'prop' : null;
      if (bad && !n) {dropped.push(`${o.id}:${bad}`); return;}
      const p = {id: `hamlet-${h}-${o.id}`, name, asset: name, src, x: r1(x), y: r1(y), width: r1(w), height: r1(hgt), scale: 1, anchor: {x: .5, y: 1},
        resolution: 1.5, zone: h, noShadow: true, order: o.drawOrder};
      if (fp) p.footprint = {x: r1(fp.x), y: r1(fp.y), rx: r1(fp.rx), ry: r1(fp.ry)};
      if (HOME.test(o.file)) {p.communityRole = 'home'; p.door = [r1(x + (cfg.doors?.[o.id] ?? 0)), r1(y + 40)];}
      else if (WORK.test(o.file)) p.communityRole = 'workplace';
      placed.push(p);
    });
    E.props.push(...placed);
    E.hamletDecals = [...(E.hamletDecals ?? []).filter(d => d.hamlet !== h), ...decals];
    E.hamletFrames = {...(E.hamletFrames ?? {}), [h]: [rect[0][0], rect[0][1], rect[1][0], rect[1][1]]};
    if (com) {
      com.homes = placed.filter(p => p.communityRole === 'home').map(p => p.id);
      com.workplaces = placed.filter(p => p.communityRole === 'workplace').map(p => p.id);
      const cx = square.reduce((s, q) => s + q[0], 0) / square.length, cy = square.reduce((s, q) => s + q[1], 0) / square.length;
      const c = cfg.place ?? [Math.round(cx), Math.round(cy)]; com.center = c; com.green = [c[0], c[1], 300, 140];
      const pl = E.places.find(q => q.id === h); if (pl) pl.point = c;
    }
    report[h] = {cleared: before - E.props.length + placed.length, placed: placed.length, decals: decals.length, dropped};
  }
  return report;
}
