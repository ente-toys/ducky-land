export function benchSeatAt(props,pose) {
  if (!pose || pose.mode==='sailing' || pose.action!==0 || pose.travel>3 || pose.jumpLeft>0) return null;
  for (const p of props ?? []) {
    if (!p.sittable || !p.bench?.seat) continue;
    const s=p.bench.seat, side=p.bench.view==='east'||p.bench.view==='west';
    if (((pose.x-s.x)/(side?24:84))**2+((pose.y-s.y)/22)**2>1) continue;
    return {...s,x:side?s.x:pose.x,z:p.y+(p.bench.view==='north'?-.1:.1),bench:p.id};
  }
  return null;
}
