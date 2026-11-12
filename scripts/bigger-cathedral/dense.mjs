import './fix.mjs';
import fs from 'node:fs';
import {A,svg,path,el,ink,grass} from './design.mjs';
const read=p=>JSON.parse(fs.readFileSync(p)),save=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');
const D='assets/world/themes/cathedral/',art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),old=read('scripts/bigger-cathedral/baseline/world.json'),water=read('scripts/bigger-cathedral/fix-water.json');
const protectedBody=path(old.coast,'black')+old.islets.map(([x,y,rx,ry])=>el(x,y,rx,ry,'black')).join('');
let body=`<defs><mask id="dense-dry" maskUnits="userSpaceOnUse" x="-2200" y="-2400" width="12800" height="10400"><rect x="-2200" y="-2400" width="12800" height="10400" fill="white"/>${protectedBody}${water.outlines.map(p=>path(p,'black','black',25)).join('')}</mask></defs>`;
const plots=[['bell-kitchen',5000,-680,340,150,'#A7B74C'],['olive-kitchen',-90,2900,240,150,'#A3B751'],['potters-drying-green',8720,3300,300,165,'#ADBE57'],['bakers-kitchen',3850,7000,275,120,'#BBC565']];
let gardens='';
for(const [id,x,y,rx,ry,color]of plots){
 gardens+=el(x,y,rx,ry,color,'#708B39',3)+el(x,y,rx*.91,ry*.83,'none','#CED181',2);
 const beds=[[-.55,-.12],[0,.08],[.55,-.12]];
 for(const [dx,dy]of beds){let xx=x+rx*dx,yy=y+ry*dy;
  gardens+=`<path d="M${xx-rx*.18} ${yy-ry*.5}q${rx*.18} -14 ${rx*.36} 0v${ry}q${-rx*.18} 14 ${-rx*.36} 0Z" fill="${id==='potters-drying-green'?'#D1AE70':'#8C7543'}" stroke="${ink}" stroke-width="2"/>`;
  for(const off of [-.3,0,.3])gardens+=el(xx,yy+ry*off,rx*.13,ry*.075,id==='potters-drying-green'?'#C78351':id==='bakers-kitchen'?'#D9C568':'#6D9738',ink,1.5);
 }
 gardens+=`<path d="M${x-rx*.85} ${y-ry*.45}v-25m0 11q${rx*.8} -55 ${rx*1.6} 0m0 14v-25" stroke="#746440" stroke-width="4" fill="none"/>`;
 world.zones[id]={x,y,rx,ry,name:id.split('-').join(' ')};
}
body+=`<g clip-path="url(#extension-land)" mask="url(#dense-dry)">${gardens}</g>`;
let ground=fs.readFileSync(A+'communities/ground-extension.svg','utf8').replace(/^.*?<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'')+body;
fs.writeFileSync(A+'communities/ground-extension.svg',svg(12800,10400,ground,'-2200 -2400 12800 10400'));
for(const t of art.ground.tiles.filter(t=>t.src.endsWith('.svg')))fs.writeFileSync(A+t.src,svg(t.width,t.height,ground,`${t.x} ${t.y} ${t.width} ${t.height}`));
const additions=[
 ['bell-kitchen-olive-0','detail/olive-tree.svg',4770,-710,260,280,38,20],
 ['bell-kitchen-olive-1','detail/olive-tree.svg',5320,-550,270,290,38,20],
 ['potters-olive-0','detail/olive-tree.svg',9140,3180,290,310,38,20],
 ['potters-olive-1','detail/olive-tree.svg',8800,3600,270,290,38,20],
 ['bakers-fruit-olive','detail/olive-tree.svg',5350,6860,270,290,38,20],
 ['bell-shared-well','centre/olive-well.svg',3920,-180,150,105,40,17],
 ['olive-shared-well','centre/olive-well.svg',-270,2660,150,105,40,17],
 ['tessera-shared-well','centre/olive-well.svg',8400,2390,150,105,40,17],
 ['harbour-shared-well','centre/olive-well.svg',4700,6120,150,105,40,17]
];
for(const [id,src,x,y,width,height,rx,ry]of additions){art.props.push({id:'dense-'+id,name:id,src,x,y,width,height,scale:1,anchor:{x:.5,y:1}});let o={x,y:y-ry,rx,ry};walk.obstacles.push(o);world.obstacles.push(o);}
world.props=art.props;save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);
console.log('Densified Cathedral: shared wells, five orchard trees, four reclaimed community plots.');
