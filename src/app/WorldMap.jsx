import {useEffect, useRef, useState} from 'react';
import {worldIsland} from '../world/world-map.js';
import {nearbyMapFrame, nearbyHeading, NEARBY_MAP_WIDTH, NEARBY_MAP_HEIGHT} from './nearby-map.js';
import {BOG_RADAR_ICON, BOG_RADAR_SIZE_PX} from '../features/bog-combat/bog-radar.js';
import {mapOf} from '../world/island-maps.js';

const width = 1000;
const scale = width / NEARBY_MAP_WIDTH;
const height = NEARBY_MAP_HEIGHT * scale;
// A minimal map: each island is its exact coastline in its real ground colour (sampled from its ground art), with a
// sand rim, its rivers and ponds cut out in sea blue, and a dock dot. No island pictures are loaded for it.
const GROUND = {home:'#93b72f', sunflower:'#98b933', pink:'#8fc63c', library:'#93b730', community:'#93b72f',
  fair:'#9cc63e', cathedral:'#f0dc8e', bog:'#815984', snow:'#f7f5fe'};
const SEA = '#6ec9de', SAND = '#f1e08f', BOAT = '/pixi-art/boat/spin/boat-00.svg';
const shapes = new Map();
function islandShape(id) {
  if (shapes.has(id)) return shapes.get(id);
  const map = mapOf(id), point = ([x, y]) => `${Math.round((x - map.cx) * scale)},${Math.round((y - map.cy) * scale)}`;
  const line = (poly, most) => {
    const step = Math.max(1, Math.floor(poly.length / most));
    return 'M' + poly.filter((_, i) => i % step === 0 || i === poly.length - 1).map(point).join('L');
  };
  const outline = poly => line(poly, 160) + 'Z';   // ~160 points is plenty at this size
  const oval = (x, y, rx, ry) => Array.from({length: 24}, (_, i) => [x + Math.cos(i * Math.PI / 12) * rx, y + Math.sin(i * Math.PI / 12) * ry]);
  const coast = outline(map.world.coast);
  const d = [coast, ...(map.world.islets ?? []).map(([x, y, rx, ry]) => outline(oval(x, y, rx, ry)))].join('');
  // rivers and ponds; pieces smaller than a couple of map pixels are skipped
  const water = (map.world.water ?? []).map(w => w.poly?.length ? w.poly : w.rx ? oval(w.x, w.y, w.rx, w.ry) : null)
    .filter(poly => poly && Math.max(...poly.map(p => p[0])) - Math.min(...poly.map(p => p[0])) > 24)
    .map(outline).join('');
  // the island's walking paths, as faint lines
  const paths = (map.world.paths ?? []).filter(path => path.length > 1).map(path => line(path, 40)).join('');
  const dock = map.HARBOR.land, shape = {id, d, coast, water, paths, fill: GROUND[map.id] ?? GROUND.home,
    dock: {x: Math.round((dock.x - map.cx) * scale), y: Math.round((dock.y - map.cy) * scale)}};
  shapes.set(id, shape);
  return shape;
}

