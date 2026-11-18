import {SEA_WIDTH, wrapSea} from '../world/flat-layout.js';

const CELL = 1000;
const COLUMNS = SEA_WIDTH / CELL;
const LIMIT = 96;

export const nearbyCell = ({x,y}) => ({
  x: Math.floor((wrapSea(x) + SEA_WIDTH / 2) / CELL),
  y: Math.floor(y / CELL),
});

export const validNearbyCell = ({x,y}) =>
  Number.isInteger(x) && x >= 0 && x < COLUMNS && Number.isInteger(y) && Math.abs(y) <= 100;

export function nearbyIndex(poses) {
  const cells = new Map();
  for (const pose of poses) {
    const {x,y} = nearbyCell(pose);
    const key = y * COLUMNS + x;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(pose);
  }
  return cells;
}

export function nearbyPoses(cells, cell) {
  const poses = [];
  for (let y = cell.y - 2; y <= cell.y + 2; y++) {
    for (let dx = -2; dx <= 2; dx++) {
      const x = (cell.x + dx + COLUMNS) % COLUMNS;
      const bucket = cells.get(y * COLUMNS + x);
      if (bucket) poses.push(...bucket);
    }
  }
  if (poses.length <= LIMIT) return poses;
  const x = (cell.x + .5) * CELL - SEA_WIDTH / 2, y = (cell.y + .5) * CELL;
  const distance = pose => wrapSea(pose.x - x)**2 + (pose.y - y)**2;
  return poses.sort((a,b) => distance(a) - distance(b) || a.id.localeCompare(b.id)).slice(0,LIMIT);
}
