// Bots drive with the same steer/tuck/jump a player has, through a reaction delay, and sometimes misread an obstacle.
// skill (0..1, 0.5 = as designed) eases them off or sharpens them up after each race.
import {BOT_NAMES,BOT_STYLES,SLED,TUBE_COLOURS} from './rules.js';
import {HAZARDS,seededRandom} from './course.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function botRoster(count,{seed=1,taken=[]}={}){
  const random=seededRandom(seed),styles=Object.keys(BOT_STYLES),names=BOT_NAMES.filter(n=>!taken.includes(n));
  return Array.from({length:count},(_,i)=>{
    const name=names.splice(Math.floor(random()*names.length),1)[0]??`Bot ${i+1}`;
    return {id:`sled-bot-${i+1}`,name,bot:true,style:i===0?'wobbly':styles[Math.floor(random()*styles.length)]};
  });
}

export function createBotDrivers(course,{seed=1,skill=.5}={}){
  const random=seededRandom(seed^0x5bd1e995),drivers=new Map();
  function driver(r){
    const style=BOT_STYLES[r.style]??BOT_STYLES.careful;
    const sharp=clamp(skill,0,1)*2-1;   // -1 easy .. +1 sharp
    const miss=clamp(style.miss*(1-.6*sharp),.02,.4);
    // which hazards this bot will misread, decided once per race
    const blind=new Set(course.hazards.map((_,i)=>i).filter(()=>random()<miss));
    const chaseIce=random()<style.iceChase;
    return {style,blind,hopped:new Set(),chaseIce,quickFork:r.style==='daredevil'||random()<style.iceChase*.6,next:0,command:{steer:0,tuck:false},
      reaction:()=>clamp(style.reaction[0]+random()*(style.reaction[1]-style.reaction[0])-.05*sharp,.15,.35)};
  }
  return (r,state)=>{
    let me=drivers.get(r.id);
    if(!me)drivers.set(r.id,me=driver(r));
    if(state.time<me.next)return me.command;
    me.next=state.time+me.reaction();
    // aim a reaction's worth ahead, across the track (racers follow its bends on their own)
    const ahead=r.d+Math.max(1,r.v*me.reaction()),rel=r.x-course.centre(r.d);
    let target=clamp(rel,-course.half+1,course.half-1),danger=false;
    const fork=course.forkAt(ahead+4);
    if(fork)target=(me.quickFork?fork.quick:-fork.quick)*course.half*.55;
    if(me.chaseIce){
      const patch=course.ice.find(p=>p.d1>r.d+1&&p.d0<r.d+me.style.look);
      if(patch)target=(patch.x0+patch.x1)/2;
    }
    for(let i=r.hazardIndex;i<course.hazards.length;i++){
      const h=course.hazards[i];
      if(h.d>r.d+me.style.look)break;
      if(h.d<r.d||me.blind.has(i))continue;
      const room=HAZARDS[h.kind].w+SLED.racerRadius+.6;
      if(Math.abs(target-h.x)<room){
        danger=true;
        const left=h.x-room,right=h.x+room,canLeft=left>-course.half+.6,canRight=right<course.half-.6;
        target=canLeft&&(!canRight||Math.abs(rel-left)<Math.abs(rel-right))?left:right;
      }
    }
    const want=target-rel;
    // an obstacle right in its path: some bots hop it instead of (or as well as) swerving, each decided once
    let jump=false;
    for(let i=r.hazardIndex;i<course.hazards.length;i++){
      const h=course.hazards[i],gap=h.d-r.d;
      if(gap>r.v*.3)break;
      if(gap<.4||me.blind.has(i)||me.hopped.has(i)||Math.abs(rel-h.x)>HAZARDS[h.kind].w+SLED.racerRadius)continue;
      me.hopped.add(i);jump=random()<me.style.hop;break;
    }
    me.command={steer:Math.abs(want)<.25?0:clamp(want/1.5,-1,1),tuck:!danger&&random()<me.style.tuck,jump};
    return me.command;
  };
}

// After a race against people: bots drift toward the humans' results (keep winning and they sharpen).
export function nextSkill(skill,bestHumanPlace,racers){
  const share=racers>1?(bestHumanPlace-1)/(racers-1):.5;   // 0 = humans won
  return clamp(skill+(.5-share)*.1,.15,.9);
}
export {TUBE_COLOURS};
