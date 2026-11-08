This pass uses the live globe projection and the same island artwork.

- `npm run globe:assets` refreshes source sizes, cropped decoration SVGs, and
  the thirteen 1024px previews plus terrain-only fallbacks. Run after changing
  island art, placement, map bounds, or manifests, before building.
- `npx vite --config scripts/globe-perf/vite.config.mjs --configLoader native --port 5317`
  starts a local review server with a writable temporary dependency cache.
- `node scripts/globe-perf/benchmark.mjs before` / `after` launches headless
  Chromium, records 360 frame intervals plus engine CPU timings in each view,
  tracks WebGL texture allocations, records JS heap, and captures three angles.
  Set PERF_URL for another review server. Record `before` against ed40970b.
- `node scripts/globe-perf/memory-report.mjs` estimates allocation sizes from
  actual SVG dimensions. These estimates are not GPU measurements.
- `node scripts/spread-islands/render.mjs ../concepts/themes/world-map/spread/perf-before-layout.json perf-`
  generates labelled static comparisons using the saved baseline layout and
  production previews. These images are not browser screenshots.

All evidence goes in `concepts/themes/world-map/spread/perf-*` in the sibling
concepts folder. The headless browser launch is currently denied by the macOS
sandbox (MachPortRendezvousServer bootstrap_check_in). No visible browser opens.

Ground and oversized decorations share a 128 MiB decoded/upload reservation,
including two pending loads. Resolution follows screen size up to the authored
maximum. Leases are released as tiles leave view. Theme art is limited to two
resident or pending themes, alongside Home; the globe never preloads theme art.
Every preview arrives before a single globe atlas is built. Radar reuses these
textures, rather than allocating separate full-map render textures.

The in-game QA object (`?qa=1`) exposes `game.groundPool.stats()` through the
review page for byte-budget and lifecycle verification. No 20 ms frame-time
claim is made until the benchmark runs successfully on a real renderer.
