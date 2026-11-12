import {useEffect,useRef,useState} from 'react';
import {RULES} from './rules.js';
import {attachBogCombat} from './attach.js';
import './combat.css';
import DodgePip from './DodgePip.jsx';
import BogTutorial from './Tutorial.jsx';

const popperIcon=team=>`/pixi-art/themes/bog-arena/hud/${team==='privacy'?'privacy-padlock':'google-rainbow'}-popper.svg`;

export default function BogGame({engine,team,name='Ducky',profile,accountId,navigation,blockers,onLeave=()=>{},returnLabel='Back to boat',...options}) {
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
    {self&&<BogTutorial identity={accountId??profile??'local'} self={self} engine={engine}/>}
    <div className="bog-combat-score"><span>SCORE {self?.stats.score??0}</span><span>{self?.stats.tags??0} TAGS</span></div>
    <p>Team {(self?.team??team)==='privacy'?'PRIVACY':'GOOGLE'} · {self?.stats.tags??0} kills · {self?.stats.medals??0} medals{self&&` · ${self.karma??0} feathers`}</p>
    <div className="bog-combat-lives" role="img" aria-label={`${self?.lives??RULES.lives} lives left`}>{Array.from({length:RULES.lives},(_,i)=><span key={i} aria-hidden="true" className={i<(self?.lives??RULES.lives)?'':'lost'}>♥</span>)}</div>
    <p><img className="bog-combat-popper-icon" src={popperIcon(self?.team??team)} alt="" aria-hidden="true"/>{self?.out?'Out of lives! Paddling to an islet…':self?.alive===false?`Respawning in ${Math.max(1,Math.ceil(self.respawnAt-snapshot.time))}…`:self?`${self.shieldUntil>snapshot.time?`Hidden ${Math.ceil(self.shieldUntil-snapshot.time)}s · `:self.bushHidden?'Hidden in bush · ':''}Paint ${self.ammo} / 12`:'Entering the bog…'}<DodgePip self={self} time={snapshot?.time}/></p>
    <small>WASD / arrows · Shift to run · Q to hop · Space, J or left click to shoot · Esc to leave</small>
    {status!=='connected'&&<p role="status">{error||'Connecting…'}{status==='reconnecting'?' Reconnecting…':''}</p>}
    {status==='disconnected'&&<button onClick={()=>setAttempt(n=>n+1)}>Reconnect</button>}
    <button onClick={()=>{if(layer.current)layer.current.leave();else leave.current(null);}}>{returnLabel}</button>
  </aside>;
}
