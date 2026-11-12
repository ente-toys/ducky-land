Floating pond Duckies
====================

17 ponds, 44 Duckies. Ten ponds have three and seven have two. Source island art and all islet files are read-only.

| Island | Ponds |
| --- | --- |
| Home | Lily, race lake, west pond, Millhead, Millrill |
| Sunbob Fields | Lily pond |
| Rosybutton Bay | Willow pond, Rosewater Spring, Willow Spring |
| Pagepond | Reading pond, meadow pool |
| Campfire Commons | Lily pond |
| Waddlewish Fair | Orchard pond, castle lagoon |
| Bellovo Piazza | Lily pond |
| Booquack Bog | Kettle pond, Reed pond |
| Iceland | None. The rink is frozen; Aurora Run and Snowmelt Beck are rivers. |

The Sunbob outer brook's so-called pond furnishings sit on an ordinary canal bend, with no basin. Campfire's former outer review pond was removed by the island owner. Fountains, sea coves, canals and river channels are excluded. River-connected pond basins are included.

`pond-regions.json` records each basin's source, original water shapes, open-water cells, prop/support exclusions, two or three distinct variants, and deterministic seeded itineraries. The build raster mask reads the unchanged SVG ground, flats and floating pads to avoid baked lily pads and inner dry land. All temporary images stay under `/tmp/pond-duckies`. Sprite footprints are wide, shallow ellipses at the waterline, with additional shore clearance. Every traversed grid cell is checked, including very short diagonal corner crossings. Disconnected open-water pockets cannot be crossed by a Ducky.

The seven full SVGs are the review assets. Their `parts` SVGs preserve the same traced geometry and allow the body and the actual drawn ripple to animate independently. Runtime uses bounded texture leases from the existing asset loader. Maximum texture density is sized for 1.8 game zoom and a 2x display, rather than the 1024px source size.

The island and pond IDs seed a separate 50/50 count draw in `populate.mjs`. A third distinct variant is chosen deterministically within the existing safe footprint. The planner tries the candidates and falls back to two when there is insufficient clearance for three moving Duckies. Existing authored pairs keep all seven approved variants in use. Sprite outlines remain the boss's Ducky black, `#232323`.

Each Ducky has a reserved route, with independently seeded targets, holds, bob periods and ripple phases. Whole route segments are checked against every other route, so clearance holds continuously, regardless of individual pause timing. Random destinations span the accessible water; graph routes pass around pads and supports. The tour then retraces its safe routes with fresh holds to close continuously. Runtime samples absolute UTC time into the baked itinerary, so no frame simulation, per-frame pathfinding, random calls, allocations or server messages are needed. Reduced motion fixes travel positions and keeps a small bob. Hidden islands and offscreen sprites do no animation work. Leaving an island destroys its layer and releases its leases; a late loader completion is destroyed too.

Rebuild with the approved PNG source folder available:

```
python3 scripts/pond-duckies/trace.py
node scripts/pond-duckies/build-regions.mjs
node scripts/pond-duckies/bake-motion.mjs
node --test qa/pond-duckies.test.mjs
```

`trace.py` needs Pillow, NumPy and potrace. It thresholds alpha above 40 before cropping, flattens the source palette and traces smooth vector paths. No bitmap enters the repository.
