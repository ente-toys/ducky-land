# Waterfall communities

Every new prop is placed in the authored plan in `compose.mjs`. The four neighbourhoods each have five homes, garden gates and a shared workplace. `original/` is the immutable pre-build source for regeneration and preservation checks. All coordinates stay in the original island's frame.

```sh
python3 -m pip install --target /private/tmp/ducky-waterfall-geometry -r scripts/bigger-waterfall/requirements.txt
node scripts/themes/waterfall-preview.mjs
node scripts/bigger-waterfall/compose.mjs
node scripts/bigger-waterfall/compose.mjs --build
node scripts/bigger-waterfall/render.mjs
node scripts/bigger-waterfall/proof.mjs
```

The first compose command draws the labelled concept. The separate `--build` command writes the game files. The canal subtracts the original two islets from its water polygons, keeping their original dry surfaces. Those islets no longer request ocean surf because they are now inland. New bank and road geometry is authored, while grass microtexture is a repeating original vector motif.

The original ground source is preserved verbatim inside clipped derivative tiles. It is retiled from 1560 to 1300 units in width to comply with the 1536 limit. It keeps resolution 1. New ground uses resolution 0.6. Proof renderings read those real production tiles and prop records. Static art proofs exclude live players, sleepers, animated water, contact shadows and the engine's procedural harbour dock and boats.

On this machine Logitech owns IPv4 port 19010. The optional test shim sends this task's server and tests to IPv6 loopback on the same port:

```sh
DUCKY_WS_PORT=19010 NODE_OPTIONS=--require=./scripts/bigger-waterfall/ws-localhost.cjs node server.mjs
DUCKY_WS_PORT=19010 NODE_OPTIONS=--require=./scripts/bigger-waterfall/ws-localhost.cjs npm test
npx vite build --configLoader native
git diff --check
```

Without the conflicting service the shim is unnecessary. No browser window is opened by these scripts.

## Review fixes

`review-art.mjs` supplies the raised road verges, seven composed commons, real spring-garden pond, and cottage silhouette variants. `compose.mjs --build` includes these improvements without changing the locked heart artwork. The west/east canal end pieces now stop at the banks; the original spring bridge has matching water and bridge collision shapes.

```sh
node scripts/bigger-waterfall/compose.mjs --build
node scripts/bigger-waterfall/render.mjs
node scripts/bigger-waterfall/review-audit.mjs
node scripts/bigger-waterfall/review-proof.mjs
node scripts/bigger-waterfall/proof.mjs
DUCKY_WS_PORT=19130 node server.mjs
# In another terminal:
DUCKY_WS_PORT=19130 npm test
npx vite build --configLoader native
git diff --check
```

The saved `review-baseline.json` holds the before-pass crossing measurements, so later bridge audits do not need a temporary copy of the previous map. Review evidence is in `concepts/themes/world-map/bigger/waterfall-fix-proof/`, alongside `waterfall-fixed.png` and its bridge, junction, lane and community crops. These are headless production-layer assemblies, with the runtime harbour audited separately against map geometry.

## Densify pass

`dense-art.mjs` adds the shared greens, pumps, kitchen gardens, shared washing lines and reed allotment. The plan now has one main road circuit, four heart spokes, the harbour lane and short garden lanes. Homes retain their ids and workplaces retain their positions. Two homes per community are larger. No rivers, bridges or harbour records change.

```sh
node scripts/bigger-waterfall/compose.mjs --build
node scripts/bigger-waterfall/dense-proof.mjs
DUCKY_WS_PORT=19212 node server.mjs
# In another terminal:
DUCKY_WS_PORT=19212 npm test
npx vite build --configLoader native
git diff --check
```

`dense-baseline.json` preserves the pre-densify road polygons and home coordinates from `a7bb5f54`. `dense-area.py` measures the union of road sand and an 18-unit bank envelope, clipped to new dry land. It also conservatively counts the final front-gate footpaths. Run it with the same geometry dependencies as the build. The final road footprint is 13.77% versus 21.63% before. Household envelope reductions are an approximate composition measure, not a navigation or rendering metric.

Proof: `concepts/themes/world-map/bigger/waterfall-dense.png`, `waterfall-dense-{fern,mill,reed,fish}.png`, and `waterfall-dense-proof/`. Community crops are 0.8 px/unit. `dense-proof.mjs` checks the locked heart records, original SVG tile hashes, all water/bridge/deck records, community identities and harbour against the fixed-pass commit, then renders the actual production art. The existing `waterfall-fixed.png` is retained as the before image, since re-rendering old prop records against SVGs that have since changed would be misleading.
