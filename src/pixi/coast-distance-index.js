// Exact coast distances with precomputed edges. Reject distant polygon/edge
// bounds before doing distance maths; callers can cap distances they don't need.
export function createCoastDistanceIndex(polygons) {
  const rings=polygons.map(points=>{
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    const edges=points.map((a,i)=>{
      const b=points[(i+1)%points.length],dx=b[0]-a[0],dy=b[1]-a[1];
      x0=Math.min(x0,a[0]);y0=Math.min(y0,a[1]);x1=Math.max(x1,a[0]);y1=Math.max(y1,a[1]);
      return {x:a[0],y:a[1],dx,dy,inv:1/(dx*dx+dy*dy||1),
        x0:Math.min(a[0],b[0]),x1:Math.max(a[0],b[0]),y0:Math.min(a[1],b[1]),y1:Math.max(a[1],b[1])};
    });
    return {x0,y0,x1,y1,edges};
  });
  const boxDistance=(x,y,b)=>{
    const dx=Math.max(b.x0-x,0,x-b.x1),dy=Math.max(b.y0-y,0,y-b.y1);
    return dx*dx+dy*dy;
  };
  return (x,y,limit=Infinity)=>{
    let best=limit*limit;
    for(const ring of rings){
      if(boxDistance(x,y,ring)>=best)continue;
      if(x>=ring.x0&&x<=ring.x1&&y>=ring.y0&&y<=ring.y1){
        let inside=false;
        for(const e of ring.edges)if((e.y>y)!==(e.y+e.dy>y)&&x<e.dx*(y-e.y)/e.dy+e.x)inside=!inside;
        if(inside)return 0;
      }
      for(const e of ring.edges){
        if(boxDistance(x,y,e)>=best)continue;
        const t=Math.max(0,Math.min(1,((x-e.x)*e.dx+(y-e.y)*e.dy)*e.inv));
        const dx=x-e.x-t*e.dx,dy=y-e.y-t*e.dy;
        best=Math.min(best,dx*dx+dy*dy);
      }
    }
    return Math.sqrt(best);
  };
}
