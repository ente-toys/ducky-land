# Ducky Land local multiplayer

Implemented and running locally. **The requested two-browser-tab proof and screenshots are still blocked by this session's browser and graphics access.** Do not treat the client logic tests as visual proof.

## Run

From this folder:

```sh
cd '/Users/pragadees.xd/Downloads/Ducky Land/codex-multiplayer'
npm ci
npm start
```

Open **http://127.0.0.1:8804/** in two tabs. Realtime server: **ws://127.0.0.1:8803/room**. Both listeners bind only to `127.0.0.1`. The server was left running for review, so skip `npm start` if these ports are already occupied by this project.

Controls: WASD or arrow keys to walk, tap a reachable plaza point to walk there, Q to quack, E to toggle a six-second dance. Each tab gets a new random name, city and Drip outfit. The coloured name tag identifies its city; the existing Rive ring identifies your duck. Connection status is in the browser tab title. No HUD was added.

## Implemented behavior

- One shared room, up to 16 real players, matching the existing 16 native Rive slots. Additional connections are rejected and retry after five seconds.
- Server assigns UUID, name, city, outfit and spawn. Clients cannot replace their identity or another player's state. Accessories use the existing seven allowed Solo indices; the source rig excludes Drip Acc 6, the bong.
- Client sends position, facing and movement state at 12 Hz. The server broadcasts shared snapshots at 12 Hz. Local movement predicts immediately and reconciles acknowledged positions. Remote players and AI use a bounded history and 100 ms delayed linear interpolation. A delayed connection freezes at its last sample rather than extrapolating through scenery.
- Walk, quack and dance use the existing native Rive view models and state machines. The host sorts ducks by Y into the plaza slots each frame. All visual drawing remains in the existing `.riv`.
- Server runs the shared filler crowd: `max(0, 10 - realPlayerCount)` bots. Both clients see the same bots, outfits, locations and actions. Bots disappear as real players arrive and return on departures.
- City quacks are server-owned. Each accepted real-player quack increments its assigned city once. Sequence deduplication and a 1.25 second cooldown reject repeats. AI quacks are decorative and do not affect rivalry totals.
- Join and close immediately update all clients. Heartbeat removes broken connections in roughly 5 to 10 seconds. Lost connections retry after one second and get a fresh identity.
- Plaza bounds and fountain collision are shared by client prediction and server validation. Server rejects invalid values, limits accepted displacement and message size, checks browser origin, and rate-limits messages.
- Static files have `Cache-Control: no-store`. Rive JS, both WASM builds and the unsigned `.riv` are served locally. No Rive scripts, push, signing, publishing, cloud resources, accounts or paid services were used. The original working folder and port 8793 were not changed.

To inspect counts without adding a HUD, open the console and run `game.inspect()`, or:

```sh
curl http://127.0.0.1:8803/health
```

## Tests and evidence

With the server running and other game tabs closed:

```sh
npm run test:core
npm run test:browser
# Or both:
npm test
```

`test/two-tabs.mjs` is the 97-line browser proof script. It uses installed Google Chrome through Playwright in headless mode, opens two actual tabs, drives each with keyboard input, reads back the native Rive slot properties, checks outfits/facing/actions, measures send and receive cadence, verifies city aggregation, closes/rejoins a tab, and captures both tabs. On a successful run it writes:

- `shots/tab-a-before.png` and `shots/tab-b-before.png`
- `shots/tab-a.png` and `shots/tab-b.png`, after movement, with quack/dance active
- `shots/proof.json`, with movement distances, measured cadence, native Rive values and per-sample interpolation evidence

**Those PNGs and `proof.json` have not been generated in this session.** Playwright's Chrome launch aborted before a page opened. The installed Chromium headless shell reported macOS `bootstrap_check_in ... Permission denied (1100)`. The connected browser tool separately reported `The browser access host is unavailable`. The native Rive screenshot attempt reported `Metal is not available on this device`. Details: [shots/BROWSER-VERIFICATION-BLOCKED.txt](shots/BROWSER-VERIFICATION-BLOCKED.txt).

Completed checks:

- **3 core tests passed**, recorded in [shots/core-tests.txt](shots/core-tests.txt). They cover server identity/validation, quack deduplication, 16-player capacity and rejection, crowd adjustment, interpolation, and the shipped client logic running in two isolated JavaScript contexts against the real socket server. The latter stubs DOM and Rive property access, so it verifies client sync logic but cannot verify the actual Rive renderer or pixels.
- `rive ./rive --verify`: **0 errors, 0 warnings**, [shots/rive-verify.json](shots/rive-verify.json).
- `rive inspect ./rive --summary`: **0 errors**, one inherited `component-without-asset` warning for Ducky's editor component listing, [shots/rive-inspect.json](shots/rive-inspect.json). No RML was modified.
- All eight served files matched their disk contents byte for byte, no-store was present, and WASM had the correct MIME type, [shots/served-assets.json](shots/served-assets.json).

## Open issues and limits

1. Browser rendering, actual two-tab behavior, measured browser cadence and pixel inspection remain unverified until browser access is available or the included browser script runs in a normal local terminal. Screenshots are outstanding.
2. The room and city totals live in memory. They survive player departures but reset when the server restarts. Reconnecting creates a new duck.
3. Capacity is intentionally 16 real players per room. No room selection or overflow rooms are implemented.
4. Facing reuses the existing left/right Rive rig. No new eight-direction artwork was made. The tap target uses the existing simple movement/collision approach, not pathfinding around the fountain.
5. Y sorting reassigns fixed native slots as ducks cross depth. Emote animation phase can carry across a slot reassignment, as in the original implementation. Position, identity, outfit and action data are rewritten each frame.
6. Touch supports tap movement. Quack and dance currently require a keyboard. There is no visible disconnected/full-room panel because the brief forbids HUD clutter.
7. Local validation is a prototype safeguard, not production authentication or full anti-cheat. Totals currently include successful local test quacks.

## What deployment would need

No deployment was performed. A public version would need an explicitly approved hosting target with long-lived WebSocket support, HTTPS/WSS and a reverse proxy or a single same-origin endpoint. The local-only bind address, client socket URL and exact origin allowlist would need production configuration.

Persist city totals in durable storage. Keep each room's simulation and membership under one authority. For scale, partition players into rooms sized to the available Rive slots, with a shared durable store for cross-room city totals. A Durable Object could own each room if that platform is chosen later.

Add session/reconnect identity, stronger movement validation, abuse controls, room allocation, monitoring and a clear connection failure experience. Serve the existing JS/WASM/Rive assets with versioned cache headers. The present unsigned asset contains no Luau scripts and does not require a Rive account push for playback.
