import {useEffect,useRef,useState} from 'react';
import {attachBogCombat} from './attach.js';
import './combat.css';

export default function BogGame({engine,team,name='Ducky',profile,navigation,blockers,onLeave=()=>{},...options}) {
  const layer=useRef(null),leave=useRef(onLeave),[state,setState]=useState({status:'connecting'}),[attempt,setAttempt]=useState(0);
  leave.current=onLeave;
  useEffect(()=>{
    const abort=new AbortController();
    let active=true,current;setState({status:'connecting'});
    const timeout=setTimeout(()=>{if(active&&!current?.room.client.snapshot)setState({status:'disconnected',error:'The bog did not respond. Try reconnecting.'});},10000);
    attachBogCombat(engine,{...options,signal:abort.signal,team,name,profile,navigation,blockers,
      onLeave:totals=>leave.current(totals),
      onSnapshot:(snapshot,self)=>{if(active){clearTimeout(timeout);setState({status:'connected',snapshot,self});}},
      onStatus:(status,details)=>{if(active)setState(previous=>({...previous,status,error:details?`Connection closed (${details.code}): ${details.reason}`:null}));},
    }).then(value=>{current=value;if(!active)value.leave(false);else layer.current=value;})
      .catch(error=>{if(active)setState({status:'disconnected',error:error.message});});
    return()=>{active=false;abort.abort();clearTimeout(timeout);current?.leave(false);if(layer.current===current)layer.current=null;};
  },[engine,team,name,profile,navigation,blockers,attempt]);
  const {self,snapshot,status,error}=state;
  return <aside className="bog-combat-hud" aria-label="Bog paint game">
    <div className="bog-combat-score"><span>PRIVACY {snapshot?.scores.privacy??0}</span><span>GOOGLE {snapshot?.scores.google??0}</span></div>
    <p>Team {team==='privacy'?'PRIVACY':'GOOGLE'} · {self?.stats.tags??0} kills · {self?.stats.medals??0} medals</p>
    <p>{self?.alive===false?`Respawning in ${Math.max(1,Math.ceil(self.respawnAt-snapshot.time))}…`:self?`Paint ${self.ammo} / 12`:'Entering the bog…'}</p>
    <small>WASD / arrows · Shift to run · Space, J or left click to shoot · Esc to leave</small>
    {status!=='connected'&&<p role="status">{error||'Connecting…'}{status==='reconnecting'?' Reconnecting…':''}</p>}
    {status==='disconnected'&&<button onClick={()=>setAttempt(n=>n+1)}>Reconnect</button>}
    <button onClick={()=>{if(layer.current)layer.current.leave();else leave.current(null);}}>Back to dock</button>
  </aside>;
}
