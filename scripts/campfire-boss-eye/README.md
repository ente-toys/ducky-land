# Campfire second pass

The approved hamlets are built by `node scripts/campfire-hamlets/build.mjs`.
`garden.mjs` contains the hand-selected grove positions, mixed plant groupings,
activity pockets, flower beds, and 32 additional approved sleeper positions.
There is no random placement. Ground contact, canopy, doorway, path, water,
centre, sleeper and named arrival reservations reject conflicting additions.
The accepted positions and rejected candidates are recorded in garden-report.json.

The build preserves existing SVG files, including the 13 crop repairs and stage.
It retains every centre prop, flat, deck, obstacle, and original sleeper location.
Seven obsolete outer buoy props and their puddles are deliberately retired.
The wide quilting hall and bakery are fitted to cottage height; house fronts
and the treehouse are kept clear. Door approaches and the Sproutshare entry
join the merged path floor before paving lines and shadows are painted.

Community explicitly declares `sleepTotal: 72`; other islands retain their
existing default. `node scripts/theme-index.mjs` refreshes the shared game/server
registry after rebuilding. Run `node scripts/campfire-hamlets/render.mjs` to write
whole-island, hamlet, garden and contact-shadow renders to campfire-check/final2.
