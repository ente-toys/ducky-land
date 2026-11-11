# Iceland arrival loading

The shipped manifest has 763 standing placements and 644 decals, using 53 standing SVG URLs (52 after excluding separately managed smoke) and 337 decal URLs. Most of the decal URLs are unique footprint trail geometry. Those placements expand to 3,557 standing crop entries and 1,826 decal crop entries. The final/ directory contains 1,774 SVG files, 1,605 distinct byte hashes; it includes obsolete and generated crops. Deduplicating byte-identical files alone would not fix the workload.

The actual runtime path had `raster.enabled: false`. It nevertheless streamed the pre-generated `tiles` arrays through `createGroundPool`. Each crop URL and resolution entered Pixi's SVG loader, which fetches SVG text, calls Image.decode, then draws into a canvas on the main thread. Leases already shared identical URLs, but the pool acquired and reserved each placement independently. Each crop contains its complete parent SVG, so every crop independently parses and rasterises that drawing. The pool allows 64 pending tiles with a 5 ms submission budget, first at 0.5 resolution and then at device density. An eager lake texture also blocked completion of the entire theme load, including arrivals nowhere near the lake.

There are additionally 1,446 ground tiles, 256 world units square. Every ground SVG repeats the full terrain vector (about 60 KB each), rather than containing only the local geometry. This remains in the existing 128 MiB ground pool. The separate 2-job globe preview queue is not the native Iceland prop queue.

The runtime now creates one complete shared texture per SVG, authored size and density. Sizes remain in the key because some existing placements deliberately alter aspect ratio. Placements share source acquisition, decoding, reservation and lifetime. Nearby standing pieces precede decals and background kit warmup, with distance ordering inside each group. Unique trails load only near their location. Common kit pieces receive one pooled 0.5-density warmup; visible pieces load directly at device density, without an extra preview decode. The complete-image decoder allows 16 concurrent preparations, still under the 5 ms submission budget. It uses ImageBitmap after asynchronous image decoding when supported, with the existing canvas fallback. It does not claim that browser SVG decoding is entirely off the main thread.

All original SVGs, placement coordinates, depth anchors, aspect behavior, flips and source styles are preserved. Fractional frame dimensions retain exact world-to-pixel scaling. Tests compare source crops to the new full-piece pixels and verify full density at 2x DPR for six areas and zooms 0.6, 1 and 1.8. Shared pending, resident and cached textures are counted once under the existing 80 MiB art and 128 MiB ground caps. Island changes invalidate the live capture before throttling; art changed during the native tick cannot be uploaded under the previous camera's island id.

The reproducible server-free measurement is `node scripts/iceland-final/measure-loading.mjs`. The recorded before/after run is in `loading-performance.json`. It uses actual native SVG decoding/canvas rasterisation, local files and a 16 ms submission cadence. For a bakery arrival at 1440x900, DPR 2, zoom 0.6:

| Measurement | Before | After |
| --- | ---: | ---: |
| Visible piece texture keys | 144 | 56 |
| Acquisitions including terrain and complete kit warmup | 575 | 298 |
| Actual decodes including warmup | 457 | 298 |
| All visible pieces present | 313 ms | 301 ms |
| All nearby work and warmup settled | 448 ms | 396 ms |
| Pool reservations, excluding eager static textures | 114.4 MiB | 96.4 MiB |

Native decoding runs differently from a browser, so these numbers do not reproduce or establish a replacement for the reported 8-20 second in-game delay. This sandbox rejected a local Vite listener and Chromium launch. A browser arrival timing remains unverified. The workload and queue bounds are independently tested; 1,000 repeated pine placements acquire and reserve exactly one texture.

Validation: requested Iceland/snow/theme/three-game-budget command, 123 tests, 122 pass and 1 existing Bellovo skip. Additional ground, raster, olive and Three regressions, 56 pass. Globe source freshness passes. Production build passes and remains at `/tmp/perf-dist`. No art files or git state were written. The pre-existing worker/index.js changes were left alone.
