// Boss walk-through corrections. Places remain authored compositions, not scatter.
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {bounds,overlaps,propPathClearance,footprint} from './place.mjs';
import {inPoly} from '../../rive/web/island-geometry.mjs';
const base='public/pixi-art/themes/snow';
const round=n=>Math.round(n*100)/100;
export const isCanopy=p=>p.finalKind==='tree'||p.finalKind==='shrub'||/^(pine-|shrub-)/.test(p.finalRole??'');
export const isSoftPatch=p=>/patch|shade|clearing|camp-snow|drift/.test(p.finalRole??'');
export function canopyProblems(p,art,w){
 const b=bounds(p),errors=[];
 for(const house of art.props.filter(q=>q.finalKind==='building'||q.buildingSilhouette)){
  const front={...bounds(house),y1:house.y+p.height};
  if(overlaps(b,front,12))errors.push('tree in front of building '+p.id+' / '+house.id);
 }
 for(const clearing of art.flats.filter(q=>q.id==='snowman-clearing'))if(p.scene!=='snowman-scene'&&overlaps(b,bounds(clearing),25))errors.push('canopy hides snowman yard '+p.id);
 if(inPoly(p.x,p.y,w.iceland2.rink.poly))errors.push('canopy planted on lake '+p.id);
 if(propPathClearance(w,p)<12)errors.push('canopy hides path '+p.id);
 return errors;
}
export function fenceEndpoints(p){return p.fenceEndpoints;}
export function fenceProblems(art){
 const fences=art.props.filter(p=>p.finalRole==='fence'),errors=[];
 for(const p of fences){
  const ends=fenceEndpoints(p);
  if(!ends||!p.fenceRun||!p.fencePurpose||!fences.some(q=>q!==p&&q.fenceRun===p.fenceRun&&fenceEndpoints(q)?.some(a=>ends.some(b=>Math.hypot(a[0]-b[0],a[1]-b[1])<.1))))errors.push('isolated fence segment '+p.id);
 }
 return errors;
}
export function softPatchProblems(svg,id='soft patch'){
 const errors=[];
 if(/<(rect|polygon|polyline)\b/i.test(svg))errors.push('straight-edged soft patch '+id);
 for(const m of svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g))if(/[HLVhlvLl]/.test(m[1])||!/[CQAScqas]/.test(m[1]))errors.push('straight-edged soft patch '+id);
 return errors;
}
export function snowmanProblems(art,report){
 const parts=art.props.filter(p=>p.scene==='snowman-scene'),errors=[];
 for(const role of ['snow-cabin','woodshed','scarf-basket','snowball-pile','berry-bush'])if(!parts.some(p=>p.finalRole===role))errors.push('snowman yard missing '+role);
 const stages=parts.filter(p=>p.buildStage);
 if(new Set(stages.map(p=>p.buildStage)).size!==3||Math.max(...stages.map(p=>p.y))-Math.min(...stages.map(p=>p.y))<200)errors.push('snowman yard stiff row');
 for(const seat of report.snowmanSeats??[])if(!parts.some(p=>p.id===seat.bench&&p.occupiedBySleeper&&p.contact===false)||!report.sleepers.some(p=>p.seat===seat.bench&&p.scene==='snowman-scene'))errors.push('snowman yard unseated sleeper '+seat.bench);
 if(report.snowmanSeats?.length!==2)errors.push('snowman yard missing bench sleepers');
 return errors;
}
const raw=(root,src)=>readFileSync(path.join(root,base,src),'utf8');
function add(art,role,id,x,y,width,height,extra={}){
 const p={id,name:id,src:`final/props/${role}.svg`,x,y,width,height,finalKind:'scene',finalRole:role,scene:'snowman-scene',resolution:4,shadow:false,wind:false,fixAllAdded:true,...extra};art.props.push(p);return p;
}
function fence(root,art,w,files,id,run,a,b){
 // The two post centres of the picked B rail are (30,156), (264,156).
 // Shear only the rails along the ground plane; posts remain vertical.
 const k=.49,dx=(b[0]-a[0])/234,dy=(b[1]-a[1])/234;
 const e=a[0]-30*dx,f=a[1]-30*dy-156*k;
 const x0=Math.floor(Math.min(a[0],b[0])-24),y0=Math.floor(Math.min(a[1],b[1])-82),width=Math.ceil(Math.max(a[0],b[0])+24-x0),height=Math.ceil(Math.max(a[1],b[1])+4-y0);
 const src='final/props/fences/'+id+'.svg';
 const source=raw(root,'final/props/yard-fence-segment.svg');
 const rails=[...source.matchAll(/<rect\b[^>]*\/>/g)].map(m=>m[0]).join('');
 const post=source.match(/<path d="M10[^>]*\/>/)[0]+source.match(/<ellipse cx="30"[^>]*\/>/)[0];
 files.set(path.join(base,src),`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x0} ${y0} ${width} ${height}"><g transform="matrix(${dx} ${dy} 0 ${k} ${e} ${f})">${rails}</g>${[a,b].map(([x,y])=>`<g transform="translate(${x-30*k} ${y-156*k}) scale(${k})">${post}</g>`).join('')}</svg>`);
 const p=add(art,'fence',id,x0,y0,width,height,{src,contact:false,anchor:{x:0,y:0},sortY:Math.max(a[1],b[1]),fenceRun:run,fencePurpose:'frame snowman yard with open front gate',fenceEndpoints:[a,b]});
 const length=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=-(b[1]-a[1])/length*8,ny=(b[0]-a[0])/length*8;
 w.obstacles.push({prop:p.id,poly:[[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]]});
 return p;
}
export function composeFixAll(root,art,w,report,catalog,files){
 const retired=new Set(art.props.filter(p=>p.fixAllAdded||p.finalRole==='fence'||p.building&&p.finalRole==='lamp'&&!p.pathLamp||p.scene==='snowman-scene').map(p=>p.id));
 art.props=art.props.filter(p=>!retired.has(p.id));art.flats=art.flats.filter(p=>!p.fixAllAdded);
 w.obstacles=w.obstacles.filter(o=>!retired.has(o.prop));
 // One mailbox at each house's approach. Public buildings retain their path
 // lamp, but no ornamental mailbox or second lamp on either side of a facade.
 for(const p of art.props.filter(p=>p.finalRole==='mailbox'&&p.building)){
  const b=art.props.find(b=>b.id===p.building),lamp=art.props.find(q=>q.building===b.id&&q.pathLamp);
  if(!b.finalRole.startsWith('cottage-')){retired.add(p.id);continue;}
  const candidates=[[-65,0],[65,0],[0,100],[0,-100],[-100,80],[100,80]].map(([dx,dy])=>({...p,x:lamp.x+dx,y:lamp.y+dy}));
  const chosen=candidates.find(q=>propPathClearance(w,q)>=8&&!art.props.some(r=>r!==p&&r!==lamp&&r.finalKind!=='smoke'&&overlaps(bounds(q),bounds(r),8)));
  if(chosen){p.x=chosen.x;p.y=chosen.y;const o=w.obstacles.find(o=>o.prop===p.id);if(o)Object.assign(o,footprint(p,catalog.get('mailbox')));}
 }
 art.props=art.props.filter(p=>!retired.has(p.id));w.obstacles=w.obstacles.filter(o=>!retired.has(o.prop));
 // The warming hut was sharing the cocoa frontage. Give it its own north bank.
 const lakeMoves={'lake-warming-hut':[6710,4695],'lake-mug-table':[6500,4760],'lake-woodpile':[6470,4670],'lake-sled':[6470,4900]};
 for(const [id,[x,y]]of Object.entries(lakeMoves)){const p=art.props.find(p=>p.id===id);if(!p)continue;const dx=x-p.x,dy=y-p.y;p.x=x;p.y=y;if(id==='lake-warming-hut')p.buildingSilhouette=true;for(const o of w.obstacles.filter(o=>o.prop===id)){o.x+=dx;o.y+=dy;}}
 // Pick B: cabin and shed at the back, a low connected perimeter, work in
 // progress at staggered depths, basket and snowballs within reach.
 const scene=report.scenes.find(s=>s.id==='snowman-scene');scene.x=2550;scene.y=7800;
 const parts=[
  add(art,'snow-cabin','snowman-cabin',2400,7510,300,234.12,{buildingSilhouette:true}),
  add(art,'woodshed','snowman-woodshed',2780,7480,175,149.36,{buildingSilhouette:true}),
  add(art,'snowman','snowman-finished',2350,7780,130,126.98,{buildStage:'finished'}),
  add(art,'snowman-small','snowman-unfinished',2240,7670,105,109.63,{buildStage:'stacked'}),
  add(art,'snowball-big','snowman-rolling-ball',2650,8000,110,106.89,{buildStage:'base'}),
  add(art,'scarf-basket','snowman-scarf-basket',2530,7990,115,93.35),
  add(art,'snowball-pile','snowman-snowball-pile',2700,8050,110,83.79),
  add(art,'berry-bush','snowman-berry-bush',2180,7580,100,88.52,{finalKind:'shrub'}),
  add(art,'lamp','snowman-door-lamp',2190,7470,60,146.98),
 ];
 for(const p of parts)w.obstacles.push(footprint(p,{width:p.width,height:p.height}));
 const outline=[[2150,7580],[2070,7750],[2130,7950],[2240,8160],[2390,8170]];
 const right=[[2830,7480],[2990,7590],[3070,7710]];
 const front=[[3070,8210],[2910,8310],[2760,8330]];
 for(const [run,points]of [['snowman-west',outline],['snowman-east',right],['snowman-front',front]])for(let i=1;i<points.length;i++)fence(root,art,w,files,run+'-'+i,run,points[i-1],points[i]);
 // Two benches inside the fence, for the wing sleepers. Seat contacts are
 // above the legs and the furniture sorts just behind the sleeping Duckies.
 report.snowmanSeats=[{x:2260,y:8040,pose:'wing',bench:'snowman-bench-west'},{x:2820,y:8140,pose:'wing',bench:'snowman-bench-east'}];
 for(const s of report.snowmanSeats)add(art,'bench',s.bench,s.x,s.y+32,235,152.22,{occupiedBySleeper:true,contact:false,z:s.y-1});
 const patch={id:'snowman-clearing',src:'final/props/camp-snow.svg',x:2550,y:8330,width:1120,height:960,finalKind:'scene-base',finalRole:'camp-snow',scene:scene.id,group:scene.id,fixAllAdded:true,shadow:false};art.flats.push(patch);scene.base=patch.id;
 scene.props=art.props.filter(p=>p.scene===scene.id).map(p=>p.id);
 // A social ring: kiosk behind the shared table, benches open toward the
 // table, and two lights on the outer shoulders rather than in the seating.
 const cocoa=report.scenes.find(s=>s.id==='cocoa-garden');
 cocoa.x=4960;cocoa.y=7900;
 const moves={'cocoa-garden-cocoa-cart-0':[4960,7650],'cocoa-garden-bench-1':[4700,8070],'cocoa-garden-bench-2':[5220,8070],'cocoa-garden-lamp-3':[4520,7970],'cocoa-cart-backing':[4960,7360]};
 for(const [id,[x,y]]of Object.entries(moves)){const p=art.props.find(p=>p.id===id);if(!p)continue;p.x=x;p.y=y;if(p.finalRole==='bench'){p.src='final/props/bench-view.svg';p.width=210;p.height=176.4;p.flip=x>4960;p.faces=[4960,8000];}for(const o of w.obstacles.filter(o=>o.prop===id))Object.assign(o,footprint(p,catalog.get(p.finalRole)));}
 const table=add(art,'cocoa-table','cocoa-garden-table',4960,8000,180,145,{scene:cocoa.id});w.obstacles.push(footprint(table,{width:180,height:145}));
 const light=add(art,'lamp','cocoa-garden-ring-lamp',5400,7840,65,159.23,{scene:cocoa.id});w.obstacles.push(footprint(light,catalog.get('lamp')));
 cocoa.props=art.props.filter(p=>p.scene===cocoa.id).map(p=>p.id);
 for(const s of report.scenes)s.props=s.props.filter(id=>art.props.some(p=>p.id===id));
 // Curves stay inside transparent bounds. Every output crop is regenerated
 // from this same rounded master, including the snowman clearing.
 const patchSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600"><path id="organic-clearing" d="M40 300C24 225 105 155 190 140C250 68 356 97 435 82C542 51 650 111 713 156C804 160 868 240 850 310C891 396 794 470 704 471C627 541 520 512 439 532C340 547 259 509 192 480C94 476 32 403 40 300Z" fill="#eef3f9" opacity=".45"/><path d="M76 300C75 226 147 199 216 172C290 120 368 137 443 120C535 93 625 140 688 186C762 189 830 255 811 315C844 384 769 436 685 437C612 493 522 476 438 494C352 507 277 470 210 450C131 445 64 380 76 300Z" fill="#eef3f9" opacity=".55"/></svg>`;
 files.set(path.join(base,'final/props/camp-snow.svg'),patchSvg);
}
export function clearCanopies(art,w,report){
 const plants=art.props.filter(isCanopy);
 // Move an entire offending grove as one group, retaining its authored tree
 // spacing. Cocoa's former front pair becomes a flank grove west of its hut.
 const groups=new Map();for(const p of plants){const key=p.grove??p.id;const g=groups.get(key)??[];g.push(p);groups.set(key,g);}
 for(const [id,parts]of groups){
  if(!parts.some(p=>canopyProblems(p,art,w).length))continue;
  const origin=parts.map(p=>({x:p.x,y:p.y}));
  const offsets=id==='grove-19'?[[-650,-540]]:[];
  for(let r=60;r<=1800;r+=60)for(const [dx,dy]of [[-r,0],[r,0],[0,-r],[-r,-r],[r,-r],[0,r],[-r,r],[r,r]])offsets.push([dx,dy]);
  let chosen;
  for(const [dx,dy]of offsets){
   const moved=parts.map((p,i)=>({...p,x:round(origin[i].x+dx),y:round(origin[i].y+dy)}));
   if(moved.every(p=>!canopyProblems(p,art,w).length&&[[bounds(p).x0,p.y],[bounds(p).x1,p.y],[p.x,bounds(p).y0]].every(q=>inPoly(...q,w.coast))&&!art.props.some(q=>!parts.includes(q)&&['yard','scene','lake'].includes(q.finalKind)&&!isCanopy(q)&&q.finalRole!=='fence'&&overlaps(bounds(p),bounds(q),16)))){chosen=moved;break;}
  }
  if(!chosen)throw Error('Cannot replant canopy group '+id);
  for(let i=0;i<parts.length;i++){const p=parts[i],dx=chosen[i].x-p.x,dy=chosen[i].y-p.y;p.x=chosen[i].x;p.y=chosen[i].y;for(const o of w.obstacles.filter(o=>o.prop===p.id)){if(o.poly)o.poly=o.poly.map(([x,y])=>[round(x+dx),round(y+dy)]);else{o.x=round(o.x+dx);o.y=round(o.y+dy);}}}
  const grove=report.groves.find(g=>g.id===id);if(grove){grove.x=round(parts.reduce((s,p)=>s+p.x,0)/parts.length);grove.y=round(parts.reduce((s,p)=>s+p.y,0)/parts.length);}
 }
}
