// Explicit site plan and original vector drawings for Bellovo's working neighbourhoods.
import fs from 'node:fs';
import sharp from 'sharp';
export const A='public/pixi-art/themes/cathedral/';
export const OUT='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/world-map/bigger';
export const plan=JSON.parse(fs.readFileSync('scripts/bigger-cathedral/plan.json'));
export const ink='#515332',cream='#FFE9AB',roof='#CB7139',grass='#93B72F',sand='#F7DC88';
export const svg=(w,h,body,box=`0 0 ${w} ${h}`)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${box}">${body}</svg>`;
export const el=(x,y,rx,ry,f,s='none',sw=0)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f}" stroke="${s}" stroke-width="${sw}"/>`;
export function smooth(p,closed=false,n=9){let out=[],N=p.length,P=i=>p[closed?(i+N)%N:Math.max(0,Math.min(N-1,i))];for(let i=0;i<(closed?N:N-1);i++){let a=P(i-1),b=P(i),c=P(i+1),d=P(i+2);for(let j=0;j<n;j++){let t=j/n;out.push([0,1].map(k=>+(.5*(2*b[k]+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t)).toFixed(2)));}}if(!closed)out.push(p.at(-1));return out;}
export const dpath=(p,c=true)=>'M'+p.map(p=>p.join(',')).join('L')+(c?'Z':'');
export const path=(p,f,s='none',sw=0,c=true)=>`<path d="${dpath(p,c)}" fill="${f}" stroke="${s}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
export const coast=smooth(plan.coast,true);
export function roadShape(r){let p=smooth(r.points),left=[],right=[];p.forEach((q,i)=>{let a=p[Math.max(0,i-1)],b=p[Math.min(p.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;let w=r.width/2*(1+.16*Math.sin(i*.31)+.065*Math.sin(i*.87));left.push([q[0]-dy/l*w,q[1]+dx/l*w]);right.push([q[0]+dy/l*w,q[1]-dx/l*w]);});return {p,left,right,poly:[...left,...right.toReversed()]};}
export function house(kind,variant=0){let shutter={bell:'#7D9A54',olive:'#6F8D3C',mosaic:'#54A99A',harbour:'#628FA0'}[kind];let top=({bell:85,olive:115,mosaic:154,harbour:136}[kind])+(variant===1?-14:0);
 let b=el(240,376,210,30,'#6C713A33');
 b+=`<path d="M68 174L237 ${top-30}L411 174V324Q238 383 68 324Z" fill="${cream}" stroke="${ink}" stroke-width="4"/>`;
 b+=`<path d="M68 285Q240 331 411 285V324Q240 380 68 324Z" fill="#D8C787" stroke="${ink}" stroke-width="3"/>`;
 b+=`<path d="M48 174L235 ${top-62}L435 174L405 199L240 ${top-22}L79 198Z" fill="${roof}" stroke="${ink}" stroke-width="5"/>`;
 for(let j=0;j<5;j++)b+=`<path d="M${71+j*20} ${164-j*8}Q240 ${104-j*7} ${414-j*20} ${164-j*8}" fill="none" stroke="#934D30" stroke-width="3"/>`;
 for(let j=0;j<10;j++)b+=`<path d="M${80+j*35} 176l-8 -20" stroke="#EDAA59" stroke-width="3"/>`;
 b+=`<path d="M282 97V48h39v72" fill="${cream}" stroke="${ink}" stroke-width="4"/><path d="M275 48h53v13h-53Z" fill="#D49A60" stroke="${ink}" stroke-width="3"/>`;
 b+=`<path d="M208 332V261a32 32 0 0 1 64 0v71" fill="#A16F36" stroke="${ink}" stroke-width="4"/><path d="M218 260v68m15 -80v82m15 -82v82m15 -70v68" stroke="#704E2D" stroke-width="2"/>${el(259,291,4,4,'#E7C74C',ink,2)}`;
 for(let x of [111,321])b+=`<path d="M${x} 220q23 -30 47 0v42h-47Z" fill="#F6D982" stroke="${ink}" stroke-width="4"/><path d="M${x+23} 207v54m-20 -25h43" stroke="${ink}" stroke-width="3"/><path d="M${x-17} 214h14v53h-14Zm64 0h15v53h-15Z" fill="${shutter}" stroke="${ink}" stroke-width="3"/><path d="M${x-19} 272h85l-10 27h-61Z" fill="#CC7E44" stroke="${ink}" stroke-width="3"/>`+el(x+18,273,24,9,'#6A8D3A',ink,2)+el(x+47,275,16,7,'#A7BC4D',ink,2)+el(x+20,268,5,5,'#F6C66A');
 b+=`<path d="M196 339h87l17 13l-8 13H182l-4 -12Z" fill="#DDD1A0" stroke="${ink}" stroke-width="3"/><path d="M52 326v47m16 -43v43m-26 -20h52" stroke="${ink}" stroke-width="4"/><path d="M40 326l13 -10h26v20H40Z" fill="${shutter}" stroke="${ink}" stroke-width="3"/>`;
 if(kind==='bell')b+=`<path d="M358 100v30m-14 0q0 -24 14 -24t14 24Z" fill="#E7B745" stroke="${ink}" stroke-width="3"/>${el(358,134,5,4,ink)}`;
 if(kind==='mosaic')b+=`<path d="M182 210l16 -12l16 12l-16 12Zm80 0l16 -12l16 12l-16 12Z" fill="#54A99A" stroke="${ink}" stroke-width="2"/>`;
 // Masonry, porch vines and daily-use objects give every facade a human scale.
 b+=`<path d="M81 298h26m18 17h30m195 -10h35m-287 -91h17m235 0h27M82 310h13m273 12h22" stroke="#B3A674" stroke-width="2.5" fill="none"/>`;
 if(kind==='bell')b+=el(240,178,23,23,'#F8D782',ink,3)+`<path d="M240 161v17l12 7" stroke="${ink}" stroke-width="3" fill="none"/>`;
 if(kind==='mosaic')b+=`<path d="M113 154v-31h251v31m-200 -31v22m46 -22v22m46 -22v22m46 -22v22" stroke="${ink}" stroke-width="4" fill="none"/><path d="M92 190h298" stroke="#77A39A" stroke-width="12"/>`;
 if(kind==='harbour')b+=`<path d="M84 285h104m108 0h98M84 301h104m108 0h98M84 317h104m108 0h98" stroke="#8F805A" stroke-width="3"/>${el(355,311,19,23,'#DFCC91',ink,3)}${el(355,311,9,13,'#6A927F',ink,2)}`;
 if(variant===2||kind==='olive'){b+=`<path d="M75 315v-40m330 40v-40M72 275q167 -45 335 0" fill="none" stroke="#727B3B" stroke-width="6"/>`;for(const [x,y]of [[80,279],[100,265],[126,262],[156,256],[186,255],[215,253],[246,256],[278,259],[310,266],[343,270],[372,280]])b+=el(x,y,13,6,'#6F973D',ink,1);}
 // Five visibly different domestic silhouettes in each neighbourhood, still using its kit.
 if(variant===1)b+=`<path d="M61 280h128v-79H61Z" fill="#D6CD99" stroke="${ink}" stroke-width="4"/><path d="M47 203l76 -37l77 37Z" fill="#A85638" stroke="${ink}" stroke-width="4"/><path d="M86 277v-43h43v43" fill="${shutter}" stroke="${ink}" stroke-width="3"/>`;
 if(variant===3)b+=`<path d="M162 297h157l25 30H141Z" fill="${shutter}" stroke="${ink}" stroke-width="4"/><path d="M154 327v37m175 -37v37" stroke="${ink}" stroke-width="5"/>`;
 if(variant===4)b+=`<path d="M225 65V15h41v50m-49 -50h58v12h-58Z" fill="#D4B68A" stroke="${ink}" stroke-width="3"/><path d="M75 318q20 -55 30 -105m270 105q-15 -45 -9 -103" fill="none" stroke="#698C3A" stroke-width="7"/>`;
 b=b.replaceAll(cream,['#FFE9AB','#F0D6A1','#F7E6C2','#E0DCA8','#F4CEA0'][variant%5]).replaceAll(roof,['#CB7139','#A9573B','#CF9652','#A66C48','#BB643F'][variant%5]);
 return svg(480,410,b);
}
export function garden(kind,variant=0){let b=`<path d="M25 75Q235 24 445 75L470 225Q230 292 10 225Z" fill="#B2C65A" stroke="#83983D" stroke-width="3"/>`;
 for(const [x,y]of [[45,100],[45,150],[390,100],[390,150]]){b+=`<path d="M${x} ${y}l45 -9l20 18l-42 14Z" fill="#725C36" stroke="${ink}" stroke-width="2"/>`;for(let j=0;j<4;j++)b+=el(x+8+j*11,y+2,7,5,kind==='mosaic'?'#D5B35D':'#628E3D',ink,1);}
 b+=`<path d="M170 80q50 -20 120 0l-13 164h-95Z" fill="#F7DC88"/>`;
 b+=`<path d="M80 200v-53m280 53v-53M80 150Q220 175 360 150" fill="none" stroke="#6F643E" stroke-width="3"/>`;
 for(const [x,c]of [[130,'#EEDBB5'],[190,'#779C8A'],[248,'#E8B45D']])b+=`<path d="M${x} 158l30 3l-3 36l-30 -3Z" fill="${c}" stroke="${ink}" stroke-width="2"/>`;
 b+=`<path d="M20 200l70 20m300 0l65 -20" stroke="#C5BA83" stroke-width="17"/><path d="M20 194l70 20m300 0l65 -20" stroke="${ink}" stroke-width="2"/><path d="M38 198v-25m23 32v-24m350 23v-24m24 17v-25M22 179l63 18m313 0l53 -18" stroke="#8B7947" stroke-width="4" fill="none"/>`;
 if(variant%2===1)b+=`<path d="M22 80Q75 58 137 66m204 -3q63 -4 105 19" stroke="#536D30" stroke-width="12" fill="none"/><path d="M26 78q55 -20 108 -15m210 0q56 -4 97 17" stroke="#8FAC47" stroke-width="8" fill="none"/>`;
 if(variant===2)b+=el(330,218,33,13,'#CDBD80',ink,2)+`<path d="M311 216q18 -17 39 0" stroke="#6B8538" stroke-width="9" fill="none"/>`;
 if(variant===4)b+=`<path d="M42 65v55m398 -55v55M42 71q200 30 398 0" fill="none" stroke="#746543" stroke-width="3"/><path d="M100 78l28 3v29l-28 -3m180 2l28 -1v-30l-28 1" fill="#D9B767" stroke="${ink}" stroke-width="2"/>`;
 return svg(480,280,b);
}
export function workshop(kind){let b=house(kind).replace(/^.*?<svg[^>]*>/,'').replace('</svg>','');
 b+=`<path d="M83 283Q239 248 402 283l30 49Q240 296 55 332Z" fill="${kind==='mosaic'?'#6AADA1':kind==='bell'?'#BE9855':'#D9A75B'}" stroke="${ink}" stroke-width="4"/>`;
 for(let j=0;j<7;j++)b+=`<path d="M${83+j*44} 282l-15 43h24l14 -47" fill="#F6E7AD" opacity=".7"/>`;
 b+=`<path d="M68 329v55m350 -55v55" stroke="${ink}" stroke-width="5"/><path d="M100 364h283v35H100Z" fill="#B37E42" stroke="${ink}" stroke-width="4"/>`;
 if(kind==='bell')for(let x of [140,225,310])b+=`<path d="M${x} 356q0 -36 18 -36t18 36Z" fill="#E4B347" stroke="${ink}" stroke-width="3"/>${el(x+18,359,21,5,'#B58C36',ink,2)}`;
 if(kind==='olive')for(let x of [130,220,310])b+=`<path d="M${x} 350q-20 -30 10 -34q30 4 10 34l3 30h-26Z" fill="#A78B45" stroke="${ink}" stroke-width="3"/>`;
 if(kind==='mosaic')for(let x of [130,200,270,340])b+=`<path d="M${x} 330q-22 19 -9 44h25q13 -25 -9 -44Z" fill="#D78B4F" stroke="${ink}" stroke-width="3"/>`;
 if(kind==='harbour')for(let x of [130,200,270,340])b+=`<path d="M${x} 365q-8 -32 17 -32t17 32Z" fill="#EDBB64" stroke="${ink}" stroke-width="3"/><path d="M${x+10} 344l8 13m3 -15l8 13" stroke="#AA713D" stroke-width="2"/>`;
 return svg(480,440,b);
}
export function furniture(kind){let b='';
 if(kind==='olive')b=`<path d="M45 160l90 -34l100 34l-100 39Z" fill="#D6CA90" stroke="${ink}" stroke-width="4"/>${el(135,155,82,33,'#AEAA6A',ink,4)}${el(135,135,62,27,'#D3CF95',ink,4)}<path d="M132 127V35m-75 19h153" stroke="#88623B" stroke-width="14"/><path d="M125 28h21v93h-21Z" fill="#A27742" stroke="${ink}" stroke-width="3"/>`;
 if(kind==='bell')b=`<path d="M30 190V25h215v165M30 30h215" stroke="#815F36" stroke-width="15" fill="none"/><path d="M137 35v25m-62 80q0 -92 62 -92t62 92Z" fill="#EAC45B" stroke="${ink}" stroke-width="5"/>${el(137,140,66,16,'#BF9D44',ink,4)}${el(137,155,11,15,'#8A6D32',ink,3)}<path d="M80 100q8 -33 16 -34" fill="none" stroke="#FFE79D" stroke-width="9"/>`;
 if(kind==='mosaic')b=`<path d="M25 110l110 -65l115 65l-110 60Z" fill="#E4D9A0" stroke="${ink}" stroke-width="4"/><path d="M25 110v60m225 -60v60" stroke="#80633D" stroke-width="10"/>`+[[85,100],[132,74],[133,127],[182,100]].map(([x,y],i)=>`<path d="M${x} ${y}l23 -13l23 13l-23 13Z" fill="${['#6EA49A','#C87B43','#A6B14C','#EDBE60'][i]}" stroke="${ink}" stroke-width="2"/>`).join('')+`<path d="M45 150l25 -14m130 14l25 -14" stroke="${ink}" stroke-width="4"/>`;
 if(kind==='harbour')b=`<path d="M15 93q120 75 245 0l-25 60q-100 60 -195 0Z" fill="#CD9D55" stroke="${ink}" stroke-width="5"/><path d="M20 92q120 -64 240 0q-120 65 -240 0Z" fill="#E8C777" stroke="${ink}" stroke-width="4"/><path d="M40 91q100 -40 197 0q-97 40 -197 0Z" fill="#9D8152" stroke="${ink}" stroke-width="3"/><path d="M75 74l125 35m-130 -5l130 -33" stroke="#E2B86A" stroke-width="10"/><path d="M55 162v20m155 -20v20" stroke="${ink}" stroke-width="9"/>`;
 return svg(280,210,b);
}
export async function draw(){
 const {origin:o,width:w,height:h}=plan,k=.12,W=Math.round(w*k),H=Math.round(h*k);
 let body=`<rect x="${o.x}" y="${o.y}" width="${w}" height="${h}" fill="#6EC9DE"/>`+path(coast,sand,'#CBEBEA',45)+path(coast,'#93B72F','#F7E4A0',160);
 for(let r of plan.roads)body+=path(roadShape(r).poly,sand,'#748837',10);
 body+=`<path d="${dpath(JSON.parse(fs.readFileSync('scripts/bigger-cathedral/baseline/world.json')).coast)}" fill="#B2BD51" stroke="#647738" stroke-width="6"/>`;
 for(const c of plan.communities){body+=el(c.x,c.y,390,220,'#F7DC88','#8B9751',12);for(const [i,[x,y]]of c.homes.entries())body+=`<g transform="translate(${x-180} ${y-285}) scale(.75)">${house(c.kind,i%3).replace(/^.*?<svg[^>]*>/,'').replace('</svg>','')}</g>`;let [x,y]=c.work.flat();body+=`<g transform="translate(${x-200} ${y-300}) scale(.85)">${workshop(c.kind).replace(/^.*?<svg[^>]*>/,'').replace('</svg>','')}</g>`;}
 // The heart is drawn from its actual assets, preserving the original composition.
 const art=JSON.parse(fs.readFileSync('scripts/bigger-cathedral/baseline/art.json'));
 const {render}=await import('./render.mjs');let old=await render(art,{x:0,y:0,k,width:960,height:720});
 const world=JSON.parse(fs.readFileSync('scripts/bigger-cathedral/baseline/world.json'));
 let mask=path(world.coast,'white')+world.islets.map(([x,y,rx,ry])=>el(x,y,rx,ry,'white')).join('');
 old=await sharp(old).composite([{input:await sharp(Buffer.from(svg(960,720,mask,'0 0 8000 6000'))).png().toBuffer(),blend:'dest-in'}]).png().toBuffer();
 const base=await sharp(Buffer.from(svg(W,H,body,`${o.x} ${o.y} ${w} ${h}`))).png().toBuffer();
 let labels=`<text x="${W/2}" y="48" text-anchor="middle" font-family="Georgia" font-size="31" fill="#39472D">BELLOVO PIAZZA · FOUR WORKING COMMUNITIES</text>`;
 for(let c of plan.communities){let x=(c.x-o.x)*k,y=(c.y-o.y)*k;labels+=`<g><rect x="${x-135}" y="${y+90}" width="270" height="40" rx="20" fill="#FFF0BC" stroke="#647738" stroke-width="2"/><text x="${x}" y="${y+117}" text-anchor="middle" font-family="Georgia" font-size="23" fill="#39472D">${c.name}</text></g>`;}
 labels+=`<text x="${(4100-o.x)*k}" y="${(3300-o.y)*k}" text-anchor="middle" font-family="Georgia" font-size="20" fill="#39472D">Original piazza, the island's heart</text>`;
 await sharp(base).composite([{input:old,left:Math.round(-o.x*k),top:Math.round(-o.y*k)},{input:Buffer.from(svg(W,H,labels)),left:0,top:0}]).png().toFile(OUT+'/cathedral-communities.png');
 console.log('Drawing locked before data rebuild: cathedral-communities.png');
}
if(process.argv[1]?.endsWith('/design.mjs'))await draw();
