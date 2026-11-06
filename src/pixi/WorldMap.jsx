import {useEffect, useState} from 'react';
import {worldIsland} from './world-map.js';
import {mapOf} from './island-maps.js';
import {nearbyMapFrame, NEARBY_MAP_WIDTH, NEARBY_MAP_HEIGHT} from './nearby-map.js';

const width = 1000;
const scale = width / NEARBY_MAP_WIDTH;
const height = NEARBY_MAP_HEIGHT * scale;
const outlines = new Map();
function outline(id) {
  if (!outlines.has(id)) {
    const map = mapOf(id);
    outlines.set(id, map.walk.coast.map(([x, y], index) =>
      `${index ? 'L' : 'M'}${((x - map.width / 2) * scale).toFixed(2)},${((y - map.height / 2) * scale).toFixed(2)}`).join(' ') + 'Z');
  }
  return outlines.get(id);
}

export default function WorldMap({island}) {
  const [frame, setFrame] = useState({islands: [], playing: false});
  useEffect(() => {
    function update() {
      const engine = island.current;
      if (!engine?.ready) return;
      const playing = Boolean(engine.player);
      const islands = nearbyMapFrame(engine.islandId, engine.player ?? engine.camera).map(item => ({
        ...item, x: Math.round(item.x * scale * 4) / 4, y: Math.round(item.y * scale * 4) / 4,
      }));
      setFrame(previous => previous.playing === playing && islands.every((item, index) => {
        const old = previous.islands[index];
        return old?.id === item.id && old.x === item.x && old.y === item.y;
      }) ? previous : {islands, playing});
    }
    update();
    const timer = setInterval(update, 80);
    return () => clearInterval(timer);
  }, [island]);

  return <aside className="pixi-world-map" aria-label="Nearby islands">
    <svg id="pixi-world-map-view" viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label={`Three nearest islands, cropped around ${frame.playing ? 'your duck. Yellow dot: you' : 'the current view. White ring: view centre'}.`}>
      <g fill="#8cba54" stroke="#f9e2a0" strokeWidth="8">
        {frame.islands.map(item => <path className="pixi-nearby-island" key={item.id} d={outline(item.id)}
          style={{transform: `translate(${width / 2 + item.x}px, ${height / 2 + item.y}px)`}}>
          <title>{worldIsland(item.id).name}</title>
        </path>)}
      </g>
      <circle cx={width / 2} cy={height / 2} r="17" fill={frame.playing ? '#ffda69' : 'none'}
        stroke={frame.playing ? '#564537' : '#fff9df'} strokeWidth="7"><title>{frame.playing ? 'Your duck' : 'View centre'}</title></circle>
    </svg>
  </aside>;
}
