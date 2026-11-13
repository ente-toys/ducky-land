import fs from 'node:fs';
import {createCanvas} from '@napi-rs/canvas';
import {fileURLToPath} from 'node:url';
import {Path2D,PathOp,ring,stroke,curve,dist,contours} from '../pagepond/geometry.mjs';
import {checkTheme} from '../theme-index.mjs';
import {makeMap} from '../../src/world/island-maps.js';
import {canSail} from '../../src/gameplay/islands.js';
import {geometry} from '../../assets/world/island-geometry.mjs';
const read=p=>JSON.parse(fs.readFileSync(p)),A='public/pixi-art/themes/community/',D='assets/world/themes/community/',S='scripts/campfire-hamlets/';
const ellipse=(x,y,rx,ry)=>{const p=new Path2D();p.ellipse(x,y,rx,ry,0,0,Math.PI*2);return p;};
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

const hit=(a,b)=>boundsOverlap(a,b)&&pathRings(a).some(r=>intersects(r,pathRings(b)));
function paintedRoutes(plan,world,old){
 const cell=12,W=934,H=700,ox=-1600,oy=-1200,canvas=createCanvas(W,H),ctx=canvas.getContext('2d');
 ctx.scale(1/cell,1/cell);ctx.translate(-ox,-oy);ctx.fillStyle='#fff';ctx.fill(new Path2D(plan.floor));ctx.fill(new Path2D(ring(old.coast)));
 for(const b of world.walkways){ctx.beginPath();ctx.moveTo(...b.a);ctx.lineTo(...b.b);ctx.lineWidth=b.w;ctx.lineCap='round';ctx.strokeStyle='#fff';ctx.stroke();}
 const bytes=ctx.getImageData(0,0,W,H).data,mask=new Uint8Array(W*H),seen=new Uint8Array(W*H);for(let i=0;i<mask.length;i++)mask[i]=bytes[i*4+3]>80?1:0;
 const seed=Math.floor((2970-oy)/cell)*W+Math.floor((4000-ox)/cell),queue=[seed];seen[seed]=1;
 for(let head=0;head<queue.length;head++){const i=queue[head];for(const j of [i-1,i+1,i-W,i+W])if(j>=0&&j<mask.length&&mask[j]&&!seen[j]){seen[j]=1;queue.push(j);}}
 const distance=p=>{let best=Infinity;const x=Math.floor((p[0]-ox)/cell),y=Math.floor((p[1]-oy)/cell);for(let dy=-8;dy<=8;dy++)for(let dx=-8;dx<=8;dx++)if(seen[(y+dy)*W+x+dx])best=Math.min(best,Math.hypot((dx+.5)*cell,(dy+.5)*cell));return best;};
 return {distance,reachableCells:queue.length,paintedCells:mask.reduce((a,b)=>a+b,0),cell};
}
export function auditCampfire(){
 const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),plan=read(S+'placement.json'),checked=checkTheme('community'),map=makeMap('community',{world,walk,harbor:read(D+'harbor.json'),sleepers:checked.sleepers}),nav=map.nav(),geo=geometry(map.baseWalk),issues=[];
 const route=(point,r=140)=>{const q=nav.nearest(...point,r);if(!q)return false;const path=nav.route(map.spawn.x,map.spawn.y,...q);return Boolean(path.length&&Math.hypot(path.at(-1)[0]-q[0],path.at(-1)[1]-q[1])<3||Math.hypot(q[0]-map.spawn.x,q[1]-map.spawn.y)<80);};
 const floor=new Path2D(plan.floor),shapes=plan.shapes.map(s=>({...s,shape:new Path2D(ring(s.poly))}));
 const water=world.water.map(o=>o.poly?new Path2D(ring(o.poly)):ellipse(o.x,o.y,o.rx,o.ry));
 for(const a of shapes.filter(s=>s.solid)){
  if(hit(a.shape,floor))issues.push({type:'prop-path',id:a.id});
  if(water.some(w=>hit(w,a.shape)))issues.push({type:'prop-water',id:a.id});
  for(const b of shapes.filter(b=>b.solid&&b.id>a.id))if(hit(a.shape,b.shape))issues.push({type:'prop-prop',a:a.id,b:b.id});
  for(const c of plan.crossings)if(hit(a.shape,stroke('M'+c.a.join(' ')+'L'+c.b.join(' '),c.w)))issues.push({type:'prop-bridge',id:a.id,bridge:c.id});
 }
 const centreObstacles=read('scripts/bigger-community/baseline/world.json').obstacles.map(o=>o.poly?new Path2D(ring(o.poly)):ellipse(o.x,o.y,o.rx,o.ry));
 for(const s of shapes.filter(s=>s.solid))if(centreObstacles.some(o=>hit(s.shape,o)))issues.push({type:'prop-centre',id:s.id});
 const propChecks=[];
 for(const p of art.props){
  let accessible=Boolean(p.parent)||route([p.x,p.y+65],150),approach;
  if(!accessible)for(const r of [160,240,360,520]){for(let i=0;i<12&&!accessible;i++){const q=[p.x+Math.cos(i*Math.PI/6)*r,p.y+Math.sin(i*Math.PI/6)*r];if(route(q,80)){accessible=true;approach=q;}}if(accessible)break;}
  propChecks.push({id:p.id,accessible,approach});if(!accessible)issues.push({type:'prop-access',id:p.id});
 }
 const bridges=[];
 for(const [i,b]of world.walkways.entries()){
  let bad=0;const n=Math.ceil(Math.hypot(b.a[0]-b.b[0],b.a[1]-b.b[1])/12);
  for(let j=0;j<=n;j++)if(!geo.walkable(b.a[0]+(b.b[0]-b.a[0])*j/n,b.a[1]+(b.b[1]-b.a[1])*j/n))bad++;
  const accessible=route(b.a,110)&&route(b.b,110);bridges.push({id:b.id??i,bad,accessible,samples:n+1,boatPassUnder:b.boatPassUnder??false});
  if(bad||!accessible)issues.push({type:'bridge-access',id:b.id??i,bad,accessible});
 }
 const boats=plan.crossings.map(b=>{const x=(b.a[0]+b.b[0])/2,y=(b.a[1]+b.b[1])/2,pass=canSail(x,y,'isle-250');if(!pass)issues.push({type:'boat-bridge',id:b.id});return {id:b.id,x,y,pass};});
 const pathEnds=[],painted=paintedRoutes(plan,world,read('scripts/bigger-community/baseline/world.json'));
 for(const l of plan.links)for(const [end,p]of [['start',l.points[0]],['end',l.points.at(-1)]]){
  const accessible=route(p,140),other=plan.links.find(k=>k.id!==l.id&&k.points.slice(1).some((b,i)=>dist(p,k.points[i],b)<(k.width+l.width)/2+8)),court=plan.courts.find(c=>new Path2D(c.d).isPointInPath(...p)),door=l.kind==='door'&&end==='start',bridge=plan.crossings.find(b=>dist(p,b.a,b.b)<b.w/2+40),nearBuilding=shapes.find(sh=>sh.kind==='building'&&dist(p,...(()=>{const b=sh.shape.getBounds();return [[b[0],b[3]],[b[2],b[3]]];})())<100),jetty=l.kind==='jetty'&&end==='end',originalPath=read('scripts/bigger-community/baseline/world.json').paths.some(line=>line.slice(1).some((q,i)=>dist(p,line[i],q)<100)),oldCentre=new Path2D(ring(read('scripts/bigger-community/baseline/world.json').coast)).isPointInPath(...p),goal=door||nearBuilding?'building door':jetty?'harbour landing':bridge?'bridge':court?'square':other?'joined lane':originalPath?'original path':oldCentre?'centre approach':null;
  const paintedDistance=painted.distance(p);pathEnds.push({id:l.id,end,point:p,accessible,goal,paintedDistance});if(paintedDistance>90)issues.push({type:'painted-path-end',id:l.id,end,point:p,paintedDistance});if(!accessible||!goal)issues.push({type:'path-end',id:l.id,end,point:p,accessible,goal});
 }
 const original=read('scripts/bigger-community/baseline/world.json');
 for(const [i,line]of original.paths.entries())for(const point of [line[0],line.at(-1)]){const accessible=route(point,150);pathEnds.push({id:'centre-'+i,point,accessible,goal:'preserved centre'});if(!accessible)issues.push({type:'path-end-access',id:'centre-'+i,point});}
 const sleepers=[];
 for(const b of checked.sleepers){const sh=ellipse(b.x,b.y-6,Math.max(40,b.r*.8),30),pathOverlap=hit(sh,floor),trunk=shapes.find(s=>s.kind==='tree'&&s.solid&&hit(sh,s.shape)),prop=shapes.find(s=>s.kind!=='tree'&&s.solid&&hit(sh,s.shape)),accessible=route([b.x,b.y+75],130);sleepers.push({...b,pathOverlap,trunk:trunk?.id,prop:prop?.id,accessible});if(pathOverlap||trunk||prop)issues.push({type:'sleeper-overlap',x:b.x,y:b.y});if(!accessible)issues.push({type:'sleeper-access',x:b.x,y:b.y});}
 if(!checked.ready)issues.push(...checked.problems.map(problem=>({type:'theme-contract',problem})));
 return {paintedRoutes:{cell:painted.cell,reachableCells:painted.reachableCells,paintedCells:painted.paintedCells},checked:{props:propChecks.length,bridges:bridges.length,pathEnds:pathEnds.length,sleepers:sleepers.length,boats:boats.length},overlaps:issues.filter(i=>/prop-path|prop-water|prop-prop|prop-bridge|prop-centre|sleeper-overlap|boat-bridge/.test(i.type)).length,walkIssues:issues.filter(i=>/access|path-end|contract/.test(i.type)).length,issues,props:propChecks,bridges,pathEnds,sleepers,boats,skipped:plan.skipped};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const r=auditCampfire();fs.writeFileSync(S+'walk-audit.json',JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({checked:r.checked,overlaps:r.overlaps,walkIssues:r.walkIssues,issues:r.issues},null,2));if(r.issues.length)process.exitCode=1;}
