# Ducky Land

Ducky Land is an illustrated PixiJS island with a React shell. With Node.js
22.12+ installed, run:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The island is at `/`. Players spawn at the plaza.

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
