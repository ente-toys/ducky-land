# Ducky Land mobile

The mobile implementation is running at **http://127.0.0.1:8807/**.

**Verification status:** both native Rive builds pass verification. Native software renders and 16 host simulation checks pass. The required trusted Chrome mobile test and Rive CLI GPU benchmarks remain blocked by this session's graphics sandbox. **60fps is a target, not a verified result.**

## Run

From this folder:

```sh
cd '/Users/pragadees.xd/Downloads/Ducky Land/codex-mobile'
python3 serve.py
```

The server serves `./rive/web` on `127.0.0.1:8807` with `Cache-Control: no-store`. It is already running for this session.

- Automatic quality, normally 13 active Duckies: http://127.0.0.1:8807/
- Force normal quality: http://127.0.0.1:8807/?quality=high
- Force low-end mode, 6 active Duckies: http://127.0.0.1:8807/?quality=low
- Stress all 16 placements: http://127.0.0.1:8807/?quality=high&crowd=15

Rebuild both unsigned files:

```sh
python3 build.py
```

The reduced project is `./rive-lite`, beside `./rive`. Rive discovers RML recursively, so putting it under `./rive` would make the main build import both variants.

## Implemented

- Responsive native Rive artboard with a camera that follows the player. Phones use a readable crop; tablets show more of the plaza. Aspect ratio stays correct in portrait and landscape.
- Full `devicePixelRatio` drawing surface, including fractional DPR. No DPR2 cap. Resize, orientation and screen-DPR changes update the surface and camera.
- Floating joystick appears exactly where the finger lands. A 7px drag threshold separates taps from drags. A small dead zone and proportional speed allow slow walking. The knob clamps at 36px; the base stays at the initial touch.
- Pointer capture keeps movement alive outside the original touch area. Lift, cancellation, lost capture, blur, hiding the page and resizing clear movement. A second finger cannot take the joystick away.
- Tap-to-walk with a native Rive destination ring. Taps on the opposite side of the fountain route around it instead of getting stuck against the basin.
- Quack and Dance are 58x44px buttons, with an 8px gap and safe-area offsets. Their visible artwork and press states are native Rive. Two transparent HTML buttons provide accessible labels and touch targets. Quacking with a second finger preserves joystick ownership. Dance toggles and exposes `aria-pressed`.
- Page scrolling, overscroll, selection, context menus, wheel zoom, pinch gestures and double-tap zoom are suppressed while playing. The viewport includes `viewport-fit=cover`.
- Native Rive world, Duckies, name tags, controls and joystick. Drip colours, flat side shades, white streaks and ink outlines are preserved. No HUD, gradient, glow, Luau script or image-based world rendering was added.
- Low-end mode removes ten actual native Ducky placements: normal has 16 available placements with 13 active Duckies; lite has six native placements and six active Duckies. It keeps full DPR sharpness.
- Automatic lite selection for devices reporting <=2GB memory, <=4 logical cores or data-saver. Normal mode also falls back after two sustained 120-frame windows with median frame intervals above 22ms. Quality switches preserve the player, outfit and world state.
- WASM, fallback WASM, fonts and `.riv` files are local. No CDN is needed for the page.
- Host writes cache property handles and changed values. Hidden pages stop rendering. Performance collection runs only when explicitly started through `game.startBenchmark()`.

## Verification performed

`qa/rive-verify.json` and `qa/rive-lite-verify.json`: **0 errors, 0 build warnings**.

`qa/rive-inspect.json` and `qa/rive-lite-inspect.json`: **0 errors**, normal Plaza has 16 native nested artboards; lite Plaza has six. Both retain one inherited editor warning: Ducky is marked as a component without a ComponentAsset. It does not affect playback.

`node qa/software-check.cjs` passed **16 checks**, running the real `rive/web/mobile.js` against native Rive Canvas2D WASM and a software canvas. Checks include tap arrival, a full fountain detour and arrival, second-finger quacking, release/cancel, dance, DPR sizing and coordinate conversion at six sizes, safe-area control alignment, and both directions of quality switching.

These software checks simulate DOM pointer events. They are not trusted mobile touches and cannot verify Safari gesture arbitration or Chrome's compositor.

## Screenshots inspected

All images below are actual native Rive renders at the specified drawing-surface DPR, produced with the software renderer. **They are not Chrome screenshots.** The `software-` prefix preserves that distinction.

