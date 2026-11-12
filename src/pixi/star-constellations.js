// Short, local chains of named stars. Built on data refresh, never per frame.
export function starConstellations(stars){
  const cellSize=850, cells=new Map(), points=[...stars].sort((a,b)=>a.accountId.localeCompare(b.accountId));
  const key=(x,y)=>`${x},${y}`;
  for(const p of points){const k=key(Math.floor(p.x/cellSize),Math.floor(p.y/cellSize));if(!cells.has(k))cells.set(k,[]);cells.get(k).push(p);}
  const candidates=new Map();
  for(const p of points){
    const cx=Math.floor(p.x/cellSize),cy=Math.floor(p.y/cellSize),nearest=[];
    for(let x=cx-1;x<=cx+1;x++)for(let y=cy-1;y<=cy+1;y++){
      // Bound work in unusually crowded patches of sky.
      for(const q of (cells.get(key(x,y))??[]).slice(0,48)){
        if(p===q)continue;
        const distance=(p.x-q.x)**2+(p.y-q.y)**2;if(distance>cellSize**2)continue;
        nearest.push({a:p,b:q,distance});
      }
    }
    nearest.sort((a,b)=>a.distance-b.distance||a.b.accountId.localeCompare(b.b.accountId));
    for(const edge of nearest.slice(0,3)){
      const ids=[edge.a.accountId,edge.b.accountId].sort();candidates.set(ids.join(':'),edge);
    }
  }
  const parent=new Map(points.map(p=>[p.accountId,p.accountId])),size=new Map(points.map(p=>[p.accountId,1])),degree=new Map();
  const find=id=>{let p=id;while(parent.get(p)!==p)p=parent.get(p);return p;};
  const lines=[];
  for(const edge of [...candidates.values()].sort((a,b)=>a.distance-b.distance)){
    const a=edge.a.accountId,b=edge.b.accountId,pa=find(a),pb=find(b);
    if(pa===pb||(degree.get(a)??0)>=3||(degree.get(b)??0)>=3||size.get(pa)+size.get(pb)>8)continue;
    parent.set(pb,pa);size.set(pa,size.get(pa)+size.get(pb));degree.set(a,(degree.get(a)??0)+1);degree.set(b,(degree.get(b)??0)+1);lines.push([edge.a,edge.b]);
  }
  return lines;
}
