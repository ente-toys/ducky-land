import {useEffect,useRef,useState} from 'react';
import {RULES} from './rules.js';
import {createDemo} from './demo.js';
import {attachBogCombat} from './attach.js';
import BogDock from './BogDock.jsx';
import './combat.css';

export default function BogDemo({engine,combat,count}){
 const picking=useRef(false);
 const [demo]=useState(()=>createDemo(combat,count));
 const [snapshot,setSnapshot]=useState(null),[picker,setPicker]=useState(false),[mode,setMode]=useState('bot-0'),[error,setError]=useState('');
 picking.current=picker;
 useEffect(()=>{
  let disposed=false,attaching=false;
  const controller=new AbortController();
  const camera=globalThis.bogCamera;
  globalThis.bogCamera=(...args)=>{setMode('area');camera(...args);};
  const spectate=()=>{
   if(disposed||attaching||picking.current||engine.bogCombat)return;
   attaching=true;
   attachBogCombat(engine,{...combat,Room:demo.Room,signal:controller.signal,onLeave:()=>{},onSnapshot:()=>{}}).then(layer=>{
    attaching=false;if(disposed){layer.leave(false);return;}setError('');engine.follow=false;engine.target.zoom=.65;
   }).catch(e=>{attaching=false;if(!disposed)setError(e.message);});
  };
  spectate();
  const timer=setInterval(()=>{spectate();setSnapshot(demo.sim.snapshot());Object.assign(engine.canvas.dataset,{bogBots:String(count),bogDemoCpuMs:demo.metrics.cpuMs.toFixed(3),bogDemoMaxCpuMs:demo.metrics.maxCpuMs.toFixed(3)});},150);
  return()=>{disposed=true;controller.abort();clearInterval(timer);globalThis.bogCamera=camera;engine.bogCombat?.leave(false);};
 },[engine,combat,demo]);
 useEffect(()=>{
  const key=e=>{
   if(e.ctrlKey||e.metaKey||e.altKey||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName))return;
   if(e.key==='Tab'||/^[0-9]$/.test(e.key)){
    e.preventDefault();e.stopImmediatePropagation();
    const ids=[...demo.sim.state.players.values()].filter(p=>p.bot).map(p=>p.id);
    setMode(old=>e.key==='Tab'?ids[(ids.indexOf(old)+1)%ids.length]:ids[(Number(e.key)+9)%10]??'action');
    engine.canvas.focus();
   }
  };
  window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);
 },[demo,engine]);
 useEffect(()=>{
  const timer=setInterval(()=>{
   if(mode==='area'||(engine.bogCombat&&!engine.bogCombat.room.demoSpectator&&mode==='action'))return;
   const focus=demo.sim.state.players.get(mode==='action'?demo.heroId:mode);
   if(focus){engine.follow=false;engine.fitMode=false;engine.fly=null;Object.assign(engine.target,{x:focus.x,y:focus.y-90,zoom:.65});}
  },16);return()=>clearInterval(timer);
 },[mode,demo,engine]);
 const focused=snapshot?.players.find(p=>p.id===(mode==='action'||mode==='area'?demo.heroId:mode));
 return <>
  <aside className="bog-combat-hud" aria-label="Local autoplay demo" style={picker?{left:'auto',right:16}:undefined}>
   <div className="bog-combat-score"><span>KARMA {snapshot?.scores.karma??0}</span><span>EVIL {snapshot?.scores.evil??0}</span></div>
   <p>LOCAL DEMO · {count} bots · {mode==='action'?'Following Ducky':mode==='area'?'Area camera':snapshot?.players.find(p=>p.id===mode)?.name}</p>
   {focused&&<><div className="bog-combat-lives" role="img" aria-label={`${focused.lives} lives left`}>{Array.from({length:RULES.lives},(_,i)=><span key={i} aria-hidden="true" className={i<focused.lives?'':'lost'}>♥</span>)}</div>{focused.alive&&focused.shieldUntil>snapshot.time&&<p>Hidden {Math.ceil(focused.shieldUntil-snapshot.time)}s</p>}</>}
   <small>1–0 follow a bot · Tab cycles · WASD + Shift + Space when playing</small>
   <div><button onClick={()=>{setMode(demo.heroId);engine.canvas.focus();}}>Follow Ducky</button> <button onClick={()=>setPicker(true)}>Join a team</button></div>
   <div aria-label="Kill feed" style={{marginTop:8}}>{snapshot?.events.slice(-4).map(e=><div key={e.id}>{e.actor} tagged {e.victim}{e.medals.length?' · Medal!':''}</div>)}</div>
   {error&&<p role="alert">{error}</p>}
  </aside>
  {demo.match.winner&&<div className="bog-demo-winner" role="status"><strong>Team KARMA wins!</strong><span>New match in a few seconds</span></div>}
  {picker&&<BogDock engine={engine} {...combat} Room={demo.Room} Socket={demo.Socket} leaveLabel="Spectate" returnLabel="Spectate" onLeave={()=>{setPicker(false);setMode(demo.heroId);}} onReturnToDock={()=>{setPicker(false);setMode(demo.heroId);}}/>}
 </>;
}
