// requestAnimationFrame times jitter by about a millisecond while the display
// still shows frames at a fixed rate. Moving by the raw times makes steady
// motion step unevenly (3.0 px, 3.5 px, 3.0 px...), which reads as judder.
// Advance by whole measured refresh intervals instead, easing toward the real
// clock and staying within half a frame of it. When the cadence changes (a
// 120 Hz display, a moved window, a long frame) follow real time and relearn.
// Time always moves forward: a zero step reads as a teleport downstream.
export function createFrameClock() {
  let raw = null, smooth = 0, interval = 0, samples = 0;
  return now => {
    if (raw === null || !Number.isFinite(now)) {raw = smooth = now; return now;}
    const delta = now - raw;
    raw = now;
    if (delta <= 0) return smooth;
    if (delta > 250) {smooth = Math.max(smooth, now); interval = samples = 0; return smooth;}
    const frames = interval ? Math.max(1, Math.round(delta / interval)) : 1, each = delta / frames;
    let step;
    if (!interval || Math.abs(each - interval) > interval * .25) {interval = each; samples = 1; step = delta;}
    else {samples++; interval += (each - interval) / Math.min(samples, 50); step = frames * interval;}
    let next = smooth + step;
    next += (now - next) * .1;
    next = Math.min(now + interval / 2, Math.max(now - interval / 2, next));
    smooth = next > smooth ? next : smooth + Math.min(delta, interval) / 2;
    return smooth;
  };
}
