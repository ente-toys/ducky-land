// Pure geometry shared by placement and live-copy ownership. Map rectangles
// include transparent sea; they are only useful as a broad-phase bound.
export const SHORE_BAND = 160; // conservative outer beach/surf envelope, in world units
export const SEA_CHANNEL = 300; // open water beyond both shore envelopes (boat diameter: 92)

const ellipse = (x, y, rx, ry) => Array.from({length:48}, (_, i) => {
  const a = i * Math.PI / 24, k = 1 / Math.cos(Math.PI / 48);
  return [x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k];
});
export function coastPolygons(world, walk = world, jetty = null) {
  const polygons = [...new Set([world.coast, walk.coast])].filter(p => p?.length);
  for (const [x,y,rx,ry] of world.islets ?? []) polygons.push(ellipse(x,y,rx,ry));
  const decks = [...(world.walkways ?? []), ...(walk !== world ? walk.walkways ?? [] : [])];
  if (jetty) decks.push({a:jetty.foot, b:jetty.tip, w:jetty.width ?? 104});
  for (const {a,b,w} of decks) {
    const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1,nx=-dy/l*w/2,ny=dx/l*w/2;
    polygons.push([[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]]);
  }
  return polygons;
}
const inside = (p, poly) => {
  let yes=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++) {
    const a=poly[i],b=poly[j];
    if((a[1]>p[1])!==(b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;
  }
  return yes;
};
const pointSegment = (p,a,b) => {
  const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
};
export function coastDistance(x,y,polygons) {
  let d=Infinity;
  for(const poly of polygons) {
    if(inside([x,y],poly))return 0;
    for(let i=0;i<poly.length;i++)d=Math.min(d,pointSegment([x,y],poly[i],poly[(i+1)%poly.length]));
  }
  return d;
}
const box = p => ({x0:Math.min(...p.map(v=>v[0])),x1:Math.max(...p.map(v=>v[0])),y0:Math.min(...p.map(v=>v[1])),y1:Math.max(...p.map(v=>v[1]))});
const boxGap = (a,b) => Math.hypot(Math.max(0,a.x0-b.x1,b.x0-a.x1),Math.max(0,a.y0-b.y1,b.y0-a.y1));
const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function segmentGap(a,b,c,d) {
  if(boxGap(box([a,b]),box([c,d]))===0 && cross(a,b,c)*cross(a,b,d)<=0 && cross(c,d,a)*cross(c,d,b)<=0)return 0;
  return Math.min(pointSegment(a,c,d),pointSegment(b,c,d),pointSegment(c,a,b),pointSegment(d,a,b));
}
// Exact polygon edge distances, including crossing edges and complete containment.
export function coastGap(A,B) {
  let best=Infinity;
  for(const a of A)for(const b of B) {
    if(boxGap(box(a),box(b))>=best)continue;
    if(inside(a[0],b)||inside(b[0],a))return 0;
    for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++) {
      best=Math.min(best,segmentGap(a[i],a[(i+1)%a.length],b[j],b[(j+1)%b.length]));
      if(best===0)return 0;
    }
  }
  return best;
}
export const transformCoasts = (polygons,x,y,sx=1,sy=1) => polygons.map(poly=>poly.map(p=>[x+p[0]*sx,y+p[1]*sy]));
