import {spherePoint,seaPoint} from '../../world/sphere-coordinates.js';
import {unplaceIslet} from '../../world/islet-placement.js';
import {ISLETS,isletPoint} from '../../world/islets.js';

// Match the walking area's coast/jetty bounds without constructing navigation
// grids when the globe opens. The extra unit covers rounded dock coordinates.
const isletBounds=ISLETS.map(islet=>{
  const points=[...islet.coast,islet.jetty.foot,islet.jetty.tip];
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  return {islet,x0:Math.min(...xs)-65,x1:Math.max(...xs)+65,y0:Math.min(...ys)-65,y1:Math.max(...ys)+65};
});

export function globePlayerPoint(id,player){
  if(player.mode==='sailing')return seaPoint(id,player);
  // Islet walking coordinates belong to the flat sailing chart, not the
  // parent island's globe projection. Use the islet artwork's own frame.
  for(const {islet,x0,x1,y0,y1} of isletBounds){
    if(islet.home!==id)continue;
    const local=unplaceIslet(id,islet,player);
    if(local.x<x0||local.x>x1||local.y<y0||local.y>y1)continue;
    return isletPoint(islet,[local.x,local.y]);
  }
  return spherePoint(id,player);
}
