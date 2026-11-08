import {Graphics} from 'pixi.js';
import {PALETTE} from './palette.js';
import {SHORE, sampleRing} from './shore.js';

// boss 5 Nov: the surf runs round the whole island and every jetty islet, on the real sand edge traced off the ground art
// (shore-lines.json). The old SE-only line sat 0-7 off that edge on the east and drifted 40 into the sand along the south.
// Each ring is cut into short runs: only runs near the camera are drawn, and each run gets its own small set offset.
const RUN = 4;   // samples per run
const inRing = (x, y, p) => {let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c;};
const boxOf = p => [Math.min(...p.map(q => q[0])), Math.min(...p.map(q => q[1])), Math.max(...p.map(q => q[0])), Math.max(...p.map(q => q[1]))];
const near = (a, b, pad) => a[0] - pad < b[2] && b[0] - pad < a[2] && a[1] - pad < b[3] && b[1] - pad < a[3];
// boss 6 Nov: any island's shore, so a themed island gets the same surf. rings: closed [x,y] outlines (the coast first, then
// islets), any winding (each is turned clockwise on screen so the normal points out to sea).
export const clockwise = ring => {let a = 0; for (let i = 0; i < ring.length; i++) {const p = ring[i], q = ring[(i + 1) % ring.length]; a += p[0] * q[1] - q[0] * p[1];} return a >= 0 ? ring : [...ring].reverse();};
export const isletRing = ([cx, cy, rx, ry], n = 28) => Array.from({length: n}, (_, i) => [cx + Math.cos(i / n * 2 * Math.PI) * rx, cy + Math.sin(i / n * 2 * Math.PI) * ry]);
export const shoreOf = world => [...(world.coastRings ?? [world.coast]), ...(world.surfIslets ?? world.islets ?? []).map(a => isletRing(a))].map(clockwise);
export const surfRuns = (SHORE) => SHORE.flatMap((ring, r) => {
  const perimeter = ring.reduce((s, p, i) => s + Math.hypot(ring[(i + 1) % ring.length][0] - p[0], ring[(i + 1) % ring.length][1] - p[1]), 0);
  const pts = sampleRing(ring, Math.min(30, perimeter / 96)), out = [];   // an islet gets finer steps, so its far crest never facets
  // Wave sets drift a little along the shore: a slow lead or lag, never more than a sixth of a cycle.
  const set = p => .11 * Math.sin(p.along * .42 + r * 2.1) + .05 * Math.sin(p.along * 1.13 + r * .7);
  for (let i = 0; i < pts.length; i += RUN) {
    const run = Array.from({length: Math.min(RUN, pts.length - i) + 1}, (_, k) => pts[(i + k) % pts.length]);   // + the next run's first point, so runs join
    const b = boxOf(run.map(p => [p.x, p.y]));
    // A crest never paints over another shore's sand (the island's swell over an islet, or an islet's over the island).
    const others = SHORE.filter((o, k) => k !== r && near(boxOf(o), b, 200)).map(o => ({ring: o, box: boxOf(o)}));
    // A preserved former islet can now be enclosed by an expanded mainland.
    // Keep its geometry, but do not generate waves across its inland garden.
    if (run.every(p => others.some(o => inRing(p.x, p.y, o.ring)))) continue;
    out.push({points: run.map(p => ({...p, set: set(p)})), set: set(run[RUN >> 1] || run[0]), box: b, start: r ? 125 : 175, others});   // islets start closer in
  }
  return out;
});
const HOME_RUNS = surfRuns(SHORE);

