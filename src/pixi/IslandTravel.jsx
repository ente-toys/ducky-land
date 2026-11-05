// boss 5 Nov: the travel panel is gone; this keeps only the boat notice and the touch steering pad

export default function IslandTravel({travel,playing,room,island,notice}) {
  const sailing=playing && travel.mode==='sailing';
  function steer(event,x,y) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (island.current) island.current.touchInput={x,y};
  }
  function stop() { island.current?.stopInput(); }
  // boss 5 Nov: no travel panel; tap a boat to board, tap an island or the harbor to dock. Only a short notice and, on touch screens, the steering pad stay
  const touch=typeof matchMedia==='function' && matchMedia('(pointer: coarse)').matches;
  return <>
    {notice && <p className="pixi-travel-notice" role="status">{notice}</p>}
    {sailing && touch && <div className="pixi-steering" aria-label="Boat steering">
      {[[0,-1,'↑','North'],[-1,0,'←','West'],[0,1,'↓','South'],[1,0,'→','East']].map(([x,y,arrow,name]) =>
        <button key={name} aria-label={`Steer ${name.toLowerCase()}`} onPointerDown={event => steer(event,x,y)}
          onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}
          onKeyDown={event => {if ([' ','Enter'].includes(event.key)) {event.preventDefault(); if (island.current) island.current.touchInput={x,y};}}}
          onKeyUp={stop} onBlur={stop}>{arrow}</button>)}
    </div>}
  </>;
}
