export function followPosition(previous, target, now) {
  const dt=previous?(now-previous.now)/1000:0;
  if(!previous || dt<=0 || dt>.25 || Math.hypot(target.x-previous.target.x,target.y-previous.target.y)>120)
    return {...target,target:{...target},now};
  const tau=.08,decay=Math.exp(-dt/tau);
  const axis=key=>{
    const velocity=(target[key]-previous.target[key])/dt;
    return target[key]-velocity*tau+(previous[key]-previous.target[key]+velocity*tau)*decay;
  };
  return {x:axis('x'),y:axis('y'),target:{...target},now};
}