export function createBeachSurf(layer, rings = null) {
  const runs = rings ? surfRuns(rings) : HOME_RUNS;
  const waves = [0, 1/3, 2/3].map(phase => {
    const crest = new Graphics({label:'Beach surf'});
    layer.addChild(crest);
    return {phase, crest};
  });
  const crests = waves.map(w => w.crest);
  let lastTime = -1, lastView = '';

  function trace(graphics, run, clock, cycle, foam) {
    let drawing = false;
    const dry = (x, y) => run.others.some(o => x > o.box[0] && x < o.box[2] && y > o.box[1] && y < o.box[3] && inRing(x, y, o.ring));
    for (const point of run.points) {
      const age = Math.min(1, Math.max(0, clock + point.set - cycle));   // the run's own cycle, so a run never splits across a wrap
      // Break the fine foam into patches while the water underneath stays continuous.
      if (foam && Math.sin(point.along * 12 + age * 4) < -.45) {   // boss 5 Nov: longer patches, fewer dashes
        drawing = false;
        continue;
      }
      const offset = run.start - (run.start + 16) * (1 - (1 - age) ** 1.45);
      const ripple = Math.sin(point.along * 10 - age * 3) * 5;
      const distance = offset + ripple + (foam ? 0 : 7);
      const x = point.x + point.nx * distance;
      const y = point.y + point.ny * distance;
      if (dry(x, y)) {drawing = false; continue;}
      if (drawing) graphics.lineTo(x,y);
      else graphics.moveTo(x,y);
      drawing = true;
    }
  }

  return {
    runs: runs.length, crests,
    update(time, reduced, visible) {
      // Cull per run: drawn when its box, plus the 175 the crest starts out at sea, touches the view.
      const shown = runs.filter(({box}) => visible((box[0] + box[2]) / 2, (box[1] + box[3]) / 2, Math.max(box[2] - box[0], box[3] - box[1]) / 2 + 220));
      for (const {crest} of waves) crest.visible = shown.length > 0;
      if (!shown.length) return;
      const frame = reduced ? 0 : Math.floor(time * 30), view = shown.length + ':' + runs.indexOf(shown[0]);
      if (frame === lastTime && view === lastView) return;
      lastTime = frame; lastView = view;
      for (const {phase, crest} of waves) {
        crest.clear();
        const clock = (reduced ? .9 : time) / 6 + phase;
        for (const run of shown) {
          const cycle = Math.floor(clock + run.set), age = clock + run.set - cycle;
          const fade = Math.min(1, age * 6, (1 - age) * 8);
          if (fade <= .01) continue;
          trace(crest, run, clock, cycle, false);
          crest.stroke({color:PALETTE.cream, width:20 + 14 * age, alpha:.14 * fade, cap:'butt', join:'round'});   // boss 3 Nov fix 9: a faint cream wash (butt ends, so run joins never double up)
          // boss 5 Nov: calm like the original: only the crest running in to the sand carries foam, so one broken band shows at a time
          const foam = fade * Math.min(1, Math.max(0, (age - .55) * 8));
          if (foam <= .01) continue;
          trace(crest, run, clock, cycle, true);
          crest.stroke({color:PALETTE.cream, width:5 + 4 * age, alpha:.9 * foam, cap:'round', join:'round'});   // the one broken foam band
        }
      }
    },
  };
}

// boss 5 Nov: signed art-mask distance wraps surf around every coast and islet.
// The crest eases onto sand, pauses at its turn, then recedes; sets vary along shore.
export const COAST_SURF = `
vec3 coastSurf(vec2 p, float d, float time, float calm) {
  if (calm > .5) return vec3(0.);
  // boss 5 Nov: a continuous cosine run-up turns softly, with long loose sets along the coast.
  float phase = time * .91 + sin(p.x * .0017 + p.y * .0011) * 1.1 + sin(p.y * .003) * .38;
  float reach = 14. + 3. * sin(p.x * .001 + p.y * .0014);
  float front = 29. - (29. + reach) * cos(phase);
  front += sin(p.x * .014 + p.y * .012 + time * .23) * 1.8;
  float aa = max(fwidth(d), .65);
  float foam = (1. - smoothstep(1.4, 1.4 + aa, abs(d - front))) * (.72 + .18 * cos(phase));
  float wet = (1. - smoothstep(0., 2., -d - reach)) * smoothstep(-.15, .5, sin(phase));
  wet *= 1. - smoothstep(1.4, 2.8, mod(phase, 6.283185));
  return vec3(foam, wet, front);
}`;
