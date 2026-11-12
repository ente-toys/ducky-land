import {readFileSync,writeFileSync} from 'node:fs';
import {inShape,geometry} from '../../assets/world/island-geometry.mjs';
import {addArc,ring} from './cathedral-craft.mjs';
const ROOT='public/pixi-art/themes/cathedral/',DATA='assets/world/themes/cathedral/',BASE='../concepts/themes/work/cathedral/closeup-base/';
const read=p=>JSON.parse(readFileSync(p)),art=read(BASE+'art.json'),world=read(BASE+'world.json'),walk=read(BASE+'walk-world.json'),arcs=read(BASE+'arc-benches.json');
const f=n=>Math.round(n*10)/10,poly=p=>'M'+p.map(q=>q.map(f).join(' ')).join('L')+'Z',zones=Object.entries(world.zones).filter(([n])=>/^(activity|stalls)-/.test(n));
let ground=readFileSync(BASE+'ground.svg','utf8');
const ellipse=(z,r,fill,stroke='#B6A173',sw=1.7)=>`<ellipse cx="${z.x}" cy="${z.y}" rx="${f(z.rx*r)}" ry="${f(z.ry*r)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
function paving(z,id,{base=true,rosette=true}={}){
 const k=z.ry/z.rx,point=(a,r)=>[z.x+Math.cos(a)*r,z.y+Math.sin(a)*r*k];
 let s=`<defs><clipPath id="close-${id}">${ellipse(z,.998,'white','none',0)}</clipPath><pattern id="tiles-${id}" width="132" height="98" patternUnits="userSpaceOnUse"><path d="M0 0H132V98H0Z M66 0V49M0 49H132M33 49V98M99 49V98" fill="none" stroke="#C7AF7D" stroke-width="1.3"/></pattern></defs><g clip-path="url(#close-${id})">`;
 if(base)s+=ellipse(z,1,'#F9E7B0','#9B925C',3.5);
 const courses=base?[.25,.53,.79,.94]:[.63,.77,.94];
 for(const [i,r]of courses.entries())s+=ring(z,z.rx*r-12,z.rx*r+12,{steps:base?Math.max(36,Math.round(z.rx/16)):88,color:i%2?'#F5DEA6':'#E7CD94',edge:'#AE996D'});
 const edges=base?[0,.25,.53,.79,.94]:[.61,.77,.94];
 for(let c=0;c<edges.length-1;c++){
  const r0=z.rx*edges[c]+(c?12:0),r1=z.rx*edges[c+1]-12,n=base?(12+c*8):48;
  for(let i=0;i<n;i++){const a=(i+(c%2)*.5)*2*Math.PI/n,b=a+2*Math.PI/n,pts=[];for(let j=0;j<=5;j++)pts.push(point(a+(b-a)*j/5,r0));for(let j=5;j>=0;j--)pts.push(point(a+(b-a)*j/5,r1));s+=`<path d="${poly(pts)}" fill="${['#F9E7B0','#F6DFA8','#FAE9B8','#F5DDA3'][i%4]}" stroke="#B9A477" stroke-width="1.2" stroke-linejoin="round"/>`;}
 }
 if(rosette){
  const r=base?.48:.855,spread=base?.13:.055,n=base?8:16;
  for(let i=0;i<n;i++){const a=i*2*Math.PI/n,pts=[point(a,z.rx*(r-spread)),point(a-.047,z.rx*r),point(a,z.rx*(r+spread)),point(a+.047,z.rx*r)];s+=`<path d="${poly(pts)}" fill="${i%2?'#C9B382':'#A6B277'}" stroke="#A4976A" stroke-width="1.5"/>`;}
 }
 for(const [i,r]of courses.entries())s+=ring(z,z.rx*r-12,z.rx*r+12,{steps:base?Math.max(36,Math.round(z.rx/16)):88,color:i%2?'#F5DEA6':'#E7CD94',edge:'#AE996D'});s+=ellipse(z,.985,'none','#706B43',2.3)+'</g>';return s;
}
let finishing='';for(const [name,z]of zones)finishing+=paving(z,name,{rosette:!name.startsWith('stalls')});
finishing+=paving({x:4100,y:1670,rx:1240,ry:455},'forecourt',{rosette:false});
writeFileSync(ROOT+'detail/piazza-mosaic.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="2180" height="1700" viewBox="3010 1830 2180 1700"><title>Bellovo rose-window mosaic, full piazza paving</title>${paving(world.zones.plaza,'piazza',{base:false})}</svg>`);
art.flats.splice(2,0,{src:'detail/piazza-mosaic.svg',x:3010,y:1830,width:2180,height:1700,topLeft:true});
writeFileSync(ROOT+'detail/olive-pot.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="140" height="193" viewBox="0 0 140 193"><title>Olive tree in a terracotta piazza pot</title><g stroke="#39472D" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="70" cy="181" rx="46" ry="9" fill="#6E7636" opacity=".18" stroke="none"/><path d="M38 142L46 178Q70 193 94 178L102 142Z" fill="#C98950"/><path d="M81 147L77 181Q90 181 94 175L101 144Z" fill="#AA693D" stroke="none"/><ellipse cx="70" cy="142" rx="35" ry="12" fill="#DDA96A"/><ellipse cx="70" cy="140" rx="28" ry="7" fill="#6A633E"/><path d="M67 140Q73 103 61 79L70 75Q83 111 76 140Z" fill="#AD7841"/><path d="M69 112L44 88M73 100L93 78" fill="none" stroke="#AD7841" stroke-width="7"/><path d="M18 70Q8 52 29 45Q21 25 42 23Q44 7 65 15Q82 2 94 21Q115 18 116 38Q137 45 123 63Q135 83 114 90Q110 109 90 100Q75 113 60 100Q40 108 33 93Q12 90 18 70Z" fill="#8FAD56"/><path d="M28 42Q24 35 35 30M47 23Q58 16 64 22M91 25Q105 23 108 36" fill="none" stroke="#D5DC8C" stroke-width="5"/><path d="M28 77Q38 94 55 89M88 91Q107 98 118 78" fill="none" stroke="#73994C" stroke-width="6"/><g fill="#605A4A" stroke-width="1.6"><ellipse cx="39" cy="56" rx="4" ry="6"/><ellipse cx="75" cy="39" rx="4" ry="6"/><ellipse cx="99" cy="64" rx="4" ry="6"/><ellipse cx="62" cy="82" rx="4" ry="6"/><ellipse cx="83" cy="71" rx="4" ry="6"/></g><path d="M46 155L49 173" fill="none" stroke="#F4C381" stroke-width="3"/></g></svg>`);
function seg(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)}
const pd=(x,y)=>Math.min(...world.paths.map((l,i)=>Math.min(...l.slice(1).map((b,j)=>seg(x,y,l[j],b)))-world.pathWidths[i]/2));
const sleepers=[];for(const [pose,list]of Object.entries(world.sleepSpots))for(const s of list){if(pose==='nod'){let t=art.props.find(p=>p.id===s[0]);sleepers.push([t.x+s[1],t.y+14])}else sleepers.push(s)}
const geo=geometry(walk),safe=(x,y,clear=65)=>geo.walkable(x,y)&&!walk.obstacles.some(o=>inShape(x,y,o,55))&&pd(x,y)>clear&&!zones.some(([,z])=>inShape(x,y,z))&&!art.props.some(p=>Math.hypot(p.x-x,(p.y-y)*1.2)<(p.id.startsWith('close-')?190:clear+Math.min(75,p.width*p.scale*.25)))&&!sleepers.some(s=>Math.hypot(s[0]-x,s[1]-y)<210)&&!Object.values(world.zones).some(z=>Math.hypot(z.spawn[0]-x,z.spawn[1]-y)<130);
let added=0;
const lamp=art.props.find(p=>p.id==='cloister-lamp-1');
function prop(kind,x,y,id){const p=kind==='olive'?{name:'Potted olive tree',src:'detail/olive-pot.svg',width:140,height:193,scale:.85,anchor:{x:.5,y:.94}}:{...lamp,name:'Courtyard lantern',scale:1};if(kind==='olive'&&art.props.some(q=>/tree/i.test(q.name)&&crowns({...p,x,y},q)))return;art.props.push({...p,id:'close-'+id,x:f(x),y:f(y),wind:false});walk.obstacles.push({name:'close-'+id,x:f(x),y:f(y),rx:kind==='olive'?32:16,ry:kind==='olive'?22:12});added++;}
for(const [index,[name,z]]of zones.entries()){
 let count=0;for(const offset of [95,130,170])for(let i=0;i<64&&count<6;i++){const a=((i%4)*90+Math.floor(i/4)*5.625+11.25)*Math.PI/180,x=z.x+Math.cos(a)*(z.rx+offset),y=z.y+Math.sin(a)*(z.ry+offset*.77);if(safe(x,y,32)){prop(count%2?'olive':'lamp',x,y,`${name}-${count}`);count++}}
 for(const deg of [-140,-40,40,140]){
  const rad=deg*Math.PI/180,x=z.x+Math.cos(rad)*(z.rx+80),y=z.y+Math.sin(rad)*(z.rx+80)*z.ry/z.rx;
  if(!safe(x,y,105))continue;
  const arc=addArc(z,deg,`close-rim-${index}-${deg}`,art.props,walk.obstacles,{span:name.startsWith('stalls')?16:23,offset:80});
  const ob=walk.obstacles.at(-1);if(ob.poly.some(p=>pd(...p)<20||zones.some(([,q])=>inShape(...p,q)))){art.props.pop();walk.obstacles.pop();continue}arcs.push(arc);
 }
}
for(let i=0;i<24;i++){const a=(i*15+7.5)*Math.PI/180,x=4100+Math.cos(a)*1170,y=2680+Math.sin(a)*900;if(safe(x,y,85))prop(i%3?'olive':'lamp',x,y,'piazza-'+i)}
let detailCount=0;const tiny=['grass-tuft-1','grass-tuft-2','pebble-1','flower-dot-1','flower-dot-2'];
for(const [idx,[name,z]]of zones.entries())for(let i=0;i<70;i++){
 const a=i*2*Math.PI/70,r=1.03+(i%3)*.025,x=z.x+Math.cos(a)*z.rx*r,y=z.y+Math.sin(a)*z.ry*r;if(pd(x,y)<12||!geo.walkable(x,y)||zones.some(([,q])=>inShape(x,y,q)))continue;
 const id=tiny[(i+idx)%tiny.length],size=20+(i%5)*3;finishing+=`<use href="#${id}" x="${f(x-size/2)}" y="${f(y-9)}" width="${size}" height="${f(size*.68)}"/>`;detailCount++;
}
for(const [pi,path]of world.paths.entries())for(let i=2;i<path.length-2;i+=2){const [x,y]=path[i],a=path[i-1],b=path[i+1],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);for(const side of [-1,1]){const d=world.pathWidths[pi]/2+24+(i%3)*9,px=x-dy/len*d*side,py=y+dx/len*d*side;if(pd(px,py)<14||!geo.walkable(px,py)||zones.some(([,q])=>inShape(px,py,{...q,rx:q.rx+20,ry:q.ry+20}))||inShape(px,py,world.zones.plaza))continue;const size=24+i%5*3,id=tiny[(pi+i+(side===1?2:0))%tiny.length];finishing+=`<use href="#${id}" x="${f(px-size/2)}" y="${f(py-10)}" width="${size}" height="${f(size*.68)}"/>`;detailCount++}}
ground=ground.replace('</svg>',`<g id="cathedral-closeup-finish">${finishing}</g></svg>`);
writeFileSync(ROOT+'ground.svg',ground);
for(const t of art.ground.tiles){let svg=ground.replace('width="8000" height="6000" viewBox="0 0 8000 6000"',`width="${t.width}" height="${t.height}" viewBox="${t.x} ${t.y} ${t.width} ${t.height}"`);writeFileSync(ROOT+t.src,svg)}
const tree=art.props.find(p=>p.id==='olive-14'),trees=art.props.filter(p=>/tree/i.test(p.name)&&p!==tree);
function crowns(p,q){const ph=p.height*p.scale,qh=q.height*q.scale;return((p.x-q.x)/(.43*(p.width*p.scale+q.width*q.scale)))**2+((p.y-ph*.61-(q.y-qh*.61))/(.28*(ph+qh)))**2<1}
if(pd(tree.x,tree.y)<50){let moved=false;for(let r=40;r<=700&&!moved;r+=20)for(let d=0;d<360&&!moved;d+=12){const a=d*Math.PI/180,x=tree.x+Math.cos(a)*r,y=tree.y+Math.sin(a)*r,p={...tree,x,y};if(pd(x,y)<70||!safe(x,y,48)||trees.some(q=>crowns(p,q)))continue;const old=walk.obstacles.find(o=>o.x&&Math.hypot(o.x-tree.x,o.y-(tree.y-30))<70);if(old){old.x+=x-tree.x;old.y+=y-tree.y}else walk.obstacles.push({name:'olive-14-trunk',x:f(x),y:f(y-20),rx:38,ry:25});tree.x=f(x);tree.y=f(y);moved=true;console.log('Relocated path-side olive',tree.x,tree.y)}if(!moved)throw Error('No clear olive placement')}
world.props=art.props;world.obstacles=walk.obstacles;
for(const [file,data]of [[ROOT+'art.json',art],[DATA+'world.json',world],[DATA+'walk-world.json',walk],[ROOT+'arc-benches.json',arcs]])writeFileSync(file,JSON.stringify(data,null,2)+'\n');
console.log({props:art.props.length,addedRimProps:added,arcBenches:arcs.length,addedGroundDetails:detailCount});
