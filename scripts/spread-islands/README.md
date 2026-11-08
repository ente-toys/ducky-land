`node scripts/spread-islands/render.mjs` assembles production SVG art and maps it
onto static globe views at 0, 120 and 240 degrees. Output and the saved baseline
layout live in `../concepts/themes/world-map/spread/`. Images are labelled static
proof, not browser screenshots. No production art or projection code is changed.

`node scripts/spread-islands/capture.mjs after` captures the real Pixi engine
using the existing `scripts/bigger-home/review.html` on Vite port 5319. It waits
for Home and all twelve theme snapshots before taking three views. This requires
a working local Playwright browser. `before` must run against the baseline source,
before the placement changes, to record a genuine browser comparison.

In this sandbox Chromium cannot launch, and the CUA browser host is unavailable.
The static proof is provided with that limitation stated on every image.
