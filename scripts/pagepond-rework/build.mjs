import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {Path2D,contours,simplifyRing,curve,ring} from '../pagepond/geometry.mjs';
import {checkTheme} from '../theme-index.mjs';
import {spread,transforms,groves,primaryRoads,straightBridges} from './design.mjs';
const A='public/pixi-art/themes/library/',D='rive/web/themes/library/',O='scripts/pagepond-rework/';
const read=p=>JSON.parse(fs.readFileSync(p)),save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
if(!fs.existsSync(O+'baseline.json')){const world=read(D+'world.json'),walk=read(D+'walk-world.json');delete world.props;save(O+'baseline.json',{art:read(A+'art.json'),world,walk,harbor:read(D+'harbor.json'),ground:read('scripts/pagepond/layout.json'),hamlets:read('scripts/pagepond-hamlets/placement.json'),sleepers:checkTheme('library').sleepers});}
const seed=read(O+'baseline.json'),old=read('scripts/bigger-library/original/world.json'),originalArt=read('scripts/bigger-library/original/art.json'),art=structuredClone(seed.art),world=structuredClone(seed.world),walk=structuredClone(seed.walk),ground=structuredClone(seed.ground),plan=structuredClone(seed.hamlets);
const ell=(x,y,rx,ry)=>Array.from({length:16},(_,i)=>[x+Math.cos(i*Math.PI/8)*rx,y+Math.sin(i*Math.PI/8)*ry]);
const oldProps=new Map(seed.art.props.map(p=>[p.id,p])),deckProps=new Map(seed.art.decks.map(d=>[d.id,{x:d.x+d.width/2,y:d.y+d.height}]));
function rootOf(p){let q=p;const seen=new Set();while(q.parent&&!seen.has(q.id)){seen.add(q.id);const parent=oldProps.get(q.parent)||deckProps.get(q.parent);if(!parent)break;q=parent;}return q;}
for(const p of art.props.filter(p=>p.hamlet)){const previous=oldProps.get(p.id),root=rootOf(previous),at=spread(p.hamlet,[root.x,root.y]),dx=at[0]-root.x,dy=at[1]-root.y;p.x+=dx;p.y+=dy;if(Number.isFinite(p.z))p.z+=dy;if(p.footprint?.poly)p.footprint.poly=p.footprint.poly.map(q=>[q[0]+dx,q[1]+dy]);}
for(const d of art.decks.filter(d=>d.id?.startsWith('hamlet-'))){const at=spread('paperboat',[d.x+d.width/2,d.y+d.height]);d.x=at[0]-d.width/2;d.y=at[1]-d.height;}
const propsById=new Map(art.props.map(p=>[p.id,p]));
const shapes=plan.shapes.map(s=>{const oldP=oldProps.get(s.id)||oldProps.get(s.parent)||deckProps.get(s.id)||deckProps.get(s.parent);let dx=0,dy=0;if(oldP?.hamlet||s.hamlet){const h=s.hamlet??oldP.hamlet,root=rootOf(oldP??{x:s.poly[0][0],y:s.poly[0][1]}),at=spread(h,[root.x,root.y]);dx=at[0]-root.x;dy=at[1]-root.y;}return {...s,poly:s.poly.map(q=>[q[0]+dx,q[1]+dy])};});
const beds=seed.sleepers.map(b=>{const match=plan.sleepers.find(p=>p.pose===b.pose&&Math.hypot(p.x-b.x,p.y-b.y)<2);if(!match)return {...b,original:[b.x,b.y]};const xy=spread(match.hamlet,[match.x,match.y]);return {...b,x:xy[0],y:xy[1],hamlet:match.hamlet,index:match.index,blueprint:match.blueprint,original:[b.x,b.y]};});
for(const b of plan.sleepers){const xy=spread(b.hamlet,[b.x,b.y]);b.x=xy[0];b.y=xy[1];}
const meadowResidents=[],meadowProps=[],meadowGroups=[];
const template=src=>originalArt.props.find(p=>p.src===src);
function add(id,src,x,y,scale,kind,soft=false){const t=template(src);if(!t)throw Error('Missing original '+src);const p={...t,id,name:id,src,x,y,scale,kind,zone:'outer-meadow',shadow:!soft,contact:!soft,anchor:{x:.5,y:1}};delete p.asset;delete p.flip;const w=p.width*scale,poly=ell(x,y-7,w*(kind==='tree'?.11:kind==='bench'?.4:.28),kind==='tree'?Math.max(12,w*.05):kind==='bench'?17:soft?5:15);p.footprint={poly};meadowProps.push(p);shapes.push({id,poly,solid:!soft,soft,tree:kind==='tree',meadow:true});return p;}
const flowers=['reuse/flower-1.svg','reuse/flower-2.svg'].filter(s=>template(s));
if(!flowers.length)throw Error('Original flower art not found');
const flowerOffsets=[[-56,-9],[-28,-31],[1,-14],[37,-34],[62,-6],[-43,24],[-6,19],[28,28],[57,17]];
for(const [gi,[name,[cx,cy],trees,pose]]of groves.entries()){
 const ids=[];for(const [i,[species,dx0,dy,k]]of trees.entries()){const dx=dy>0&&Math.abs(dx0)<220?(dx0<0?-245:245):dx0;const p=add(`meadow-${name}-tree-${i}`,`reuse/tree-${species}.svg`,cx+dx,cy+dy,k,'tree');ids.push(p.id);}
 for(const [pi,[px,py]]of [[cx-180,cy-150],[cx+205,cy+170]].entries())for(const [fi,[dx,dy]]of flowerOffsets.entries()){const p=add(`meadow-${name}-flowers-${pi}-${fi}`,flowers[(gi+pi+fi)%flowers.length],px+dx,py+dy,1.1+(fi%3)*.12,'flower',true);ids.push(p.id);}
 const bench=add(`meadow-${name}-bench`,'book-bench.svg',cx-195,cy+145,.62,'bench');ids.push(bench.id);
 const book=add(`meadow-${name}-book`,'open-book.svg',cx+205,cy+150,.43,'reading',true);ids.push(book.id);
 const bush=add(`meadow-${name}-bush`,'reuse/bush-1.svg',cx+295,cy+225,.9,'bush');ids.push(bush.id);
 meadowGroups.push({name,x:cx,y:cy,props:ids});
 if(pose){const existing=beds.find(b=>b.pose===pose&&!b.hamlet&&!b.meadow&&!b.tree);if(!existing)throw Error('No movable '+pose);Object.assign(existing,{x:cx,y:cy+65,meadow:name});meadowResidents.push({pose,x:cx,y:cy+65,meadow:name});}
}
art.props.push(...meadowProps);
const courts=plan.paths.map(p=>({...p,poly:p.poly.map(q=>spread(p.hamlet,q))}));
const entrances=[];
for(const [h,s]of Object.entries(plan.sites))for(const [i,l]of s.links.entries())entrances.push({id:h+'-entrance-'+i,hamlet:h,point:spread(h,l.from.map((v,j)=>s.at[j]+v*s.k)),width:80});
for(const [h,from,to]of [['quillwick',[704,143],[550,365]],['inkleaf',[960,210],[910,455]],['paperboat',[757,344],[470,510]]]){const site=plan.sites[h],at=bp=>spread(h,bp.map((v,i)=>site.at[i]+v*site.k));entrances.push({id:h+'-internal-reading-join',hamlet:h,point:at(from),goal:at(to),width:80});}
const sample=p=>contours(curve(p),10)[0];
const roads=seed.ground.roads.map(r=>({...r,points:primaryRoads[r.id]??r.points,samples:sample(primaryRoads[r.id]??r.points)}));
for(const [id,points]of Object.entries(primaryRoads))if(!roads.some(r=>r.id===id))roads.push({id,width:170,points,samples:sample(points)});
const channels=[
 {id:'quillbrook',points:[[270,2400],[-400,2510],[-1400,2540],[-2250,2500],[-2900,2370]],widths:[340,340,350,470,950]},
 {id:'inkwater',points:[[7780,2460],[8350,2820],[9160,2910],[10000,2850],[10850,3000]],widths:[340,340,350,460,950]},
 {id:'paperboat-cut',points:[[4800,5350],[5900,5380],[6900,5530],[6810,6010],[6100,6620],[5790,7560]],widths:[340,340,350,350,430,950]}
].map(c=>{const points=sample(c.points);return {...c,samples:points.map((p,i)=>{const t=i/(points.length-1)*(c.widths.length-1),j=Math.min(c.widths.length-2,Math.floor(t));return [...p,c.widths[j]+(c.widths[j+1]-c.widths[j])*(t-j)];})};});
const shore=seed.ground.paperboatShore.map(p=>spread('paperboat',p));
const shoreLine=sample([[6850,7410],[7100,7140],[7250,6860],...shore,[10000,6610],[10800,6300],[11200,6050]]);
const input={props:art.props,shapes,courts,entrances,roads,channels,beds,oldCoast:old.coastRings,expandedCoast:seed.world.coastRings,shoreLine,shore,meadowGroups,oldProps:originalArt.props.length,originalObstacles:old.obstacles,bridgeSeeds:seed.ground.crossings,oldWalkways:old.walkways,oldBridgeRects:old.bridges};
save('/tmp/pagepond-rework-input.json',input);
Object.assign(input,read(O+'bridge-locked-layout.json'),{lockedContacts:true,straightBridges});
save('/tmp/pagepond-rework-input.json',input);
execFileSync(process.env.PAGEPOND_PYTHON??'python3',[O+'geometry.py','/tmp/pagepond-rework-input.json','/tmp/pagepond-rework-output.json'],{stdio:'inherit'});
const geo=read('/tmp/pagepond-rework-output.json');
// Bank-to-bank arches use only the centre's original wooden bridge paths.
const bridgePlan={...seed.ground,crossings:geo.crossings};save(O+'bridges.json',bridgePlan);
execFileSync(process.env.PAGEPOND_PYTHON??'python3',[O+'bridges.py'],{stdio:'inherit'});
const bridges=read(O+'bridges.json').crossings;
art.props=geo.props.filter(p=>p.zone!=='outer-bridge');
art.decks=art.decks.filter(d=>!d.id?.startsWith('bridge-'));
for(const d of art.decks)if(/canal-bridge|jetty-(west|east|south)/.test(d.src))d.overBoats=true;
for(const c of bridges){const [x,y,width,height]=c.viewports.back,[fx,fy,fw,fh]=c.viewports.front;art.decks.push({id:c.id,src:`pagepond/${c.id}-back.svg`,x,y,width,height,overBoats:true});art.props.push({id:c.id+'-rail',name:'Arched wooden bridge front rail',src:`pagepond/${c.id}-front.svg`,x:fx+fw/2,y:fy+fh,width:fw,height:fh,scale:1,anchor:{x:.5,y:1},z:c.y+c.width/2,shadow:false,contact:false,zone:'outer-bridge'});}
const boatWalk=old.walkways.map((w,i)=>({...w,...(i<5?{boatPassUnder:true}:{})}));
const dock=art.decks.find(d=>d.id==='hamlet-paperboat-south-jetty'),dockWalk={id:dock.id,a:[dock.x+dock.width/2,dock.y+14],b:[dock.x+dock.width/2,dock.y+dock.height-20],w:dock.width-10,boatPassUnder:false};
const crossingWays=bridges.map(c=>({id:c.id,a:c.bankA,b:c.bankB,w:c.width,boatPassUnder:true}));
const common={coast:geo.coast,coastRings:geo.coastRings,water:[old.water[0],...geo.water],boatWater:geo.boatWater,riverMouths:geo.mouths,shoreRings:geo.shoreRings,walkways:[...boatWalk,...crossingWays,dockWalk],bridges:[...old.bridges,...geo.bridgeRects,{name:dock.id,x:dock.x+dock.width/2,y:dock.y+dock.height/2,w:dock.width,h:dock.height}],obstacles:[...old.obstacles,...geo.obstacles]};
Object.assign(world,common,{props:art.props,arches:[...old.arches,...bridges.map(c=>({id:c.id,a:c.bankA,b:c.bankB,w:c.width,r:c.rise,shiftX:0}))]});Object.assign(walk,common);delete walk.props;
const originalResolved=seed.sleepers,spots=structuredClone(seed.world.sleepSpots);
for(const [pose,list]of Object.entries(spots))if(pose!=='nod')for(const s of list){const b=originalResolved.find(b=>b.pose===pose&&Math.hypot(b.x-s[0],b.y-s[1])<2);if(b){const next=geo.beds.find(n=>n.pose===pose&&Math.hypot(n.original[0]-b.x,n.original[1]-b.y)<2);if(next){s[0]=next.x;s[1]=next.y;}}}
world.sleepSpots=spots;
for(const [h,s]of Object.entries(plan.sites)){const z=world.zones['bigger-'+h],p=spread(h,[z.x,z.y]),spawn=spread(h,z.spawn);Object.assign(z,{x:p[0],y:p[1],spawn,rx:z.rx*transforms[h].sx,ry:z.ry*transforms[h].sy});}
const outside=geo.outsideD,dry=geo.dryD,floor=geo.floorD,sea=art.sea;
let body=`<defs><clipPath id="outside"><path d="${outside}" clip-rule="evenodd"/></clipPath><clipPath id="lawn"><path d="${dry}" clip-rule="evenodd"/></clipPath><clipPath id="floor"><path d="${floor}" clip-rule="evenodd"/></clipPath></defs><g clip-path="url(#outside)" fill-rule="evenodd"><path d="${outside}" fill="${sea}"/>`;
for(const [color,width]of [['#8FD6E6',90],['#B5E7F7',62],['#FDE48C',36]])body+=`<path d="${dry}" fill="#93B72F" stroke="${color}" stroke-width="${width}" stroke-linejoin="round"/>`;
body+=`<path d="${dry}" fill="#93B72F" stroke="#FFF4CB" stroke-width="4"/>`;
body+='<g clip-path="url(#lawn)" fill="none" stroke="#759D31" stroke-width="2" opacity=".3">';
for(let row=0;row<47;row++)for(let col=0;col<60;col++){const x=-2600+col*219+(row%3)*63,y=-1700+row*188+(col%4)*19;body+=`<path d="M${x} ${y}l4-8 4 7m11 2 8-3 9 2"/>`;}
body+=`</g><path data-merged-paths="true" d="${floor}" fill="#FFF0C7" stroke="#C9AF71" stroke-width="4" stroke-linejoin="round"/>`;
// Paving is clipped to each expanded square and to the circulation, so lawns and joins stay clean.
body+='<g clip-path="url(#floor)" fill="none" stroke="#D6C18E" stroke-width="1.5" opacity=".65">';
for(const [h]of Object.entries(plan.sites)){const p=geo.courts.find(p=>p.hamlet===h),xs=p.poly.map(q=>q[0]),ys=p.poly.map(q=>q[1]),x0=Math.min(...xs),y0=Math.min(...ys),x1=Math.max(...xs),y1=Math.max(...ys);body+=`<defs><clipPath id="pave-${h}"><path d="${ring(p.poly)}"/></clipPath></defs><g clip-path="url(#pave-${h})">`;for(let y=y0;y<y1+50;y+=46)for(let x=x0;x<x1+65;x+=65){const dx=(Math.round((y-y0)/46)%2)*32.5;body+=`<path d="${ring([[x+dx-32.5,y],[x+dx-16,y-23],[x+dx+16,y-23],[x+dx+32.5,y],[x+dx+16,y+23],[x+dx-16,y+23]])}"/>`;}body+='</g>';}
body+='</g></g>';
body+=`<path data-bridge-landings="true" d="${geo.centreLandingD}" fill="#FDE48C"/>`;
fs.writeFileSync(A+'pagepond/outer-source.svg',`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3000 -2200 14000 10400">${body}</svg>`);
// Four world-unit bleed overlaps adjacent textures. No transparent tile seams.
for(const t of art.ground.tiles.filter(t=>/^bigger\/ground-/.test(t.src))){const m=t.src.match(/ground-(\d+)-(\d+)/),x=-3000+Number(m[2])*1400-2,y=-2200+Number(m[1])*1300-2;Object.assign(t,{x,y,width:1404,height:1304});fs.writeFileSync(A+t.src,`<svg xmlns="http://www.w3.org/2000/svg" width="702" height="652" viewBox="${x} ${y} 1404 1304" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`);}
Object.assign(ground,{crossings:bridges,roads:geo.roads,channels:geo.channels,floor,dry,hamlets:Object.keys(transforms),navigationRevision:3,floorRings:geo.floorRings,outerFloorRings:geo.outerFloorRings,centreLandingRings:geo.centreLandingRings});
Object.assign(plan,{sites:seed.hamlets.sites,layoutTransforms:transforms,floorRings:geo.floorRings,outerFloorRings:geo.outerFloorRings,entranceChecks:geo.entranceChecks,shapes:geo.shapes,paths:geo.courts,links:geo.links,floor,dry,sleepers:geo.beds.filter(b=>b.hamlet),meadowResidents:geo.beds.filter(b=>b.meadow),meadowGroups:geo.meadowGroups,revision:2,geometry:geo.metrics});
save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);save(D+'placements.json',art.props);save('scripts/pagepond/layout.json',ground);save('scripts/pagepond-hamlets/placement.json',plan);const compat=read('scripts/bigger-library/plan.json');Object.assign(compat,{roads:geo.roads,lanes:geo.roads.map(r=>r.points),crossings:bridges,places:compat.places.map(z=>({...z,...world.zones['bigger-'+z.id]}))});save('scripts/bigger-library/plan.json',compat);
save(O+'report.json',{...geo.metrics,adjustments:geo.adjustments,omitted:geo.omitted,boatTours:geo.boatTours,bridges:bridges.length,groves:geo.meadowGroups});
execFileSync(process.execPath,['scripts/theme-index.mjs'],{stdio:'inherit'});
const checked=checkTheme('library');console.log('LIBRARY',checked.ready,checked.problems);if(!checked.ready)process.exitCode=1;
