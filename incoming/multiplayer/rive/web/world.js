// Geometry and speed are shared by prediction and server validation.
export const W = 1600, H = 1000, SLOTS = 16, SPEED = 150, HZ = 12;
export const CITIES = ['Kochi', 'Chennai', 'Bengaluru', 'London'];
export const NAMES = ['quackers', 'mo', 'aya_22', 'bread_boy', 'pip', 'lulu', 'nori', 'miso', 'toto', 'sunny', 'peep', 'boba', 'kai', 'bea', 'waddles'];
export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = a => a[Math.floor(Math.random() * a.length)];
export function walkable(x, y) {
  return Number.isFinite(x) && Number.isFinite(y)
    && ((x - 800) / 560) ** 2 + ((y - 640) / 290) ** 2 <= 1
    && ((x - 800) / 250) ** 2 + ((y - 575) / 120) ** 2 >= 1;
}
export function randomSpot() {
  for (;;) { const x = rnd(240, 1360), y = rnd(350, 930); if (walkable(x, y)) return [x, y]; }
}
export function outfit() {
  return {
    cap: 1 + Math.floor(Math.random() * 13),
    shades: Math.random() < .5 ? 1 + Math.floor(Math.random() * 3) : 0,
    // These are Solo indices, NOT SVG accessory numbers. gen.py excludes Acc 6 entirely.
    acc: Math.random() < .6 ? 1 + Math.floor(Math.random() * 7) : 0,
    shoes: Math.random() < .8 ? 1 + Math.floor(Math.random() * 10) : 0,
  };
}
export function move(d, vx, vy, dt, speed = SPEED) {
  const length = Math.hypot(vx, vy);
  if (!length) return false;
  const x = d.x + vx / length * speed * dt, y = d.y + vy / length * speed * dt;
  const beforeX = d.x, beforeY = d.y;
  if (walkable(x, y)) { d.x = x; d.y = y; }
  else if (walkable(x, d.y)) d.x = x;
  else if (walkable(d.x, y)) d.y = y;
  if (vx) d.facing = vx < 0 ? -1 : 1;
  return d.x !== beforeX || d.y !== beforeY;
}
