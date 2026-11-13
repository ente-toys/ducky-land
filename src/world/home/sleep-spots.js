import poses from './sleep-poses.json' with {type: 'json'};

export const SLEEP_SIZE = .81;
export const SLEEP_ROOT = .88 * .24 * 3;
export const sleepHalfWidths = (rootScale = SLEEP_ROOT) => Object.fromEntries(Object.entries(poses.poses).map(([n, p]) => [n, (p.box[2] - p.box[0]) * p.k * SLEEP_SIZE * rootScale / 3 / 2]));

export const SLEEP_SPOTS = {
  nod: [['tree-0', 0, false], ['tree-19', 0, true], ['tree-1', 0, false], ['tree-20', 0, true]],
  hammock: [[900, 1640, false], [3920, 1120, true]],
  rock: [[2150, 1130, false], [1200, 1420, true], [3950, 3260, false]],
  leaf: [[1820, 1500, false], [4790, 1420, true], [1480, 3110, false], [3560, 2480, true]],
  book: [[2660, 1290, false], [1380, 1850, true], [4320, 3230, false], [2230, 2400, true]],
  chair: [[5150, 2875, true], [4575, 2225, true]],
  wing: [[700, 2250, true], [3080, 3260, false], [3350, 1375, true], [4980, 1850, false], [2300, 2750, true]],
  box: [[780, 2600, false], [2000, 3150, true], [3350, 850, false], [4375, 2000, true]],
};
export const SLEEP_COUNTS = Object.fromEntries(Object.entries(SLEEP_SPOTS).map(([pose, list]) => [pose, list.length]));
export const SLEEP_TOTAL = 40;
export const SUNBOB_SLEEP_TOTAL = 90;
export const HOME_SLEEP_TOTAL = 100;
export const BASE_SLEEP_TOTAL = Object.values(SLEEP_COUNTS).reduce((a, b) => a + b, 0);

const segDist = (x, y, a, b) => {const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);};
const inEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
const half = p => p.width * (p.scale ?? 1) / 2;
const THEME_BUILDING = /library|lighthouse|stall|hall|house|barn|windmill|tower|cafe|shop|kiosk|shelf|castle|cottage|museum|bakery|greenhouse/i;
const THEME_DECOR = /lily|bunting|banner|boat|flag|grass|tuft|petal|pebble|shell|rug|blanket|paving|path|puddle|shadow|clover|daisy/i;
const HOME_DECOR = /lily|bunting|banner|boat/i, HOME_BUILDING = /library|lighthouse|Market stall/i;

export function resolveSleepSpots(world, props, walkable, sizes = sleepHalfWidths(), {spots, avoid = [], pathDist = null, steps = () => false, home = false, warn = true, occupied = []} = {}) {
  const coast = world.coast, coastDist = (x, y) => Math.min(...coast.map((a, i) => segDist(x, y, a, coast[(i + 1) % coast.length])));
  const islet = (x, y) => (world.islets ?? []).some(a => inEllipse(x, y, a[0], a[1], a[2] + 60, a[3] + 60));
  const deck = (x, y) => (world.walkways ?? []).some(b => segDist(x, y, b.a, b.b) < b.w / 2 + 90) || (world.bridges ?? []).some(b => Math.abs(x - b.x) < b.w / 2 + 80 && Math.abs(y - b.y) < b.h / 2 + 80);
  const lines = world.paths ?? [];
  const onPath = pathDist ?? ((x, y) => lines.length ? Math.min(...lines.flatMap(l => l.slice(1).map((b, i) => segDist(x, y, l[i], b)))) : Infinity);
  const solid = props.filter(p => p.contact !== false && !(home ? HOME_DECOR : THEME_DECOR).test(p.asset || p.name || '') && Number.isFinite(p.x) && p.width > 0), building = home ? HOME_BUILDING : THEME_BUILDING;
  const out = [], bad = [];
  const why = (x, y, pose, r, tree) => {
    if (tree) return null;
    // The Home pose radius includes ground furniture (a leaf, box, etc.).
    // Test support beneath the Ducky with the same 22-unit body clearance as
    // walking, rather than treating that entire illustration as a standing body.
    const support = home ? Math.min(22, r * .8) : r * .8;
    if (!walkable(x, y) || !walkable(x - support, y) || !walkable(x + support, y)) return 'not ground';
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
    const [x, y, flip] = tree ? [tree.x + (spot[1] ?? 0), tree.y + 14, spot[2]] : Array.isArray(spot) ? spot : [NaN, NaN];
    let reason = !(pose in SLEEP_COUNTS) ? 'unknown pose' : pose === 'nod' && !tree ? `no tree ${spot?.[0]}` : !Number.isFinite(x) || !Number.isFinite(y) ? 'bad point' : why(x, y, pose, r, tree);
    const seat = props.find(p=>p.id===spot?.[3]?.seat&&p.occupiedBySleeper&&p.finalRole==='bench'&&p.contact===false)?.id;
    const near = !reason && [...occupied, ...out].find(s => Math.hypot(s.x - x, (s.y - y) * 1.3) < Math.max(300, s.r + r + 100) || (s.pose === pose && !(seat && s.seat && seat !== s.seat) && Math.hypot(s.x - x, s.y - y) < (pose === 'chair' ? 850 : 900)));
    reason ||= near && `near ${near.pose}`;
    if (reason) {bad.push({pose, x, y, reason}); continue;}
    out.push({x, y, pose, r, flip: Boolean(flip), tree: tree ? tree.id : undefined, ...(seat ? {seat} : {})});
  }
  if (bad.length && warn) console.warn('sleep spots dropped', bad);
  out.bad = bad;
  return out;
}
export function sleepShapeProblems(spots, total = SLEEP_TOTAL) {
  if (!spots || typeof spots !== 'object') return ['no sleepSpots'];
  const out = [];
  for (const pose of Object.keys(SLEEP_COUNTS)) if (!Array.isArray(spots[pose]) || !spots[pose].length) out.push(`${pose}: missing pose array`);
  const count = Object.values(spots).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
  if (count !== total) out.push(`sleepers: ${count} of ${total}`);
  for (const pose of Object.keys(spots)) if (!(pose in SLEEP_COUNTS)) out.push(`unknown pose ${pose}`);
  return out;
}
export const sleeperFootprint = bed => ({x: bed.x, y: bed.y - 6, rx: bed.r * .9, ry: Math.min(34, Math.max(22, bed.r * .42)), sleeper: true});
