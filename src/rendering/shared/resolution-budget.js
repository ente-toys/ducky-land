// A 4K screen's pixel count: laptops and 1080p monitors keep their full device pixel ratio.
export const MAX_CANVAS_PIXELS = 8_294_400;

export function screenResolution(width, height, dpr = 1, override) {
  if (Number.isFinite(override) && override > 0) return Math.min(4, override);
  return Math.min(Math.max(1, dpr), 2, Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, width * height)));
}

// Fixed storage: sampling and percentile calculation do not allocate in tick().
export function createResolutionBudget({dpr = 1, override} = {}) {
  const durations = new Float64Array(512), times = new Float64Array(512), sorted = new Float64Array(512);
  let cursor = 0, count = 0, checked = 0, fastSince = 0, maximum = 1, resolution = 1, slowWindows = 0;
  const locked = Number.isFinite(override) && override > 0;
  return {
    get resolution() {return resolution;},
    get maximum() {return maximum;},
    resize(width, height, nextDpr = dpr) {
      dpr = nextDpr;
      const next = screenResolution(width, height, dpr, override);
      resolution = maximum === resolution ? next : Math.min(resolution, next);
      maximum = next;
      return resolution;
    },
    reset() {count = cursor = checked = fastSince = slowWindows = 0;},
    sample(now, elapsed, eligible = true) {
      if (!eligible) {this.reset(); return resolution;}
      if (locked) return resolution;
      // A resumed/hidden tab or debugger pause is not GPU load.
      if (!(elapsed > 0) || elapsed > 250) {this.reset(); return resolution;}
      durations[cursor] = elapsed; times[cursor] = now;
      cursor = (cursor + 1) % times.length; count = Math.min(count + 1, times.length);
      if (!checked) {checked = now; return resolution;}
      if (now - checked < 2000) return resolution;
      checked = now;
      let n = 0;
      for (let i = 0; i < count; i++) if (now - times[i] <= 2000) sorted[n++] = durations[i];
      // Insertion sort touches only the populated prefix of the reusable buffer.
      for (let i = 1; i < n; i++) {
        const value = sorted[i]; let j = i - 1;
        while (j >= 0 && sorted[j] > value) {sorted[j + 1] = sorted[j]; j--;}
        sorted[j + 1] = value;
      }
      const p90 = sorted[Math.max(0, Math.ceil(n * .9) - 1)], p50 = sorted[Math.max(0, Math.ceil(n * .5) - 1)];
      // An even cadence (battery saver or a 30 Hz display) is a frame-rate cap,
      // not GPU load, so it never costs sharpness.
      const capped = p90 - p50 < 2;
      if (p90 > 22 && !capped) {
        fastSince = 0;
        // Two consecutive slow windows reject a single decode/compile burst.
        if (++slowWindows < 2) return resolution;
        slowWindows = 0;
        const floor = Math.min(maximum, dpr <= 1 ? .75 : 1);
        resolution = Math.max(floor, resolution > 1.5 ? 1.5 : resolution > 1.25 ? 1.25 : resolution > 1 ? 1 : .75);
      } else if (p90 < 18) {
        slowWindows = 0;
        if (!fastSince) fastSince = now;
        if (now - fastSince >= 10000) {
          resolution = Math.min(maximum, resolution < 1 ? 1 : resolution < 1.25 ? 1.25 : resolution < 1.5 ? 1.5 : 2);
          fastSince = now;
        }
      } else {fastSince = slowWindows = 0;}
      return resolution;
    },
  };
}
