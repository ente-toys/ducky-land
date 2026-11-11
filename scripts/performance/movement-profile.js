// Opt-in development diagnostics. Never imported in production.
export function profileMovement(game) {
  const canvas=game.canvas, worst=[], restores=[];
  if(new URLSearchParams(location.search).has("noPirates"))game.pirateFleet.enabled=false;
  let lastTick=performance.now();
  let current=null, samples=0, since=performance.now(), frames=[];
  function wrap(object,key,label) {
    if(!object?.[key])return;
    const original=object[key];
    object[key]=function(...args){
      const at=performance.now();
      try{return original.apply(this,args);}finally{
        const ms=performance.now()-at;
        if(current)current[label]=(current[label]??0)+ms;
      }
    };
    restores.push(()=>object[key]=original);
  }
  for(const key of ['buildCopies','captureArt','liveCopies','renderLiveCopies','renderLiveDucks'])wrap(game,key,key);
  for(const [object,key,label] of [[game.sim,'step','simulation'],[game.app,'render','render'],[game.waterFX,'update','water'],[game.waterFX,'edge','waterEdge'],[game.groundPool,'update','stream'],[game.worldView,'update','globe'],[game.isletView,'update','islets'],[game.pirateFleet,'update','pirates']])wrap(object,key,label);
  for(const rig of game.rigs)wrap(rig,'update','duckRig');
  const original=game.tick;
  game.tick=function(...args){
    current={};const at=performance.now(), interval=at-lastTick;lastTick=at;
    try{return original.apply(this,args);}finally{
      const cpu=performance.now()-at, parts=current;current=null;
      const moving=Boolean(game.player?.travel>1);
      frames.push({cpu,interval,moving,...parts});samples++;
      if(cpu>10){worst.push({cpu,moving,parts,zoom:game.camera.zoom});worst.sort((a,b)=>b.cpu-a.cpu);worst.length=Math.min(8,worst.length);}
      if(performance.now()-since>1000){
        const summary={};
        for(const moving of [false,true]){
          const rows=frames.filter(row=>row.moving===moving), values=rows.map(row=>row.cpu).sort((a,b)=>a-b);
          if(!rows.length)continue;
          const mean={};for(const row of rows)for(const [key,value]of Object.entries(row))if(typeof value==='number')mean[key]=(mean[key]??0)+value/rows.length;
          const gaps=rows.map(row=>row.interval).sort((a,b)=>a-b);
          summary[moving?'moving':'idle']={n:rows.length,p95:values[Math.floor(values.length*.95)],max:values.at(-1),gapP95:gaps[Math.floor(gaps.length*.95)],gapMax:gaps.at(-1),over24ms:gaps.filter(v=>v>24).length,mean};
        }
        canvas.dataset.movementProfile=JSON.stringify({samples,summary,worst});
        if(frames.length>1200)frames=frames.slice(-900);
        since=performance.now();
      }
    }
  };
  const observer=new PerformanceObserver(list=>{canvas.dataset.longTasks=JSON.stringify(list.getEntries().map(e=>({start:e.startTime,duration:e.duration})));});
  observer.observe({type:'longtask',buffered:true});
  game.cleanups.push(()=>{observer.disconnect();restores.reverse().forEach(f=>f());game.tick=original;});
}
