import {surfaceCoordinates} from './three-globe-math.js';

// Flatten only in the final close approach, after the island's heading has
// largely settled. Hysteresis prevents mode changes at a single wheel boundary.
export function detailBlend(altitude){
  if(altitude<=.160001)return 1;
  const t=Math.max(0,Math.min(1,Math.log(.36/altitude)/Math.log(.36/.16)));
  return t*t*t*(t*(t*6-15)+10);
}
export function directDetail(altitude,previous,ready){return ready&&(previous?altitude<.18:altitude<=.160001);}
export function detailSize(width,height,dpr=1){
  const density=Math.min(1.5,dpr,1536/Math.max(1,width,height));
  return {width:Math.max(1,Math.round(width*density)),height:Math.max(1,Math.round(height*density))};
}

// Both projections share the same grabbed point. This makes flattening and the
// final canvas swap preserve the cursor anchor, rather than recentering it.
export function detailCamera(frame,map,state,width,height,tilt=1,offset={x:0,y:0}){
  const span=2*Math.tan(state.fov*Math.PI/360)*state.altitude*state.radius;
  const zoom=height/span,centre={x:map.cx+state.point.x,y:map.cy+state.point.y};
  let x=centre.x+offset.x,y=centre.y+offset.y;
  if(state.anchor){
    const p=surfaceCoordinates(frame,state.anchor.point,state.radius);
    x=map.cx+p.x-(state.anchor.x-state.width/2)*width/state.width/zoom;
    y=map.cy+p.y-(state.anchor.y-state.height/2)*height/state.height/(zoom*tilt);
    offset.x=x-centre.x;offset.y=y-centre.y;
  }
  return {x,y,zoom};
}
export function detailScreen(camera,x,y,width,height,cssWidth,cssHeight,tilt=1){
  return {x:(width/2+(x-camera.x)*camera.zoom)*cssWidth/width,y:(height/2+(y-camera.y)*camera.zoom*tilt)*cssHeight/height};
}