export default function WorldMap({island, globeOpen = false, indoors = false}) {
  const movement = useRef(null);
  const svg = useRef(null);
  const radar = useRef(null);
  if (!radar.current) radar.current = {x: 0, y: 0, visible: false};
  const [iconSize, setIconSize] = useState(125);
  const [frame, setFrame] = useState({islands: [], playing: false, heading: 0, bogX: 0, bogY: 0, bogVisible: false, here: '', boats: ''});
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
      const outlineRadius = width / 2 + 2 * iconSize / BOG_RADAR_SIZE_PX;
      const islands = nearbyMapFrame(engine.islandId, engine.player ?? engine.camera, radar.current,
        outlineRadius / scale).map(item => ({
        ...item, x: Math.round(item.x * scale * 4) / 4, y: Math.round(item.y * scale * 4) / 4,
      }));
      const bogX = radar.current.x * scale, bogY = radar.current.y * scale, bogVisible = radar.current.visible;
      // free boats around the island you are on (the server only sends this island's boats)
      const here = engine.islandId, map = mapOf(here);
      const boats = (engine.room?.boats ?? []).filter(boat => !boat.occupant && boat.islandId === here)
        .map(boat => `${Math.round((boat.x - map.cx) * scale)},${Math.round((boat.y - map.cy) * scale)}`).join(' ');
      setFrame(previous => previous.here === here && previous.boats === boats && previous.playing === playing && previous.heading === heading && previous.bogX === bogX && previous.bogY === bogY && previous.bogVisible === bogVisible && islands.every((item, index) => {
        const old = previous.islands[index];
        return old?.id === item.id && old.x === item.x && old.y === item.y && Math.abs(old.bearing-item.bearing)<.1;
      }) ? previous : {islands, playing, heading, bogX, bogY, bogVisible, here, boats});
    }
    update();
    const timer = setInterval(update, 80);
    return () => clearInterval(timer);
  }, [island, iconSize]);

  // Click the minimap to open the world view (the globe); on the globe it steps aside for a Back button.
  useEffect(() => {
    if (!globeOpen) return;
    const key = event => {if (event.key === 'Escape') island.current?.closeGlobe();};
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [globeOpen, island]);
  return <>
  {globeOpen && <button type="button" className="pixi-world-back" onClick={() => island.current?.closeGlobe()}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="#564537" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
    Back to island</button>}
  <button type="button" className={`pixi-world-map${globeOpen ? ' pixi-world-map--hidden' : ''}`} disabled={indoors || globeOpen}
    aria-label="Open the world view" title="Open the world view" onClick={() => island.current?.openGlobe()}>
    <svg ref={svg} id="pixi-world-map-view" viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label={`Three nearest islands, cropped around ${frame.playing ? 'your duck. White arrow: your duck and direction' : 'the current view. White dot: view centre'}. Paint gun badge: Booquack Bog, pinned to the rim when distant.`}>
      <defs>
        <clipPath id="pixi-world-map-terrain-clip"><circle cx={width / 2} cy={height / 2} r={width / 2}/></clipPath>
        <pattern id="pixi-world-map-waves" width="180" height="120" patternUnits="userSpaceOnUse">
          <path d="M20 40q15-12 30 0M110 100q15-12 30 0" fill="none" stroke="#fff" strokeOpacity=".2" strokeWidth="5" strokeLinecap="round"/>
        </pattern>
      </defs>
      <g clipPath="url(#pixi-world-map-terrain-clip)">
        <rect width={width} height={height} fill="url(#pixi-world-map-waves)"/>
        {frame.islands.map(item => {
          const island = worldIsland(item.id), shape = islandShape(item.id);
          return <g className="pixi-nearby-island" key={item.id}
            style={{transform: `translate(${width / 2 + item.x}px, ${height / 2 + item.y}px)`}}>
            <title>{island.name}</title>
            <g transform={`rotate(${item.bearing})`}>
              <clipPath id={`pixi-map-land-${shape.id}`}><path d={shape.d}/></clipPath>
              <path d={shape.d} fill={shape.fill} stroke={SAND} strokeWidth="14" strokeLinejoin="round" paintOrder="stroke"/>
              {/* a soft darker band just inside the coast, like the shore in the game */}
              <path d={shape.coast} fill="none" stroke="#20272a" strokeOpacity=".08" strokeWidth="36" strokeLinejoin="round"
                clipPath={`url(#pixi-map-land-${shape.id})`}/>
              {shape.paths && <path d={shape.paths} fill="none" stroke="#fff6cf" strokeOpacity=".3" strokeWidth="5"
                strokeLinecap="round" strokeLinejoin="round"/>}
              {/* river mouths reach past the coast; trim them to the land */}
              {shape.water && <path d={shape.water} fill={SEA} stroke={SAND} strokeWidth="5" strokeLinejoin="round" paintOrder="stroke"
                clipPath={`url(#pixi-map-land-${shape.id})`}/>}
              <circle cx={shape.dock.x} cy={shape.dock.y} r="9" fill="#fff9df" stroke="#564537" strokeWidth="4"/>
              {/* free boats, drawn with the game's own boat (side view), kept upright */}
              {item.id === frame.here && frame.boats && frame.boats.split(' ').map(at => <image key={at} href={BOAT}
                x="-55" y="-80" width="110" height="96" transform={`translate(${at}) rotate(${-item.bearing})`}/>)}
            </g>
          </g>;
        })}
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
  </button>
  </>;
}
