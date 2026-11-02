// Local review harness only, enabled with ?qa=1. It exports the actual runtime canvas.
if (new URLSearchParams(location.search).has('qa')) {
  window.qaSave = async function(name, extra={}) {
    window.game?.draw();
    const data = document.getElementById('c').toDataURL('image/png');
    await fetch('/__qa/'+name+'.png',{method:'POST',body:await (await fetch(data)).blob()});
    const g=window.game;
    await fetch('/__qa/'+name+'.json',{method:'POST',body:JSON.stringify({date:new Date().toISOString(),visibility:document.visibilityState,action:g?.player.action,emoting:g?.player.emoting,player:g?.player,audioState:g?.audio.context?.state,played:g?.audio.played,errors:window.qaErrors||[],...extra},null,2)});
  };
  window.qaErrors=[];
  addEventListener('error',e=>qaErrors.push(e.message));
  addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));
  addEventListener('keydown',e=>{
    if((new URLSearchParams(location.search).get('qa')||'').startsWith('auto') && e.isTrusted && !window.qaStarted){window.qaStarted=true;setTimeout(()=>runSuite(e.key),300);}
    if(new URLSearchParams(location.search).get('qa')==='1' && !window.qaManual && /^[1-7]$/.test(e.key)&&!e.repeat) setTimeout(()=>qaSave('emote-'+e.key+'-plaza'),e.key==='5'?750:450);
    if(e.key==='p') void qaSave('plaza');
  });
}

async function runSuite(firstTrustedKey) {
  const g=window.game;window.qaManual=true;g.r.stopRendering();
  await g.audio.ready;
  const results={firstTrustedKey,audioState:g.audio.context?.state,bytes:performance.getEntriesByType('resource').filter(e=>e.name.includes('.riv')).map(e=>e.decodedBodySize),emotes:[],checks:[],errors:window.qaErrors};
  const press=k=>{dispatchEvent(new KeyboardEvent('keydown',{key:k}));dispatchEvent(new KeyboardEvent('keyup',{key:k}));};
  const advance=f=>{for(let j=0;j<f;j++)g.advance(1/60);};
  await qaSave('plaza');
  for(let k=1;k<=7;k++){
    press(String(k));advance(k===5?48:28);
    results.emotes.push({key:k,action:g.player.action,expected:g.EMOTES[k].action,emoting:g.player.emoting});
    await qaSave('emote-'+k+'-plaza');
    advance(155);
    results.checks.push({name:'emote '+k+' returns to idle',pass:g.player.action===0&&!g.player.emoting});
  }
  press('2');advance(22);await qaSave('heart-before-replay');press('2');advance(22);await qaSave('heart-replayed');
  results.checks.push({name:'same key replays',pass:g.player.action===4&&g.player.emoting});advance(155);
  press('4');advance(15);press('6');advance(22);
  results.checks.push({name:'emote interrupts another',pass:g.player.action===8});advance(155);
  const x=g.player.x;dispatchEvent(new KeyboardEvent('keydown',{key:'a'}));advance(30);dispatchEvent(new KeyboardEvent('keyup',{key:'a'}));advance(2);
  results.checks.push({name:'WASD resumes after emote',pass:g.player.x<x&&g.player.action===0});
  await new Promise(r=>setTimeout(r,100));
  const before={...g.audio.played};press('m');await g.audio.play('pop');
  results.checks.push({name:'M mutes',pass:g.audio.muted&&JSON.stringify(before)===JSON.stringify(g.audio.played)});press('m');
  await g.audio.play('splash',.085);await g.audio.play('step',.075);
  results.played=g.audio.played;results.audioBuffers=Object.fromEntries(Object.entries(g.audio.buffers).map(([k,b])=>[k,{duration:b.duration,sampleRate:b.sampleRate}]));
  await fetch('/__qa/browser-verification.json',{method:'POST',body:JSON.stringify(results,null,2)});
  document.title='Ducky Land · Keyboard and audio verified';
  // Restore normal playback after review.
  window.qaManual=false;g.r.startRendering();location.href='/';
}
