import {memo, useEffect, useState} from 'react';
import {MAP_BOUNDS, WORLD_ISLANDS, worldIsland} from './world-map.js';
import {mapOf} from './island-maps.js';

const width = 1000;
const scale = width / (MAP_BOUNDS.x1 - MAP_BOUNDS.x0);
const height = (MAP_BOUNDS.y1 - MAP_BOUNDS.y0) * scale;
const project = (x, y) => ({
  x: ((x - MAP_BOUNDS.x0) * scale % width + width) % width,
  y: (y - MAP_BOUNDS.y0) * scale,
});
const outlines = WORLD_ISLANDS.map(island => {
  const map = mapOf(island.id);
  const centre = project(island.x, island.y);
  const path = map.walk.coast.map(([x, y], index) =>
    `${index ? 'L' : 'M'}${(centre.x + (x - map.width / 2) * scale).toFixed(2)},${(centre.y + (y - map.height / 2) * scale).toFixed(2)}`).join(' ') + 'Z';
  return {...island, path};
});
const Islands = memo(function Islands() {
  return <g fill="#8cba54" stroke="#f9e2a0" strokeWidth="1.5">
    {outlines.map(island => <path key={island.id} d={island.path}>
      <title>{island.name}</title>
    </path>)}
  </g>;
});

export default function WorldMap({island}) {
  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState(null);
  useEffect(() => {
    function update() {
      const engine = island.current;
      if (!engine?.ready) return;
      const home = worldIsland(engine.islandId);
      if (!home) return;
      const map = mapOf(engine.islandId);
      const worldPoint = point => project(home.x + point.x - map.width / 2, home.y + point.y - map.height / 2);
      const view = worldPoint(engine.camera);
      const player = engine.player ? worldPoint(engine.player) : null;
      // Round to map pixels: camera animation must not redraw the HUD every frame.
      const next = {x: Math.round(view.x), y: Math.round(view.y),
        player: player ? {x: Math.round(player.x), y: Math.round(player.y)} : null};
      setPosition(previous => previous?.x === next.x && previous?.y === next.y &&
        previous?.player?.x === next.player?.x && previous?.player?.y === next.player?.y ? previous : next);
    }
    update();
    const timer = setInterval(update, 200);
    return () => clearInterval(timer);
  }, [island]);

  return <aside className={`pixi-world-map${expanded ? ' pixi-world-map--expanded' : ''}`} aria-label="World map">
    <button type="button" className="pixi-world-map-heading" aria-expanded={expanded}
      aria-controls="pixi-world-map-view" onClick={() => setExpanded(value => !value)}>
      <span>World map</span><span aria-hidden="true">{expanded ? '↙' : '↗'}</span>
      <span className="pixi-world-map-sr">{expanded ? 'Shrink map' : 'Expand map'}</span>
    </button>
    <svg id="pixi-world-map-view" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Islands across the world. White ring: current view. Yellow dot: your duck.">
      <Islands/>
      {position && <g fill="none" stroke="#fff9df" strokeWidth="3">
        <circle cx={position.x} cy={position.y} r="15"/>
        <path d={`M${position.x - 23},${position.y}h10 M${position.x + 13},${position.y}h10 M${position.x},${position.y - 23}v10 M${position.x},${position.y + 13}v10`}/>
      </g>}
      {position?.player && <circle cx={position.player.x} cy={position.player.y} r="9" fill="#ffda69" stroke="#564537" strokeWidth="3"><title>Your duck</title></circle>}
    </svg>
    <div className="pixi-world-map-key"><span>◯ View</span>{position?.player && <span>🟡 You</span>}</div>
  </aside>;
}
