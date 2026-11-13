import {createBotBrain,createBotController,resetBotBrain} from '../src/features/bog-combat/bot-brain.js';
import {isCombatHidden} from '../src/features/bog-combat/hide-bushes.js';

export const BOT_FILL=6;

export function createBogBots(arena,combat,options={}){
 const controller=createBotController(arena,combat,options);
 const slots=Array.from({length:BOT_FILL},(_,i)=>({id:`bog-bot-${i+1}`,name:`Bog Bot ${i+1}`,brain:createBotBrain(i)}));
 for(const slot of slots)controller.prepare(slot.brain);
 const departures=[];let serial=0;
 function remove(slot,poof=true){
  const p=arena.state.players.get(slot.id);if(!p?.bot)return;
  if(poof){departures.push({id:++serial,x:p.x,y:p.y,team:p.team,hidden:isCombatHidden(p,arena.state.time),time:arena.state.time});if(departures.length>BOT_FILL)departures.shift();}
  arena.leave(slot.id);resetBotBrain(slot.brain);
 }
 function replace(team){
  for(const slot of slots)if(arena.state.players.get(slot.id)?.team===team){remove(slot);return;}
 }
 function sync(active=true){
  if(!active){for(const slot of slots)remove(slot,false);departures.length=0;return;}
  let karma=0,evil=0;
  for(const p of arena.state.players.values())if(!p.bot){if(p.team==='karma')karma++;else evil++;}
  const count=Math.max(0,BOT_FILL-karma-evil),wantKarma=Math.max(0,Math.min(count,BOT_FILL/2-karma));
  let leftKarma=wantKarma,leftEvil=count-wantKarma;
  for(const slot of slots){
   const p=arena.state.players.get(slot.id);if(!p?.bot)continue;
   if(p.team==='karma'){if(leftKarma>0)leftKarma--;else remove(slot);}
   else {if(leftEvil>0)leftEvil--;else remove(slot);}
  }
  for(const slot of slots){
   if(!leftKarma&&!leftEvil)break;
   if(arena.state.players.has(slot.id))continue;
   const team=leftKarma>leftEvil?'karma':'evil';
   const p=arena.join({id:slot.id,name:slot.name,team});p.bot=true;
   resetBotBrain(slot.brain);slot.brain.reactAt=arena.state.time+Number(slot.id.slice(-1))*.04;
   if(team==='karma')leftKarma--;else leftEvil--;
  }
 }
 function step(){controller.step();for(const slot of slots){const p=arena.state.players.get(slot.id);if(p?.bot)controller.think(p,slot.brain);}}
 function visibleDepartures(team){return departures.filter(p=>arena.state.time-p.time<.6&&(!p.hidden||p.team===team));}
 return {sync,replace,step,visibleDepartures};
}
