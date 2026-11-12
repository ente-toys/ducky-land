# Pagepond library rebuild

Built locally to the locked `library-two-isles-3.png` arrangement. No commit, push, deployment, paid generation, shared-code edit, or use of port 8890.

## Result

- Two large rounded landmasses, separated by a winding open canal. The old book-cover coast, spine, page bands and book islets are gone from the rendered map.
- Two wooden arched canal bridges reuse home bridge 5. Decks and front railings are separate layers; walking data includes the matching arches.
- Left: existing Grand Reading Hall, locked globe fountain and compass rose from `centre/centre.json`. Each authored front piece is rebased to its `sortY` through its anchor, so the current renderer sorts it correctly.
- Right: locked round stacked-book bookstore, glass dome, six surrounding stalls and its forecourt, all from the existing `centre/bookstore/` assets.
- Existing library props, trees, flowers, ground palette, paving and ground decals reused. Pond with floating lily pads, playground, beach, four jetties, three open activity zones and three empty stall rows.
- 40 sleepers in all eight home poses, placed beside fitting props and kept off paths, decks, plazas, open zones and water.

## Numbers

| Measure | Result |
| --- | --- |
| Map | 8000 x 5600 |
| Coast land area | 26,757,373 square units |
| Original home comparison | 2.412 x 11,094,500 |
| Canal bridges / jetties | 2 / 4 |
| Path width | 240 main, 190 secondary |
| Sleepers | 40 resolved, zero dropped |
| Pose counts | nod 6, hammock 4, rock 4, leaf 6, book 6, chair 3, wing 6, box 5 |
| Activity / empty stall zones | 3 / 3 |
| Art directory | About 11 MB including review images |

## Validation

`node scripts/theme-index.mjs --check` prints **READY library, sleepers 40/28**. The denominator and pose-count notes come from the existing shared 28-sleeper checker. All 40 beds resolve successfully; no bed is dropped. Shared files were left untouched.

`node scripts/themes/library-check.mjs` passes:

- All zone spawns are walkable and connected to the globe plaza.
- Every sampled path centreline and all five authored decks pass, including both canal bridges.
- Harbor docking and every boat mooring pass the shared readiness checker.
- 18,816 samples confirm the single-polygon compatibility outline agrees with the two actual landmass outlines.
- Canal samples remain water away from the bridges.
- 99.982% of 32-unit walkable grid cells belong to the main connected component. The remaining four grid cells are tiny sampling pockets, not disconnected zones.
- No solid prop sits off the island and no tall prop covers either bridge centre.

Inspected the 2400 x 1680 static preview by eye, plus globe, bookstore and bridge close-ups. The preview uses the real Ducky SVG parts and all 40 actual sleep poses, with 100 standing Duckies for scale. It is not a browser screenshot or a multiplayer load test.

## Browser verification blocked by sandbox

Attempted the required `npx vite --port 5221 --strictPort --host 127.0.0.1`. Binding failed with `listen EPERM 127.0.0.1:5221`.

Attempted headless Playwright. Chromium failed with `bootstrap_check_in ... Permission denied (1100)`. No browser verification is claimed.

To open the review page locally, start Vite:

```sh
npx vite --port 5221 --strictPort --host 127.0.0.1
```

Review URL: `http://127.0.0.1:5221/pixi-art/themes/library/review.html`. The page uses the actual PixiIsland renderer, registers only library at runtime, and passes the 40 resolved beds. It does not edit the shared theme index.

## Files

- `scripts/themes/library-world.mjs`: reproducible new layout and map/art generator.
- `scripts/themes/library-check.mjs`: readiness, routes, canal geometry, decks and sleepers checks.
- `assets/world/themes/library/{world,walk-world,harbor,placements,paths}.json`.
- `public/pixi-art/themes/library/{art,build-metrics,resolved-sleepers,library-check}.json`.
- Library ground SVG and 24 tiles, three repositioned jetty SVGs, two canal bridge SVGs and two front rail SVGs.
- `public/pixi-art/themes/library/review.html`, `preview.png`, `library-preview.png`, and `library-detail-{globe,bookstore,bridges}.png`.
- Existing locked centre SVGs and `centre.json` are unchanged.

## Shared integration handoff

- No `THEME_OF` change is needed: `isle-251` already uses `library`.
- The integration owner should regenerate `assets/world/themes/index.js` with `node scripts/theme-index.mjs`, or let the existing watcher refresh it. This job deliberately did not write shared index.js. Until refreshed, its cached sleeper list may still contain the old positions.
- The shared count checker needs the already-requested 40-sleeper policy. It currently warns against the original 28-pose distribution but accepts and renders all 40.
- The engine currently accepts one coast polygon. The two closed shore rings are encoded with a retraced zero-area seam underneath the upper bridge. Walking and sailing equivalence are tested. `coastRings` is also supplied for an eventual shared surf improvement: in `src/pixi/surf.js`, `shoreOf` can use `...(world.coastRings ?? [world.coast])` before the islet rings, to avoid treating that hidden seam as a shoreline. This optional rendering change was not made here.
