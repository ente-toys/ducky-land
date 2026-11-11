// Predict less than a second of travel. Keep this inside the existing pool's
// byte budget; approaching crops can decode and upload before becoming visible.
export function sceneryAhead(camera,actor,seconds=.9,maxDistance=600){
  if(!actor||!(actor.travel>1))return camera;
  const dx=actor.x-actor.previousX,dy=actor.y-actor.previousY,length=Math.hypot(dx,dy);
  if(!Number.isFinite(length)||length<1e-6)return camera;
  const distance=Math.min(maxDistance,actor.travel*seconds);
  return {...camera,x:camera.x+dx/length*distance,y:camera.y+dy/length*distance};
}
