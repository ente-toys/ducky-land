# Ducky Land

## React app

The React shell lives in `src/` and uses Vite. It mounts the original Rive/WASM
island through `rive/web/island.html`, with the camera and ambient behavior in
`rive/web/island-host.js`. With Node.js 22.12+ installed:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The island has no interface overlays.
Scroll or pinch to zoom, drag to pan, and click a path to walk. WASD or arrow keys
move your duck; Q quacks, E dances, F follows your duck, and Home (or 0) fits the
whole island. Tap a duck to greet it. M toggles sound after the first interaction.
Reduced-motion preferences disable environmental sway, drifting leaves, and camera easing.

The production build includes all three island renderers, both asset galleries, and the original Rive runtime.
`npm run build` creates the production app in
`dist/`, and `npm run preview` previews that build. The original game server still
runs with `npm start`; its existing asset build is available as `npm run build:rive`.

## PixiJS illustrated island

`/pixi/` is a separate 2D page using PixiJS and the original vector artwork.
It loads no Rive runtime, `.riv` files, WASM, or Three.js. The island starts at
the plaza; Home/0 fits all seven areas. Drag pans, wheel/pinch zooms around its
anchor, click/tap walks, WASD/arrows move, Q/1 quacks, E dances, 2–7 trigger
heart/laugh/wave/sleep/grumpy/party, M toggles sound, F follows, and +/− zooms.
Tap another duck to greet it; double-tap your duck to dance.

The 29 ducks use eight original illustrated directions with separately animated
wings, feet, bill, eyes and wardrobe attachments. Movement, routing, NPC decisions,
emote durations and sound reuse renderer-independent modules. Trees sway, boats
bob, water ripples and leaves drift. Reduced motion quiets the animation; hidden
tabs pause simulation and audio. There are no interface panels over the scene.

`src/pixi/engine.js` owns one renderer and animation loop. SVG textures are shared,
off-screen props and ducks are culled, and pixel ratio is capped at 2. Ground art
is split into 12 tiles to stay below mobile texture-size limits. Source SVGs and
metadata live in `public/pixi-art/` and `public/pixi-duck/`.
The static extraction scripts read existing artwork without executing the legacy
Rive build: `python3 scripts/extract-pixi-art.py` and
`python3 scripts/extract-pixi-duck.py`. Nothing requires the Rive editor.
`node --test qa/pixi.test.mjs` covers pinch anchors, gesture cancellation and
original-art placement/clip integrity. Production builds include `/pixi/index.html`
for direct route loads. Browser evidence and device limits are recorded in
`qa/pixi-acceptance.json`.

## Three.js island and model catalog

- `/` — the existing Rive island.
- `/pixi/` — the new illustrated island, running entirely in PixiJS.
- `/three/` — a separate, fully 3D island with one player and 28 autonomous ducks.
- `/three/assets/` — one orbitable preview canvas, search/category filters, source SVGs, outfit previews, and ten duck animations.
- `/extracted-assets/` — the existing source asset gallery.

The 3D catalog has 245 entries: all 203 manifest assets, 34 canonical wardrobe
models (24 preview SVGs remain aliases), one duck rig, and seven island-specific
landmarks. The latter reproduce the original bread crowns, book-roof library,
duck beacon, fountain statue, bridge, and finish gate, separately from the reusable SVG kit.

Left-drag or one-finger drag pans. Right-drag or two-finger twist orbits.
Wheel/pinch zoom keeps its ground anchor. Click/tap walks along a collision-safe
route; tap a duck to greet it, and double-tap your duck to dance. WASD/arrows move
relative to the camera. Q quacks, E toggles dance, 1–7 trigger quack/heart/laugh/
wave/sleep/grumpy/party, M toggles sound, F follows, and Home/0 fits the island.

