import {playEmote,separateActors} from '../../gameplay/player-motion.js';
import {movementFacing,facingVector} from './facing.js';
import {getBogBlockers} from './blockers.js';
import {BOG_COMBAT} from './config.js';
import {DUCK_RADIUS,traceShot,prepareShotIndex,navigationFor,walkingActor} from './physics.js';
import {RULES,TEAMS,emptyStats} from './rules.js';
import {assistShot,resetAbilities,combatWalkStep} from './mechanics.js';
import {createPickupSpots,collectPickups} from './pickups.js';
import {cleanMedalCase,tagMedals} from './medals.js';
import {HIDE_BUSHES,BUSH_REVEAL_SECONDS,updateBushPresence,isBushHidden,isCombatHidden} from './hide-bushes.js';

const idle=()=>({x:0,y:0,ax:1,ay:0,fire:false});
const unit=(x,y)=>{const n=Math.hypot(x,y);return n>0?{x:x/n,y:y/n}:{x:0,y:0};};
export const spawnPads=team=>BOG_COMBAT.pads(team);
export function circleHit(from,to,centre,radius){
  const dx=to.x-from.x,dy=to.y-from.y,fx=from.x-centre.x,fy=from.y-centre.y;
  const a=dx*dx+dy*dy,c=fx*fx+fy*fy-radius*radius;if(c<=0)return 0;if(!a)return null;
  const b=2*(fx*dx+fy*dy),disc=b*b-4*a*c;if(disc<0)return null;
  const t=(-b-Math.sqrt(disc))/(2*a);return t>=0&&t<=1?t:null;
}
export function createBogCombat({blockers=getBogBlockers(),bounds=BOG_COMBAT.bounds,pads=spawnPads,navigation=blockers===getBogBlockers()&&bounds===BOG_COMBAT.bounds?BOG_COMBAT.navigation:navigationFor(blockers,bounds),pickupSpots=null,hideBushes=HIDE_BUSHES,onStats=()=>{},onOut=()=>{},isBonusZone=()=>false}={}){
  const movementNav=navigation,living=[];prepareShotIndex(blockers);
  const shotSlots=Array.from({length:RULES.maxShots},()=>({})),shotPool=[...shotSlots],ownedShots=new WeakSet(shotSlots);
  const splatSlots=Array.from({length:RULES.maxSplats},()=>({})),splatPool=[...splatSlots];
  const to={x:0,y:0},point={x:0,y:0},wallResult={point:{x:0,y:0},fraction:1,blocker:null};
  const state={pickups:(pickupSpots??createPickupSpots(movementNav)).map(p=>({...p,readyAt:p.readyAt??0})),time:0,tick:0,players:new Map(),shots:[],splats:[],scores:{karma:0,evil:0},practice:false,events:[]};
  const nextBase={karma:0,evil:0};
  let nextEvent=0,nextShot=0,nextSplat=0;
  const save=p=>{if(!p.bot)onStats(p.profile,{...p.stats},{...p.medalCase});};
  function spawn(p){
    const choices=pads(p.team);
    if(!choices?.length)throw new Error(`Missing Bog spawn pads for ${p.team}`);
    const start=choices[p.spawns++%choices.length];
    if(!Number.isFinite(start.x)||!Number.isFinite(start.y)||!movementNav.walkable(start.x,start.y))throw new Error(`Bog spawn pad is not walkable: ${start.base??p.team}`);
    Object.assign(p,walkingActor({...start,path:[],heading:null,pace:0,action:0,travel:0,jumpLeft:0}));
    p.facing=movementFacing({x:(bounds.x0??0)+bounds.width/2-p.x,y:(bounds.y0??0)+bounds.height/2-p.y},0);const facing=facingVector(p.facing);p.ax=facing.x;p.ay=facing.y;
    resetAbilities(p);p.alive=true;p.ammo=RULES.ammoCapacity;p.reloadAt=0;p.respawnAt=0;p.shieldUntil=state.time+RULES.spawnShield;p.survival=0;p.input={...idle(),ax:facing.x,ay:facing.y};p.turn=Math.atan2(facing.x,facing.y);
    p.bushId=null;p.bushRevealUntil=0;updateBushPresence(p,state.time,hideBushes);
  }
  function add({id,team,name='Ducky',profile=id,stats=emptyStats(),medalCase={},lives=RULES.lives,karma=0,combat=null}){
    if(!TEAMS.includes(team)||state.players.has(id))return null;
    const p={id,team,name,profile,lives,karma,out:false,exited:false,bot:false,stats:{...emptyStats(),...stats},medalCase:cleanMedalCase(medalCase),lastTagAt:-Infinity,comebackReady:false,streak:0,spawns:nextBase[team]++,nextFire:0,seq:-1,inputAt:state.time,turn:0,action:0};
    spawn(p);
    if(combat){
      const {shieldLeft=0,respawnLeft=0,nextFireLeft=0,reloadLeft=0,dodgeLeft=0,dodgeProtectLeft=0,dodgeCooldownLeft=0,speedLeft=0,hitShieldLeft=0,bushRevealLeft=0,...saved}=combat;
      Object.assign(p,saved,{id,profile,name,team:combat.team??team,seq:-1,input:idle(),inputAt:state.time,
        dodgeUntil:state.time+dodgeLeft,dodgeProtectedUntil:state.time+dodgeProtectLeft,dodgeReadyAt:state.time+dodgeCooldownLeft,hitShieldUntil:state.time+hitShieldLeft,bushRevealUntil:state.time+bushRevealLeft,
        karma,stats:{...emptyStats(),...stats},medalCase:cleanMedalCase(medalCase),shieldUntil:state.time+shieldLeft,respawnAt:state.time+respawnLeft,nextFire:state.time+nextFireLeft,reloadAt:reloadLeft?state.time+reloadLeft:0});
      updateBushPresence(p,state.time,hideBushes);
    }
    state.players.set(id,p);return p;
  }
  function join(options){
    if(options.profile&&[...state.players.values()].some(p=>p.profile===options.profile))return null;
    return add(options);
  }
  function leave(id){const p=state.players.get(id);if(!p)return;save(p);state.players.delete(id);let kept=0;for(const shot of state.shots){if(shot.owner===id){if(ownedShots.has(shot))shotPool.push(shot);}else state.shots[kept++]=shot;}state.shots.length=kept;}
  function input(id,m){
    const p=state.players.get(id);if(!m||!p||!Number.isSafeInteger(m.seq)||m.seq<=p.seq||![m.x,m.y].every(Number.isFinite)||typeof m.fire!=='boolean')return false;
    if(Math.max(Math.abs(m.x),Math.abs(m.y),Math.abs(m.facing??0))>1e6)return false;
    if(m.facing!==undefined&&!Number.isFinite(m.facing))return false;
    if((m.ax!==undefined&&!Number.isFinite(m.ax))||(m.ay!==undefined&&!Number.isFinite(m.ay)))return false;
    if(m.dodge!==undefined&&(!Number.isSafeInteger(m.dodge)||m.dodge<0))return false;
    const v=unit(m.x,m.y);p.seq=m.seq;p.inputAt=state.time;
    if(!p.alive){p.dodgeSerial=Math.max(p.dodgeSerial,m.dodge??0);p.input=idle();return true;}
    if(m.dodge>p.dodgeSerial)p.dodgeQueued=Math.max(p.dodgeQueued,m.dodge);
    p.facing=movementFacing(v,p.facing??0);const aim=facingVector(p.facing);
    p.input={...v,run:m.run===true,ax:aim.x,ay:aim.y,fire:m.fire};
    if(Number.isInteger(m.emote)&&m.emote>=2&&m.emote<=9)playEmote(p,m.emote,state.time);
    return true;
  }
  function splat(shot,point,kind='floor',victim=null){
    if(state.splats.length>=RULES.maxSplats)splatPool.push(state.splats.shift());
    if(!splatPool.length)for(const slot of splatSlots)if(!state.splats.includes(slot))splatPool.push(slot);
    const mark=splatPool.pop();if(!mark)return;
    mark.id=++nextSplat;mark.x=point.x;mark.y=point.y;mark.team=shot.team;mark.colour=shot.colour;mark.kind=kind;mark.victim=victim;mark.born=state.time;mark.expires=state.time+RULES.splatSeconds;state.splats.push(mark);
  }
  function tag(shot,p,point){
    p.dodgeUntil=0;p.dodgeProtectedUntil=0;p.hitShield=0;p.hitShieldUntil=0;
    p.bushId=null;
    p.lives=Math.max(0,p.lives-1);p.out=p.lives===0;p.comebackReady=true;p.lastTaggedBy=shot.owner;p.alive=false;p.pace=0;p.heading=null;p.path=[];p.travel=0;p.respawnAt=state.time+RULES.respawnDelay;p.input=idle();p.action=0;p.streak=0;
    const owner=state.players.get(shot.owner);state.scores[shot.team]+=RULES.tagPoints;
    let medals=[];
    if(owner&&(owner.bot||!p.bot)){owner.stats.tags++;owner.stats.score+=RULES.tagScore;owner.streak++;owner.stats.bestStreak=Math.max(owner.stats.bestStreak,owner.streak);
      if(!owner.bot){owner.stats.medals++;
      medals=tagMedals({owner,victim:p,players:state.players.values(),time:state.time,distance:RULES.range-shot.left+Math.hypot(point.x-shot.x,point.y-shot.y),scores:state.scores,inBonusZone:isBonusZone(p)});save(owner);}
    }
    state.events.push({id:++nextEvent,time:state.time,actor:owner?.name||'Ducky',actorId:shot.owner,victim:p.name,victimId:p.id,team:shot.team,medals});
    if(state.events.length>6)state.events.shift();
    save(p);splat(shot,point,'tag',p.id);
  }
  function fire(p){
    if(p.ammo===0&&state.time>=p.reloadAt){p.ammo=RULES.ammoCapacity;p.reloadAt=0;}
    if(!p.input.fire||p.ammo===0||state.time<p.nextFire||state.shots.length>=RULES.maxShots)return;
    if(!shotPool.length)for(const slot of shotSlots)if(!state.shots.includes(slot))shotPool.push(slot);
    const shot=shotPool.pop();if(!shot)return;
    p.ammo--;if(p.ammo===0)p.reloadAt=state.time+RULES.reloadSeconds;
    p.nextFire=state.time+RULES.fireDelay;p.shieldUntil=state.time;
    p.bushRevealUntil=state.time+BUSH_REVEAL_SECONDS;
    const id=++nextShot;
    shot.id=id;shot.owner=p.id;shot.team=p.team;shot.bot=p.bot;shot.x=p.x;shot.y=p.y;shot.dx=p.input.ax;shot.dy=p.input.ay;shot.left=RULES.range;shot.colour=p.team==='karma'?0:id%4;
    assistShot(shot,p,state.players.values(),blockers,state.time);state.shots.push(shot);
  }
  function step(dt){
    if(!Number.isFinite(dt)||dt<=0)return;
    dt=Math.min(dt,.05);state.time+=dt;state.tick++;
    for(const p of state.players.values()){
      if(!p.alive){if(state.time>=p.respawnAt){if(p.out){if(!p.exited){p.exited=true;onOut(p);}}else spawn(p);}continue;}
      if(state.time-p.inputAt>RULES.inputTimeout){p.input.x=0;p.input.y=0;p.input.fire=false;}
      p.input.dodge=p.dodgeQueued;p.dodgeQueued=0;
      combatWalkStep(p,movementNav,dt,state.time,p.input);
      collectPickups(p,state.pickups,state.time);
      p.ax=p.input.ax;p.ay=p.input.ay;
      if(p.inputAt>state.time-RULES.inputTimeout){p.survival+=dt;if(p.survival>=RULES.surviveSeconds){p.stats.survives++;p.survival-=RULES.surviveSeconds;save(p);}}
    }
    living.length=0;for(const p of state.players.values())if(p.alive&&p.shieldUntil<=state.time)living.push(p);separateActors(living,movementNav,dt);
    for(const p of state.players.values())updateBushPresence(p,state.time,hideBushes);
    for(const p of state.players.values())if(p.alive)fire(p);
    let kept=0;
    for(const s of state.shots){
      const distance=Math.min(s.left,RULES.shotSpeed*dt);to.x=s.x+s.dx*distance;to.y=s.y+s.dy*distance;
      const wall=traceShot(s,to,blockers,wallResult);let fraction=wall.fraction,victim=null;
      for(const p of state.players.values())if(p.alive&&p.team!==s.team&&p.shieldUntil<=state.time&&p.dodgeProtectedUntil<=state.time){
        const t=circleHit(s,to,p,DUCK_RADIUS+RULES.shotRadius);if(t!==null&&t<fraction){fraction=t;victim=p;}
      }
      point.x=s.x+(to.x-s.x)*fraction;point.y=s.y+(to.y-s.y)*fraction;
      if(victim){if(victim.hitShield&&victim.hitShieldUntil>state.time){victim.hitShield=0;victim.hitShieldUntil=0;splat(s,point,'shield',victim.id);}else tag(s,victim,point);}
      else if(wall.blocker)splat(s,wall.point,'wall');
      else if(s.left-distance<=.001)splat(s,to);
      else {s.x=to.x;s.y=to.y;s.left-=distance;state.shots[kept++]=s;continue;}
      if(ownedShots.has(s))shotPool.push(s);
    }
    state.shots.length=kept;
    kept=0;for(const s of state.splats){if(s.expires>state.time)state.splats[kept++]=s;else splatPool.push(s);}state.splats.length=kept;
    kept=0;for(const e of state.events)if(state.time-e.time<8)state.events[kept++]=e;state.events.length=kept;
  }
  function snapshot(team=null){return {type:'arena-snapshot',tick:state.tick,time:state.time,practice:state.practice,pickups:state.pickups.map(p=>({...p})),events:structuredClone(state.events),scores:{...state.scores},
    players:[...state.players.values()].filter(p=>!team||p.team===team||!isCombatHidden(p,state.time)).map(p=>({id:p.id,name:p.name,team:p.team,x:p.x,y:p.y,ax:p.ax??1,ay:p.ay??0,action:p.action,travel:p.travel,pace:p.pace,heading:p.heading?[...p.heading]:null,turn:p.turn,facing:p.facing??0,until:p.until,emoteVersion:p.emoteVersion,alive:p.alive,dodgeUntil:p.dodgeUntil,dodgeProtectedUntil:p.dodgeProtectedUntil,dodgeReadyAt:p.dodgeReadyAt,dodgeX:p.dodgeX,dodgeY:p.dodgeY,dodgeSerial:p.dodgeSerial,hitShield:p.hitShield,hitShieldUntil:p.hitShieldUntil,karma:p.karma,lives:p.lives,out:p.out,bot:p.bot,respawnAt:p.respawnAt,shieldUntil:p.shieldUntil,bushId:p.bushId,bushHidden:isBushHidden(p,state.time),bushRevealUntil:p.bushRevealUntil,bushEntry:p.bushEntry??0,bushEnteredAt:p.bushEnteredAt,ack:p.seq,streak:p.streak,ammo:p.ammo,reloadAt:p.reloadAt,medalCase:{...p.medalCase},stats:{...p.stats}})),
    shots:state.shots.map(s=>({...s})),splats:state.splats.map(s=>({...s}))};}
  return {state,join,leave,input,step,snapshot};
}

export const createArena=createBogCombat;
