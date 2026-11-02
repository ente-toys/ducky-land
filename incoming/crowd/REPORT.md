# Ducky Land crowd brain

Local page: http://127.0.0.1:8808/

The crowd brain and native poses are implemented. Simulation checks and native Rive pixel inspection passed. The required real-browser check remains blocked by this session's browser/sandbox access. The supplied video and strip are actual Rive runtime renders, not a browser screen recording.

## What works

- Twelve NPCs keep goals instead of picking random walking destinations. Personal preferences, energy, visit durations and a memory of the previous activity vary their choices.
- Ducks visit the three stalls, reserve gathering positions around the fountain, and reserve one of four bench seats. Bench approach, docking, sitting and departure are separate phases. The seated belly meets the seat and the feet hang forward.
- Followers trail the player for 7 to 12 seconds, then return to another activity. Nearby ducks turn towards the player and wave or quack, with individual greeting cooldowns. Q invites nearby replies.
- E starts a party with 3 to 6 members. NPC leaders gather in an open forecourt so the fountain does not funnel the whole group through one gap. Guests walk to separate dance positions. Parties dissolve after 14 to 18 seconds. Walking leaves a player-led party.
- Native idle variety includes looking left/right, preening a folded wing, and sleeping with closed eyes and floating Zs.
- Obstacle circles come from the same prop positions used to generate the plaza. A small A* route supplies detours; acceleration, arrival braking, neighbour steering, circle repulsion and separation handle local movement. Player movement also respects props and other ducks.
- Duck placements have separate front/back passes around the fountain. Short emotes keep their placement until they finish, so depth sorting cannot restart a wave or quack. All visible art, poses, text and emotes remain native Rive. The page contains one canvas and no added HUD.

Controls: WASD/arrows, tap to walk, Q to quack, E to dance. E again ends a player-led party.

## Native pose interface

`DuckyVM.action` selects:

| Value | Timeline |
| --- | --- |
| 0 | Idle |
| 1 | Walk |
| 2 | Quack |
| 3 | Dance |
| 4 | Sit |
| 5 | Wave |
| 6 | Look |
| 7 | Preen |
| 8 | Sleep |

All nine timelines reset every animated channel, with 160 ms state transitions. Sit and Sleep loop. Quack, Wave, Look and Preen play once. A native foreground wing makes the wave and preen readable. Wardrobe slots retain the original Drip assets and exclusions.

## Run and rebuild

From this folder:

```sh
python3 rive/serve.py
```

The server is already running on http://127.0.0.1:8808/. It binds to loopback and sends `Cache-Control: no-store`.

To regenerate and verify the native file:

```sh
python3 rive/plaza.py
rive rive --verify
rive inspect rive --summary
rive rive --once
cp rive/build/ducky-land.riv rive/web/ducky-land.riv
```

`plaza.py` imports `gen.py`, regenerates both RML files, and writes `web/plaza-layout.json`. Source SVGs are read from the shared `../drip-ref/svg` folder via the provided converter. Work stays in this copy.

## Evidence and checks

- `evidence/crowd-runtime-20s.mp4`: 20.000 seconds, 1600 x 1000, 24 fps. Official Rive Canvas2D WASM render. Shows goals, seats, idle variety, greeting, player movement/following and a player-led dance party. Inputs: Q at 4 s, walk at 8 s, E at 11 s.
- `evidence/crowd-20s-frame-strip.jpg`: six native-runtime frames from 0 to 20 seconds.
- `evidence/native-poses.jpg`: Sit, Wave, Look, Preen and Sleep.
- `evidence/*-runtime.png`: full-size individual native pose renders.
- `evidence/runtime-events.json`: the rendered clip's behaviour log and final actor positions.
- `evidence/brain-check.json`: five seeds, 180 seconds each, 900 simulated seconds total. Zero prop collisions. Every requested behaviour exercised, unique claims, bounded parties, exact sitting positions and valid navigation destinations checked.
- `evidence/rive-inspect.json`: no problems. Final native build: zero errors, zero warnings. Runtime file: 682,809 bytes, confirmed served byte-for-byte on 8808.

Repeat the simulation:

```sh
node scripts/verify-brain.mjs
```

Repeat the native pixel renders and clip:

```sh
node scripts/render-runtime.mjs --poses
node scripts/render-runtime.mjs --video
python3 scripts/make-strips.py
```

Local helper dependencies are installed under `.tools/`. If needed:

```sh
npm ci --prefix .tools --cache .tools/npm-cache
```

## Real-browser check still required

Browser access host: unavailable. Chrome launch: macOS sandbox denies Mach port registration (`Permission denied (1100)`). The Rive CLI screenshot path also cannot access Metal. Full details are in `evidence/browser-blocker.txt`. No successful browser verification is claimed.

A real Chrome check and 20-second canvas screen recording are prepared. With the server running, execute outside this restricted session:

```sh
node scripts/verify-browser.cjs
```

It checks runtime load, all 32 slot bindings, a current Rive payload, console errors and behaviour events while exercising Q, movement and E. It writes `browser-check.json`, six browser screenshots, a 20-second WebM and an MP4 to `evidence/`. `DUCKY_CHROME` can select another Chrome/Chromium executable.

## Integration notes and limitations

Merge `gen.py`, `plaza.py`, `plaza_layout.py`, both generated RML files, and the `web/` files together. The plaza now has 32 render placements: slots 0 to 15 behind the fountain, 16 to 31 in front. Thirteen actors are shown; unused placements stay offscreen. A 16-slot host cannot use this file unchanged.

The geometry uses simple circles on a ground plane, not exact polygon collisions. Crowded routes occasionally time out and select a fresh goal; the five test runs recorded 0 to 4 replans per three minutes. WebGL rendering, actual browser frame rate and browser screenshots still need the blocked browser pass. Native-runtime pixels were inspected, including sitting alignment and the new foreground wing poses.
