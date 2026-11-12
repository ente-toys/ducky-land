// Same live heart animation, with roughly twice as many hearts and a bounded
// event pool. Visit the whole shoreline instead of a small centre-radius circle.
export const HEART_ACTIVITY_INTERVAL = .022;
export const HEART_ACTIVITY_CHANCE = .85;
export const HEART_ACTIVITY_LIMIT = 160;

import {inPoly} from '../../assets/world/island-geometry.mjs';

// Use the same UV rectangle as the visible patch, with a small opaque margin.
export function heartArtContains(frame,x,y,image) {
  const u=Math.floor((.5+x/frame.width)*image.width),v=Math.floor((.5+y/(frame.height??frame.width))*image.height);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const a=u+dx,b=v+dy;
    if(a<0||b<0||a>=image.width||b>=image.height)return false;
    const i=(b*image.width+a)*4,r=image.data[i],g=image.data[i+1],blue=image.data[i+2];
    if(image.data[i+3]<245||blue>r*1.12&&g>r*1.12)return false;
  }
  return true;
}

export function createHeartLocations(islands, mapOf, random = Math.random, islets = [], onArt = ()=>true) {
  const shuffle = values => {
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
  };
  const sources = [
    ...islands.map(island => {
      const map=mapOf(island.id),coast=map.world.coast,pad=Math.min(map.width,map.height)*.012;
      return {island,weight:3,map:{...map,landAt:(x,y)=>map.landAt(x,y)&&
        [[0,0],[pad,0],[-pad,0],[0,pad],[0,-pad]].every(([dx,dy])=>inPoly(x+dx,y+dy,coast))}};
    }),
    ...islets.map(island => {
      const xs = island.coast.map(p => p[0]), ys = island.coast.map(p => p[1]);
      return {island, weight: 1, map: {
        origin: {x: Math.min(...xs), y: Math.min(...ys)},
        width: Math.max(...xs)-Math.min(...xs), height: Math.max(...ys)-Math.min(...ys), cx: 0, cy: 0,
        landAt: (x,y) => inPoly(x,y,island.coast) && !island.lakes.some(ring => inPoly(x,y,ring)),
      }};
    }),
  ];
  const pools = sources.map(({island,map,weight}) => {
    const points = [], grid = 12;
    // One sample per cell spreads activity across villages, lawns and coast.
    // Check actual dry land, including the map's expanded/negative origin.
    for (let row = 0; row < grid; row++) for (let col = 0; col < grid; col++) {
      for (let attempt = 0; attempt < 6; attempt++) {
        const x = map.origin.x + (col + .1 + random() * .8) * map.width / grid;
        const y = map.origin.y + (row + .1 + random() * .8) * map.height / grid;
        if (map.landAt(x, y) && onArt(island,x-map.cx,y-map.cy)) {points.push({x: x - map.cx, y: y - map.cy}); break;}
      }
    }
    if (!points.length) throw Error(`No heart activity land for ${island.id}`);
    return {island, points, weight, bag: [], recent: []};
  });
  let islandBag = [];
  return () => {
    // Shuffled rounds keep all islands alive, rather than repeatedly drawing
    // the same random island. Each island has its own non-repeating land bag.
    if (!islandBag.length) islandBag = shuffle(pools.flatMap(pool => Array(pool.weight).fill(pool)));
    const pool = islandBag.pop();
    if (!pool.bag.length) pool.bag = shuffle([...pool.points]);
    const distance = p => pool.recent.length ? Math.min(...pool.recent.map(q => (p.x-q.x)**2+(p.y-q.y)**2)) : 1;
    let best = pool.bag.length - 1;
    for (let i = Math.max(0, pool.bag.length - 8); i < pool.bag.length; i++) {
      if (distance(pool.bag[i]) > distance(pool.bag[best])) best = i;
    }
    const [point] = pool.bag.splice(best, 1);
    pool.recent.push(point); if (pool.recent.length > 6) pool.recent.shift();
    return {island: pool.island, ...point};
  };
}
