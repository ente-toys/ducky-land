import {placeRigid} from '../../world/rigid.js';
import {boatSpots} from '../../gameplay/islands.js';

export function previewMoorings(islands, camera, width, height, tilt = 1) {
  const hw=width/(2*camera.zoom),hh=height/(2*camera.zoom*tilt),boats=[];
  for(const island of islands) {
    const ox=island.x-(island.localCentre?.x ?? island.width/2),oy=island.y-(island.localCentre?.y ?? island.height/2);
    if(Math.abs(island.x-camera.x)>hw+island.width/2+500 || Math.abs(island.y-camera.y)>hh+island.height/2+500) continue;
    boatSpots(island.id).forEach((spot,slot)=>{
      const p=island.from?placeRigid(island.from,island.id,spot):{x:ox+spot.x,y:oy+spot.y},x=p.x,y=p.y;
      if(Math.abs(x-camera.x)>hw+300 || Math.abs(y-camera.y)>hh+300) return;
      boats.push({id:`${island.id}-${slot}`,islandId:island.id,x,y,turn:spot.turn,occupant:null,departure:island.id});
    });
  }
  return boats;
}

export function boatsForView(room, now, preview) {
  return room?.tick>=0 ? room.boatPoses(now) : preview();
}
