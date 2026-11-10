// Absolute UTC seconds, a stable pond seed, and baked safe routes. No simulation,
// network messages or frame-rate-dependent random numbers in the render loop.
export function samplePondDucky(pond, index, seconds, reduced, out) {
  const motion=pond.motion,track=motion.tracks[index];
  const time=reduced?0:((seconds%motion.period)+motion.period)%motion.period;
  let lo=0,hi=track.length-1;
  while(lo<hi){const mid=(lo+hi+1)>>1;if(track[mid].at<=time)lo=mid;else hi=mid-1;}
  const s=track[lo],u=Math.max(0,Math.min(1,(time-s.at-s.hold)/s.duration));
  const distance=u*u*(3-2*u)*s.length;
  let leg=1;while(leg<s.cum.length-1&&s.cum[leg]<distance)leg++;
  const a=s.path[leg-1],b=s.path[leg],f=Math.max(0,Math.min(1,(distance-s.cum[leg-1])/(s.cum[leg]-s.cum[leg-1]||1)));
  out.x=a[0]+(b[0]-a[0])*f;out.y=a[1]+(b[1]-a[1])*f;
  out.dx=b[0]-a[0];out.dy=b[1]-a[1];
  out.moving=!reduced&&u>0&&u<1;
  return out;
}
