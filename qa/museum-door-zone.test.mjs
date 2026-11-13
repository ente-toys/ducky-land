import test from 'node:test';
import assert from 'node:assert/strict';
import {HOME_MAP} from '../src/world/island-maps.js';
import {navOf} from '../src/gameplay/islands.js';
import {readFileSync} from 'node:fs';
import {MUSEUM_DOOR, atMuseumDoor, setWalkDestination, walkStep} from '../src/gameplay/player-motion.js';

// Boss 13 Nov: walking north to the north beach froze the game, and a refresh put the Duck on the plaza. The museum
// door zone had no top edge, so the open ground north of the museum (added by Home's north expansion) counted as
// "at the door": the client stopped input every frame and the server sent the rejoin to the plaza.
test('only the strip in front of the museum wall is the museum door, not the land north of it', () => {
  const nav = navOf('home');
  const mid = (MUSEUM_DOOR.x0 + MUSEUM_DOOR.x1) / 2;
  assert.ok(atMuseumDoor(mid, MUSEUM_DOOR.y - 20), 'the door itself still opens the museum');
  for (const [x, y] of [[2851, 155], [2920, 700], [2920, -300], [2900, -77]]) {
    assert.ok(nav.walkable(x, y), `${x},${y} is open ground`);
    assert.ok(!atMuseumDoor(x, y), `${x},${y} north of the museum is not the door`);
  }
  // every walkable point the zone covers is the door strip, which only the plaza side can reach
  for (let x = MUSEUM_DOOR.x0 + 2; x < MUSEUM_DOOR.x1; x += 8)
    for (let y = HOME_MAP.origin.y; y < MUSEUM_DOOR.y; y += 8)
      if (atMuseumDoor(x, y) && nav.walkable(x, y)) assert.ok(y > 1120, `${x},${y} is inside the door zone but behind the museum`);
});

// The Home revert (cbaeec986) dropped MUSEUM_DOOR.x, which the engine uses to preload the interior near the door.
// The distance became NaN, the interior never loaded, and the Duck froze at the door instead of entering.
test('walking up from the plaza reaches the door strip, and the interior preload point is the door', async () => {
  assert.ok(Number.isFinite(MUSEUM_DOOR.x) && MUSEUM_DOOR.x > MUSEUM_DOOR.x0 && MUSEUM_DOOR.x < MUSEUM_DOOR.x1, 'the door has a centre x');
  assert.ok(Math.hypot(MUSEUM_DOOR.out.x - MUSEUM_DOOR.x, MUSEUM_DOOR.out.y - MUSEUM_DOOR.y) < 700, 'the plaza side of the door preloads the interior');
  const engine = readFileSync(new URL('../src/rendering/pixi/engine.js', import.meta.url), 'utf8');
  assert.match(engine, /Math\.hypot\(player\.x-MUSEUM_DOOR\.x, player\.y-MUSEUM_DOOR\.y\) < 700\) this\.ensureInterior\(\)/, 'engine preloads the interior by distance to the door');
  const nav = navOf('home');
  for (const input of [{x: 0, y: -1}, {x: 0, y: -1, run: true}]) {
    const duck = {x: MUSEUM_DOOR.out.x, y: MUSEUM_DOOR.out.y, path: [], action: 0, until: 0, pace: 0, turn: 0, emoteVersion: 0};
    let t = 0, reached = false;
    for (let i = 0; i < 120 && !reached; i++) {t += .05; walkStep(duck, nav, .05, t, input); reached = atMuseumDoor(duck.x, duck.y);}
    assert.ok(reached, `holding up from the plaza reaches the door (stopped at ${duck.x.toFixed(0)},${duck.y.toFixed(0)})`);
  }
  const clicked = {x: MUSEUM_DOOR.out.x, y: MUSEUM_DOOR.out.y, path: [], action: 0, until: 0, pace: 0, turn: 0, emoteVersion: 0};
  assert.ok(setWalkDestination(clicked, nav, MUSEUM_DOOR.x, 1170), 'the door strip is a valid destination');
  let t = 0;
  for (let i = 0; i < 120 && clicked.path.length; i++) {t += .05; walkStep(clicked, nav, .05, t, {x: 0, y: 0});}
  assert.ok(atMuseumDoor(clicked.x, clicked.y), `clicking the door walks into it (stopped at ${clicked.x.toFixed(0)},${clicked.y.toFixed(0)})`);
});
