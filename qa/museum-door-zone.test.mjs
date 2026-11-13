import test from 'node:test';
import assert from 'node:assert/strict';
import {HOME_MAP} from '../src/world/island-maps.js';
import {navOf} from '../src/gameplay/islands.js';
import {MUSEUM_DOOR, atMuseumDoor} from '../src/gameplay/player-motion.js';

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
