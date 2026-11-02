# Ducky Land illustration asset library

Completed 29 October 2026 in `codex-assets`, local only.

**203 hand-built SVG assets, 3,909 filled paths, nine categories.** Every asset has its own dimensions, size in Ducky units, bottom-centre ground anchor and converted RML fragment in [assets/manifest.json](assets/manifest.json).

Start with the [complete true-scale sheet](sheets/true-scale-all.png), [style comparison](sheets/style-comparison.png) or [actual Rive render](pipeline-five/proof.png). The packaged handoff is `ducky-land-assets.zip`.

The ZIP contains the SVGs, manifest, RML fragments, contact PNGs, both native Rive projects, QA records and this report. The full rebuild sources and installed rendering dependencies remain in the workspace described below.

## Contents

| Category | Count | Included | Contact sheet |
|---|---:|---|---|
| Nature | 37 | Ten trees: oak, round, willow, banyan, baguette, croissant, blossom, pine, palm, coconut palm. Four bushes, six flowers, four rocks, three grass tufts, three mushroom assets, three lily pads, reeds, cattails, log, stump. | [nature.png](sheets/nature.png) |
| Water | 25 | Pond, four decorative banks, three waves, three ripples, fountain base/bowl/jet, three bridge pieces, rowboat, sailboat, paper boat, two floats, two buoys, dock. | [water.png](sheets/water.png) |
| Buildings | 13 | Cottage, townhouse, raised pond house, bakery, library, cafe, kiosk, bread/fruit/flower/ice-cream stalls, gazebo, rubber-duck lighthouse. | [buildings.png](sheets/buildings.png) |
| Street | 33 | Two benches, two lamps, four signs, three fence pieces, two bins, mailbox, bunting, eight city flags, two umbrellas, picnic table/basket/blanket, two planters, bollard, hydrant, cycle rack. | [street.png](sheets/street.png) |
| Beach | 15 | Three sand edges, three shells, two starfish, two sandcastles, two towels, beach ball, bucket, spade. | [beach.png](sheets/beach.png) |
| Food | 16 | Loaf, baguette, croissant, bread slice, golden bread, egg, golden egg, two ice creams, apple, pear, cherries, doughnut, pretzel, cupcake, seed bag. | [food.png](sheets/food.png) |
| Tiles | 24 | Eight periodic terrain/path tiles, twelve oriented transition edges, four shoreline corner connectors. | [tiles.png](sheets/tiles.png) |
| FX | 20 | Three puffs, three splashes, two plain five-point stars, three hearts, ZZZ, five speech/thought/Quack bubbles, droplet, exclamation, question. | [fx.png](sheets/fx.png) |
| Icons | 20 | Bread, egg, heart, home, map, compass, camera, quack, flock, trophy, settings, sound, mute, flag, return, walk, location, wave, moon, sun. | [icons.png](sheets/icons.png) |

Flags cover Kochi, Chennai, Bengaluru, London, Mumbai, Delhi, Hyderabad and Pune. These are original game flock pennants with city motifs and path lettering, rather than claims to official civic flags.

## Measured style and scale

Read `../BRIEF.md`, `rive/drip_style.py`, the original Drip source and the existing plaza style sheet. Measurements and palette checks are saved in [qa/audit.json](qa/audit.json) and [qa/wardrobe-palette-reference.json](qa/wardrobe-palette-reference.json).

- Original stackable Ducky canvas: **713 × 937**. Its actual visible artwork occupies approximately x=125 to 587.25, y=261 to 792. The transparent padding is retained in comparisons.
- Both outer body ink bands at source y=430 measure **7.5 units**, sampled from a 4× render. This is 1.052% of the source canvas width, or **1.8 pixels at plaza scale 0.24**.
- World contour ink is **#232323, 7.5 units**, expanded into filled paths. Scaling an inset fruit or motif preserves the same contour width. Coloured stems, lettering and decorative marks have their own appropriate filled geometry.
- Palette follows `drip_style.py`: Drip yellow **#F4D93B / #F2BA3D**, cream **#FFF4C5**, orange **#FF814A**, white, and the kit's outfit-derived leaf, water, wood, stone, metal, red, blue, amber, purple and pink pairs.
- Each principal solid shape has one flat dark region on its right, authored at approximately **23% of its width**, and a thin upper-left white streak, generally **2.5%**. Small details and terrain patterns use flat fills where appropriate.
- Shapes use hand-authored curves with rounded contours and controlled wobble. No image tracing or AI image generation was used.

The tree canvases are approximately 2.4 to 3.2 nominal Ducky canvas heights. Compared with the source's visible character, they stand roughly four to six Duckies tall. The bench's main slats are 713 units wide; the complete bench, including arms and padding, is 818 units wide.

Each SVG has explicit `width`, `height` and `viewBox`, expressed in these shared world units. The category sheets fit each asset independently for inspection. **Use the true-scale sheet to judge relative size.** Every row of that sheet includes the original Ducky at the same 0.19 scale as the assets.

## Placement and tiles

For an asset with anchor `(ax, ay)` and chosen world scale `s`, place its SVG origin at:

```text
x = groundX - ax * s
y = groundY - ay * s
```

Then use a uniform scale `s` for both the asset and Ducky. Props have 12 units of safety padding; their anchor is `(width / 2, height - 12)`. Exact tile canvases have no padding and anchor at `(356.5, 713)`. The original Ducky rig's reference ground point is `(360, 776)`.

Tiles use exact **713 × 713** extents:

