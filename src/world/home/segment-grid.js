// Exact nearest-segment queries. Segment bounding boxes occupy every cell they
// cross, so an expanding search can stop once unseen cells cannot improve it.
export function segmentGrid(segments, cellSize=192) {
  const cells=new Map();let maxRadius=0;
  const key=(x,y)=>`${x},${y}`;
  for(const [i,s]of segments.entries()){
    maxRadius=Math.max(maxRadius,s.radius??0);
    const [a,b]=[s.a,s.b];
    for(let x=Math.floor(Math.min(a[0],b[0])/cellSize);x<=Math.floor(Math.max(a[0],b[0])/cellSize);x++)
      for(let y=Math.floor(Math.min(a[1],b[1])/cellSize);y<=Math.floor(Math.max(a[1],b[1])/cellSize);y++){
        const k=key(x,y),list=cells.get(k)??[];if(!cells.has(k))cells.set(k,list);list.push(i);
      }
  }
  return (x,y)=>{
    if(!segments.length)return Infinity;
    const cx=Math.floor(x/cellSize),cy=Math.floor(y/cellSize),seen=new Set();let best=Infinity;
    for(let ring=0;seen.size<segments.length;ring++){
      for(let gx=cx-ring;gx<=cx+ring;gx++)for(let gy=cy-ring;gy<=cy+ring;gy++){
        if(ring&&gx!==cx-ring&&gx!==cx+ring&&gy!==cy-ring&&gy!==cy+ring)continue;
        for(const i of cells.get(key(gx,gy))??[]){
          if(seen.has(i))continue;seen.add(i);
          const {a,b,radius=0}=segments[i],dx=b[0]-a[0],dy=b[1]-a[1];
          const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));
          best=Math.min(best,Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)-radius);
        }
      }
      const outside=Math.min(x-(cx-ring)*cellSize,(cx+ring+1)*cellSize-x,y-(cy-ring)*cellSize,(cy+ring+1)*cellSize-y)-maxRadius;
      if(best<=outside)break;
    }
    return best;
  };
}
