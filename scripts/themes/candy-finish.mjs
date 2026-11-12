import {readFileSync,writeFileSync} from 'node:fs';
import {geometry} from '../../assets/world/island-geometry.mjs';
import {resolveSleepSpots,sleepHalfWidths} from '../../src/pixi/sleep-spots.js';
import {makeMap} from '../../src/pixi/island-maps.js';
const A='public/pixi-art/themes/candy/',D='assets/world/themes/candy/';
const read=p=>JSON.parse(readFileSync(p,'utf8')),write=(p,d)=>writeFileSync(p,JSON.stringify(d,null,1)+'\n');
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),harbor=read(D+'harbor.json'),centre=read(A+'centre/centre.json');
let props=read(D+'placements.json').filter(p=>!p.id.startsWith('candy-centre-'));
const inPoly=(x,y,p)=>{let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i][1]>y)!==(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])c=!c;return c};
const open=Object.entries(world.zones).filter(([id])=>/^(activity|stalls)-/.test(id));
const removed=[];
props=props.filter(p=>{const frontage=p.y>3100&&p.y<3240&&Math.abs(p.x-3570)<500&&['candy-arch','stall-yellow','stall-mint'].includes(p.asset);const centreIntrusion=((p.x-centre.placement.x)/700)**2+((p.y-centre.placement.y)/420)**2<1;const hit=frontage||centreIntrusion||p.asset==='centre-placeholder'||open.some(([,z])=>z.poly?inPoly(p.x,p.y,z.poly):((p.x-z.x)/z.rx)**2+((p.y-z.y)/z.ry)**2<1);if(hit)removed.push(p.id);return !hit});
const obstacles=[];
for(const p of props){
 if(p.footprint){obstacles.push(p.footprint);continue;}
 const k=/^tree-/.test(p.asset)?'tree':/^bush-/.test(p.asset)?'bush':/^flower-/.test(p.asset)?'flower':p.asset,w=p.width*p.scale,h=p.height*p.scale;
 const f=({cupcake:'hall','bridge-front':'none','candy-arch':'arch',bunting:'arch','lollipop-tree':'pole','candy-lamp':'pole',bouquets:'pole','towel-striped':'none','towel-sun':'none','picnic-blanket':'none','lily-pad-flower':'none','lily-pad-large':'none','shell-scallop':'none','starfish-orange':'none','beach-ball':'low',reeds:'none',cattails:'none',flower:'none','umbrella-garden':'pole','umbrella-cafe':'pole'})[k]??(k==='tree'?'trunk':k==='bush'?'bush':'base');
 if(f==='trunk')obstacles.push({x:p.x,y:p.y-9,rx:31,ry:22});
 if(f==='bush')obstacles.push({x:p.x,y:p.y-14,rx:w*.36,ry:Math.min(30,h*.25)});
 if(f==='base')obstacles.push({x:p.x,y:p.y-Math.min(w,300)*.14,rx:w*.42,ry:Math.min(w,300)*.17});
 if(f==='low')obstacles.push({x:p.x,y:p.y-h*.3,rx:w*.4,ry:h*.28});
 if(f==='pole')obstacles.push({x:p.x,y:p.y-8,rx:18,ry:12});
 if(f==='arch')for(const sign of [-1,1])obstacles.push({x:p.x+sign*w*.37,y:p.y-12,rx:Math.max(22,w*.08),ry:18});
 if(f==='hall'){const L=p.x-w*.44,R=p.x+w*.44,top=p.y-h*.3,base=p.y-h*.1;obstacles.push({poly:[[L,top],[R,top],[R,base],[p.x+w*.14,base],[p.x+w*.14,p.y-h*.06],[p.x-w*.14,p.y-h*.06],[p.x-w*.14,base],[L,base]]})}
}
const {x:cx,y:cy}=centre.placement;
art.flats=art.flats.filter(p=>!p.src.startsWith('centre/'));
for(const p of centre.pieces){
 if(['decal','back'].includes(p.layer)){art.flats.push({src:'centre/'+p.file,x:cx+p.x,y:cy+p.y,width:p.width,height:p.height,topLeft:true});continue;}
 const sy=p.sortY??p.y+p.height;
 props.push({id:'candy-centre-'+p.id,name:'Ice cream fountain '+p.id,asset:p.id,src:'centre/'+p.file,x:cx+p.x+p.width/2,y:cy+sy,width:p.width,height:p.height,anchor:{x:.5,y:(sy-p.y)/p.height},scale:1,flip:false,shadow:false,zone:'centre',...(p.animate?{animate:p.animate}:{})});
}
for(const b of centre.blocked)obstacles.push(b.poly?{poly:b.poly.map(([x,y])=>[cx+x,cy+y])}:{...b.ellipse,x:cx+b.ellipse.x,y:cy+b.ellipse.y});
walk.obstacles=obstacles;
world.zones.centre={name:centre.name,x:cx,y:cy,rx:680,ry:405,landmark:'candy-centre-cone',centre:'centre/centre.json',spawn:[cx,cy+450]};
world.zones.plaza={x:cx,y:cy+450,spawn:[cx,cy+450]};harbor.spawn=[cx,cy+450];
world.sleepAvoid=world.sleepAvoid.filter(z=>z.name!=='ice cream fountain');world.sleepAvoid.push({name:'ice cream fountain',x:cx,y:cy,rx:820,ry:515});
art.props=props.map(({asset,zone,...p})=>p);
const counts={nod:7,hammock:3,rock:4,leaf:6,book:6,chair:2,wing:7,box:5};
const base=makeMap('candy',{world,walk,harbor,sleepers:[]}).walk,geo=geometry(base),sizes=sleepHalfWidths();
const options=spots=>({spots,avoid:world.sleepAvoid,warn:false});
let beds=resolveSleepSpots(base,art.props,geo.walkable,sizes,options(world.sleepSpots));
const spots=Object.fromEntries(Object.keys(counts).map(k=>[k,[]]));
const companionDistance=b=>Math.min(...props.filter(p=>/tree|bush|bench|rock|stall|ticket|flower|umbrella|towel|planter/i.test(p.name)).map(p=>Math.hypot(p.x-b.x,p.y-b.y)));
for(const b of beds)if((b.pose==='nod'||companionDistance(b)<360)&&spots[b.pose].length<counts[b.pose])spots[b.pose].push(b.tree?[b.tree,0,b.flip]:[b.x,b.y,b.flip]);
let seed=40426;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
for(const [pose,n]of Object.entries(counts)){
 const candidates=props.filter(p=>pose==='nod'?p.name==='Tree':pose==='chair'?/umbrella|towel|beach|shell|bench|pond/i.test(p.name):pose==='book'||pose==='box'?/stall|ticket|bench|cupcake|tree/i.test(p.name):/tree|bush|flowers|planter/i.test(p.name));
 for(let i=0;spots[pose].length<n&&i<6000;i++){
  const near=candidates[Math.floor(rnd()*candidates.length)];if(!near)break;
  const a=rnd()*Math.PI*2,r=160+rnd()*150;
  const s=pose==='nod'?[near.id,0,rnd()<.5]:[Math.round(near.x+Math.cos(a)*r),Math.round(near.y+Math.sin(a)*r),rnd()<.5];
  const trial={...spots,[pose]:[...spots[pose],s]};
  const valid=resolveSleepSpots(base,art.props,geo.walkable,sizes,options(trial));
  if(valid.length===Object.values(trial).reduce((a,v)=>a+v.length,0)&&valid.every(b=>b.pose==='nod'||companionDistance(b)<370))spots[pose].push(s);
 }
 if(spots[pose].length!==n)throw Error('Could not place '+pose+' '+spots[pose].length+'/'+n);
}
world.sleepSpots=spots;
beds=resolveSleepSpots(base,art.props,geo.walkable,sizes,options(spots));
if(beds.length!==40)throw Error('Expected 40 valid sleepers, got '+beds.length);
world.props=props.map(p=>({name:p.name,x:p.x,y:p.y,zone:p.zone}));
write(A+'art.json',art);write(D+'world.json',world);write(D+'walk-world.json',walk);write(D+'harbor.json',harbor);write(D+'placements.json',props);
write(D+'sleepers-resolved.json',beds);
const area=Math.abs(world.coast.reduce((s,a,i)=>{const b=world.coast[(i+1)%world.coast.length];return s+a[0]*b[1]-b[0]*a[1]},0)/2);
write(A+'candy-metrics.json',{width:world.width,height:world.height,coastArea:Math.round(area),homeRatio:area/11090000,props:props.length,sleepers:beds.length,sleepCounts:counts,activities:open.filter(([n])=>n.startsWith('activity')).length,stallRows:open.filter(([n])=>n.startsWith('stalls')).length,removedObstructingProps:removed,centrePieces:centre.pieces.length});
console.log('Candy finished:',beds.length,'sleepers,',props.length,'props; cleared',removed.length,'placeholder/open-area props');
