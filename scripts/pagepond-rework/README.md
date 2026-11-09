Pagepond river and outer-ring revision

This supersedes the ground-only and first hamlet placement builds. Run from the repository root with Node dependencies and Python Shapely 2 + fontTools installed:

    python3 -m pip install -r scripts/pagepond-rework/requirements.txt
    node scripts/bigger-library/build.mjs

PAGEPOND_PYTHON selects the Python interpreter. baseline.json freezes the approved ground/hamlet state used by this revision. Repeated builds start from it, preserving the original centre artwork, original props and building dimensions. The prior builders remain available for historical reproduction and will replace this revision if run directly.

design.mjs specifies the wider village transforms, curved main-route waypoints and twenty named meadow clearings. All added trees, flowers, benches and books use original island SVG artwork. Thirteen existing approved residents move to meadow reading spots; eleven remain in the hamlet rest spots. Forty approved residents remain in total. Geometry rejects placements that cannot keep their required clearances; report.json records those omissions.

geometry.py builds 340-unit moat channels and three open sea approaches, merges rounded paths with the plazas and banks, and places bridge abutments on dry land. The original centre land is preserved. Source contacts cut the floor with a three-unit margin, clearing the path outline too. No raster ground or gradients are generated. Ground tiles share one world-space vector body with a small texture bleed, avoiding seams. Actual shoreRings drive surf around the cut banks; boat navigation uses continuous channels. Walking water is partitioned into local 512-unit pieces for fast collision queries.

bridges.py draws separate NS/EW timber arches in the centre's palette, with upright posts and no rotation or sideways shear. Crown height matches walker elevation. Boats retain the ground projection and pass below overBoats bridges. The NS view has visible arch cheeks and convex board seams. The existing procedural harbor remains unchanged; the static proof includes its matching jetty artwork so the shore approach is visible.

The interrupted rectangular bank-trimming pass was rolled back. Water stays continuous and organic, including every original boat route. Straight decks enclose the actual water cross section across their full width, with 20-unit landing caps. The connected east-south-return road completes the straight-crossing route. bridge-locked-layout.json preserves all hamlet, meadow and resident positions during rebuilding.

Verification and renders:

    node scripts/pagepond-hamlets/audit.mjs
    DUCKY_WS_PORT=8824 node server.mjs
    DUCKY_WS_PORT=8824 npm test
    npx vite build --configLoader native
    node scripts/pagepond-rework/render.mjs
    PAGEPOND_RENDER_OUT=artifacts/pagepond-final node scripts/pagepond/verify.mjs

The walk audit checks every prop, bridge, path end, building approach, sleeper and paper boat against the final contacts and walk graph. River tests sail the actual boat navigator from sea around both moats and back, plus the southern river. The centre comparison checks original assets and interior pixels.

Renders default to artifacts/pagepond-final/. PAGEPOND_RENDER_OUT can select another writable destination. The requested sibling concepts/themes/work/pagepond-check/final directory is read-only in this session. Validation results are recorded beside the worktree renders. No commit or publication is part of this work.
