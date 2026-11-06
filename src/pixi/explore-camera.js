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

export function islandArrow(target, width, height, direction=target) {
  const cx=width/2,cy=height/2;
  const visible=target.face>0 && target.x>70 && target.x<width-70 && target.y>110 && target.y<height-75;
  if(visible) return {x:target.x-45,y:target.y,angle:0};
  let dx=direction.x-cx,dy=direction.y-cy;
  if(Math.hypot(dx,dy)<1e-6) dx=1;
  const scale=Math.min((width/2-70)/Math.max(1e-6,Math.abs(dx)),(height/2-110)/Math.max(1e-6,Math.abs(dy)));
  return {x:cx+dx*scale,y:cy+dy*scale,angle:Math.atan2(dy,dx)};
}
