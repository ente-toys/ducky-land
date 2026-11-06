// Close-up craft pass. Sunflower only, replayed from the retained close-baseline.
import {readFileSync,writeFileSync} from 'node:fs';
import {geometry,inShape} from '../../rive/web/island-geometry.mjs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {resolveSleepSpots,sleepHalfWidths} from '../../src/pixi/sleep-spots.js';
import {drawArcBench} from '../arc-bench-draw.mjs';
const A='public/pixi-art/themes/sunflower/',D='rive/web/themes/sunflower/',B='../concepts/themes/work/sunflower/close-baseline/';
const read=p=>JSON.parse(readFileSync(p,'utf8')),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,1)+'\n');
const art=read(B+'art.json'),world=read(B+'world.json'),walk=read(B+'walk-world.json'),harbor=read(D+'harbor.json');
const geo=geometry(makeMap('sunflower',{world,walk,harbor,sleepers:[]}).baseWalk),sizes=sleepHalfWidths();
const beds=resolveSleepSpots(world,art.props,geo.walkable,sizes,{spots:world.sleepSpots,avoid:world.sleepAvoid,warn:false});
const f=n=>+n.toFixed(2),rad=d=>d*Math.PI/180;
const path=pts=>'M'+pts.map(p=>p.map(f).join(' ')).join(' L')+' Z';
const ellipse=(x,y,rx,ry)=>`M${f(x+rx)} ${f(y)} A${rx} ${ry} 0 1 0 ${f(x-rx)} ${f(y)} A${rx} ${ry} 0 1 0 ${f(x+rx)} ${f(y)} Z`;
const E=(x,y,rx,ry,attrs)=>`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" ${attrs}/>`;
const svg=(title,x,y,w,h,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}" stroke-linecap="round" stroke-linejoin="round"><title>${title}</title>${body}</svg>`;
function flat(id,file,x,y,w,h,body,before=false){
 writeFileSync(A+'detail/'+file,svg(id,x,y,w,h,body));
 const p={id:'close-'+id,src:'detail/'+file,x,y,width:w,height:h,topLeft:true};
 const idx=art.flats.findIndex(p=>p.id==='centre-decal-floor');
 art.flats.splice(idx+(before?0:1),0,p);
}
// Hand-sized masonry, cream highlights and the same alternating courses as Home.
const C=[3880,2608.5],k=666/1140,pt=(r,a)=>[C[0]+r*Math.cos(rad(a)),C[1]+r*k*Math.sin(rad(a))];
let paving=`<defs><clipPath id="plaza"><ellipse cx="3880" cy="2608.5" rx="1130" ry="656"/></clipPath></defs>`;
paving+=E(...C,1130,656,'fill="#FFF0C7" stroke="#AA955C" stroke-width="2.2"');
paving+='<g clip-path="url(#plaza)">';
const rings=[0,725,805,885,965,1045,1128];
for(let row=1;row<rings.length;row++){
 const ri=rings[row-1],ro=rings[row],n=Math.max(48,Math.round(2*Math.PI*ro/90)),step=360/n;
 for(let i=0;i<n;i++){
  const a=(i+(row%2)*.5)*step,b=a+step;
  const pts=[...Array.from({length:5},(_,j)=>pt(ro,a+(b-a)*j/4)),...Array.from({length:5},(_,j)=>pt(ri,b-(b-a)*j/4))];
  const fill=['#FFE6A0','#FFF3D2','#FFEFB9','#FDE48C'][(i+row*3)%4];
  paving+=`<path d="${path(pts)}" fill="${fill}" stroke="#B09B65" stroke-width="1.55"/>`;
 }
}
for(const r of [1099,1126])paving+=E(...C,r,r*k,'fill="none" stroke="#9D8A51" stroke-width="2"');
// Tiny seed diamonds in a narrow border, deliberately smaller than a Ducky.
for(let a=0;a<360;a+=5){const [x,y]=pt(1112,a);paving+=`<path d="M${f(x-5)} ${f(y)} l5 -4 l5 4 l-5 4 Z" fill="#D3AD4E"/>`;}
paving+='</g>';
flat('plaza-courses','close-plaza-courses.svg',2738,1930,2284,1360,paving,true);
// An inlaid sunflower rosette on the sunken floor. Decorative only, no new obstacle.
const [cx,cy]=[3880,2709.9],ky=.765957;
const pp=(r,a)=>[f(cx+r*Math.cos(rad(a))),f(cy+r*ky*Math.sin(rad(a)))];
let rosette='<defs><clipPath id="floor"><ellipse cx="3880" cy="2709.9" rx="565" ry="431"/></clipPath></defs><g clip-path="url(#floor)">';
// A pair of thin inset rings ends the hexagonal floor cleanly against the lowest riser.
rosette+=E(cx,cy,541,541*ky,'fill="none" stroke="#B6A16B" stroke-width="2"');
rosette+=E(cx,cy,524,524*ky,'fill="none" stroke="#D9BB67" stroke-width="4"');
for(let i=0;i<18;i++){
 const a=i*20,lo=pp(205,a-7),c1=pp(344,a-13),tip=pp(475,a),c2=pp(344,a+13),hi=pp(205,a+7);
 rosette+=`<path d="M${lo} Q${c1} ${tip} Q${c2} ${hi} Q${pp(189,a)} ${lo} Z" fill="${i%2?'#FDE7A3':'#F5D781'}" stroke="#BEA263" stroke-width="2.1"/>`;
 const a0=pp(251,a),a1=pp(433,a);rosette+=`<path d="M${a0} L${a1}" stroke="#FFF4D3" stroke-width="2.8"/>`;
}
for(const r of [178,194])rosette+=E(cx,cy,r,r*ky,'fill="none" stroke="#BDA568" stroke-width="2"');
for(let a=0;a<360;a+=10){const p=pp(507,a);rosette+=`<path d="M${p[0]-5} ${p[1]} l5 -5 l5 5 l-5 5 Z" fill="#C4A157"/>`;}
rosette+='</g>';
flat('sunflower-rosette','close-sunflower-inlay.svg',3300,2265,1160,890,rosette);
// Small sunflower inlay badges give the two finished market aprons their own identity.
function medallion(x,y,r=25){let s=E(x,y,r*1.65,r*1.1,'fill="#FFECB0" stroke="#B09B65" stroke-width="1.5"');
 for(let a=0;a<360;a+=45){const t=rad(a);s+=E(x+Math.cos(t)*r*.8,y+Math.sin(t)*r*.56,r*.42,r*.29,'fill="#F4CD69" stroke="#B39A58" stroke-width="1.4"');}
 return s+E(x,y,r*.36,r*.25,'fill="#B39756" stroke="#947B45" stroke-width="1.4"');}
