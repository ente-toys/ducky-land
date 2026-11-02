# Ducky Land: join + share

Local preview: **http://127.0.0.1:8806/**

Implemented and checked in real Chrome. The supplied plaza at port 8793 and its source folder were not changed.

## What works

- Large animated Drip Ducky preview, with independent cap, shades, accessory and shoes controls. Every one of the 33 permitted Drip items is available. Acc 6 is absent from the catalog and native Rive file.
- Previous/next controls, direct selection, None, and Randomize. Outfit changes update the live Rive view model and the URL.
- Required name and city, with Kochi, Chennai, Bengaluru, London, Mumbai, Delhi, Hyderabad, Pune and Other. URL name/city values prefill the form. All nine cities have native name-tag variants.
- Waddle in enters the plaza with a native Rive drop, squash and settle. The landing uses a native joystick to scrub an isolated arrival timeline, so depth sorting cannot restart it. The shadow stays on the ground. Reduced motion skips the drop.
- Existing tap/WASD/arrow movement, Q quack and E dance. The plaza has just two host controls: Your drip and Photo mode. The movement hint disappears automatically.
- Photo mode freezes the game clock and every native Rive animation. It crops the player and nearby Duckies into a Drip postcard titled “my ducky in Ducky Land”. Both formats use one shared frozen scene.
- Separate download links for **1600 × 900 PNG** and **1200 × 1200 PNG**. A native Rive card supplies the title, frame and name/city signature. Canvas 2D only composites the captured Rive pixels.
- Copy my drip link carries the outfit, name and city. Closing the photo with the close control, Escape or the backdrop resumes the plaza. Your drip returns to the wardrobe without losing identity or outfit.
- The welcome flock leaves room around the player, keeping the first share card readable.

Rive owns the character, world, landing and card artwork. Accessible HTML supplies the form controls and download actions. No Luau, shaders, signed builds, account writes, deploys, paid calls or public posts were used.

## Run

The preview server is already running on port 8806. To start it again:

```sh
cd '/Users/pragadees.xd/Downloads/Ducky Land/codex-onboard'
python3 serve.py
```

The server binds only to 127.0.0.1 and sends no-store headers.

To regenerate and validate the native Rive build:

```sh
cd '/Users/pragadees.xd/Downloads/Ducky Land/codex-onboard'
zsh build.sh
```

`gen.py` reads the original Drip SVGs without editing them. `DRIP_SVG_DIR` can override their location.

## URL contract

Example:

http://127.0.0.1:8806/?cap=3&shades=1&acc=7&shoes=10&name=pragi&city=Kochi

Values are **Rive slot indexes**, not the numbers in SVG filenames. Zero means None. Invalid or out-of-range values fall back to valid defaults.

| Parameter | Allowed indexes | Native item order after None |
| --- | --- | --- |
| cap | 0–13 | CAP 1 through CAP 13 |
| shades | 0–3 | Shades 2, Shades 8, Shades 12 |
| acc | 0–7 | Acc 4, Acc 5, Acc 8, Acc 9, Acc 10, Acc 11, Acc 12 |
| shoes | 0–10 | Shoes 1, 2, 5, 6, 7, 8, 9, 10, 11, 12 |

`accessory` is accepted as an alias for `acc`. City matching is case-insensitive. Names are trimmed, stripped of control characters and limited to 18 characters.

For integration, `DuckyVM.arrival` ranges from -1 at the start of the native landing timeline to +1 at rest. Ordinary crowd instances must keep arrival at +1. Host action 4 gates the landing; the ordinary action machine retains 0 idle, 1 walk, 2 quack and 3 dance.

## Verification

- `rive rive --verify`: **0 errors, 0 warnings**.
- `rive inspect rive --summary`: **0 problems**. Saved at [shots/rive-inspect.json](shots/rive-inspect.json).
- JavaScript syntax checks passed.
- Eight pure logic check groups passed, including all allowed URL indexes, invalid values, identity/link round-tripping and complete-player crops at plaza edges. [shots/core-check.json](shots/core-check.json).
- Real Chrome loaded the final **666,837-byte** unsigned build at a 1512 × 827 viewport, with no horizontal overflow or runtime errors.
- The opt-in browser run exercised every wardrobe value, Randomize, join, native landing, paused time/positions, both PNG dimensions and rendered pixels, immediate resume, and return to the wardrobe. Final result: **pass, 0 errors**. [shots/browser-check.json](shots/browser-check.json).
- Landing captures use deterministic 60 Hz simulation steps inside real Chrome because other parallel sessions repeatedly hid the review tab. This is a functional animation check, not a frame-rate benchmark.
- Both exported PNGs were opened and inspected. The player is visible, grounded, wearing the selected outfit, and identified by name/city.

Replay the local browser regression with:

http://127.0.0.1:8806/?qa=auto&cap=3&shades=1&acc=7&shoes=10

This opt-in route writes its evidence only into this folder. Normal visits do not run QA or save server-side images.

## Screenshots and exports

The five page captures below were rasterized in real Chrome from the live computed DOM, embedded fonts and actual native Rive canvas pixels. This avoided the shared OS window capture returning a different agent's tab or a gray window. They contain the rendered page, without browser chrome.

1. [Join and URL outfit](shots/01-join-browser.png)
2. [Randomized outfit](shots/02-randomized-browser.png)
3. [Landing in progress](shots/03-landing-browser.png)
4. [Landed plaza](shots/04-plaza-browser.png)
5. [Frozen photo mode and download controls](shots/05-photo-mode-browser.png)

Native Rive captures: [Wardrobe](shots/wardrobe-native.png), [Landing](shots/landing-native.png), [Plaza](shots/plaza-native.png).

Actual share PNGs: [X, 1600 × 900](exports/my-ducky-x.png), [Square, 1200 × 1200](exports/my-ducky-square.png).

No MP4 was produced.

## Open issues and limits

- The crowd is the supplied local simulation. Real multiplayer, server identity and city scores belong to the separate multiplayer integration. No request is made to drip.ente.com; this build accepts its incoming outfit URL contract.
- Verification covers desktop Chrome. Phone-specific layout/device verification and Safari/Firefox behavior remain unverified.
- The pinned Rive WebGL2 runtime is required. PNG capture uses its renderer/artboard interface, so review the capture helper if that runtime is upgraded.
- The CLI screenshot command was attempted, but this sandbox could not create a Metal context. Headless Chrome also hit a sandbox Mach-port denial. The real Chrome run and native/browser-rendered captures above supplied the visual verification instead.
- Other crowd Duckies can still overlap each other. The local personal-space rule protects the player's initial landing area; it is not a replacement for the separate crowd-brain work.

Main sources: `rive/gen.py`, `rive/plaza.py`, `rive/join.py`, `rive/web/index.html`, `rive/web/style.css`, `rive/web/core.js`, `rive/web/app.js`, `serve.py`, `build.sh`.
