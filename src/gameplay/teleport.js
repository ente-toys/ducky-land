import {BOG_ISLAND, KARMA_REQUIRED} from '../features/bog-combat/entry.js';

export const TELEPORT_COST = 3;
export const TELEPORTER_MAP_ICON = '/pixi-art/radar-marker/teleporter.svg';
export const TELEPORTER_LOCKED_MAP_ICON = '/pixi-art/radar-marker/teleporter-locked.svg';
export const teleportPrice = id => TELEPORT_COST + (id === BOG_ISLAND ? KARMA_REQUIRED : 0);

// Authored in island-local coordinates, with the arrival pad beside each machine.
export const TELEPORTERS = new Map([
  ['home', {x:4371, y:5435, arrival:{x:4423, y:5467}}],
  ['blossom', {x:-1140, y:3360, arrival:{x:-1088, y:3392}}],
  ['sunset', {x:9400, y:2970, arrival:{x:9452, y:3002}}],
  ['isle-251', {x:6480, y:6650, arrival:{x:6532, y:6682}}],
  ['isle-250', {x:3880, y:6440, arrival:{x:3932, y:6472}}],
  [BOG_ISLAND, {x:3540, y:7290, arrival:{x:3592, y:7322}}],
  ['isle-55', {x:8767, y:7048, arrival:{x:8819, y:7080}}],
]);

export function atTeleporter(actor, nav) {
  if (actor?.mode !== 'walking') return false;
  const machine = TELEPORTERS.get(actor.islandId);
  return Boolean(machine && Math.hypot(actor.x-machine.x, actor.y-machine.y) <= 110 &&
    nav.clearLine([actor.x,actor.y], [machine.x,machine.y]));
}
