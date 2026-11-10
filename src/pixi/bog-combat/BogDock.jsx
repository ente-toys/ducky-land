import {useEffect,useRef,useState} from 'react';
import {ArenaLobbyClient,profileToken} from './client.js';
import {canEnterBog} from './entry.js';
import {MEDALS} from './medals.js';
import {emptyStats} from './rules.js';
import BogGame from './BogGame.jsx';
import './combat.css';

export function trapFocus(event) {
  if(event.key!=='Tab')return;
  const focusable=[...event.currentTarget.querySelectorAll('button:not(:disabled),a[href],[tabindex="0"]')];
  const first=focusable[0],last=focusable.at(-1),active=document.activeElement;
  if(event.shiftKey&&(active===first||active===event.currentTarget)){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&(active===last||active===event.currentTarget)){event.preventDefault();first?.focus();}
}
export function LifetimeStats({stats=emptyStats()}) {
  return <dl className="bog-combat-lifetime">{[['tags','Kills'],['survives','Survives'],['score','Score'],['medals','Medals'],['bestStreak','Best streak']].map(([key,label])=><div key={key}><dt>{label}</dt><dd>{stats[key]??0}</dd></div>)}</dl>;
}
export function MedalCase({medals={}}) {
  return <ul className="bog-combat-medals">{MEDALS.map(m=><li key={m.id}><strong>{m.name}</strong><span>{medals[m.id]?'Earned':m.detail}</span></li>)}</ul>;
}

// Render at dockArrival(travel,status). Choosing a side attaches gameplay to
// engine's existing island. It never mounts another canvas or swaps the scene.
export default function BogDock({engine,name='Ducky',profile:providedProfile,onLeave=()=>{},onReturnToDock=()=>{},initialPanel='teams',...options}) {
  const [profile]=useState(()=>providedProfile??profileToken()),[team,setTeam]=useState(null),[panel,setPanel]=useState(initialPanel);
  const [data,setData]=useState(null),[status,setStatus]=useState('connecting'),[attempt,setAttempt]=useState(0),[lastVisit,setLastVisit]=useState(null);
  const dialog=useRef(null),leave=useRef(onLeave);leave.current=onLeave;
  useEffect(()=>{
    if(team)return;let active=true;setData(null);setStatus('connecting');engine.stopInput();
    const lobby=new ArenaLobbyClient({profile,url:options.lobbyURL,Socket:options.Socket,
      onSnapshot:value=>{if(active)setData(value);},onStatus:value=>{if(active)setStatus(value);}});
    const timeout=setTimeout(()=>{if(active)setStatus(previous=>previous==='connecting'?'disconnected':previous);},10000);
    return()=>{active=false;clearTimeout(timeout);lobby.dispose();};
  },[profile,team,attempt,engine,options.lobbyURL,options.Socket]);
  useEffect(()=>{
    if(team)return;const previous=document.activeElement;dialog.current?.focus();
    const keydown=event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();leave.current();return;}
      if(/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(event.target?.tagName??''))return;
      if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift',' ','j','q','e','1','2','3','4','5','6','7','enter'].includes(event.key.toLowerCase())){event.preventDefault();event.stopImmediatePropagation();}
    };
    window.addEventListener('keydown',keydown,true);
    return()=>{window.removeEventListener('keydown',keydown,true);previous?.focus?.({preventScroll:true});};
  },[team]);
  const back=totals=>{onReturnToDock();setLastVisit(totals);setTeam(null);setPanel('summary');};
  if(team)return <BogGame {...options} engine={engine} team={team} name={name} profile={profile} onLeave={back}/>;
  const connected=status==='connected'&&data,stats=data?.stats??lastVisit?.stats??emptyStats(),medals=data?.medalCase??lastVisit?.medalCase??{};
  return <div className="bog-combat-dock">
    <section ref={dialog} className="bog-combat-card" role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="bog-combat-heading" onKeyDown={trapFocus}>
      <header><small>BOOQUACK BOG · FREE PLAY</small><button onClick={onLeave}>Back to island</button></header>
      <h1 id="bog-combat-heading">{panel==='teams'?'Pick your side.':panel==='case'?'Your medal case':'Back at the dock'}</h1>
      {panel==='teams'?<>
        <p>Drop in, make a splash. Any team size, leave whenever you like.</p>
        <div className="bog-combat-teams">{['privacy','google'].map(id=><button className={`bog-combat-team bog-combat-${id}`} key={id} disabled={!connected||!canEnterBog()} onClick={()=>setTeam(id)}>
          <strong>Team {id==='privacy'?'PRIVACY':'GOOGLE'}</strong>
          <span>{connected?`${data.counts[id]} playing`:'Checking players…'}</span>
          <small>{connected&&data.suggested===id?'Could use a duck':'Any team size welcome'}</small>
        </button>)}</div>
        <p>WASD / arrows to walk and turn. Shift to run. Hold Space to shoot forwards, J or left click also shoot.</p>
        <p>One paint hit tags a duck. Respawn at your team base. Earn points and medals.</p>
      </>:<><p>Your lifetime progress carries over every visit.</p><LifetimeStats stats={stats}/><MedalCase medals={medals}/></>}
      <footer><span>{Object.keys(medals).length} / {MEDALS.length} medals earned</span><button onClick={()=>setPanel(panel==='teams'?'case':'teams')}>{panel==='teams'?'Medal case':'Pick a team'}</button></footer>
      <p role="status">{status==='disconnected'?<>The bog is unavailable. <button onClick={()=>setAttempt(n=>n+1)}>Reconnect</button></>:status==='connecting'?'Connecting to the bog…':'Ready to make a splash.'}</p>
    </section>
  </div>;
}
