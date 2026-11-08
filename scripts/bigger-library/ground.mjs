import fs from 'node:fs';
import {original,rings,pathRing,places,roads,coastRoads,homes,commons,gardenStrips} from './model.mjs';
import {riverArt,crossingArt,crossings,steppingArt} from './waterways.mjs';
const old=original.world.coastRings.map(pathRing).join(' '),land=rings.map(pathRing).join(' ');
// A smooth centre and two independent, gently scalloped banks. Width is authored at each station.
export function sampleRoad({points:p}){const out=[];for(let i=0;i<p.length-1;i++){const a=p[Math.max(0,i-1)],b=p[i],c=p[i+1],d=p[Math.min(p.length-1,i+2)],steps=Math.max(10,Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1])/40));for(let j=0;j<steps;j++){const t=j/steps;out.push([0,1,2].map(k=>.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t)));}}out.push(p.at(-1));return out;}
export const roadSamples=[...coastRoads,...roads].map(r=>({...r,samples:sampleRoad(r)}));
for(const r of roadSamples)for(const p of r.samples)for(const c of crossings){
 const d=Math.hypot(p[0]-c.x,p[1]-c.y);
 if(d<260)p[2]=Math.max(p[2],c.width*Math.max(0,1-d/290));
}
function outline(r){const left=[],right=[];r.samples.forEach((p,i)=>{const a=r.samples[Math.max(0,i-1)],b=r.samples[Math.min(r.samples.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;const l=p[2]/2+9*Math.sin(i*.83)+5*Math.sin(i*1.7),rr=p[2]/2+7*Math.cos(i*.67)+6*Math.sin(i*1.23);left.push([p[0]+nx*l,p[1]+ny*l]);right.push([p[0]-nx*rr,p[1]-ny*rr]);});r.bank=[...left,...right.reverse()];return pathRing(r.bank);}
const contours=roadSamples.map(outline);
let body=`<defs><clipPath id="oldland"><path d="${old}"/></clipPath><clipPath id="allland"><path d="${land}"/></clipPath><pattern id="papergrass" width="283" height="227" patternUnits="userSpaceOnUse"><path d="M13 27l9-5 12 2m88 55 6-10 6 9m-84 51 13-3 12 3m123-94-9 9m-55 100 9-5 12 1M219 207l5-10 5 9" fill="none" stroke="#567e29" stroke-width="2" opacity=".3"/><ellipse cx="176" cy="29" rx="26" ry="9" fill="#bbce59" opacity=".3"/><path d="M88 149q7-14 13 0q7-13 12 1M224 66q6-12 11 0" fill="none" stroke="#719b2d" stroke-width="3" opacity=".5"/><circle cx="32" cy="81" r="3" fill="#d6d979" opacity=".65"/><circle cx="244" cy="177" r="3" fill="#eee2a0" opacity=".6"/></pattern><mask id="road-interiors" maskUnits="userSpaceOnUse" x="-3000" y="-2200" width="14000" height="10400"><rect x="-3000" y="-2200" width="14000" height="10400" fill="black"/>${contours.map(d=>`<path d="${d}" fill="white"/>`).join('')}</mask></defs>`;
for(const r of rings)body+=`<path d="${pathRing(r)}" fill="#93B72F" stroke="#8FD6E6" stroke-width="145"/><path d="${pathRing(r)}" fill="#93B72F" stroke="#FDE48C" stroke-width="72"/>`;
body+=`<g clip-path="url(#allland)"><path d="${land}" fill="url(#papergrass)"/>`;
// Broad tonal commons, shaped around neighbourhoods rather than boxed courts.
for(const d of ['M-1950 2610Q-1000 2130-250 2890L80 3600Q-1300 3310-1910 3850Z','M1900 5700Q2200 5300 2700 5500L2900 6100Q2500 6570 2100 6490Z','M7960 2770Q8690 2240 9480 2770L9650 3310Q8580 3070 7850 3510Z','M5050 5600Q5620 5230 6240 5500L7200 5860Q6380 6310 5260 6010Z'])body+=`<path d="${d}" fill="#a3bf42" opacity=".48"/>`;
// Shaped meadow commons, planted beds and curved footpaths keep open walking space.
for(const [i,c]of commons.entries()){const {x,y,rx,ry}=c;
body+=`<path d="M${x-rx} ${y}Q${x-rx*.6} ${y-ry*1.3} ${x+rx*.3} ${y-ry}Q${x+rx*1.2} ${y-ry*.6} ${x+rx} ${y+ry*.4}Q${x+rx*.4} ${y+ry*1.3} ${x-rx*.5} ${y+ry}Q${x-rx*1.1} ${y+ry*.6} ${x-rx} ${y}Z" fill="${i%2?'#aac34a':'#a0bc42'}" stroke="#7e9f34" stroke-width="7"/><path d="M${x-rx*.8} ${y+ry*.65}Q${x} ${y+ry*.4} ${x+rx*.75} ${y+ry*.7}" stroke="#d9c47f" stroke-width="80" fill="none"/>`;
// Small book-leaf planting beds, each with space between rows.
for(const [dx,dy]of [[-rx*.5,0],[-rx*.1,-ry*.25],[rx*.4,0]]){body+=`<g transform="translate(${x+dx} ${y+dy})"><path d="M-85-20q85-40 170 0v100q-85 35-170 0Z" fill="#b5a064" stroke="#83943f" stroke-width="5"/>`;for(const xx of [-55,0,55])for(const yy of [0,40])body+=`<path d="M${xx} ${yy+17}q-35-3-25-22q20-8 25 13q5-28 26-18q11 23-26 27Z" fill="#6d9639" stroke="#4f7f35" stroke-width="3"/><circle cx="${xx}" cy="${yy+4}" r="6" fill="${i%2?'#d6a36a':'#e6c76d'}"/>`;body+='</g>';}}
// Joined back gardens connect neighbouring plots into shared residential terraces.
// These four shapes follow the authored house clusters rather than making new roads.
for(const [yard,fence,posts]of [
 ['M-1660 200Q-1000-260-300-120L200-100V250Q-500 250-1200 730L-1650 680Z','M-1630 160Q-1000-220-300-90L170-70',[[-1630,160],[-1250,-30],[-820,-150],[-300,-90],[170,-70]]],
 ['M7400 450Q8030-160 8700-10L9320 450 9320 700Q8500 320 7700 800Z','M7440 440Q8030-110 8700 30L9280 450',[[7440,440],[7900,130],[8310,10],[8700,30],[9280,450]]],
 ['M-1700 4460Q-1250 4040-630 4050L100 4050 130 4430Q-850 4520-1550 4940Z','M-1660 4460Q-1250 4080-630 4090L70 4090',[[-1660,4460],[-1250,4190],[-800,4100],[-350,4090],[70,4090]]],
 ['M8340 4200Q8900 4200 9520 4450L9750 5400 9700 5610 9230 5550Q9240 4720 9000 4650L8420 4550Z','M8380 4240Q8900 4240 9480 4490L9710 5400',[[8380,4240],[8880,4330],[9480,4490],[9600,4900],[9710,5400]]]
]){
 body+=`<path d="${yard}" fill="#a9c44d" stroke="#7d9c39" stroke-width="5"/><path d="${fence}" fill="none" stroke="#bb985e" stroke-width="10"/>`;
 for(const[x,y]of posts)body+=`<path d="M${x} ${y+20}v-50" fill="none" stroke="#927342" stroke-width="10"/><circle cx="${x}" cy="${y-30}" r="7" fill="#d9ba79"/>`;
}
// Drawing the entire union in successive passes leaves open, unstriped junctions.
for(const d of contours)body+=`<path d="${d}" fill="#718f32" stroke="#597f2e" stroke-width="34"/>`;
for(const d of contours)body+=`<path d="${d}" fill="#d3b56a" stroke="#b49e53" stroke-width="17"/>`;
for(const d of contours)body+=`<path d="${d}" fill="#f3dc91"/>`;
// A path-side shadow follows only the exposed union edge. Edge pieces inside
// another lane are omitted, so junctions remain open and no full-map SVG filter
// has to allocate a very large intermediate surface.
const within=(x,y,p)=>{let inside=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
let lip='';for(const r of roadSamples)for(let i=0;i<r.bank.length;i++){const a=r.bank[i],b=r.bank[(i+1)%r.bank.length],x=(a[0]+b[0])/2,y=(a[1]+b[1])/2;if(!roadSamples.some(other=>other!==r&&within(x,y,other.bank)))lip+=`M${a.join(' ')}L${b.join(' ')}`;}
body+=`<path d="${lip}" fill="none" stroke="#ac9553" stroke-width="18" opacity=".32" mask="url(#road-interiors)"/>`;
// Worn ruts, lighter patches and sparse edge pebbles follow the lane, not a tiled stripe.
for(const [ri,r]of roadSamples.entries()){for(let i=3;i<r.samples.length-4;i+=5){const p=r.samples[i],b=r.samples[i+3],a=r.samples[i-2],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,off=p[2]*(.16*Math.sin(i+ri)),x=p[0]+nx*off,y=p[1]+ny*off;body+=`<path d="M${x} ${y}Q${p[0]+nx*(off+8)} ${p[1]+ny*(off+8)} ${b[0]+nx*off} ${b[1]+ny*off}" fill="none" stroke="#c9aa63" stroke-width="${5+i%6}" opacity=".44"/>`;
 if(i%3===0)body+=`<ellipse cx="${x}" cy="${y}" rx="${18+i%19}" ry="7" fill="#ffedb2" opacity=".5"/>`;
 const side=i%2?1:-1,ex=p[0]+nx*side*(p[2]/2+9),ey=p[1]+ny*side*(p[2]/2+9);body+=`<g transform="translate(${ex} ${ey})"><path d="M-14 5Q-15-9-3-12Q12-13 15 4Q0 11-14 5Z" fill="#c8bd8b" stroke="#8b9361" stroke-width="2.5"/><path d="M-4-7L7-5" stroke="#eee1af" stroke-width="2"/><path d="M24 0l3-16 6 11 7-9 1 15" fill="none" stroke="#719233" stroke-width="3"/></g>`;
 if(i%2===1)body+=`<g transform="translate(${ex+nx*18} ${ey+ny*18})"><path d="M0 0q-10-35-21-13q-13-40-24-8q-18-29-25 9" fill="#98b641" stroke="#688a31" stroke-width="3"/><circle cx="-18" cy="-14" r="5" fill="#f2d775"/><circle cx="-37" cy="-9" r="4" fill="#e9a289"/></g>`;
 }}
// Reclaimed outer-road plots are household gardens, with joined timber boundaries.
for(const g of gardenStrips){const {x,y,rx,ry}=g;
body+=`<path d="M${x-rx} ${y-ry}Q${x+rx*.8} ${y-ry-90} ${x+rx} ${y-ry+80}L${x+rx*.8} ${y+ry}Q${x-rx*.6} ${y+ry+55} ${x-rx} ${y+ry-60}Z" fill="#a8c14c" stroke="#728f37" stroke-width="6"/>`;
for(const dy of [-ry*.7,-ry*.2,ry*.3,ry*.75]){const cy=y+dy;
body+=`<path d="M${x-rx*.7} ${cy-52}q${rx*.7}-28 ${rx*1.4} 0v100q-${rx*.7} 30-${rx*1.4} 0Z" fill="#ac8d59" stroke="#7c8e42" stroke-width="5"/>`;
for(const dx of [-rx*.48,0,rx*.48])body+=`<path d="M${x+dx} ${cy+28}q-38-12-25-33q23-8 25 20q5-35 29-25q13 24-29 38Z" fill="#729641" stroke="#557c34" stroke-width="3"/><circle cx="${x+dx}" cy="${cy+8}" r="10" fill="${g.color}"/>`;
}
body+=`<path d="M${x-rx-20} ${y-ry}V${y+ry}m0-${ry*1.7} 0-${ry*.2}" stroke="#c4a16a" stroke-width="12" fill="none"/>`;
for(const dy of [-ry,-ry*.65,-ry*.3,ry*.3,ry*.65,ry])body+=`<path d="M${x-rx-20} ${y+dy+30}v-60" stroke="#926c42" stroke-width="12"/>`;
}
// Front gardens and household details are specific to every dwelling. The gate is open.
for(const [i,h]of homes.entries()){const {x,y,type}=h;
body+=`<path d="M${x-240} ${y-120}Q${x} ${y-175} ${x+240} ${y-120}L${x+225} ${y+130}Q${x} ${y+170} ${x-225} ${y+130}Z" fill="#adc653" stroke="#77973a" stroke-width="4"/><path d="M${x-43} ${y-10}Q${x-40} ${y+70} ${x-65} ${y+157}H${x+57}Q${x+36} ${y+70} ${x+43} ${y-10}" fill="#e5cf8a"/>
<path d="M${x-215} ${y+65}q55-29 116 0l-4 47q-55 22-109 0Z" fill="#6f8f35" stroke="#658632" stroke-width="3"/><path d="M${x+110} ${y+65}q55-29 106 0l-4 47q-55 22-109 0Z" fill="#7e9b3c" stroke="#658632" stroke-width="3"/>`;
for(const dx of [-195,-166,-137,125,156,184])body+=`<path d="M${x+dx} ${y+101}v-29" stroke="#a9bf62" stroke-width="4"/><circle cx="${x+dx}" cy="${y+70}" r="8" fill="${i%3===0?'#e5a0ad':i%3===1?'#f1d26e':'#e6b8c7'}" stroke="#a5a448" stroke-width="2"/>`;
if(type==='binder'||type==='sailor')body+=`<path d="M${x-235} ${y-65}V${y-210}m465 145V${y-210}m-465 10q230 45 465 0" fill="none" stroke="#9a7951" stroke-width="5"/><path d="M${x-175} ${y-195}l67 7-5 62-63-7Zm130 10 58 2-3 71-60-5Z" fill="${type==='binder'?'#fff1c7':'#a5bcc8'}" stroke="#ac9670" stroke-width="3"/>`;
// Book-shaped paving plaques at the open porch.
body+=`<path d="M${x-30} ${y+85}l29-5 31 5v20l-31-5-29 5Z" fill="#fff0b8" stroke="#b3a16b" stroke-width="2"/>`;
}
// The shared greens remain walking space, with an irregular rim and stone book medallion.
for(const z of places){const x=z.x,y=z.y+300;body+=`<path d="M${x-230} ${y-45}Q${x-270} ${y-200} ${x-60} ${y-220}Q${x+220} ${y-200} ${x+235} ${y+30}Q${x+150} ${y+220} ${x-90} ${y+190}Q${x-220} ${y+160} ${x-230} ${y-45}Z" fill="#e9d296" stroke="#c5ae72" stroke-width="5"/><path d="M${x-85} ${y-45}Q${x-42} ${y-70} ${x} ${y-36}Q${x+43} ${y-70} ${x+85} ${y-45}V${y+60}Q${x+43} ${y+35} ${x} ${y+68}Q${x-43} ${y+35} ${x-85} ${y+60}Z" fill="#f9e9b6" stroke="#c3ac76" stroke-width="4"/><path d="M${x} ${y-36}V${y+68}" stroke="#c3ac76" stroke-width="3"/>`;}
body+=riverArt()+steppingArt();
for(const c of crossings)body+=crossingArt(c);
body+='</g>';
export const extensionBody=body;
const src=fs.readFileSync('scripts/bigger-library/original/ground.svg','utf8').replace(/^.*?<svg[^>]*>/s,'').replace(/<\/svg>\s*$/,'');
body+=`<g clip-path="url(#oldland)">${src}</g>`;
export const ground=body;
export const svg=(x,y,w,h)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
