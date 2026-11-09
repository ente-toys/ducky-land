// boss 6 Nov: "the same sleeping Duckies as home on every island". Where the 28 sleepers lie, for ANY island map, as pure data
// (no pixi, no vite) so the game, the room server, scripts/theme-index.mjs and the tests all resolve the same beds.
// Home keeps its hand-picked SLEEP_SPOTS (placements.js passes home's own no-go places). A themed island lists the same
// shape and counts in its world.json "sleepSpots", plus optional "sleepAvoid" ellipses [{x,y,rx,ry}] and "paths" polylines.
// Points are [x, y, flip]; nod is [tree prop id, side nudge, flip] and leans on that tree's trunk.
import poses from './sleep-poses.json' with {type: 'json'};

export const SLEEP_SIZE = .81;   // boss 5 Nov: sleepers 10% smaller, then 10% more (.9 x .9); the only size knob (sleeper.js reads it)
export const SLEEP_ROOT = .88 * .24 * 3;   // a Ducky rig's world scale (engine.js)
// world half width of each pose (rootScale = the rig root's world scale; the art inside is 1/3 of it)
export const sleepHalfWidths = (rootScale = SLEEP_ROOT) => Object.fromEntries(Object.entries(poses.poses).map(([n, p]) => [n, (p.box[2] - p.box[0]) * p.k * SLEEP_SIZE * rootScale / 3 / 2]));

// boss 5 Nov: where the 28 sleeping Duckies lie on HOME, hand-picked off the island art. nod leans on a real tree trunk;
// leaf, hammock and rock in the gardens; book by the library and the stalls; chair on the beach sand facing the sea; wing
// and box on quiet lawn. Each spot is checked on load: never on a bridge, jetty, stair, water, path centre or a prop, the
// same pose >= 900 apart.
export const SLEEP_SPOTS = {
  nod: [['tree-0', 0, false], ['tree-19', 0, true], ['tree-1', 0, false], ['tree-20', 0, true]],
  hammock: [[900, 1640, false], [3920, 1120, true]],
  rock: [[2150, 1130, false], [1200, 1420, true], [3950, 3260, false]],   // the island has no loose garden rocks: each sits by a bush
  leaf: [[1820, 1500, false], [4790, 1420, true], [1480, 3110, false], [3560, 2480, true]],
  book: [[2660, 1290, false], [1380, 1850, true], [4320, 3230, false], [2230, 2400, true]],   // library, west stall, ice-cream stall, plaza stall
  chair: [[5150, 2875, true], [4575, 2225, true]],   // the deck chair faces left: flipped to face the sea east (beach is ~900 wide)
  wing: [[700, 2250, true], [3080, 3260, false], [3350, 1375, true], [4980, 1850, false], [2300, 2750, true]],
  box: [[780, 2600, false], [2000, 3150, true], [3350, 850, false], [4375, 2000, true]],
};
export const SLEEP_COUNTS = Object.fromEntries(Object.entries(SLEEP_SPOTS).map(([pose, list]) => [pose, list.length]));
export const SLEEP_TOTAL = 40; // approved residents per island, with all eight poses
export const HOME_SLEEP_TOTAL = 100; // boss 18:50: Home adds sixty outer residents, preserving the original forty
export const BASE_SLEEP_TOTAL = Object.values(SLEEP_COUNTS).reduce((a, b) => a + b, 0);

const segDist = (x, y, a, b) => {const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);};
const inEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
const half = p => p.width * (p.scale ?? 1) / 2;
// a themed island's buildings get a smaller keep-off (a sleeper may lie by a wall); its flat decor never blocks a bed
const THEME_BUILDING = /library|lighthouse|stall|hall|house|barn|windmill|tower|cafe|shop|kiosk|shelf|castle|cottage|museum|bakery|greenhouse/i;
const THEME_DECOR = /lily|bunting|banner|boat|flag|grass|tuft|petal|pebble|shell|rug|blanket|paving|path|puddle|shadow|clover|daisy/i;
const HOME_DECOR = /lily|bunting|banner|boat/i, HOME_BUILDING = /library|lighthouse|Market stall/i;

/**
 * Resolve an island's sleep spots against its walking map and props. Returns the beds that pass ({x, y, pose, r, flip, tree})
 * with `.bad` = the dropped ones and why. opts (home passes its own): spots, avoid [{x,y,rx,ry,name?}], pathDist(x,y),
 * steps(x,y), home (home's prop rules), occupied (already resolved beds to keep clear of).
 */
