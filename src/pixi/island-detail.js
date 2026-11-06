// Choose detail by how large an island appears, not by how many islands are nearby.
// A bounded closest-first set keeps exploration sharp without drawing the whole world live.
export function detailedIslands(islands, camera, width, height, tilt = 1, limit = 12) {
  const hw=width/(2*camera.zoom),hh=height/(2*camera.zoom*tilt);
  return islands.filter(i=>!i.home && i.width*camera.zoom>=150 &&
    Math.abs(i.x-camera.x)<hw+i.width/2+400 && Math.abs(i.y-camera.y)<hh+i.height/2+400)
    .sort((a,b)=>Math.hypot(a.x-camera.x,a.y-camera.y)-Math.hypot(b.x-camera.x,b.y-camera.y)).slice(0,limit);
}
