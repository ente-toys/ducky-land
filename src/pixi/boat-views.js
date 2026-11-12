import {Assets} from 'pixi.js';

const DIR = '/pixi-art/boat/';
const SECTOR = {s: 0, se: 45, e: 90, ne: 135, n: 180, nw: -135, w: -90, sw: -45};
const RAD = Math.PI / 180;
const HYST = 3 * RAD;
export const LEGACY_SEAT = {x: 45, y: -48};
const art = (src, resolution = 1.5) => ({src, data: {resolution, autoGenerateMipmaps: true}});
const diff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

async function fromManifest() {
  const res = await fetch(`${DIR}views.json`, {cache: 'no-cache'});
  if (!res.ok) throw new Error('no boat views');
  const m = await res.json();
  const entries = Object.entries(m.views || {});
  if (!entries.length) throw new Error('empty boat views');
  const views = await Promise.all(entries.map(async ([key, v]) => {
    const resolution = v.resolution ?? m.resolution ?? 1.5;
    const [texture, front, rigFront] = await Promise.all([
      Assets.load(art(DIR + v.file, resolution)),
      v.front ? Assets.load(art(DIR + v.front, resolution)).catch(() => null) : null,
      v.rigFront ? Assets.load(art(DIR + v.rigFront, resolution)) : null,
    ]);
    const deg = v.deg ?? v.heading ?? SECTOR[key];
    const anchor = v.anchor ?? m.anchor ?? [.5, .82];
    const [sx, sy] = v.seat ?? m.seat ?? [LEGACY_SEAT.x, LEGACY_SEAT.y];
    return {key, texture, angle: deg * RAD, mirror: Boolean(v.mirror), anchor, width: v.width ?? m.width ?? 255, seat: {x: sx, y: sy}, front, rigFront,
      transition: v.transition ?? m.transition ?? 'cut'};
  }));
  return views;
}

async function legacy() {
  const texture = await Assets.load(art('/pixi-art/boat-sail.svg'));
  const one = (key, deg, mirror) => ({key, texture, angle: deg * RAD, mirror, anchor: [.5, .82], width: 255,
    seat: {x: mirror ? -LEGACY_SEAT.x : LEGACY_SEAT.x, y: LEGACY_SEAT.y}});
  return [one('e', 90, false), one('w', -90, true)];
}

let ready = null;
export function loadBoatViews() {
  ready ??= fromManifest().catch(() => legacy()).then(views => {
    const byKey = new Map(views.map(v => [v.key, v]));
    return {
      views, byKey,
      pick(heading, current) {
        let best = views[0], bestD = Infinity;
        for (const v of views) {const d = diff(heading, v.angle); if (d < bestD) {best = v; bestD = d;}}
        const cur = current && byKey.get(current);
        if (cur && cur !== best && diff(heading, cur.angle) < bestD + HYST) return cur;
        return best;
      },
      apply(sprite, v, scaleMul = 1, texture = v.texture) {
        sprite.texture = texture;
        sprite.anchor.set(v.anchor[0], v.anchor[1]);
        const k = v.width / texture.width * scaleMul;
        sprite.scale.set(v.mirror ? -k : k, k);
      },
    };
  });
  return ready;
}
