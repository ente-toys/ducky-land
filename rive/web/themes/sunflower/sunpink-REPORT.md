# sunpink

Completed locally on 6 November 2026. No commit, push, publish, credits, dist changes, port 8890, or boss browser use.

## Result

| | Sunflower | Pink |
|---|---:|---:|
| Coast area | 20,462,862.5 | 19,981,872.5 |
| Ratio to the brief's home area | 1.845x | 1.802x |
| Sleepers, resolved and indexed | 40 | 40 |
| Dropped sleepers | 0 | 0 |
| Locked centre pieces | 25 | 13 |
| Centre collision shapes | 5 | 4 |
| Open stair routes | 4 | 1 |
| Arched bridges | 2 | 2 |
| Boardable boats | 10 | 8 |

- Replaced Sunflower's sundial with the locked ring and clock at origin `[3880,2608.5]`, uniform scale `0.65`.
- Replaced Pink's ribbon fountain/sculpture with the locked music box terrace at origin `[4000,3004]`, uniform scale `0.6`. The lower plaza origin is offset south so the taller terrace fits the existing plaza.
- Locked centre SVGs and centre.json files are unchanged. Ground pieces use flats, back pieces use decks, front and standing pieces use props. Prop anchors encode each source `sortY` because the renderer sorts on `prop.y`. Attached hands/dancer/key share their parent's depth, just above it. No wind or extra contact shadow is added to the centre pieces.
- Transformed every locked blocked polygon and ellipse into both world and walk-world obstacles. Removed only the old landmark footprints. Stair corridors remain open between the source polygons. Transformed stair and walkable metadata is retained in `world.centrePlacement`.
- Spawn and harbor spawn agree: Sunflower `[3880,2950.855]`, Pink `[4000,3224.62]`. Both are clear of centre props.
- Moved two Sunflower lamps and six Pink plaza/garden accessories to keep the new centre clear, updating their footprints too.
- Forty beds per theme use the existing home poses: nod 8, hammock 4, rock 5, leaf 6, book 5, chair 2, wing 6, box 4. Kept valid original beds and placed additions beside fitting props using the game resolver and path-width clearance.
- Pink's two arched bridge views are clear of trees. Existing trees needed no further relocation. Matched walkway endpoints exactly to the subpixel arch endpoints in both maps; rise remains 70 and width 84.
- Existing island size, open activity areas and stall rows remain intact.

## Files

- `rive/web/themes/{sunflower,pink}/{world,walk-world,harbor}.json`
- `public/pixi-art/themes/{sunflower,pink}/art.json`
- `public/pixi-art/themes/{sunflower,pink}/preview.png`, refreshed globe previews
- `public/pixi-art/themes/{sunflower,pink}/sunpink-centre-review.png`, reviewed offline centre renders
- `public/pixi-art/themes/{sunflower,pink}/sunpink-centre-walk.png`, collision overlays
- `public/pixi-art/themes/pink/sunpink-bridge-{1,2}.png`, reviewed bridge crops
- `rive/web/themes/{sunflower,pink}/sunpink-validation.json`
- `scripts/themes/sunflower-centres.mjs`, idempotent placement pass, accepts `sunflower` or `pink`, defaults to both
- `scripts/themes/sunflower-review.mjs`, offline rendering and navigation validation
- `scripts/themes/{sunflower,pink}-build.py`, run their own theme's placement pass after rebuilding
- This report

## Verification

- `node scripts/theme-index.mjs --check`: READY sunflower and READY pink, 40 resolved beds each, no dropped beds.
- Shared index readback already contains 40 sleepers for both themes, refreshed by the existing integration process. This job did not write the shared index.
- `node scripts/themes/sunflower-review.mjs`: zero errors for both. Every centre stair and bridge centreline sampled at 21 points, reachable from spawn. Every zone spawn reachable. Flood fill including all 40 sleeper footprints reaches 99.988% of Sunflower's walkable cells and 99.998% of Pink's; tiny peripheral grid fragments remain.
- `node scripts/themes/pink-check.mjs`: PASS for every zone, islet, pier, harbor and boat.
- Focused game-map readback: all 10 Sunflower and all 8 Pink boats float and have boardable ground; both spawns clear; both maps have 40 indexed sleepers.
- `node --test qa/themes.test.mjs`: 5 passed, 1 failed. The failure is `isle-251-2 is boarded from isle-251's own ground`, a Library berth. Library is outside this job's scope. Theme landing, sailing, registry and size tests passed.
- Node syntax checks and Python AST checks passed. A repeated placement run leaves all eight map/art JSON files byte-identical.
- Opened and reviewed both full-island previews, both centre close-ups, and both Pink bridge crops.

## Handoff and limits

1. Browser QA is still required. Attempted `npx vite --port 5220 --strictPort --host 127.0.0.1`; sandbox returned `listen EPERM`. Headless Playwright Chromium also failed to launch in the sandbox. The PNGs are offline manifest renders, not browser screenshots.
2. The shared `src/pixi/sleep-spots.js` still defines 28-bed counts and checks each pose against home's old distribution. `scripts/theme-index.mjs --check` therefore says `40/28` and prints shape warnings. Integration should validate 40 total for themed islands while allowing their individual pose distribution, and keep home's own configuration separate. No THEME_OF change or centre renderer change is needed.
3. Centre animation metadata is preserved in the locked source. Hands, dancer and key are installed in their authored static poses. Optional clock/dancer animation would require shared engine work and was not requested here.
4. This report belongs at `../concepts/themes/codex-builds/sunpink-REPORT.md`, but that location is outside both the named edit scope and the writable workspace. The in-scope copy is here for the integration agent to move.
5. Attempted the requested team log. The feed append returned `Operation not permitted`, so no successful feed write is claimed.
