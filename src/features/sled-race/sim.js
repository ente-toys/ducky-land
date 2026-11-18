// The sled race: pure and deterministic, run by the server for every racer and by each client for its own
// racer (prediction). Racers slide downhill on their own; players only steer and tuck.
import {SLED} from './rules.js';
import {HAZARDS,laneX} from './course.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const toward=(v,target,step)=>v<target?Math.min(target,v+step):Math.max(target,v-step);
export const NO_INPUT=Object.freeze({steer:0,tuck:false});

export function createRacer({id,name,bot=false,style=null,colour=0,x=0}){
  return {id,name,bot,style,colour,d:0,x,vx:0,v:0,target:null,tuck:false,crashUntil:-1,boostUntil:-1,airUntil:-1,airborne:false,slip:0,
    finishedAt:null,place:null,jumpReadyAt:-1,jumpHeld:false,crashes:0,iceHits:0,lastHazard:-1,lastIce:-1,lastRamp:-1,hazardIndex:0};
}

// The speed a racer is heading for this tick, before crashes: warm-up, tuck, ice, slipstream and catch-up.
function targetSpeed(r,time,leaderD){
  const warm=SLED.startSpeed+(SLED.cruiseSpeed-SLED.startSpeed)*clamp(time/SLED.rampUpSeconds,0,1);
  let lift=1;
  if(r.tuck)lift+=SLED.tuckSpeed;
  if(time<r.boostUntil)lift+=SLED.boostSpeed;
  if(r.slip>=SLED.slipDelay)lift+=SLED.slipSpeed;
  if(leaderD-r.d>SLED.catchUpGap*SLED.cruiseSpeed)lift+=SLED.catchUpSpeed;
  return warm*lift;
}

// One racer, one tick. Input is {steer, tuck, jump}: a jump press hops over whatever is ahead (SLED.jumpSeconds in
// the air, then SLED.hopCooldown before the next). `others` (for slipstream) and `leaderD` (for catch-up) come from the race; a client
// predicting only itself passes what it last heard. Returns the events this tick caused.
export function stepRacer(r,input,dt,course,time,others=[],leaderD=r.d){
  const events=[];
  if(r.finishedAt!==null){r.v=toward(r.v,SLED.startSpeed*.5,8*dt);r.vx=toward(r.vx,0,SLED.steerFriction*dt);r.d+=r.v*dt;r.x+=r.vx*dt;return events;}
  const crashed=time<r.crashUntil;
  r.tuck=!crashed&&Boolean(input.tuck);
  // slipstream: close behind another racer, nearly in line
  const drafting=!crashed&&others.some(o=>o!==r&&o.finishedAt===null&&time>=o.crashUntil&&o.d-r.d>.3&&o.d-r.d<SLED.slipDistance&&Math.abs(o.x-r.x)<SLED.slipWidth);
  r.slip=drafting?r.slip+dt:0;
  if(crashed){r.v=0;r.vx=0;}
  else{
    const target=r.target=targetSpeed(r,time,leaderD);
    if(r.v===0&&r.crashUntil>0)r.v=target*SLED.crashResume;
    // a quick push off the line, a sharp kick on ice, otherwise a steady build (about a second back from a crash)
    const accel=time<1?20:time<r.boostUntil?16:r.v>target?8:(1-SLED.crashResume)*SLED.cruiseSpeed/SLED.recoverSeconds*1.4;
    r.v=toward(r.v,target,accel*dt);
    const air=time<r.airUntil,steer=clamp(Number(input.steer)||0,-1,1)*(air?.4:1);
    const want=steer*SLED.steerSpeed*(r.tuck?SLED.tuckSteer:1);
    r.vx=steer?toward(r.vx,want,SLED.steerAccel*dt):toward(r.vx,0,SLED.steerFriction*dt);
  }
  // a hop: on the press, from the ground, once rested
  const press=Boolean(input.jump)&&!r.jumpHeld;r.jumpHeld=Boolean(input.jump);
  if(press&&!crashed&&!(time<r.airUntil)&&time>=r.jumpReadyAt){r.airUntil=time+SLED.jumpSeconds;r.airborne=true;r.jumpReadyAt=time+SLED.jumpSeconds+SLED.hopCooldown;events.push({type:'jump',id:r.id});}
  // racers ride along the track's bends on their own; steering moves them across it
  const fromD=r.d;r.d+=r.v*dt;r.x+=r.vx*dt+course.centre(r.d)-course.centre(fromD);
  // the edges bump you back onto the track and cost a little speed; a fork's divider pushes back too
  const centre=course.centre(r.d),rel=r.x-centre,edge=course.half-SLED.racerRadius;
  if(Math.abs(rel)>edge){r.x=centre+Math.sign(rel)*edge;r.vx=-Math.sign(rel)*Math.max(SLED.bankBounce,Math.abs(r.vx)*.3);r.v=Math.min(r.v,(r.target??SLED.cruiseSpeed)*SLED.bankSpeed);}
  const fork=course.forkAt(r.d);
  if(fork){
    const side=Math.sign(r.x-course.centre(fromD))||1,inner=.6+SLED.racerRadius,now=r.x-centre;
    if(Math.abs(now)<inner||Math.sign(now)!==side){r.x=centre+side*inner;r.vx=0;}
  }
  // jumps
  const air=time<r.airUntil;
  if(r.airborne&&!air){
    r.airborne=false;
    if(Math.abs(r.vx)>SLED.landSideSpeed){r.v*=1-SLED.landLoss;events.push({type:'land',id:r.id,clean:false});}
    else events.push({type:'land',id:r.id,clean:true});
  }
  for(let i=r.lastRamp+1;i<course.ramps.length&&course.ramps[i].d<=r.d;i++){
    r.lastRamp=i;
    if(course.ramps[i].d>fromD&&!crashed){r.airUntil=time+SLED.jumpSeconds;r.airborne=true;events.push({type:'jump',id:r.id});}
  }
  const relNow=r.x-course.centre(r.d);
  // hazards (sorted by d): look only at those around this racer
  if(!crashed&&!(time<r.airUntil)){
    while(r.hazardIndex<course.hazards.length&&course.hazards[r.hazardIndex].d<r.d-2)r.hazardIndex++;
    for(let i=r.hazardIndex;i<course.hazards.length&&course.hazards[i].d<r.d+2;i++){
      const h=course.hazards[i],size=HAZARDS[h.kind];
      if(i===r.lastHazard)continue;
      if(Math.abs(h.d-r.d)<size.len/2+SLED.racerRadius&&Math.abs(relNow-h.x)<size.w+SLED.racerRadius){
        r.lastHazard=i;r.crashUntil=time+SLED.crashSeconds;r.crashes++;r.v=0;r.vx=0;r.tuck=false;r.slip=0;
        events.push({type:'crash',id:r.id,kind:h.kind,d:h.d,x:h.x});
        // the racer comes to rest just below what it hit, and below anything else touching that spot, so the
        // restart is clear and a crowded row can't catch it twice
        r.d=h.d+size.len/2+SLED.racerRadius+.05;
        for(let k=i+1;k<course.hazards.length&&course.hazards[k].d<r.d+2;k++){
          const n=course.hazards[k],ns=HAZARDS[n.kind];
          if(Math.abs(n.d-r.d)<ns.len/2+SLED.racerRadius&&Math.abs(relNow-n.x)<ns.w+SLED.racerRadius){r.d=n.d+ns.len/2+SLED.racerRadius+.05;r.lastHazard=k;}
        }
        r.x=course.centre(r.d)+relNow;break;
      }
    }
  }
  // ice: each patch adds boost time once (time stacks, speed does not)
  if(!(time<r.airUntil))for(let i=Math.max(0,r.lastIce+1);i<course.ice.length&&course.ice[i].d0<=r.d;i++){
    const p=course.ice[i];
    if(r.d<=p.d1&&relNow>=p.x0&&relNow<=p.x1){r.lastIce=i;r.boostUntil=Math.max(r.boostUntil,time)+SLED.boostSeconds;r.iceHits++;events.push({type:'boost',id:r.id});}
  }
  return events;
}

