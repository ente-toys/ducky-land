import {BreadHunt} from './activities/bread-hunt.js';
import {DuckRace,CITIES} from './activities/duck-race.js';
rive.RuntimeLoader.setWasmUrl(new URL('./rive.wasm',import.meta.url).href);
rive.RuntimeLoader.setWasmFallbackUrl(new URL('./rive_fallback.wasm',import.meta.url).href);
const params=new URLSearchParams(location.search);
const mode=document.body.dataset.activity;
const cityIndex=Math.max(0,CITIES.indexOf(params.get('city')||'Chennai'));
const city=CITIES[cityIndex],W=1600,H=1000;
const canvas=document.querySelector('canvas'),status=document.querySelector('#status');
const STORAGE='duckyLand.cityBread.v1'+(params.has('qa')?'.qa':'');
let totals={};try{totals=JSON.parse(localStorage.getItem(STORAGE)||'{}');if(!totals||typeof totals!=='object')totals={};}catch{}
const originalTotal=Math.max(0,Number(totals[city])||0);
let vmi,slots=[],cache=[],last=0,displayTotal=originalTotal,resultDelay=null;
const keys=new Set(),animations=[];
function play(name){r.stop(name);r.play(name,false);animations.push({name,at:performance.now()});}
function number(key,value){const p=vmi?.number(key);if(p&&p.value!==value)p.value=value;}
function string(key,value){const p=vmi?.string(key);if(p&&p.value!==value)p.value=value;}
function saveTotal(total){totals[city]=total;try{localStorage.setItem(STORAGE,JSON.stringify(totals));}catch{}}
function finish() {
  // Leave the last native crumb burst visible before showing the results.
  resultDelay=mode==='bread'?.72:.5;
  status.textContent=mode==='bread'?'Basket complete. 120 bread for '+city+'.':'Race finished.';
}
const activity=mode==='bread'?new BreadHunt({city,total:originalTotal,
  onCollect({bread,total}) {
    number(`b${bread.id}px`,bread.x);number(`b${bread.id}py`,bread.y);
    play('Pop '+bread.id);saveTotal(total);
    status.textContent=`${activity.collected} of 12 slices. ${total} bread for ${city}.`;
  },onFinish:finish}):new DuckRace({count:params.get('racers')||8,city:cityIndex,
  onCountdown(){play('Countdown');},onFinish:finish});

