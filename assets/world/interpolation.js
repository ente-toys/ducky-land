export const DELAY = 100;
export function sample(history, time) {
  if (!history.length) return null;
  while (history.length > 2 && history[1].time <= time) history.shift();
  const a = history[0], b = history[1];
  if (!b || time <= a.time) return { ...a };
  const t = Math.min(1, (time - a.time) / Math.max(1, b.time - a.time));
  return { ...(t < 1 ? a : b), x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