export function resolveSleepSpots(world, props, walkable, sizes = sleepHalfWidths(), {spots, avoid = [], pathDist = null, steps = () => false, home = false, warn = true, occupied = []} = {}) {
  const coast = world.coast, coastDist = (x, y) => Math.min(...coast.map((a, i) => segDist(x, y, a, coast[(i + 1) % coast.length])));
  const islet = (x, y) => (world.islets ?? []).some(a => inEllipse(x, y, a[0], a[1], a[2] + 60, a[3] + 60));
  const deck = (x, y) => (world.walkways ?? []).some(b => segDist(x, y, b.a, b.b) < b.w / 2 + 90) || (world.bridges ?? []).some(b => Math.abs(x - b.x) < b.w / 2 + 80 && Math.abs(y - b.y) < b.h / 2 + 80);
  const lines = world.paths ?? [];
  const onPath = pathDist ?? ((x, y) => lines.length ? Math.min(...lines.flatMap(l => l.slice(1).map((b, i) => segDist(x, y, l[i], b)))) : Infinity);
  const solid = props.filter(p => p.contact !== false && !(home ? HOME_DECOR : THEME_DECOR).test(p.asset || p.name || '') && Number.isFinite(p.x) && p.width > 0), building = home ? HOME_BUILDING : THEME_BUILDING;
  const out = [], bad = [];
  const why = (x, y, pose, r, tree) => {
    if (tree) return null;   // a nod leans on its trunk on purpose
    if (!walkable(x, y) || !walkable(x - r * .8, y) || !walkable(x + r * .8, y)) return 'not ground';
    if (islet(x, y) || deck(x, y) || steps(x, y)) return 'deck/bridge/stair';
    if (onPath(x, y) < 60 + r * .35) return 'path';
    const zone = avoid.find(a => inEllipse(x, y, a.x, a.y, a.rx, a.ry));
    if (zone) return zone.name ?? `avoid ${zone.x},${zone.y}`;
    if (coastDist(x, y) < r * .6 + 30) return 'water';
    const hit = solid.find(p => Math.hypot(x - p.x, (y - p.y) * 1.6) < half(p) * (building.test(p.name) ? .35 : .8) + r + 12
      || (p.y > y - 20 && p.y - y < p.height * (p.scale ?? 1) * .9 && Math.abs(x - p.x) < half(p) + r * .6));
    return hit ? `prop ${hit.id}` : null;
  };
  for (const [pose, list] of Object.entries(spots ?? {})) for (const spot of Array.isArray(list) ? list : []) {
    const r = sizes[pose], tree = pose === 'nod' && props.find(p => p.id === spot?.[0]);
    const [x, y, flip] = tree ? [tree.x + (spot[1] ?? 0), tree.y + 14, spot[2]] : Array.isArray(spot) ? spot : [NaN, NaN];   // in front of the trunk base: its back on the bark
    let reason = !(pose in SLEEP_COUNTS) ? 'unknown pose' : pose === 'nod' && !tree ? `no tree ${spot?.[0]}` : !Number.isFinite(x) || !Number.isFinite(y) ? 'bad point' : why(x, y, pose, r, tree);
    const near = !reason && [...occupied, ...out].find(s => Math.hypot(s.x - x, (s.y - y) * 1.3) < Math.max(300, s.r + r + 100) || (s.pose === pose && Math.hypot(s.x - x, s.y - y) < (pose === 'chair' ? 850 : 900)));
    reason ||= near && `near ${near.pose}`;
    if (reason) {bad.push({pose, x, y, reason}); continue;}
    out.push({x, y, pose, r, flip: Boolean(flip), tree: tree ? tree.id : undefined});
  }
  if (bad.length && warn) console.warn('sleep spots dropped', bad);
  out.bad = bad;
  return out;
}
// does a themed world's sleepSpots have exactly home's shape and counts (the contract)? [] when it does
export function sleepShapeProblems(spots, total = SLEEP_TOTAL) {
  if (!spots || typeof spots !== 'object') return ['no sleepSpots'];
  const out = [];
  for (const pose of Object.keys(SLEEP_COUNTS)) if (!Array.isArray(spots[pose]) || !spots[pose].length) out.push(`${pose}: missing pose array`);
  const count = Object.values(spots).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
  if (count !== total) out.push(`sleepers: ${count} of ${total}`);
  for (const pose of Object.keys(spots)) if (!(pose in SLEEP_COUNTS)) out.push(`unknown pose ${pose}`);
  return out;
}
// boss 5 Nov: a sleeper (Ducky + its prop) is solid ground for the walk rules, like a prop. The ellipse spans the drawn
// art's width at SLEEP_SIZE (r = half width) and a shallow ground depth; the walk rules pad it by 16 like every footprint.
export const sleeperFootprint = bed => ({x: bed.x, y: bed.y - 6, rx: bed.r * .9, ry: Math.min(34, Math.max(22, bed.r * .42)), sleeper: true});
