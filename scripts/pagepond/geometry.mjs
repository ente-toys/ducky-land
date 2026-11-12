import {Path2D,PathOp,StrokeCap,StrokeJoin} from '@napi-rs/canvas';
export {Path2D,PathOp};
export const ring=p=>'M'+p.map(v=>v.slice(0,2).join(' ')).join('L')+'Z';
export function curve(p){let d=`M${p[0][0]} ${p[0][1]}`;for(let i=0;i<p.length-1;i++){const a=p[Math.max(0,i-1)],b=p[i],c=p[i+1],e=p[Math.min(p.length-1,i+2)];d+=`C${b[0]+(c[0]-a[0])/6} ${b[1]+(c[1]-a[1])/6} ${c[0]-(e[0]-b[0])/6} ${c[1]-(e[1]-b[1])/6} ${c[0]} ${c[1]}`;}return d;}
export const stroke=(p,width)=>new Path2D(p).stroke({width,cap:StrokeCap.Round,join:StrokeJoin.Round});
export const union=ps=>ps.reduce((a,b)=>a.op(b,PathOp.Union),new Path2D()).simplify();
export function contours(d,step=18){const tokens=d.match(/[MLCQZmlcqz]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi)??[];let i=0,p=[0,0],start=p,out=[],line=[];const num=()=>+tokens[i++],point=()=>[num(),num()];while(i<tokens.length){const op=tokens[i++];if(op==='M'){if(line.length)out.push(line);p=point();start=p;line=[p];}else if(op==='L'){const q=point(),n=Math.max(1,Math.ceil(Math.hypot(q[0]-p[0],q[1]-p[1])/step));for(let j=1;j<=n;j++)line.push(p.map((v,k)=>v+(q[k]-v)*j/n));p=q;}else if(op==='Q'||op==='C'){const a=p,b=point(),c=point(),e=op==='C'?point():c,n=Math.max(4,Math.ceil((Math.hypot(b[0]-a[0],b[1]-a[1])+Math.hypot(c[0]-b[0],c[1]-b[1])+Math.hypot(e[0]-c[0],e[1]-c[1]))/step));for(let j=1;j<=n;j++){const t=j/n,u=1-t;line.push(a.map((v,k)=>op==='Q'?u*u*v+2*u*t*b[k]+t*t*c[k]:u*u*u*v+3*u*u*t*b[k]+3*u*t*t*c[k]+t*t*t*e[k]));}p=e;}else if(op==='Z'){if(line.length)out.push(line);line=[];p=start;}else throw Error('Unflattened SVG command '+op);}if(line.length)out.push(line);return out.map(r=>r.map(p=>p.map(v=>+v.toFixed(3))));}
export const dist=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
export function simplifyLine(points,tolerance=1){
 if(points.length<3)return points;
 const a=points[0],b=points.at(-1);let best=tolerance,index=-1;
 for(let i=1;i<points.length-1;i++){const d=dist(points[i],a,b);if(d>best){best=d;index=i;}}
 return index<0?[a,b]:[...simplifyLine(points.slice(0,index+1),tolerance).slice(0,-1),...simplifyLine(points.slice(index),tolerance)];
}
export function simplifyRing(p,tolerance=1){if(p.length<4)return p;let far=1;for(let i=2;i<p.length;i++)if(Math.hypot(p[i][0]-p[0][0],p[i][1]-p[0][1])>Math.hypot(p[far][0]-p[0][0],p[far][1]-p[0][1]))far=i;return [...simplifyLine(p.slice(0,far+1),tolerance).slice(0,-1),...simplifyLine([...p.slice(far),p[0]],tolerance).slice(0,-1)];}

export const even=p=>{p.setFillType(1);return p.asWinding();};
