# Ducky Land world

Local page: http://127.0.0.1:8801/

## Run

From this folder:

```sh
python3 rive/web/serve.py
```

The server binds only to `127.0.0.1:8801` and sends `Cache-Control: no-store`. The supplied build and runtime are local, so playing does not need a CDN, account or signing.

To regenerate the native scene after changing Python builders:

```sh
./rebuild.sh
```

## Delivered

A 5800 × 4400 world, much larger than the viewport. Its centre is Ducky Plaza, with the original Drip statue fountain, market stalls, bunting, benches, lanterns and planters. Connected paths lead to Lily Pond and its lily pads and wooden bridge, Bread Woods with baguette and croissant trees, the book-roof library on Reading Hill, Waddle Regatta lake, and the rubber-duck lighthouse at Beak Beacon beach. A sandy coastline, shallow-water rim, sea and five smaller islets complete the map. All five islets have walkable wooden connections to the mainland.

The player walks with WASD, arrows or a tapped destination. Tap navigation finds a route around water and solid prop bases. The camera follows the player's world position with frame-rate-independent exponential easing, stays within world bounds, and respects reduced motion. Q quacks and E dances. There is no HUD; native Ducky name tags and world signposts remain.

28 dressed Drip Duckies wander across the seven zones, pause, quack and dance. The forbidden Acc 6 is excluded from the inherited wardrobe. Every prop and character is a native Rive vector artboard. `drip_style.py` provides all scenery builders, including the island additions. Outline weight, palette, flat right-side shade and white edge streak follow the supplied Drip kit. The host page owns simulation, input, A* navigation, camera transforms and foot-y sorting. One Rive renderer draws the ground, then the visible native prop and Ducky artboards sorted together by y.

## Kept and repaired

Kept the previous session's native Ducky rig, expanded style kit, island generator, manifest and navigation implementation. Fixed the low-level renderer calls to use native `Mat2D` objects. Disabled artboard frame-origin offsets for directly drawn components, aligning rendered feet and prop bases with their world positions and collision geometry. Added collision checks to each A* edge so routes cannot cut obstacle corners. Connected all islets, cleared their landings, removed overview black bars with native sea coverage, joined croissant crowns to their trunks, seated the beacon duck and tightened the library roof and bridge rails.

## Verification

`rive rive --verify`: 0 errors, 0 warnings. `rive inspect rive --summary`: empty `problems` list. Unsigned build: `rive/build/ducky-land.riv`, copied to `rive/web/ducky-land.riv`. JavaScript syntax checks pass.

Opened the local page in real Google Chrome and captured its rendered canvas. Inspected the overview and every zone by eye. The browser review harness uses the actual game handlers and simulation, testing WASD, arrows, tap routing, camera displacement, water blocking, y sorting, traversal of every zone and traversal to all five islets. The final result is `pass: true`, with zero destination error for all seven zones and all five islets. WASD moved 245 world units in one simulated second, the camera moved 212 units while easing toward it, arrows moved back 245 units, and tap-to-walk completed its route. Detailed evidence is in `shots/browser-review.json`. Run it again by opening http://127.0.0.1:8801/?capture=1, which also refreshes the screenshots. `window.game` exposes the live scene and review helpers for integration, without an on-screen debug overlay.

## Screenshots

- Full map: [shots/overview.png](shots/overview.png)
- Plaza: [shots/plaza.png](shots/plaza.png)
- Pond: [shots/pond.png](shots/pond.png)
- Bread forest: [shots/bread-forest.png](shots/bread-forest.png)
- Library hill: [shots/library.png](shots/library.png)
- Race lake: [shots/race-lake.png](shots/race-lake.png)
- Lighthouse and beach: [shots/lighthouse-beach.png](shots/lighthouse-beach.png)
- Islets: [shots/islets.png](shots/islets.png)

## Integration and limits

`rive/world.py` generates `island.rml`, the Ducky scene and `web/world.json`. The latter includes zone spawn points, coast, lakes, bridge, boardwalk segments, prop placements and collision ellipses. Keep `art.frameOrigin = false` on separately drawn prop and Ducky artboards. Renderer transforms require `runtime.Mat2D`, not JavaScript arrays.

This is the world lane. The race lake is scenery, and the library is an exterior. Multiplayer, activity rules and eight-direction Ducky turning belong to the other lanes; this copy keeps the inherited left/right facing rig. Camera and navigation require the supplied host page, rather than running by themselves in the Rive editor. No mobile-device performance claim is made. The CLI screenshot renderer cannot create a Metal graphics context in this session, so the visual proof comes from real Chrome instead. Prior failed-render diagnostic JSON is retained under `logs/previous-session/`.

Nothing was pushed, published, deployed or purchased. The original `../rive` project and its server were not edited.
