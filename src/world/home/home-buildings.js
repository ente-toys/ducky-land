import {MUSEUM_DOOR, atMuseumDoor} from '../../gameplay/player-motion.js';
const BUILDING_ASSETS = /^(house-.+|cottage-(?!flowerbed).+|bakery|bread-oven|garden-shed|windmill|grain-silo|harvest-barn|kiln|smokehouse|lighthouse|bandstand|gazebo|museum|kiosk|stall-.+)$/;
export const isHomeBuilding = prop => prop.homeContract?.decision!=='A4' && ([1, 2, 3, 34, 46].includes(prop.id) || BUILDING_ASSETS.test(prop.asset ?? ''));

export function homeBuildingAt(props = [], point) {
  return props.filter(p => isHomeBuilding(p) && p.sprite?.visible)
    .sort((a, b) => (b.z ?? b.y) - (a.z ?? a.y))
    .find(p => {
      const b = p.sprite.getBounds();
      return point.x >= b.x && point.x <= b.x + b.width && point.y >= b.y && point.y <= b.y + b.height;
    });
}

export function homeBuildingTarget(prop, groundPoint) {
  if (prop.id === 34) return atMuseumDoor(groundPoint.x, groundPoint.y) ? groundPoint : {...MUSEUM_DOOR.out};
  const f = prop.footprint;
  if (f?.poly) return {x: f.poly.reduce((s, p) => s + p[0], 0) / f.poly.length, y: f.poly.reduce((s, p) => s + p[1], 0) / f.poly.length};
  return {x: f?.x ?? prop.x, y: f?.y ?? prop.y};
}
