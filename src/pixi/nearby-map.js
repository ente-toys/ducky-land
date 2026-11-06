import {WORLD_ISLANDS, WORLD_GEO, worldIsland} from './world-map.js';
import {mapOf} from './island-maps.js';

export const NEARBY_MAP_WIDTH = 8000;
export const NEARBY_MAP_HEIGHT = 4500;

// Coordinates stay relative to the duck, including across the longitude seam
// and when landing changes the player's island-local coordinate frame.
export function nearbyMapFrame(islandId, point) {
  const home = worldIsland(islandId);
  const map = mapOf(islandId);
  const x = home.x + point.x - map.width / 2;
  const y = home.y + point.y - map.height / 2;
  return WORLD_ISLANDS.map(island => ({
    id: island.id,
    x: WORLD_GEO.wrapd(island.x - x, WORLD_GEO.SX),
    y: island.y - y,
  })).sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y)).slice(0, 3);
}
