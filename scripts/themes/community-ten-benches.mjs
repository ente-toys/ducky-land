// Draw Community's benches with HOME's exact slats, spindle backs and curve geometry.
import fs from 'node:fs';
import {drawArcBench} from '../arc-bench-draw.mjs';
const A='public/pixi-art/themes/community/',D='rive/web/themes/community/',read=p=>JSON.parse(fs.readFileSync(p));
const a=read(A+'art.json'),w=read(D+'world.json'),walk=read(D+'walk-world.json');
// Re-running is safe, ground pass restores the input and these tagged additions replace themselves.
a.props=a.props.filter(p=>!p.id.startsWith('ten-arc-'));
for(const data of [w,walk])data.obstacles=data.obstacles.filter(o=>!o.communityArc);
const defs=[
 {name:'campfire',cx:4000,cy:2640,rx:820,ry:628,r:744,angles:[[-161,15],[-22,15],[42,16],[138,16]]},
 {name:'member',cx:1820,cy:2760,rx:560,ry:400,r:470,angles:[[138,24],[42,24]],replace:['bench-lavender-28','bench-lavender-29']},
 {name:'game',cx:5800,cy:2700,rx:470,ry:300,r:520,angles:[[-68,22],[48,22]],replace:[null,'polish-bench-1']},
 {name:'voice',cx:4000,cy:3780,rx:330,ry:250,r:294,angles:[[-135,24],[-45,24]]},
];
const stats=[];
for(const def of defs){
 const ground=(deg,r)=>{const t=deg*Math.PI/180;return [def.cx+Math.cos(t)*r,def.cy+Math.sin(t)*r*def.ry/def.rx]};
 for(const [i,[deg,span]]of def.angles.entries()){
  const b={deg,span},o={ground,sIn:def.r-20,sOut:def.r+20,back:def.r+24,seat:17,top:47,ink:'#39472D',line:2.2,thin:1.5,spindleDeg:3.2*446/(def.r+24)};
  const arc=r=>Array.from({length:25},(_,j)=>ground(deg-span/2+span*j/24,r));
  const all=[...arc(o.sIn-4),...arc(o.back+4)];
  const x0=Math.floor(Math.min(...all.map(p=>p[0])))-5,x1=Math.ceil(Math.max(...all.map(p=>p[0])))+5;
  const y0=Math.floor(Math.min(...all.map(p=>p[1])))-54,y1=Math.ceil(Math.max(...all.map(p=>p[1])))+5;
  const [x,y]=ground(deg,def.r),width=x1-x0,height=y1-y0;
  const id=def.replace?.[i]??`ten-arc-${def.name}-${i+1}`;
  const old=a.props.find(p=>p.id===id);
  if(old)for(const data of [w,walk])data.obstacles=data.obstacles.filter(o=>!(o.x===old.x&&Math.abs(o.y-old.y)<30));
  a.props=a.props.filter(p=>p.id!==id);
  const src=`detail/ten-arc-${def.name}-${i+1}.svg`;
  fs.writeFileSync(A+src,`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x0} ${y0} ${width} ${height}"><title>Community ${def.name} curved bench, follows the floor ring</title><g stroke-linecap="round" stroke-linejoin="round">${drawArcBench(b,o).join('\n')}</g></svg>`);
  a.props.push({id,name:'Curved wooden bench',src,x,y,width,height,anchor:{x:(x-x0)/width,y:(y-y0)/height},scale:1,flip:false,zone:def.name+'-rim',wind:false,sortY:y});
  const poly=[...arc(o.sIn-4),...arc(o.back+4).reverse()].map(p=>p.map(n=>Math.round(n)));
  for(const data of [w,walk])data.obstacles.push({poly,communityArc:id});
  stats.push({id,ring:def.name,deg,span,x,y,poly});
 }
}
w.props=a.props;
for(const [file,data]of [[A+'art.json',a],[D+'world.json',w],[D+'walk-world.json',walk],[D+'ten-benches.json',stats]])fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
console.log('Drawn',stats.length,'curved benches with matching collision polygons');
