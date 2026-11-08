// The camera remains in the original artwork's world coordinates.
export {fitZoom, zoomAt, easeCamera, clamp} from '../../rive/web/island-camera.mjs';

// Boss 3 Nov, Cursor Camp look: the ground is seen at a tilt, so screen y is world y squashed by TILT.
// Trees, stalls and Duckies stay upright (engine.js counter-scales them); only the ground plane foreshortens.
export const TILT = Math.min(1, Math.max(.4, Number(new URLSearchParams(globalThis.location?.search).get('tilt')) || 1));   // boss 3 Nov: top-down (A); ?tilt= still compares angles   // ?tilt= to compare angles

export function screenToWorld(camera, point, width, height) {
  const b=camera.basis??{a:1,b:0,c:0,d:1},det=b.a*b.d-b.b*b.c,x=point.x-width/2,y=point.y-height/2;
  return {
    x: camera.x + (b.d*x-b.c*y)/det/camera.zoom,
    y: camera.y + (-b.b*x+b.a*y)/det/(camera.zoom*TILT),
  };
}

export function movePinch(camera, before, after, minZoom, maxZoom, width, height) {
  const midpoint = points => ({x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2});
  const distance = points => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  const anchor = screenToWorld(camera, midpoint(before), width, height);
  const next = midpoint(after);
  camera.zoom = Math.max(minZoom, Math.min(maxZoom, camera.zoom * distance(after) / Math.max(1, distance(before))));
  camera.x = anchor.x - (next.x - width / 2) / camera.zoom;
  camera.y = anchor.y - (next.y - height / 2) / (camera.zoom * TILT);
}

// Any multi-touch, cancelled, or dragged gesture is permanently ineligible for a tap.
export class Gestures {
  pointers = new Map();
  down(id, point) {
    this.pointers.set(id, {...point, start: {...point}, consumed: false});
    if (this.pointers.size > 1) for (const pointer of this.pointers.values()) pointer.consumed = true;
  }
  move(id, point) {
    const pointer = this.pointers.get(id);
    if (!pointer) return null;
    const before = [...this.pointers.values()].map(p => ({x: p.x, y: p.y}));
    const dx = point.x - pointer.x, dy = point.y - pointer.y;
    if (Math.hypot(point.x - pointer.start.x, point.y - pointer.start.y) > 6) pointer.consumed = true;
    Object.assign(pointer, point);
    return {before, after: [...this.pointers.values()], dx, dy, drag: pointer.consumed};
  }
  up(id, cancelled = false) {
    const pointer = this.pointers.get(id);
    this.pointers.delete(id);
    return pointer && !cancelled && !pointer.consumed ? {x: pointer.x, y: pointer.y} : null;
  }
  clear() { this.pointers.clear(); }
}
