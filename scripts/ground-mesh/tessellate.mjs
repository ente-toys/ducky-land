import earcut from 'earcut';
import {createCanvas} from '@napi-rs/canvas';

// Flatness is measured in world coordinates after transforms and clipping.
// Curves flatten to .04 world px; normalized dictionary coordinates retain
// at most .125 world px per step, below a pixel at the maximum walking zoom.
export const TOLERANCE = .04;
const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
const distance=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
export function contours(path,tolerance=TOLERANCE,stroke=false){
 const rings=[];let points=[],at=[0,0],first=at;
 const flush=()=>{if(points.length>(stroke?1:2)){if(!stroke&&points[0][0]===points.at(-1)[0]&&points[0][1]===points.at(-1)[1])points.pop();if(points.length>(stroke?1:2))rings.push(points);}points=[];};
 function curve(a,b,c,d,depth=0){if(depth>=20||Math.max(distance(b,a,d),distance(c,a,d))<=tolerance){points.push(d);return;}const ab=mid(a,b),bc=mid(b,c),cd=mid(c,d),abc=mid(ab,bc),bcd=mid(bc,cd),m=mid(abc,bcd);curve(a,ab,abc,m,depth+1);curve(m,bcd,cd,d,depth+1);}
 for(const token of path.toSVGString().match(/[MLCQZ][^MLCQZ]*/g)??[]){const tag=token[0],v=(token.slice(1).match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi)??[]).map(Number),end=v.slice(-2);
  if(tag==='M'){flush();points=[end];first=end;}
  if(tag==='L')points.push(end);
  if(tag==='C')curve(at,v.slice(0,2),v.slice(2,4),end);
  if(tag==='Q'){const b=v.slice(0,2);curve(at,at.map((x,i)=>x+(b[i]-x)*2/3),end.map((x,i)=>x+(b[i]-x)*2/3),end);}
  if(tag==='Z'){if(stroke)points.push(first);flush();at=first;}else at=end;
 }flush();return rings;
}
function contains(r,p){let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
const area=r=>Math.abs(r.reduce((a,p,i)=>{const q=r[(i+1)%r.length];return a+p[0]*q[1]-p[1]*q[0];},0));
export function triangulate(path){
 // Skia resolves nonzero winding/self intersections before nesting holes.
 const rings=contours(path.simplify().asWinding()).map(points=>({points,area:area(points),parent:null,depth:0})).sort((a,b)=>b.area-a.area);
 for(let i=0;i<rings.length;i++){const r=rings[i];for(let j=i-1;j>=0;j--)if(contains(rings[j].points,r.points[0])){r.parent=rings[j];r.depth=r.parent.depth+1;break;}}
 const positions=[],indices=[];
 for(const r of rings){if(r.depth%2)continue;const holes=rings.filter(h=>h.parent===r),all=[r,...holes],data=[],starts=[];for(const p of all){if(p!==r)starts.push(data.length/2);for(const v of p.points)data.push(...v);}const offset=positions.length/2;positions.push(...data);for(const i of earcut(data,starts,2))indices.push(i+offset);}
 return {positions,indices};
}
const ctx=createCanvas(1,1).getContext('2d');
export function rgba(fill,opacity){ctx.fillStyle='#000';ctx.fillStyle=fill;const value=ctx.fillStyle;let hex=value.replace('#','');if(hex.length===3)hex=hex.split('').map(c=>c+c).join('');if(!/^[\da-f]{6}$/i.test(hex))throw Error(`Unsupported ground colour ${fill}: ${value}`);return [0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)).concat(Math.round(opacity*255));}