| View | DPR | File |
| --- | --- | --- |
| 375 x 812 | 3 | [375 phone](shots/software-phone-375.png) |
| 390 x 844 | 3 | [390 phone](shots/software-phone-390.png) |
| 412 x 915 | 2.625 | [412 phone](shots/software-phone-412.png) |
| 768 x 1024 | 2 | [Tablet portrait](shots/software-phone-768.png) |
| 1024 x 768 | 2 | [Tablet landscape](shots/software-phone-1024.png) |
| 844 x 390 | 3 | [Phone landscape](shots/software-phone-844.png) |
| Floating joystick | 3 | [Joystick](shots/software-phone-390-joystick.png) |
| Quack | 3 | [Quack](shots/software-phone-390-quack.png) |
| Dance | 3 | [Dance](shots/software-phone-390-dance.png) |
| Simulated 34px bottom inset | 3 | [Safe area](shots/software-phone-390-safearea.png) |
| Six native placements | 3 | [Lite](shots/software-phone-390-lite.png) |

## Performance measurements and blockers

| Requested method | Result |
| --- | --- |
| `rive --bench=600`, 13 animated Duckies, phone/tablet viewports | Blocked: `Metal is not available on this device. Failed to create graphics context.` |
| `rive --screenshot --advance=90` | Same Metal graphics-context failure |
| Google Chrome headless, `isMobile:true`, `hasTouch:true` | Chrome process aborts with SIGABRT before a page can be created |
| Playwright Chromium headless shell | Also aborts under this sandbox |

Logs are in `qa/rive-bench-13-duckies-*.txt`, `qa/rive-bench-lite-*.txt`, `qa/rive-capture-*.txt`, `qa/mobile-failure.txt` and `qa/mobile-attempt.txt`. No CLI or Chrome frame times were obtained. No genuine Chrome touch pass is claimed.

Supplementary measured native Rive work, using 120 frames of the actual moving host simulation at 390 x 844, DPR3, **Canvas2D WASM + CPU software raster**, on this Mac:

| Active Duckies | Mean advance | Advance p95 | Mean render | Render p95 | Mean combined work |
| --- | --- | --- | --- | --- | --- |
| 13 | 1.69ms | 3.80ms | 23.48ms | 38.30ms | 25.17ms |
| 6, lite | 0.65ms | 1.54ms | 14.56ms | 21.07ms | 15.21ms |

Raw measurements: [qa/software-results.json](qa/software-results.json). These are measured CPU work durations, not requestAnimationFrame intervals, Chrome WebGL2 timings or phone GPU timings. Normal quality misses a 16.67ms work budget in this software path. Lite reduces its measured mean combined work by about 40%. A physical low-end phone remains unmeasured.

## Finish the required graphics QA

These commands are ready to run in a terminal with graphics access while the local server is running:

```sh
npm ci
npm run qa:rive
npm run qa:mobile
```

`qa/rive-bench.py` populates 13 animated Duckies before timing normal quality, and six for lite. It captures/benchmarks 375, 390, 412 and 768 viewports. It exits nonzero if any capture or benchmark fails.

`qa/mobile.cjs` launches Google Chrome headless, with `isMobile:true`, `hasTouch:true` and explicit DPR. It sends trusted touchscreen taps and CDP multi-touch sequences, checks tap arrival, joystick placement, multitouch quack, cancellation, dance, scrolling/zoom state, safe-area offsets, orientation and low-memory fallback. It samples eight seconds of frame intervals, host CPU work and runtime advance/draw CPU work with 13 active Duckies at every width, plus lite at 390. It writes genuine browser screenshots as `shots/phone-*.png` and reports to `qa/chrome-*.json` and `qa/mobile-results.json`. It blocks requests outside localhost.

The software suite can be rerun separately:

```sh
npm run qa:software
```

## Files for integration

- `rive/plaza.py`: camera and viewport-space native controls, joystick, walk target, plus new PlazaVM numeric properties.
- `rive/web/index.html`: locked game viewport, safe-area layout, accessible transparent action targets.
- `rive/web/mobile.js`: input, pathfinding, camera, quality fallback, property syncing and optional measurement hooks.
- `build.py`: repeatable normal/lite unsigned builds and validation.
- `serve.py`: local no-cache server on port 8807.
- `drip-ref/svg`: local copy of the original SVG inputs, so the generator can rebuild independently. Acc 6 remains excluded from the rig.

No shared reference project or server was modified. No Rive push, signed publish, deploy, account creation, paid service or public post was performed.
