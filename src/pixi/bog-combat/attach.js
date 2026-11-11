import {AlphaFilter} from 'pixi.js';
import {BogCombatRoom} from './room.js';
import {getBogBlockers} from './blockers.js';
import {attachGunC,loadGunC} from './held-gun.js';
import {createCombatEffects,createTeamMarker} from './effects.js';
import {bindCombatInput} from './input.js';
import {createKnockout,loadKnockoutArt} from './knockout.js';
import {TILT} from '../camera.js';
import {createBotPoofs} from './bot-poof.js';
import {loadPickupArt,createPickupsView,createAbilityView} from './pickups-view.js';
import {createBogFeel} from './feel.js';
import {createBogSounds} from './sounds.js';

// Call after choosing a team, on an already-mounted Home-system Bog island.
// No RAF, application, camera, map, player rig or movement listener is created.
export async function attachBogCombat(engine,{onLeave=()=>{},onSnapshot=()=>{},onStatus=()=>{},loadGun=loadGunC,loadGhosts=loadKnockoutArt,loadPickups=loadPickupArt,signal,Room=BogCombatRoom,blockers=getBogBlockers(),navigation=engine.room?.navHere()??engine.sim?.nav,...options}={}) {
  if(import.meta.env?.DEV&&engine.bogCombat?.room.demoSpectator)engine.bogCombat.leave(false);
  if(engine.bogCombat)throw new Error('Bog combat is already attached');
  if(!engine.canvas||!engine.objects||!navigation)throw new Error('Mount the Bog island before attaching combat');
  const [guns,ghostArt,pickupArt]=await Promise.all([loadGun(),loadGhosts(),loadPickups()]);
  signal?.throwIfAborted();
  if(engine.disposed)throw new Error('The island was disposed while loading Gun C');
  if(engine.bogCombat)throw new Error('Bog combat is already attached');
  const previousRoom=engine.room,render=engine.renderLiveDucks,disposeEngine=engine.dispose;
  const attachments=new Map();let disposed=false,lastTotals=null;
  engine.stopInput();
  const room=new Room({...options,islandId:options.islandId??engine.islandId,blockers,navigation,onStatus,onExit:()=>{leave(false);onLeave({...lastTotals,out:true});},onSnapshot:(snapshot,self)=>{
    if(self)lastTotals={stats:{...self.stats},medalCase:{...self.medalCase}};
    onSnapshot(snapshot,self);
  }});
  const effects=createCombatEffects(engine.objects,{blockers,tilt:TILT,muzzleFor:id=>attachments.get(id)?.gun.muzzle()});
  const botPoofs=createBotPoofs(engine.dust);
  const pickups=createPickupsView(engine.objects,pickupArt,{tilt:TILT});
  const playSound=createBogSounds(engine.audio),feel=createBogFeel(engine,{playSound});
  engine.room=room;engine.follow=true;engine.fitMode=false;
  const layer={room,leave,playSound};engine.bogCombat=layer;
  const unbind=bindCombatInput(engine.canvas,{onFire:fire=>{room.setFire(fire);if(fire)engine.audio?.unlock();},onDodge:()=>room.dodge(),onLeave:leave});
  engine.renderLiveDucks=function(poses,dt,time,reducedMotion,visible) {
    feel.beginFrame(reducedMotion);
    render.call(this,poses,dt,time,reducedMotion,visible);
    // An offline island may already have a locally-rendered player. Its existing
    // rig resumes automatically after leaving; only the combat participant draws.
    this.rigs?.forEach((rig,i)=>{if(this.localDucks?.[i]?.player)rig.root.visible=false;});
    const ids=new Set(poses.map(p=>p.id));
    for(const [id,entry]of attachments)if(!ids.has(id)||this.liveRigs.get(id)?.rig!==entry.rig){entry.gun.dispose();entry.marker.dispose();entry.knockout.dispose();entry.ability.dispose();attachments.delete(id);}
    const snapshot=room.client.snapshot;
    if(snapshot)botPoofs(snapshot,reducedMotion);
    if(snapshot)feel.observe(snapshot,room.client.self);
    const combatTime=snapshot?snapshot.time+Math.min(.1,Math.max(0,(performance.now()-room.client.receivedAt)/1000)):0;
    for(const pose of poses){
      const rig=this.liveRigs.get(pose.id)?.rig;if(!rig)continue;
      let entry=attachments.get(pose.id);
      if(!entry){entry={rig,ability:createAbilityView(this.objects,rig,{tilt:TILT}),gun:attachGunC(rig,guns,pose.team,this.objects),marker:createTeamMarker(this.objects,pose,{tilt:TILT}),knockout:createKnockout(this.objects,rig,{tilt:TILT,art:ghostArt})};attachments.set(pose.id,entry);}
      rig.showRing?.(false);
      // Hidden ducks fade as ONE layer (boss 11 Nov): per-part alpha let the
      // overlapping body, wing and outline show through each other and look muddy.
      const hidden=pose.alive&&pose.shieldUntil>combatTime;rig.root.alpha=1;
      if(hidden){rig.hiddenFade??=new AlphaFilter({alpha:.7});if(rig.root.filters?.[0]!==rig.hiddenFade)rig.root.filters=[rig.hiddenFade];}
      else if(rig.root.filters)rig.root.filters=null;
      entry.knockout.update(pose,combatTime,snapshot,reducedMotion);
      entry.ability.update(pose,combatTime,reducedMotion);
      entry.gun.update(pose);entry.marker.update(pose,rig,combatTime);
      feel.flashTarget(pose.id,rig,entry.knockout);
    }
    if(snapshot){pickups.update(snapshot,combatTime,reducedMotion);if(room.fire&&effects.trigger(room.player,combatTime))playSound('shot');effects.update(snapshot,combatTime,{self:room.player,reducedMotion});}
    else effects.update({time:0,shots:[],splats:[]});
  };
  engine.dispose=function(...args){leave(false);return disposeEngine.apply(this,args);};
  function leave(notify=true) {
    if(disposed)return lastTotals;disposed=true;
    unbind();room.dispose();effects.dispose();pickups.dispose();feel.dispose();
    for(const {gun,marker,knockout,ability}of attachments.values()){gun.dispose();marker.dispose();knockout.dispose();ability.dispose();}attachments.clear();
    // Offline island ticks do not call renderLiveDucks. Remove these rigs now,
    // including pending rig loads, rather than leaving frozen combat ghosts.
    for(const [id,entry]of engine.liveRigs??[]){
      entry.rig?.dispose();entry.nameplate?.remove();entry.seatMask?.destroy();
      engine.liveRigs.delete(id);engine.removeChat?.(id);
    }
    engine.renderLiveDucks=render;engine.dispose=disposeEngine;
    if(engine.room===room)engine.room=previousRoom;
    if(engine.bogCombat===layer)delete engine.bogCombat;
    engine.stopInput();
    if(notify)onLeave(lastTotals);
    return lastTotals;
  }
  return layer;
}
