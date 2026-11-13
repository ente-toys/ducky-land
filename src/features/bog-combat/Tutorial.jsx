import {useEffect,useRef,useState} from 'react';
import {BOG_TIPS,createBogTutorial} from './tutorial.js';
import './tutorial.css';

export default function BogTutorial({identity,self,engine}){
  const [step,setStep]=useState(-1),controller=useRef(null),previous=useRef(null),visit=useRef(null);
  useEffect(()=>{
    if(!visit.current||visit.current.identity!==identity)visit.current={identity,tutorial:createBogTutorial({identity,onChange:setStep})};
    const tutorial=visit.current.tutorial;controller.current=tutorial;tutorial.start();
    return()=>{tutorial.dispose();if(controller.current===tutorial)controller.current=null;};
  },[identity]);
  useEffect(()=>{
    const before=previous.current;previous.current=self;
    if(!self)return;
    if(self.alive&&self.pace>0)controller.current?.action('move');
    if(before?.id===self.id&&self.alive&&self.ammo<before.ammo)controller.current?.action('shoot');
    if(self.alive===false)controller.current?.action('tagged');
  },[self]);
  const skip=()=>{controller.current?.skip();engine?.canvas?.focus({preventScroll:true});};
  if(step<0||step>=BOG_TIPS.length)return null;
  return <section className="bog-tutorial" aria-label="Bog tips">
    <svg aria-hidden="true" viewBox="0 0 48 48" width="40" height="40"><path d="M9 32C3 26 7 15 18 15C16 7 26 3 33 9C38 13 38 19 35 23C45 26 42 38 29 40C19 42 12 39 9 32Z" fill="#ffd525" stroke="#232323" strokeWidth="2.5" strokeLinejoin="round"/><path d="M32 19L43 22L33 26Z" fill="#ffab42" stroke="#232323" strokeWidth="2.5" strokeLinejoin="round"/><circle cx="29" cy="16" r="2" fill="#232323"/></svg>
    <div><span className="bog-tutorial-count">A little Bog know-how · {step+1} of 3</span><p role="status" aria-live="polite" aria-atomic="true">{BOG_TIPS[step]}</p></div>
    <button type="button" onClick={skip} aria-label="Skip Bog tips">Skip tips</button>
  </section>;
}
