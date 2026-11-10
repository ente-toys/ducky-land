import {useEffect,useRef,useState} from 'react';
import {dockArrival} from './entry.js';
import BogDock from './BogDock.jsx';

// One team picker per landing. Closing it leaves the normal island available;
// sailing away re-arms it for the next visit. Guests never join a combat room.
export default function BogEntry({engine,travel,status,onLeave=()=>{},...options}) {
  const [open,setOpen]=useState(false),visited=useRef(false);
  const arrived=dockArrival(travel,status),game=engine?.current??engine;
  useEffect(()=>{
    if(!arrived){visited.current=false;setOpen(false);}
    else if(!visited.current){visited.current=true;setOpen(true);}
  },[arrived]);
  if(!arrived||!open||!game)return null;
  return <BogDock {...options} engine={game} onLeave={()=>{setOpen(false);onLeave();}}/>;
}
