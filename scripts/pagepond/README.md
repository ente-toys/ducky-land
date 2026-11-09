Pagepond outer ground and water

Rebuild from the repository root:

    node scripts/pagepond/build.mjs

The previous scripts/bigger-library/build.mjs entry forwards here. This is the ground baseline for the approved hamlet placement that follows. Run it BEFORE placing the new hamlets; it intentionally resets the expansion to empty reserves and original plant groves.

Source decisions live in design.mjs: two sea-facing coast curves, seven connected routes, three open waterways and eleven hand-composed tree groups. geometry.mjs provides vector boolean operations and exports sampled bank contours for navigation. bridge.py reprojects the actual contours of canal-bridge-north.svg and its front railing, with upright posts and arch lift. It requires Python fontTools; the Node geometry uses the project's @napi-rs/canvas dependency.

All 80 bigger/ground-{row}-{column}.svg files are real vector paths. They retain 700x650 intrinsic dimensions and 1400x1300 world viewports, keeping the existing texture budget. No raster image, data URI or gradient is generated. River mouths meet the sea through rounded land contours. Paperboat Cut now continues southwest to the southern sea instead of ending in a blind pocket.

There are eight main-route arched crossings. Bank measurements determine each span and landing. Duplicate northwest timber and the secondary coastal crossings are retired. Back/deck layers and front rails are separate for Ducky occlusion. Collision strips follow each deck; their short dry-bank aprons compensate for the engine's 20-unit water padding. Raised walkways explicitly allow boats underneath. The old centre bridges, jetties and pond dock remain unchanged.

The 374 original props, 3,134 flats, floating objects, six centre decks, sleep spots, interior paths, obstacles and zones are retained. Every original drawing stays unchanged; centre-lock.json records their hashes. Original ground crop files remain unchanged and draw first. The vector expansion covers the obsolete surf only outside the original coast rings. A 48-unit inset pixel proof compares 1,581,405 interior pixels with zero differences. Inherited centre reuse art, including its existing gradients, stays locked.

The old outer homes, workplaces, gardens, stalls, benches, household lanes, pads, repeated lantern-tree rows and their collision contacts are removed. The four named zones remain reachable and clear for the approved kits. Forty-six mixed original trees plus eleven original bushes occupy groves outside the reserves and off the routes. All 40 original sleepers remain in place.

Verification:

    DUCKY_WS_PORT=8824 node server.mjs
    DUCKY_WS_PORT=8824 npm test
    npx vite build --configLoader native
    node scripts/pagepond/render.mjs
    node scripts/pagepond/verify.mjs

render.mjs writes the complete island, four coast views, all four reserves, centre views and crossing/mouth crops to ../concepts/themes/work/pagepond-check/ground, or PAGEPOND_RENDER_OUT. verify.mjs adds a pixel comparison of the centre interior ground. The recursive raster guard and bank/route/centre checks are in qa/pagepond-ground.test.mjs; existing expansion checks have been updated for intentionally cleared villages and retired stepping stones.

Sandbox validation on 9 November: 337 full-suite checks, 313 passed, 24 failed because listener/connect calls are denied with EPERM. Starting server.mjs on 127.0.0.1:8824 is denied too. No test was skipped or changed to hide that limitation. The Vite build passes. All ten Library/Pagepond checks pass. Nothing was committed or published.
