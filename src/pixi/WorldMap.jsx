import {useEffect, useRef, useState} from 'react';
import {worldIsland} from './world-map.js';
import {nearbyMapFrame, nearbyHeading, NEARBY_MAP_WIDTH, NEARBY_MAP_HEIGHT} from './nearby-map.js';
import {BOG_RADAR_ICON, BOG_RADAR_SIZE_PX} from './bog-radar.js';

const width = 1000;
const scale = width / NEARBY_MAP_WIDTH;
const height = NEARBY_MAP_HEIGHT * scale;
export default function WorldMap({island}) {
  const movement = useRef(null);
  const svg = useRef(null);
  const radar = useRef(null);
  if (!radar.current) radar.current = {x: 0, y: 0, visible: false};
  const [iconSize, setIconSize] = useState(125);
  const [frame, setFrame] = useState({islands: [], playing: false, heading: 0, bogX: 0, bogY: 0, bogVisible: false});
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setIconSize(BOG_RADAR_SIZE_PX * width / entry.contentRect.width);
    });
    observer.observe(svg.current);
    return () => observer.disconnect();
  }, []);
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
      // The SVG fills the content box; the 4 px CSS border's centre is 2 px beyond it.
      const outlineRadius = width / 2 + 2 * iconSize / BOG_RADAR_SIZE_PX;
      const islands = nearbyMapFrame(engine.islandId, engine.player ?? engine.camera, radar.current,
        outlineRadius / scale).map(item => ({
        ...item, art: engine.archipelago?.thumbnailOf(item.id) ?? null, x: Math.round(item.x * scale * 4) / 4, y: Math.round(item.y * scale * 4) / 4,
      }));
      const bogX = radar.current.x * scale, bogY = radar.current.y * scale, bogVisible = radar.current.visible;
      setFrame(previous => previous.playing === playing && previous.heading === heading && previous.bogX === bogX && previous.bogY === bogY && previous.bogVisible === bogVisible && islands.every((item, index) => {
        const old = previous.islands[index];
        return old?.id === item.id && old.art === item.art && old.x === item.x && old.y === item.y && Math.abs(old.bearing-item.bearing)<.1;
      }) ? previous : {islands, playing, heading, bogX, bogY, bogVisible});
    }
    update();
    const timer = setInterval(update, 80);
    return () => clearInterval(timer);
  }, [island, iconSize]);

  return <aside className="pixi-world-map" aria-label="Nearby islands">
    <svg ref={svg} id="pixi-world-map-view" viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label={`Three nearest islands, cropped around ${frame.playing ? 'your duck. White arrow: your duck and direction' : 'the current view. White dot: view centre'}. Paint gun badge: Booquack Bog, pinned to the rim when distant.`}>
      <defs><clipPath id="pixi-world-map-terrain-clip"><circle cx={width / 2} cy={height / 2} r={width / 2}/></clipPath></defs>
      <g clipPath="url(#pixi-world-map-terrain-clip)">
        {frame.islands.map(item => <g className="pixi-nearby-island" key={item.id}
          style={{transform: `translate(${width / 2 + item.x}px, ${height / 2 + item.y}px)`}}>
          <title>{worldIsland(item.id).name}</title>
          {item.art && <image href={item.art.src} x={-item.art.width * scale / 2} y={-item.art.height * scale / 2}
            width={item.art.width * scale} height={item.art.height * scale} transform={`rotate(${item.bearing})`}/>}
        </g>)}
      </g>
      {frame.bogVisible && <circle cx={width / 2 + frame.bogX} cy={height / 2 + frame.bogY} r={iconSize * .56}
        fill="none" stroke="#f6c64a" strokeWidth={iconSize * .14}/>}
      {frame.bogVisible && <image href={BOG_RADAR_ICON}
        x={width / 2 + frame.bogX - iconSize / 2} y={height / 2 + frame.bogY - iconSize / 2}
        width={iconSize} height={iconSize}><title>Booquack Bog</title></image>}
      {frame.playing
        ? <path d="M0,-31 L22,25 L0,14 L-22,25Z" fill="#fff" stroke="#20272a" strokeWidth="9"
          strokeLinejoin="round" transform={`translate(${width / 2} ${height / 2}) rotate(${frame.heading})`}><title>Your duck</title></path>
        : <circle cx={width / 2} cy={height / 2} r="14" fill="#fff" stroke="#20272a" strokeWidth="7"><title>View centre</title></circle>}
    </svg>
  </aside>;
}
