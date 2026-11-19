import {useEffect,useRef,useState} from 'react';
import {dockArrival} from './entry.js';
import BogDock from './BogDock.jsx';
import BogClouds from './BogClouds.jsx';

export default function BogEntry({engine,travel,status,onLeave=()=>{},...options}) {
  const [open,setOpen]=useState(false),visited=useRef(false);
  // out of lives: the clouds close in over the bog and stay up through the paddle away (the dock closes under them),
  // then part where the Ducky ends up
  const [paddle,setPaddle]=useState(null),paddleTimer=useRef(0),paddling=useRef(false);
  const arrived=dockArrival(travel,status),game=engine?.current??engine;
  useEffect(()=>{
    if(!arrived){visited.current=false;setOpen(false);}
    else if(!visited.current){visited.current=true;setOpen(true);}
  },[arrived]);
  useEffect(()=>()=>clearTimeout(paddleTimer.current),[]);
  const leave=()=>{
    setOpen(false);onLeave();
    // give the camera a moment to settle where the Ducky ended up before the clouds part
    if(paddling.current){clearTimeout(paddleTimer.current);paddleTimer.current=setTimeout(()=>setPaddle(q=>q==='wait'?'ready':q),900);}
  };
  const clouds=paddle&&<BogClouds key="paddle" text="Paddling to an islet" ready={paddle==='ready'} onGone={()=>{paddling.current=false;setPaddle(null);}}/>;
  // one tree shape either way, so the clouds keep running when the dock closes under them
  return <>
    {arrived&&open&&game&&<BogDock {...options} engine={game} onExplore={()=>setOpen(false)} onLeave={leave} onOut={()=>{if(!paddling.current){paddling.current=true;setPaddle('wait');}}}/>}
    {clouds}
  </>;
}
