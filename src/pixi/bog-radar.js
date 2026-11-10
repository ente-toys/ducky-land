// Swap this filename to any of the six approved public/pixi-art/radar-marker/ SVGs.
export const BOG_RADAR_ICON = '/pixi-art/radar-marker/02-white-badge.svg';
export const BOG_RADAR_ISLAND = 'isle-249';
export const BOG_RADAR_SIZE_PX = 38;

// Mutate a caller-owned scratch value. Coordinates and radius use map units.
// Centre the badge on the outline radius, without changing its bearing.
export function placeBogRadar(out, islandId, x, y, radius) {
  const distance = Math.hypot(x, y);
  const factor = distance > radius ? radius / distance : 1;
  out.x = x * factor;
  out.y = y * factor;
  out.visible = islandId !== BOG_RADAR_ISLAND;
  return out;
}
