// Round 3: places own their details. Recorded camp anchors are fitted as whole
// compositions; nothing fills an uncovered view with an individual small prop.
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {bounds,overlaps,piece,footprint,pathClearance,propPathClearance,landViews,area} from './place.mjs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {createNavigation} from '../../src/pixi/navigation.js';
import {geometry,inPoly} from '../../rive/web/island-geometry.mjs';
import {resolveSleepSpots,sleepHalfWidths} from '../../src/pixi/sleep-spots.js';
import {composeFixAll,clearCanopies} from './fix-all.mjs';
const round=n=>Math.round(n*100)/100;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const read=p=>JSON.parse(readFileSync(p));
const boxOf=parts=>({x0:Math.min(...parts.map(p=>bounds(p).x0)),x1:Math.max(...parts.map(p=>bounds(p).x1)),y0:Math.min(...parts.map(p=>bounds(p).y0)),y1:Math.max(...parts.map(p=>bounds(p).y1))});
const visible=(p,v)=>{const b=bounds(p);return Math.min(b.x1,v.x1)-Math.max(b.x0,v.x0)>=Math.min(p.width*.4,50)&&Math.min(b.y1,v.y1)-Math.max(b.y0,v.y0)>=Math.min(p.height*.4,40);};
export function composedCoverage(view,art,report){
 const byId=new Map([...art.props,...art.flats].map(p=>[p.id,p]));
 return {composedPlace:(report.groups??[]).some(g=>{
  const parts=g.members.map(id=>byId.get(id)).filter(Boolean);
  if(g.kind==='yard'||g.kind==='activity')return parts.some(p=>['building','scene-base'].includes(p.finalKind)&&visible(p,view))||parts.filter(p=>visible(p,view)).length>=2;
  return parts.filter(p=>visible(p,view)&&p.finalRole!=='camp-snow'&&p.finalRole!=='trail').length>=2;
 })};
}
// This is an exact sliding rectangle count, independent of the 120-unit audit.
export function maxSleepersInView(beds,width=1440,height=900){
 let max=0;
 for(const x of beds.map(b=>b.x)){
  const column=beds.filter(b=>b.x>=x-.01&&b.x<=x+width+.01).sort((a,b)=>a.y-b.y);
  for(let i=0,j=0;i<column.length;i++){while(j<column.length&&column[j].y<=column[i].y+height+.01)j++;max=Math.max(max,j-i);}
 }
 return max;
}
const CAMP_ANCHORS=[
 [2950,1620,'woodpile'],[4510,2270,'cocoa-table'],[6480,1500,'mini-snowman'],[8520,1500,'woodpile'],[10650,2200,'cocoa-table'],
 [1800,3550,'cocoa-table'],[3800,3550,'woodpile'],[5900,3550,'mini-snowman'],[8050,3300,'cocoa-table'],[10200,3500,'woodpile'],
 [1800,4850,'mini-snowman'],[4200,5000,'woodpile'],[5900,5850,'cocoa-table'],[8650,4950,'mini-snowman'],
 [10650,6400,'woodpile'],[1700,7750,'mini-snowman'],[3700,7250,'woodpile'],[5500,8050,'cocoa-table'],[7000,7350,'cocoa-table'],[8800,6400,'woodpile'],
 // Alternative clearings, only used if an authored site cannot fit its three beds.
 [3200,4600,'cocoa-table'],[4800,6600,'woodpile'],[7200,3900,'mini-snowman'],[9500,1800,'cocoa-table'],[6500,8350,'woodpile'],[2300,2200,'mini-snowman'],
];
function addFlat(art,clusters,id,role,x,y,width,height,group,extra={}){
 const p={id,src:`final/props/${role}.svg`,x:round(x),y:round(y),width,height,finalKind:'ground-detail',finalRole:role,group,q3Added:true,qualityAdded:true,resolution:4,shadow:false,...extra};
 art.flats.push(p);if(role!=='camp-snow')clusters.push({...p,role,motifCount:role==='trail'?8:role==='frost-cluster'?3:4});return p;
}
function smallDistance(p,parts){const b=bounds(p),x=(b.x0+b.x1)/2,y=(b.y0+b.y1)/2;return Math.min(...parts.filter(q=>q.id!==p.id&&q.finalKind!=='ground-detail').map(q=>{const c=bounds(q);return Math.hypot(Math.max(c.x0-x,0,x-c.x1),Math.max(c.y0-y,0,y-c.y1));}));}
export function quality3Problems(art,w,report){
 const errors=[],all=[...art.props,...art.flats],byId=new Map(all.map(p=>[p.id,p]));
 for(const g of report.groups??[]){
  const parts=g.members.map(id=>byId.get(id)).filter(Boolean);
  for(const p of parts.filter(p=>p.finalKind==='shrub'||['pebbles-cluster','frost-cluster','drift-cluster'].includes(p.finalRole)))if(smallDistance(p,parts)>120)errors.push(`isolated small item ${p.id}`);
 }
 for(const p of all.filter(p=>p.finalKind==='shrub'||p.finalKind==='ground-detail'))if(!p.group&&!p.building&&!p.scene)errors.push(`unowned small item ${p.id}`);
 if(all.some(p=>p.finalRole==='frozen-puddle'))errors.push('retired uncomposed frozen puddle');
 for(const camp of report.camps??[]){
  if(camp.residents.length<2||camp.residents.length>4)errors.push('camp resident count '+camp.id);
  if(!byId.has(camp.focal)||!byId.has(camp.lamp)||!byId.has(camp.patch))errors.push('incomplete camp '+camp.id);
 }
 if(maxSleepersInView(report.sleepers)>4)errors.push('more than four sleepers in a view');
 for(const trail of report.trails??[])if(trail.points.length<2||trail.gaps.some(d=>d>31))errors.push('broken footprint trail '+trail.id);
 return errors;
}
export function composeQuality3(root,art,w,report,catalog){
 const files=new Map(),originalTrees=art.props.filter(p=>p.finalKind==='tree');
 for(const p of originalTrees)if(p.q3Original){Object.assign(p,p.q3Original);delete p.q3Original;}
 report.groves=report.groves.filter(g=>!g.q3Added);
 for(const g of report.groves)g.trees=originalTrees.filter(p=>p.grove===g.id).map(p=>p.id);
 // Freeze the approved 536 pines. Retire the many independent coverage fixes,
 // all scattered sleepers' personal nooks, and every freestanding puddle.
 art.props=art.props.filter(p=>!p.q3Added&&!['nook','vignette','vignette-flat'].includes(p.finalKind)&&(p.finalKind!=='shrub'||p.finalKind==='scene'||p.scene&&report.scenes.some(s=>s.id===p.scene)));
 art.flats=art.flats.filter(p=>!p.q3Added&&!['ground','ground-detail','path-edge','vignette-flat'].includes(p.finalKind));
 const retainedIds=new Set(art.props.map(p=>p.id));w.obstacles=w.obstacles.filter(o=>retainedIds.has(o.prop));
 for(const p of art.props.filter(p=>p.occupiedBySleeper&&!p.fixAllAdded)){delete p.occupiedBySleeper;delete p.z;w.obstacles.push(footprint(p,catalog.get(p.finalRole)));}
 report.groups=[];report.camps=[];report.trails=[];report.winterPockets=[];report.sleepRepairs=[];
 composeFixAll(root,art,w,report,catalog,files);
 const clusters=[];
 const addGroup=(id,kind,parts)=>{const b=boxOf(parts);const g={id,kind,members:parts.map(p=>p.id),...b,x:round((b.x0+b.x1)/2),y:round((b.y0+b.y1)/2)};report.groups.push(g);return g;};
 for(const b of art.props.filter(p=>p.finalKind==='building'))addGroup('yard-'+b.id,'yard',art.props.filter(p=>p.id===b.id||p.building===b.id));
 for(const s of report.scenes){const parts=[...art.props,...art.flats].filter(p=>p.scene===s.id||p.id===s.base);addGroup(s.id,'activity',parts);}
 // Seven broad coastal clearings gain full pine compositions. Trees are
 // transferred from the deepest groves, preserving the exact tree count.
 const fieldAnchors=[[6800,1120],[1190,3740],[11100,4330],[9840,5540],[2080,8370],[2560,8330]];
 for(const [i,[x,y]]of fieldAnchors.entries()){
  const id='field-grove-'+i,donor=report.groves.filter(g=>!g.q3Added).sort((a,b)=>b.trees.length-a.trees.length||a.id.localeCompare(b.id))[0];
  const pool=originalTrees.filter(p=>p.grove===donor.id&&p.id!=='final-grove-0-tree-0');
  const moved=[];
  for(const [j,[role,dx,dy]]of [['pine-large',-90,-65],['pine-medium',120,-15],['pine-medium',-190,100]].entries()){
   const p=pool.find(p=>p.finalRole===role&&!moved.includes(p))??pool.find(p=>!moved.includes(p));
   p.q3Original={x:p.x,y:p.y,grove:p.grove,scene:p.scene,feedbackAdded:p.feedbackAdded??false};
   Object.assign(p,{x:x+dx,y:y+(i===5&&j===2?60:dy),grove:id,scene:id,feedbackAdded:false});moved.push(p);
   const o=w.obstacles.find(o=>o.prop===p.id);if(o)Object.assign(o,footprint(p,catalog.get(p.finalRole),{tree:true}));
  }
  donor.trees=donor.trees.filter(id=>!moved.some(p=>p.id===id));
  report.groves.push({id,x,y,trees:moved.map(p=>p.id),shrubs:[],q3Added:true});
 }
 clearCanopies(art,w,report,catalog);
 // Existing groves are divided into local, connected tree groups of 3-8 trees.
 // Their bases keep a single shrub clump, drift and stone cluster tucked under
 // the canopy. No marks are painted in the snow between these places.
 for(const grove of report.groves){
  const remaining=originalTrees.filter(p=>p.grove===grove.id).sort((a,b)=>a.y-b.y||a.x-b.x);
  let n=0;
  while(remaining.length){
   const seed=remaining.shift(),count=remaining.length>8?6:remaining.length,near=remaining.sort((a,b)=>distance(seed,a)-distance(seed,b)).splice(0,count),parts=[seed,...near];
   const id=`${grove.id}-composition-${n++}`,front=parts.reduce((a,b)=>a.y>b.y?a:b);
   for(const p of parts)p.group=id;
   const safe=(p)=>inPoly(p.x,p.y,w.coast)&&pathClearance(w,p.x,p.y)>35&&!art.props.some(q=>['building','yard','scene'].includes(q.finalKind)&&overlaps(bounds(p),bounds(q),8));
   for(const [role,dx,dy,width,height]of [['frost-cluster',-35,25,260,103],['drift-cluster',95,20,200,59.61],['pebbles-cluster',-120,16,120,44.9]]){
    const p={id:id+'-'+role,x:front.x+dx,y:front.y+dy,width,height};
    if(safe(p))parts.push(addFlat(art,clusters,p.id,role,p.x,p.y,width,height,id));
   }
   addGroup(id,'grove',parts);
  }
 }
 // Keep activity plants attached to their actual scene, rather than qualifying
 // as additional independent coverage pockets.
 for(const p of art.props.filter(p=>p.finalKind==='shrub'))p.group=p.scene;
 const harbor=read(path.join(root,'rive/web/themes/snow/harbor.json'));
 const base=makeMap('snow',{world:w,walk:w,harbor,sleepers:[]}).baseWalk;
 const walk=geometry(base).walkable,sizes=sleepHalfWidths();
 // Retain the count and all eight poses, assigned to one shared camp at a time.
 const counts=Object.fromEntries(Object.entries(w.sleepSpots).map(([pose,spots])=>[pose,spots.length]));
 w.sleepSpots=Object.fromEntries(Object.keys(counts).map(pose=>[pose,[]]));report.sleepers=[];
 for(const s of report.snowmanSeats){
  counts[s.pose]--;w.sleepSpots[s.pose].push([s.x,s.y,false,{seat:s.bench,scene:'snowman-scene'}]);
  report.sleepers.push({...s,scene:'snowman-scene',camp:'snowman-scene',seat:s.bench});
 }
 const poses=['nod','hammock','book','box','chair','rock','wing','leaf'];
 let cursor=0,campIndex=0;
 const resolved=()=>resolveSleepSpots(base,art.props,walk,sizes,{spots:w.sleepSpots,avoid:w.sleepAvoid,warn:false});
 for(const [ax,ay,focalRole]of CAMP_ANCHORS){
  if(report.sleepers.length===60)break;
  const remaining=Object.values(counts).reduce((a,b)=>a+b,0);
  const chosen=poses.filter(p=>counts[p]>0).sort((a,b)=>(a==='nod'?-100:b==='nod'?100:counts[b]-counts[a])||((poses.indexOf(a)-cursor+8)%8)-((poses.indexOf(b)-cursor+8)%8)).slice(0,remaining<=4?2:3);
  let fitted;
  const nod=chosen.includes('nod'),nodTree=originalTrees.find(p=>p.id==='final-grove-0-tree-0');
  const offsets=[[0,0]];for(let r=80;r<=640;r+=80)for(let i=0;i<16;i++)offsets.push([Math.cos(i*Math.PI/8)*r,Math.sin(i*Math.PI/8)*r]);
  for(const [dx,dy]of nod?[[0,0]]:offsets){
   const x=nod?nodTree.x+280:round(ax+dx),y=nod?nodTree.y-16:round(ay+dy),id=`camp-${campIndex}`;
   const focal=focalRole==='cocoa-table'?{id:id+'-focal',name:id+'-focal',src:'final/props/cocoa-table.svg',x,y:y+40,width:180,height:145,finalKind:'camp',finalRole:'cocoa-table',q3Added:true,shadow:false}:piece(catalog,focalRole,id+'-focal',x,y+40,{finalKind:'camp',q3Added:true});
   const lamp=piece(catalog,'lamp',id+'-lamp',x-105,y-65,{finalKind:'camp',q3Added:true});lamp.height=round(lamp.height*65/lamp.width);lamp.width=65;
   const patchBounds={x0:x-450,x1:x+450,y0:y-240,y1:y+360};
   if(!walk(x,y+355)||art.props.some(p=>p.finalKind==='building'&&overlaps(bounds(p),patchBounds))||pathClearance(w,x,y+360)<0)continue;
   const parts=[focal,lamp];
   if(parts.some(p=>propPathClearance(w,p)<8||!inPoly(p.x,p.y,w.coast)||art.props.some(q=>['building','yard','scene'].includes(q.finalKind)&&overlaps(bounds(q),bounds(p),12))))continue;
   const proposed=chosen.map((pose,i)=>{const [ox,oy]=(chosen.length===4?[[-280,30],[280,30],[-280,350],[280,350]]:[[-280,30],[280,30],[0,300]])[i];return {pose,x:round(x+ox),y:round(y+oy),scene:id,camp:id};});
   if(nod){proposed[0].x=nodTree.x;proposed[0].y=nodTree.y+14;}
   if(maxSleepersInView([...report.sleepers,...proposed])>4)continue;
   art.props.push(...parts);
   for(const p of proposed)w.sleepSpots[p.pose].push(p.pose==='nod'?[nodTree.id,0,false]:[p.x,p.y,p.x>x]);
   const beds=resolved(),expected=report.sleepers.length+proposed.length;
   if(beds.length===expected&&!beds.bad.length){fitted={x,y,id,parts,proposed};break;}
   art.props.splice(-parts.length);for(const p of proposed)w.sleepSpots[p.pose].pop();
  }
  if(!fitted){if(nod)throw Error('Cannot fit nod camp '+JSON.stringify(resolved().bad));continue;}
  const {x,y,id,parts,proposed}=fitted;
  for(const b of proposed){counts[b.pose]--;report.sleepers.push(b);}
  cursor=(cursor+3)%poses.length;
  for(const p of parts){p.group=id;p.scene=id;w.obstacles.push(footprint(p,p.finalRole==='cocoa-table'?{width:180,height:145}:catalog.get(p.finalRole)));}
  const patch=addFlat(art,clusters,id+'-snow','camp-snow',x,y+360,900,600,id,{finalKind:'camp-base'});parts.push(patch);
  // Two shoulders, tucked into the rear edge of the same trodden patch.
  for(const [i,[ox,oy]]of [[-385,35],[385,35]].entries()){
   const p=piece(catalog,'shrub-medium',id+'-shoulder-'+i,x+ox,y+oy,{finalKind:'shrub',q3Added:true,group:id,scene:id,contact:false});
   if(propPathClearance(w,p)>=8&&inPoly(p.x,p.y,w.coast)&&!art.props.some(q=>q.finalKind==='building'&&overlaps(bounds(p),bounds(q)))){art.props.push(p);parts.push(p);}
  }
  const g=addGroup(id,'camp',parts);report.camps.push({...g,x,y,focal:parts[0].id,lamp:parts[1].id,patch:patch.id,residents:proposed.map(p=>({pose:p.pose,x:p.x,y:p.y}))});
  campIndex++;
 }
 if(report.sleepers.length!==60)throw Error(`Only ${report.sleepers.length}/60 camp residents fitted; remaining ${JSON.stringify(counts)}`);
 report.camps.push({id:'snowman-scene',x:2550,y:7800,focal:'snowman-cabin',lamp:'snowman-door-lamp',patch:'snowman-clearing',residents:report.snowmanSeats.map(s=>({...s}))});
 // Camps are fitted after planting. Remove any undergrowth detail their
 // furniture now occupies, keeping the rest of its parent grove intact.
 const hidden=new Set(clusters.filter(c=>art.props.some(p=>!['tree','shrub','smoke'].includes(p.finalKind)&&overlaps(bounds(c),bounds(p),8))).map(c=>c.id));
 art.flats=art.flats.filter(p=>!hidden.has(p.id));
 for(let i=clusters.length-1;i>=0;i--)if(hidden.has(clusters[i].id))clusters.splice(i,1);
 for(const g of report.groups)g.members=g.members.filter(id=>!hidden.has(id));
 // Complete the three tight edge groups with compact details at their own
 // tree feet. Every field composition contains 5-12 placed elements.
 const byId=new Map([...art.props,...art.flats].map(p=>[p.id,p]));
 for(const g of report.groups.filter(g=>g.kind==='grove'&&g.members.length<5)){
  const trees=g.members.map(id=>byId.get(id)).filter(p=>p.finalKind==='tree');
  outer:for(const tree of trees)for(const [dx,dy]of [[0,8],[-65,12],[65,12],[-95,-12],[95,-12],[0,-35]]){
   if(g.members.length>=5)break outer;
   const role=g.members.length%2?'pebbles-cluster':'drift-cluster',width=role==='pebbles-cluster'?96:150,height=role==='pebbles-cluster'?35.92:44.71;
   const p={id:g.id+'-foot-detail-'+g.members.length,x:tree.x+dx,y:tree.y+dy,width,height};
   if(pathClearance(w,p.x,p.y)<90||!inPoly(p.x,p.y,w.coast)||art.props.some(q=>!['tree','shrub','smoke'].includes(q.finalKind)&&overlaps(bounds(p),bounds(q),8)))continue;
   const part=addFlat(art,clusters,p.id,role,p.x,p.y,width,height,g.id);byId.set(part.id,part);g.members.push(part.id);
  }
  if(g.members.length<5){
   const owner=report.groups.filter(q=>['yard','activity'].includes(q.kind)).sort((a,b)=>distance(a,g)-distance(b,g))[0];
   if(!owner||distance(owner,g)>700)throw Error('Incomplete field composition '+g.id);
   owner.members.push(...g.members);for(const id of g.members)byId.get(id).group=owner.id;
   report.groups=report.groups.filter(q=>q!==g);
  }
 }
 // One continuous walked connection from each camp to the existing lane.
 // Route around solids using the same navigation as the game. Tight SVG chunks
 // keep diagonal trails from reserving large empty textures.
 const trailWorld={...w,obstacles:[...w.obstacles,...art.props.filter(p=>['building','yard','scene','camp','lake'].includes(p.finalKind)).map(p=>{const b=bounds(p);return {poly:[[b.x0-60,b.y0-60],[b.x1+60,b.y0-60],[b.x1+60,b.y1+60],[b.x0-60,b.y1+60]]};})]};
 const nav=createNavigation(trailWorld);
 for(const camp of report.camps){
  const end=camp.id==='snowman-scene'?[2550,8200]:[camp.x,camp.y+355];
  const starts=w.iceland2.routes.flatMap(r=>r.samples).sort((a,b)=>Math.hypot(a[0]-end[0],a[1]-end[1])-Math.hypot(b[0]-end[0],b[1]-end[1]));
  let points;
  for(const start of starts.filter(p=>nav.walkable(...p)).slice(0,80)){
   const line=nav.clearLine(start,end)?[start,end]:[start,...nav.route(...start,...end)];
   if(line.length>=2&&Math.hypot(line.at(-1)[0]-end[0],line.at(-1)[1]-end[1])<80){points=line;break;}
  }
  if(!points)throw Error('No path to '+camp.id+' '+JSON.stringify({x:camp.x,y:camp.y,end,walk:nav.walkable(...end),residents:camp.residents}));
  const prints=[];let carry=0;
  for(let j=1;j<points.length;j++){
   const a=points[j-1],b=points[j],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
   if(!length)continue;
   let d=carry;for(;d<length;d+=20){const side=prints.length%2?1:-1;prints.push({x:a[0]+dx*d/length-dy/length*side*5,y:a[1]+dy*d/length+dx/length*side*5,angle:Math.atan2(dy,dx)*180/Math.PI-90});}carry=d-length;
  }
  const trail={id:camp.id+'-trail',camp:camp.id,from:'ice-path',to:camp.id,points,gaps:prints.slice(1).map((p,i)=>distance(p,prints[i])),members:[]};
  for(let j=0;j<prints.length;j+=4){
   const chunk=prints.slice(j,j+4),x0=Math.floor(Math.min(...chunk.map(p=>p.x))-15),y0=Math.floor(Math.min(...chunk.map(p=>p.y))-15),width=Math.ceil(Math.max(...chunk.map(p=>p.x))+15-x0),height=Math.ceil(Math.max(...chunk.map(p=>p.y))+15-y0),id=trail.id+'-'+j;
   const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><g fill="#bdcbd8" opacity=".65">${chunk.map(p=>`<ellipse cx="${round(p.x-x0)}" cy="${round(p.y-y0)}" rx="3.3" ry="6" transform="rotate(${round(p.angle)} ${round(p.x-x0)} ${round(p.y-y0)})"/>`).join('')}</g></svg>`;
   const p=addFlat(art,clusters,id,'trail',x0+width/2,y0+height,width,height,trail.id,{src:'final/props/trails/'+id+'.svg',continuousTrail:true});
   files.set('public/pixi-art/themes/snow/'+p.src,svg);trail.members.push(p.id);
  }
  report.trails.push(trail);
 }
 report.counts={...report.counts,trees:originalTrees.length,shrubs:art.props.filter(p=>p.finalKind==='shrub').length,sleepers:60};
 report.groves=report.groves.map(g=>({...g,shrubs:art.props.filter(p=>p.grove===g.id&&p.finalKind==='shrub').map(p=>p.id)}));
 report.version=5;report.coverage={width:1440,height:900,stride:120,views:landViews(w,{stride:120}).length,required:['composedPlace'],maxIsolatedSmallItemDistance:120,maxSleepersPerView:4};
 report.ground={clusters,count:clusters.length,area:area(w.coast),baked:false,rendering:'shared-svg-crops'};
 return files;
}
