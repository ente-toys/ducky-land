import {BogCombatRoom} from './room.js';
import {getBogBlockers} from './blockers.js';
import {attachGunC,loadGunC} from './held-gun.js';
import {createCombatEffects,createTeamMarker} from './effects.js';
import {bindCombatInput} from './input.js';
import {TILT} from '../camera.js';

// Call after choosing a team, on an already-mounted Home-system Bog island.
// No RAF, application, camera, map, player rig or movement listener is created.
export async function attachBogCombat(engine,{onLeave=()=>{},onSnapshot=()=>{},onStatus=()=>{},loadGun=loadGunC,signal,blockers=getBogBlockers(),navigation=engine.room?.navHere()??engine.sim?.nav,...options}={}) {
  if(engine.bogCombat)throw new Error('Bog combat is already attached');
  if(!engine.canvas||!engine.objects||!navigation)throw new Error('Mount the Bog island before attaching combat');
  const guns=await loadGun();
  signal?.throwIfAborted();
  if(engine.disposed)throw new Error('The island was disposed while loading Gun C');
  if(engine.bogCombat)throw new Error('Bog combat is already attached');
  const previousRoom=engine.room,render=engine.renderLiveDucks,disposeEngine=engine.dispose;
  const attachments=new Map();let disposed=false,lastTotals=null;
  engine.stopInput();
  const room=new BogCombatRoom({...options,islandId:options.islandId??engine.islandId,blockers,navigation,onStatus,onSnapshot:(snapshot,self)=>{
    if(self)lastTotals={stats:{...self.stats},medalCase:{...self.medalCase}};
    onSnapshot(snapshot,self);
  }});
  const effects=createCombatEffects(engine.objects,{blockers,tilt:TILT,muzzleFor:id=>attachments.get(id)?.gun.muzzle()});
  engine.room=room;engine.follow=true;engine.fitMode=false;
  const layer={room,leave};engine.bogCombat=layer;
  const unbind=bindCombatInput(engine.canvas,{onFire:fire=>{room.setFire(fire);if(fire)engine.audio?.unlock();},onLeave:leave});
  engine.renderLiveDucks=function(poses,dt,time,reducedMotion,visible) {
    render.call(this,poses,dt,time,reducedMotion,visible);
    // An offline island may already have a locally-rendered player. Its existing
    // rig resumes automatically after leaving; only the combat participant draws.
    this.rigs?.forEach((rig,i)=>{if(this.localDucks?.[i]?.player)rig.root.visible=false;});
    const ids=new Set(poses.map(p=>p.id));
    for(const [id,entry]of attachments)if(!ids.has(id)||this.liveRigs.get(id)?.rig!==entry.rig){entry.gun.dispose();entry.marker.dispose();attachments.delete(id);}
    const snapshot=room.client.snapshot;
    const combatTime=snapshot?snapshot.time+Math.min(.1,Math.max(0,(performance.now()-room.client.receivedAt)/1000)):0;
    for(const pose of poses){
      const rig=this.liveRigs.get(pose.id)?.rig;if(!rig)continue;
      let entry=attachments.get(pose.id);
      if(!entry){entry={rig,gun:attachGunC(rig,guns,pose.team,this.objects),marker:createTeamMarker(this.objects,pose,{tilt:TILT})};attachments.set(pose.id,entry);}
      rig.showRing?.(false);rig.root.visible=rig.root.visible&&pose.alive;
      entry.gun.update(pose);entry.marker.update(pose,rig,combatTime);
    }
    if(snapshot){if(room.fire&&effects.trigger(room.player,combatTime))engine.audio?.play('pop',.055);effects.update(snapshot,combatTime,{self:room.player,reducedMotion});}
    else effects.update({time:0,shots:[],splats:[]});
  };
  engine.dispose=function(...args){leave(false);return disposeEngine.apply(this,args);};
  function leave(notify=true) {
    if(disposed)return lastTotals;disposed=true;
    unbind();room.dispose();effects.dispose();
    for(const {gun,marker}of attachments.values()){gun.dispose();marker.dispose();}attachments.clear();
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
