import {useEffect,useRef,useState} from 'react';
import {RULES} from './rules.js';
import {attachBogCombat} from './attach.js';
import './combat.css';
import BogTutorial from './Tutorial.jsx';
import shieldArt from './assets/pickups/shield.svg?url';

const popperIcon=team=>`/pixi-art/themes/bog-arena/hud/${team==='karma'?'karma-padlock':'evil-rainbow'}-popper.svg`;

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
  // the shield pickup blocks one splat: show it with a countdown while it lasts, and a short flash when it is used up
  const shieldLeft=self?.alive&&self.hitShield>0?Math.max(0,(self.hitShieldUntil??0)-(snapshot?.time??0)):0;
  const hadShield=useRef(false),[blocked,setBlocked]=useState(false);
  useEffect(()=>{
    const had=hadShield.current;hadShield.current=shieldLeft>0;
    if(had&&shieldLeft<=0&&self?.alive&&(self.hitShieldUntil??0)>(snapshot?.time??0)){setBlocked(true);const t=setTimeout(()=>setBlocked(false),900);return()=>clearTimeout(t);}
  },[shieldLeft>0]);
  const mine=self?.team??team,lives=self?.lives??RULES.lives,ammo=self?.ammo??RULES.ammoCapacity,now=snapshot?.time??0;
  const note=self?.out?'Out of lives! Paddling to an islet…':self?.alive===false?`Respawning in ${Math.max(1,Math.ceil(self.respawnAt-now))}…`
    :self?.shieldUntil>now?`Hidden ${Math.ceil(self.shieldUntil-now)}s`:self?.bushHidden?'Hidden in bush':null;
  // Game HUD: your score top left, the team race top centre, the way out top right; hearts and paint at the bottom
  return <aside className="bog-hud" aria-label="Bog paint game">
    <div className="bog-hud-card bog-hud-me">
      <small>You · Team {mine==='karma'?'Karma':'Evil'}</small>
      <b>{self?.stats.tags??0} splats · {self?.stats.score??0} pts</b>
      {status!=='connected'&&<span role="status">{error||'Connecting…'}{status==='reconnecting'?' Reconnecting…':''}</span>}
      {status==='disconnected'&&<button onClick={()=>setAttempt(n=>n+1)}>Reconnect</button>}
    </div>
    <div className="bog-hud-card bog-hud-race" aria-label={`Evil ${snapshot?.scores.evil??0}, Karma ${snapshot?.scores.karma??0}`}>
      <span className="bog-hud-evil">Evil {snapshot?.scores.evil??0}</span><span className="bog-hud-karma">Karma {snapshot?.scores.karma??0}</span>
    </div>
    <button className="bog-hud-leave" onClick={()=>{if(layer.current)layer.current.leave();else leave.current(null);}}>{returnLabel}</button>
    <div className="bog-hud-bottom">
      {self&&<BogTutorial identity={accountId??profile??'local'} self={self} engine={engine}/>}
      <div className="bog-hud-card bog-hud-bar">
        <div className="bog-hud-group"><small>Hearts</small>
          <div className="bog-hud-hearts" role="img" aria-label={`${lives} of ${RULES.lives} hearts left`}>{Array.from({length:RULES.lives},(_,i)=><span key={i} aria-hidden="true" className={i<lives?'':'lost'}>♥</span>)}</div></div>
        {(shieldLeft>0||blocked)&&<><span className="bog-hud-sep" aria-hidden="true"/>
          <div className={`bog-hud-group bog-hud-shield${blocked?' is-blocked':''}`} role="status"><small>Shield</small>
            <div className="bog-hud-ammo"><img src={shieldArt} alt="" aria-hidden="true"/><b>{blocked?'Blocked!':`${Math.ceil(shieldLeft)}s`}</b></div></div></>}
        <span className="bog-hud-sep" aria-hidden="true"/>
        <div className="bog-hud-group"><small>{note?'Status':`Paint ${ammo}/${RULES.ammoCapacity}`}</small>
          <div className="bog-hud-ammo"><img className="bog-combat-popper-icon" src={popperIcon(mine)} alt="" aria-hidden="true"/>
            {note?<span className="bog-hud-note" role="status">{note}</span>
              :<div className={`bog-hud-paint bog-hud-paint-${mine}`} role="img" aria-label={`Paint ${ammo} of ${RULES.ammoCapacity}`}>{Array.from({length:RULES.ammoCapacity},(_,i)=><i key={i} className={i<ammo?'':'empty'}/>)}</div>}
          </div></div>
      </div>
    </div>
  </aside>;
}
