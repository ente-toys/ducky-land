import {BOG_BLOCKERS} from '../src/features/bog-combat/bog-blockers.js';
import {BOG_COMBAT} from '../src/features/bog-combat/config.js';
import {DUCK_RADIUS} from '../src/features/bog-combat/physics.js';
export function groupFeet(g){return BOG_BLOCKERS.filter(b=>g.members.includes(b.prop??b.id));}
export function groupBounds(g){const feet=groupFeet(g);return {l:Math.min(...feet.map(b=>b.x)),r:Math.max(...feet.map(b=>b.x+b.width)),t:Math.min(...feet.map(b=>b.y)),b:Math.max(...feet.map(b=>b.y+b.height))};}
export function shelters(g){const {l,r,t,b}=groupBounds(g);return [[l-52,(t+b)/2],[r+52,(t+b)/2],[(l+r)/2,t-52],[(l+r)/2,b+52]].filter(p=>BOG_COMBAT.navigation.walkable(...p)&&BOG_COMBAT.navigation.route(4200,2800,...p).length);}
export function hasWideBypass(g){const {l,r,t,b}=groupBounds(g),strips=[
 k=>[[l-60,t-60+k],[r+60,t-60+k]],k=>[[l-60,b+60+k],[r+60,b+60+k]],
 k=>[[l-60+k,t-60],[l-60+k,b+60]],k=>[[r+60+k,t-60],[r+60+k,b+60]],
];return strips.some(strip=>[-DUCK_RADIUS,-DUCK_RADIUS/2,0,DUCK_RADIUS/2,DUCK_RADIUS].every(k=>BOG_COMBAT.navigation.clearLine(...strip(k))));}
export function shortCrossing(b){return b.width<b.height?[{x:b.x-2,y:b.y+b.height/2},{x:b.x+b.width+2,y:b.y+b.height/2}]:[{x:b.x+b.width/2,y:b.y-2},{x:b.x+b.width/2,y:b.y+b.height+2}];}
