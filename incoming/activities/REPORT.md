# Ducky Land activities, completed 29 October 2026

Both activities run locally from `rive/web`, with a menu at **http://127.0.0.1:8802/**. The previous session's working rig, plaza, game rules and native activity artboards were retained and finished.

## What works

**Bread Hunt**: twelve golden slices spawn around the plaza. WASD, arrows and tap-to-walk work; tap paths route around the fountain. Each slice awards exactly 10, plays its own native crumb burst and floating +10, and increments the small activity-only city counter. A full basket awards 120. The city total persists locally across rounds and page loads. The native results card offers replay and return to the menu.

**Duck Race**: choose 2, 4, 6 or 8 Duckies from the menu. The player and AI sit in city-coloured floats on the lake loop. Native 3-2-1-GO countdown, float bobs, paddle splashes, wakes and Ducky poses play in Rive. Discrete taps or Space strokes accelerate the player; holding Space does not auto-paddle. Crossing times determine finish order. The native results card shows every racer, city and time, with replay and menu return.

**Drip treatment**: inherited original Drip Ducky artwork, ink outlines, flat side shading, white highlights and the measured Drip palette. No gradients, glow or sparkles. The excluded Acc 6 is not imported into the rig.

**Portable delivery**: game rules are separate framework-free ES modules. Each activity has a separate Rive artboard. All in-activity drawing and effect animation is native Rive. JavaScript handles input, game rules, view model updates and local persistence. Local JS, WASM, fonts and `.riv` are included, with no CDN required by the activity pages. The source SVG converter is now included in this folder too.

## Run

From this folder:

```sh
python3 rive/serve.py --port 8802
```

- Menu: http://127.0.0.1:8802/
- Bread Hunt: http://127.0.0.1:8802/bread.html
- Duck Race: http://127.0.0.1:8802/race.html
- Example city/flock: http://127.0.0.1:8802/race.html?city=Kochi&racers=4

The current server is running on 8802 with the optional local QA sink enabled. Playback is identical to the command above. Do not start a second server on the occupied port.

To rebuild the unsigned native asset:

```sh
sh rive/build.sh
```

To run the deterministic rules checks:

```sh
node rive/test-rules.mjs
```

For the browser evidence recorder, start the server with `--qa`, then open `bread.html?qa=auto`. It completes a hunt and race through synthetic keyboard/pointer events routed through the production handlers. `race.html?qa=fast` skips the remaining countdown wait and uses a fixed 60 Hz test clock for the remaining race so shared browser focus cannot stall the finish-order test. This only affects the opt-in QA harness. Ordinary gameplay uses real frame time.

## Validation and evidence

- `rive rive --verify`: **0 errors, 0 warnings**.
- `rive inspect rive --summary`: **problems: []**. Saved in `rive/shots/inspection.json`; build output in `rive/shots/build.log`.
- Rules checks pass for fountain collision/pathfinding, all twelve reachable slices, one award per slice, +120, one completion event, replay persistence, and 2/4/6/8-racer countdown/input/finish-order/replay.
- **Real Google Chrome 156** loaded and rendered both activities. Bread Hunt completed in real frame time, collected all twelve slices, awarded exactly 120, hid the counter on results and replayed. All ten browser checks passed, with no recorded uncaught errors: `rive/shots/bread-pass.json`.
- Chrome race checks passed for countdown start, ignored held-key repeats, tap/Space input, eight distinct finishers, sorted crossing times, matching native result strings and replay reset. All ten checks passed with no recorded uncaught errors: `rive/shots/race-pass.json`. Full-race completion in this acceptance run used the explicit fixed-step test clock. Initial race motion, countdown states, splashes, results animation and replay were rendered by the real browser.
- Captured native canvas PNGs were opened and inspected. Visual fixes from those captures include the readable eight-wide race starting grid, centred countdown scale pivot, and +10 labels moved above the player's face.

Screenshots, all relative to this folder:

- `rive/shots/bread-intro.png`
- `rive/shots/bread-playing.png`
- `rive/shots/bread-pop.png`
- `rive/shots/bread-results.png`
- `rive/shots/bread-replay.png`
- `rive/shots/race-intro.png`
- `rive/shots/race-countdown-3.png`, `race-countdown-2.png`, `race-countdown-1.png`
- `rive/shots/race-go.png`
- `rive/shots/race-playing.png`
- `rive/shots/race-results.png`
- `rive/shots/race-replay.png`

The PNGs capture the actual Rive canvas, without the HTML navigation. Transparent letterboxing can appear black in image viewers. No new MP4 is claimed; `rive/preview/ducky-step1.mp4` is inherited rig material, not activity proof.

## Integration and honest limits

See **`rive/INTEGRATION.md`** for module APIs, callbacks, view model keys, artboard/state machine names, native timeline names and replacement of the local score adapter.

- City scores are localStorage prototype values, not an authoritative multiplayer city service. Race opponents are local AI. The modules expose callbacks for world integration later.
- Phone portrait view is compact and recommends landscape. Physical phone touch and phone GPU performance were not tested in this lane.
- Shared Chrome sessions repeatedly changed tabs and paused the normal race clock. The final finish-order/results acceptance therefore used the documented test clock; no uninterrupted real-time full-race or frame-rate claim is made.
- The CLI screenshot path cannot create a Metal graphics context in this sandbox, and shell-launched Chrome aborts with SIGABRT. Actual Chrome canvas exports provided the visual evidence instead.
- Floating labels, city colours and times are editable native Rive content. Float paths are an arcade loop with no inter-duck collision physics.

Final `.riv`: `rive/web/ducky-land.riv`, **1,187,779 bytes**. SHA-256: `fb7a841178fe22889e45fd97445fa4bfdb64589b836d2f3804bc104d8a0b638a`.

No shared plaza source/server was changed. No account push, signed publish, deploy, public post, paid service or account creation was performed.
