Run from the worktree root:

```sh
node scripts/globe-svg/build.mjs          # all 9 active islands
node scripts/globe-svg/build.mjs fair     # one theme
node scripts/globe-svg/build.mjs isle-170 # one island ID
```

The generator reads each current island's art manifest, world bounds, authored
terrain and placements. It resolves SVG inheritance, CSS, instances, viewports,
clipping, masks and stroke geometry before simplifying paths in overview pixels.
Every painted path has an explicit solid fill. Output has no images, gradients,
filters, CSS, or nested source references. Reusable sprites share a symbol.

Paths, rivers, plazas and garden decals retain their source geometry. Ground
fallbacks also include flats, floating ground details and all bridge/deck art.
The overview adds the complete standing prop composition in its authored order,
including buildings, trees, gardens and field sprites. There is no fixed limit
on a building's retained shapes. Opaque pattern bases remain; transparent fine
grain is omitted. Gradients become solid source colours.

Each output has a 1024-pixel longest edge. Quarter/half-pixel coordinate rounding,
relative path commands and safe same-fill merging keep files small. Source
colours remain exact, with paletteDistance zero; neighbouring colours are never
merged to satisfy the size cap. Adaptive detail levels enforce **less than 1,500,000 bytes per
file**. The manifest records the chosen tolerance, coordinate grid, source
counts, bytes and hash. A new source rebuild that cannot fit throws an error.

Source clipping resolves before tile viewports are combined. Tile clip unions
are normalised, and even-odd results are converted to winding paths before
merging or writing. These steps preserve source holes in coasts, canals,
outline strokes and building details. Shared source geometry is compiled once.

Legacy Library and Bog raster crops are recovered from their authored vector
terrain modules with writes disabled. Cathedral uses its preserved SVG and dry
land clip. Community and Goldmine recover their original SVG inside its land
clip. These adapters apply only to legacy layouts; rebuilt vector-only manifests
are consumed directly. Single-island builds preserve all other manifest entries.

The old `scripts/globe-perf/build-previews.mjs` delegates to this generator.

For review, save old PNGs outside game art before removing them, then run:

```sh
node scripts/globe-svg/compare.mjs /path/to/old-pngs /path/to/review
```

Sheets show old PNGs left and new SVGs right, overview above and ground below.
Old previews may predate current island layouts. CPU raster timings and sizes
are saved beside the sheets. These timings are not browser/GPU measurements.

The raster guard freezes only the existing violations in `themes/library`,
`themes/community`, `themes/goldmine`, `themes/bog` and `themes/cathedral`.
Those assets must be redrawn. Exact path and content hashes reject new rasters,
including additions or changed raster content within those five folders.
