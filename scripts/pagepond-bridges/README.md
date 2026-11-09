Pagepond bridge correction, 9 November 2026.

Run from the worktree root:

    node scripts/pagepond-ground/bridges.mjs
    python3 scripts/pagepond-ground/geometry-audit.py
    node scripts/pagepond-ground/walk-audit.mjs
    node --test qa/pagepond-bridges.test.mjs qa/pagepond-rivers-sail.test.mjs

Uses the existing Pagepond Shapely dependency fallback and approved Home Honeywood SVGs. The fitter supports the four source drawings and never applies a scale, shear, rotation or skew to their SVG wrappers. Each source post keeps its original width/height. Span changes occur at longitudinal stations; the source plank width vector stays fixed. Real banks are measured across the entire source deck width.

The report records all 17 bridge axes, 34 landing throats, the landscape cleared from them, and original route records needed to retire the former approaches. The generator rebuilds the one opaque path surface from the final route network and existing destination courts. The two docks retain their existing behavior. Bench contact indices are refreshed after landing obstacles are cleared; the original indices remain recorded for preservation checks.

The independent regression tests read actual SVGs and production maps. They verify no skew or non-uniform scale, all 204 rigid source posts, every source cross-plank, both full-width bank throats, connected walking, client/authority agreement, and crossings aligned across the water flow. Sailing uses the existing real-actor test through all 17 underpasses, in both directions, from the harbour.
