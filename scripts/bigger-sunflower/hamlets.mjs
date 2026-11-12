import {readFileSync} from 'node:fs';
const here = new URL('./', import.meta.url), A = new URL('../../public/pixi-art/themes/sunflower/', import.meta.url);
export const config = JSON.parse(readFileSync(new URL('hamlets.json', here)));
export const layouts = Object.fromEntries(Object.keys(config).map(h => [h, JSON.parse(readFileSync(new URL(`hamlets/${h}.json`, here)))]));

export const BUILDING = /cottage|barn|windmill|granary|shop-striped|florist-and-parcel|seed-merchant|seed-shed|timber-cabin|honey-market-stall|bakery-dome-oven/;
export const TREE = /^tree-/;
export const DECAL = /^(grass-tuft|white-meadow-flowers|coral-meadow-flowers|daisy|flower-white-daisy|flowers-blue-bells|flowers-coral-pair|small-smooth-pebble|tiny-round-pebble|stepping-stones|mossy-rock)/;
const BED = /sunflower-(bed|field|patch|garden|five|three|clump)|sunflowers-|vegetable-bed|crop-(bed|row)|seedling-coldframe|square-sunflower-planter|honey-stall-flower-bed|sunflower-standard-flower-island/;
const r1 = v => Math.round(v * 10) / 10;
const box = new Map();
export function viewBox(h, file) {
  const key = h + '/' + file;
  if (!box.has(key)) box.set(key, readFileSync(new URL(`hamlets/${h}/${file}`, A), 'utf8').match(/viewBox="([^"]+)"/)[1].trim().split(/[\s,]+/).map(Number));
  return box.get(key);
}
export const mapper = h => {const {at, bp, k, kp = k} = config[h].map, [kx, ky] = [kp].flat().length > 1 ? kp : [kp, kp]; return ([px, py]) => [at[0] + (px - bp[0]) * kx, at[1] + (py - bp[1]) * ky];};
const rings = g => !g ? [] : typeof g[0][0] === 'number' ? [g] : g;
export function hamletGround(h) {
  const L = layouts[h], W = mapper(h);
  return [...rings(L.square), ...rings(L.lane), ...rings(L.nursery), ...(L.secondaryLanes ?? []), ...(L.approaches ?? [])].map(r => r.map(p => W(p).map(r1)));
}
export function footprint(file, x, y, w) {
  if (DECAL.test(file)) return null;
  if (TREE.test(file)) return {x, y: y - 10, rx: Math.max(16, w * .09), ry: 16};
  if (BUILDING.test(file)) {const rx = w * .4, ry = Math.min(70, Math.max(26, w * .14)); return {x, y: y - ry - 18, rx, ry};}
  if (/apiary-fence/.test(file)) return {x, y: y - 8, rx: w * .5, ry: 12};
  if (BED.test(file)) return {x, y: y - w * .12, rx: w * .45, ry: Math.min(60, w * .14)};
  return {x, y: y - Math.min(12, w * .08), rx: Math.max(10, w * .3), ry: Math.max(8, Math.min(24, w * .12))};
}
export function hamletObjects(h) {
  const cfg = config[h], W = mapper(h), k = cfg.map.k;
  const objs = [...layouts[h].objects].sort((a, b) => a.drawOrder - b.drawOrder).filter(o => !(cfg.skip ?? []).includes(o.file));
  const height = o => o.width * viewBox(h, o.file)[3] / viewBox(h, o.file)[2];
  const buildings = objs.filter(o => BUILDING.test(o.file)), parent = new Map();
  for (const o of objs) if (!BUILDING.test(o.file) && !TREE.test(o.file)) {
    const b = buildings.find(b => Math.abs(o.x - b.x) < b.width * .55 && o.y > b.y - height(b) * .5 && o.y < b.y + 40);
    if (b) parent.set(o, b);
  }
  for (const id of Object.keys(cfg.nudge ?? {})) if (!objs.some(o => o.id === id)) throw Error(`${h}: nudge ${id}: no such object`);
  const at = o => {
    const b = parent.get(o), n = cfg.nudge?.[o.id] ?? [0, 0];
    if (!b) {const [x, y] = W([o.x, o.y]); return [x + n[0], y + n[1]];}
    const [bx, by] = at(b); return [bx + (o.x - b.x) * k + n[0], by + (o.y - b.y) * k + n[1]];
  };
  return objs.map(o => {
    const w = o.width * k, ht = w * height(o) / o.width, name = o.file.replace(/\.svg$/, ''), [x, y] = at(o);
    return {o, id: o.id, file: o.file, name, x: r1(x), y: r1(y), w: r1(w), h: r1(ht), order: o.drawOrder, fp: footprint(o.file, x, y, w),
      building: BUILDING.test(o.file), decal: DECAL.test(o.file), parent: parent.get(o)?.id};
  });
}
