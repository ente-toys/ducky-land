import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {Path2D,PathOp,even,ring,curve,stroke,union,contours,simplifyRing} from '../pagepond/geometry.mjs';
import {sites,replacedSeats,attached} from './design.mjs';
import {lane} from './floor.mjs';
import {resolveSleepSpots,sleepHalfWidths} from '../../src/pixi/sleep-spots.js';
import {geometry} from '../../rive/web/island-geometry.mjs';
const A='public/pixi-art/themes/library/',D='rive/web/themes/library/',OUT='scripts/pagepond-hamlets/';
const read=p=>JSON.parse(fs.readFileSync(p)),write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
// Rebuild only the authorised outer terrain baseline. This makes this entry point idempotent.
execFileSync(process.execPath,['scripts/pagepond/build.mjs'],{stdio:'inherit'});
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),ground=read('scripts/pagepond/layout.json'),old=read('scripts/bigger-library/original/world.json');
const layouts={},props=[],shapes=[],paths=[],rests=[],decks=[],changes=[],skipped=[],links=[];
const rect=(x,y,w,h)=>new Path2D(`M${x} ${y}h${w}v${h}h${-w}Z`);
const ellipse=(x,y,rx,ry)=>{const p=new Path2D();p.ellipse(x,y,rx,ry,0,0,Math.PI*2);return p;};
const area=p=>contours(p.toSVGString(),5).reduce((v,r)=>v+Math.abs(r.reduce((a,q,i)=>a+q[0]*r[(i+1)%r.length][1]-q[1]*r[(i+1)%r.length][0],0)/2),0);
for(const p of art.props.filter(p=>p.zone==='outer-grove')){const o=world.obstacles.find(o=>o.name===p.id),poly=contours(ellipse(o?.x??p.x,o?.y??p.y-8,o?.rx??p.width*p.scale*.25,o?.ry??p.width*p.scale*.07).toSVGString(),6)[0];p.footprint={poly};shapes.push({id:p.id,poly,solid:true,tree:/tree/.test(p.src),existing:true});}
const mask=union(Object.values(sites).map(s=>rect(s.at[0]-110,s.at[1]-160,1536*s.k+220,1024*s.k+270)));
let dry=even(new Path2D(ground.dry)),floor=even(new Path2D(ground.floor)).op(mask,PathOp.Difference);
// Retire the old diagonals in full, including their exposed crop-edge stubs.
const retired=[[[1250,-80],[-100,330],[-650,900],[-980,1700]],[[6500,-150],[7400,170],[8500,1050],[9000,2300]],[[-950,4020],[-500,5350],[650,5950]],[[8500,5500],[7700,6030],[6600,6750]],[[-650,900],[-350,1500]]];
for(const line of retired)floor=floor.op(stroke(curve(line),210),PathOp.Difference);
// Main routes bend outside each composed village; the authored entrances join them below.
for(const [h,s]of Object.entries(sites))for(const [i,line]of s.bypass.entries()){floor=floor.op(stroke(curve(line),160),PathOp.Union);links.push({id:h+'-main-'+i,points:line,width:160,kind:'main-bypass'});}
for(const [h,s]of Object.entries(sites)){
 const d=read(OUT+'layouts/'+h+'.json');layouts[h]=d;
 const pos=([x,y])=>[s.at[0]+x*s.k,s.at[1]+y*s.k];
 const fp=new Map(d.footprints.map(p=>[p.id,p.polygon]));
 const factors=new Map(),orig=new Map(d.objects.map(p=>[p.id,p]));
 for(const [id,children]of Object.entries(s.shrink)){const p=orig.get(id),f=s.cap/p.width;for(const name of [id,...children])factors.set(name,{f,centre:[p.x,p.y]});}
 for(const obj of d.objects){
  if(replacedSeats[h]?.includes(obj.id)){skipped.push({hamlet:h,id:obj.id,reason:'replaced by approved in-game sleep furniture at this blueprint rest spot'});continue;}
  const category=obj.kind??obj.type,scaled=factors.get(obj.id),local=q=>scaled?q.map((v,i)=>scaled.centre[i]+(v-scaled.centre[i])*scaled.f):q;
  const xy=pos(local([obj.x,obj.y])),f=scaled?.f??1;
  let src=`hamlets/${h}/${obj.file}`;
  // All wooded plants use the actual original island drawings, including undergrowth.
  if(/^(?:low-bush|bush-|daisy-bush)/.test(obj.id))src='reuse/bush-1.svg';
  let poly=fp.get(obj.id)??obj.footprint;
  if(poly?.length)poly=poly.map(q=>pos(local(q)));
  const soft=/grass|tuft|flower|pebble|stone|shell|rug/.test(obj.id)||category==='flora'||category==='plant'||category==='stone';
  const overhead=/pergola|lantern-[123]|garland|rope/.test(obj.id);
  const boat=category==='boat',dock=category==='dock';
  const p={id:`hamlet-${h}-${obj.id}`,name:obj.id,src,x:xy[0],y:xy[1],width:obj.width*s.k*f,height:obj.height*s.k*f,anchor:{x:.5,y:1},scale:1,z:s.at[1]+(obj.drawOrder??obj.y)*s.k,shadow:!soft&&!boat&&!overhead,zone:'bigger-'+h,hamlet:h,blueprintId:obj.id,kind:category,parent:attached[h]?.[obj.id]?`hamlet-${h}-${attached[h][obj.id]}`:undefined,blueprint:[obj.x,obj.y]};
  if(!poly?.length){const rx=Math.max(5,p.width*(soft?.23:.22)),ry=Math.max(4,Math.min(18,p.width*.07));poly=contours(ellipse(p.x,p.y-6,rx,ry).toSVGString(),6)[0];}
  // The pergola is walk-through. Its timber touches the ground at its two front posts only.
  if(/pergola/.test(obj.id)){poly=[[p.x-p.width*.46,p.y-18],[p.x-p.width*.40,p.y-18],[p.x-p.width*.40,p.y],[p.x-p.width*.46,p.y]];const right=poly.map(([x,y])=>[x+p.width*.86,y]);shapes.push({id:p.id+'-east-post',poly:right,parent:p.id,hamlet:h,solid:true});}
  if(soft||overhead){p.contact=false;}
  if(overhead&&!/pergola/.test(obj.id)){p.shadow=false;p.contact=false;}
  else {p.footprint={poly};shapes.push({id:p.id,poly,parent:p.parent,hamlet:h,soft,solid:!soft&&!boat&&!dock,dock,boat});}
  if(dock){decks.push({id:p.id,src,x:p.x-p.width/2,y:p.y-p.height,width:p.width,height:p.height});p.deck=true;p.shadow=false;}
  else props.push(p);
 }
 for(const t of d.trees){
  let src=t.asset.replace(/^.*(?:themes\/library\/|pixi-art\/plants\/)/,'');if(!src.startsWith('reuse/'))src='reuse/'+src;
  const [x,y]=pos([t.x,t.y]),width=t.width*s.k,height=t.height*s.k,id=`hamlet-${h}-${t.id}`;
  const isBush=/bush/.test(src),poly=contours(ellipse(x,y-8,width*(isBush?.28:.105),Math.max(9,width*.045)).toSVGString(),6)[0];
  props.push({id,name:t.id,src,x,y,width,height,scale:1,anchor:{x:.5,y:1},shadow:true,zone:'bigger-'+h,hamlet:h,blueprintId:t.id,kind:isBush?'bush':'tree',footprint:{poly},blueprint:[t.x,t.y]});
  shapes.push({id,poly,hamlet:h,solid:true,tree:!isBush});
 }
 for(const p of d.paths){const shape=p.d?new Path2D(p.d).transform({a:s.k,b:0,c:0,d:s.k,e:s.at[0],f:s.at[1]}):new Path2D(ring(p.polygon.map(pos)));floor=floor.op(shape,PathOp.Union);paths.push({id:h+'-'+p.id,hamlet:h,poly:contours(shape.toSVGString()).flat(),source:p.id});}
 for(const [i,b]of d.sleepers.entries()){
  const [x,y]=pos([b.x,b.y]);if(s.rest.includes(i))rests.push({hamlet:h,index:i,x,y,blueprint:[b.x,b.y]});else skipped.push({hamlet:h,id:'sleep-'+i,reason:'blueprint rests closer than the game spacing or already occupied by furniture'});
 }
}
// Paperboat's blueprint coast is an open southern inlet, never an opaque water rectangle.
{
 const s=sites.paperboat,d=layouts.paperboat,pos=q=>q.map((v,i)=>s.at[i]+v*s.k);
 const shore=d.ground.coastline.map(pos);
 const apron=[[7440,5750],[9660,5750],[9740,6250],[9600,6800],[9100,7040],[8500,7040],[7900,6900],[7470,6650]];
 dry=dry.op(new Path2D(ring(apron)).round(180),PathOp.Union);
 const extended=[[6900,7400],[7200,7000],[7450,6750],...shore,[9700,6630],[10100,6300],[11000,6000]];
 const cut=curve(extended)+'L11000 8400L6600 8400Z';
 const waterCut=new Path2D(cut);dry=dry.op(waterCut,PathOp.Difference);
 const poly=contours(waterCut.toSVGString()).map(p=>simplifyRing(p,2));
 for(const [i,p]of poly.entries()){world.water.push({name:'paperboat-open-shore-'+i,poly:p});world.boatWater.push(p);}
 ground.paperboatShore=shore;ground.shoreApron=apron;ground.shoreCut=cut;
}
console.log('Mapped four kits',props.length);
// Independently placed props cannot share ground. Decorations attached to a
// building/table keep their parent contact; their separate SVG is only paint.
const byId=new Map(props.map(p=>[p.id,p]));
function family(a,b){return a.parent===b.id||b.parent===a.id||a.parent&&a.parent===b.parent;}
function move(shape,dx,dy){shape.poly=shape.poly.map(([x,y])=>[x+dx,y+dy]);const p=byId.get(shape.id);if(p){p.x+=dx;p.y+=dy;if(Number.isFinite(p.z))p.z+=dy;p.footprint={poly:shape.poly};}}
const fixed=shapes.filter(s=>s.existing||s.solid&&byId.get(s.id)?.kind==='building');
const contacts=[...fixed];
const baseWet=union(world.water.filter(w=>w.poly).map(w=>new Path2D(ring(w.poly))));
for(const sh of shapes.filter(s=>!fixed.includes(s)&&!s.boat&&!s.dock)){
 if(!sh.solid){contacts.push(sh);continue;}
 const p=byId.get(sh.id),base=new Path2D(ring(sh.poly));
 const restConflict=shape=>{if(!p||p.contact===false||p.parent)return false;const bounds=shape.getBounds(),original=new Path2D(ring(sh.poly)).getBounds(),dx=bounds[0]-original[0],dy=bounds[1]-original[1],x=p.x+dx,y=p.y+dy;return rests.some(b=>Math.hypot(b.x-x,(b.y-y)*1.6)<p.width*.4+84||(y>b.y-20&&y-b.y<p.height*.9&&Math.abs(b.x-x)<p.width/2+43));};
 const collides=shape=>restConflict(shape)||contacts.some(b=>!family(sh,b)&&b.solid&&(()=>{const a=shape.getBounds(),c=new Path2D(ring(b.poly)).getBounds();return a[0]<c[2]&&a[2]>c[0]&&a[1]<c[3]&&a[3]>c[1]&&area(new Path2D(shape).op(new Path2D(ring(b.poly)),PathOp.Intersect))>1;})())||area(new Path2D(shape).op(baseWet,PathOp.Intersect))>1;
 if(collides(base)&&!sh.parent){let placed=false;for(let radius=16;radius<=240&&!placed;radius+=16)for(let n=0;n<16&&!placed;n++){const a=n*Math.PI/8,dx=Math.cos(a)*radius,dy=Math.sin(a)*radius,test=new Path2D(base).transform({a:1,b:0,c:0,d:1,e:dx,f:dy});if(!collides(test)&&dry.isPointInPath((p?.x??sh.poly[0][0])+dx,(p?.y??sh.poly[0][1])+dy)){move(sh,dx,dy);changes.push({id:sh.id,dx,dy,reason:'separate ground contacts'});placed=true;}}}
 contacts.push(sh);
}
console.log('Separated contacts',changes.length);
// Reserve safe grass pockets at the approved rest points. The game keeps exactly
// forty residents: only these selected spots replace existing centre residents.
const sleepSizes=sleepHalfWidths(),restShapes=rests.map(b=>ellipse(b.x,b.y-6,95,57));
const solid=union(shapes.filter(s=>s.solid&&!s.parent).map(s=>new Path2D(ring(s.poly))));
console.log('Solid union done');
const blockedParts=[solid,...shapes.filter(s=>s.solid&&!s.parent).map(s=>stroke(ring(s.poly),60)),...restShapes.map(p=>union([p,stroke(p.toSVGString(),55)]))];
const blocked={isPointInPath:(x,y)=>blockedParts.some(p=>p.isPointInPath(x,y))};
console.log('Routing clearance ready');
// Short, constrained access links. A grid search only routes each explicitly
// authored entrance, it never chooses or scatters the composition's prop sites.
function route(a,b){
 const C=25,x0=Math.floor((Math.min(a[0],b[0])-650)/C)*C,y0=Math.floor((Math.min(a[1],b[1])-650)/C)*C,x1=Math.max(a[0],b[0])+650,y1=Math.max(a[1],b[1])+650,N=Math.ceil((x1-x0)/C),M=Math.ceil((y1-y0)/C),key=([x,y])=>Math.round((y-y0)/C)*N+Math.round((x-x0)/C),xy=i=>[x0+(i%N)*C,y0+Math.floor(i/N)*C],start=key(a),end=key(b),open=[start],g=new Map([[start,0]]),prev=new Map(),closed=new Set();
 let count=0;
 while(open.length&&count++<45000){let bi=0,best=Infinity;for(let i=0;i<open.length;i++){const k=open[i],p=xy(k),score=g.get(k)+Math.hypot(p[0]-b[0],p[1]-b[1]);if(score<best){best=score;bi=i;}}const cur=open.splice(bi,1)[0];if(closed.has(cur))continue;if(cur===end){const result=[b];let t=cur;while(t!==start){result.push(xy(t));t=prev.get(t);}result.push(a);return result.reverse();}closed.add(cur);const [x,y]=xy(cur);
 for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const c=cur%N+dx,r=Math.floor(cur/N)+dy;if(c<0||r<0||c>=N||r>=M)continue;const next=r*N+c;if(closed.has(next))continue;const p=xy(next);if(next!==end&&next!==start&&(!dry.isPointInPath(...p)||blocked.isPointInPath(...p)||!dry.isPointInPath(p[0]+40,p[1])||!dry.isPointInPath(p[0]-40,p[1])||baseWet.isPointInPath(...p)))continue;const ng=g.get(cur)+Math.hypot(dx,dy)*C*(floor.isPointInPath(...p)?.75:1);if(ng<(g.get(next)??Infinity)){g.set(next,ng);prev.set(next,cur);open.push(next);}}
 }
 throw Error('No safe entrance route '+JSON.stringify({a,b}));
}
for(const [h,s]of Object.entries(sites))for(const [i,link]of s.links.entries()){
 console.log('Routing',h,i);
 let points=[link.from.map((v,j)=>s.at[j]+v*s.k),...link.via],line=[];for(let j=1;j<points.length;j++){const part=route(points[j-1],points[j]);line.push(...(j===1?part:part.slice(1)));}
  const d='M'+line.map(p=>p.join(' ')).join('L');floor=floor.op(lane(line,75),PathOp.Union);links.push({id:h+'-entrance-'+i,points:line,width:75,kind:'entrance'});
}
console.log('All entrance routes finished');
write('/tmp/pagepond-route-stage.json',{props,shapes,paths,rests,decks,changes,skipped,links,dry:dry.toSVGString(),floor:floor.toSVGString(),world,walk,art,ground});
execFileSync(process.execPath,['scripts/pagepond-hamlets/finish.mjs'],{stdio:'inherit'});
