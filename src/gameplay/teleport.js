import {BOG_ISLAND, KARMA_REQUIRED} from '../features/bog-combat/entry.js';

export const TELEPORT_COST = 3;
export const teleportPrice = id => TELEPORT_COST + (id === BOG_ISLAND ? KARMA_REQUIRED : 0);

// Authored in island-local coordinates, with the arrival pad beside each machine. Each sits on open land near the
// harbour, at least 450 from any water, so it never stands on the docks.
export const TELEPORTERS = new Map([
  ['home', {x:5350, y:5237, arrival:{x:5402, y:5269}}],
  ['blossom', {x:-542, y:4018, arrival:{x:-490, y:4050}}],
  ['sunset', {x:9463, y:2525, arrival:{x:9515, y:2557}}],
  ['isle-251', {x:7564, y:6297, arrival:{x:7616, y:6329}}],
  ['isle-250', {x:3709, y:6397, arrival:{x:3761, y:6429}}],
  [BOG_ISLAND, {x:5061, y:6606, arrival:{x:5113, y:6638}}],
  ['isle-55', {x:7632, y:7143, arrival:{x:7684, y:7175}}],
]);

export function atTeleporter(actor, nav) {
  if (actor?.mode !== 'walking') return false;
  const machine = TELEPORTERS.get(actor.islandId);
  return Boolean(machine && Math.hypot(actor.x-machine.x, actor.y-machine.y) <= 110 &&
    nav.clearLine([actor.x,actor.y], [machine.x,machine.y]));
}
