# Bog densify

Completed DENSIFY.md in `/Users/pragadees.xd/Downloads/Ducky Land/ducky-big-bog`, branch `big-bog`, from review commit `47414e2e`.

The two road circuits are now one main loop with short residential, heart, cultivation and pier lanes. The perimeter circuit, broad junction slabs and oversized sandy village squares are gone. Their ground is textured marsh grass, small shared greens and eight named cultivation plots. Main road widths are 150 to 175 world units, heart links 145, residential and work lanes 90 to 110. Existing Bog sand, uneven outlined grass banks, grain, ruts, stones and tufts are retained. Lane tips are rounded at their destinations.

## Road area

| Measure | Review baseline | Final |
| --- | ---: | ---: |
| New dry land | 59,907,300 units squared | 59,907,300 units squared |
| Roads, sandy squares and banks | 23,610,900 units squared | 9,226,300 units squared |
| Share of new dry land | **39.41%** | **15.40%** |

This is a **60.92% reduction** in road footprint. The final share is comfortably below 25%.

Measurement rasterizes the geometric union at 10 world units per pixel. It includes the whole sandy road ribbon, an intentionally conservative 26-unit bank on either side, rounded ends, and the baseline's widened junctions and sandy squares. It clips to new dry land, excluding the original island, water and coastline beach. Before and after use the same denominator and sampling method. Final grass greens are not counted as roads. Details: `scripts/bigger-bog/evidence/dense/metrics.json`; the committed baseline manifests and plan are beside it.

## Communities

All four names, green centres, six-home membership lists and workplace identities remain unchanged. Houses and paired gardens now sit closer, gardens meet along the upper rows, workplaces occupy the edges, and every green has a shared well, existing lamps and seating. Fences, washing lines and mailboxes move with their gardens. Larger 560-unit homes mix with smaller 375-unit ones. Solid building and fence contacts move and resize with the artwork.

| Community | Mean home distance to green, before | After | Reduction |
| --- | ---: | ---: | ---: |
| Croakettle Close | 877 | 697 | 20.5% |
| Wickwaddle Ward | 1,036 | 762 | 26.5% |
| Sporebutton Hollow | 893 | 739 | 17.2% |
| Reedwhistle Reach | 895 | 766 | 14.4% |

The removed coast road becomes the bottle herb garden, brewers training green, lantern wick garden, nightwatch grove, soup fields, reedworkers patch, Kettlebrook herb bank and Reedrun drying bank. These are explicitly positioned groups of Bog plants, growing beds and work materials. The original nine commons stay in place. Mushroom beds, training equipment and the net rack were moved clear of shared greens and approaches.

## Preservation and verification

- Original island: **1,692,304 independently assembled interior pixels compared, zero changed pixels**, maximum channel difference zero, at 0.25 px per world unit. Nothing was pasted over the final render to hide changes.
- Original standing props, raised boxing canvas, paths, sleepers, zones and sampled walking ground remain unchanged.
- Reviewed coast, map bounds, water, four river bridges, all deck records, harbour and community metadata remain unchanged. The two rivers remain non-walkable away from their crossings.
- All 40 sleepers remain valid. All 12 themes report READY with 40/40 sleepers.
- All 24 home approaches and garden gates, four workplaces, four shared greens and wells, nine commons, both banks of each bridge, harbour landing and moorings pass navigation checks.
- New plot props remain on new land. Wells and solid plants have matching physical contacts.
- Existing ground tile entries and native pixel sizes are retained: 93 ground tiles, largest texture side 1400 px, approximately 178.95 MiB base-level ground RGBA allocation. This is a calculation, not a browser heap measurement.
- Changes are confined to Bog art/data, Bog generation scripts and `qa/bog-communities.test.mjs`. No shared runtime or navigation changes.

## Proof

Saved in `concepts/themes/world-map/bigger/`:

- `bog-dense.png`, whole island, 1680 by 1260.
- `bog-dense-crops/croakettle.png`.
- `bog-dense-crops/wickwaddle.png`.
- `bog-dense-crops/sporebutton.png`.
- `bog-dense-crops/reedwhistle.png`.

Each detail crop is freshly assembled at 0.8 px per world unit, 2480 by 2360, from the production art manifest and real SVG/PNG layers. These are static production-asset renders, excluding Duckies, animation and runtime water effects. No visible browser window was opened. No paid generation was used.

**Honest visual score: 8.0/10.** The roads no longer dominate, the homes group more convincingly, and the shared greens have clear uses. Remaining limits: the four domestic arrangements still share a modular language, there are long quiet grass stretches along the preserved coast, and the cultivation patches and wells are simpler than the original ring and manor. This is not a claim of a 10/10 Cursor Camp match.

## Tests

- `DUCKY_WS_PORT=19210 node server.mjs`, restarted with final map data before the full suite.
- `DUCKY_WS_PORT=19210 npm test`: **189 passed, zero failed**, 25.15 seconds, including the room-time performance test.
- Bog-specific checks: **10 passed, zero failed**.
- `npx vite build --configLoader native`: **passed**, 1.90 seconds. Existing large-chunk advisory only.
- `node scripts/theme-index.mjs --check`: **all 12 READY**.
- `git diff --check`: **passed**.

Logs, immutable baseline manifests and measurement output: `scripts/bigger-bog/evidence/dense/`. Pixel comparison: `scripts/bigger-bog/pixel-preservation.json`.

Reproduce the final data and proof with `node scripts/bigger-bog/densify.mjs`, then run `node scripts/bigger-bog/preserve.mjs built`. The immutable review baseline is read from the evidence folder, so re-running is idempotent. The larger crops include complete roofs, gardens and edge workplaces.

The required team-feed command was attempted, but this session's sandbox denied the append to `~/.claude/team/feed.md` with `Operation not permitted`. Its generic `logged` output does not establish a feed entry. The local commit was also blocked: Git could not create `/Users/pragadees.xd/Downloads/Ducky Land/aswin-ducky-land/.git/worktrees/ducky-big-bog/index.lock` (`Operation not permitted`). The changes remain uncommitted in the worktree, with the initial staging present. Re-stage the working files before committing: the Vite log had one trailing space, now removed in the working copy, but the sandbox also blocked updating its staged copy. `git diff --cached --check` therefore still flags that stale log line; the working-tree check is clean. The local report copy under `scripts/bigger-bog/evidence/dense/REPORT.md` is untracked. Nothing was pushed or published.

DONE