function start() {
  resultDelay=null;number('intro',0);number('result',0);number('counter',mode==='bread'?1:0);
  for(let i=0;i<12;i++){r.stop('Pop '+i);number(`b${i}px`,-3000);number(`b${i}py`,-3000);}
  if(mode==='race')r.stop('Countdown');
  activity.start();
  if(mode==='bread') {
    string('progress','0 / 12');
    for(const b of activity.bread){number(`b${b.id}x`,b.x);number(`b${b.id}y`,b.y);number(`b${b.id}show`,1);}
  }
  status.textContent=mode==='bread'?'Bread Hunt started. WASD, arrows or tap to walk.':'3, 2, 1. Tap or press Space to paddle.';
  document.querySelector('#accessible-start').hidden=true;
  canvas.focus();
}
function showResults() {
  number('result',1);number('counter',0);
  if(mode==='bread') {
    string('resultTitle','Lovely haul!');string('resultSub',`+120 for ${city}`);string('progress','12 / 12 slices');
    string('total',`${city}  ${activity.total}`);
  } else {
    const place=activity.finishOrder.findIndex(d=>d.id===0)+1;
    string('resultTitle',place===1?'First to float!':`You came ${ordinal(place)}!`);
    string('resultSub',`${activity.count} Duckies, one lovely lap.`);
    for(let i=0;i<8;i++) {
      const d=activity.finishOrder[i];string('row'+i,d?`${i+1}.  ${d.name}  /  ${CITIES[d.city]}`:'');
      string('time'+i,d?formatTime(d.finishTime):'');
    }
  }
  play('Results');
  document.querySelector('#accessible-start').hidden=false;
  document.querySelector('#accessible-start').textContent='Play again';
}
function ordinal(n){return n+({1:'st',2:'nd',3:'rd'}[n]||'th');}
function formatTime(t){return `${Math.floor(t/60)}:${(t%60).toFixed(2).padStart(5,'0')}`;}
function toWorld(cx,cy) {
  const rect=canvas.getBoundingClientRect(),s=Math.min(rect.width/W,rect.height/H);
  return [(cx-rect.left-(rect.width-W*s)/2)/s,(cy-rect.top-(rect.height-H*s)/2)/s];
}
canvas.addEventListener('pointerdown',e=>{
  if(!vmi)return;
  const [x,y]=toWorld(e.clientX,e.clientY);
  if(activity.phase==='intro') {if(x>630&&x<970&&y>590&&y<670)start();return;}
  if(activity.phase==='finished') {
    if(resultDelay!==null)return;
    const by=mode==='bread'?660:770;
    if(x>610&&x<990&&y>by-40&&y<by+40)start();
    else if(x>620&&x<980&&y>by+43&&y<by+92)location.href='./';
    return;
  }
  if(mode==='bread')activity.target(x,y);else activity.paddle();
});
document.querySelector('#accessible-start').addEventListener('click',()=>{if(vmi)start();});
addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
  keys.add(k);
  if(!vmi)return;
  if(k==='enter'&&(activity.phase==='intro'||(activity.phase==='finished'&&resultDelay===null)))start();
  else if(k===' '&&!e.repeat&&mode==='race')activity.paddle();
});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
addEventListener('blur',()=>keys.clear());
document.addEventListener('visibilitychange',()=>{last=0;keys.clear();});
function writeSlot(i,key,val,type='n') {
  if(cache[i][key]===val)return;cache[i][key]=val;
  const p=type==='s'?slots[i].string(key):slots[i].number(key);if(p)p.value=val;
}
function syncDucks(ducks) {
  const sorted=[...ducks].sort((a,b)=>a.y-b.y||a.id-b.id);
  for(let i=0;i<16;i++) {
    const d=sorted[i];if(!d){writeSlot(i,'x',-3000);continue;}
    writeSlot(i,'x',Math.round(d.x));writeSlot(i,'y',Math.round(d.y));
    for(const key of ['action','facing','cap','shades','acc','shoes','city','isPlayer'])writeSlot(i,key,d[key]??0);
    writeSlot(i,'name',' '+d.name+' ','s');
    if(mode==='race')number('splash'+i,activity.phase==='racing'&&!d.finished&&activity.elapsed<d.paddleUntil?1:0);
  }
}
const crowd=[
  {id:1,x:420,y:590,cap:3,name:'mo',city:0},
  {id:2,x:1170,y:620,cap:11,name:'pip',city:2},
  {id:3,x:1050,y:430,cap:5,name:'nori',city:3},
].map(d=>({...d,action:0,facing:1}));
function frame(t) {
  const dt=last?Math.min(.05,Math.max(0,(t-last)/1000)):0;last=t;
  if(document.visibilityState==='visible') {
    activity.update(dt,{x:Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft')),
      y:Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'))});
    if(mode==='bread') {
      const p={...activity.player,id:0,name:'you',cap:8,city:cityIndex,isPlayer:1};
      syncDucks([p,...crowd]);
      for(const b of activity.bread)number(`b${b.id}show`,b.active?1:0);
      if(activity.phase!=='finished'||resultDelay!==null) {
        if(displayTotal<activity.total)displayTotal=Math.min(activity.total,displayTotal+dt*65);
        string('total',`${city}  ${Math.floor(displayTotal)}`);string('progress',`${activity.collected} / 12`);
      }
    } else {
      syncDucks(activity.racers);
      const player=activity.racers[0];
      let label=`${activity.count} Duckies. One lap. Tap / SPACE to paddle.`;
      if(activity.phase==='racing') {
        const rank=[...activity.racers].sort((a,b)=>b.progress-a.progress).findIndex(d=>d.id===0)+1;
        label=player.finished?`${ordinal(activity.finishOrder.findIndex(d=>d.id===0)+1)} place! Waiting for the flock...`:
          `${ordinal(rank)} / ${activity.count}  ·  ${Math.floor(player.progress*100)}%  ·  tap / SPACE`;
      }
      string('raceStatus',label);
    }
    if(resultDelay!==null) {resultDelay-=dt;if(resultDelay<=0){resultDelay=null;showResults();}}
  }
  requestAnimationFrame(frame);
}
const r=new rive.Rive({
  src:'ducky-land.riv?v=activities-4',canvas,autoplay:true,autoBind:true,
  artboard:mode==='bread'?'Bread Hunt':'Duck Race',stateMachines:mode==='bread'?'Plaza':'Activity',
  layout:new rive.Layout({fit:rive.Fit.Contain,alignment:rive.Alignment.Center}),
  onLoad(){
    r.resizeDrawingSurfaceToCanvas(Math.min(devicePixelRatio||1,2));vmi=r.viewModelInstance;
    for(let i=0;i<16;i++){slots.push(vmi.viewModel('slot'+i));cache.push({});}
    number('intro',1);number('result',0);number('counter',0);
    string('total',`${city}  ${originalTotal}`);
    document.querySelector('#accessible-start').disabled=false;
    document.querySelector('#loading').hidden=true;
    window.game={r,vmi,activity,slots,animations,mode,start,toWorld,get totals(){return {...totals};}};
    requestAnimationFrame(frame);
    if(params.has('qa'))import('./qa.js');
  },
  onLoadError(error){document.querySelector('#loading').textContent='Could not load the Rive scene. Reload to try again.';console.error(error);}
});
addEventListener('resize',()=>r.resizeDrawingSurfaceToCanvas(Math.min(devicePixelRatio||1,2)));
document.querySelector('#help').addEventListener('click',()=>{
  const el=document.querySelector('#instructions');el.hidden=!el.hidden;
});
