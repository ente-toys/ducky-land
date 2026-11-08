// Geometry follows the authored road centre lines. These marks are material
// texture and bank contours, not generated scenery or building placements.
export function roadArt(lanes, communities, homes) {
 const paths=[],ruts=[],dressing=[];
 const polygon=p=>'M'+p.map(([x,y])=>`${x.toFixed(1)} ${y.toFixed(1)}`).join('L')+'Z';
 const sampled=(p)=>{
  const out=[];
  for(let i=0;i<p.length-1;i++){
   const a=p[Math.max(0,i-1)],b=p[i],c=p[i+1],d=p[Math.min(p.length-1,i+2)];
   const steps=Math.max(8,Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1])/34));
   for(let j=0;j<steps;j++){const t=j/steps,t2=t*t,t3=t2*t;out.push([0,1].map(k=>.5*(2*b[k]+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t2+(-a[k]+3*b[k]-3*c[k]+d[k])*t3)));}
  }out.push(p.at(-1));return out;
 };
 // Gates join the nearest road, eliminating the previous parallel frontage road.
 // Where the main road runs behind a home, the link bends round its garden.
 const network=lanes.flatMap(sampled);
 const porches=homes.map(h=>{let best=network[0],dist=Infinity;
  for(const q of network){const d=Math.hypot(q[0]-h.x,q[1]-(h.y+223));if(d<dist){best=q;dist=d}}
  if(best[1]<h.y+160){const side=h.x+(best[0]<h.x?-290:290);return [[h.x,h.y+90],[h.x,h.y+230],[side,h.y+250],[side,best[1]+60],best]}
  return [[h.x,h.y+90],[h.x,h.y+223],best];
 });
 const all=[...lanes,...porches];
 for(const [i,p]of all.entries()){
  const samples=sampled(p),left=[],right=[],centres=[],base=i===0?210:i<8?150:i<lanes.length?105:65;
  for(let j=0;j<samples.length;j++){
   const [x,y]=samples[j],a=samples[Math.max(0,j-1)],b=samples[Math.min(samples.length-1,j+1)],d=Math.hypot(b[0]-a[0],b[1]-a[1])||1,nx=-(b[1]-a[1])/d,ny=(b[0]-a[0])/d;
   const near=communities.reduce((s,c)=>Math.max(s,Math.exp(-((x-c.point[0])**2+(y-c.point[1])**2)/160000)),0);
   const width=base*(1+.12*Math.sin(j*.12+i*1.4)+.065*Math.sin(j*.37+i))+near*(i===0?25:i<lanes.length?12:0);
   const l=width/2+9*Math.sin(j*.81),r=width/2+11*Math.sin(j*.64+2);
   left.push([x+nx*l,y+ny*l]);right.push([x-nx*r,y-ny*r]);centres.push([x,y,nx,ny]);
   if(j%2===1&&i<lanes.length){
    const side=Math.floor(j/2)%2?1:-1,offset=side===1?l:r,ex=x+nx*(offset+7)*side,ey=y+ny*(offset+7)*side;
    dressing.push(`<path d="M${ex-5} ${ey+2}l-4 -9m5 7l3 -13m-1 11l7 -7" stroke="#648D31" stroke-width="2.6" fill="none"/>`);
    if(j%7===1)dressing.push(`<g transform="translate(${ex} ${ey}) rotate(${Math.atan2(ny*side,nx*side)*180/Math.PI})"><path d="M6 -23Q-6 -24 -4 -13Q-25 -16 -16 -4Q-31 3 -14 8Q-21 23 -5 17Q-3 29 8 22" fill="#91AF40" stroke="#577D34" stroke-width="2.8"/><path d="M-3 -11l-7 -5m3 14l-9 2m11 8l-6 7" fill="none" stroke="#70943A" stroke-width="2"/></g>`);
    if(j%9===1)dressing.push(`<ellipse cx="${ex+nx*12*side}" cy="${ey+ny*12*side}" rx="6" ry="3.5" fill="#B4A475" stroke="#8A8050" stroke-width="1.5"/>`);
   }
  }
  paths.push(polygon([...left,...right.reverse()]));
  for(let j=12;j<centres.length;j+=23){const [x,y,nx,ny]=centres[j];ruts.push(`<ellipse cx="${x}" cy="${y}" rx="${base*.24}" ry="19" transform="rotate(${Math.atan2(-nx,ny)*180/Math.PI} ${x} ${y})" fill="#FAE8B1" opacity=".5"/>`);}

  for(const side of [-1,1]){
   const pts=centres.map(([x,y,nx,ny],j)=>[x+nx*(base*.23+10*Math.sin(j*.13))*side,y+ny*(base*.23+10*Math.sin(j*.13))*side]);
   ruts.push(`<path d="M${pts.map(p=>p.map(n=>n.toFixed(1)).join(' ')).join('L')}" fill="none" stroke="#BB9455" stroke-width="${i<lanes.length?9:4}" opacity=".43" stroke-dasharray="91 31 49 77 130 55" stroke-linecap="round"/>`);
  }
 }
 // Shared courts have irregular outlines and widen the lane, rather than
 // repeating circular attraction pads around the old centre.
 for(const c of communities){const [x,y,w,h]=c.green;
  // A small worn patch beside the shared green, leaving grass for gathering.
  paths.push(`M${x-w*.27} ${y-h*.12}Q${x-w*.18} ${y-h*.32} ${x+w*.03} ${y-h*.26}Q${x+w*.3} ${y-h*.2} ${x+w*.27} ${y+h*.08}Q${x+w*.16} ${y+h*.3} ${x-w*.08} ${y+h*.25}Q${x-w*.31} ${y+h*.16} ${x-w*.27} ${y-h*.12}Z`);
 }
 const shapes=paths.map(d=>`<path d="${d}"/>`).join('');
 // All banks first, then all sand: at a junction the earth becomes one court.
 return `<defs><pattern id="sand-grain" width="127" height="103" patternUnits="userSpaceOnUse"><path d="M14 22l21 -2m42 49l12 2m-55 14l6 -1" stroke="#D4B465" stroke-width="2" opacity=".35"/><ellipse cx="78" cy="24" rx="14" ry="4" fill="#FCE9AE" opacity=".58"/><ellipse cx="20" cy="65" rx="3.8" ry="2.2" fill="#C2A260"/><circle cx="104" cy="90" r="1.4" fill="#B59B60"/></pattern><clipPath id="roads">${shapes}</clipPath></defs><g fill="#E3C881" stroke="#4F7133" stroke-width="31" stroke-linejoin="round">${shapes}</g><g fill="#E3C881" stroke="#83A33F" stroke-width="25" stroke-linejoin="round">${shapes}</g><g fill="#E4C980" stroke="#B6AD65" stroke-width="13">${shapes}</g><g fill="#F4DC94">${shapes}</g><g clip-path="url(#roads)"><rect x="-2000" y="-1400" width="12000" height="8400" fill="url(#sand-grain)"/>${ruts.join('')}</g>${dressing.join('')}`;
}
