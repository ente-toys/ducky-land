// Follow the actual painted contour, with screen-upright bench legs and backs.
export const ids = {
 court: ['close-arc-2--120','close-arc-2--60','lib-41','lib-40','close-arc-2-148'],
 bookstore: ['arc-bookstore-48','arc-bookstore-76','arc-bookstore-105','arc-bookstore-134'],
};
export const changedIds = new Set(Object.values(ids).flat());
export const round = n => +n.toFixed(3);
export function contour(court,world,source) {
 if(court==='court') {
  const d=source.match(/<clipPath id="reading-court"><path d="([^"]+)"/)[1];
  const nums=d.match(/-?\d+(?:\.\d+)?/g).map(Number),points=[];
  for(let i=0;i<nums.length;i+=2)points.push([nums[i],nums[i+1]]);
  return points;
 }
 const z=world.zones[court==='globe'?'plaza':'bookstore'];
 return Array.from({length:720},(_,i)=>{const a=i*Math.PI/360;return [z.x+Math.cos(a)*z.rx,z.y+Math.sin(a)*z.ry];});
}
export function rim(points,inset) {
 return points.map((p,i)=>{
  const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
  return [p[0]-dy/len*inset,p[1]+dx/len*inset];
 });
}
export function measure(points) {
 const lengths=points.map((p,i)=>Math.hypot(p[0]-points[(i+1)%points.length][0],p[1]-points[(i+1)%points.length][1]));
 const total=lengths.reduce((a,b)=>a+b,0);
 const at=s=>{
  s=(s%total+total)%total;
  for(let i=0;i<lengths.length;i++){
   if(s<=lengths[i]){const p=points[i],q=points[(i+1)%points.length],t=s/lengths[i];return [p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];}
   s-=lengths[i];
  }
 };
 return {total,at};
}
export function benchGeometry(points,distance,length=178) {
 const {at}=measure(points),centre=at(distance);
 const ground=(a,s)=>{
  const t=(a-90)*length/12,p=at(distance+t),before=at(distance+t-2),after=at(distance+t+2),dx=after[0]-before[0],dy=after[1]-before[1],len=Math.hypot(dx,dy);
  // Positive radius is OUTWARD. The backrest stays on the paving's outer side.
  return [p[0]+dy/len*s,p[1]-dx/len*s];
 };
 const poly=[...Array.from({length:25},(_,i)=>ground(84+i*.5,-24)),...Array.from({length:25},(_,i)=>ground(96-i*.5,28))].map(p=>p.map(round));
 const p0=at(distance-2),p1=at(distance+2),len=Math.hypot(p1[0]-p0[0],p1[1]-p0[1]);
 return {centre,ground,poly,tangent:[(p1[0]-p0[0])/len,(p1[1]-p0[1])/len]};
}
