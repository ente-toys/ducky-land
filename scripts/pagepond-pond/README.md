Pagepond reading pond, local SVG finish.

The kidney-shaped water stays inside the former oval, leaving a soft grass bank
between it and the river. Lilies, four reed/cattail props, reading furniture,
residents and Home's original jetty remain in place. The dock still meets the
existing opaque parchment path. Water collision follows the SVG curve on both
client and server.

`node scripts/pagepond-pond/apply.mjs` changes only this pond in the authoring
master, legacy ground and intersecting runtime tile, plus its water shape.
The normal Pagepond ground build reapplies this finish after rebuilding terrain.
No path surface, prop placement, river, bridge or unrelated island is repainted.

Targeted checks: `node --test qa/pagepond-pond.test.mjs qa/pagepond-*.test.mjs qa/bigger-library.test.mjs`.
