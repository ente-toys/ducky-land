import {useEffect,useRef,useState} from 'react';
import {RULES} from './rules.js';
import {attachBogCombat} from './attach.js';
import './combat.css';
import BogTutorial from './Tutorial.jsx';
import shieldArt from './assets/pickups/shield.svg?url';

// a heart with Ducky's outline (combat.css colours it: full, emptying a third per hit, lost)
const HEART='M14 24C6 18 2 14 2 8.5 2 5 4.7 2.5 8 2.5c2.5 0 4.6 1.4 6 3.6 1.4-2.2 3.5-3.6 6-3.6 3.3 0 6 2.5 6 6 0 5.5-4 9.5-12 15.5Z';
const popperIcon=team=>`/pixi-art/themes/bog-arena/hud/${team==='karma'?'karma-padlock':'evil-rainbow'}-popper.svg`;

export default function BogGame({engine,team,name='Ducky',profile,accountId,navigation,blockers,onLeave=()=>{},onReady,onOut,returnLabel='Back to boat',...options}) {
  const layer=useRef(null),leave=useRef(onLeave),[state,setState]=useState({status:'connecting'}),[attempt,setAttempt]=useState(0);
  leave.current=onLeave;
  const ready=useRef(onReady),out=useRef(onOut);ready.current=onReady;out.current=onOut;
  useEffect(()=>{
    const abort=new AbortController();
    let active=true,current;setState({status:'connecting'});
    let timeout=setTimeout(()=>{
      if(!active)return;
      abort.abort();
      setState({status:'disconnected',error:'The bog did not finish loading. Try reconnecting.'});
    },25000);
    attachBogCombat(engine,{...options,signal:abort.signal,team,name,profile,navigation,blockers,
      onLeave:totals=>leave.current(totals),
      onSnapshot:(snapshot,self)=>{if(active){clearTimeout(timeout);setState({status:'connected',snapshot,self});if(self)ready.current?.();}},
      onStatus:(status,details)=>{if(active)setState(previous=>({...previous,status,error:details?`Connection closed (${details.code}): ${details.reason}`:null}));},
    }).then(value=>{
      clearTimeout(timeout);
      current=value;
      if(!active){value.leave(false);return;}
      layer.current=value;
      if(!value.room.client.snapshot)timeout=setTimeout(()=>{
        if(active&&!value.room.client.snapshot)setState({status:'disconnected',error:'The bog did not respond. Try reconnecting.'});
      },10000);
    })
    .catch(error=>{
      clearTimeout(timeout);
      if(active&&!abort.signal.aborted)setState({status:'disconnected',error:error.message});
    });
    return()=>{active=false;abort.abort();clearTimeout(timeout);current?.leave(false);if(layer.current===current)layer.current=null;};
  },[engine,team,name,profile,navigation,blockers,attempt]);
  const {self,snapshot,status,error}=state;
  const waiting=status==='connecting'||status==='reconnecting';
  const connectionText=status==='reconnecting'?'Reconnecting':'Connecting to the bog';
  const loader=status!=='connected'?globalThis.window?.EWArrival?.loader?.(waiting?connectionText:''):null;
  // out of lives: the clouds close in now and part where the Ducky paddles to (BogEntry)
  useEffect(()=>{if(self?.out)out.current?.();},[self?.out]);
  // the shield pickup blocks one splat: show it with a countdown while it lasts, and a short flash when it is used up
  const shieldLeft=self?.alive&&self.hitShield>0?Math.max(0,(self.hitShieldUntil??0)-(snapshot?.time??0)):0;
  const hadShield=useRef(false),[blocked,setBlocked]=useState(false);
  useEffect(()=>{
    const had=hadShield.current;hadShield.current=shieldLeft>0;
    if(had&&shieldLeft<=0&&self?.alive&&(self.hitShieldUntil??0)>(snapshot?.time??0)){setBlocked(true);const t=setTimeout(()=>setBlocked(false),900);return()=>clearTimeout(t);}
  },[shieldLeft>0]);
  const mine=self?.team??team,lives=self?.lives??RULES.lives,hits=self?.alive!==false?(self?.hits??0):0,hurt=hits>0,ammo=self?.ammo??RULES.ammoCapacity,now=snapshot?.time??0;
  const note=self?.out?'Out of lives! Paddling to an islet…':self?.alive===false?`Respawning in ${Math.max(1,Math.ceil(self.respawnAt-now))}…`
    :self?.shieldUntil>now?`Hidden ${Math.ceil(self.shieldUntil-now)}s`:self?.bushHidden?'Hidden in bush':null;
  // Game HUD: your score top left, the way out top right; hearts and paint at the bottom (no team score bar: boss)
  return <aside className="bog-hud" aria-label="Bog paint game">
    <div className="bog-hud-card bog-hud-me">
      <small>You · Team {mine==='karma'?'Karma':'Evil'}</small>
      <b>{self?.stats.tags??0} splats · {self?.stats.score??0} pts</b>
    </div>
    <button className="bog-hud-leave" onClick={()=>{if(layer.current)layer.current.leave();else leave.current(null);}}>{returnLabel}</button>
    <div className="bog-hud-bottom">
      {self&&<BogTutorial identity={accountId??profile??'local'} self={self} engine={engine}/>}
      <div className="bog-hud-card bog-hud-bar">
        <div className="bog-hud-group"><small>Hearts</small>
          <div className="bog-hud-hearts" role="img" aria-label={`${lives} of ${RULES.lives} hearts left${hurt?`, ${hits} of ${RULES.hitsPerHeart} hits taken`:''}`}><svg width="0" height="0" style={{position:'absolute'}}><linearGradient id="bog-heart-part"><stop offset={1-hits/RULES.hitsPerHeart} stopColor="#ff5f7a"/><stop offset={1-hits/RULES.hitsPerHeart} stopColor="#e9e1c6"/></linearGradient></svg>
          {Array.from({length:RULES.lives},(_,i)=><svg key={i} aria-hidden="true" viewBox="0 0 28 26" className={i>=lives?'lost':hurt&&i===lives-1?'part':''}><path d={HEART}/></svg>)}</div></div>
        {(shieldLeft>0||blocked)&&<><span className="bog-hud-sep" aria-hidden="true"/>
          <div className={`bog-hud-group bog-hud-shield${blocked?' is-blocked':''}`} role="status"><small>Shield</small>
            <div className="bog-hud-ammo"><img src={shieldArt} alt="" aria-hidden="true"/><b>{blocked?'Blocked!':`${Math.ceil(shieldLeft)}s`}</b></div></div></>}
        <span className="bog-hud-sep" aria-hidden="true"/>
        <div className="bog-hud-group"><small>{note?'Status':`Paint ${ammo}/${RULES.ammoCapacity}`}</small>
          <div className="bog-hud-ammo"><img className="bog-combat-popper-icon" src={popperIcon(mine)} alt="" aria-hidden="true"/>
            {note?<span className="bog-hud-note" role="status">{note}</span>
              :<div className={`bog-hud-paint bog-hud-paint-${mine}`} role="img" aria-label={`Paint ${ammo} of ${RULES.ammoCapacity}`}>{Array.from({length:12},(_,i)=><i key={i} className={i<Math.ceil(ammo/RULES.ammoCapacity*12)?'':'empty'}/>)}</div>}
          </div></div>
      </div>
    </div>
    {(waiting||status==='disconnected')&&<div className={`bog-connection${waiting?' bog-connection--wait':''}`} key={status}>
      <div className="bog-connection-content" role={waiting?'status':'alertdialog'} aria-live="polite" aria-label={waiting?connectionText:'Disconnected from the bog'}>
        <div className="arrival-loader" aria-hidden="true" dangerouslySetInnerHTML={{__html:loader||''}}/>
        {waiting?!loader&&<p>{connectionText}</p>:<><p>{error||'Disconnected from the bog. Try reconnecting.'}</p><button onClick={()=>setAttempt(n=>n+1)}>Reconnect</button></>}
      </div>
    </div>}
  </aside>;
}
