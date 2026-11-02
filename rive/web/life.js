export function installLife(game){
 const sound=new LocalSounds();game.sound=sound;
 const unlock=()=>sound.unlock().catch(console.error);
 addEventListener('pointerdown',unlock,{once:true});addEventListener('keydown',unlock,{once:true});
 const durations={2:1.3,3:6,4:1.5,5:1.55,6:1.55,7:2.3,8:1.5,9:1.75};
 let replay=null;
 game.emote=action=>{if(!durations[action]||!game.joined)return;game.player.path=[];
  if(action===3&&game.player.action===3){game.player.action=0;game.player.until=0;game.network?.emote(3);return;}
  if(game.player.action===action){game.player.action=0;game.player.until=game.now+.035;replay={action,at:game.now+.035};}else{game.player.action=action;game.player.until=game.now+durations[action];}
  game.player.targetTurn=game.frontTurn;game.network?.emote(action);sound.play(action===2?'quack':'pop',action===2?.15:.08);
 };
 let previous=0,foot=0;
 game.updateHooks.push((dt,now)=>{if(replay&&now>=replay.at){game.player.action=replay.action;game.player.until=now+durations[replay.action];replay=null;}const action=game.player.action;if(action!==previous){if(action===2)sound.play('quack',.15);else if(action>2)sound.play('pop',.06);previous=action;}if(action===1&&now-foot>.28){foot=now;sound.play('step',.045);}});
 addEventListener('keydown',e=>{if(!game.joined||game.inputLocked||e.repeat||e.target.closest?.('input,select,button,dialog'))return;const number=Number(e.key),action=[null,2,4,5,6,7,8,9][number];if(action){e.preventDefault();game.emote(action);}if(e.key.toLowerCase()==='m'){sound.muted=!sound.muted;const button=document.getElementById('sound-toggle');if(button)button.textContent=sound.muted?'Sound off':'Sound on';}});
 const ambient=game.file.artboardByName('Small Lives'),sm=ambient?new game.runtime.StateMachineInstance(ambient.stateMachineByName('Ambient'),ambient):null;
 if(ambient){ambient.frameOrigin=false;const item={name:'Small lives',x:2020,y:1780,scale:1,art:ambient,advance(dt){sm.advanceAndApply(matchMedia('(prefers-reduced-motion: reduce)').matches?dt*.35:dt);ambient.advance(dt);}};game.drawHooks.push(()=>[item]);}
 game.life={durations,ambient:!!ambient};
}
