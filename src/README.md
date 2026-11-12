`main.jsx` mounts the browser app, and `index.css` supplies global styles.

| Folder | What belongs here |
| --- | --- |
| `app/` | React game screen, dialogs, controls, and UI styles |
| `world/` | Island definitions, geometry, walkable areas, and world data |
| `world/home/` | Home island layouts, placements, and their source data |
| `gameplay/` | Player movement, outfits, sailing, and simulation |
| `multiplayer/` | Browser room client and shared chat and presence rules |
| `rendering/pixi/` | Pixi engine, sprites, art loaders, and environment effects |
| `rendering/three/` | Three.js world and detail views, cameras, and render budgets |
| `rendering/shared/` | Camera, projection, and presentation helpers used across renderers |
| `features/bog-combat/` | Bog arena UI, rules, simulation, and bundled assets |

Keep world and gameplay logic used by the Worker and Node independent of
browser and renderer APIs. Keep JSON next to its owning module. Move source
references in QA, scripts, the server, and the Worker alongside the files they
use. If a globe source moves, regenerate its fingerprints with
`node scripts/globe-svg/build.mjs`.
