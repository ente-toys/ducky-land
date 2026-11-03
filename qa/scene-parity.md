# Original scene and Pixi behavior parity

Compared on 2026-11-03 against the active `/` route: `src/App.jsx` → `rive/web/island.html?scene=1&view=flat`, including `game.js`, `island-host.js`, `life.js`, and the native emote generators.

## Restored behavior

| Area | Checked behavior |
| --- | --- |
| Player identity | Coral player ring under the feet, absent beneath NPCs; player-first picking when ducks overlap. |
| Emotes | Q/1 quack bubbles on every quacking actor; up to three nearby ducks reply with staggered bubbles. Keys 2–7 show heart, laugh, wave, sleep, angry, and party bubbles. Laugh/sleep facial lines, forward-facing player emotes, restart, expiry, and movement interruption are supported. E starts/stops dancing. |
| Taps and walking | Clicking scenery routes around obstacles; a 1.5-second expanding destination ring appears. Tapping an NPC makes it quack and face the player while the player waves. Tapping the player quacks; a second tap within 450 ms dances. WASD and all four arrows move. |
| Camera and sound | Drag, middle-button drag, wheel, pinch, cancellation, Home/0, +/−, and F. F enables follow; walking toward the viewport edge enables follow outside overview mode. Fit mode survives resize. Zoom limits and pan boundaries match the original host. M toggles local sound; quack, pop, and footstep samples remain local. |
| Environment and lifecycle | 29 ducks, idle wandering and social replies; three flapping birds, two butterflies, drifting leaves, fountain drops and impact rings, wind, boat bobbing, and water ripples. Pixi also retains its moving lily pads. Input clears on blur/visibility changes; reduced motion keeps feedback visible without pop/flight motion; disposal removes handlers and releases resources. |

## Verification

- `qa/pixi-parity.html` runs 11 browser integration groups against the mounted Pixi engine, covering feedback, all emote keys, movement, taps, replies, destination timing, camera controls, sound toggling, synthetic gestures, input cleanup, and disposal.
- `qa/wardrobe.html?group=outfits&verify=1` checks all 272 wearable directions and 2,720 action cases.
- Node checks cover emote feedback timing, player-only rings, simulation behavior, navigation, gesture cancellation, asset validity, and path continuity.
- The original and Pixi pages were also inspected live with keyboard Q, including the player marker and nearby reply bubbles.

## Scope and differences

This compares the active scene at `/`. Menus and multiplayer/activity screens from legacy prototype pages are not loaded by that route and are outside this comparison. Pixi retains its illustrated artwork and plaza starting view; Home/0 provides the original whole-island view. The Rive and Pixi animation curves are different implementations of the same actions. Reduced motion is more restrictive in Pixi. Synthetic gesture checks do not replace physical touchscreen testing; audio handlers and local files were checked, without an acoustic recording comparison.
