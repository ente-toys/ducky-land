export function floatingPose(item,time,reduced=false){
  const phase=item.phase;
  return {x:item.x+(reduced?0:Math.sin(time*.22+phase)*9),
    y:item.y+(reduced?0:Math.sin(time*.31+phase)*4+Math.sin(time*1.1+phase)*1.2),
    rotation:reduced?0:Math.sin(time*.27+phase)*.035};
}
