# Ducky Land

Ducky Land is an illustrated PixiJS island with a React shell. With Node.js
22.12+ installed, run:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The island is at `/`. Players spawn at the plaza.

Vite proxies `/api` HTTP and WebSocket requests to the production server at
`https://ducky-land.pages.dev`, so the local app watches the real live island.
GitHub sign-in opens the production site; its secure session stays on that host.
Local previews remain guests. Use the production site to sign in and play.

Click or tap to walk, or use WASD or the arrow keys. Drag to pan, scroll or pinch
to zoom, press F to follow your duck, and press Home or 0 for the island overview.
Q or 1 quacks, E dances, 2–7 trigger other emotes, and M toggles sound. Tap your
duck twice to dance. Press 5 for a side nap.

The 28 ambient ducks pick from three sleeping poses. A duck rows around Racing
Lake, crows circle the island, and waves roll onto Lighthouse Beach. Reduced
motion quiets the animation, and hidden tabs pause simulation and audio.

`npm run build` builds the site into `dist/`. Use `npm run preview` to serve that
build locally. `npm test` runs the test suite and expects the WebSocket fixture
server on port 8810. Start it separately with `npm start`.

To join the latest committed island branches and verify the complete game, run
`scripts/merge-islands.sh`. It merges Home (`live-boat`), the twelve `big-*`
island branches, `big-limits`, and `spread-islands`, then starts its own test
fixture on port 19300, runs the full suite, and builds with Vite's native config
loader. Choose another free fixture port with `DUCKY_WS_PORT=19301` if needed.
Start with a clean working tree. An unfamiliar merge conflict stops the command
for review; resolve and commit it, then rerun. The command never pushes.

The sandbox integration may arrive as resolved working files plus
`../concepts/themes/codex-builds/integrate.bundle`. On its original `int-big`
base, the same command imports that bundle after verifying every prepared file
matches. This records the existing integration without changing working files,
then continues with newer island commits. Save any additional edits first.

The renderer lives in `src/pixi/`. Its SVG artwork lives in `public/pixi-art/`
and `public/pixi-duck/`. To regenerate it from the original vector sources,
run `python3 scripts/extract-pixi-art.py` and
`python3 scripts/extract-pixi-duck.py`. The duck exporter uses the installed Node
dependencies to measure the artwork.

## Multiplayer and deployment

Guests can watch the live island, pan, and zoom. Use **Play with GitHub** to
move and emote as a duck after starring [ente/ente](https://github.com/ente/ente).
GitHub checks the star at sign-in and whenever a player joins or reconnects.
Signed-in viewers can use **Unlock play** to open the repository, then
**I’ve starred it — check again** to verify and join immediately. Sessions
created before this requirement need one new sign-in. OAuth tokens stay in
server-side session storage and are removed when the session expires or is revoked. The latest playing tab for an account controls that
duck. Signed-in users can see GitHub usernames above the ducks. Signed-in
players can press C or choose Chat to open a yellow text bubble under their username.
A live user count appears at the bottom left, including players and viewers
(signed-in accounts count once across tabs). New players trigger a join toast
at the bottom right; quick reconnects and tab takeovers do not repeat it.
Guests see anonymous join notices.

Chat follows the duck while walking. Text appears live to other signed-in users,
disappears after five seconds, and has no history. Esc clears it immediately.

Pushes to `main` trigger GitHub Actions to test and build the project, then
deploy the production room Worker and [Ducky Land](https://ducky-land.pages.dev/).
Set the Actions variable `CLOUDFLARE_ACCOUNT_ID` and the Actions secret
`CLOUDFLARE_API_TOKEN` with Cloudflare Pages and Workers Scripts edit access.

The GitHub OAuth app uses `https://ducky-land.pages.dev/auth/github/callback` as
its redirect URI. Set its client ID and secret as `GITHUB_CLIENT_ID` and
`GITHUB_CLIENT_SECRET` in the Cloudflare Pages **Production** environment.

Vite and its static preview serve the artwork. Live play needs the Pages
Functions and a bound room Worker. The Node server started by `npm start`
remains a fixture for the legacy network tests.

## Local audit validation

Use Node 24 and `npm ci`. With `npm start` running on port 8810, run
`npm test`, `npm run build`, and `git diff --check`. The test workflow includes
the generated SVG source-freshness check. Regenerate stale artwork with the
existing `npm run globe:assets` generator; do not edit fingerprints manually.

`node scripts/load-live.mjs --audit` runs the real Worker in local Miniflare:
100 players, then 200 players across two islands plus 64 spectators, using
both incremental updates and legacy snapshots. Each scenario measures 60
seconds after warmup, followed by a 900-second reconnect/transition soak.
Optional arguments are scenario seconds, soak seconds, and port (default
8941). The harness checks admission, counts, update ordering, valid poses,
unexpected disconnects, server-step p95 below 50 ms, and final connection
and timer cleanup. Output is one JSON result per scenario.

For browser checks, run `npx vite --config qa/audit-vite.config.mjs --configLoader native` and open
`http://127.0.0.1:5188/qa/audit-browser.html`. Its controls place a synthetic
local account on each island and expose five-run startup/transition
measurements. Responses disable HTTP caching for fresh-document startup
checks; shader/OS caches are not reset. `AUDIT_PORT` and `AUDIT_ROOM_PORT`
allow an unchanged checkout to run alongside it for comparison.
Restart this fixture after editing Worker code. Use `--soak-only` with the
load command to repeat just the churn scenario while investigating a failure.
The reduced-motion control supplies the media preference before loading the
game. The background check simulates document visibility events and verifies
that frames stop and resume; it does not change the operating system's settings.

Synthetic sessions and placement routes exist only in the in-memory test
Worker bound to loopback. Neither QA configuration is a deployment entrypoint.
Real OAuth, account access, logout and persistence must also be checked on a
separate preview with preview-specific OAuth credentials; local sessions do
not validate those flows.
