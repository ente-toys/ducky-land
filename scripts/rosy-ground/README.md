Rosybutton ground rebuild

Run `node scripts/bigger-pink/build.mjs` from the repository root. It uses
`surfaces.py` (Shapely 2) and `bridges.mjs`, then refreshes Pink's source sizes,
large decoration tiles and SVG globe preview. Install Shapely with
`python3 -m pip install shapely` when needed. The local shared Shapely location
is only a fallback. No historical Git object is needed by the build.

`source-floor.json` is the retained authored curve/court kit. Its historical
stroke widths are ignored. Current widths, palette, route corrections and
water contours are authored in `surfaces.py`. Every ground crop receives the
same union, cropped outside its visible edge. The old centre ground retains
its decorative layers but no longer contains Continuous footpaths.

The main loop is 128, all lanes 104. Every travel surface uses only opaque
#FBE6C8, with no lower edge, inset, glow or duplicate join overlay. The four physical crossing axes use
the exact Home bridge fitting algorithm and source SVG structures, recoloured
with rose wood #b66787, pink planks #e9a9bc, pale rails #f9d3dc and ink #39472d.
Boat contours and walking water share the drawn union. The inner pond joins
Willow Spring through an authored eastern outflow, clear of the original sleepers.

The previous `review-roads`, `shore-apply`, `finish`, `union-paths` and
`restore-centre` passes are historical, outside the rebuild chain. Do not replay
them over this result. This rebuild never regenerates plants, sleepers, kites,
hills, building art or shadows. It preserves the current manifest's placements.

Run `node scripts/pink-final/walk-audit.mjs` for exact route samples, destination
throats and arrivals. It writes `scripts/rosy-ground/walk-audit.json` and uses no
nearest-target fallback or locked-lamp exemption. Run
`node --test qa/rosy-ground.test.mjs qa/bigger-pink.test.mjs` for real sailing
round trips, all four bridge traversals, the source-family check and protected
music-box records. `keep.json` records the retained centre source hashes and
layer/animation records, replacing the obsolete whole-centre pixel-lock check.

Planting handoff: `planting-handoff.json` lists seven existing prop bases along
the new outflow. The planting job must move these to its banks, preserving the
willow and cherry grove identities. The existing `hamlet-teacup-grass-03` at
(7951.6,3980.64) remains the review's planting issue in Willow Ribbon. Ground
work leaves all planting unchanged, as assigned.

## Approved B and ribbon centre integration

`build.mjs` now applies `data/population.json`, `data/shadows.json` and
`data/centre.json` through `apply.py` after the unified ground and bridges.
The local payloads are authoritative, with no absolute review-directory dependency.
The hill lane joins the same surface union. Plant footprints are rejected if
they touch the final paths, bridges, wet banks or retained landmark footprints.
`population-report.json` records acceptance and retirements. All 381 additions
clear those checks; 90 residents retain all original authored spots.

The approved ribbon replaces the earlier keep.json centre lock. Both old paving
discs, centre deck, stairs, coping, balustrades and old ring ornaments are retired.
Only the box and five lamps block the new circle. `qa/rosy-ribbon.test.mjs` checks
the actual SVG base alignment, densely samples client and room-authority walking,
and traverses each new road opening. `qa/rosy-ground.test.mjs` sails the real hull
from the harbour through both springs and the pond and beneath all four bridges.
