import {inPoly} from '../../assets/world/island-geometry.mjs';
import {bogLandingNotice} from '../features/bog-combat/entry.js';
import {mapOf} from '../world/island-maps.js';
import {placeIslet} from '../world/islet-placement.js';
import {ISLETS} from '../world/islets.js';
import {isletWalk} from '../world/islet-walk.js';
import {WORLD_ISLANDS} from '../world/world-map.js';
import {atMuseumDoor, DUCK_RADIUS} from './player-motion.js';
import {onIce} from './rink-slide.js';

const clearance = Array.from({length:8}, (_, i) => {
  const angle = i * Math.PI / 4;
  return [Math.cos(angle) * DUCK_RADIUS, Math.sin(angle) * DUCK_RADIUS];
});

function findPoint({nav, bounds, coast, exit, fallback, home}, occupied, random) {
  const safe = (x, y) => {
    const clear = (a, b) => nav.walkable(a, b) && inPoly(a, b, coast) &&
      !onIce(nav, a, b) && !(home && atMuseumDoor(a, b));
    if (!clear(x, y) || !clearance.every(([dx, dy]) => clear(x + dx, y + dy))) return false;
    if (occupied.some(p => Math.hypot(p.x - x, p.y - y) < DUCK_RADIUS * 2)) return false;
    const path = nav.route(x, y, ...exit);
    const end = path.at(-1);
    return end && Math.hypot(end[0] - exit[0], end[1] - exit[1]) < 1;
  };
  for (let i = 0; i < 64; i++) {
    const x = Math.round(bounds.origin.x + random() * bounds.width);
    const y = Math.round(bounds.origin.y + random() * bounds.height);
    if (safe(x, y)) return {x, y};
  }
  for (const p of fallback) {
    if (safe(p.x, p.y)) return {x:p.x, y:p.y};
  }
  return null;
}

export function pickWorldSpawn({
  karma = 0, hasRoom = () => true, occupied = [], boats = [], random = Math.random, homeNav,
} = {}) {
  const regions = [];
  for (const island of WORLD_ISLANDS) {
    if (!hasRoom(island.id) || bogLandingNotice(island.id, karma)) continue;
    regions.push({island});
    // A detached islet is only an arrival option when its dock has a boat to leave in.
    for (const islet of ISLETS) {
      if (islet.home !== island.id || !boats.length) continue;
      const water = placeIslet(island.id, islet, islet.jetty.water);
      if (boats.some(boat => boat.islandId === island.id && !boat.occupant && !boat.owner &&
        Math.hypot(boat.x - water.x, boat.y - water.y) < 149)) regions.push({island, islet});
    }
  }
  while (regions.length) {
    const [{island, islet}] = regions.splice(Math.floor(random() * regions.length), 1);
    const walk = islet ? isletWalk(islet.id) : null;
    const map = mapOf(island.id);
    if (map.id !== (island.theme ?? 'home')) continue;
    const nav = walk?.nav ?? (map.home && homeNav ? homeNav : map.nav());
    const dock = walk?.land ?? map.HARBOR.land;
    const exit = nav.nearest(dock.x, dock.y, 180);
    if (!exit) continue;
    const point = findPoint({
      nav, exit, home:map.home && !walk, bounds:walk?.world ?? map,
      coast:walk?.world.coast ?? map.walk.coast,
      fallback:walk ? [walk.foot] : [map.spawn, map.JETTY.foot],
    }, occupied.filter(p => p.islandId === island.id), random);
    if (point) return {islandId:island.id, ...point, name:walk ? `an islet near ${island.name}` : island.name};
  }
  return null;
}