- Eight base tiles repeat in both axes: grass, sand, water, cobble, large cobble, dirt path, brick path and stepping path.
- Twelve edge tiles repeat along their edge axis. The manifest records `repeat_axes: "x"` or `"y"`.
- Four water corners are connectors, with `repeat_axes: ""` and `seamless: false`. Their matching neighbours are listed in [qa/tiling-check.json](qa/tiling-check.json).
- Decorative pond/sand bank props are separate scenic silhouettes. Use the tile set for exact continuous terrain boundaries.

[Tile repeat preview](sheets/tile-joins.png) shows the periodic and edge-axis joins. The vector check sampled 713 colour pairs on each of 28 repeat boundaries and 16 corner connections, **31,372 pairs with zero mismatches**. This checks positional colour continuity, not a general smoothness proof.

## SVG structure

The asset audit permits only `svg`, `title`, `desc` and `path` elements. The 203 assets contain:

- **3,909 filled paths**.
- **0** raster images, filters, gradients, masks, clip paths, SVG strokes, text elements or external font references.
- **0** empty, nonfinite or clipped paths, and **0** colours outside the measured kit palette.

Every ink contour, highlight, shade, sign label and flag label is actual geometry. Boolean operations were resolved before export. Glyph outlines come from the project's existing Gilroy Black font, so import does not depend on live fonts.

`build_library.py` is the editable drawing source. PathOps computes intersections and expands curves into outlines; it does not invent or trace the artwork.

## Rive proof

All **203 SVGs** passed through the requested shared converter:

```text
/Users/pragadees.xd/Developer/hallow-os/tools/svg2rml.py
```

Converted Node fragments are under `rml/<category>/<name>.rml.frag`. The full [pipeline-all](pipeline-all) project contains 203 separately named artboards, with spaced editor positions. Its compiled runtime is [ducky-asset-library.riv](pipeline-all/build/ducky-asset-library.riv), **2,407,048 bytes**.

The small [pipeline-five](pipeline-five) project imports **tree-palm, bakery, bench-wood, float-duck and croissant**, with the actual original Drip Ducky beside them at one shared scale of 0.32. Its compiled runtime is [ducky-five-imports.riv](pipeline-five/build/ducky-five-imports.riv), **150,958 bytes**.

Both projects pass `rive --verify` with **0 errors and 0 warnings**, and `rive inspect --summary` with an empty `problems` list. Evidence: [five-project inspection](pipeline-five/inspect-summary.json), [full-library inspection](pipeline-all/inspect-summary.txt).

The CLI screenshot command could not create a Metal context in this session. The browser automation host was also unavailable. The completed screenshot instead uses the genuine **Rive Canvas2D WASM runtime with Skia CPU**, loading the compiled `.riv`. It is not an SVG render substituted for Rive.

- [Actual five-import Rive screenshot](pipeline-five/proof.png), 2800 × 1240.
- [SVG reference for the same layout](pipeline-five/expected.png).
- Five-import mean absolute RGB difference: **0.115 / 255**.
- Every one of the 203 compiled artboards was also rendered at 40% scale to `qa/rive/<category>/<name>.png`.
- Largest per-asset mean absolute RGB difference from librsvg: **1.187 / 255**. Full results: [qa/rive-pixel-comparison.json](qa/rive-pixel-comparison.json).

These comparisons verify conversion fidelity. They do not replace the visual style review. No Luau, scripts, signing, account binding, Rive push or publishing was needed.

## Visual review and corrections

Opened and inspected every category PNG, the complete world-scale sheet, the style comparison, the tile repeat preview and the actual five-import Rive render.

Corrected the issues found during that review:

1. Palm trunk marks escaped the silhouette. They are now intersected with the trunk paths.
2. Translated shading on concave shapes created dark islands. It now stays in one explicit curved region on the right.
3. Doughnut icing crossed the hole. The hole is now cut through the icing geometry too.
4. The first pretzel read as an infinity symbol. It was rebuilt with a chunky rope silhouette and open holes.
5. A grass tuft read as a lightning bolt. It now has a curved, curled silhouette.
6. Picnic supports were detached. The trestles, bench legs and cross brace now meet their surfaces.
7. The question mark lacked the same contour treatment. It now uses the shared shaded fill and ink geometry.
8. Shoreline corner endpoints did not match the straight edges. All endpoints, shade bands and repeat axes now connect as recorded in the tiling check.

## Run locally

From the full `codex-assets` workspace (the ZIP is the portable asset handoff):

```bash
python3 serve.py --port 8809
```

- Browse/search the library: **http://127.0.0.1:8809/index.html**
- Rive web preview: **http://127.0.0.1:8809/proof.html**

Open the local Rive project in the CLI previewer:

```bash
rive pipeline-five
```

Rebuild the SVGs, manifest, contact sheets, all RML, both Rive projects and all checks:

```bash
bash rebuild.sh
```

Re-render the compiled five-import project without a GPU or browser:

```bash
node render_rive.mjs
```

The local rebuild uses the installed CPython 3.12 with packages bundled in `.deps`, the existing `rive/fonts/Gilroy-Black.ttf`, the Rive CLI, the installed librsvg-backed Sharp package, and the pinned Node rendering packages in `render-runtime`. Python versions are recorded in [requirements.txt](requirements.txt); Node versions are in `render-runtime/package-lock.json`. Override `DUCKY_ASSETS_PYTHON` if moving to another Python 3.12 installation.

## Handoff and limits

All requested asset categories, cities, manifest fields, contact sheets and Rive import proof are present. The files are static vector illustrations ready for placement and animation in the world. Rigging and gameplay integration belong to the consuming world project.

The native Metal screenshot route remains unavailable in this restricted session; the CPU Rive rendering route is working and included. No other blocking issues remain in this library. The existing shared project and its 8793 server were left alone. No credits were spent, and nothing was pushed, deployed or posted publicly.
