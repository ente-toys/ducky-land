import {DUCK_LENGTH as D} from './rules.js';

export const MEDALS=Object.freeze([
  {id:'first-splat',name:'First Splat',detail:'Tag your first opponent.'},
  {id:'double-splat',name:'Double Splat',detail:'Tag two opponents within four seconds.'},
  {id:'ace',name:'Ace',detail:'Tag five opponents in one life.'},
  {id:'clutch',name:'Clutch',detail:'Tag an opponent as the last living duck against two or more.'},
  {id:'mvp',name:'MVP',detail:'Earn 25 lifetime tags.'},
  {id:'sharpshooter',name:'Sharpshooter',detail:'Land a paint tag from at least eight duck lengths.'},
  {id:'cauldron-saver',name:'Cauldron Saver',detail:'Tag an opponent in the cauldron courtyard.'},
  {id:'comeback',name:'Comeback',detail:'Tag the duck who last tagged you.'},
]);
export function cleanMedalCase(value){return Object.fromEntries(MEDALS.filter(m=>value?.[m.id]===true).map(m=>[m.id,true]));}
export function tagMedals({owner,victim,players,time,distance,scores,inBonusZone=false}){
  const live=[...players].filter(p=>!p.bot&&(p.alive||p.id===victim.id));
  const friends=live.filter(p=>p.team===owner.team).length,enemies=live.filter(p=>p.team!==owner.team).length;
  const conditions={
    'first-splat':owner.stats.tags>=1,
    'double-splat':time-owner.lastTagAt<=4,
    ace:owner.streak>=5,
    clutch:friends===1&&enemies>=2,
    mvp:owner.stats.tags>=25,
    sharpshooter:distance>=8*D,
    'cauldron-saver':inBonusZone,
    comeback:owner.comebackReady&&owner.lastTaggedBy===victim.id,
  };
  const earned=MEDALS.filter(m=>conditions[m.id]&&!owner.medalCase[m.id]).map(m=>m.id);
  for(const id of earned)owner.medalCase[id]=true;
  owner.lastTagAt=time;owner.comebackReady=false;
  return earned;
}
