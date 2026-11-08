import {readFileSync} from 'node:fs';
export const waterways=JSON.parse(readFileSync(new URL('./water-geometry.json',import.meta.url)));
export function waterArt(){const d=waterways.path;
 return `<defs><clipPath id="new-water"><path d="${d}" fill-rule="evenodd"/></clipPath></defs><path d="${d}" fill="#68BDC6" fill-rule="evenodd" stroke="#496F3D" stroke-width="30"/><path d="${d}" fill="#68BDC6" fill-rule="evenodd" stroke="#D8C17B" stroke-width="21"/><path d="${d}" fill="#75CCD2" fill-rule="evenodd" stroke="#487E67" stroke-width="4"/><g clip-path="url(#new-water)"><pattern id="canal-ripples" width="173" height="119" patternUnits="userSpaceOnUse"><path d="M18 26q21 6 44 0m35 56q16 6 35 0" stroke="#C8EAE0" stroke-width="3.5" fill="none" opacity=".7"/></pattern><rect x="-2000" y="-1400" width="12000" height="8400" fill="url(#canal-ripples)"/></g>`;
}
export function crossingArt(b,protectedShape){
 const [ax,ay]=b.a,[bx,by]=b.b,dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy),angle=Math.atan2(dy,dx)*180/Math.PI;
 const pad=b.w/2+24,x=Math.floor(Math.min(ax,bx)-pad),y=Math.floor(Math.min(ay,by)-pad),w=Math.ceil(Math.abs(dx)+pad*2),h=Math.ceil(Math.abs(dy)+pad*2);
 const body=`<defs><mask id="dry-protection" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="white"/><path d="${protectedShape}" fill="black" stroke="black" stroke-width="12"/></mask></defs><g mask="url(#dry-protection)"><g transform="translate(${ax} ${ay}) rotate(${angle})" stroke="#705833" stroke-width="3"><path d="M-10 ${-b.w/2+8}H${len+10}V${b.w/2+9}H-10Z" fill="#9A6D3C"/><path d="M-10 ${-b.w/2}H${len+10}V${b.w/2-8}H-10Z" fill="#D3A05C"/>${Array.from({length:Math.ceil(len/22)},(_,i)=>`<path d="M${i*22} ${-b.w/2+3}V${b.w/2-10}" stroke="#9D753F" stroke-width="2"/>`).join('')}<path d="M-12 ${-b.w/2-4}H${len+12}M-12 ${b.w/2-6}H${len+12}" stroke-width="10"/><path d="M-12 ${-b.w/2-7}H${len+12}M-12 ${b.w/2-9}H${len+12}" stroke="#EDC47E" stroke-width="5"/>${[0,len].map(t=>`<path d="M${t} ${-b.w/2-16}V${-b.w/2+20}M${t} ${b.w/2-24}V${b.w/2+12}" stroke-width="12"/>`).join('')}</g></g>`;
 return {x,y,width:w,height:h,body};
}
export function crossingCollision(b){
 const dx=b.b[0]-b.a[0],dy=b.b[1]-b.a[1],len=Math.hypot(dx,dy),out=[];
 // An inscribed chain follows angled decks, without making invisible walkable corners.
 const half=(b.w/2-10)/(Math.abs(dx/len)+Math.abs(dy/len));
 for(let t=0;t<=len;t+=24)out.push({name:b.id,x:b.a[0]+dx*t/len,y:b.a[1]+dy*t/len,w:half*2+16,h:half*2+24});
 return out;
}
