Pagepond B integration, local only, no commit.

335 of 337 proposed plants accepted. Dropped page-b-bedtime-canopy-bed-5 for overlap with a retained contact and page-b-north-channel-west-1 for water clearance. All 32 approved bush replacements and four perimeter moves applied by ID, including authoring footprints. One hill, 13 runtime kite sites, 150 new residents, 190 total. Original forty residents remain exact. Fifteen exact baked contacts removed; runtime shadow overrides applied by ID.

The hill mound is embedded as vector terrain in its intersecting ground tiles before their existing path painter. It is deliberately not an opaque flat above the route. Its lane and viewpoint apron join the same #FFF0C7 union. There is one opaque path colour and one painter per tile. The original forty include seven residents on retained destination courts; new residents are checked against the entire surface with 16 walking units of clearance. Every resident clears full-width travel lanes.

Authoring inputs are placements.json and shadows.json copied from the supplied B handoff. filter.json records final accepted IDs and both drops. apply.mjs is a guarded one-time integration, not a rebuild command. Existing pagepond-ground/build.mjs preserves integrated hill terrain and stripped contacts on rebuilds.

Checks:
  node scripts/pagepond-b/verify.mjs
  python3 scripts/pagepond-b/verify.py
  python3 scripts/pagepond-ground/geometry-audit.py
  node scripts/pagepond-ground/walk-audit.mjs
  node --test qa/pagepond-*.test.mjs qa/bigger-library.test.mjs
  npx vite build --configLoader native

Python uses the same local Shapely package fallback as job A. verify.mjs independently resolves production server/client sleep registries and checks dry contact perimeters, including 16 walking units. verify.py checks full new contact/sleeping footprints against the final painted union and verifies every tile's single opaque colour. Sailing tests drive actual simulation actors through the sea approaches, moats, south river and arches. These are source/navigation checks, not a claim of live browser visual acceptance.
