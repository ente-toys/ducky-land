// The sled hill's game room: who is waiting, when the race starts, and the race itself. Pure and driven by the
// caller's clock (seconds), so the island room runs it on the server and the tests run it directly.
//   empty -> waiting -> countdown -> racing -> results -> empty
// A race starts once SLED.minHumans players are ready (after a short wait for more), at once when every seat is
// ready, or when the wait runs out with fewer: then bots fill the field to SLED.botFillTo.
import {SLED} from './rules.js';
import {buildCourse,seededRandom} from './course.js';
import {createSledRace} from './sim.js';
import {botRoster,createBotDrivers,nextSkill} from './bots.js';
import {randomOutfit} from '../../gameplay/outfits.js';

// every race rolls its own course
export const raceSeed=()=>Math.floor(Math.random()*2**31);

export function createSledLobby({seed=raceSeed,skill=.5}={}){
  const seats=new Map();
  let phase='empty',endsAt=0,race=null,course=null,racers=[],raceSkill=skill,lastStep=0,results=null,nextSeed=0;
  const humans=()=>[...seats.values()];
  const readyCount=()=>humans().filter(s=>s.ready).length;

  function join(id,{name='Ducky',outfit=null}={}){
    if(seats.has(id))return {ok:true};
    if(phase!=='empty'&&phase!=='waiting')return {ok:false,reason:'racing'};
    if(seats.size>=SLED.maxSeats)return {ok:false,reason:'full'};
    seats.set(id,{id,name:String(name).slice(0,24),outfit,ready:false});
    return {ok:true};
  }
  function ready(id,on=true){const s=seats.get(id);if(!s||phase!=='waiting'&&phase!=='empty')return false;s.ready=Boolean(on);return true;}
  function leave(id){
    seats.delete(id);
    if(phase==='racing'&&race)race.retire(id);
  }
  function input(id,command){return phase==='racing'&&race?race.input(id,command):false;}

  function startCountdown(now,seconds){
    // anyone who never readied up is sent back to the hill (SLED.idleKick)
    if(SLED.idleKick)for(const [id,s] of seats)if(!s.ready)seats.delete(id);
    nextSeed=seed()>>>0;
    const people=humans().map((s,i)=>({id:s.id,name:s.name,colour:i,outfit:s.outfit}));
    // bots only when there are too few people for a race
    const bots=botRoster(people.length>=SLED.minHumans?0:SLED.botFillTo-people.length,{seed:nextSeed,taken:people.map(p=>p.name)});
    const dress=seededRandom(nextSeed^0x0ddba11);
    racers=[...people,...bots.map((b,i)=>({...b,colour:people.length+i,outfit:randomOutfit(undefined,dress)}))];
    phase='countdown';endsAt=now+seconds;
  }
  function startRace(now){
    course=buildCourse(nextSeed);
    race=createSledRace({course,racers,bots:createBotDrivers(course,{seed:course.seed,skill:raceSkill})});
    // anyone who left during the countdown does not start
    for(const r of racers)if(!r.bot&&!seats.has(r.id))race.retire(r.id);
    phase='racing';lastStep=now;
  }
  function finish(now){
    const standings=race.standings().map(r=>({id:r.id,name:r.name,bot:r.bot,place:r.place,time:r.finishedAt,dnf:Boolean(r.dnf),crashes:r.crashes,iceHits:r.iceHits,wasLast:Boolean(r.wasLast)}));
    const bestHuman=standings.find(r=>!r.bot);
    if(bestHuman)raceSkill=nextSkill(raceSkill,bestHuman.place,standings.length);
    results={seed:course.seed,name:course.name,standings};
    phase='results';endsAt=now+SLED.resultsSeconds;race=null;
    return results;
  }

  // Advance to `now`; returns what happened ({started, finished}) so the room can broadcast or save it.
  function tick(now){
    const happened={};
    if(phase==='empty'&&seats.size){phase='waiting';endsAt=now+SLED.waitSeconds;}
    if(phase==='waiting'){
      if(!seats.size){phase='empty';return happened;}
      const ready=readyCount();
      if(seats.size===SLED.maxSeats&&ready===seats.size)startCountdown(now,SLED.fullCountdown);
      else{
        if(ready>=SLED.minHumans)endsAt=Math.min(endsAt,now+SLED.shortWait);
        if(now>=endsAt){
          if(ready>=1)startCountdown(now,ready>=SLED.minHumans?SLED.fullCountdown:SLED.botCountdown);
          else{seats.clear();phase='empty';}
        }
      }
    }
    if(phase==='countdown'&&now>=endsAt){startRace(now);happened.started=true;}
    if(phase==='racing'){
      // fixed steps at SLED.hz, however the caller's ticks land
      const dt=1/SLED.hz;
      while(now-lastStep>=dt&&!race.state.done){race.step(dt);lastStep+=dt;}
      if(race.state.done)happened.finished=finish(now);
    }
    if(phase==='results'&&now>=endsAt){phase='empty';seats.clear();results=null;racers=[];course=null;nextSeed=0;}
    return happened;
  }

  // What every client in the room needs: the lobby, and during a race the racers (course comes from the seed)
  function snapshot(){
    const out={phase,endsAt,seats:humans().map(s=>({id:s.id,name:s.name,ready:s.ready})),max:SLED.maxSeats};
    if(phase!=='empty'&&phase!=='waiting'){out.seed=nextSeed;out.racers=racers.map(r=>({id:r.id,name:r.name,bot:Boolean(r.bot),colour:r.colour,outfit:r.outfit??null}));}
    if(phase==='racing'){
      out.time=race.state.time;
      out.state=race.state.racers.map(r=>({id:r.id,d:r.d,x:r.x,v:r.v,vx:r.vx,tuck:r.tuck,crashUntil:r.crashUntil,boostUntil:r.boostUntil,airUntil:r.airUntil,place:r.place,finishedAt:r.finishedAt,dnf:Boolean(r.dnf),left:Boolean(r.retired)}));
    }
    if(phase==='results')out.results=results;
    return out;
  }
  const drainEvents=()=>race?race.drainEvents():[];
  return {join,ready,leave,input,tick,snapshot,drainEvents,get phase(){return phase;},get seats(){return seats;},get race(){return race;},get racers(){return racers;}};
}
