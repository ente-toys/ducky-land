import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {drawArcBench} from '../arc-bench-draw.mjs';
import {ids,contour,rim,measure,benchGeometry,round} from './geometry.mjs';
const A='public/pixi-art/themes/library/',D='assets/world/themes/library/';
const read=p=>JSON.parse(fs.readFileSync(p));
export function applyBenches(){
 const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json');
 const old=read('scripts/bigger-library/original/world.json'),oldArt=read('scripts/bigger-library/original/art.json');
 const source=fs.readFileSync('scripts/pagepond-ground/data/centre-ground.svg','utf8');
 const records=[];
 const settings={court:{inset:60,phase:.032},bookstore:{inset:245,phase:.12,start:.12,end:.38}};
 for(const [court,list] of Object.entries(ids)){
  const config=settings[court],border=contour(court,world,source),points=rim(border,config.inset),m=measure(points);
  for(const [i,id] of list.entries()){
   const prior=oldArt.props.find(p=>p.id===id),p=art.props.find(p=>p.id===id);
   if(!p)throw Error('Missing Pagepond bench '+id);
   const distance=court==='bookstore'?m.total*(config.start+(config.end-config.start)*i/(list.length-1)):m.total*(config.phase+i/list.length);
   const g=benchGeometry(points,distance),[ax,ay]=g.centre;
   const x=Math.floor(Math.min(...g.poly.map(p=>p[0])))-6,y=Math.floor(Math.min(...g.poly.map(p=>p[1])))-56;
   const w=Math.ceil(Math.max(...g.poly.map(p=>p[0])))-x+6,h=Math.ceil(Math.max(...g.poly.map(p=>p[1])))-y+7;
   const src=`benches/${id}.svg`,deg=g.tangent[0]>0?-90:90;
   const svg=drawArcBench({deg,span:12},{ground:(a,s)=>g.ground(a-deg+90,s),sIn:-20,sOut:20,back:24,seat:17,top:47,ink:'#39472d',line:2.2,thin:1.5,spindleDeg:1.3});
   fs.mkdirSync(A+'benches',{recursive:true});
   fs.writeFileSync(A+src,`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}" stroke-linecap="round" stroke-linejoin="round"><title>Pagepond inward-facing ${court} rim bench</title>${svg.join('')}</svg>\n`);
   Object.assign(p,{src,x:round(ax),y:round(ay),width:w,height:h,scale:1,anchor:{x:(ax-x)/w,y:(ay-y)/h},flip:false,shadow:false,wind:false,footprint:{poly:g.poly}});
   let obstacleIndex=old.obstacles.findIndex(o=>o.name===id);
   if(obstacleIndex<0)obstacleIndex=old.obstacles.findIndex(o=>o.x===prior.x&&Math.abs(o.y-prior.y)<40);
   if(obstacleIndex<0)throw Error('Missing bench obstacle '+id);
   const originalObstacleIndex=obstacleIndex;
   obstacleIndex=world.obstacles.findIndex(o=>o.name===id);
   if(obstacleIndex<0)obstacleIndex=world.obstacles.findIndex(o=>o.x===prior.x&&Math.abs(o.y-prior.y)<40);
   if(obstacleIndex<0)throw Error('Missing current bench contact '+id);
   const solid={poly:g.poly,name:id};world.obstacles[obstacleIndex]=solid;walk.obstacles[obstacleIndex]=solid;
   records.push({id,court,src,obstacleIndex,originalObstacleIndex,inset:config.inset,distance:round(distance),perimeter:round(m.total),length:178,centre:[p.x,p.y],tangent:g.tangent.map(round),footprint:g.poly});
  }
 }
 fs.writeFileSync(A+'art.json',JSON.stringify(art)+'\n');
 for(const [file,data]of [['world.json',world],['walk-world.json',walk],['placements.json',art.props]])fs.writeFileSync(D+file,JSON.stringify(data)+'\n');
 fs.writeFileSync('scripts/pagepond-benches/placement.json',JSON.stringify(records,null,2)+'\n');
 return records;
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log('Placed',applyBenches().length,'inward-facing tangent benches');
