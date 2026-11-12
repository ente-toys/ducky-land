Sphere placement uses thirteen independent azimuthal equidistant charts. Authored
anchors become orthonormal unit-vector frames. Map artwork and walking coordinates
are untouched. `mapPoint(from,to,p)` transforms a point; `originOffset` and
`offsetOf` describe centres only and must never be added to arbitrary points.

The globe shader inverse-projects each visible sphere point into the island
patches. The 2048px atlas packs images only, with a transparent one-pixel gutter.
No geographic texture, latitude widening, polar repeats or exterior scene blend
remains. At floor zoom the blend reaches a complete sphere on every screen size.

Live neighbour images use the same transformation as navigation. Only two live
neighbours can be retained. Their animated render targets are cropped, capped at
1536px per side, reused until a crop/zoom changes and released outside the view.
The existing 128 MiB ground-tile budget and two-theme art cap remain in place.

- Run `node scripts/sphere-place/render.mjs` for the eight offscreen shader views.
  macOS Command Line Tools and OpenGL are required. The program opens no window.
  These use the actual production fragment shader and static production previews,
  not the live Pixi scene. The available renderer reports Apple Software Renderer.
- Start `DUCKY_WS_PORT=19370 node server.mjs` before
  `DUCKY_WS_PORT=19370 npm test`. Build with
  `npx vite build --configLoader native`.

Proof is in the sibling concepts/themes/world-map/sphere folder. Exactly thirteen
islands, Iceland exactly at [0,1,0], circumference 98,271, whole-sphere coastline
separation and boat/landing round trips are asserted in qa/sphere-place.test.mjs.

The boat land predicate reuses the existing exact coast-cell index. Only cells
touched by a coastline need point-in-polygon work; deck bounds skip distant
segments. Walking geometry is unchanged. The independent reference check in
qa/sphere-land-index.test.mjs compares the old boat predicate across every map
and along coastline edges. This reduces cold sphere-route preparation without
changing shores. Narrow harbour entrances use a local 60-unit search before
joining the coarse open-ocean graph. Long route calculations remain synchronous.

`node scripts/sphere-place/check-renders.mjs` checks broad exterior pixel patches
in the six saved sphere views and writes exterior-check.json.
