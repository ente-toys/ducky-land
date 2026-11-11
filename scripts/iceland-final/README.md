# Iceland final, quality round 3

```sh
node scripts/iceland-final/place.mjs --dry-run --out /tmp/iceland-final-preview
node scripts/iceland-final/place.mjs --write
node --test qa/*iceland*.test.mjs qa/*snow*.test.mjs qa/three-game-budget.test.mjs
npx vite build --configLoader native --outDir /tmp/q3-dist --emptyOutDir
```

`place.mjs` loads the authored manifests and delegates group composition to `quality3.mjs`. The approved buildings, yards, path geometry, sled hill, snowfall and snow caps remain. All 536 trees and 60 residents remain. Eighteen existing trees transfer from deep groves to six composed coastal clearings. The former coverage pockets, random footprint bits, isolated shrubs, frozen puddles and personal sleeper nooks are retired.

Existing groves now own their shrub clumps, drifts and pebble clusters, placed within 120 units of the tree drawings. Between them is calm snow. Detail uses shared, sharp SVG crops. Ground marks remain outside furniture and buildings. No frozen puddles remain.

Twenty camps each contain three different sleeper poses around one cocoa table, woodpile or snowman, with a lamp, planted shoulders and an unoutlined soft `#eef3f9` snow ellipse. All eight poses remain. The camp anchors are authored data, fitted as whole compositions to preserve walking clearances and the exact maximum of four sleepers in every possible 1440 by 900 view, including views between the sampled audit positions. Production sleep resolution includes the harbour jetty.

Each camp has one continuous footprint trail from an existing lane. The game navigation routes the trail around solid props, with additional clearance around the full drawings of buildings and furniture. Footprints maintain a continuous 20-unit cadence across every bend. Tight SVG chunks avoid reserving large empty textures for diagonal trails. Trail chunks belong to a single connection, never independent coverage items.

Coverage samples every 1440 by 900 land view at a 120-unit stride, including shoreline views whose centre is land. It counts a composed grove, camp, yard or activity scene with at least two visible substantial members. Individual pebbles, single shrubs, footprints and snow patches cannot qualify. QA also checks ownership and maximum isolation distance for small items, camp membership, continuous trail spacing, resident safety and deterministic regeneration. Earlier density tests now assert the reduced grouped layout instead of requiring hundreds of scattered shrubs.

`ground.mjs` preserves the original continuous snow lip, blue Bezier lanes and seamless junctions. Terrain, shared crops, both world maps and the snow registry row regenerate together through `--write`. No git operation, publication or credit use is involved.

The natural lake build is left at `/tmp/lake-dist`. The local travel fixture cannot open a listener in this sandbox (`listen EPERM`), so static render inspection supplements the automated checks; live walkthrough verification remains unperformed here.

## Natural frozen lake

`lake-assets.mjs` contains the hand-authored SVG kit from approved rink option 1. `lake.mjs` composes it into the existing rink area before the quality and ground regeneration. All new sources live in `public/pixi-art/themes/snow/final/rink/`, with ink `#39472d`, flat fills and no gradients. The standalone ice decal is also baked into the lake surface to avoid a second large texture. The eager lake texture stays below 4096 pixels per side, with shore props using the shared SVG crop pool.

The former fence, gates and centre tree are removed from art and collision data. The three existing path nodes now identify shore approaches, with their coordinates preserved. The cubic lake outline is sampled for shared skating geometry. Every shore remains ordinary walkable land except solid prop footprints; the jetty deck is dry, with separate post collisions.

Automatic entry uses a cached ice-only navigation graph to reach the open heart without crossing the wooden jetty or snowy coves. Drift uses ordinary navigation, so it can leave anywhere on the shore and restores walking on snow. Authority and prediction run the same motion code. QA covers dense perimeter entry, centre arrival, twirl, dry deck, rock/post collisions, momentum, reduced motion and reconciliation.

`node scripts/iceland-final/lake-proof.mjs` writes the SVG scene, PNG scene and reference comparison into `concepts/themes/work/iceland-final/check/` beside the approved painting. No git writes, publication or credit use.
