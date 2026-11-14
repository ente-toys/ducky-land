// Triangle/triangle intersection avoids Skia PathOp's silent failure on the
// dense Pagepond lawn. Both subject and clip retain their tessellated holes.
const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
export function clipTriangles(subject,clip){
 const triangles=[],grid=new Map(),cell=256;
 for(let i=0;i<clip.indices.length;i+=3){const p=Array.from(clip.indices.slice(i,i+3),v=>[clip.positions[v*2],clip.positions[v*2+1]]),xs=p.map(v=>v[0]),ys=p.map(v=>v[1]),b=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)],id=triangles.length;triangles.push({p,b,sign:Math.sign(cross(p[0],p[1],p[2]))});for(let y=Math.floor(b[1]/cell);y<=Math.floor(b[3]/cell);y++)for(let x=Math.floor(b[0]/cell);x<=Math.floor(b[2]/cell);x++){const key=x+','+y;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(id);}}
 const positions=[],indices=[];
 for(let i=0;i<subject.indices.length;i+=3){const original=Array.from(subject.indices.slice(i,i+3),v=>[subject.positions[v*2],subject.positions[v*2+1]]),xs=original.map(v=>v[0]),ys=original.map(v=>v[1]),box=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
  const cells=(Math.floor(box[2]/cell)-Math.floor(box[0]/cell)+1)*(Math.floor(box[3]/cell)-Math.floor(box[1]/cell)+1),candidates=new Set();
  if(cells>triangles.length*2)triangles.forEach((_,k)=>candidates.add(k));else for(let y=Math.floor(box[1]/cell);y<=Math.floor(box[3]/cell);y++)for(let x=Math.floor(box[0]/cell);x<=Math.floor(box[2]/cell);x++)for(const k of grid.get(x+','+y)??[])candidates.add(k);
  for(const k of candidates){const {p,b,sign}=triangles[k];if(box[0]>b[2]||box[2]<b[0]||box[1]>b[3]||box[3]<b[1]||!sign)continue;let polygon=original;
   for(let edge=0;edge<3&&polygon.length;edge++){const a=p[edge],b=p[(edge+1)%3],next=[];for(let j=0;j<polygon.length;j++){const c=polygon[j],d=polygon[(j+1)%polygon.length],dc=cross(a,b,c)*sign,dd=cross(a,b,d)*sign;if(dc>=-1e-8)next.push(c);if((dc>=0)!==(dd>=0)){const t=dc/(dc-dd);next.push([c[0]+(d[0]-c[0])*t,c[1]+(d[1]-c[1])*t]);}}polygon=next;}
   if(polygon.length<3)continue;const start=positions.length/2;for(const v of polygon)positions.push(...v);for(let j=1;j+1<polygon.length;j++)if(Math.abs(cross(polygon[0],polygon[j],polygon[j+1]))>1e-8)indices.push(start,start+j,start+j+1);
  }
 }
 return {positions,indices};
}
