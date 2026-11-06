export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export function fitZoom(width, height, worldWidth, worldHeight) {
  return Math.min(width / worldWidth, height / worldHeight) * .95;
}
// Keep the world point under the cursor stationary while changing scale.
export function zoomAt(camera, nextZoom, x, y, width, height) {
  const dx = x - width / 2, dy = y - height / 2;
  camera.x += dx / camera.zoom - dx / nextZoom;
  camera.y += dy / camera.zoom - dy / nextZoom;
  camera.zoom = nextZoom;
}
export function easeCamera(current, target, dt, reducedMotion = false, rate = 14) {
  const alpha = reducedMotion ? 1 : 1 - Math.exp(-rate * dt);
  // Interpolate inverse scale and translation together to preserve the zoom anchor.
  const inverse = (1 / current.zoom) + (1 / target.zoom - 1 / current.zoom) * alpha;
  current.zoom = 1 / inverse;
  current.x += (target.x - current.x) * alpha;
  current.y += (target.y - current.y) * alpha;
}
