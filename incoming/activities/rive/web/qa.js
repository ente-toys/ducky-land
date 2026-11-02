// Opt-in, real-time browser integration checks. Never loaded during normal play.
const {activity:a,r,vmi,mode,animations}=window.game;
const canvas=document.querySelector('canvas'), checks=[], errors=[];
const initial=a.total;
addEventListener('error',e=>errors.push(e.message));
addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function check(label,pass){checks.push({label,pass:!!pass});if(!pass)throw Error(label);}
function key(key,type='keydown',repeat=false){dispatchEvent(new KeyboardEvent(type,{key,repeat,bubbles:true,cancelable:true}));}
function click(x,y){const box=canvas.getBoundingClientRect(),s=Math.min(box.width/1600,box.height/1000);
  canvas.dispatchEvent(new PointerEvent('pointerdown',{clientX:box.left+(box.width-1600*s)/2+x*s,
    clientY:box.top+(box.height-1000*s)/2+y*s,bubbles:true,button:0,pointerId:1}));}
async function until(fn,timeout=15000){let visibleWait=0;while(!fn()){
  if(document.visibilityState==='visible')visibleWait+=50;
  if(visibleWait>timeout)throw Error('Timed out: '+fn);await sleep(50);}}
function state(){return {mode,phase:a.phase,visible:document.visibilityState,checks:[...checks],errors:[...errors],
  collected:a.collected,total:a.total,taps:a.taps,elapsed:a.elapsed,canvas:{width:canvas.width,height:canvas.height},
  player:a.player,racers:a.racers,finishOrder:a.finishOrder,animations:[...animations],
  native:{intro:vmi.number('intro').value,result:vmi.number('result').value,counter:vmi.number('counter').value,
    title:vmi.string('resultTitle').value,progress:vmi.string('progress').value,total:vmi.string('total').value},
  runtime:{animations:r.animationNames,stateMachines:r.stateMachineNames},userAgent:navigator.userAgent};}
async function save(name,png=true){await until(()=>document.visibilityState==='visible');
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const body={name,...state()};if(png)body.png=canvas.toDataURL('image/png');
  const response=await fetch('/__qa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok)throw Error('QA sink: '+response.status);}
window.qa={save,checks,errors,click,key};
async function run(){
  await until(()=>document.visibilityState==='visible');await sleep(150);
  check('Real browser page is visible',document.visibilityState==='visible');
  check('Native activity and all nested slots loaded',!!vmi&&game.slots.length===16);
  await save(mode+'-intro');
  const testMode=new URLSearchParams(location.search).get('qa');
  if(!['auto','fast'].includes(testMode))return;
  key('Enter');key('Enter','keyup');
  if(mode==='bread'){
    check('Enter starts hunt with twelve slices',a.phase==='playing'&&a.bread.length===12);
    await sleep(100);await save('bread-playing');
    // Actual key path first, then pointer navigation for the rest of the hunt.
    const x=a.player.x;key('d');await sleep(500);key('d','keyup');
    check('Keyboard moves the player',a.player.x>x+40);
    const first=a.bread[0];click(first.x,first.y);
    await until(()=>!first.active);await sleep(100);await save('bread-pop');
    for(const b of a.bread){if(!b.active)continue;click(b.x,b.y);await until(()=>!b.active);}
    await until(()=>vmi.number('result').value===1);await sleep(700);
    check('All twelve slices collected exactly once',a.collected===12&&a.bread.every(b=>!b.active));
    check('City receives exactly 120',a.total===initial+120&&game.totals[a.city]===a.total);
    check('One native pop per collected slice',animations.filter(x=>x.name.startsWith('Pop ')).length===12);
    check('Counter hidden on results',vmi.number('counter').value===0);
    await save('bread-results');click(800,660);await sleep(500);
    check('Pointer replay resets twelve slices',a.phase==='playing'&&a.collected===0&&a.bread.every(b=>b.active));
    check('Replay preserves city total',a.total===initial+120);
    await save('bread-replay');
    await save('bread-pass',false);
    location.href='race.html?city=Chennai&racers=8&qa='+testMode;
  }else{
    check('Race starts at countdown',a.phase==='countdown');
    await sleep(180);await save('race-countdown-3');
    if(testMode==='fast'){
      a.update(3.01);r.scrub('Countdown',4);r.stop('Countdown');
    }else{
      await sleep(950);await save('race-countdown-2');
      await sleep(950);await save('race-countdown-1');
      await until(()=>a.phase==='racing');await sleep(100);await save('race-go');
    }
    const n=a.taps;key(' ', 'keydown',true);await sleep(100);
    check('Holding Space does not auto paddle',a.taps===n);key(' ','keyup');
    let clicks=0;const timer=setInterval(()=>{if(a.phase!=='racing')return;
      if(clicks++%2){key(' ');key(' ','keyup');}else click(1200,650);},150);
    await sleep(testMode==='fast'?180:2500);await save('race-playing');
    if(testMode==='fast'){
      // Explicit fixed-step test clock for busy shared browsers. Production
      // always uses real frame time; native effects are captured in real time.
      clearInterval(timer);
      for(let frame=0;frame<10000&&a.phase==='racing';frame++){
        if(frame%9===0){if(frame%18===0)click(1200,650);else{key(' ');key(' ','keyup');}}
        a.update(1/60);
      }
      check('Fixed-step browser race completed',a.phase==='finished');
    }
    await until(()=>a.phase==='finished',45000);clearInterval(timer);
    await until(()=>vmi.number('result').value===1);await sleep(700);
    check('Eight distinct racers finish',a.finishOrder.length===8&&new Set(a.finishOrder.map(d=>d.id)).size===8);
    check('Finish times sorted at crossing',a.finishOrder.every((d,i,list)=>!i||list[i-1].finishTime<=d.finishTime));
    check('Tap and Space paddle strokes registered',a.taps>30);
    check('Results strings match finish order',a.finishOrder.every((d,i)=>vmi.string('row'+i).value.includes(d.name)));
    await save('race-results');click(800,770);await sleep(300);
    check('Race replay clears progress, taps and order',a.phase==='countdown'&&a.taps===0&&a.finishOrder.length===0&&a.racers.every(d=>d.progress===0));
    await save('race-replay');await save('race-pass',false);
    document.querySelector('#status').textContent='Browser QA passed. Both activities completed and replayed.';
  }
}
run().catch(async error=>{errors.push(String(error));console.error(error);await save(mode+'-failed').catch(console.error);});
