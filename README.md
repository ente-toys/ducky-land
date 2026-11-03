# Ducky Land

Ducky Land is an illustrated PixiJS island with a React shell. With Node.js
22.12+ installed, run:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The island is at `/` and starts at the plaza.

Click or tap to walk, or use WASD or the arrow keys. Drag to pan, scroll or pinch
to zoom, press F to follow your duck, and press Home or 0 for the island overview.
Q or 1 quacks, E dances, 2–7 trigger other emotes, and M toggles sound. Tap your
duck twice to dance. Press 5 for a side nap.

The 28 other ducks pick from three sleeping poses. A duck rows around Racing
Lake, crows circle the island, and waves roll onto Lighthouse Beach. Reduced
motion quiets the animation, and hidden tabs pause simulation and audio.

`npm run build` builds the site into `dist/`. Use `npm run preview` to serve that
build locally. `npm test` runs the test suite and expects the WebSocket fixture
server on port 8810. Start it separately with `npm start`.

The renderer lives in `src/pixi/`. Its SVG artwork lives in `public/pixi-art/`
and `public/pixi-duck/`. To regenerate it from the original vector sources,
run `python3 scripts/extract-pixi-art.py` and
`python3 scripts/extract-pixi-duck.py`. The duck exporter uses the installed Node
dependencies to measure the artwork.
