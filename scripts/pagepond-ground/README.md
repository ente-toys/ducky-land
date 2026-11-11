# Pagepond paths, bridges and Inkleaf structures

Run from the repository root:

    node scripts/bigger-library/build.mjs
    node scripts/pagepond-ground/walk-audit.mjs
    node --test qa/bigger-library.test.mjs qa/pagepond-*.test.mjs
    npx vite build --configLoader native

Python requires Shapely 2 and fontTools, as listed in `scripts/pagepond-rework/requirements.txt`. `PAGEPOND_PYTHON` can select an installed interpreter. The local shared Python package directory is a fallback, not a source fixture.

All historical Pagepond ground/hamlet/rework entry points delegate to this build. They cannot repaint an obsolete network. `data/source.json` holds the authored route, court, coast and crossing inputs; the two source SVGs retain the original non-path terrain. The builder reads current props, obstacles and resolved residents, so it routes around fixed contacts without moving them. No temporary route-stage file is required.

The boss's current Pagepond rule overrides Home's earlier edge shading: one opaque parchment `#FFF0C7` surface, no stroke, alpha, second fill or landing overlay. Main routes are 128 and ordinary lanes 104. Closing the complete union rounds concave forks; collision-checked detours keep the entire lane clear. Old centre strokes, fan inlays, separate outer floors and square landing aprons retire. Destination court silhouettes join the union; their paving joints, compass points, complete open-book medallion and landmark art remain.

All seventeen water crossings reuse the Home Honeywood SVG bodies. `bridges.mjs` delegates to `scripts/pagepond-bridges/build.py`. It edits longitudinal source stations, with no affine, rotation, skew or scale wrapper. Source planks retain their transverse vectors; each post is translated as a rigid rectangle. The oblique south crossing uses the NW source. The east crossing sits above its river fork; the remaining crossings use EW/NS. Pagepond timber stays `#c88941` / `#885931`, ink `#39472d`. Each actual bank supports the complete deck width and an extended, widened path throat. Landing landscape is recorded in `scripts/pagepond-bridges/report.json`; fixed functional props and all 250 resolved residents stay in place. The single path painter is rebuilt from the current routes and courts, so retired approaches leave no grass stubs.

Art, authority and client share the same 17 deck endpoints, widths, 24-unit crowns and `boatPassUnder`. The pond dock and short Paperboat pier remain docks. `qa/pagepond-bridges.test.mjs` independently reads rendered SVG transforms, sprite scale, all post rectangles and cross-plank vectors, then walks both path throats and each deck. The existing sailing test drives one real actor beneath all seventeen decks in both directions.

Local rounded coast cuts only widen water. The existing paired centre land, sea approaches and all prior boat water remain. The three floating paperboat decorations are replaced by approved playable Home fleet boats through `scripts/pagepond-boats/build.mjs`. Actual sailing actors test every channel from the harbour, both complete moats, the central canal and every bridge underpass. `bank-report.json` records the added water area, with zero water narrowing.

The boat build also overlaps boat-water tiles by 0.05 world units to close invisible coordinate-rounding cracks that stopped hulls on the south route. It always uses the preserved mask, so rebuilds are idempotent. SVG banks, walking water, paths and bridge endpoints retain their existing geometry.

Inkleaf's four cottage fronts and print-hall slab have level eaves, walls and steps. Book covers, colours, identity, dimensions and existing baked/engine shadow settings remain. Every other protected prop and prop source is checked against `data/keep.json`. This work adds no planting, residents, kites, hill or shadow edits.

`geometry-audit.json` checks full-width lanes, fixed contacts, sleeper footprints, interior crossings and served ends. `walk-audit.json` checks 8-unit walking samples and exact reachable endpoints against production navigation. `surface.json`, `sampled-routes.json` and `path-surface.svgfrag` provide the final clearance contour for the planting job. Current resolved residents are exported to `data/current-sleepers.json` at build time.
