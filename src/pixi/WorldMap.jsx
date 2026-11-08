import {useEffect, useRef, useState} from 'react';
import {worldIsland} from './world-map.js';
import {nearbyMapFrame, nearbyHeading, NEARBY_MAP_WIDTH, NEARBY_MAP_HEIGHT} from './nearby-map.js';

const width = 1000;
const scale = width / NEARBY_MAP_WIDTH;
const height = NEARBY_MAP_HEIGHT * scale;
export default function WorldMap({island}) {
  const movement = useRef(null);
  const [frame, setFrame] = useState({islands: [], playing: false, heading: 0});
  useEffect(() => {
    function update() {
      const engine = island.current;
      if (!engine?.ready) return;
      const playing = Boolean(engine.player);
      const player = engine.player;
      const previous = movement.current;
      let heading = previous?.heading ?? 0;
      if (player && previous?.islandId === engine.islandId) {
        const dx = player.x - previous.x, dy = player.y - previous.y;
        if (Math.hypot(dx, dy) > 1) heading = nearbyHeading(engine.islandId,player,dx,dy);
      }
      movement.current = player ? {x: player.x, y: player.y, islandId: engine.islandId, heading} : null;
      const islands = nearbyMapFrame(engine.islandId, engine.player ?? engine.camera).map(item => ({
        ...item, art: engine.archipelago?.thumbnailOf(item.id) ?? null, x: Math.round(item.x * scale * 4) / 4, y: Math.round(item.y * scale * 4) / 4,
      }));
      setFrame(previous => previous.playing === playing && previous.heading === heading && islands.every((item, index) => {
        const old = previous.islands[index];
        return old?.id === item.id && old.art === item.art && old.x === item.x && old.y === item.y && Math.abs(old.bearing-item.bearing)<.1;
      }) ? previous : {islands, playing, heading});
    }
    update();
    const timer = setInterval(update, 80);
    return () => clearInterval(timer);
  }, [island]);

  return <aside className="pixi-world-map" aria-label="Nearby islands">
    <svg id="pixi-world-map-view" viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label={`Three nearest islands, cropped around ${frame.playing ? 'your duck. White arrow: your duck and direction' : 'the current view. White dot: view centre'}.`}>
      <g>
        {frame.islands.map(item => <g className="pixi-nearby-island" key={item.id}
          style={{transform: `translate(${width / 2 + item.x}px, ${height / 2 + item.y}px)`}}>
          <title>{worldIsland(item.id).name}</title>
          {item.art && <image href={item.art.src} x={-item.art.width * scale / 2} y={-item.art.height * scale / 2}
            width={item.art.width * scale} height={item.art.height * scale} transform={`rotate(${item.bearing})`}/>}
        </g>)}
      </g>
      {frame.playing
        ? <path d="M0,-31 L22,25 L0,14 L-22,25Z" fill="#fff" stroke="#20272a" strokeWidth="9"
          strokeLinejoin="round" transform={`translate(${width / 2} ${height / 2}) rotate(${frame.heading})`}><title>Your duck</title></path>
        : <circle cx={width / 2} cy={height / 2} r="14" fill="#fff" stroke="#20272a" strokeWidth="7"><title>View centre</title></circle>}
    </svg>
  </aside>;
}
