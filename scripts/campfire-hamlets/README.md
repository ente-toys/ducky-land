# Campfire Commons approved hamlets

Four boss-approved GPT compositions replace the former outer-ring homes and workshop props. The existing 48 vector ground tiles remain the terrain pipeline. Their old residential paint is replaced with merged cream lanes and paved squares. Original centre props, decals, six decks, sleeping positions, coast and water shapes are preserved.

- 20 buildings, 126 supplied pieces and 83 copies of existing Campfire tree art.
- Houses fit the centre's smaller pavilion scale. Workplaces fit within 1.15 times the largest house's width and height.
- Every new piece has one contact ellipse in the tiled ground, using `#4AA539` at `.24`, copied from `centre/decal-paving.svg`. Buildings also have a short base cast. Preview base ellipses are removed from copied pieces to avoid duplicate shadows.
- Each building, tree trunk and ground prop has a footprint and a walking blocker. Furnishings attached to a building share that building's contact and drawing order.
- Seven outer crossings reuse Home's arched bridge art. Span lengths are measured across actual water. The five original arched crossings also allow boats underneath; the pond dock remains a solid dock.
- Boat water uses the existing open river contours. Shared contour boundaries overlap by `.01` world unit to prevent strict boat bounds from creating a seam at `x=4000` or `y=2900`.
- Thirty-two replaced outer SVG assets are removed. Shared centre/detail art remains.
- No new sleepers were added. All forty approved residents and their positions remain, preserving the centre.

`build.mjs` is idempotent against `baseline/` and the vector ground source. It copies approved pieces from `../concepts/themes/work/campfire-check/svg/`. The per-hamlet layout files are preserved locally under `layouts/`. Placement adjustments fit the supplied compositions to the island's curved banks and separate contacts.

`audit.mjs` checks new contacts against each other, the preserved centre's blockers, painted paths, bridges and water. It walks approaches for all 753 props, samples all 13 bridges, checks all 112 path ends, and checks all forty sleepers. A 12-unit raster flood of the actual painted floor, centre and bridge decks detects crop/coast breaks. All seven new bridges are also checked using the game's full boat clearance.

`render.mjs` renders the whole island, four hamlets and four shadow close-ups into `../concepts/themes/work/campfire-check/final/` using production SVGs, placements and approved sleepers. PNG files are review artifacts only.

Commands:

```sh
node scripts/campfire-hamlets/audit.mjs
node --test qa/campfire-hamlets.test.mjs qa/bigger-community.test.mjs
DUCKY_WS_PORT=8834 node server.mjs
DUCKY_WS_PORT=8834 npm test
npx vite build --configLoader native
node scripts/campfire-hamlets/render.mjs
```

The managed sandbox rejects the server's port bind with `listen EPERM 127.0.0.1:8834`; the multiplayer test server is also denied a port. Network tests require a permitted local execution environment. No commit or publication was performed.
