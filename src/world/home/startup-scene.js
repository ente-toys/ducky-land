import rawWorld from '../../../assets/world/world.json';
import {geometry} from '../../../assets/world/island-geometry.mjs';
import {harborClear,harborWorld} from '../../gameplay/islands.js';
import {sleepHalfWidths} from '../../rendering/pixi/environment/sleeper.js';
import {createPlacements,homeDecals,HOME_GROUND_DECALS,trimWorld,walkWorld,sleepSpots,sleeperFootprint} from './placements.js';

// Replaced at build time with a hashed asset loader. Only dev and QA compute it.
export function computeHomeScene(room) {
  const world=trimWorld(rawWorld);
  const props=createPlacements().filter(prop=>!room||harborClear(prop));
  const local=room?harborWorld(walkWorld(world,props)):walkWorld(world,props);
  const beds=sleepSpots(local,props,geometry(local).walkable,sleepHalfWidths(.88*.24*3));
  const walk={...local,obstacles:[...local.obstacles,...beds.map(sleeperFootprint)]};
  return {props,beds,dropped:beds.bad,walk,decals:homeDecals(props),groundDecals:HOME_GROUND_DECALS};
}
export async function loadHomeScene(room) {return computeHomeScene(room);}
