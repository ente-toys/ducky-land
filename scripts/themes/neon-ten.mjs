import fs from 'node:fs';
import {drawArcBench} from '../arc-bench-draw.mjs';
import {geometry,inPoly} from '../../assets/world/island-geometry.mjs';
const A='public/pixi-art/themes/neon/',D='assets/world/themes/neon/',B=A+'ten-source/';
fs.mkdirSync(B,{recursive:true});
for(const [name,path]of Object.entries({art:A+'art.json',world:D+'world.json',walk:D+'walk-world.json',placements:D+'placements.json',paths:D+'paths.json'}))if(!fs.existsSync(B+name+'.json'))fs.copyFileSync(path,B+name+'.json');
if(!fs.existsSync(B+'ground.svg'))fs.copyFileSync(A+'ground.svg',B+'ground.svg');
const read=n=>JSON.parse(fs.readFileSync(B+n+'.json','utf8')),save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,1)+'\n');
const art=read('art'),world=read('world'),walk=read('walk'),paths=read('paths'),beds=JSON.parse(fs.readFileSync(A+'resolved-sleepers.json'));
let ground=fs.readFileSync(B+'ground.svg','utf8');
const r=n=>Math.round(n*10)/10, d=p=>'M'+p.map(q=>q.map(r).join(' ')).join(' L');
const seg=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t)};
const pathDist=(x,y)=>Math.min(...paths.map(l=>Math.min(...l.slice(1).map((b,i)=>seg(x,y,l[i],b)))));
const reserved=(x,y,pad=0)=>Object.entries(world.zones).some(([id,z])=>/^(activity|stalls)-/.test(id)&&(z.poly?inPoly(x,y,z.poly):((x-z.x)/(z.rx+pad))**2+((y-z.y)/(z.ry+pad))**2<1));
const bare=geometry({...walk,obstacles:[]});
for(const [i,amp,axis]of [[4,75,0],[6,-65,1]]){
 const old=paths[i],fresh=old.map((p,j)=>{const q=[...p],t=j/(old.length-1);q[axis]=r(q[axis]+amp*Math.sin(2*Math.PI*t)**3);return q});
 ground=ground.split(d(old)).join(d(fresh));paths[i]=fresh;
}
ground=ground.replace(/stroke="#718B2C" stroke-width="(216|196)"/g,(_,w)=>`stroke="#718B2C" stroke-width="${+w-8}"`)
 .replace(/stroke="#B89A55" stroke-width="(208|188)"/g,(_,w)=>`stroke="#6F7338" stroke-width="${+w-4}"`)
 .replace(/stroke="#FDE48C" stroke-width="(200|180)"/g,'stroke="#FFF0B3" stroke-width="$1"');
ground=ground.replace(/<path d="M2947\.1 3494\.1[^>]+\/>/,'').replace(/<path d="M2947\.5 3502\.1[^>]+\/>/,'');
ground=ground.replace(/<path[^>]*clip-path="url\(#lawn[01]\)"[^>]*\/>/g,'')
 .replace(/<ellipse[^>]*fill="#(?:FFE08A|FFB6CF)"[^>]*\/>/g,'');
const rings=[{id:'clock',...world.zones.centre,s:754,k:world.zones.centre.ry/world.zones.centre.rx,angles:[-110,-70,68,112],span:17},
 ...[1,2,3,4].map(i=>{const z=world.zones['activity-'+i];return{id:'lawn-'+i,...z,s:z.rx+38,k:z.ry/z.rx,angles:i===1?[-95,60]:i===2?[-90,-25]:i===3?[-75,160]:[-40,120],span:27}}),
 ...world.islets.map(([x,y],i)=>({id:'islet-'+i,x,y:y+25.2,rx:235,ry:88.2,s:202,k:88.2/235,angles:[48],span:38}))];
