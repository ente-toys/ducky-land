# Sunbob, Home path and bridge repair

No commit or publish. Approved source: `5acb0b5d home:home-glowup` and the three mandatory Home review documents.

`remap.py` executes Home's actual `sample` and `path` functions from `scripts/home-review/paths.py`. It uses the same 128/104 widths, round buffers, 85-unit union fillets, sand #fde48c and exterior lower edge #e4c567. The final half-unit topology-preserving reduction is from Home's `polish-ground.py`. No automatic shortest connectors or old blueprint lane polygons survive. Real hamlet courts and the bloom paving remain destinations. The book-sleeper rectangle, old plaza path painter, cream lawn smudges and disconnected bank strips are excluded.

`bridges.mjs` reuses the span fitting and exact four Honeywood SVG bodies from Home's `scripts/home-review/bridges.mjs`. All 14 crossing assets carry their original Home source. Art and walking data share the deck endpoints and crowns, and every crossing has `boatPassUnder`. The harbour's landing pier remains a pier, not a river crossing.

All 1,050 original field/fence placements retain their art, scale and coordinates. Clip wrappers trim only lane overlaps and the bridge gaps, with the original SVG bodies intact. All 448 riverbank fence flowers retain their positions. Field collision polygons have the same corridor cuts. Offending scenery moves to clear margins, with its footprint. All 90 residents resolve; only rejected proposals move to nearby clearings.

Regeneration, from the repo root:

```sh
node scripts/sunbob-ground/data.mjs
/private/tmp/sunflower-fix-venv/bin/python scripts/sunbob-ground/remap.py
node scripts/sunbob-ground/bridges.mjs
node scripts/sunbob-ground/residents.mjs
node scripts/sunbob-ground/finalize.mjs
node scripts/theme-index.mjs
```

The Python interpreter needs Shapely. `data.mjs` exports only the authored hamlet destination courts. `routes.json` is the complete authored lane network. All 72 ground tiles and the globe fallback contain the same continuous drawing, with real neighbouring bleed.

Verification: `qa/sunbob-paths.test.mjs` checks exact Home bridge bodies, both path contacts, walking both ways at server/render tick rates, and every route sample in client and authority. The existing Sunbob sailing tests drive a real boat from the harbour through both mouths and around the river ring, beneath every bridge, and back. `walk-audit.mjs` checks the entire route network; `scripts/sunbob-integrate/audit.mjs` checks all homes, destinations and the actual bloom floor. The non-socket suite excludes only `network.test.mjs` and `multiplayer.test.mjs`. Build uses `npm run build -- --configLoader runner` because node_modules is a shared read-only symlink.
