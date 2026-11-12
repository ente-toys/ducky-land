import lines from '../../../world/shore-lines.json' with {type: 'json'};
export const SHORE = [lines.coast, ...lines.islets];

export function sampleRing(ring, step) {
  const n = ring.length, cum = [0];
  for (let i = 0; i < n; i++) cum.push(cum[i] + Math.hypot(ring[(i + 1) % n][0] - ring[i][0], ring[(i + 1) % n][1] - ring[i][1]));
  const total = cum[n], count = Math.max(8, Math.round(total / step)), pts = [];
  for (let k = 0, i = 0; k < count; k++) {
    const s = k * total / count; while (cum[i + 1] < s) i++;
    const a = ring[i], b = ring[(i + 1) % n], u = (s - cum[i]) / (cum[i + 1] - cum[i] || 1);
    pts.push({x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, along: s / 600});
  }
  const reach = Math.max(1, Math.round(36 / (total / count)));
  for (let k = 0; k < count; k++) {
    const p = pts[(k + count - reach) % count], q = pts[(k + reach) % count], dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1;
    pts[k].nx = dy / l; pts[k].ny = -dx / l;
  }
  return pts;
}
