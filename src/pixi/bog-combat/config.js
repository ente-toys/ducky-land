import data from '../bog-environment.json' with {type:'json'};
import {makeMap} from '../island-maps.js';
import {BOG_MAP_ID,BOG_REVIEW_ISLAND,BOG_AREAS} from '../bog-environment.js';
import {getBogBlockers} from './blockers.js';
import {combatForBogEnvironment} from './environment.js';

// Constructing the authority's map does not register an island alias. The
// dedicated browser entry installs that alias for its own lifetime only.
export const BOG_COMBAT=combatForBogEnvironment(
  {map:makeMap(BOG_MAP_ID,data),islandId:BOG_REVIEW_ISLAND},getBogBlockers(),BOG_AREAS,
);
