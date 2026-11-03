# Wearable alignment audit

Date: 2026-11-03

## Plan and completion

1. Completed: inspect all 34 designs at 0°, ±45°, ±90°, ±135°, and 180° in `qa/wardrobe.html`.
2. Completed: measure the head and neck outlines and use the existing eye, shoulder, and foot pivots as attachment points.
3. Completed: generate explicit directional frames, preserve original front artwork where it fits, and correct directional visibility and layering.
4. Completed: review the 272 isolated views and four combined outfits; check raised-wing poses, movement, outfit replacement, and direction changes.
5. Completed: run asset checks, browser runtime checks, repository tests, and the production build.

## Corrections

- Neckwear: scarves, collars, and kerchiefs reach both edges of the measured neck in every direction. Scarf fabric retains its width; knots, tails, and front decorations have directional visibility.
- Headwear: front and rear details switch by direction, including diagonal views. Brims, badges, helmet lining, fish openings, headscarf knots, headset bands, horns, and microphones follow the intended facing. Headsets sit at the temples. Tufts remain visible with headphones and hide beneath enclosing hats.
- Glasses: lenses follow the actual eye positions. Round, heart, and feather designs retain distinct shapes. Lenses are occluded when the face is hidden.
- Shoes: each visible foot owns its shoe and its animation pivot. Original front designs are retained; side and heel frames have curved soles. Bare feet hide and restore correctly when outfits change.
- Layering and movement: straps and worn items remain on the body; carried items follow their wing pivot. The body occludes the far side of carried objects. Wing hinges stay inside the shoulder, glasses sit beneath headwear, and outfit property order cannot alter layering. Turning selects one complete rig without doubled silhouettes.

## Validation

- `npm test`: 19 passed. The socket test requires `npm start` on port 8810.
- `npm run build`: passed.
- Asset checks cover all eight directions for all 34 wearables, valid SVG references, neck coverage, foot anchors, visibility rules, and shoulder pivots.
- Browser check: 272 directional cases and 2,720 action cases passed, along with outfit cleanup and property-order-independent layering.
- Visual review: all 272 isolated views, four combined outfits across eight directions, and full-motion wave/party samples.

Open `/qa/wardrobe.html` through Vite to inspect the matrix. Add `?group=outfits&verify=1` to run the browser checks. The gallery also supports `action=0` through `action=9` and `fullMotion=1`.

Non-front artwork is newly constructed SVG artwork. Automated checks validate geometry, visibility, lifecycle, and finite animation bounds; they do not establish artistic perfection.
