import {ISLETS} from '../src/pixi/islets.js';
import {isletWalk} from '../src/pixi/islet-walk.js';

// Boss 11 Nov: out of lives sends the duck to a RANDOM islet. The existing
// islet walking chart supplies the exact dock landing and owning island ID.
let pick=Math.random;
export function setBogExitRandom(random=Math.random){pick=random;}
export function bogExitIslet(){
 const islet=ISLETS[Math.min(ISLETS.length-1,Math.floor(pick()*ISLETS.length))];
 const walk=isletWalk(islet.id);
 const name=islet.name??islet.art.replace(/^\d+-/,'').split('-').map(w=>w[0].toUpperCase()+w.slice(1)).join(' ');
 return {islet:islet.id,islandId:islet.home,name,...walk.land};
}
