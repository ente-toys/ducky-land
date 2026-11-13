import {ISLETS} from '../src/world/islets.js';
import {isletWalk} from '../src/world/islet-walk.js';
import {addParkedBoat,boatHome,fillMoorings} from '../src/gameplay/islands.js';

let pick=Math.random;
export function setBogExitRandom(random=Math.random){pick=random;}
export function bogExitIslet(){
 const islet=ISLETS[Math.min(ISLETS.length-1,Math.floor(pick()*ISLETS.length))];
 const walk=isletWalk(islet.id);
 const name=islet.name??islet.art.replace(/^\d+-/,'').split('-').map(w=>w[0].toUpperCase()+w.slice(1)).join(' ');
 return {islet:islet.id,islandId:islet.home,name,...walk.land,dock:{...walk.water}};
}

// Reuse a waiting boat or move a free moored boat. If the fleet is busy, add a boat at the dock.
export function boatForExit(boats,{islandId,dock}){
 if(boats.some(b=>!b.occupant&&b.islandId===islandId&&Math.hypot(b.x-dock.x,b.y-dock.y)<=150))return false;
 const boat=boats.find(b=>!b.occupant&&!b.parked&&b.islandId===islandId&&boatHome(b)===islandId)??boats.find(b=>!b.occupant&&!b.parked&&b.islandId===islandId);
 if(boat){
  Object.assign(boat,{x:dock.x,y:dock.y,parked:true});
  fillMoorings(boats);
 }else addParkedBoat(boats,islandId,dock);
 return true;
}
