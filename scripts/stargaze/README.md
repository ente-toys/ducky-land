# Duckyland telescope

A circular eyepiece, playful online stars, and an endless faint background. The interface shows the total star count, online count, and your star, plus a close button.

The production dialog still reads `/api/stars` every 30 seconds. The preview uses an offline fixture (30,088 stars and 2 online); these are not live counts. GitHub account star positions are unchanged. Anonymous stars are spaced over a larger region. Background stars are deterministic tiles generated wherever you pan; they are decorative and are never counted or connected.

Online stars form a minimum spanning tree at their actual coordinates. Pan with drag or arrow keys, zoom with the wheel, pinch, or plus/minus, and select **Your star** (or press Home while the canvas has focus) to return. Escape or the close button returns to the island. Reduced motion keeps the sky still.

Tap a named star (online or offline) to show its GitHub username; tap empty sky to dismiss. Enter selects the named star nearest the centre. Labels follow their stars and stay inside the round lens. GitHub provides only an aggregate count for anonymous stars, so they do not receive invented names.

## Review

```sh
node scripts/stargaze/build-preview.mjs
```

Open `review/stargaze/telescope-preview.html` in a browser. It is self-contained, uses the production React dialog and renderer, and works without a development server. Closing it reveals the button to look through the telescope again.

```sh
node --test qa/stargazing.test.mjs qa/stargaze-render.test.mjs
node scripts/stargaze/render-preview.mjs
npm run build
```

The canvas harness checks real rendered pixels and input events using the existing `@napi-rs/canvas` dependency. Its PNG is a composition of the actual sky renderer with representative UI placement, not a browser screenshot. A browser layout/interaction pass is still required on desktop and mobile before release.

No dependencies or server endpoints changed.
