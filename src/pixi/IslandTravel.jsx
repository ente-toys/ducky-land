
import {useEffect, useState} from 'react';

export default function IslandTravel({travel,playing,room,island,notice}) {
  const sailing=playing && travel.mode==='sailing';
  const [options,setOptions]=useState({});
  useEffect(() => {
    if (!playing) {setOptions({}); return;}
    const id=setInterval(() => {
      const next=island.current?.travelOptions?.() ?? {};
      setOptions(prev => prev.take === next.take && prev.dock === next.dock ? prev : next);
    }, 250);
    return () => clearInterval(id);
  }, [playing, island]);
  function steer(event,x,y) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (island.current) island.current.touchInput={x,y};
  }
  function stop() { island.current?.stopInput(); }
  const touch=typeof matchMedia==='function' && matchMedia('(pointer: coarse)').matches;
  return <>
    {notice && <p className="pixi-travel-notice" role="status">{notice}</p>}
    {(options.take || options.dock) && <button className="pixi-travel-action" onClick={() => island.current?.travelAction()}>
      {options.take ? 'Take boat' : 'Dock'} <kbd>Enter</kbd>
    </button>}
    {sailing && touch && <div className="pixi-steering" aria-label="Boat steering">
      {[[0,-1,'↑','North'],[-1,0,'←','West'],[0,1,'↓','South'],[1,0,'→','East']].map(([x,y,arrow,name]) =>
        <button key={name} aria-label={`Steer ${name.toLowerCase()}`} onPointerDown={event => steer(event,x,y)}
          onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}
          onKeyDown={event => {if ([' ','Enter'].includes(event.key)) {event.preventDefault(); if (island.current) island.current.touchInput={x,y};}}}
          onKeyUp={stop} onBlur={stop}>{arrow}</button>)}
    </div>}
  </>;
}
