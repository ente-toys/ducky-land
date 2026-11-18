// A sled course built from a seed (a new one every race): the same seed gives the same hill everywhere, so only the
// seed travels.
// Positions are (d, x): d metres down the hill, x across it (0 = the course centre line at that d). The track is
// SLED.lanes lanes wide and every obstacle fills one lane.
import {SLED} from './rules.js';

export function seededRandom(seed){
  let a=seed>>>0;
  return ()=>{a=(a+0x6d2b79f5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
}

const NAMES=['Pinecone Plunge','Mitten Mile','Snowdrop Slide','Frostbite Falls','Icicle Alley','Puffin Pass','Flurry Run','Toboggan Twist'];
export const HAZARDS=Object.freeze({
  rock:{w:.72,len:.9},snowman:{w:.6,len:.7},log:{w:.88,len:.5},fence:{w:.9,len:.3},
});
export const laneWidth=()=>SLED.trackWidth/SLED.lanes;
export const laneX=lane=>-SLED.trackWidth/2+laneWidth()*(lane+.5);
const smooth=t=>t<=0?0:t>=1?1:t*t*(3-2*t);

export function buildCourse(seed,{length=SLED.courseLength}={}){
  const random=seededRandom(seed),pick=list=>list[Math.floor(random()*list.length)],between=(a,b)=>a+random()*(b-a);
  const half=SLED.trackWidth/2,bends=[],hazards=[],ice=[],ramps=[],forks=[];
  // the centre line: smooth sideways shifts, segment by segment
  let d=30,shift=0;
  while(d<length-60){
    const len=between(60,110),to=Math.max(-18,Math.min(18,shift+between(-14,14)));
    bends.push({d0:d,d1:d+len,from:shift,to});shift=to;d+=len;
  }
  // hazards get denser down the hill; the first 30 m and last 25 m stay clear
  const free=(at,gap=4)=>!hazards.some(h=>Math.abs(h.d-at)<gap)&&!ramps.some(r=>Math.abs(r.d-at)<gap+2);
  for(d=40;d<length-25;d+=between(14,22)-6*d/length){
    const lanes=Array.from({length:SLED.lanes},(_,i)=>i).sort(()=>random()-.5);
    if(random()<.1&&free(d,10)){ramps.push({d});hazards.push({kind:'log',d:d+3.2,x:laneX(pick([2,3]))});d+=10;continue;}
    if(random()<.16){const lane=Math.floor(random()*(SLED.lanes-1)),wide=random()<.5?2:1,w=laneWidth();
      ice.push({d0:d,d1:d+between(5,8),x0:-half+w*lane+.15,x1:-half+w*(lane+wide)-.15});continue;}
    if(!free(d))continue;
    // a row: one obstacle near the top of the hill, up to three lower down, always leaving at least two lanes open
    const count=d<length*.24?1:d<length*.51?(random()<.35?2:1):1+Math.floor(random()*3);
    for(const lane of lanes.slice(0,Math.min(count,SLED.lanes-2))){
      const kind=d<length*.24?pick(['rock','rock','snowman']):pick(['rock','rock','snowman','log','fence']);
      hazards.push({kind,d,x:laneX(lane)});
    }
  }
  // one or two forks (a third and two thirds of the way down): a divider down the middle, a safe side and a quicker
  // side with ice and more hazards
  const forkCount=1+(random()<.5?1:0);
  for(let i=0;i<forkCount;i++){
    const d0=length*between(.27+i*.34,.37+i*.34),d1=d0+between(55,80),quick=random()<.5?-1:1;
    forks.push({d0,d1,quick});
    for(let k=hazards.length-1;k>=0;k--)if(hazards[k].d>d0-4&&hazards[k].d<d1+4)hazards.splice(k,1);
    for(let k=ice.length-1;k>=0;k--)if(ice[k].d1>d0-4&&ice[k].d0<d1+4)ice.splice(k,1);
    for(let at=d0+8;at<d1-6;at+=between(7,11)){
      if(random()<.55)ice.push({d0:at,d1:at+4,x0:quick>0?1.4:-half+.6,x1:quick>0?half-.6:-1.4});
      else hazards.push({kind:'rock',d:at,x:quick*laneX(SLED.lanes/2+(random()<.5?1:2))});
    }
    hazards.push({kind:'snowman',d:d0+between(15,30),x:-quick*laneX(SLED.lanes/2+(random()<.5?1:2))});
  }
  hazards.sort((a,b)=>a.d-b.d);ice.sort((a,b)=>a.d0-b.d0);ramps.sort((a,b)=>a.d-b.d);
  const centre=at=>{
    for(const b of bends)if(at<b.d1)return at<b.d0?b.from:b.from+(b.to-b.from)*smooth((at-b.d0)/(b.d1-b.d0));
    return bends.at(-1)?.to??0;
  };
  const forkAt=at=>forks.find(f=>at>=f.d0&&at<=f.d1)??null;
  const weatherRoll=random();
  return {seed:seed>>>0,name:NAMES[seed%NAMES.length],length,half,centre,forkAt,hazards,ice,ramps,forks,bends,
    weather:weatherRoll<.6?'clear':weatherRoll<.85?'snow':'evening'};
}
