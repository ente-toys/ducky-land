// Last readback pass: clear path centre lines and bring the coastal court furniture onto land.
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {geometry} from '../../rive/web/island-geometry.mjs';
const A='public/pixi-art/themes/snow/',D='rive/web/themes/snow/',j=p=>JSON.parse(readFileSync(p)),out=(p,o)=>writeFileSync(p,JSON.stringify(o,null,1)+'\n');
const art=j(A+'art.json'),w=j(D+'world.json'),walk=j(D+'walk-world.json'),props=j(D+'placements.json'),paths=j(D+'paths.json');
const T=([x,y])=>[Math.round((450+(x-60)*4.5)*10)/10,Math.round((420+(y-35)*4.9)*10)/10];
function smooth(p,n=10){const q=[],P=i=>p[Math.max(0,Math.min(p.length-1,i))];for(let i=0;i<p.length-1;i++)for(let k=0;k<n;k++){const a=P(i-1),b=P(i),c=P(i+1),e=P(i+2),t=k/n,t2=t*t,t3=t2*t;q.push([0,1].map(j=>Math.round(.5*(2*b[j]+(-a[j]+c[j])*t+(2*a[j]-5*b[j]+4*c[j]-e[j])*t2+(-a[j]+3*b[j]-3*c[j]+e[j])*t3)*10)/10))}q.push(p.at(-1));return q}
const d=p=>'M'+p.map(q=>q.map(n=>Math.round(n*10)/10).join(' ')).join(' L');
const replacements={2:[[620,388],[551,347],[546,290],[579,228],[649,222],[725,225],[814,260],[910,275]],10:[[885,755],[920,770],[920,846]],16:[[960,224],[927,285],[863,279],[793,264],[715,209]]};
for(const [i,cp]of Object.entries(replacements)){
 const old=d(w.paths[i]),line=smooth(cp.map(T)),next=d(line);
 for(const f of readdirSync(A).filter(f=>/^ground.*\.svg$/.test(f))){const p=A+f,s=readFileSync(p,'utf8');writeFileSync(p,s.replaceAll('d="'+old+'"','d="'+next+'"'))}
 w.paths[i]=line;paths[i].line=line;
}
const seg=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t)};
const pd=(x,y)=>Math.min(...w.paths.flatMap(l=>l.slice(1).map((b,i)=>seg(x,y,l[i],b))));
const bare=geometry({...walk,obstacles:[]}),open=Object.entries(w.zones).filter(([id])=>/^(activity|stalls)-/.test(id)).map(([,z])=>z);
const beds=j(D+'sleepers-resolved.json');
function relocate(id,convert=false){
 const p=props.find(p=>p.id===id);if(!p)return;
 const old=p.footprint,idx=walk.obstacles.findIndex(o=>JSON.stringify(o)===JSON.stringify(old));
 if(convert)Object.assign(p,{name:'snow rock',asset:'snow-rock',src:'detail/snow-rock.svg',width:170,height:115,scale:.7,anchor:{x:.5,y:1},shadow:true});
 let found=false;
 for(let radius=200;radius<1800&&!found;radius+=60)for(let a=0;a<Math.PI*2;a+=.31){
  const x=p.x+Math.cos(a)*radius,y=p.y+Math.sin(a)*radius;
  if(!bare.walkable(x,y)||pd(x,y)<190||open.some(z=>((x-z.x)/(z.rx+45))**2+((y-z.y)/(z.ry+35))**2<1)||beds.some(b=>Math.hypot(x-b.x,(y-b.y)*1.4)<290)||props.some(q=>q.id!==p.id&&Math.hypot(q.x-x,(q.y-y)*1.5)<140))continue;
  Object.assign(p,{x,y,footprint:{x,y:y-10,rx:p.asset==='lamp'?14:44,ry:18}});found=true;break;
 }
 if(!found)throw Error('No land position for '+id);
 if(idx>=0)walk.obstacles[idx]=p.footprint;
 Object.assign(art.props.find(q=>q.id===id),p);
}
for(const p of [...props])if(!bare.walkable(p.x,p.y-4)&&!/bridge|snow-ducky/.test(p.name))relocate(p.id,p.asset==='arc-bench');
for(const id of ['snow-275','snow-11','snow-266','snow-37','snow-247'])relocate(id);
// The south-east footpath ends at the shoreline. It is not an unregistered jetty.
while(w.paths[13].length>2&&!bare.walkable(...w.paths[13].at(-1)))w.paths[13].pop();paths[13].line=w.paths[13];
w.props=props.map(({id,name,x,y,zone})=>({id,name,x,y,zone}));
out(A+'art.json',art);out(D+'world.json',w);out(D+'walk-world.json',walk);out(D+'placements.json',props);out(D+'paths.json',paths);
const m=j(A+'snow-metrics.json');m.curvedBenches=props.filter(p=>p.asset==='arc-bench').length;out(A+'snow-metrics.json',m);
console.log('Snow coastal furniture and igloo/bridge approaches corrected');
