// Run after either Fair builder's regeneration: node scripts/bigger-fair/hamlets-apply.mjs.
// Idempotent. Only the four outer communities change; centre, coast and water stay intact.
import fs from 'node:fs';
import {fitContact} from './furniture.mjs';
import {A,S,D,read,config,layouts,objects,grounds,mapper,HOME,r} from './hamlets.mjs';
import {outer,streams,pathD} from './fix-geometry.mjs';
import {smooth} from './design.mjs';
import {inShape} from '../../assets/world/island-geometry.mjs';
const save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,1)+'\n');
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),exp=read(S+'expansion.json');
const inPoly=(x,y,poly)=>inShape(x,y,{poly});
const dist=(x,y,poly)=>Math.min(...poly.map((a,i)=>{const b=poly[(i+1)%poly.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);}));
export const dry=(x,y)=>inPoly(x,y,world.coast)&&dist(x,y,world.coast)>=240&&!inPoly(x,y,outer)&&dist(x,y,outer)>=80&&!world.water.some(w=>inShape(x,y,w))&&streams.every(s=>!inPoly(x,y,s.poly)&&dist(x,y,s.poly)>=80);
const clear=p=>Object.values(config).some(c=>inPoly(p.x,p.y,c.clear));
const gone=art.props.filter(p=>Object.hasOwn(config,p.community)||p.id?.startsWith('hamlet-')||(!p.id?.startsWith('fair-')&&clear(p))||p.community==='commons'&&clear(p));
const ids=new Set(gone.map(p=>p.id)),signature=f=>[f.x,f.y,f.rx,f.ry].join(',');
const retired=read(S+'hamlets/retired-obstacles.json').flatMap(p=>p.footprints);
const walls=new Set([...retired,...gone.flatMap(p=>p.footprints??(p.footprint?[p.footprint]:[]))].map(signature));
art.props=art.props.filter(p=>!ids.has(p.id));walk.obstacles=walk.obstacles.filter(f=>!walls.has(signature(f)));
world.props=world.props.filter(p=>!ids.has(p.id));
const report={},homes=[];
for(const [h,c]of Object.entries(config)){
 const placed=[],dropped=[];
 for(const o of objects(h)){
  if((c.drop??[]).includes(o.id)){dropped.push(o.id+': authored exclusion');continue;}
  const f=o.fp,sites=f?[[f.x-f.rx*.8,f.y],[f.x,f.y-f.ry],[f.x+f.rx*.8,f.y],[f.x,f.y+f.ry]]:[[o.x,o.y]];
  if(!sites.every(p=>dry(...p))){if(o.building)throw Error(`${h}/${o.id}: building base lacks dry grass + 80-unit margin at ${o.x},${o.y}`);dropped.push(o.id+': coast/moat grass margin');continue;}
  const p={id:`hamlet-${h}-${o.id}`,name:o.file.replace('.svg',''),src:o.src??`hamlets/${h}/${o.file}`,x:o.x,y:o.y,width:o.width,height:o.height,scale:1,anchor:{x:.5,y:1},resolution:1.5,community:h,order:o.drawOrder,footprints:[]};
  if(o.building){p.role=HOME.test(o.file)?'home':'workplace';p.shadowSize=[r(f.rx*1.05),r(Math.min(60,f.rx*.3))];p.door=[o.x,r(o.y+85)];homes.push({community:h,x:o.x,y:o.y,door:p.door,variant:o.id,dimensions:[o.width,o.height],role:p.role});}
  if(o.decal){p.shadow=false;p.asset='grass-decal';p.z=r(o.y-4000);}else p.z=o.y;
  if(f){p.footprint=f;p.footprints=[f];walk.obstacles.push({...f,name:p.id});}
  if(/^(tree-|bush-|flower)/.test(o.file))p.wind=true;
  // Blueprint draw order wins only for overlapping standing drawings.
  for(const q of placed)if(!o.decal&&q.z>=p.z&&q.asset!=='grass-decal'&&Math.abs(p.x-q.x)<(p.width+q.width)/2&&p.y>q.y-q.height&&q.y>p.y-p.height)p.z=r(q.z+.5);
  placed.push(fitContact(p));
 }
 art.props.push(...placed);world.props.push(...placed.map(p=>({id:p.id,name:p.name,x:p.x,y:p.y,zone:h})));
 const W=mapper(h);
 c.sleepers.forEach((s,i)=>{const p=layouts[h].sleepers[i],q=W([p.x,p.y]).map((v,j)=>r(v+(s.nudge?.[j]??0)));world.sleepSpots[s.pose][s.index]=[...q,Boolean(s.flip)];});
 const point=W(c.place??[768,650]);world.zones[h]={...world.zones[h],x:point[0],y:point[1],spawn:point};
 report[h]={placed:placed.length,homes:placed.filter(p=>p.role==='home').length,workplaces:placed.filter(p=>p.role==='workplace').length,dropped};
}
const oldIDs=new Set(exp.newProps.filter(p=>Object.hasOwn(config,p.community)).map(p=>p.id));
exp.newProps=exp.newProps.filter(p=>!oldIDs.has(p.id)&&!ids.has(p.id)&&!p.id?.startsWith('hamlet-'));exp.newProps.push(...art.props.filter(p=>p.id?.startsWith('hamlet-')));exp.hamlets=report;
exp.homes=homes.filter(p=>p.role==='home');exp.places=exp.places.map(p=>config[p.id]?{...p,x:world.zones[p.id].x,y:world.zones[p.id].y,point:world.zones[p.id].spawn,hamlet:true}:p);
const communities=read(S+'communities.json');communities.homes=exp.homes;communities.communities=communities.communities.map(p=>config[p.id]?{...p,homes:report[p.id].homes,work:p.id==='waddleshow'?'Teacup-float workshop and rehearsal yard':p.work,hamlet:report[p.id]}:p);
save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);save(D+'placements.json',art.props);save(S+'expansion.json',exp);save(S+'communities.json',communities);save(S+'hamlets-report.json',report);console.log(report);

// Routes and ground have one owner, after all fixed scene feet are available.
const {rebuildFairSurface}=await import('./paths.mjs');
rebuildFairSurface();
