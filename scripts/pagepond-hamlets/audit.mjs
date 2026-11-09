import fs from 'node:fs';
import {spread} from '../pagepond-rework/design.mjs';
import {fileURLToPath} from 'node:url';
import {Path2D,PathOp,even,ring,contours,dist} from '../pagepond/geometry.mjs';
import {checkTheme} from '../theme-index.mjs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {geometry,inShape} from '../../rive/web/island-geometry.mjs';
const read=p=>JSON.parse(fs.readFileSync(p));
const A='public/pixi-art/themes/library/',D='rive/web/themes/library/';
const polygonCache=new WeakMap();
const pathRings=p=>{if(!polygonCache.has(p))polygonCache.set(p,contours(p.toSVGString(),6));return polygonCache.get(p);};
const boundsOf=ps=>[Math.min(...ps.map(p=>p[0])),Math.min(...ps.map(p=>p[1])),Math.max(...ps.map(p=>p[0])),Math.max(...ps.map(p=>p[1]))];
const boxes=(a,b)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
const boundsOverlap=(a,b)=>boxes(a.getBounds(),b.getBounds());
const inside=(p,r)=>{let hit=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
const nearBoundary=(p,rings)=>rings.some(r=>r.some((a,i)=>dist(p,a,r[(i+1)%r.length])<.13));
const filled=(p,rings)=>rings.reduce((n,r)=>n+(inside(p,r)?1:0),0)%2===1;
const cross=(a,b,c,d)=>{const dx=b[0]-a[0],dy=b[1]-a[1],ex=d[0]-c[0],ey=d[1]-c[1],det=dx*ey-dy*ex;if(Math.abs(det)<1e-8)return false;const t=((c[0]-a[0])*ey-(c[1]-a[1])*ex)/det,u=((c[0]-a[0])*dy-(c[1]-a[1])*dx)/det;return t>1e-4&&t<1-1e-4&&u>1e-4&&u<1-1e-4;};
function intersects(a,br){
 const bounds=boundsOf(a),rings=br.filter(r=>r.length>2&&boxes(bounds,boundsOf(r)));if(!rings.length)return false;
 if(a.some(p=>filled(p,br)&&!nearBoundary(p,rings)))return true;
 const mid=a.reduce((q,p)=>[q[0]+p[0]/a.length,q[1]+p[1]/a.length],[0,0]);if(inside(mid,a)&&filled(mid,br)&&!nearBoundary(mid,rings))return true;
 for(const r of rings){if(r.some(p=>inside(p,a)&&!nearBoundary(p,[a])))return true;for(let i=0;i<a.length;i++){const x=a[i],y=a[(i+1)%a.length],ab=[Math.min(x[0],y[0]),Math.min(x[1],y[1]),Math.max(x[0],y[0]),Math.max(x[1],y[1])];for(let j=0;j<r.length;j++){const c=r[j],d=r[(j+1)%r.length];if(Math.max(c[0],d[0])<ab[0]||Math.min(c[0],d[0])>ab[2]||Math.max(c[1],d[1])<ab[1]||Math.min(c[1],d[1])>ab[3])continue;if(cross(x,y,c,d))return true;}}}
 return false;
}
const overlap=(a,b)=>boundsOverlap(a,b)&&pathRings(a).some(r=>intersects(r,pathRings(b)))?2:0;
const ell=(x,y,rx,ry)=>new Path2D(ring(Array.from({length:48},(_,i)=>[x+Math.cos(i*Math.PI/24)*rx,y+Math.sin(i*Math.PI/24)*ry])));
export function auditPagepond(){
 const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),plan=read('scripts/pagepond-hamlets/placement.json'),ground=read('scripts/pagepond/layout.json'),oldArt=read('scripts/bigger-library/original/art.json');
 const checked=checkTheme('library'),map=makeMap('library',{world,walk,harbor:read(D+'harbor.json'),sleepers:checked.sleepers}),nav=map.nav(),geo=geometry(map.baseWalk),floor=even(new Path2D(plan.floor)).op(new Path2D(read('scripts/bigger-library/original/world.json').coastRings.map(ring).join('')),PathOp.Difference),issues=[];
 const route=(p,r=130)=>{const near=nav.nearest(...p,r);return Boolean(near&&(nav.route(map.spawn.x,map.spawn.y,...near).length||Math.hypot(near[0]-map.spawn.x,near[1]-map.spawn.y)<80));};
 const lockedLand=read('scripts/bigger-library/original/world.json').coastRings;
 const paintedFloor=plan.outerFloorRings??pathRings(floor);
 const waterShapes=world.water.filter(w=>w.poly).map(w=>new Path2D(ring(w.poly))),bridgeShapes=ground.crossings.map(c=>({id:c.id,shape:new Path2D(ring(c.footprint))}));
 const contacts=plan.shapes.map(s=>({...s,shape:new Path2D(ring(s.poly))}));
 const family=(a,b)=>a.parent===b.id||b.parent===a.id||a.parent&&a.parent===b.parent;
 const propChecks=[];
 for(const p of art.props){
  const s=contacts.find(s=>s.id===p.id),legacy=oldArt.props.some(o=>o.id===p.id),record={id:p.id,legacy,kind:p.kind??p.zone??'centre',accessible:true};
  if(!s){record.accessible=route([p.x,p.y+55],Math.max(160,p.width*(p.scale??1)*.65));if(!record.accessible){for(const r of [220,360,520,680]){for(let i=0;i<12&&!record.accessible;i++){const a=i*Math.PI/6,point=[p.x+Math.cos(a)*r,p.y+Math.sin(a)*r];if(route(point,95)){record.accessible=true;record.approach=point;}}if(record.accessible)break;}}if(!record.accessible)issues.push({type:'prop-access',id:p.id,x:p.x,y:p.y});}
  if(s){
   record.pathOverlap=intersects(s.poly,paintedFloor)?2:0;if(record.pathOverlap>.6&&!s.parent)issues.push({type:'prop-path',id:p.id,area:record.pathOverlap});
   record.accessible=s.soft||s.parent||s.boat||p.contact===false||route([p.x,p.y+75],160);
   if(!record.accessible)issues.push({type:'prop-access',id:p.id,x:p.x,y:p.y});
   if(s.solid&&!s.parent){const wet=waterShapes.some(w=>boundsOverlap(s.shape,w)&&overlap(s.shape,w)>1);if(wet)issues.push({type:'prop-water',id:p.id});}
   for(const c of bridgeShapes){if(overlap(s.shape,c.shape)>1)issues.push({type:'prop-bridge',id:p.id,bridge:c.id});}
  }
  propChecks.push(record);
 }
 for(let i=0;i<contacts.length;i++){
  const a=contacts[i];if(!a.solid||a.parent)continue;
  for(let j=i+1;j<contacts.length;j++){const b=contacts[j];if(!b.solid||b.parent||family(a,b))continue;const hit=overlap(a.shape,b.shape);if(hit>1)issues.push({type:'prop-prop',a:a.id,b:b.id,area:hit});}
 }
 const bridges=world.walkways.map(b=>{const a=b.a,c=b.b,n=Math.max(2,Math.ceil(Math.hypot(c[0]-a[0],c[1]-a[1])/12));let bad=0;for(let i=0;i<=n;i++){const t=i/n;if(!geo.walkable(a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t))bad++;}const reachable=route(a,90)&&route(c,90);if(bad||!reachable)issues.push({type:'bridge-access',id:b.id??b.name??world.walkways.indexOf(b),bad,reachable});return {id:b.id??b.name??world.walkways.indexOf(b),a,c,samples:n+1,bad,reachable};});
 const pathEnds=[];
 for(const line of plan.links)for(const [end,p]of [['start',line.points[0]],['end',line.points.at(-1)]]){
  const connected=route(p,140),onFloor=filled(p,paintedFloor)||lockedLand.some(r=>inside(p,r))||world.walkways.some(b=>dist(p,b.a,b.b)<b.w/2+35);
  const nearLine=plan.links.find(l=>l!==line&&l.points.slice(1).some((q,i)=>dist(p,l.points[i],q)<Math.max(100,l.width))),nearContact=contacts.find(s=>s.shape.isPointInPath(...p)),nearCourt=plan.paths.find(c=>new Path2D(ring(c.poly)).isPointInPath(...p)||c.poly.some((q,i)=>dist(p,q,c.poly[(i+1)%c.poly.length])<line.width/2+5));
  let goal=nearLine?'joined path':nearCourt?'hamlet circulation':nearContact?'building approach':ground.roads.some(r=>r.points.slice(1).some((q,i)=>dist(p,r.points[i],q)<200))?'island main route':line.kind==='jetty'?'jetty landing':null;
  if(line.kind==='bridge')goal='arched bridge landing';if(line.kind==='door')goal='building doorway';if(lockedLand.some(r=>inside(p,r)))goal='preserved centre garden or beach';
  const record={path:line.id,end,point:p,connected,onFloor,goal};pathEnds.push(record);if(!connected||!goal||!onFloor)issues.push({type:'path-end',...record});
 }
 // Read the original centre approaches as well as the replaced outer routes.
 for(const [kind,lines]of [['centre',world.paths.map((points,id)=>({id:'centre-'+id,points}))],['main',ground.roads]])for(const l of lines)for(const [end,point]of [['start',l.points[0]],['end',l.points.at(-1)]]){const accessible=route(point,170);pathEnds.push({path:l.id,end,point,connected:accessible,goal:kind==='centre'?'preserved centre approach':'connected island route'});if(!accessible)issues.push({type:'path-end-access',path:l.id,end,point});}
 // Every building door must have a reachable approach. Its own wall remains a blocker.
 for(const p of art.props.filter(p=>p.kind==='building'&&p.hamlet)){const point=[p.x,p.y+50],accessible=route(point,140);pathEnds.push({path:p.id+'-door',point,connected:accessible,goal:'building doorway'});if(!accessible)issues.push({type:'path-end-access',path:p.id,point});}
 // Every edge of a blueprint lane exposed at the image boundary must reach a
 // connected access link, rather than silently ending at the old crop edge.
 for(const [h,s]of Object.entries(plan.sites))for(const path of read('scripts/pagepond-hamlets/layouts/'+h+'.json').paths){
  for(const [axis,limit]of [[0,0],[0,1536],[1,0],[1,1024]]){const edge=path.polygon.filter(p=>Math.abs(p[axis]-limit)<2);if(!edge.length)continue;const bp=edge.reduce((a,b)=>a.map((v,i)=>v+b[i]/edge.length),[0,0]);let p=(plan.revision===2?spread(h,bp.map((v,i)=>s.at[i]+v*s.k)):bp.map((v,i)=>s.at[i]+v*s.k));const trim=plan.entranceChecks?.filter(e=>e.hamlet===h&&e.source===path.id).sort((a,b)=>Math.hypot(a.requested[0]-p[0],a.requested[1]-p[1])-Math.hypot(b.requested[0]-p[0],b.requested[1]-p[1]))[0];if(trim)p=trim.point;const linked=plan.links.some(l=>l.points.slice(1).some((q,i)=>dist(p,l.points[i],q)<120)),accessible=route(p,140);pathEnds.push({path:h+'-'+path.id,point:p,goal:linked?'joined entrance':null,connected:accessible});if(!linked||!accessible)issues.push({type:'blueprint-path-end',hamlet:h,path:path.id,point:p,linked,accessible});}
 }
 const sleepers=(checked.sleepers??[]).map(b=>{
  const s=ell(b.x,b.y-6,b.r*.9,Math.min(34,Math.max(22,b.r*.42))),newBed=plan.sleepers.find(p=>Math.hypot(p.x-b.x,p.y-b.y)<3),pathOverlap=pathRings(s).some(r=>intersects(r,paintedFloor))?2:0,trunk=contacts.find(t=>t.tree&&overlap(s,t.shape)>1),prop=contacts.find(t=>t.solid&&!t.parent&&!t.tree&&overlap(s,t.shape)>1),accessible=route([b.x,b.y+95],140);
  if(pathOverlap>1)issues.push({type:'sleeper-path',...b,area:pathOverlap});if(trunk)issues.push({type:'sleeper-trunk',...b,id:trunk.id});if(prop)issues.push({type:'sleeper-prop',...b,id:prop.id});if(!accessible)issues.push({type:'sleeper-access',...b});return {pose:b.pose,x:b.x,y:b.y,new:Boolean(newBed),pathOverlap,trunk:trunk?.id,prop:prop?.id,accessible};
 });
 if(!checked.ready)issues.push(...checked.problems.map(p=>({type:'theme-contract',problem:p})));
 const boats=art.props.filter(p=>p.hamlet==='paperboat'&&p.kind==='boat').map(p=>{const water=!map.landAt(p.x,p.y);if(!water)issues.push({type:'paperboat-land',id:p.id});return {id:p.id,x:p.x,y:p.y,water};});
 return {overlaps:issues.filter(i=>/prop-path|prop-prop|prop-bridge|prop-water|sleeper-path|sleeper-trunk|sleeper-prop|paperboat-land/.test(i.type)).length,walkIssues:issues.filter(i=>/access|path-end|theme-contract/.test(i.type)).length,checked:{props:propChecks.length,bridges:bridges.length,pathEnds:pathEnds.length,sleepers:sleepers.length,boats:boats.length},issues,props:propChecks,bridges,pathEnds,sleepers,boats,skipped:plan.skipped};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const result=auditPagepond();fs.writeFileSync('scripts/pagepond-hamlets/walk-audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({overlaps:result.overlaps,walkIssues:result.walkIssues,checked:result.checked,issues:result.issues},null,2));if(result.issues.length)process.exitCode=1;}