// A race: racers start in a row across the top, one to a lane (centred when there are fewer racers than lanes),
// and slide to course.length.
export function createSledRace({course,racers,bots=null}){
  const first=Math.max(0,Math.floor((SLED.lanes-racers.length)/2));
  const list=racers.map((r,i)=>createRacer({...r,x:course.centre(0)+laneX(Math.min(SLED.lanes-1,first+i))}));
  const byId=new Map(list.map(r=>[r.id,r]));
  const state={time:0,tick:0,racers:list,winnerAt:null,done:false,finished:0,events:[]};
  const inputs=new Map(),seen=new Map();
  function input(id,{steer=0,tuck=false,jump=false}={}){
    if(!byId.has(id))return false;
    inputs.set(id,{steer:clamp(Number(steer)||0,-1,1),tuck:Boolean(tuck),jump:Boolean(jump)});seen.set(id,state.time);return true;
  }
  function place(r){r.place=++state.finished;if(state.winnerAt===null)state.winnerAt=state.time;state.events.push({type:'finish',id:r.id,place:r.place,time:r.finishedAt});}
  function step(dt){
    if(state.done)return;
    dt=Math.min(dt,.05);state.time+=dt;state.tick++;
    const leaderD=Math.max(...list.map(r=>r.d));
    for(const r of list){
      if(r.retired)continue;
      let command=NO_INPUT;
      if(r.bot)command=bots?.(r,state)??NO_INPUT;
      else if(inputs.has(r.id)&&state.time-(seen.get(r.id)??-Infinity)<=SLED.inputTimeout)command=inputs.get(r.id);
      state.events.push(...stepRacer(r,command,dt,course,state.time,list,leaderD));
      if(r.finishedAt===null&&r.d>=course.length){r.finishedAt=state.time;place(r);}
    }
    // remembered for the comeback medal: last on the hill once the start has spread out
    if(state.time>8){const last=list.reduce((a,b)=>b.finishedAt===null&&(a.finishedAt!==null||b.d<a.d)?b:a);if(last.finishedAt===null)last.wasLast=true;}
    // SLED.finishGrace after the winner, everyone still sliding is placed where they are
    const grace=state.winnerAt!==null&&state.time-state.winnerAt>=SLED.finishGrace;
    if(grace)for(const r of [...list].filter(r=>r.finishedAt===null&&!r.retired).sort((a,b)=>b.d-a.d)){r.finishedAt=state.time;r.dnf=true;place(r);}
    // once everyone still racing is placed, anyone who left comes last
    if(list.every(r=>r.place!==null||r.retired)){for(const r of list.filter(r=>r.place===null)){r.finishedAt=state.time;place(r);}state.done=true;}
  }
  // a racer who leaves mid-race stops where it is and is placed last as not finished
  function retire(id){const r=byId.get(id);if(!r||r.place!==null)return false;r.retired=true;r.dnf=true;r.v=r.vx=0;return true;}
  const standings=()=>[...list].sort((a,b)=>(a.place??Infinity)-(b.place??Infinity)||b.d-a.d);
  const drainEvents=()=>state.events.splice(0);
  return {state,course,input,step,retire,standings,drainEvents,racer:id=>byId.get(id)};
}
