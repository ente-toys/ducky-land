import data from '../bog-environment.json' with {type:'json'};
import {makeMap} from '../island-maps.js';
import {BOG_MAP_ID,BOG_REVIEW_ISLAND,BOG_AREAS} from '../bog-environment.js';
import {getBogBlockers} from './blockers.js';
import {combatForBogEnvironment} from './environment.js';

export const BOG_COMBAT=combatForBogEnvironment(
  {map:makeMap(BOG_MAP_ID,data),islandId:BOG_REVIEW_ISLAND},getBogBlockers(),BOG_AREAS,
);
