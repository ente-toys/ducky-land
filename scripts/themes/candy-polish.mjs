import {readFileSync,writeFileSync} from 'node:fs';
import {drawArcBench} from '../arc-bench-draw.mjs';
import {geometry} from '../../assets/world/island-geometry.mjs';
const A='public/pixi-art/themes/candy/',D='assets/world/themes/candy/';
const read=p=>JSON.parse(readFileSync(p)),write=(p,x)=>writeFileSync(p,JSON.stringify(x,null,1)+'\n');
const world=read(D+'world.json'),walk=read(D+'walk-world.json');
let props=read(D+'placements.json').filter(p=>!p.id.startsWith('candy-craft-')&&!p.id.startsWith('candy-centre-')&&p.asset!=='bench-wood');
const land=geometry({...walk,obstacles:[]});
const seg=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)};
const pathGap=(x,y)=>Math.min(...world.paths.map((p,i)=>Math.min(...p.slice(1).map((b,j)=>seg(x,y,p[j],b)))-([0,1,7,8,13].includes(i)?110:93)));
const inside=(x,y,p)=>{let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i][1]>y)!==(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])c=!c;return c};
const zones=Object.entries(world.zones).filter(([k])=>/^(activity|stalls)-/.test(k));
const inCentre=(x,y,pad=0)=>((x-3570)/(700+pad))**2+((y-2737.5)/(420+pad))**2<1;
const reserved=(x,y,pad=0)=>zones.some(([,z])=>z.poly?inside(x,y,z.poly)||z.line.some(a=>Math.hypot(a[0]-x,a[1]-y)<100+pad):((x-z.x)/(z.rx+pad))**2+((y-z.y)/(z.ry+pad))**2<1);
let seed=61026;const rnd=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296),f=n=>Math.round(n*10)/10;
const initialTrees=props.filter(p=>/^tree-/.test(p.asset));
for(let i=0;i<20;i++)props.push({...initialTrees[i],id:'candy-craft-tree-'+i,zone:'',x:1100+(i%7)*780,y:3700-Math.floor(i/7)*850,scale:initialTrees[i].scale*.88});
const trees=props.filter(p=>/^tree-/.test(p.asset)),grown=[],moves=[];
const landmark=props.filter(p=>/cupcake|falls|sugar-playground|stall-|ticket/.test(p.asset));
function treeClear(p,x,y){
 const w=p.width*p.scale,h=p.height*p.scale;
 if(!land.walkable(x,y)||pathGap(x,y)<w*.40+24||reserved(x,y,110))return false;
 if(((x-3570)/1050)**2+((y-2737.5)/640)**2<1)return false;
 if(x>5550&&y>2850)return false;
 if(y<1150&&grown.filter(q=>q.y<1150).length>=10)return false;
 if(walk.walkways.some(b=>seg(x,y,b.a,b.b)<320))return false;
 const samples=[[0,.16],[0,.42],[0,.72],[-.34,.42],[.34,.42],[-.38,.68],[.38,.68],[0,.95]];
 if(samples.some(([u,v])=>{const xx=x+u*w,yy=y-v*h;return world.water.some(q=>((xx-q.x)/(q.rx+22))**2+((yy-q.y)/(q.ry+18))**2<1)||reserved(xx,yy,8)}))return false;
 if(landmark.some(q=>Math.abs(x-q.x)<w*.45+q.width*q.scale*.5+40&&y>q.y-q.height*q.scale-30&&y-h<q.y+65))return false;
 const cy=y-h*.59;
 return grown.every(q=>{const qw=q.width*q.scale,qh=q.height*q.scale;return ((x-q.x)/(w*.45+qw*.45+22))**2+((cy-(q.y-qh*.59))/(h*.38+qh*.38+18))**2>1});
}
for(const p of trees){
 if(p.zone==='islets'){grown.push(p);continue;}
 const old=[p.x,p.y];let at=treeClear(p,...old)?old:null;
 for(let i=0;!at&&i<30000;i++){
 if(i===10000||i===18000||i===24000)p.scale*=.88;
 const r=150+Math.floor(i/32)*40,a=rnd()*Math.PI*2;
 const x=i<800?old[0]+Math.cos(a)*r:600+rnd()*6000,y=i<800?old[1]+Math.sin(a)*r:650+rnd()*3200;
 if(treeClear(p,+x,+y))at=[+x,+y];
 }
 if(!at)throw Error('No canopy-clear position for '+p.id);
 p.x=f(at[0]);p.y=f(at[1]);if(Math.hypot(p.x-old[0],p.y-old[1])>1)moves.push({id:p.id,from:old,to:[p.x,p.y]});grown.push(p);
}
const furniture=[];
const rings=[
 {id:'centre',x:3570,y:2737.5,rx:758,ry:452,angles:[55,125,235,305]},
 {id:'sugarGarden',x:2062.5,y:1306.5,rx:424,ry:216,angles:[35,90,145]},
 {id:'falls',x:5064,y:1279.5,rx:408,ry:207,angles:[35,90,145]},
 ...zones.filter(([,z])=>!z.poly).map(([id,z])=>({id,...z,rx:z.rx+64,ry:z.ry+51,angles:[20,90,160]}))
];
for(const r of rings)for(const target of r.angles){
 let found=null;
 for(const delta of [0,-8,8,-16,16,-24,24]){
 const deg=target+delta,span=210/r.rx*180/Math.PI,ground=(a,s)=>[r.x+Math.cos(a*Math.PI/180)*s,r.y+Math.sin(a*Math.PI/180)*s*r.ry/r.rx];
 const points=Array.from({length:13},(_,i)=>ground(deg-span/2+span*i/12,r.rx));
 if(points.some(([x,y])=>!land.walkable(x,y)||pathGap(x,y)<35||reserved(x,y,12)))continue;
 const [x,y]=ground(deg,r.rx);
 if(props.some(p=>/tree-|cupcake|falls|sugar-playground|stall-|ticket/.test(p.asset)&&Math.hypot(x-p.x,(y-p.y)*1.4)<(p.asset.startsWith('tree')?140:Math.min(125,p.width*p.scale*.43))+70))continue;
 if(furniture.some(p=>Math.hypot(x-p.x,y-p.y)<240))continue;
 found={deg,span,ground,x,y};break;
 }
 if(!found)continue;
 const {deg,span,ground,x,y}=found,sIn=r.rx-20,sOut=r.rx+20,back=r.rx+24,b={deg,span};
 const arc=s=>Array.from({length:17},(_,i)=>ground(deg-span/2+span*i/16,s));
 const footprint=[...arc(sIn-4),...arc(back+4).reverse()].map(p=>p.map(f));
 const boxPts=[...arc(sIn-4),...arc(back+4)],x0=Math.floor(Math.min(...boxPts.map(p=>p[0])))-6,y0=Math.floor(Math.min(...boxPts.map(p=>p[1])))-54;
 const width=Math.ceil(Math.max(...boxPts.map(p=>p[0])))-x0+6,height=Math.ceil(Math.max(...boxPts.map(p=>p[1])))-y0+6;
 const id=`candy-craft-bench-${r.id}-${target}`,src=id+'.svg';
 const body=drawArcBench(b,{ground,sIn,sOut,back,seat:17,top:47,ink:'#39472D',line:2.2,thin:1.5,spindleDeg:3.2*446/r.rx}).join('\n');
 writeFileSync(A+src,`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x0} ${y0} ${width} ${height}"><title>Candy ${r.id}, slatted bench following its own plaza ellipse</title><g stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`);
 const prop={id,name:'Curved wood bench',asset:'arc-bench',src,x:f(x),y:f(y),width,height,anchor:{x:(f(x)-x0)/width,y:(f(y)-y0)/height},scale:1,flip:false,shadow:false,wind:false,zone:r.id,footprint:{poly:footprint},ring:{x:r.x,y:r.y,rx:r.rx,ry:r.ry,deg,span}};
 props.push(prop);furniture.push(prop);
}
const added=[];
for(const p of props.filter(p=>/flower|tulip|lamp|balloon|bunting|lollipop-tree|bush/.test(p.asset))){
 const near=furniture.find(b=>Math.hypot(p.x-b.x,(p.y-b.y)*1.8)<160);if(!near)continue;
 const old=[p.x,p.y];for(let i=0;i<500;i++){const a=rnd()*Math.PI*2,r=180+rnd()*260,x=old[0]+Math.cos(a)*r,y=old[1]+Math.sin(a)*r;
 if(!land.walkable(x,y)||inCentre(x,y,35)||pathGap(x,y)<80||reserved(x,y,65)||furniture.some(b=>Math.hypot(x-b.x,(y-b.y)*1.6)<190)||props.some(q=>q!==p&&Math.hypot(x-q.x,(y-q.y)*1.6)<140))continue;p.x=f(x);p.y=f(y);break;}
}
function place(template,x,y,id,zone,scale=1){
 if(!land.walkable(x,y)||inCentre(x,y,35)||pathGap(x,y)<52||reserved(x,y,42))return false;
 if(props.some(p=>Math.hypot(x-p.x,(y-p.y)*1.6)<Math.min(110,p.width*p.scale*.4)+55))return false;
 const p={...template,id:'candy-craft-'+id,x:f(x),y:f(y),zone,scale:template.scale*scale};props.push(p);added.push(p);return true;
}
const planter=props.find(p=>p.asset==='gumdrop-planter'),lamp=props.find(p=>p.asset==='candy-lamp'),bushes=props.filter(p=>/^bush-/.test(p.asset));
for(const [id,z]of zones){
 if(z.poly){
 const minY=Math.min(...z.poly.map(p=>p[1])),maxY=Math.max(...z.poly.map(p=>p[1]));
 for(const [i,t]of [.08,.42,.75,.98].entries()){
 const p=z.line[Math.round(t*(z.line.length-1))],y=id==='stalls-3'?maxY+95:minY-85;
 place(i%2?planter:lamp,p[0],y,`${id}-${i}`,id,.85);
 }
 }else for(let i=0;i<12;i++){
 const a=i*Math.PI/6,x=z.x+Math.cos(a)*(z.rx+112),y=z.y+Math.sin(a)*(z.ry+94);
 place(i%3===0?planter:bushes[i%bushes.length],x,y,`${id}-${i}`,id,i%3===0?.9:.65);
 }
}
const rock=props.find(p=>p.asset==='rock-round')||{name:'Coast rock',asset:'rock-round',src:'reuse/nature--rock-round.svg',width:818,height:563,anchor:{x:.5,y:1},scale:.11,flip:false};
for(const [i,t]of grown.entries()){
 const side=i%2?1:-1,x=t.x+side*(t.width*t.scale*.48+60),y=t.y+28;
 if(i%3===0)place(bushes[i%bushes.length],x,y,'tree-bush-'+i,'garden',.7);
 else place(rock,x,y,'tree-rock-'+i,'garden',.72);
}
write(D+'placements.json',props);
write(A+'candy-craft-metrics.json',{curvedBenches:furniture.length,benchRings:[...new Set(furniture.map(p=>p.zone))],trees:trees.length,treeRelocations:moves,edgeAndClusterProps:added.length});
console.log('Candy craft:',furniture.length,'curved benches;',moves.length,'canopies replanted;',added.length,'edge/cluster props');
