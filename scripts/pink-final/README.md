Pink final integration

Base: pink-final at 7c2a28ec. Inland source kits: 07723c82. Shore source kits: c4640f0e.

Rebuild from the repository root with `node scripts/bigger-pink/build.mjs`. The entry resets the saved layout to the shore base, rebuilds the authored shore SVGs, imports the three inland kits and the two shore kits, packages their paths and quay landing, and resolves all 40 approved in-game sleepers. Source kits and placement plans live in ../concepts/themes/work/pink-fix/{svg,plan}. No generated tile merge is required.

Teacup's complete kit is registered at [6700,4740], scale 1.68. Its short original south-facing jetty meets the new sandy cove. One existing game sailboat is moored beside it. Superseded beach furniture and its collision contacts are retired. Tutu's shore uses curved coves and headlands. The navigation coast is sampled from the same authored drawing. The minimum spherical island channel remains above 600 units.

`node scripts/pink-final/render.mjs` renders the whole island and all five hamlets from production SVG manifests into ../concepts/themes/work/pink-fix/final. These are static SVG composites including approved sleeper layers and boats.

No commits or pushes belong to this integration task.

Boss review pass, 8 November

review-roads.py authors the connected expansion road graph and its smooth SVG, including one Rosewater crossing and the path to the marina foot. review-cleanup.py replaces all 74 hamlet trees and shrubs with original Pink assets, clears obsolete pads and paving, places OG groves, and moves prop contacts off the lanes. finish.mjs resolves all 40 approved sleepers with explicit trunk, road, bridge and arrival clearance.

Run `node scripts/pink-final/audit.mjs` for the ground-contact overlap list and `node scripts/pink-final/walk-audit.mjs` to walk from the plaza to every bridge, path end and sleeper approach. Reports are overlap-audit.json and walk-audit.json.

Rendering defaults to the requested concepts folder. If that folder is read-only in the active sandbox, run `PINK_RENDER_OUT=scripts/pink-final/renders node scripts/pink-final/render.mjs`. This review session has written the refreshed images there because concepts is outside the writable workspace.

Building and join pass

apply-buildings.py validates all supplied SVGs, copies the valid files, applies sizes.json widths, and scales footprint coordinates, blockers, doors and automatic contact shadows about the unchanged ground base. The report is building-report.json.

union-inputs.py extracts the authored road/plaza geometry and placement transforms. union-paths.mjs expands strokes into vector surfaces, unions the 52 surfaces through Skia PathOp.Union, and outlines only the resulting boundary. Decorative paving is clipped to an inset outside the travel corridors, with even-odd fill and clip rules retained. The report catalogs 50 independent joins.
