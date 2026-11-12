Current handoff: see `public/pixi-art/themes/fair/fair-REPORT.md` for the ten-fair pass. The report below is historical and its integration requests and public PNG paths are superseded.

# Waddlewish Fair, 6 November

Fair files are built and validated locally. Shared registry hookup, the live renderer water hook and browser QA remain with integration because this job was limited to fair files and the sandbox blocked server/browser startup. Nothing committed, pushed or published.

## What changed

Continued the previous builder's island and generated prop art. Kept the coastline, castle, carousel, original teacup ride, pond garden, beach, islets and five wooden decks. Expanded the centre plaza slightly and replaced the maypole placement with the locked Fair 5 centre.

The centre at (3570, 2737.5) contains a cream/pink floral teapot with egg finial, six pastel teacups, a sunken pink floor, cream retaining walls, three stair entrances, egg posts and four flower beds. Water visibly leaves the left spout and lands in a separate basin. The teapot/cup art was generated with built-in imagegen, then palette-snapped and traced through the existing centre-trace.py. Floor/rim geometry is native SVG. There are 24 manifest pieces with explicit sortY values and 21 collision footprints. Attached front-rim furniture sorts at the front rim; its visual position remains controlled by its anchor.

The static pouring stream is already placed in art.json. centre/water.js provides the Pixi animation: continuously moving highlights, small splash droplets and expanding landing ripples. The endpoints remain fixed, reduced motion keeps the stream still, and cleanup restores the static fallback. The fair review page installs this component. Production still needs the hook below.

Removed the placeholder, six decorations/stalls occupying reserved stall rows, and the centre-front arch plus two duplicate stalls that hid the new ride. All other original fair content remains. Resolved the old build's 35 valid sleepers to 40, using all eight home poses beside existing props.

## Numbers and validation

- Map: 7250 x 4850.
- Main coast area: 20,345,752 square units, 1.8346 times the brief's 11.09M home baseline.
- Main/minor path width: 220 / 186 world units.
- Four open activity areas, three open stall rows.
- 40 valid sleepers: nod 7, hammock 3, rock 4, leaf 6, book 6, chair 2, wing 7, box 5.
- All zone spawns walkable and reachable; all three centre entrances reachable.
- 100 distinct reachable player positions verified against prop and sleeper collision. This is a capacity/navigation check, not a 100-client networking load test.
- Teapot, basin, cup and flower-bed collision centres block walking.
- Reserved areas contain no standing prop ground contacts.
- Water source/landing, changing time samples, reduced motion, visibility and cleanup passed using actual Pixi Graphics/Container objects in Node.
- `node --import ./scripts/themes/fair-register-check.mjs scripts/theme-index.mjs --check` prints `READY fair sleepers 40/28`. The denominator and count-shape warnings are the shared validator's old 28-sleeper expectation; no fair sleeper is dropped. The import only adds fair to THEME_IDS in memory and writes no shared files.
- `node scripts/themes/fair-check.mjs` passes and writes fair-validation.json.
- Art folder is below the 25 MB limit, approximately 11 MB including sources and review images.

## Files

- public/pixi-art/themes/fair/centre/: centre.json, generated source PNGs, traced teapot/cups, ring/stair/basin/water/flower SVGs, water.js, centre preview and animation filmstrip.
- public/pixi-art/themes/fair/art.json: all centre layers placed on the island.
- public/pixi-art/themes/fair/fair-preview.png, preview.png: full-island render with 100 standing Duckies plus the 40 sleepers, and globe preview.
- public/pixi-art/themes/fair/fair-metrics.json, fair-validation.json: measurements and check results.
- assets/world/themes/fair/: updated world.json, walk-world.json, harbor.json, placements.json, paths.json, sleepers-resolved.json.
- scripts/themes/fair-world.mjs: retained original builder, now ends by running fair-centre, fair-finish and fair-check so rebuilding cannot restore the placeholder.
- scripts/themes/fair-centre.mjs, fair-finish.mjs, fair-check.mjs: reproducible final build and checks.
- scripts/themes/fair-review.js, fair-register-check.mjs and public/pixi-art/themes/fair/review.html: isolated engine review and registration without shared-file edits.

## Exact shared integration still needed

1. Add `fair` to THEME_IDS in src/pixi/island-maps.js. Run `node scripts/theme-index.mjs` to regenerate assets/world/themes/index.js. Do not hand-edit that generated file.
2. Assign an agreed island to fair in src/pixi/world-map.js before `for (const island of out) Object.assign(island, sizeOf(island.theme));`. The review uses isle-170 only in memory. Equivalent permanent assignment, if isle-170 remains free:

```js
Object.assign(out.find(island => island.id === 'isle-170'), {
  theme: 'fair', name: 'Waddlewish Fair'
});
```

THEME_OF is already derived from WORLD_ISLANDS, and themeOfIsland reads worldIsland(id).theme. A lone THEME_OF.set line would not be sufficient in the current code.

3. Install the fair water component after the theme art's props enter the engine's objects container. In ensureArt, make the `.then(art => ...)` callback async, or use the integrator's generic centre FX hook. With Graphics and Container already imported:

```js
if (mapId === 'fair') {
  const url = '/pixi-art/themes/fair/centre/water.js';
  const {createFairWater} = await import(/* @vite-ignore */ url);
  art.fairWater = createFairWater({Graphics, Container}, art.props, this.objects);
  const dispose = art.destroy.bind(art);
  art.destroy = () => { art.fairWater.destroy(); dispose(); };
}
```

In the animation tick, after the active theme is known:

```js
for (const [id, art] of this.arts) {
  art.fairWater?.update(t, reduced, this.artShown === id);
}
```

The component accepts an optional origin if centre placement changes. Do not also animate water.svg: it is a static fallback and the component sets its sprite alpha to zero while active.

4. Update the shared sleeper count diagnostics to accept the boss's 40-sleeper themes. The actual resolver already resolves all 40 correctly.

## Review commands and limits

```sh
node scripts/themes/fair-world.mjs
node scripts/themes/fair-check.mjs
npx vite --port 5214 --strictPort --host 127.0.0.1
```

Review URL: http://127.0.0.1:5214/pixi-art/themes/fair/review.html

I opened and inspected the full-island render and centre render. These are Sharp composites of the real SVG layers and placements, not browser screenshots. The environment rejected Vite with `listen EPERM 127.0.0.1:5214`. Chromium headless launch failed with `bootstrap_check_in ... Permission denied (1100)`. Browser execution was not verified. No other port or the boss's Chrome was used. dist/ was not touched.

The team-feed log attempt was blocked at ~/.claude/team/feed.md by the filesystem sandbox. Copying the report to concepts/themes/codex-builds/fair-REPORT.md was also rejected with Operation not permitted. This fair-local report is the saved fallback.

Suggested feed line: GPT completed fair-only art/data at public/pixi-art/themes/fair and assets/world/themes/fair: locked teapot ring plus pouring-water module, 40 sleepers, 1.83x home, READY fair. Integration needs registry assignment and water hook from fair-REPORT.md; port 5214 and Chromium QA blocked by sandbox. Local only.
