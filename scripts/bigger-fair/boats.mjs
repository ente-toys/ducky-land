import fs from 'node:fs';
import {inner,outer,streams,crossings,pathD,ribbon} from './fix-geometry.mjs';
import {smooth,coast} from './design.mjs';
import {archBridge} from './arch.mjs';
const A='public/pixi-art/themes/fair/',D='assets/world/themes/fair/';
const read=p=>JSON.parse(fs.readFileSync(p)),save=(p,d)=>fs.writeFileSync(p,JSON.stringify(d,null,1)+'\n');
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json');
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
save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);
save('scripts/bigger-fair/centre-source/sailing.json',{ring:inner.map((p,i)=>p.map((v,k)=>(v+outer[i][k])/2)),channels:CHANNELS.map(s=>s.line),bridges});
console.log('Fair: 11 arched crossings, two sea mouths, sailable ring.');

const {rebuildFairSurface}=await import('./paths.mjs');
rebuildFairSurface();
