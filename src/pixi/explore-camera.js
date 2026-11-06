// Exploring never changes the player's island or pulls the view back to it.
export function constrainExploreCamera(camera, bounds) {
  const radius=(bounds.x1-bounds.x0)/(2*Math.PI), cy=(bounds.y0+bounds.y1)/2;
  camera.y=Math.max(cy-1.05*radius,Math.min(cy+1.05*radius,camera.y));
}

export function zoomToWorldPoint(camera, nextZoom, point) {
  const fraction=1-camera.zoom/nextZoom;
  camera.x+=(point.x-camera.x)*fraction;
  camera.y+=(point.y-camera.y)*fraction;
  camera.zoom=nextZoom;
}
