Campfire ground vector recovery

From the repository root:

    node scripts/campfire-ground/build.mjs
    node scripts/campfire-ground/render.mjs

Render output defaults to ../concepts/themes/work/campfire-check. Override with CAMPFIRE_RENDER_OUT. The renderer reads before assets from git HEAD. Run it before committing to retain the intended baseline. It creates separate before/after PNGs and a comparison for every tile, full-island and ground-only views, all adjoining seam strips, and report.json. --seams-only refreshes the seam checks against an existing report.

There are 48 expansion ground files in the live manifest. Thirty contained <image> elements. The images were actually base64 SVG drawings, with the same geometry as scripts/bigger-community/original/ground.svg. No raster tracing was needed. source.svg retains the original expansion vector drawing, followed by that original centre drawing inside the existing preserved-dry clip. It contains no image embed, data URI, gradient or filter. Polygon simplification in this source is bounded to 0.05 world units. Coordinates are rounded to 0.001 world units.

The build writes only the existing expansion/ground-*.svg files. All 48 are compacted together so the Homeland lawn palette cannot create mismatched tile borders. It uses the same coast, sand, water, path silhouettes, lawn patches, tufts and stones. The visible changes are the main lawn changing from #a7c653 to Homeland #93b72f, lighter lawn patches, and dark ground outlines using #39472d. Ground detail positions are retained. No prop, building, tree, bridge, scene manifest, path data, walk data or sleeper is written.

Each output keeps its existing 1400 by 1400 intrinsic size and world viewport. Offscreen detail is removed. Large polygon rings are cropped 200 world units beyond the tile, safely beyond the widest stroke. Patterns retain their original global phase. Output references are self-contained.

The seam check compares each pair's 64-unit strip against the uncropped canonical drawing rendered in matching full-tile viewports, including the two centre columns/rows at each join and opaque-pixel gaps. Matching viewports avoids false differences from librsvg's pattern sampling when rendering a narrow strip directly.

The Home path and water pass now composes material.mjs before tiling: one #fde48c path union at 128/104 widths, winding lawn holes preserved, sea-colour inland water and no dark coast contour. Lawn decoration comes only from the original source.svg, unchanged from d1d791e6. No extra lawn tufts, flowers or darker patches are generated. The report records zero added lawn features. Flattened path rings are cropped directly per tile to keep payload near the original size.
