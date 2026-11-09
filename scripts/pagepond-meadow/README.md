Pagepond's approved paper-boat pool occupies Readers green, south of the globe compass plaza. The authored placement snapshot is self-contained in `placements.json`; the 20 source SVGs live in `public/pixi-art/themes/library/pagepond/meadow/`.

The installer appends 12 floor decals and 22 upright props, plus 214 water regions and 13 solid footprints to both walking maps. It retains all prior entries, paths, residents, coasts and boat navigation. Floor decals use top-left anchors and authored order; boat hulls remain upright sprites with fixed waterline depth, while their wakes stay on the floor. The existing Home bob helpers accept the supplied slow periods and phases, with unchanged defaults for Home boats. Benches use the four supplied inward-facing drawings.

Reapply installed placements with `node scripts/pagepond-meadow/install.mjs`. To recopy source art as well, supply the original `meadow/svg` directory as the argument. Reapplying replaces only IDs owned by this item.

Targeted checks: `node --test qa/pagepond-meadow.test.mjs qa/pagepond-ground.test.mjs qa/pagepond-hamlets.test.mjs qa/pagepond-additions.test.mjs qa/pagepond-rivers-sail.test.mjs qa/home-review-fix.test.mjs`.

Non-socket suite: `node --test --test-concurrency=2 $(rg --files qa -g '*.test.mjs' | rg -v '/(network|multiplayer)\.test\.mjs$')`.

Build with the shared dependency symlink: `npm run build -- --configLoader runner`.

The island uses a 24-unit click-navigation grid so the narrow padded tread necks are sampled continuously. Water and all other islands retain their existing collision.
