// Rebuild from the protected baseline, then apply the review pass. No shared engine edits.
import './compose.mjs';
import fs from 'node:fs';
import {A,svg,path,el,dpath,ink,grass} from './design.mjs';
import {inShape} from '../../assets/world/island-geometry.mjs';
const read=p=>JSON.parse(fs.readFileSync(p)),save=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');
const D='assets/world/themes/cathedral/',art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),old=read('scripts/bigger-cathedral/baseline/world.json'),geo=read('scripts/bigger-cathedral/fix-water.json');
const waters=geo.polys.map((poly,i)=>{const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);return {id:'bellovo-channel-'+i,poly,x:(x0+x1)/2,y:(y0+y1)/2,rx:(x1-x0)/2,ry:(y1-y0)/2};});
const visualWaters=geo.outlines.map((poly,i)=>{const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);return {id:'bellovo-channel-'+i,poly,x:(x0+x1)/2,y:(y0+y1)/2,rx:(x1-x0)/2,ry:(y1-y0)/2};});
world.water.push(...visualWaters);walk.water.push(...waters);
const protectedBody=path(old.coast,'black')+old.islets.map(([x,y,rx,ry])=>el(x,y,rx,ry,'black')).join('');
const wetBody=geo.outlines.map(p=>path(p,'#6EC9DE')).join('');
let overlay=`<defs><mask id="fix-exterior" maskUnits="userSpaceOnUse" x="-2200" y="-2400" width="12800" height="10400"><rect x="-2200" y="-2400" width="12800" height="10400" fill="white"/>${protectedBody}</mask><mask id="fix-dry" maskUnits="userSpaceOnUse" x="-2200" y="-2400" width="12800" height="10400"><rect x="-2200" y="-2400" width="12800" height="10400" fill="white"/>${protectedBody}${geo.outlines.map(p=>path(p,'black','black',50)).join('')}</mask></defs>`;
// Six deliberately composed, low planted commons leave open grass between their beds.
const commons=[
 ['bell-herbs',3650,-1220,550,130,'#A7BD50'],['north-picnic',850,30,440,230,'#A8BD4C'],
 ['olive-nursery',-860,2820,240,310,'#AFBE54'],['potters-garden',8950,2120,240,270,'#B5C16A'],
 ['bakers-wheat',2850,6500,380,260,'#C5C56B'],['harbour-allotments',6000,5700,360,250,'#AFBE54']
];
let garden='';
for(const [id,x,y,rx,ry,color]of commons){
 garden+=el(x,y,rx,ry,color,'#798C3E',4)+el(x,y,rx*.88,ry*.83,'none','#D5CF84',3);
 if(id.includes('picnic')){garden+=`<path d="M${x-85} ${y-30}l190 -20l20 115l-190 20Z" fill="#D99D71" stroke="${ink}" stroke-width="3"/><path d="M${x-35} ${y-35}l17 115m55 -120l17 115m-130 -65l190 -20" stroke="#F6DFA8" stroke-width="8"/>`+el(x+40,y+20,28,12,'#E8CB7D',ink,2);}
 else for(const dx of [-.55,0,.55]){let xx=x+rx*dx;garden+=`<path d="M${xx-rx*.15} ${y-ry*.62}q${rx*.15} -20 ${rx*.3} 0v${ry*1.24}q${-rx*.15} 20 ${-rx*.3} 0Z" fill="#9B8648" stroke="#6F713A" stroke-width="3"/>`;for(let j=0;j<6;j++)garden+=el(xx,y-ry*.47+j*ry*.18,rx*.11,ry*.065,id.includes('wheat')?'#E6CC75':'#6C993D',ink,1.5);}
 garden+=`<path d="M${x-rx*.75} ${y+ry*.68}q${rx*.75} 35 ${rx*1.5} 0" stroke="#E4CF8B" stroke-width="28" fill="none"/>`;
 world.zones[id]={x,y,rx,ry,name:id.split('-').join(' ')};
}
overlay+=`<g clip-path="url(#extension-land)" mask="url(#fix-dry)">${garden}</g>`;
// Raised green banks and a dark ink lip surround real blue channel polygons.
overlay+=`<g clip-path="url(#extension-land)" mask="url(#fix-exterior)">${geo.outlines.map(p=>path(p,'none','#687D35',38)).join('')}${geo.outlines.map(p=>path(p,'none','#435E38',13)).join('')}${wetBody}${geo.outlines.map(p=>path(p,'none','#B3DDD0',4)).join('')}</g>`;
const edgeScenes=[[2750,625],[3230,720],[620,3050],[870,3580],[6970,2890],[7530,3400],[3890,5290],[4360,5430],[1320,1620],[6180,4780],[1910,280],[1760,630],[7260,4160],[6880,4910],[6570,5790]];
let ripples='';
for(const [x,y]of edgeScenes){
 if(waters.some(o=>inShape(x,y,o,-20)))ripples+=`<path d="M${x-35} ${y}q35 -10 70 0m-44 23q23 -6 46 0" stroke="#D3EEE0" stroke-width="3" fill="none"/>`;
}
overlay+=ripples;
// Chosen bank corners use the existing theme reeds and lily artwork, clipped off the heart.
const accents=[[2770,590],[3270,850],[605,3070],[820,3610],[7040,2820],[7530,3420],[3850,5350],[4400,5460],[1300,1620],[6290,4770],[1960,330],[1800,650],[7260,4200],[6890,4930],[6600,5820]];
let bankArt='';
function stamp(src,x,y,w,h){const text=fs.readFileSync(A+src,'utf8'),box=text.match(/viewBox="([^"]+)"/)[1].split(/[ ,]+/).map(Number),inner=text.replace(/^.*?<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');return `<g transform="translate(${x-w/2} ${y-h}) scale(${w/box[2]} ${h/box[3]}) translate(${-box[0]} ${-box[1]})">${inner}</g>`;}
for(const [x,y]of accents){
 bankArt+=stamp('reuse/nature--cattails.svg',x,y,70,112);
 let pad=null;
 for(let r=0;r<=180&&!pad;r+=30)for(let a=0;a<16&&!pad;a++){let px=x+70+Math.cos(a*Math.PI/8)*r,py=y+40+Math.sin(a*Math.PI/8)*r;if(waters.some(o=>inShape(px,py,o,-35)))pad=[px,py];}
 if(pad)bankArt+=stamp('reuse/nature--lily-pad-flower.svg',pad[0],pad[1],60,42);
}
overlay+=`<g mask="url(#fix-exterior)">${bankArt}</g>`;
const body=fs.readFileSync(A+'communities/ground-extension.svg','utf8').replace(/^.*?<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'')+overlay;
fs.writeFileSync(A+'communities/ground-extension.svg',svg(12800,10400,body,'-2200 -2400 12800 10400'));
for(const t of art.ground.tiles.filter(t=>t.src.endsWith('.svg')))fs.writeFileSync(A+t.src,svg(t.width,t.height,body,`${t.x} ${t.y} ${t.width} ${t.height}`));
const bridgeSegments=[];
function collision(points,width,id){
 const samples=[points[0]];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/45));
  for(let j=1;j<=n;j++){let t=j/n,p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],last=samples.at(-1);if(Math.hypot(p[0]-last[0],p[1]-last[1])>=45)samples.push(p);}
 }
 samples.push(points.at(-1));
 for(const [x,y]of samples)bridgeSegments.push({id,x,y,w:width,h:width});
}
// Four straight retained piers need one rectangle each, rather than repeated samples.
for(const [id,x,y,w,h]of [['west-pier',770,3330,760,147],['east-pier',7235,3150,730,147],['south-pier',4100,5280,147,720],['north-pier',3000,760,124,760]])bridgeSegments.push({id,x,y,w,h});
for(const i of [4,5]){const b=old.walkways[i];collision([b.a,b.b],b.w-18,'retained-deck-'+i);}
for(const c of geo.crossings){
 const pts=c.points,w=c.width,xx=pts.map(p=>p[0]),yy=pts.map(p=>p[1]),x0=Math.floor(Math.min(...xx)-w),y0=Math.floor(Math.min(...yy)-w),W=Math.ceil(Math.max(...xx)+w-x0),H=Math.ceil(Math.max(...yy)+w-y0);
 let b=`<path d="${dpath(pts,false)}" fill="none" stroke="${ink}" stroke-width="${w+7}" stroke-linecap="butt"/><path d="${dpath(pts,false)}" fill="none" stroke="#CF9E61" stroke-width="${w}" stroke-linecap="butt"/>`;
 const left=[],right=[];
 pts.forEach(([x,y],i)=>{let a=pts[Math.max(0,i-1)],z=pts[Math.min(pts.length-1,i+1)],dx=z[0]-a[0],dy=z[1]-a[1],l=Math.hypot(dx,dy)||1,nx=-dy/l,ny=dx/l;left.push([x+nx*w*.48,y+ny*w*.48-16]);right.push([x-nx*w*.48,y-ny*w*.48-16]);b+=path([[x+nx*w/2,y+ny*w/2],[x-nx*w/2,y-ny*w/2]],'none','#9E774B',2,false);});
 b+=path(left,'none',ink,8,false)+path(left,'none','#F6D9A9',4,false)+path(right,'none',ink,8,false)+path(right,'none','#F6D9A9',4,false);
 const src=`communities/river-bridge-${c.id}.svg`;fs.writeFileSync(A+src,svg(W,H,`<defs><mask id="deck-exterior" maskUnits="userSpaceOnUse" x="${x0}" y="${y0}" width="${W}" height="${H}"><rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="white"/>${protectedBody}</mask></defs><g mask="url(#deck-exterior)">${b}</g>`,`${x0} ${y0} ${W} ${H}`));
 art.decks.push({id:'river-bridge-'+c.id,src,x:x0,y:y0,width:W,height:H});collision(pts,w-18,c.id);
}
world.bridges.push(...bridgeSegments);walk.bridges.push(...bridgeSegments);
world.props=art.props;
save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);
save('scripts/bigger-cathedral/fix-metrics.json',{waterPolygons:waters.length,waterArea:geo.waterArea,newCrossings:geo.crossings.map(c=>c.id),retainedDecks:8,commons:commons.map(c=>c[0]),homes:20,variantsPerCommunity:5});
console.log('Review fixes: six restored wet decks, two streams,',geo.crossings.length,'road crossings, six commons, five house variants.');
