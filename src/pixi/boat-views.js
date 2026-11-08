// boss 5 Nov: the sailboat turns through real angles. Views of the same boat seen from the game's 3/4 camera (now a
// 48-frame spin in public/pixi-art/boat/spin/, 7.5 degrees apart, traced to SVG; originals archived outside public/; any count works) are listed in public/pixi-art/boat/views.json; the view nearest the boat's heading is
// drawn, with hysteresis so it never flickers at a sector border. Without the manifest the old single side view is used,
// mirrored for westward headings, exactly as before.
// Headings follow the game: atan2(dx, dy), so 0 = south (toward the camera), PI/2 = east, -PI/2 = west, PI = north.
import {Assets} from 'pixi.js';

const DIR = '/pixi-art/boat/';
const SECTOR = {s: 0, se: 45, e: 90, ne: 135, n: 180, nw: -135, w: -90, sw: -45};   // degrees, game heading
const RAD = Math.PI / 180;
const HYST = 3 * RAD;   // a new view must be this much nearer than the shown one before it takes over (48 views 7.5 deg apart)
export const LEGACY_SEAT = {x: 45, y: -48};   // feet on the bench of boat-sail.svg drawn 255 wide, anchor .5/.82, facing east
const art = (src, resolution = 1.5) => ({src, data: {resolution, autoGenerateMipmaps: true}});   // an SVG is rasterised once at resolution x its viewBox (spin SVGs: 1.25 -> 800x700, 2 px per game px), a PNG keeps its pixels and resolution only sets its logical size; mipmaps keep them sharp with no sparkle
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
    // Hull foreground in every view; rear views additionally put the rig over the rider.
    const deg = v.deg ?? v.heading ?? SECTOR[key];
    const anchor = v.anchor ?? m.anchor ?? [.5, .82];
    const [sx, sy] = v.seat ?? m.seat ?? [LEGACY_SEAT.x, LEGACY_SEAT.y];
    // seat is anchor-relative in drawn units, as seen on screen (already mirrored for a mirrored view)
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
      // the view to show for a heading; `current` keeps its place until another view is clearly nearer
      pick(heading, current) {
        let best = views[0], bestD = Infinity;
        for (const v of views) {const d = diff(heading, v.angle); if (d < bestD) {best = v; bestD = d;}}
        const cur = current && byKey.get(current);
        if (cur && cur !== best && diff(heading, cur.angle) < bestD + HYST) return cur;
        return best;
      },
      // put a view on a sprite: texture, anchor, size, mirror (texture: v.front for the cut-out drawn over the Ducky)
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
