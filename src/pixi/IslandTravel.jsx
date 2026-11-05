import {ISLANDS, islandFor} from './islands.js';

export default function IslandTravel({travel,playing,room,island,notice}) {
  const sailing=playing && travel.mode==='sailing';
  function steer(event,x,y) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (island.current) island.current.touchInput={x,y};
  }
  function stop() { island.current?.stopInput(); }
  return <aside className="pixi-travel" aria-label="Island travel">
    <strong>{islandFor(travel.islandId).name}</strong>
    {!playing && <label>Watch island
      <select value={travel.islandId} onChange={event => room.current?.watch(event.target.value)}>
        {ISLANDS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>}
    <p>{sailing ? 'WASD / arrows or tap water to row north through the clouds. Approach a named island’s pier to dock.'
      : playing ? 'Tap a boat to walk aboard, then row outward to discover other islands.'
      : 'Watch Duckies sail between three islands. Sign in to take a boat.'}</p>
    <div className="pixi-travel-actions">
      <button onClick={() => island.current?.focusHarbor()}>Find harbor</button>
      {playing && !sailing && <button disabled={!travel.available} onClick={() => {
        const boat=room.current?.boats.find(boat => !boat.occupant);
        if (boat) {room.current.board(boat.id); island.current?.focusHarbor();}
      }}>{travel.available ? 'Board a boat' : 'All boats are away'}</button>}
      {sailing && <button onClick={() => room.current?.disembark()}>Dock here</button>}
    </div>
    {notice && <p role="status">{notice}</p>}
    {sailing && <div className="pixi-steering" aria-label="Boat steering">
      {[[0,-1,'↑','North'],[-1,0,'←','West'],[0,1,'↓','South'],[1,0,'→','East']].map(([x,y,arrow,name]) =>
        <button key={name} aria-label={`Steer ${name.toLowerCase()}`} onPointerDown={event => steer(event,x,y)}
          onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}
          onKeyDown={event => {if ([' ','Enter'].includes(event.key)) {event.preventDefault(); if (island.current) island.current.touchInput={x,y};}}}
          onKeyUp={stop} onBlur={stop}>{arrow}</button>)}
    </div>}
  </aside>;
}
