export function constrainExploreCamera(camera, bounds) {
  if(!Number.isFinite(camera.x+camera.y)){camera.x=(bounds.x0+bounds.x1)/2;camera.y=(bounds.y0+bounds.y1)/2;}
}

export function zoomToWorldPoint(camera, nextZoom, point) {
  const fraction=1-camera.zoom/nextZoom;
  camera.x+=(point.x-camera.x)*fraction;
  camera.y+=(point.y-camera.y)*fraction;
  camera.zoom=nextZoom;
}
