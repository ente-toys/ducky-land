# Community island: four neighbourhoods around Campfire Commons

Implemented in `/Users/pragadees.xd/Downloads/Ducky Land/ducky-big-community`, branch `big-community`. Work is left in the worktree for the coordinating merge. No push, publish, paid generation or visible browser window.

## Communities

The original Campfire Commons remains the island's heart. The first expansion's eight repeated attraction pads have been replaced with four residential communities, with 22 homes and 196 new authored prop placements in total.

| Community | Who lives there | Homes and shared life | Workplace |
| --- | --- | --- | --- |
| **Storynest Row**, northwest | Storytellers, bookbinders and campfire hosts | Six lavender gabled cottages with book crests, porches, planted window boxes, front gates, mailboxes, washing line, reading green, benches and pavilion | Book exchange and a bookbinding desk with a press, stacked books and scissors |
| **Patchwing Yard**, northeast | Menders, lantern makers and board-game builders | Six mint studios with curved roofs and skylights, gardens and gates, washing yard, game table and a common green | Two craft benches, repair stall, supplies and a sheltered workshop seat |
| **Sproutshare Co-op**, southwest | Volunteer growers who supply the communal kitchens | Five sage and cream cottages with planted porch trellises, shared harvest green, gardens, mailboxes, washing line and benches | Four vegetable beds, seed stall, tool shed, crates and barrels |
| **Lanternloaf Lane**, southeast | Bakers, cocoa cooks and evening lantern keepers | Five warm cream cottages with striped awnings, bread crests and chimneys, front gardens, laundry, a shared supper square and sheltered seating | A separate bakehouse with bread counter and cooling rack, cocoa cart and pantry stall |

The houses, gardens, furniture and workplaces have fixed authored positions. House variants share the community theme's lavender, cream, timber and green palette, front/top perspective, flat fills and warm outlines. No Home assets or generated prop scatter were introduced. Removed attraction scenes remain absent from the production manifest, including the isolated cinema, games terrace and southern lantern gazebo. Reused art includes the book exchange, craft tables, vegetable beds and south jetty.

## Roads, commons and shore

A broad walking promenade connects all four neighbourhoods to the original heart. Each community has its own residential lane loop, gated front-door approaches and access to the coast walk. Open textured commons remain between the neighbourhoods.

All new roads use variable-width curved silhouettes, warm sand, outlined raised grass banks, a recessed edge shadow, overhanging tufts, directional worn ruts, light patches and edge pebbles. Road shapes are united before their banks are drawn, so crossing roads do not leave raised edges across a junction. Junction and residential-lane proofs are placed beside the Cursor Camp reference. The reference was studied for craft; no art was copied.

The southern bays were widened to keep residential plots on land. The harbour was refitted with a longer south jetty and four moorings outside the new coast. All four boats float with clearance, board from reachable ground and connect back to the campfire.

## Original preservation

- **544 original props**, **1,581 original flat decals**, **6 original decks**, **276 original obstacle records**, original zones and paths, all sleeper definitions and all sleep-avoid records are retained unchanged.
- All **40 sleepers** remain resolved on land. Campfire/centre animation sources are untouched.
- **86 original source files** were checked by SHA-256 against the pre-communities HEAD: **0 changed**. Results: `scripts/bigger-community/original-sources-validation.json`.
- Retiling the original SVG paths initially introduced small antialiasing differences. Final production ground tiles embed the unchanged original tile sources with their original viewports, clipped at the old coast. This preserves their rasterisation rather than redrawing the original paths in a new coordinate frame.
- Final production-art comparison: **817,744 protected pixels, 0 changed, maximum channel difference 0**, at 0.2 px/unit inside the original coast inset by 20 world units. No pixels were restored in the proof images. Original static art and sleepers are included; refitted boats are excluded from both preservation renders. Results: `scripts/bigger-community/pixel-validation.json`.

## Size and texture budget

The map remains 12,800 × 9,600 with origin (-2400, -2000). The coastline encloses **75,170,297 world units²**, **3.62×** the original 20,757,553.

