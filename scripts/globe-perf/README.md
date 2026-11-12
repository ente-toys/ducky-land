This pass uses the live globe projection and the same island artwork.

- `npm run globe:assets` refreshes source sizes, cropped decoration SVGs, and
  the thirteen SVG previews plus terrain-only SVG fallbacks (1024px native overview size). Run after changing
  island art, placement, map bounds, or manifests, before building.
- `node scripts/globe-svg/build.mjs [home|theme|island-id]` rebuilds all previews, or just one island after its art changes.
- `npx vite --config scripts/globe-perf/vite.config.mjs --configLoader native --port 5317`
  starts a local review server with a writable temporary dependency cache.
- `node scripts/spread-islands/render.mjs ../concepts/themes/world-map/spread/perf-before-layout.json perf-`
  generates labelled static comparisons using the saved baseline layout and
  production previews. These images are not browser screenshots.

All evidence goes in `concepts/themes/world-map/spread/perf-*` in the sibling
concepts folder.

Ground and oversized decorations share a 128 MiB decoded/upload reservation,
including two pending loads. Resolution follows screen size up to the authored
maximum. Leases are released as tiles leave view. Theme art is limited to two
resident or pending themes, alongside Home; the globe never preloads theme art.
Every preview arrives before a single globe atlas is built. Radar reuses these
textures, rather than allocating separate full-map render textures.

The in-game QA object (`?qa=1`) exposes `game.groundPool.stats()` through the
review page for byte-budget and lifecycle verification.
