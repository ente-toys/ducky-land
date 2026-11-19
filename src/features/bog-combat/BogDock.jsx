import {useEffect,useRef,useState} from 'react';
import {ArenaLobbyClient,profileToken} from './client.js';
import BogGame from './BogGame.jsx';
import {BogWelcome,BogTeamPick} from './BogEntryScreens.jsx';
import BogClouds,{FeatherWait} from './BogClouds.jsx';
import './combat.css';

export function trapFocus(event) {
  if(event.key!=='Tab')return;
  const focusable=[...event.currentTarget.querySelectorAll('button:not(:disabled),a[href],[tabindex="0"]')];
  const first=focusable[0],last=focusable.at(-1),active=document.activeElement;
  if(event.shiftKey&&(active===first||active===event.currentTarget)){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&(active===last||active===event.currentTarget)){event.preventDefault();first?.focus();}
}
export default function BogDock({engine,name='Ducky',profile:providedProfile,onExplore,onLeave=()=>{},onReturnToDock=()=>{},onOut,initialPanel='welcome',leaveLabel='Back to boat',...options}) {
  const [profile]=useState(()=>providedProfile??profileToken()),[team,setTeam]=useState(null),[panel,setPanel]=useState(initialPanel);
  const [data,setData]=useState(null),[status,setStatus]=useState('connecting'),[attempt,setAttempt]=useState(0);
  const dialog=useRef(null),leave=useRef(onLeave);leave.current=onLeave;
  // joining a team: the clouds close in while the match gets ready and part once the Ducky stands at its start spot
  const [clouds,setClouds]=useState(null);
  const join=id=>{
    if(clouds)return;
    if(!globalThis.window?.EWClouds){setTeam(id);return;}   // no cloud cover on this page (tests): straight in
    setClouds('wait');setTimeout(()=>setTeam(id),750);   // the game starts once the clouds have closed over the pick
  };
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
  const back=()=>leave.current();
  // one tree shape for every panel, so the clouds keep running from the pick into the game
  const cover=clouds&&<BogClouds text="Getting ready" ready={clouds==='ready'} onGone={()=>setClouds(null)}/>;
  if(team)return <><BogGame {...options} engine={engine} team={team} name={name} profile={profile} onLeave={back} onOut={onOut}
      onReady={()=>setClouds(c=>c==='wait'?'ready':c)}/>{cover}</>;
  const connected=status==='connected'&&data;
  const statusLine=<div className="bog-entry-status" role="status">{status==='disconnected'?<>The bog is unavailable. <button onClick={()=>setAttempt(n=>n+1)}>Reconnect</button></>:status==='connecting'?<FeatherWait text="Connecting to the bog"/>:'Ready to make a splash.'}</div>;
  if(panel==='welcome')return <BogWelcome dialog={dialog} onEnter={()=>setPanel('teams')} onExplore={onExplore} onLeave={onLeave} status={statusLine}/>;
  return <><BogTeamPick dialog={dialog} data={connected?data:null} onPlay={join} onLeave={onLeave} leaveLabel={leaveLabel} status={statusLine}/>{cover}</>;
}
