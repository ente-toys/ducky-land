# Iceland v2 B2 + FIX1

The hand-authored layout traces the approved `concepts/themes/work/iceland2/b2/whole-source.png`. Coordinates in `build.py` refer to that painting. The coast is sampled from a closed curve and scaled to 118% of Home's measured area for FIX2. No procedural scenery scatter is used.

Rebuild from the repository root:

```sh
python3 scripts/iceland2/build.py
node scripts/iceland2/sleepers.mjs
node scripts/theme-index.mjs
node scripts/globe-perf/source-sizes.mjs snow
node scripts/globe-svg/build.mjs snow
npm test
npm run build -- --configLoader runner
```

The renderer streams authored `tiles` for standing props through the existing 128 MiB pool, retaining their original depth-sort anchors. Terrain streams only near coast edges and paths; `ground.vector` retains complete homogeneous snow for the globe and low-resolution fallback. Iceland's 32-unit preload margin keeps representative 1440x900 and 390x844 views sharp at 2x DPR, including maximum 1.8x zoom. The global pool may still reduce quality under combined neighbouring-island pressure or on larger viewports.

Snowfall is a separate screen-space canvas layer with 144 reused outlined flakes, capped at 72 on phones. It is hidden on other islands, inside interiors, in globe view, and for reduced motion. HTML UI remains above the canvas.

No skiing mechanics or automated skating NPCs are installed. The rink is walkable through three fence openings and can be used by players. Sleds are scenery.

FIX1 uses Home-measured facades (bakery 496 × 394 world units), a 1,105 × 691 rink, 163 trees and 112 bushes in authored groves. The path generator records a named endpoint graph and samples the same curves it paints. Its entire network clears the 16-unit Ducky collision pad. Sand paths are clipped to the snow coastline. The polar minimap uses the complete authored snow preview before streamed scenery has loaded. `qa/iceland2-fix1.test.mjs` covers scale, route connectivity, collision clearance, density, the hill and the minimap.

FIX2 uses the rink rounded rectangle as the fence baseline, with arc-length-spaced posts and three 160-unit gate openings. Paths terminate at those openings, with a snow apron masking their rounded caps and no painted route across the ice. All Iceland paths use the rink fill `#a6deec`. The coast expands uniformly to 118% of Home, retaining the inland placements and harbour. Extra coastal groves are explicitly authored in `build.py`; path clearance filtering remains the final safeguard. `qa/iceland2-fix2.test.mjs` checks rim alignment, gate landings, rendered paving pixels under the ice, density and snowfall sizes.

FIX3 matches the approved `targets3` scenes with baked snow-grain terrain, outlined drifts and rock caps, footprint pairs, packed door courts, snowy roof planes and side walls, and occupational carts/racks/logs/fish crates. Loose fence, crate and ground-cloud instances are removed. Coastal tree chains are compact groves; the sled hill has a cleared footprint, six-step stair, platform, run groove and contact shadow. The rink keeps the existing rim fence and three open gate approaches, with four additional Home benches and a cocoa cart outside the walking lanes. The snowman lane ends in its normal rounded cap.

Snow explicitly sets `raster.enabled: false`; it keeps authored SVG crops through the existing bounded ground pool. This disables the generic raster-worker path without turning on eager whole-building texture decoding. All authored pieces remain vector art. Regenerate with the commands above. FIX3 checks also cover every zone's ground tile, all courts and vignettes, the clear hill, static raster setting, and maximum-zoom desktop/phone texture demand. Runtime frame-rate verification requires a working local browser session.

FIX4 makes the rounded ice, decorated pine, rim fence, cocoa cart and four rink benches available before the island is shown. These pieces set `preload: true`; `theme-art.js` loads their complete static SVG textures and excludes their retained crop metadata from the streaming queue. Other landmarks and plants still stream. This removes partial ice assembly and missing rink furniture while terrain crops are pending. The static rink allocation is tested below 72 MiB (about 67.51 MiB, with 3.625x ice and 4x standing pieces), in addition to the bounded shared pool. There is no raster worker.

The snow surface has 524 varied marks in eighteen authored pockets, rather than a repeating pattern. Terrain crops embed only nearby marks and are pixel-compared against the complete master. Door courts use near-white packed snow with a thin edge. Trees and bushes are checked by their entire canopy rectangle against the snowman scene and yard approach; encroaching plants move to an authored grove behind the lodge. The three snowmen form one close group. Tree/bush totals remain 268/167, with 60 resolved residents.

`qa/iceland2-fix4.test.mjs` loads the real theme with terrain decoding held back, rasterizes the loaded Pixi sprite transforms into a CPU inspection frame, samples the complete ice interior and every fence post, and checks decorated-pine pixels, all three gates and four benches. This is a loader/render regression, not a browser screenshot or FPS measurement. Set `FIX4_PROOF_DIR` to save `rink-loaded.png`.
