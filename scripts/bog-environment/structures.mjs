import fs from 'node:fs';
const root='public/pixi-art/themes/bog-arena';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const save=(p,d)=>fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');
const art=read(`${root}/art.json`),layout=read('scripts/bog-environment/layout.json');
const map=read('src/pixi/bog-environment.json');
let blockers=read('src/pixi/bog-blockers.json');
import {views,writeArcadeModules} from './arcade-modules.mjs';
writeArcadeModules(root);
const seats={
 'bench-0':[1700,1810,1900,1950],'bench-1':[2250,1810,2250,2010],
 'bench-2':[6300,1810,6500,1950],'bench-3':[6850,1810,6850,2010],
 'bench-4':[1700,5610,1900,5750],'bench-5':[2250,5610,2250,5810],
 'bench-6':[6300,5610,6500,5750],'bench-7':[6850,5610,6850,5810],
 'bench-8':[3650,2110,3650,2310],'bench-9':[4750,2110,4750,2310],
 'bench-10':[1770,3920,1770,4090],'bench-11':[6400,3900,6400,4090],
 'bench-12':[3630,7290,3740,7410],'bench-13':[5070,7330,4830,7530],
 'site-seat-0':[1810,3550,2050,3700],'site-seat-1':[2290,3550,2050,3700],
 'site-seat-2':[6160,3580,6350,3770],'site-seat-3':[6530,3580,6350,3770],
};
const variants=['front','left','right','front','right','left'];
function update(p){
 if(seats[p.id]){const [x,y,tx,ty]=seats[p.id];Object.assign(p,{x,y,facing:'south',faces:[tx,ty],shadowSize:[58,8],shadowOffset:[0,-2]});}
 if(p.id.startsWith('site-b-arcade-')){
  if(p.id==='site-b-arcade-1'){p.x=5950;p.y=3730;}
  const view=variants[Number(p.id.split('-').at(-1))];
  Object.assign(p,{src:`home/site-b-arcade-${view}.svg`,name:`site-b-arcade-${view}`,width:190,height:225,view,shadow:false});
  const feet=views[view];let svg=fs.readFileSync(`${root}/${p.src}`,'utf8');
  if(!svg.includes('data-contact-shadow'))svg=svg.replace('<g data-straight-module',`<path data-contact-shadow="piers" d="${feet.map(([x,y])=>`M${x-17} ${y+2}a17 5 0 1 0 34 0a17 5 0 1 0 -34 0`).join(' ')}" fill="#39472d" opacity=".16"/><g data-straight-module`);
  fs.writeFileSync(`${root}/${p.src}`,svg);
 }
 if(p.id==='cove-bridge')Object.assign(p,{x:3724,y:6700.8,width:1152,height:240});
}
for(const p of [...art.props,...art.decks,...layout.props,...layout.decks])update(p);
const oldBlockers=blockers;
blockers=blockers.filter(b=>!b.id.startsWith('site-b-arcade-'));
for(const p of art.props.filter(p=>p.id.startsWith('site-b-arcade-'))){
 for(const [i,[fx,fy]] of views[p.view].entries())blockers.push({id:`${p.id}-pier-${i}`,kind:'landmark',type:'rect',x:p.x-95+fx-12,y:p.y-225+fy-10,width:24,height:18});
}
const updated=new Map(blockers.map(b=>[b.id,b]));
blockers=oldBlockers.map(b=>updated.get(b.id)??b);
layout.blockers=layout.blockers.map(b=>b.id.startsWith('site-b-arcade-')?updated.get(b.id):b);
for(const p of art.props.filter(p=>p.homeSource?.includes('home-hamlets'))){
 const route=layout.routes.find(r=>r.id===`${p.id}-door`);
 if(route){route.points[0]=[p.x,p.y-12];route.points[1]=[p.x,p.y+160];}
}
map.world.obstacles=blockers.map(b=>({id:b.id,poly:[[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]]}));
fs.copyFileSync(`${root}/home/site-b-arcade-front.svg`,`${root}/home/site-b-arcade.svg`);
save(`${root}/art.json`,art);save('scripts/bog-environment/layout.json',layout);save('src/pixi/bog-blockers.json',blockers);
fs.writeFileSync('src/pixi/bog-environment.json',JSON.stringify(map)+'\n');
