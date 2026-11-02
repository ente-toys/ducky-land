# Ducky Land activities

Copy `web/` into a local/static host to run the activities with their shared native Rive asset. There is no bundler or package install for playback.

## Portable game rules

- `web/activities/bread-hunt.js` exports `BreadHunt`, `routeTo`, `walkable`, and `BREAD_SPOTS`. Construct with `{city,total,onCollect,onFinish}`, call `start()`, then `update(dt,{x,y})`. A pointer destination goes to `target(x,y)`. `onCollect` receives `{bread,points,total,city}` exactly once per slice. Use this callback to persist an authoritative city score in the integrated world.
- `web/activities/duck-race.js` exports `DuckRace` and `CITIES`. Construct with `{count,city,onCountdown,onFinish}`, call `start()`, then `update(dt)` and `paddle()` per discrete input. Count is clamped to 2 through 8. `onFinish` receives `{order,taps}` with finish times in seconds. AI and player use the same race clock.
- Both modules have no DOM, storage, framework, or Rive imports. Coordinates are 1600 × 1000 world units. Pass small update steps, normally from requestAnimationFrame, and pause updates when the host is hidden.

## Rendering adapter

`web/activity.js` maps portable state into `ducky-land.riv`:

| Activity | Artboard | State machine | Native effects |
| --- | --- | --- | --- |
| Bread Hunt | `Bread Hunt` | `Plaza` | `Ambient` includes bread bobs; `Pop 0` through `Pop 11` include crumb bursts and floating +10; `Results` |
| Duck Race | `Duck Race` | `Activity` | `Lake life` contains float bobs, wakes and splashes; `Countdown`; `Results` |

Use `autoBind:true` and the artboard's `viewModelInstance`. The shared view model has `slot0` through `slot15`, each a nested Ducky view model. Depth-sort world objects by `y`, then write `x`, `y`, `facing`, `action`, `cap`, `shades`, `acc`, `shoes`, `city`, `isPlayer`, and `name`. Race uses the first eight sorted placements; their float colours follow city. Rive draws every scene object and every in-activity card, label and effect.

Top-level values:

- `intro`, `result`, `counter`: numeric opacity switches.
- `total`, `progress`, `resultTitle`, `resultSub`, `raceStatus`: strings.
- Per slice `b0x/b0y/b0show/b0px/b0py`, continuing through slice 11. The first three place/show the slice; `px/py` place its one-shot native effect. Play `Pop N` when collected.
- `splash0` through `splash7`: numeric switches for native paddle splash geometry.
- `row0` through `row7` and `time0` through `time7`: result order and formatted time strings.

`activity.js` is also the reference for intro/replay button bounds, contain-fit pointer conversion, result timing, and city score display. Its `localStorage` score is only a local prototype adapter, not a multiplayer service. Replace `saveTotal` when integrating.

## Source and rebuild

`sh rive/build.sh` regenerates the base Ducky, plaza, and two activity artboards, verifies and inspects the document, then copies the unsigned `.riv` to `web/`. The Python SVG converter is vendored in `rive/tools/`; it has no third-party dependency. Only Python 3 and the installed Rive CLI are required to rebuild.

The build has no Rive scripts and needs no signing, account push, or publish step. The excluded Drip Acc 6 SVG is present in the inherited source reference directory but is never imported into the rig.

## QA

Run `node rive/test-rules.mjs` for deterministic rules checks. Run `python3 rive/serve.py --qa`, then open `http://127.0.0.1:8802/bread.html?qa=auto` for an opt-in real-time browser playthrough. It dispatches keyboard and pointer events through the production handlers, completes both games and replays them. It does not teleport the player or fast-forward the race. Evidence is written to `rive/shots/`. Keep the tab visible because normal game time pauses in hidden tabs. QA uses a separate storage key so it does not add test bread to normal play.

For busy shared browser sessions, `race.html?qa=fast` captures the initial native countdown badge, skips the remaining countdown wait, captures initial paddle effects, then advances the remaining race with a fixed 60 Hz test clock before capturing the native results card and replay. This option changes only the test harness; production gameplay always follows real frame time. The JSON evidence includes an explicit fixed-step check when this mode is used.
