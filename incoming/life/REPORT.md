# Living plaza and Ducky emotes

Built in `/Users/pragadees.xd/Downloads/Ducky Land/codex-life`.

## Run

The local server is running at **http://127.0.0.1:8805/**.

From this folder, restart it with:

```sh
python3 rive/web/serve.py
```

Rebuild the native scene and unsigned runtime asset with:

```sh
python3 rive/build_local.py
```

Regenerate the four original local sounds with:

```sh
python3 rive/synth_sfx.py
```

The generator reads the supplied Drip SVGs from `../drip-ref/svg` and the existing converter at `/Users/pragadees.xd/Developer/hallow-os/tools/svg2rml.py`. The inherited working project and its 8793 server were left alone.

## What works

- Three small white birds with flapping wings and separate flight paths.
- Two butterflies with independent flutter and drifting paths near the planters.
- Six staggered leaves drifting down from the trees.
- Smooth fountain ripples, ballistic drops, impact rings and tiny splash droplets. Corrected the inherited hold interpolation on the water tracks.
- Individual pennant rotations, staggered along the swaying bunting.
- Native Ducky facial acting, body squash/stretch, wing gestures, feet, tuft follow-through, and anchored icon bubbles. Fast 45 ms state blending and punchy custom easing. Emotes play once and settle to idle.
- Crowd personal space around the player, with extra clearance during an emote. The default player wears the blue cap and shoes with a clear face.
- Existing crowd, outfit slots, name tags, depth sorting, tap movement, WASD/arrows, Q and E retained.
- No HUD added to the plaza. Flat daylight palette retained.

| Key | Emote | Acting |
| --- | --- | --- |
| 1 | Quack | Anticipation, hop/stretch, opening beak, QUACK bubble |
| 2 | Heart | Squash/pop, wing embrace, pink heart |
| 3 | Laugh | Repeated belly compression, laughing eyes, open beak |
| 4 | Wave | Raised wing with repeated flicks, waving icon |
| 5 | Sleep | Drooping pose, closed lids, breathing and rising zzz |
| 6 | Angry | Squint, body shake, wing tension and foot stomps |
| 7 | Party | Three hops, alternating wings, party hat and paper strips |

Movement pauses during the short emote. Another number interrupts it. Pressing the same number restarts it. Held keys do not repeatedly fire.

## Sound

`rive/web/audio/` contains quack, pop, splash and step WAVs, generated locally without recordings or external samples. Source notes: `rive/web/audio/SOURCES.md`. Synthesis source: `rive/synth_sfx.py`.

Sound unlocks after a real keyboard or pointer gesture. Quack/laugh use the quack, the other emotes use pop, walking makes quiet step taps, and the nearby fountain gives an occasional quiet splash. **M toggles mute.** All runtime JS, WASM, Rive, fonts and WAV assets are local.

## Screenshots

Final screenshot sheet, cropped directly from the final runtime's actual plaza canvas:

- **`shots/emotes-in-plaza.png`**

Full final plaza captures:

- `shots/plaza.png`
- `shots/emote-1-plaza.png` through `shots/emote-7-plaza.png`
- `shots/heart-before-replay.png`, `shots/heart-replayed.png`

An isolated close-up sheet from the preceding visual pass is also retained at `shots/emote-sheet.png`, with individual `shots/emote-1-close.png` through `shots/emote-7-close.png`. The final in-plaza sheet reflects the last easing and sleep-icon refinements.

Review page: http://127.0.0.1:8805/emotes.html. It advances and captures the actual native Rive component at a fixed pose; its labels are review-page text. No MP4 was requested or generated.

## Verification

- Final `rive ./rive --verify`: **0 errors, 0 warnings**.
- Final `rive inspect ./rive --summary`: **no problems**. Readback saved in `shots/inspect-final.json`.
- Final unsigned web asset: **895,195 bytes**.
- Real desktop Chrome loaded that exact byte count. The native CUA keyboard sent the initial trusted `1` gesture; the local browser harness then exercised every number through the same page keyboard handler.
- All 7 number/action mappings passed. All 7 returned to idle. Same-key replay, interruption, WASD resumption, and mute passed: **11 additional checks, all true**.
- AudioContext was running. All four WAVs decoded and played. Chrome displayed its audio-playing indicator. No browser errors were recorded by the harness.
- Evidence: `shots/browser-verification.json` and each screenshot's companion JSON.
- Inspected the final emote sheet by eye, including distinct wave, sleep and angry poses, bubble legibility, and the player in context.

The CLI screenshot command was attempted, but this sandbox cannot create a Metal graphics context. A new headless Chrome process also hit the sandbox's macOS process restriction. Browser captures were instead made through the existing real Chrome app and the local runtime canvas. Shared Chrome focus was contested by other active sessions; the deterministic capture harness avoids hidden-tab animation throttling and captures before WebGL clears its buffer.

## Limits and open issues

- This remains the inherited local simulated crowd, not network multiplayer.
- Other ducks can still overlap one another. Personal space protects the player, but crowd names can occasionally overlap elsewhere.
- The existing lateral facing rig remains; no new 8-direction turn system was part of this job.
- Sound playback was verified through the browser's decoded buffers, source playback and audio indicator. No physical speaker recording was made.

All added scene motion and art are native Rive timelines, shapes, state machines and per-placement view models. The page handles movement/input and local audio. There are no Rive scripts, gradients, glow, sparkles, paid calls, pushes, publishes or deployments in this work. Acc 6 is absent from the imported outfit set.