for(const [key,x,y,w,h] of [['market',4960,2700,1600,360],['farm',3990,1570,670,390]]){
 const body=[.18,.5,.82].map(t=>medallion(x+w*t,y+h*.62)).join('');
 const p={id:'close-'+key+'-inlays',src:`detail/close-${key}-inlays.svg`,x,y,width:w,height:h,topLeft:true};
 writeFileSync(A+p.src,svg(p.id,x,y,w,h,body));art.flats.push(p);
}
const seg=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)};
const edge=(x,y)=>Math.min(...world.paths.flatMap((p,i)=>p.slice(1).map((b,j)=>seg(x,y,p[j],b)-world.pathWidths[i]/2)));
const activities=Object.entries(world.zones).filter(([key])=>key.startsWith('activity'));
const markets=Object.entries(world.zones).filter(([key])=>key.startsWith('stalls')).map(([,z])=>z);
const open=(x,y,pad=0)=>activities.some(([,z])=>((x-z.x)/(z.rx+pad))**2+((y-z.y)/(z.ry+pad))**2<1)||markets.some(z=>x>z.x0-pad&&x<z.x1+pad&&y>z.y0-pad&&y<z.y1+pad);
function clear(x,y,r){
 if(!geo.walkable(x,y)||edge(x,y)<r+30||open(x,y,r))return false;
 if(world.walkways.some(w=>seg(x,y,w.a,w.b)<w.w/2+r+45))return false;
 if(world.obstacles.some(o=>inShape(x,y,o,r+12)))return false;
 if(beds.some(b=>Math.hypot(x-b.x,(y-b.y)*1.3)<r+b.r+70))return false;
 if(art.props.some(p=>!p.id.startsWith('centre-')&&Math.hypot(x-p.x,(y-p.y)*1.4)<r+50))return false;
 if(art.props.some(p=>p.name==='Tree'&&p.y>y-15&&p.y-y<p.height*p.scale*.9&&Math.abs(p.x-x)<p.width*p.scale*.48+r))return false;
 return true;
}
let added=[];
function prop(id,template,x,y){
 const p={...structuredClone(template),id:'close-'+id,x:f(x),y:f(y)};art.props.push(p);added.push(p.id);
 const o={name:p.id,x:p.x,y:p.y-7,rx:template.name==='Lamp'?14:49,ry:template.name==='Lamp'?10:24};
 world.obstacles.push({...o});walk.obstacles.push({...o});
}
const planter=art.props.find(p=>p.id==='sunflower-planter-28'),lamp=art.props.find(p=>p.id==='lamp-20');
// Planter pockets in the masonry rim, found between paths, benches and residents.
for(const [i,a] of [-161,-139,-111,-48,-12,22,44,112,154].entries()){
 search:for(const r of [1090,1160,1210])for(const delta of [0,4,-4,8,-8,12,-12,16,-16]){
  const [x,y]=pt(r,a+delta);
  if(clear(x,y,62)){prop('rim-planter-'+i,planter,x,y);break search;}
 }
}
// Actual slatted arc benches, using the same drawing routine as Home and the prior Sunflower pass.
const benches=[];
for(const [key,z] of activities){
 let count=art.props.filter(p=>p.id.includes(key+'-bench')).length;
 for(const wanted of Array.from({length:144},(_,i)=>i*2.5+20)){
  if(count>=2)break;
  const rx=z.rx+140,ry=z.ry+125,k=ry/rx,span=15,ground=(a,r)=>[z.x+Math.cos(rad(a))*r,z.y+Math.sin(rad(a))*r*k];
  const points=(r,n=20)=>Array.from({length:n+1},(_,i)=>ground(wanted-span/2+span*i/n,r));
  const foot=[...points(rx-40),...points(rx+8).reverse()];
  if(foot.some(([x,y])=>!clear(x,y,18)))continue;
  const id=`close-${key}-bench-${count}`,pts=[...points(rx-40),...points(rx+8)],xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
  const x0=Math.floor(Math.min(...xs))-5,y0=Math.floor(Math.min(...ys))-53,w=Math.ceil(Math.max(...xs)-x0+5),h=Math.ceil(Math.max(...ys)-y0+5),[x,y]=ground(wanted,rx-22);
  const o={ground,sIn:rx-36,sOut:rx-3,back:rx,seat:17,top:47,ink:'#39472D',line:2.2,thin:1.5,spindleDeg:3.2*446/rx};
  writeFileSync(A+`detail/${id}.svg`,svg(id,x0,y0,w,h,drawArcBench({deg:wanted,span},o).join('')));
  art.props.push({id,name:'Curved wood bench',src:`detail/${id}.svg`,x:f(x),y:f(y),width:w,height:h,anchor:{x:(x-x0)/w,y:(y-y0)/h},scale:1,shadow:false,wind:false});
  const o2={name:id,poly:foot.map(p=>p.map(f))};world.obstacles.push(structuredClone(o2));walk.obstacles.push(structuredClone(o2));benches.push({id,footprint:o2.poly});count++;
 }
}
// Lamps and planters belong to the edge of each open meadow, never its playable centre.
for(const [key,z] of activities)for(const [i,wanted] of [35,145,220,310].entries()){
 for(const offset of [0,...Array.from({length:12},(_,i)=>10+i*10).flatMap(d=>[d,-d])]){
  const a=rad(wanted+offset),x=z.x+Math.cos(a)*(z.rx+145),y=z.y+Math.sin(a)*(z.ry+125);
  const template=i%2?planter:lamp,r=i%2?62:25;
  if(clear(x,y,r)){prop(key+'-'+(i%2?'planter':'lamp')+'-'+i,template,x,y);break;}
 }
}
world.props=art.props;
const map=makeMap('sunflower',{world,walk,harbor,sleepers:[]});
const resolved=resolveSleepSpots(map.baseWalk,art.props,geometry(map.baseWalk).walkable,sizes,{spots:world.sleepSpots,avoid:world.sleepAvoid,warn:false});
if(resolved.length!==40||resolved.bad.length)throw Error('Sleeper clearance: '+JSON.stringify(resolved.bad));
save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);
save(D+'sunflower-close-changes.json',{addedProps:added,benches,flatLayers:4,sleepers:resolved.length,centreArtUnchanged:true});
console.log({addedProps:added,benches:benches.map(b=>b.id),props:art.props.length,flats:art.flats.length,sleepers:resolved.length});