| Ground | Nominal RGBA texture allocation |
| --- | ---: |
| Original island | 177.00 MiB |
| First expansion WIP | 468.75 MiB |
| Communities build | **358.89 MiB** |

The final ground uses **48 tiles of 1400 × 1400**, all below 1536 pixels. This is 23.4% less ground texture allocation than the WIP expansion, and about 2.03× the original for 3.62× the land. Embedded original SVG source decoding and total browser memory are not included in this nominal GPU texture calculation. Browser RSS could not be measured here.

## Proofs and review

All files below are in `concepts/themes/world-map/bigger/`:

- Drawing made before production apply: `community-communities.png`, with all four community names.
- Production overview: `community-built.png`; labelled overview: `community-built-labelled.png`.
- Drawing/build comparison: `community-vs-communities.png`.
- One ground crop per community, each **0.8 px/unit**: `community-crops/storynest.png`, `patchwing.png`, `sproutshare.png`, `lanternloaf.png`.
- Additional **0.8 px/unit** details: `storynest-homes.png`, `patchwing-workshop.png`, `lanternloaf-bakehouse.png`, `open-common.png`.
- Required path crops at **0.8 px/unit**: `road-junction.png` and `residential-lane.png`. Reference comparison: `community-paths-comparison.png`.
- Preservation comparison: `community-crops/preservation-before.png` and `preservation-after.png`.

**Honest score for lived-in, meaningful communities: 8/10.** The homes now have visible owners' jobs, domestic details, shared spaces and workplaces, rather than an activity prop on a lawn. The four neighbourhoods have different roofs, building colours, layouts and purposes. The remaining gap is illustrative richness: cottage facades and garden furniture still repeat, the new vector buildings are simpler than the traced original centre, and the path-edge dressing is more regular than Cursor Camp. The large commons are intentional walking space.

These are static assemblies of production SVGs, including sleepers, standing props, decks and illustrative contact shadows. They do not prove runtime water effects, culling or animation. A headless Chromium launch was attempted and failed before a page could open in this sandbox. Live browser and measured memory verification remain outstanding; no visible browser fallback was used.

## Validation

- Fresh server: `DUCKY_WS_PORT=19005 node server.mjs`.
- `DUCKY_WS_PORT=19005 npm test`: **183 passed, 0 failed**.
- Community tests: **4 passed, 0 failed**, including original-record preservation, every community arrival, promenade/loop connectivity, 22 front doors, four workplace approaches, visible fences, on-land placements, GPU-safe tiles, mooring clearance, boarding and harbour return routes.
- `node scripts/bigger-community/check-communities.mjs`: passed; all 22 homes and four residential loops reachable, visible solids blocked, and no new prop bounds intersect the original island.
- `node scripts/theme-index.mjs --check`: Community **READY, sleepers 40/40**; all other themes remain READY.
- `npx vite build --configLoader native`: passed. Existing large-chunk advisory remains.
- `git diff --check`: passed.

Logs and validation JSON are in `scripts/bigger-community/`.

## Reproduction

From the worktree:

```sh
python3 -m pip install --target /private/tmp/ducky-community-python -r scripts/bigger-community/requirements.txt
node scripts/bigger-community/communities.mjs
python3 scripts/bigger-community/terrain.py
node scripts/bigger-community/draw-communities.mjs
node scripts/bigger-community/apply.mjs
node scripts/bigger-community/check-communities.mjs
node scripts/bigger-community/proof-communities.mjs
```

Python requires Shapely 2.2.0 for road-boundary union. `DUCKY_COMMUNITY_PYTHON` can point to another package installation directory. Production rendering has no Python dependency.

## Shared changes and handoff

**No shared engine, navigation, world-map or theme-registry code changed.** Changes are confined to the community theme's art/data, `scripts/bigger-community/`, and `qa/bigger-community.test.mjs`. Concept images and this report are in the shared concepts folder.

The instructed team-feed log was attempted, but writing `~/.claude/team/feed.md` was denied by the filesystem sandbox. This report is the durable handoff. The hook may have mirrored its message despite the failed feed append; the log command printed a success line after reporting the write error.
