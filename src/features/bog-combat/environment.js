import {normalizeBogBlockers} from './blockers.js';

export function combatForBogEnvironment({map,islandId},records,areas) {
  const navigation=map.nav(),blockers=normalizeBogBlockers(records);
  const bases={privacy:['privacy-nw','privacy-sw'],google:['google-ne','google-se']};
  const positions=Object.fromEntries(Object.entries(bases).map(([team,ids])=>[team,ids.map(base=>{
    const area=areas[base];if(!area)throw new Error(`Missing Bog base: ${base}`);
    const pad={x:area.x,y:area.y+240,base};
    if(!navigation.walkable(pad.x,pad.y))throw new Error(`Blocked Bog base pad: ${base}`);
    return Object.freeze(pad);
  })]));
  return {islandId,navigation,blockers,pads:team=>positions[team]??[],
    bounds:{x0:map.world.origin?.x??0,y0:map.world.origin?.y??0,width:map.width,height:map.height},
    isBonusZone:point=>areas['site-a']&&Math.hypot(point.x-areas['site-a'].x,point.y-areas['site-a'].y)<420,
  };
}
