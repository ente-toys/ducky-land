// Run after either Fair builder's regeneration: node scripts/bigger-fair/hamlets-apply.mjs.
// Idempotent. Only the four outer communities change; centre, coast and water stay intact.
import fs from 'node:fs';
import {A,S,D,read,config,layouts,objects,grounds,mapper,HOME,r} from './hamlets.mjs';
import {outer,streams,pathD} from './fix-geometry.mjs';
import {smooth} from './design.mjs';
import {inShape} from '../../rive/web/island-geometry.mjs';
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
  const p={id:`hamlet-${h}-${o.id}`,name:o.file.replace('.svg',''),src:`hamlets/${h}/${o.file}`,x:o.x,y:o.y,width:o.width,height:o.height,scale:1,anchor:{x:.5,y:1},resolution:1.5,community:h,order:o.drawOrder,footprints:[]};
  if(o.building){p.role=HOME.test(o.file)?'home':'workplace';p.shadowSize=[r(f.rx*1.05),r(Math.min(60,f.rx*.3))];p.door=[o.x,r(o.y+85)];homes.push({community:h,x:o.x,y:o.y,door:p.door,variant:o.id,dimensions:[o.width,o.height],role:p.role});}
  if(o.decal){p.shadow=false;p.asset='grass-decal';p.z=r(o.y-4000);}else p.z=o.y;
  if(f){p.footprint=f;p.footprints=[f];walk.obstacles.push({...f,name:p.id});}
  if(/^(tree-|bush-|flower)/.test(o.file))p.wind=true;
  // Blueprint draw order wins only for overlapping standing drawings.
  for(const q of placed)if(!o.decal&&q.z>=p.z&&q.asset!=='grass-decal'&&Math.abs(p.x-q.x)<(p.width+q.width)/2&&p.y>q.y-q.height&&q.y>p.y-p.height)p.z=r(q.z+.5);
  placed.push(p);
 }
 art.props.push(...placed);world.props.push(...placed.map(p=>({id:p.id,name:p.name,x:p.x,y:p.y,zone:h})));
 const W=mapper(h);
 c.sleepers.forEach((s,i)=>{const p=layouts[h].sleepers[i],q=W([p.x,p.y]).map((v,j)=>r(v+(s.nudge?.[j]??0)));world.sleepSpots[s.pose][s.index]=[...q,Boolean(s.flip)];});
 const point=W(c.place??[768,650]);world.zones[h]={...world.zones[h],x:point[0],y:point[1],spawn:point};
 report[h]={placed:placed.length,homes:placed.filter(p=>p.role==='home').length,workplaces:placed.filter(p=>p.role==='workplace').length,dropped};
}
// A lawn patch removes obsolete pads/fences/lanes. It is clipped to grass on
// the outer bank, so neither builder can paint over the other's moat or centre.
const clears=`<path d="${pathD(world.coast)}"/>`;
const excluded=`<path d="${pathD(outer)}" fill="black" stroke="black" stroke-width="12"/>`+world.water.map(w=>w.poly?`<path d="${pathD(w.poly)}" fill="black"/>`:`<ellipse cx="${w.x}" cy="${w.y}" rx="${w.rx}" ry="${w.ry}" fill="black"/>`).join('');
const defs=`<defs><mask id="fair-hamlet-dry" maskUnits="userSpaceOnUse" x="-2500" y="-1800" width="12000" height="8200"><path d="${pathD(world.coast)}" fill="white" stroke="black" stroke-width="340"/>${excluded}</mask><clipPath id="fair-hamlet-clear">${clears}</clipPath><pattern id="fair-hamlet-grain" width="177" height="139" patternUnits="userSpaceOnUse"><path d="M17 29l4 -7 5 8 M105 101l4 -8 5 7 M149 49l3 -6 5 7" fill="none" stroke="#729F39" stroke-width="2.6" opacity=".5"/><ellipse cx="67" cy="51" rx="10" ry="3" fill="#C3DE65" opacity=".7"/></pattern></defs>`;
const poly=Object.keys(config).flatMap(grounds).map(g=>`<path d="${pathD(g)}"/>`).join('');
// Preserve radial connections and the main road outside the replacement lawn.
// Across each hamlet the loop takes the open square and avoids house bases.
// The coast loop takes open ground around the blueprint buildings. The
// eight existing radial approaches still land on exactly the same bridges.
const loop=[[-1500,780],[-1000,0],[0,-500],[1800,-650],[2700,-850],[4100,-950],[5900,-850],[7300,-450],[8100,200],[8400,1000],[8500,1700],[8500,2200],[8570,3000],[8580,3500],[8520,3940],[8450,4140],[8170,4400],[7480,5300],[5800,5500],[4200,5500],[3700,5730],[2450,5700],[1000,5410],[-530,5190],[-1400,4300],[-1550,3340],[-1800,2720],[-1800,1800],[-1780,950],[-1500,780]];
const roads=[{line:[...smooth(loop.slice(0,-1),true,8),loop[0]],w:150},...read(S+'hamlets/approaches.json'),...Object.values(config).flatMap(c=>(c.roads??[c.join]).map(line=>({line,w:110})))].filter(Boolean).map(q=>({...q,line:q.line.length<40?smooth(q.line,false,8):q.line}));
const route=roads.map(q=>`<path d="M${q.line.map(p=>p.join(' ')).join('L')}" stroke-width="${q.w}"/>`).join('');
const road=`<g fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="#648C37">${route.replaceAll(/stroke-width="([0-9.]+)"/g,(_,v)=>`stroke-width="${+v+26}"`)}</g><g stroke="#9D9856">${route.replaceAll(/stroke-width="([0-9.]+)"/g,(_,v)=>`stroke-width="${+v+10}"`)}</g><g stroke="#F3DF98">${route}</g></g>`;
const overlay=`<g id="fair-hamlet-overlay">${defs}<g mask="url(#fair-hamlet-dry)"><g clip-path="url(#fair-hamlet-clear)"><g fill="#9CC63E">${clears}</g><g fill="url(#fair-hamlet-grain)">${clears}</g>${road}</g><g stroke-linejoin="round"><g fill="#F3DF98" stroke="#648C37" stroke-width="24">${poly}</g><g fill="#F3DF98" stroke="#9D9856" stroke-width="10">${poly}</g><g fill="#F6DE95">${poly}</g></g>${road}</g></g>`;
// Remove obsolete household lawn pads and crop beds even where the old
// drawing incorrectly extended onto beach sand outside the new grass mask.
const oldPaths=new Set(),oldEllipses=new Set();
for(const h of read(S+'hamlets/retired-homes.json')){
 oldPaths.add(`M${h.x-300} ${h.y-110}Q${h.x-320} ${h.y-280} ${h.x} ${h.y-270}T${h.x+310} ${h.y-80}Q${h.x+300} ${h.y+160} ${h.x} ${h.y+150}T${h.x-300} ${h.y-110}Z`);
 for(const [dx,dy]of [[0,19],[2,59],[7,98]])oldEllipses.add([h.x+dx,h.y+dy,30,12].join(','));
}
for(const [x,y,rx,ry]of [[-1670,2400,160,150],[-1270,2410,150,130],[2370,-620,210,80],[2790,-520,160,80],[8060,4570,160,140],[8420,4580,145,130],[4800,5010,220,110],[5280,5060,190,120]]){
 oldPaths.add(`M${x-rx} ${y-ry}q${rx} -18 ${rx*2} 0v${ry*2}q-${rx} 18 -${rx*2} 0Z`);
 for(const row of [-.55,0,.55])for(const col of [-.6,0,.6]){const xx=x+rx*col,yy=y+ry*row;oldPaths.add(`M${xx} ${yy+14}v-29m0 16l-17 -10m17 4l15 -12`);oldEllipses.add([xx,yy-17,9,7].join(','));}
}
for(const t of art.ground.tiles){const f=A+t.src;let svg=fs.readFileSync(f,'utf8').replace(/<path\b[^>]*\/>/g,tag=>oldPaths.has(tag.match(/ d="([^"]+)"/)?.[1])?'':tag).replace(/<ellipse\b[^>]*\/>/g,tag=>oldEllipses.has(['cx','cy','rx','ry'].map(k=>tag.match(new RegExp(k+'="([^"]+)"'))?.[1]).join(','))?'':tag);const at=svg.indexOf('<g id="fair-hamlet-overlay">');if(at>=0)svg=svg.slice(0,at)+'</svg>';fs.writeFileSync(f,svg.replace(/<\/svg>\s*$/,overlay+'</svg>'));}
const oldIDs=new Set(exp.newProps.filter(p=>Object.hasOwn(config,p.community)).map(p=>p.id));
exp.newProps=exp.newProps.filter(p=>!oldIDs.has(p.id)&&!ids.has(p.id)&&!p.id?.startsWith('hamlet-'));exp.newProps.push(...art.props.filter(p=>p.id?.startsWith('hamlet-')));exp.hamlets=report;
exp.homes=homes.filter(p=>p.role==='home');exp.places=exp.places.map(p=>config[p.id]?{...p,x:world.zones[p.id].x,y:world.zones[p.id].y,point:world.zones[p.id].spawn,hamlet:true}:p);
const communities=read(S+'communities.json');communities.homes=exp.homes;communities.communities=communities.communities.map(p=>config[p.id]?{...p,homes:report[p.id].homes,work:p.id==='waddleshow'?'Teacup-float workshop and rehearsal yard':p.work,hamlet:report[p.id]}:p);
// Keep the AC-2 heart routes and replace only the outer road graph.
const heart=read(S+'original-world.json').coast;
const paths=[...new Map([...roads.map(p=>p.line),...(world.paths??[]).filter(line=>line.some(([x,y])=>inPoly(x,y,heart)))].map(line=>[JSON.stringify(line),line])).values()];
world.paths=paths;
exp.paths=roads;save(D+'paths.json',paths);save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);save(D+'placements.json',art.props);save(S+'expansion.json',exp);save(S+'communities.json',communities);save(S+'hamlets-report.json',report);console.log(report);
