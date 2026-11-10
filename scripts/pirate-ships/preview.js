// Local QA only. Real room boat, real game render path; never loaded in production.
import {pirateLocal} from '../../src/pixi/pirate-fleet.js';
import {canSail} from '../../src/pixi/islands.js';
export async function piratePreview(game){
 document.getElementById('pirate-controls')?.remove();document.getElementById('pirate-performance')?.remove();
 const bar=document.createElement('div');bar.id='pirate-controls';game.cleanups.push(()=>{bar.remove();document.getElementById('pirate-performance')?.remove();});Object.assign(bar.style,{position:'fixed',left:'18px',bottom:'18px',zIndex:50,display:'flex',gap:'8px',padding:'10px',background:'#fff0c7',borderRadius:'16px',font:'600 14px system-ui',color:'#39472d'});
 const status=document.createElement('span');status.textContent='Preparing pirate encounter…';bar.append(status);document.body.append(bar);
 const button=(text,fn)=>{const b=document.createElement('button');b.textContent=text;b.onclick=fn;Object.assign(b.style,{background:'#ffda69',border:'1px solid #39472d',borderRadius:'10px',padding:'8px 12px',cursor:'pointer'});bar.append(b);return b;};
 let selected=0;
 async function find(){
  if(!game.player||game.room.tick<0){status.textContent='Waiting for local boat…';return;}
  const ships=game.pirateFleet.ships.filter(s=>{const p=pirateLocal('home',s.p);return canSail(p.x+700,p.y+160,'home',120);}),ship=ships[selected%ships.length],p=pirateLocal('home',ship.p);
  const session=await(await fetch('/api/session')).json(),account=session.user?.accountId;if(!account)throw Error('Sign in to the local test room first.');
  const state=await(await fetch('/__test/state')).json(),boat=state.boats.find(b=>b.occupant===game.player.id)??state.boats.find(b=>b.islandId==='home'&&!b.occupant);
  await fetch('/__test/pose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account,pose:{mode:'sailing',boatId:boat.id,islandId:'home',x:p.x+700,y:p.y+160,turn:-Math.PI/2}})});
  setTimeout(()=>game.inspectPirate?.(p.x+320,p.y-160),250);status.textContent='18 wanderers · '+ship.art+' · boat-side preview';
 }
 button('Beside pirate',find);button('Next ship',()=>{selected++;find();});button('Ships on/off',()=>{game.pirateFleet.enabled=!game.pirateFleet.enabled;status.textContent=game.pirateFleet.enabled?'18 ships enabled':'Baseline: ships disabled';});button('Whole globe',()=>game.fit());
 button('Measure performance',async()=>{
  const result={};const original=game.pirateFleet.enabled;
  for(const enabled of [false,true]){
   game.pirateFleet.enabled=enabled;status.textContent=enabled?'Measuring 18 ships…':'Measuring baseline…';
   await new Promise(r=>setTimeout(r,3200));const frames=[],cpu=[];
   for(let k=0;k<180;k++){await new Promise(requestAnimationFrame);frames.push(game.frameTimes.at(-1));cpu.push(game.pirateFleet.stats.cpuMs);}
   frames.sort((a,b)=>a-b);result[enabled?'ships':'baseline']={meanMs:frames.reduce((a,b)=>a+b,0)/frames.length,p95Ms:frames[Math.floor(frames.length*.95)],fleetCpuMs:cpu.reduce((a,b)=>a+b,0)/cpu.length};
  }
  game.pirateFleet.enabled=original;status.textContent='Performance recorded';const pre=document.createElement('pre');pre.id='pirate-performance';pre.dataset.measurements=JSON.stringify(result);pre.textContent='Baseline '+result.baseline.meanMs.toFixed(1)+' ms · 18 ships '+result.ships.meanMs.toFixed(1)+' ms';Object.assign(pre.style,{position:'fixed',bottom:'70px',left:'18px',zIndex:60,background:'#fff0c7',color:'#39472d',padding:'10px'});document.body.append(pre);
 });
 const timer=setInterval(()=>{if(game.player&&game.room.tick>=0){clearInterval(timer);find().catch(e=>status.textContent=e.message);}},500);setTimeout(()=>clearInterval(timer),20000);
}
