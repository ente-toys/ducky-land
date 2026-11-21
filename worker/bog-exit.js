import {TELEPORTERS} from '../src/gameplay/teleport.js';

// Out of lives: paddle home to Homeland's teleporter pad, where boats and the teleporter are in reach.
// (Sea islets had no way off once boat building was retired for the fixed fleet.)
export function bogExitIsland(){
 const {arrival}=TELEPORTERS.get('home');
 return {islandId:'home',name:'Homeland',x:arrival.x,y:arrival.y};
}