`src/three/engine.js` owns the renderer, fixed 60 Hz simulation, interpolation,
audio, input and lifecycle. `mount`, `resize`, `dispose`, `setDestination`,
`triggerEmote`, `fit`, `follow` and `focusZone` form its interface. World X/Y maps to scene X/Z
at 100:1; rendering elevation never changes the shared walkability rules.
Animation runs outside React. Static geometry is merged in spatial batches;
repeated moving scenery and duck parts use instancing. Pixel ratio is capped at
2; sustained slow frames reduce resolution, shadows and decorative density.
Hidden tabs pause, blur clears input, and reduced motion disables environmental
movement and camera easing while slowing character motion.

The world uses `rive/web/world.json` plus `src/three/scene-manifest.json`, which
retains ten original paths and 526 decorative placements from existing RML.
`python3 scripts/extract-three-scene.py` refreshes this manifest by reading the
existing files. It does **not** import or execute `rive/world.py` or `build.py`.

`node --test qa/three.test.mjs` checks asset coverage, all wardrobe/action
combinations, original collision parity, connected routes, deterministic NPCs,
emote timing, camera anchors, cancelled gestures, terrain heights and lifecycle.
For the complete suite, run `npm start` in another terminal, then `npm test`.
`npm run build` emits direct-load HTML for `/three/` and `/three/assets/`.
For reproducible zone framing, use `/three/?zone=pond` (or any zone ID from `world.json`).
Measured browser results and device-testing limits are in `qa/three-acceptance.json`.
The Three.js library is route-loaded and is not requested by the original page.

## Legacy multiplayer prototype

A small multiplayer island for Ente's Ducky. Its artwork is native Rive; the browser page only runs input,
movement, the camera and the network. Local prototype, nothing deployed.

## Run it

Needs Node 20+ and Python 3.

```sh
npm install
node server.mjs        # realtime server: ws://127.0.0.1:8810/room, health on http://127.0.0.1:8810/health
python3 serve.py       # page: http://127.0.0.1:8800/
```

Open http://127.0.0.1:8800/, pick a name and city, Waddle in. WASD or arrows walk, click walks to a spot,
Q quacks, E dances, Esc opens the menu.

## Backend, where to start

| File | What it does |
| --- | --- |
| `server.mjs` | The realtime server. HTTP `/health`, WebSocket `/room` (max 2 KB per message, a token bucket of 40 kicks spammers). Ticks the bots and the plaza crowd and sends a `snapshot` to every player 12 times a second. Also serves the page files. |
| `server-world.mjs` | Shared world rules: walkable area, collisions, `move()`, bot spawn spots, names, outfits, `SLOTS=16` players, `SPEED=245`, `HZ=12`. Reads `rive/web/world.json`. |
| `rive/web/crowd.js`, `crowd-brain.mjs` | The plaza's social crowd (benches, stalls, fountain ring, dance parties). Runs on the server. |
| `rive/web/network.js` | The client side: connects, sends its state, applies snapshots with 100 ms interpolation (`interpolation.js`), reconciles its own position. |
| `rive/web/game.js` | Client game loop, input, pathfinding, camera, drawing. |

Messages, client to server: `profile` (name, city, outfit), `state` (x, y, facing, turn, action, seq), `emote`,
`activity`, `collect`. Server to client: `welcome`, `snapshot` (players + bots, with `ack` for your last `state`).

Today the client is the authority for its own position: it sends `state` and the server only checks it is walkable.
There is no account, persistence or database yet; the city quack and bread counters live in memory and reset when
the server restarts. Room size is one room, 16 players, topped up with bots to 24.

All positions are flat world coordinates (5800 x 4400). The isometric look is only a drawing projection in
`game.js` (`?view=iso` default, `?view=flat` to see the flat map), so the server never needs to know about it.

## Art and build

- `rive/web/ducky-land.riv` is the built runtime the page loads. It is committed so the game runs without a build.
- `rive/gen.py` generates the Ducky rig (turn, walk, idle, quack, dance) from the official views in `duck-spin/`.
  `pull_rig.py` re-pulls it and rebuilds; needs the Rive CLI.
- Do not run `build.py` without checking with Prag first: it regenerates `rive/web/game.js` from the lane sources and
  would undo the isometric view.
- `incoming/` holds the original work of each build lane; `qa/` and `shots/` are tests and captures.
