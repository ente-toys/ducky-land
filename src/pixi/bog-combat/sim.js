import {walkStep,playEmote,separateActors} from '../player-motion.js';
import {movementFacing,facingVector} from './facing.js';
import {getBogBlockers} from './blockers.js';
import {BOG_COMBAT} from './config.js';
import {DUCK_RADIUS,traceShot,prepareShotIndex,navigationFor,walkingActor} from './physics.js';
import {RULES,TEAMS,emptyStats} from './rules.js';
import {cleanMedalCase,tagMedals} from './medals.js';

const idle=()=>({x:0,y:0,ax:1,ay:0,fire:false});
const unit=(x,y)=>{const n=Math.hypot(x,y);return n>0?{x:x/n,y:y/n}:{x:0,y:0};};
export const spawnPads=team=>BOG_COMBAT.pads(team);
// Earliest segment/circle contact, rather than testing the endpoint, prevents
// a fast paintball crossing a duck between server ticks without tagging it.
export function circleHit(from,to,centre,radius){
  const dx=to.x-from.x,dy=to.y-from.y,fx=from.x-centre.x,fy=from.y-centre.y;
  const a=dx*dx+dy*dy,c=fx*fx+fy*fy-radius*radius;if(c<=0)return 0;if(!a)return null;
  const b=2*(fx*dx+fy*dy),disc=b*b-4*a*c;if(disc<0)return null;
  const t=(-b-Math.sqrt(disc))/(2*a);return t>=0&&t<=1?t:null;
}
export function createBogCombat({blockers=getBogBlockers(),bounds=BOG_COMBAT.bounds,pads=spawnPads,navigation=blockers===getBogBlockers()&&bounds===BOG_COMBAT.bounds?BOG_COMBAT.navigation:navigationFor(blockers,bounds),onStats=()=>{},isBonusZone=()=>false}={}){
  // The island's existing navigation object is shared with walkStep. Combat does
  // not own a map, transform controls, change speeds, or add a movement controller.
  const movementNav=navigation,living=[];prepareShotIndex(blockers);
  const state={time:0,tick:0,players:new Map(),shots:[],splats:[],scores:{privacy:0,google:0},practice:false,events:[]};
  const nextBase={privacy:0,google:0};
  let nextEvent=0,nextShot=0,nextSplat=0;
  const save=p=>{if(!p.bot)onStats(p.profile,{...p.stats},{...p.medalCase});};
  function spawn(p){
    const choices=pads(p.team);
    if(!choices?.length)throw new Error(`Missing Bog spawn pads for ${p.team}`);
    const start=choices[p.spawns++%choices.length];
    if(!Number.isFinite(start.x)||!Number.isFinite(start.y)||!movementNav.walkable(start.x,start.y))throw new Error(`Bog spawn pad is not walkable: ${start.base??p.team}`);
    Object.assign(p,walkingActor({...start,path:[],heading:null,pace:0,action:0,travel:0,jumpLeft:0}));
    p.facing=movementFacing({x:(bounds.x0??0)+bounds.width/2-p.x,y:(bounds.y0??0)+bounds.height/2-p.y},0);const facing=facingVector(p.facing);p.ax=facing.x;p.ay=facing.y;
    p.alive=true;p.ammo=RULES.ammoCapacity;p.reloadAt=0;p.respawnAt=0;p.shieldUntil=state.time+RULES.spawnShield;p.survival=0;p.input={...idle(),ax:facing.x,ay:facing.y};p.turn=Math.atan2(facing.x,facing.y);
  }
  function add({id,team,name='Ducky',profile=id,stats=emptyStats(),medalCase={}}){
    if(!TEAMS.includes(team)||state.players.has(id))return null;
    const p={id,team,name,profile,bot:false,stats:{...emptyStats(),...stats},medalCase:cleanMedalCase(medalCase),lastTagAt:-Infinity,comebackReady:false,streak:0,spawns:nextBase[team]++,nextFire:0,seq:-1,inputAt:state.time,turn:0,action:0};
    spawn(p);state.players.set(id,p);return p;
  }
  function join(options){
    if(options.profile&&[...state.players.values()].some(p=>p.profile===options.profile))return null;
    return add(options);
  }
  function leave(id){const p=state.players.get(id);if(!p)return;save(p);state.players.delete(id);state.shots=state.shots.filter(s=>s.owner!==id);}
  function input(id,m){
    const p=state.players.get(id);if(!m||!p||!Number.isSafeInteger(m.seq)||m.seq<=p.seq||![m.x,m.y].every(Number.isFinite)||typeof m.fire!=='boolean')return false;
    if(Math.max(Math.abs(m.x),Math.abs(m.y),Math.abs(m.facing??0))>1e6)return false;
    if(m.facing!==undefined&&!Number.isFinite(m.facing))return false;
    // Old direction packets remain accepted during local preview upgrades, but
    // cannot aim the weapon: only movement changes the authoritative facing.
    if((m.ax!==undefined&&!Number.isFinite(m.ax))||(m.ay!==undefined&&!Number.isFinite(m.ay)))return false;
    const v=unit(m.x,m.y);p.seq=m.seq;p.inputAt=state.time;
    if(!p.alive){p.input=idle();return true;}
    p.facing=movementFacing(v,p.facing??0);const aim=facingVector(p.facing);
    p.input={...v,run:m.run===true,ax:aim.x,ay:aim.y,fire:m.fire};
    if(Number.isInteger(m.emote)&&m.emote>=2&&m.emote<=9)playEmote(p,m.emote,state.time);
    return true;
  }
  function splat(shot,point,kind='floor',victim=null){
    state.splats.push({id:++nextSplat,x:point.x,y:point.y,team:shot.team,colour:shot.colour,kind,victim,born:state.time,expires:state.time+RULES.splatSeconds});
    if(state.splats.length>RULES.maxSplats)state.splats.shift();
  }
  function tag(shot,p,point){
    p.comebackReady=true;p.alive=false;p.pace=0;p.heading=null;p.path=[];p.travel=0;p.respawnAt=state.time+RULES.respawnDelay;p.input=idle();p.action=0;p.streak=0;
    const owner=state.players.get(shot.owner);state.scores[shot.team]+=RULES.tagPoints;
    let medals=[];
    if(owner){owner.stats.tags++;owner.stats.score+=RULES.tagScore;owner.stats.medals++;owner.streak++;owner.stats.bestStreak=Math.max(owner.stats.bestStreak,owner.streak);
      medals=tagMedals({owner,victim:p,players:state.players.values(),time:state.time,distance:RULES.range-shot.left+Math.hypot(point.x-shot.x,point.y-shot.y),scores:state.scores,inBonusZone:isBonusZone(p)});save(owner);}
    state.events.push({id:++nextEvent,time:state.time,actor:owner?.name||'Ducky',actorId:shot.owner,victim:p.name,team:shot.team,medals});
    if(state.events.length>6)state.events.shift();
    save(p);splat(shot,point,'tag',p.id);
  }
  function fire(p){
    if(p.ammo===0&&state.time>=p.reloadAt){p.ammo=RULES.ammoCapacity;p.reloadAt=0;}
    if(!p.input.fire||p.ammo===0||state.time<p.nextFire||state.shots.length>=RULES.maxShots)return;
    p.ammo--;if(p.ammo===0)p.reloadAt=state.time+RULES.reloadSeconds;
    p.nextFire=state.time+RULES.fireDelay;p.shieldUntil=state.time;
    const id=++nextShot;
    state.shots.push({id,owner:p.id,team:p.team,bot:p.bot,x:p.x,y:p.y,dx:p.input.ax,dy:p.input.ay,left:RULES.range,colour:p.team==='privacy'?0:(id%4)});
  }
  function step(dt){
    if(!Number.isFinite(dt)||dt<=0)return;
    dt=Math.min(dt,.05);state.time+=dt;state.tick++;
    for(const p of state.players.values()){
      if(!p.alive){if(state.time>=p.respawnAt)spawn(p);continue;}
      if(state.time-p.inputAt>RULES.inputTimeout)p.input={...p.input,x:0,y:0,fire:false};
      walkStep(p,movementNav,dt,state.time,p.input);
      p.ax=p.input.ax;p.ay=p.input.ay;
      if(p.inputAt>state.time-RULES.inputTimeout){p.survival+=dt;if(p.survival>=RULES.surviveSeconds){p.stats.survives++;p.survival-=RULES.surviveSeconds;save(p);}}
      fire(p);
    }
    living.length=0;for(const p of state.players.values())if(p.alive)living.push(p);separateActors(living,movementNav,dt);
    const remaining=[];
    for(const s of state.shots){
      const distance=Math.min(s.left,RULES.shotSpeed*dt),to={x:s.x+s.dx*distance,y:s.y+s.dy*distance};
      const wall=traceShot(s,to,blockers);let fraction=wall.fraction,victim=null;
      for(const p of state.players.values())if(p.alive&&p.team!==s.team&&p.shieldUntil<=state.time){
        const t=circleHit(s,to,p,DUCK_RADIUS+RULES.shotRadius);if(t!==null&&t<fraction){fraction=t;victim=p;}
      }
      const point={x:s.x+(to.x-s.x)*fraction,y:s.y+(to.y-s.y)*fraction};
      if(victim)tag(s,victim,point);
      else if(wall.blocker)splat(s,wall.point,'wall');
      else if(s.left-distance<=.001)splat(s,to);
      else {Object.assign(s,to);s.left-=distance;remaining.push(s);}
    }
    state.shots=remaining;state.splats=state.splats.filter(s=>s.expires>state.time);state.events=state.events.filter(e=>state.time-e.time<8);
  }
  function snapshot(){return {type:'arena-snapshot',tick:state.tick,time:state.time,practice:state.practice,events:structuredClone(state.events),scores:{...state.scores},
    players:[...state.players.values()].map(p=>({id:p.id,name:p.name,team:p.team,x:p.x,y:p.y,ax:p.ax??1,ay:p.ay??0,action:p.action,travel:p.travel,pace:p.pace,heading:p.heading?[...p.heading]:null,turn:p.turn,facing:p.facing??0,until:p.until,emoteVersion:p.emoteVersion,alive:p.alive,bot:p.bot,respawnAt:p.respawnAt,shieldUntil:p.shieldUntil,ack:p.seq,streak:p.streak,ammo:p.ammo,reloadAt:p.reloadAt,medalCase:{...p.medalCase},stats:{...p.stats}})),
    shots:state.shots.map(s=>({...s})),splats:state.splats.map(s=>({...s}))};}
  return {state,join,leave,input,step,snapshot};
}

// Transport name retained for compatibility with the working arena protocol.
export const createArena=createBogCombat;