const removedIds=new Set(['neon-49','neon-50','neon-51','neon-52','neon-70','neon-75','neon-polish-65','neon-polish-72']);
function removeProp(p){
 const candidates=walk.obstacles.map((o,i)=>({o,i,dist:o.poly?Infinity:Math.hypot(o.x-p.x,o.y-p.y)})).sort((a,b)=>a.dist-b.dist);
 if(candidates[0]?.dist<80)walk.obstacles.splice(candidates[0].i,1);
}
for(const p of art.props.filter(p=>removedIds.has(p.id)))removeProp(p);
art.props=art.props.filter(p=>!removedIds.has(p.id));
const benchRecords=[];
for(const ring of rings)for(const desired of ring.angles){
 let deg=desired;
 if(ring.id.startsWith('lawn')){
  const candidates=Array.from({length:72},(_,i)=>i%2?-(i+1)/2*5:i/2*5);
  const free=angle=>{
   for(const delta of [-ring.span/2,0,ring.span/2]){
    const a=(angle+delta)*Math.PI/180,x=ring.x+Math.cos(a)*(ring.s+20),y=ring.y+Math.sin(a)*(ring.s+20)*ring.k;
    if(!bare.walkable(x,y)||reserved(x,y)||pathDist(x,y)<125)return false;
    if(beds.some(b=>Math.hypot(x-b.x,(y-b.y)*1.5)<b.r+105))return false;
    if(art.props.some(p=>!p.src.startsWith('centre/')&&!/flower|bush/.test(p.src)&&Math.hypot(x-p.x,(y-p.y)*1.6)<Math.min(p.width*p.scale*.32,140)+25))return false;
   }
   return true;
  };
  const chosen=candidates.map(o=>desired+o).find(free);
  if(chosen===undefined)throw Error('No clear bench arc: '+ring.id+' '+desired);
  deg=chosen;
 }
 const b={deg,span:ring.span},sIn=ring.s,sOut=sIn+40,back=sOut+4,seat=17,top=47;
 const g=(a,s)=>[ring.x+Math.cos(a*Math.PI/180)*s,ring.y+Math.sin(a*Math.PI/180)*s*ring.k];
 const points=s=>Array.from({length:25},(_,i)=>g(deg-b.span/2+b.span*i/24,s));
 const footprint=[...points(sIn-4),...points(back+4).reverse()].map(p=>p.map(r));
 const anchor=g(deg,(sIn+sOut)/2),xs=footprint.map(p=>p[0]),ys=footprint.map(p=>p[1]);
 const box={x:Math.floor(Math.min(...xs))-5,y:Math.floor(Math.min(...ys))-top-5,w:Math.ceil(Math.max(...xs)-Math.min(...xs))+10,h:Math.ceil(Math.max(...ys)-Math.min(...ys))+top+10};
 const src=`bench-${ring.id}-${deg<0?'m'+-deg:deg}.svg`;
 const body=drawArcBench(b,{ground:g,sIn,sOut,back,seat,top,ink:'#39472D',line:2.2,thin:1.5,spindleDeg:3.2*446/back});
 fs.writeFileSync(A+src,`<svg xmlns="http://www.w3.org/2000/svg" width="${box.w}" height="${box.h}" viewBox="${box.x} ${box.y} ${box.w} ${box.h}"><title>Tickytown ${ring.id} curved bench, radius ${sIn}, inward facing</title><g stroke-linecap="round" stroke-linejoin="round">${body.join('')}</g></svg>`);
 const p={id:'neon-ten-'+src.slice(0,-4),name:'Curved timber bench',src,x:r(anchor[0]),y:r(anchor[1]),width:box.w,height:box.h,scale:1,anchor:{x:(r(anchor[0])-box.x)/box.w,y:(r(anchor[1])-box.y)/box.h},shadow:false,wind:false,flip:false};
 art.props.push(p);walk.obstacles.push({poly:footprint,neonTen:true});benchRecords.push({...p,ring:ring.id,deg,radius:sIn,footprint});
}
let seed=5266;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
const sample=src=>art.props.find(p=>p.src===src);
let added=0;
function small(src,x,y,mult=1){
 const t=sample(src);if(!t||!bare.walkable(x,y)||pathDist(x,y)<135||reserved(x,y,40)||beds.some(b=>Math.hypot(b.x-x,(b.y-y)*1.7)<b.r+65))return false;
 const w=t.width*t.scale*mult;
 if(art.props.some(p=>Math.hypot(p.x-x,(p.y-y)*1.5)<Math.min(135,p.width*p.scale*.4)+Math.min(w*.4,65)+10))return false;
 const p={...t,id:'neon-ten-garden-'+added++,x:r(x),y:r(y),scale:t.scale*mult};
 art.props.push(p);
 if(!/flower/.test(src))walk.obstacles.push({x:p.x,y:p.y-8,rx:r(Math.min(48,w*.35)),ry:18,neonTen:true});
 return true;
}
for(const [cx,cy]of [[3230,3560],[4490,3560],[3280,4030],[4520,4030]])for(let j=0;j<13;j++){
 const a=j*2.4,dd=35+Math.sqrt(j)*52;
 small(j%4===0?'reuse/nature--rock-round.svg':j%3===0?'reuse/flower-2.svg':`reuse/bush-${1+j%6}.svg`,cx+Math.cos(a)*dd,cy+Math.sin(a)*dd*.45,.65);
}
const bigTree=p=>/^reuse\/tree-[1-5]\.svg$/.test(p.src);
const crown=p=>({x:p.x,y:p.y-p.height*p.scale*.64,rx:p.width*p.scale*.45,ry:p.height*p.scale*.29});
const crownsTouch=(p,q)=>{const a=crown(p),b=crown(q);return ((a.x-b.x)/(a.rx+b.rx+16))**2+((a.y-b.y)/(a.ry+b.ry+12))**2<1};
const fixedTrees=art.props.filter(p=>bigTree(p)&&!p.id.startsWith('neon-polish-'));
const movedTrees=[];
for(const t of art.props.filter(p=>bigTree(p)&&p.id.startsWith('neon-polish-'))){
 if(!fixedTrees.some(q=>crownsTouch(t,q))){fixedTrees.push(t);continue;}
 const original=[t.x,t.y];let found=false;
 const obstacle=walk.obstacles.filter(o=>!o.poly).sort((a,b)=>Math.hypot(a.x-t.x,a.y-t.y)-Math.hypot(b.x-t.x,b.y-t.y))[0];
 for(let i=0;i<2400&&!found;i++){
  const angle=i*2.399963,rad=80+Math.sqrt(i)*20,x=r(original[0]+Math.cos(angle)*rad),y=r(original[1]+Math.sin(angle)*rad*.7),p={...t,x,y};
  if(!bare.walkable(x,y)||!bare.walkable(x,y-40)||pathDist(x,y)<165||reserved(x,y,65))continue;
  if(!inPoly(x,y,world.coast)||Math.min(...world.coast.map((a,i)=>seg(x,y,a,world.coast[(i+1)%world.coast.length])))<155)continue;
  if(world.walkways.some(b=>seg(x,y,b.a,b.b)<b.w/2+160))continue;
  const c=world.zones.centre;if(((x-c.x)/(c.rx+180))**2+((y-c.y)/(c.ry+160))**2<1)continue;
  if(beds.some(b=>Math.hypot(x-b.x,(y-b.y)*1.6)<p.width*p.scale*.4+b.r+30 || (y>b.y-30 && y-b.y<p.height*p.scale && Math.abs(x-b.x)<p.width*p.scale*.5+b.r*.6+20)))continue;
  if(fixedTrees.some(q=>crownsTouch(p,q)))continue;
  if(art.props.some(q=>!bigTree(q)&&!q.src.startsWith('centre/')&&(/shop|kiosk/.test(q.src)?Math.abs(x-q.x)<(p.width*p.scale+q.width*q.scale)*.48&&Math.abs(y-q.y)<240:Math.hypot(x-q.x,(y-q.y)*1.6)<110)))continue;
  const dx=x-t.x,dy=y-t.y;t.x=x;t.y=y;if(obstacle&&Math.hypot(obstacle.x-original[0],obstacle.y-original[1])<40){obstacle.x=r(obstacle.x+dx);obstacle.y=r(obstacle.y+dy);}
  movedTrees.push({id:t.id,from:original,to:[x,y]});found=true;
 }
 fixedTrees.push(t);
}

