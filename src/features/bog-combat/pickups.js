import {BOG_AREAS} from './bog-environment.js';
import {RULES} from './rules.js';

export const PICKUP_KINDS=Object.freeze(['paint','shield']);
const anchors=[['mid','paint',BOG_AREAS.mid.x,BOG_AREAS.mid.y+110],
  ['site-a','paint',BOG_AREAS['site-a'].x+180,BOG_AREAS['site-a'].y+200],
  ['site-b','shield',BOG_AREAS['site-b'].x-180,BOG_AREAS['site-b'].y+200],
  ['west-lane','shield',3000,4400],['east-lane','paint',5400,2900]];
export function createPickupSpots(nav){
  const spots=[];
  for(const [id,kind,x,y]of anchors){
    let point=null;
    for(let r=0;r<=180&&!point;r+=30)for(let i=0;i<(r?16:1);i++){
      const a=i*Math.PI/8,px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;
      if(nav.walkable(px,py)){point={id,kind,x:px,y:py,readyAt:0};break;}
    }
    if(point)spots.push(point);
  }
  return spots;
}
export function collectPickups(p,spots,time){
  if(!p.alive)return;
  for(const spot of spots){
    if(spot.readyAt>time||(p.x-spot.x)**2+(p.y-spot.y)**2>RULES.pickupRadius**2)continue;
    if(spot.kind==='paint'){p.ammo=RULES.ammoCapacity;p.reloadAt=0;}
    else if(spot.kind==='shield'){p.hitShield=1;p.hitShieldUntil=time+RULES.hitShieldSeconds;}
    spot.readyAt=time+RULES.pickupRespawn;spot.collectedBy=p.id;
  }
}
