Pagepond plaza benches

Run `node scripts/pagepond-benches/build.mjs` to reapply this correction to the current island. The Pagepond ground builder also calls it before validation. It only changes the nine listed seats and their existing collision entries, preserving all other props, sleepers, ground, paths and artwork.

The open-book court uses the actual rounded-rectangle contour from the preserved reading-court clip path. Its five seats are spaced by equal distance along an inward offset of that contour. The authored starting station keeps both approach lanes clear. The bookstore's four curved seats use equal distance along its southern paving rim. The globe plaza's existing tangent arc benches and the unpaved reading greens stay intact.

The shared Home bench drawing receives contour points directly. Seat planks follow the local tangent, the backrest sits on the outer side, and legs lift vertically in the island camera. Each seat has its own flat SVG with ink #39472d and a matching ground footprint. Original source assets remain unchanged.

Tests: `node --test qa/pagepond-benches.test.mjs qa/pagepond-ground.test.mjs qa/pagepond-hamlets.test.mjs qa/pagepond-additions.test.mjs qa/pagepond-rivers-sail.test.mjs qa/bigger-library.test.mjs`.
