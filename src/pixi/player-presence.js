// Shared by the room and client: persistent players use the same wing-sleep art
// and footprint as the NPCs. It has no supported outfit overlay; waking restores it.
import {mapOf, THEME_OF} from './island-maps.js';
import {createNavigation} from './navigation.js';
import {sleepHalfWidths, sleeperFootprint} from './sleep-spots.js';
import {atMuseumDoor} from './player-motion.js';
import {inPoly} from '../../rive/web/island-geometry.mjs';

export const DROP_SPACING = 110;
export const dropIslands = () => ['home', ...THEME_OF.keys()];
export const sleepPose = pose => ({...pose, sleeping:true, sleep:{pose:'wing',flip:false}, action:7, travel:0, jumpLeft:0});
export const playerFootprint = pose => sleeperFootprint({...pose, r:sleepHalfWidths().wing});
export function navigationWithSleepers(map, sleepers) {
  const beds=sleepers.filter(p=>p.mode !== 'sailing');
  return beds.length ? createNavigation({...map.walk, obstacles:[...(map.walk.obstacles ?? []), ...beds.map(playerFootprint)]}) : map.nav();
}

// Reject coast edges, water, props, NPC beds and player beds, including a small
// footprint around the landing point. Occupied points also include online ducks.
export function validDrop(map, x, y, occupied=[]) {
  if (map.home && atMuseumDoor(x,y)) return false;
  if (!inPoly(x,y,map.walk.coast)) return false;
  const nav=map.nav();
  for (const [dx,dy] of [[0,0],[-38,0],[38,0],[0,-30],[0,30]]) if (!nav.walkable(x+dx,y+dy)) return false;
  return occupied.every(p=>Math.hypot(x-p.x,y-p.y)>=DROP_SPACING);
}
export function randomDrop({counts=new Map(), occupied=[], limit=100, random=Math.random}={}) {
  const choices=dropIslands().filter(id=>(counts.get(id) ?? 0)<limit);
  // Shuffle so every available island has an equal first chance. Try others if
  // sleepers have filled one island's ground; never fall back onto a blocked point.
  for(let i=choices.length-1;i>0;i--) {const j=Math.floor(random()*(i+1));[choices[i],choices[j]]=[choices[j],choices[i]];}
  // Fill the less crowded islands first, breaking ties with the shuffle above.
  // Art density changes how many position samples succeed; it must not crowd
  // new arrivals onto a few islands while other finished islands stay empty.
  choices.sort((a,b)=>(counts.get(a) ?? 0)-(counts.get(b) ?? 0));
  for(const islandId of choices) {
    const map=mapOf(islandId), bodies=occupied.filter(p=>p.islandId===islandId);
    for(let k=0;k<800;k++) {
      const x=Math.round(random()*map.width), y=Math.round(random()*map.height);
      if(validDrop(map,x,y,bodies)) return {islandId,x,y};
    }
  }
  return null;
}
