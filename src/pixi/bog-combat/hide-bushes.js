import art from '../../../public/pixi-art/themes/bog-arena/art.json' with {type:'json'};
import fallback from './hide-bushes.json' with {type:'json'};

export const BUSH_REVEAL_SECONDS=2;

export function buildHideBushes(manifest,temporary=fallback){
  const marked=manifest.props.filter(p=>p.hideBush===true);
  const records=marked.length?marked.map(p=>({id:p.id,x:p.x,y:p.y,
    radius:p.hideRadius??Math.max(24,Math.min(p.width*.42,p.height*.55)*(p.scale??1)),
  })):temporary;
  return Object.freeze(records.map(b=>{
    if(typeof b.id!=='string'||!b.id||![b.x,b.y,b.radius].every(Number.isFinite)||b.radius<=0)throw new Error('Invalid Bog hide-bush');
    return Object.freeze({id:b.id,x:b.x,y:b.y,radius:b.radius});
  }));
}
export const HIDE_BUSHES=buildHideBushes(art);
export function hideBushAt(p,bushes=HIDE_BUSHES){
  let found=null;
  for(const bush of bushes)if((p.x-bush.x)**2+(p.y-bush.y)**2<=bush.radius*bush.radius){
    if(bush.id===p.bushId)return bush;
    found??=bush;
  }
  return found;
}
export const isBushHidden=(p,time)=>!!(p?.alive&&p.bushId&&!(p.bushRevealUntil>time));
export const isCombatHidden=(p,time)=>!!(p?.alive&&(p.shieldUntil>time||isBushHidden(p,time)));

export function updateBushPresence(p,time,bushes=HIDE_BUSHES){
  const id=p.alive?hideBushAt(p,bushes)?.id??null:null;
  if(id&&id!==p.bushId){p.bushEntry=(p.bushEntry??0)+1;p.bushEnteredAt=time;}
  p.bushId=id;
}