const trees=art.props.filter(p=>/^reuse\/tree-[1-5]\.svg$/.test(p.src));
for(const [i,t]of trees.entries())for(const side of [-1,1])small(i%4===0?'reuse/nature--rock-round.svg':`reuse/bush-${1+i%6}.svg`,t.x+side*(t.width*t.scale*.43+25),t.y+23,.6);
let tufts=0;
for(let i=0;i<650;i++){
 const x=2850+rnd()*2200,y=3440+rnd()*810;
 if(!bare.walkable(x,y)||pathDist(x,y)<112||world.water.some(q=>q.poly?inPoly(x,y,q.poly):((x-q.x)/(q.rx+25))**2+((y-q.y)/(q.ry+25))**2<1))continue;
 const t=art.flats.find(p=>p.src==='reuse/'+(tufts%4?'grass-tuft-1':'flower-dot-2')+'.svg');
 art.flats.push({...t,x:r(x),y:r(y),flip:rnd()<.5});tufts++;
}
for(const [id,z]of Object.entries(world.zones).filter(([id])=>id.startsWith('stalls'))){
 const l=z.line;
 for(let i=1;i<l.length-1;i+=2){
  const p=l[i],a=l[i-1],b=l[i+1],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
  for(const sign of [-1,1]){const x=p[0]-dy/len*sign*130,y=p[1]+dx/len*sign*130;
   small('reuse/flower-'+(1+i%3)+'.svg',x,y,.7);
  }
 }
}
art.flats=art.flats.filter(p=>p.src.startsWith('centre/')||!/(grass|flower-dot|pebble)/.test(p.src)||pathDist(p.x,p.y)>112);
world.paths=paths;walk.paths=paths;world.obstacles=walk.obstacles;world.props=art.props;
fs.writeFileSync(A+'ground.svg',ground);
for(const t of art.ground.tiles)fs.writeFileSync(A+t.src,ground.replace(/width="[^"]+" height="[^"]+" viewBox="[^"]+"/,`width="${t.width}" height="${t.height}" viewBox="${t.x} ${t.y} ${t.width} ${t.height}"`));
save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);save(D+'paths.json',paths);save(D+'placements.json',art.props);
save(A+'ten-benches.json',benchRecords);save(A+'ten-metrics.json',{movedTrees,curvedBenches:benchRecords.length,props:art.props.length,gardenAdditions:added,canalTufts:tufts,groundDecals:art.flats.length,trees:trees.length,pathsWidth:{main:200,minor:180}});
console.log({curvedBenches:benchRecords.length,gardenAdditions:added,canalTufts:tufts});
