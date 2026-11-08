// Variable-width earthen roads. The irregular outlines, bank and wear follow the road direction.
export function road(ps,width=290){
 const points=[],closed=ps.length>3&&ps[0][0]===ps.at(-1)[0]&&ps[0][1]===ps.at(-1)[1],n=ps.length-1;
 for(let i=0;i<ps.length-1;i++){
  const a=ps[closed?(i-1+n)%n:Math.max(0,i-1)],b=ps[i],c=ps[i+1],d=ps[closed?(i+2)%n:Math.min(ps.length-1,i+2)];
  const steps=Math.max(5,Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1])/44));
  for(let j=0;j<steps;j++){const t=j/steps;points.push([0,1].map(k=>.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t)));}
 }points.push(ps.at(-1));
 const edges=[[],[]];
 for(let i=0;i<points.length;i++){
  const a=points[closed?(i-1+points.length-1)%(points.length-1):Math.max(0,i-1)],b=points[closed?(i+1)%(points.length-1):Math.min(points.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;
  const phase=closed?(i%(points.length-1))/(points.length-1)*Math.PI*2:i*.021;
  const w=width*(.5+.13*Math.sin(phase*10)+.065*Math.cos(phase*29));
  for(let side=0;side<2;side++){const sign=side?1:-1,rough=4*Math.sin(closed?phase*77+side:i*1.7+side);edges[side].push([points[i][0]-dy/len*(w+rough)*sign,points[i][1]+dx/len*(w+rough)*sign]);}
 }
 const xy=p=>p.map(n=>n.toFixed(1)).join(',');
 let polygon;
 if(closed)polygon='M'+[...edges[0],...edges[1].toReversed()].map(xy).join('L')+'Z';
 else {
  const cap=(at,other)=>{const p=points[at],q=points[other],dx=p[0]-q[0],dy=p[1]-q[1],l=Math.hypot(dx,dy)||1;return xy([p[0]+dx/l*width*.65,p[1]+dy/l*width*.65]);};
  polygon='M'+edges[0].map(xy).join('L')+'Q'+cap(points.length-1,points.length-2)+' '+xy(edges[1].at(-1))+'L'+edges[1].toReversed().slice(1).map(xy).join('L')+'Q'+cap(0,1)+' '+xy(edges[0][0])+'Z';
 }
 const bank=`<path d="${polygon}" transform="translate(0 24)" fill="#5d703b" opacity=".42"/><path d="${polygon}" fill="#f4dda0" stroke="#697743" stroke-width="15"/>`;
 const surface=`<path d="${polygon}" fill="#f4dda0"/>`;
 let wear='',verge='';
 // Worn wheel/foot tracks, kept sparse and aligned with the curve.
 for(const offset of [-.21,.14]){
  const line=points.map((p,i)=>{const a=points[closed?(i-1+points.length-1)%(points.length-1):Math.max(0,i-1)],b=points[closed?(i+1)%(points.length-1):Math.min(points.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;return[p[0]-dy/len*width*offset,p[1]+dx/len*width*offset];});
  for(let start=3;start<line.length-4;start+=15){const segment=line.slice(start,start+8);wear+=`<path d="M${segment.map(p=>p.join(',')).join('L')}" fill="none" stroke="#d5b97c" opacity=".3" stroke-width="${offset<0?15:9}"/>`;}
 }
 for(let side=0;side<2;side++)for(let i=3;i<edges[side].length-2;i+=3){
  const[x,y]=edges[side][i],flip=side?-1:1;
  verge+=`<path d="M${x-11} ${y-3}q-6 -27 5 -35l5 24 12 -34 3 30 16 -17 -5 30" fill="#91b632" stroke="#6f8b3d" stroke-width="2"/>`;
  if(i%3===0)verge+=`<ellipse cx="${x+18}" cy="${y+11*flip}" rx="8" ry="5" fill="#b5b69a" stroke="#797f68" stroke-width="2"/><ellipse cx="${x+36}" cy="${y+5}" rx="4" ry="3" fill="#d0c9a6"/>`;
  if(i%4===0)verge+=`<path d="M${x-20} ${y-7}q3 -13 7 -17" stroke="#5b8c54" stroke-width="2"/><circle cx="${x-13}" cy="${y-24}" r="5" fill="#edafc0"/>`;
 }
 // Directional light patches, sand grains and small embedded stones in the worn bed.
 for(let i=8;i<points.length-3;i+=11){const[x,y]=points[i];wear+=`<ellipse cx="${x}" cy="${y}" rx="29" ry="9" fill="#fff0be" opacity=".4"/><path d="M${x+15} ${y+24}l17 2m-57 -12l10 -2" stroke="#d3b77d" stroke-width="2"/><ellipse cx="${x+width*.32}" cy="${y+7}" rx="4" ry="2.4" fill="#bab79a"/>`;}
 return {bank,verge,surface,wear};
}
