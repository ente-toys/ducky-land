// Run after the expansion builder, before centre.mjs. Source data stays in-repo.
import fs from 'node:fs';
import {inner,outer,streams,crossings,pathD,ribbon} from './fix-geometry.mjs';
import {smooth,coast} from './design.mjs';
import {archBridge} from './arch.mjs';
const A='public/pixi-art/themes/fair/',D='rive/web/themes/fair/';
const read=p=>JSON.parse(fs.readFileSync(p)),save=(p,d)=>fs.writeFileSync(p,JSON.stringify(d,null,1)+'\n');
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json');
// Widen the two existing channels. Their bends and endpoints are hand authored.
export const CHANNELS=[
 {id:'ribbon-run',line:smooth([[560,3200],[-300,3350],[-800,3500],[-1300,3370],[-1800,3320],[-2200,3420]],false,16),width:230},
 {id:'wishwater',line:smooth([[6910,1980],[7340,1840],[7820,1930],[8240,1810],[8680,1620],[9230,1730]],false,16),width:230}
].map(s=>({...s,poly:ribbon(s.line,s.width)}));
const curve=c=>Array.from({length:33},(_,i)=>{const t=i/32,u=1-t;return [0,1].map(k=>u*u*u*c[0][k]+3*u*u*t*c[1][k]+3*u*t*t*c[2][k]+t*t*t*c[3][k]);});
const mouths=[
 {id:'ribbon-mouth',left:[[-1730,3205],[-1960,3205],[-1930,3040],[-2280,3050]],right:[[-1730,3435],[-1950,3435],[-1950,3670],[-2280,3670]]},
 {id:'wishwater-mouth',left:[[8660,1520],[8910,1520],[9030,1390],[9480,1430]],right:[[8660,1750],[8910,1750],[8980,2010],[9480,2070]]}
].map(m=>({...m,poly:[...curve(m.left),...curve(m.right).reverse()]}));
const ring=inner.map((p,i)=>({id:'heart-canal-'+i,poly:[p,inner[(i+1)%inner.length],outer[(i+1)%outer.length],outer[i]]}));
// Old bridge endpoints retained; new crossings use their original centre lines.
const old=read('scripts/bigger-fair/original-world.json');
const bridges=[...crossings.map(b=>({id:b.id,w:Math.min(b.horizontal?b.h:b.w,140),a:b.horizontal?[b.x-b.w/2,b.y]:[b.x,b.y-b.h/2],b:b.horizontal?[b.x+b.w/2,b.y]:[b.x,b.y+b.h/2]}))];
art.decks=art.decks.filter(d=>!old.walkways.some((_,i)=>d.src===read('scripts/bigger-fair/original-art.json').decks[i]?.src)&&!/^bigger\/(crossing-|arch-)/.test(d.src));
const decks=[],arches=[],walkways=[];
for(const b of bridges){const {box,svg,crown}=archBridge(b),src='bigger/arch-'+b.id+'.svg';fs.writeFileSync(A+src,svg);decks.push({src,x:box[0],y:box[1],width:box[2],height:box[3],overBoats:true,resolution:1.5});arches.push({...b,r:crown});walkways.push({...b,boatPassUnder:true});}
art.decks.push(...decks);
for(const w of [world,walk]){
 w.water=w.water.filter(s=>!/^heart-canal-|^ribbon-run$|^wishwater$|mouth/.test(s.id??''));
 w.water.push(...ring,...CHANNELS.map(s=>({id:s.id,poly:s.poly})),...mouths);
 w.bridges=bridges.map(b=>({id:b.id,x:(b.a[0]+b.b[0])/2,y:(b.a[1]+b.b[1])/2,w:Math.abs(b.a[0]-b.b[0])+b.w,h:Math.abs(b.a[1]-b.b[1])+b.w}));
 w.walkways=walkways;w.boatWater=[...ring,...CHANNELS,...mouths].map(s=>{const c=s.poly.reduce((a,p)=>a.map((v,k)=>v+p[k]/s.poly.length),[0,0]);return s.poly.map(p=>p.map((v,k)=>c[k]+(v-c[k])*1.012));});
 w.riverMouths=[[-2450,3100,-1750,3750],[8650,1400,9600,2050]];
}
world.arches=arches;
// Water is painted into the existing extension tiles, with a rounded sand bank.
let paint=`<!--fair-rivers--><g id="fair-rivers"><defs><clipPath id="fair-mouth-land"><path d="${pathD(coast)}"/></clipPath></defs>`;
paint+='<g clip-path="url(#fair-mouth-land)">';
for(const s of CHANNELS){const d='M'+s.line.map(p=>p.join(' ')).join('L');paint+=`<path d="${d}" fill="none" stroke="#F9E2A1" stroke-width="${s.width+45}" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#75CCD2" stroke-width="${s.width}" stroke-linejoin="round"/>`;}
paint+='</g>';
for(const s of mouths){const banks=[s.left,s.right].map(c=>'M'+c[0].join(' ')+'C'+c.slice(1).map(p=>p.join(' ')).join(' ')).join(' ');paint+=`<g clip-path="url(#fair-mouth-land)"><path d="${banks}" fill="none" stroke="#F9E2A1" stroke-width="48"/></g><path d="${pathD(s.poly)}" fill="${art.sea}"/><g clip-path="url(#fair-mouth-land)"><path d="${banks}" fill="none" stroke="#487E67" stroke-width="3"/></g>`;}
paint+='</g>';
for(const t of art.ground.tiles){let svg=fs.readFileSync(A+t.src,'utf8');svg=svg.replace(/<!--fair-rivers-->[\s\S]*?(?=<!--fair-centre-->|<\/svg>$)/,'');const needed=(t.x<720&&t.x+t.width>-2450&&t.y<3700&&t.y+t.height>3000)||(t.x<9600&&t.x+t.width>6750&&t.y<2200&&t.y+t.height>1400);const end=svg.indexOf('<!--fair-centre-->');if(needed)svg=end<0?svg.replace(/<\/svg>\s*$/,paint+'</svg>'):svg.slice(0,end)+paint+svg.slice(end);fs.writeFileSync(A+t.src,svg);}
save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);
save('scripts/bigger-fair/centre-source/sailing.json',{ring:inner.map((p,i)=>p.map((v,k)=>(v+outer[i][k])/2)),channels:CHANNELS.map(s=>s.line),bridges});
console.log('Fair: 11 arched crossings, two sea mouths, sailable ring.');
