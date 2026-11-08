// Exploring never changes the player's island or pulls the view back to it.
export function constrainExploreCamera(camera, bounds) {
  // A local azimuthal chart can cross either geographic pole. No latitude clamp.
  // Exp maps remain periodic for a globe turn; keep the camera free to rotate.
  if(!Number.isFinite(camera.x+camera.y)){camera.x=(bounds.x0+bounds.x1)/2;camera.y=(bounds.y0+bounds.y1)/2;}
}

export function zoomToWorldPoint(camera, nextZoom, point) {
  const fraction=1-camera.zoom/nextZoom;
  camera.x+=(point.x-camera.x)*fraction;
  camera.y+=(point.y-camera.y)*fraction;
  camera.zoom=nextZoom;
}
