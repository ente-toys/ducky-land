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

## Multiplayer preview and rollout

Guests can watch the live island, pan, and zoom. Use **Play with GitHub** to
move and emote as a duck. The latest playing tab for an account controls that
duck. Signed-in users can see GitHub usernames above the ducks. Signed-in
players can press C or choose Chat to open a yellow text bubble under their username.
It follows the duck while walking. Text appears live to other signed-in users,
disappears after five seconds, and has no history. Esc clears it immediately.
The preview and production use different GitHub apps and room storage.

1. Register a GitHub OAuth app for the [preview island](https://multiplayer.ducky-land.pages.dev/).
   Use `https://multiplayer.ducky-land.pages.dev/auth/github/callback` as its exact
   redirect URI. Add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` to the
   **Preview** environment in the Cloudflare Pages project's **Variables and
   Secrets** settings.
2. Build and deploy the preview Worker and Pages branch.

   ```sh
   npm run build
   npx wrangler deploy --config worker/wrangler.jsonc --env preview
   npx wrangler pages deploy dist --project-name ducky-land --branch multiplayer
   ```

3. In two browser profiles signed in to different GitHub accounts and a third
   signed-out profile, check that both ducks spawn and can move and emote
   independently, and that the guest sees both. Check sign-out, reconnect, and
   tab takeover. The automated tests exercise the actual room and WebSockets
   using simulated GitHub responses.
4. After preview acceptance, create a separate production OAuth app with
   `https://ducky-land.pages.dev/auth/github/callback` as its redirect URI. Set
   its ID and secret in the **Production** environment. Record the current Pages
   production deployment for rollback. Deploy the room Worker with
   `npx wrangler deploy --config worker/wrangler.jsonc`, then deploy the build
   with `npx wrangler pages deploy dist --project-name ducky-land --branch main`.
   Verify the production homepage and sign-in callback. Use the Pages dashboard
   to roll back to the recorded deployment if needed.

Vite and its static preview serve the artwork. Live play needs the Pages
Functions and a bound room Worker. The Node server started by `npm start`
remains a fixture for the legacy network tests.
