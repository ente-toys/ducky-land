import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {Path2D,PathOp,even,ring,curve,stroke,union,contours,simplifyRing} from '../pagepond/geometry.mjs';
import {sites} from './design.mjs';
import {composeFloor} from './floor.mjs';
import {resolveSleepSpots,sleepHalfWidths} from '../../src/pixi/sleep-spots.js';
import {geometry} from '../../rive/web/island-geometry.mjs';
const A='public/pixi-art/themes/library/',D='rive/web/themes/library/',OUT='scripts/pagepond-hamlets/';
const read=p=>JSON.parse(fs.readFileSync(p)),write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const stage=read('/tmp/pagepond-route-stage.json');
const {props,shapes,paths,rests,decks,changes,skipped,links,world,walk,art,ground}=stage;
let dry=even(new Path2D(stage.dry)),floor=composeFloor(ground,links);
const ellipse=(x,y,rx,ry)=>{const p=new Path2D();p.ellipse(x,y,rx,ry,0,0,Math.PI*2);return p;};
const sleepSizes=sleepHalfWidths(),restShapes=rests.map(b=>ellipse(b.x,b.y-6,95,57));
const layouts=Object.fromEntries(Object.keys(sites).map(h=>[h,read(OUT+'layouts/'+h+'.json')]));
// Keep all paper boats afloat, and the short timber pier walkable.
for(const p of props.filter(p=>p.kind==='boat')){if(dry.isPointInPath(p.x,p.y)){throw Error(p.id+' is on dry ground');}p.shadow=false;}
const dock=decks.find(d=>d.id==='hamlet-paperboat-south-jetty');
const dockWalk={id:dock.id,a:[dock.x+dock.width/2,dock.y+14],b:[dock.x+dock.width/2,dock.y+dock.height-20],w:dock.width-10,boatPassUnder:false};
for(const w of [world,walk]){w.walkways.push(dockWalk);w.bridges.push({name:dock.id,x:dock.x+dock.width/2,y:dock.y+dock.height/2,w:dock.width,h:dock.height});}
const dockJoin=[[dockWalk.a[0],dockWalk.a[1]+10],[dockWalk.a[0],dockWalk.a[1]-80]];floor=floor.op(stroke('M'+dockJoin.map(p=>p.join(' ')).join('L'),74),PathOp.Union);links.push({id:'paperboat-jetty-approach',points:dockJoin,width:74,kind:'jetty'});
// Grass beneath each footprint makes the outline of the circulation continuous
// round props and rests. All joins are boolean unions with one outside stroke.
// Normalize each ground contact before subtraction. Ellipse tessellations from
// the native SVG writer can contain hundreds of near-coincident points.
for(const sh of shapes){sh.poly=simplifyRing(sh.poly,.35).map(q=>q.map(v=>+v.toFixed(2)));const p=props.find(p=>p.id===sh.id)||art.props.find(p=>p.id===sh.id);if(p)p.footprint={poly:sh.poly};}
// The courtyard tree belongs inside its planter, as in the approved blueprint.
{const p=props.find(p=>p.id==='hamlet-inkleaf-tree-17'),sh=shapes.find(s=>s.id===p.id),x=sites.inkleaf.at[0]+690*sites.inkleaf.k,y=sites.inkleaf.at[1]+651*sites.inkleaf.k,dx=x-p.x,dy=y-p.y;p.x=x;p.y=y;p.parent='hamlet-inkleaf-reading-garden-planter';sh.poly=sh.poly.map(q=>[q[0]+dx,q[1]+dy]);sh.parent=p.parent;p.footprint={poly:sh.poly};}
// A few supplied grass/shell contacts straddle the blueprint's surf line.
// Move them the shortest distance inland rather than leaving floating flora.
for(const p of props.filter(p=>p.kind!=='boat'&&p.footprint&&!p.parent)){
 const sh=shapes.find(s=>s.id===p.id);if(!sh||sh.existing)continue;
 if(!dry.isPointInPath(p.x,p.y,1)){let done=false;for(let r=10;r<=180&&!done;r+=10)for(let n=0;n<16&&!done;n++){const dx=Math.cos(n*Math.PI/8)*r,dy=Math.sin(n*Math.PI/8)*r;if(dry.isPointInPath(p.x+dx,p.y+dy,1)){p.x+=dx;p.y+=dy;if(Number.isFinite(p.z))p.z+=dy;sh.poly=sh.poly.map(q=>[q[0]+dx,q[1]+dy]);p.footprint={poly:sh.poly};changes.push({id:p.id,dx,dy,reason:'inland from surf'});done=true;}}}
}
write('/tmp/pagepond-floor-input.json',{floor:contours(floor.toSVGString(),10).map(p=>simplifyRing(p,.4)),dry:contours(dry.toSVGString(),12).map(p=>simplifyRing(p,.4)),shapes,rests:restShapes.map(p=>simplifyRing(contours(p.toSVGString(),8)[0],.3))});
execFileSync(process.env.PAGEPOND_PYTHON??'python3',['scripts/pagepond-hamlets/geometry.py','/tmp/pagepond-floor-input.json','/tmp/pagepond-floor-output.json'],{stdio:'inherit'});
const resolvedFloor=read('/tmp/pagepond-floor-output.json');floor=new Path2D(resolvedFloor.d);
console.log('Vector floor valid',resolvedFloor.valid,'components',resolvedFloor.components);
art.props.push(...props);art.decks.push(...decks);
const addedObstacles=shapes.filter(s=>s.solid&&!s.parent&&!s.existing).map(s=>({name:s.id,poly:s.poly}));
world.obstacles.push(...addedObstacles);walk.obstacles.push(...addedObstacles);
const navigationCoast=new Path2D(world.coastRings.map(ring).join('')).op(new Path2D(ring(ground.shoreApron)).round(180),PathOp.Union).op(new Path2D(ground.shoreCut),PathOp.Difference).op(new Path2D(read('scripts/bigger-library/original/world.json').coastRings.map(ring).join('')),PathOp.Union);
const coastRings=contours(navigationCoast.toSVGString());
const coast=coastRings.flatMap(r=>[...r,r[0],coastRings[0][0]]);
for(const w of [world,walk]){w.coast=coast;w.coastRings=coastRings;w.water=world.water;w.boatWater=world.boatWater;}
// Pick a different approved pose for nearby residents. Every candidate is checked
// by the production sleep resolver, including its furniture and walk clearance.
const originalSpots=structuredClone(world.sleepSpots),selected=[];
for(const b of rests){
 let chosen=null;
 for(const pose of ['wing','book','rock','leaf','box','chair','hammock']){
  if(selected.some(s=>Math.hypot(s.x-b.x,s.y-b.y)<(s.pose===pose?910:310)))continue;
  // Prefer removing a resident of this pose, preserving all eight pose arrays.
  if(originalSpots[pose].length-selected.filter(s=>s.pose===pose).length<=1)continue;
  const spots=Object.fromEntries(Object.keys(originalSpots).map(k=>[k,[]]));spots[pose]=[[b.x,b.y,false]];
  const check=resolveSleepSpots(walk,art.props,geometry(walk).walkable,sleepSizes,{spots,avoid:world.sleepAvoid,warn:false});
  if(check.length){chosen={...b,pose};break;}
 }
 if(chosen)selected.push(chosen);else skipped.push({hamlet:b.hamlet,id:'sleep-'+b.index,reason:'production resolver: prop/trunk or neighbouring sleeper clearance'});
}
for(const s of selected){world.sleepSpots[s.pose].pop();world.sleepSpots[s.pose].push([s.x,s.y,false]);}
// Multiple replacements of the same pose must remove distinct old residents.
world.sleepSpots=structuredClone(originalSpots);
for(const pose of Object.keys(originalSpots)){const list=selected.filter(s=>s.pose===pose);world.sleepSpots[pose]=[...originalSpots[pose].slice(0,originalSpots[pose].length-list.length),...list.map(s=>[s.x,s.y,false])];}
const used=new Set(selected.map(s=>s.hamlet+'-'+s.index));
const activeRestShapes=rests.filter(s=>used.has(s.hamlet+'-'+s.index)).map(b=>ellipse(b.x,b.y-6,95,57));
// Unused unsafe spots do not leave empty grass discs in the plaza.
const unusedRest=rests.filter(s=>!used.has(s.hamlet+'-'+s.index));
for(const b of unusedRest){const pocket=ellipse(b.x,b.y-6,95,57).op(new Path2D(ring(paths.find(p=>p.hamlet===b.hamlet).poly)),PathOp.Intersect).op(new Path2D(shapes.filter(s=>!s.parent&&!s.dock&&!s.boat).map(s=>ring(s.poly)).join('')),PathOp.Difference);floor=floor.op(pocket,PathOp.Union);}
for(const [h,s]of Object.entries(sites)){const z=world.zones['bigger-'+h],[x,y]=s.plaza.map((v,i)=>s.at[i]+v*s.k);let spawn=null;const free=geometry(walk).walkable;for(let r=0;r<=250&&!spawn;r+=20)for(let n=0;n<24&&!spawn;n++){const p=[x+Math.cos(n*Math.PI/12)*r,y+Math.sin(n*Math.PI/12)*r];if(floor.isPointInPath(...p)&&free(...p)&&!activeRestShapes.some(s=>s.isPointInPath(...p)))spawn=p;}if(!spawn)throw Error(h+' no clear plaza spawn');Object.assign(z,{x,y,spawn,rx:1000,ry:700});}
world.props=art.props;
for(const r of ground.roads){
 for(const [h,site]of Object.entries(sites))for(const replacement of site.bypass){const a=r.points.findIndex(p=>JSON.stringify(p)===JSON.stringify(replacement[0])),b=r.points.findIndex(p=>JSON.stringify(p)===JSON.stringify(replacement.at(-1)));if(a>=0&&b>a)r.points.splice(a,b-a+1,...replacement);}
 if(r.id==='west-north-heart')r.points=r.points.slice(1);
 if(r.id==='east-north-heart')r.points[0]=[8500,1280];
}
const compatibility=read('scripts/bigger-library/plan.json');compatibility.roads=ground.roads;compatibility.lanes=ground.roads.map(r=>r.points);compatibility.places=compatibility.places.map(z=>({...z,...world.zones['bigger-'+z.id]}));compatibility.status='approved-hamlets-placed';write('scripts/bigger-library/plan.json',compatibility);
// Swap the one painted path union and update only the sea-facing coast in the
// existing vector source. The original centre tiles remain byte-identical.
let source=fs.readFileSync(A+'pagepond/outer-source.svg','utf8');
const oldDry=ground.dry;source=source.split(oldDry).join(dry.toSVGString());
source=source.replace(/<path data-merged-paths="true"[^>]*\/>/,`<path data-merged-paths="true" d="${floor.toSVGString()}" fill="#FFF0C7" stroke="#C9AF71" stroke-width="4" stroke-linejoin="round"/>`);
source=source.replace(/<defs><clipPath id="hamlet-floor">[\s\S]*<\/g>(?=<\/svg>)/,'');
let paving='<defs><clipPath id="hamlet-floor"><path d="'+floor.toSVGString()+'" clip-rule="evenodd"/></clipPath></defs><g clip-path="url(#hamlet-floor)" stroke="#D6C18E" stroke-width="1.5" opacity=".65" fill="none">';
for(const [h,s]of Object.entries(sites)){const plaza=layouts[h].paths[0].polygon.map(q=>q.map((v,i)=>s.at[i]+v*s.k)),clip='pave-'+h;paving+='<defs><clipPath id="'+clip+'"><path d="'+ring(plaza)+'"/></clipPath></defs><g clip-path="url(#'+clip+')">';for(let row=0;row<23;row++)for(let col=0;col<31;col++){const x=s.at[0]+col*65+(row%2)*32.5,y=s.at[1]+row*46;const poly=[[x-32.5,y],[x-16,y-23],[x+16,y-23],[x+32.5,y],[x+16,y+23],[x-16,y+23]];paving+='<path d="'+ring(poly)+'"/>';}paving+='</g>';}
paving+='</g>';source=source.replace('</svg>',paving+'</svg>');
fs.writeFileSync(A+'pagepond/outer-source.svg',source);
const body=source.replace(/^<svg\b[^>]*>/,'').replace(/<\/svg>\s*$/,'');
for(const t of art.ground.tiles.filter(t=>/^bigger\/ground-/.test(t.src)))fs.writeFileSync(A+t.src,`<svg xmlns="http://www.w3.org/2000/svg" width="700" height="650" viewBox="${t.x} ${t.y} ${t.width} ${t.height}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`);
ground.floor=floor.toSVGString();ground.dry=dry.toSVGString();ground.hamlets=Object.keys(sites);
write('scripts/pagepond/layout.json',ground);write(A+'art.json',art);write(D+'world.json',world);write(D+'walk-world.json',walk);write(D+'placements.json',art.props);
const report={floorRings:resolvedFloor.rings,geometry:{valid:resolvedFloor.valid,components:resolvedFloor.components},sites,props:props.length,buildings:props.filter(p=>p.kind==='building').length,decks,shapes,paths,links,sleepers:selected,skipped,adjustments:changes,floor:floor.toSVGString(),dry:dry.toSVGString()};
write(OUT+'placement.json',report);
console.log(JSON.stringify({props:props.length,buildings:report.buildings,sleepers:selected.length,skipped,adjustments:changes.length}));
