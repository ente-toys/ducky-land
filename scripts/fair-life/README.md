# Fair life, review items 9 and 10

Home hill/telescope/bench/sign art at the NE pocket, a tea table and two mirrored upright Home benches on the south outer bank, a low Home bush edge, twelve animated Home kites and fifty additional residents. The original forty sleep records and their exact resolved positions are retained. World and room-server registry readback is ninety. New pose budget: north 8, northwest 8, southwest 8, south 8, east/southeast 8, hill 5, west picnic/groves 5. All eight approved poses appear in the additions, including a retained Home-tree nod.

`layout.json` is the authored source. It contains all additions and the small retained-prop recompositions needed to clear the features. No scattered runtime placements. `apply.mjs` reapplies only this work and changes only Fair's line in the shared registry. All added artwork is existing SVG art, except the reused tea-table copy whose stroke is corrected to #39472d. Home bench and telescope SVGs already include their contact shadows, so the shared shadow is disabled for those props. Picnic benches use opposite directions of the Home seating axis with upright legs, framing the curved approach.

## Merge order

1. Merge the other Fair workers first, preserving their world/walk/art changes. Apply `node scripts/fair-life/apply.mjs` last to recompose the feature pockets and rebuild the ninety source beds and registry. Do not replace the merged art/world files wholesale with this branch's copies. Preserve the original forty from the fixture.
2. Run `node scripts/fair-life/merge-paths.mjs`. This requires the fp-paths branch's `scripts/bigger-fair/paths.mjs` and `paths.py`. It passes the two 104-unit feature approaches into that exact canonical Home union. Their junctions attach to the final east brook lane and perimeter loop. This branch intentionally does not modify ground tiles or invent an overlay. Until that merge step, approaches exist in route data but their new sand surface is not painted.
3. Run `node scripts/fair-life/verify.mjs` in a fresh process and all Fair tests. The path worker routes around all current sleeper footprints. Recheck all final routes, kite stakes and flight envelopes against the merged planting and bridge geometry. Source positions here are validated against this branch's current geometry, not a prediction that other branches cannot introduce new conflicts.
4. Refresh the existing globe-ground fallback/source-size artifacts through the project's normal integration build. Render again with `node scripts/fair-life/render.mjs` and inspect the live merged game.

The original centre generator still authors the retained forty, and this life pass is its final extension to ninety. `greenery.mjs` now checks the actual authored source count, so its validation can run before or after this pass. Historical reports are explicitly historical; `sleepers-resolved.json` is refreshed and matches the actual runtime registry.

## Evidence

`evidence/runtime-readback.json` records the real `mapFor('fair')` and `mapOf('isle-170')` counts, retained residents, all added contact footprints, and navigable feature approaches. `evidence/targeted-tests.txt` covers nineteen Fair tests. `evidence/non-socket-tests.txt` records the normal QA suite excluding only the two real socket suites, network and multiplayer. Fake room-server tests remain included. Whole and five close PNGs use production SVG art and a static t=0 sample of Home kites. Actual Home kite animation, string endpoints, visibility and reduced motion are exercised in the test against Pixi containers. PNGs do not establish live GPU rendering or animation.

Results: 19/19 targeted Fair checks passed. The 91-file non-socket run passed 377/378 checks; only the existing 100-player timing threshold failed under concurrent machine load (77% of the room's time). Its isolated retry passed, recorded in `evidence/timing-retry.txt`. No timing threshold was weakened. Later placement refinements were rechecked through the nineteen targeted checks, full runtime readback and static renders. `git diff --check` is clean.

The team feed append was attempted, but the sandbox denied writing `~/.claude/team/feed.md`. The merge handoff is also saved in `concepts/themes/work/fair-review/fix/LIFE-HANDOFF.md`.

No commits, publication or credit spending.
