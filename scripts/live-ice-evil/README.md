Rebuild the two live themed islands from their saved branch artwork:

```sh
python3 scripts/live-ice-evil/build.py
node scripts/live-ice-evil/sleepers.mjs
node scripts/theme-index.mjs
node scripts/theme-index.mjs --check
node scripts/live-ice-evil/render.mjs
```

`build.py` copies only referenced SVG artwork from `build-b-evil` and `build-b-iceland`. The live maps use one authored coastline each, normal live harbors, and no continent code. Snow combines the three original centre assemblies and selected B landmarks around one frozen lake.

`sleepers.mjs` resolves 40 residents against the actual scenery and walking geometry. It never places scenery. `render.mjs` produces static composition overviews under `concepts/themes/codex-builds/live-add-ice-evil/`; these are not browser captures.

Run the suite with `server.mjs` listening on the same `DUCKY_WS_PORT` used by the tests, then build with `npx vite build --configLoader native`.
