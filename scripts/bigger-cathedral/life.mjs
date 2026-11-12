// Repeatable Bellovo nature/life patch. Reads CURRENT package outputs so it can
// run last after the path/centre/village lanes without restoring their snapshots.
import fs from 'node:fs';
import {GROVE_ADDITIONS,BENCHES,LAWN_BEDS} from './life-data.mjs';
import {LEFT,RIGHT} from './centre-art-data.mjs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {resolveSleepSpots,sleepHalfWidths,sleeperFootprint} from '../../src/pixi/sleep-spots.js';
import {geometry,inShape} from '../../assets/world/island-geometry.mjs';
const A='public/pixi-art/themes/cathedral/',D='assets/world/themes/cathedral/';
const read=p=>JSON.parse(fs.readFileSync(p)),save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),harbor=read(D+'harbor.json');
fs.mkdirSync(A+'autumn',{recursive:true});
const palettes={amber:['#D99332','#A55F32','#EFBD53'],rust:['#C9693B','#984B32','#E5954B'],mustard:['#C6AA39','#928538','#E5CB61'],green:['#81A545','#527B3B','#B4C662']};
const sizes={1:[260,360],2:[180,360],3:[300,380],4:[200,280],5:[150,380],b1:[130,100],b2:[168,110],b3:[116,104],b4:[140,100]};
for(const [tone,colors] of Object.entries(palettes))for(const kind of ['tree','bush'])for(let n=1;n<=(kind==='tree'?5:4);n++){
 let svg=fs.readFileSync(`public/pixi-art/plants/${kind}-${n}.svg`,'utf8');
 const [w,h]=sizes[(kind==='tree'?'':'b')+n];
 svg=svg.replace(/<svg\b/,'<svg width="'+w+'" height="'+h+'" data-home-source="'+kind+'-'+n+'"');
 const changes={'#4AA539':colors[0],'#2B7A37':colors[1],'#89C332':colors[2]};
 svg=svg.replace(/#(?:4AA539|2B7A37|89C332)/gi,v=>changes[v.toUpperCase()]);
 fs.writeFileSync(A+`autumn/${kind}-${n}-${tone}.svg`,svg);
}
// Four clear, phone-readable leaf silhouettes. Intrinsic world size increases,
// while the existing 3.625x decode and <=.96 sprite scale retain 2x DPR density.
const outlines=[
 'M3 14Q2 4 15 4L29 2Q29 15 17 20Q8 24 3 14Z',
 'M3 14L7 10L4 5L12 7L16 2L19 7L27 4L26 11L31 14L24 17L24 21L17 20L12 23L9 18Z',
 'M3 15Q9 2 28 4Q30 17 15 21Q7 22 3 15Z',
 'M3 13Q5 3 17 3L30 3Q28 17 16 21Q6 23 3 13Z'
];
for(const [i,[tone,[fill]]]of Object.entries(palettes).entries())fs.writeFileSync(A+`autumn/leaf-${tone}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="34" height="26" viewBox="0 0 34 26"><path d="${outlines[i]}" fill="${fill}" stroke="#39472d" stroke-width="1.7" stroke-linejoin="round"/><path d="M2 24L24 8M12 16L11 10M17 13L24 14" fill="none" stroke="#39472d" stroke-width="1.15" stroke-linecap="round"/></svg>`);
const leaf=(x,y,fill)=>`<path d="M${x-7} ${y}q3 -5 10 -3l5 3q-4 5 -10 3Z" fill="${fill}" stroke="#39472d" stroke-width=".65"/><path d="M${x-7} ${y+1}l12 -2" stroke="#39472d" stroke-width=".5"/>`;
fs.writeFileSync(A+'autumn/litter.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="130" viewBox="0 0 300 130">${[[27,49],[61,87],[99,36],[141,91],[176,50],[214,99],[259,64],[282,39]].map(([x,y],i)=>leaf(x,y,Object.values(palettes)[i%3][0])).join('')}</svg>`);
// Bench drawings are verbatim Home assets. Side views crop the empty margins
// with a viewBox, preserving source geometry, ink weight and upright legs.
for(const [view,file]of Object.entries({south:'',north:'-back',west:'-left',east:'-right'})){
 let svg=fs.readFileSync(`public/pixi-art/detail/street--bench-wood${file}.svg`,'utf8');
 if(view==='west'||view==='east')svg=svg.replace('width="818" height="463" viewBox="0 0 818 463"','width="295" height="448" viewBox="260 15 295 448"');
 fs.writeFileSync(A+`autumn/bench-${view}.svg`,svg);
}
const plantType=p=>p.src?.match(/(?:^|\/)(tree-[1-5]|bush-[1-4])(?:-(?:amber|rust|mustard|green))?\.svg$/)?.[1];
const original=read('scripts/bigger-cathedral/life-source/art.json');
// The approved centre and its entrances displace four former beds. Retire
// those authored locations and replace them through the same lawn validator.
const originalSpots=()=>{const spots=structuredClone(read('scripts/bigger-cathedral/life-source/world.json').sleepSpots);spots.book=spots.book.filter(([x,y])=>![[4580,1490],[2990,2860]].some(p=>p[0]===x&&p[1]===y));spots.rock=spots.rock.filter(([x,y])=>x!==5621||y!==2801);spots.box=spots.box.filter(([x,y])=>x!==3020||y!==2200);return spots;};
const originals=new Map(original.props.map(p=>[p.id,p]));
const oldPlants=original.props.filter(plantType),oldBenches=original.props.filter(p=>BENCHES.some(b=>b[0]===p.id));
const ownedIDs=new Set([...oldPlants,...oldBenches].map(p=>p.id));
// Remove only this package's solids and original plant/furniture solids. Legacy
// anonymous tiny trunk solids are associated with the same root coordinates.
for(const m of [world,walk])m.obstacles=m.obstacles.filter(o=>!o.id?.startsWith('life-')&&!ownedIDs.has(o.id)&&!oldPlants.some(p=>!o.poly&&Math.abs(o.x-p.x)<3&&Math.abs(o.y-p.y)<55&&o.rx<=60&&o.ry<=35)&&!oldBenches.some(p=>!o.poly&&Math.abs(o.x-p.x)<8&&Math.abs(o.y-p.y)<55&&o.rx<=100&&o.ry<=25));
art.props=art.props.filter(p=>!p.id?.startsWith('life-')&&!plantType(p));
art.props.push(...structuredClone(oldPlants));
world.sleepSpots=originalSpots();
art.flats=art.flats.filter(p=>!p.id?.startsWith('life-')&&!oldPlants.some(q=>p.id===q.id+'-shadow'));
const map=makeMap('cathedral',{world,walk,harbor,sleepers:[]});
const seg=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);};
export const pathEdge=(x,y)=>Math.min(...world.paths.map((p,i)=>Math.min(...p.slice(1).map((b,j)=>seg(x,y,p[j],b)))-(world.pathWidths?.[i]??128)/2));
const underCentre=(x,y,pad=100)=>[LEFT,RIGHT].some(line=>line.slice(1).some((b,j)=>seg(x,y,line[j],b)<pad));
const dry=(x,y,r=45)=>[[0,0],[r,0],[-r,0],[0,r],[0,-r]].every(([dx,dy])=>map.landAt(x+dx,y+dy)&&!(walk.water??[]).some(w=>inShape(x+dx,y+dy,w)));
const buildings=art.props.filter(p=>!plantType(p)&&!BENCHES.some(b=>b[0]===p.id)&&/house|workshop|cathedral hall|tower|bakery|foundry|shed/i.test(p.name));
const treeIDs=new Set(world.sleepSpots.nod.map(p=>p[0]));
const existingBeds=makeMap('cathedral',{world:{...world,props:original.props},walk,harbor}).sleepers;
const goodRoot=(x,y,bush,id)=>!underCentre(x,y,140)&&dry(x,y,bush?75:65)&&pathEdge(x,y)>(bush?85:62)&&
 !((world.walkways??[]).some(w=>seg(x,y,w.a,w.b)<w.w/2+90))&&
 !(x>3230&&x<5050&&y>700&&y<3620)&&
 !buildings.some(p=>Math.abs(x-p.x)<p.width*(p.scale??1)*.55+70&&y>p.y-p.height*(p.scale??1)*.65&&y<p.y+150)&&
 existingBeds.every(b=>b.tree===id||(Math.hypot(b.x-x,(b.y-y)*1.3)>(bush?190:280)&&!(y>b.y-20&&y-b.y<(bush?110:380)*.9&&Math.abs(x-b.x)<(bush?85:150)+b.r*.6)));
const rejected=[];let index=0;
const toneFor=i=>['amber','mustard','rust','amber','rust','mustard','green'][i%7];
const shadow=p=>({id:'life-'+p.id+'-shadow',name:'Plant contact shadow',src:'villages/plant-shadow.svg',x:p.x-p.width*.22,y:p.y-16,width:p.width*.44,height:24,topLeft:true});
const plants=[];
function plant(p,type,tone){const bush=type.startsWith('bush'),n=+type.at(-1),[width,height]=sizes[(bush?'b':'')+n];return {...p,name:bush?'Home autumn bush':'Home autumn tree',src:`autumn/${type}-${tone}.svg`,width,height,scale:1,anchor:{x:.5,y:1},shadow:false,wind:false,flip:false,rasterDensity:1.05,rasterMargin:16,autumn:{kind:bush?'bush':'tree',tone}};}
art.props=art.props.filter(p=>{
 const type=plantType(p);if(!type)return true;
 const base=originals.get(p.id)??p;
 if(!treeIDs.has(p.id)&&!goodRoot(base.x,base.y,type.startsWith('bush'),p.id)){rejected.push(p.id);return false;}
 Object.assign(p,plant(base,type,toneFor(index++)));plants.push(p);return true;
});
for(const [gi,[name,trees,bushes]]of GROVE_ADDITIONS.entries())for(const [kind,points]of [['tree',trees],['bush',bushes]])for(const [j,[x,y]]of points.entries()){
 const id=`life-${name}-${kind}-${j}`,bush=kind==='bush';
 if(!goodRoot(x,y,bush,id)){rejected.push(id);continue;}
 if(plants.some(p=>Math.hypot(p.x-x,(p.y-y)*1.5)<(bush||p.autumn.kind==='bush'?60:100))){rejected.push(id);continue;}
 const type=kind+'-'+(1+(gi+j)%(bush?4:5)),p=plant({id,x,y,grove:name},type,toneFor(gi*3+j));
 plants.push(p);art.props.push(p);
}
// A grove candidate left alone by merged clearance is omitted, never sprinkled.
for(let i=plants.length-1;i>=0;i--){const p=plants[i];if(p.grove&&p.autumn.kind==='tree'&&!plants.some(q=>q!==p&&q.autumn.kind==='tree'&&Math.hypot(q.x-p.x,q.y-p.y)<500)){plants.splice(i,1);art.props=art.props.filter(q=>q!==p);}}
for(const p of plants){art.flats.push(shadow(p));for(const m of [world,walk])m.obstacles.push({id:p.id,x:p.x,y:p.y-10,rx:p.autumn.kind==='tree'?18:p.width*.3,ry:p.autumn.kind==='tree'?12:14});}
for(const [name,trees]of GROVE_ADDITIONS){
 const p=plants.find(p=>p.grove===name&&p.autumn.kind==='tree');if(!p)continue;
 const x=p.x-90,y=p.y+25;if(!dry(x,y,120)||pathEdge(x,y)<160)continue;
 art.flats.push({id:'life-litter-'+name,name:'Autumn leaf litter',src:'autumn/litter.svg',x,y,width:300,height:130,topLeft:false});
}
for(const [id,x,y,view,target]of BENCHES){
 let p=art.props.find(p=>p.id===id);if(!p){p={id};art.props.push(p);}
 const side=view==='west'||view==='east';
 Object.assign(p,{name:'Home wooden bench '+view,src:`autumn/bench-${view}.svg`,x,y,width:side?88.5:245.4,height:side?134.4:138.9,scale:1,anchor:{x:.5,y:1},shadow:true,shadowSize:side?[40,18]:[102,17],shadowOffset:[0,-3],wind:false,flip:false,sittable:true,bench:{view,target,seat:{x,y:y-15,lift:40,turn:{south:0,north:Math.PI,east:Math.PI/2,west:-Math.PI/2}[view]}}});
 // Only the back rail blocks walking. Seat and front approach remain reachable.
 const dx=view==='east'?-32:view==='west'?32:0,dy=view==='south'?-70:view==='north'?15:-26;
 for(const m of [world,walk])m.obstacles.push({id,x:x+dx,y:y+dy,rx:side?9:99,ry:side?36:8});
}
world.sleepTotal=120;
// The source placements are stable on every rebuild. Preserve all original
// unaffected approved beds, then validate the authored outer-lawn points with the REAL
// resolver. A point that fails is reported, never nudged to an arbitrary grid.
world.sleepSpots=originalSpots();
world.props=art.props;
const base=makeMap('cathedral',{world,walk,harbor,sleepers:[]}).baseWalk;
const resolve=()=>resolveSleepSpots(base,art.props,geometry(base).walkable,sleepHalfWidths(),{spots:world.sleepSpots,avoid:world.sleepAvoid??[],warn:false});
let beds=resolve();
if(beds.bad.length)throw Error('Retained beds lost: '+JSON.stringify(beds.bad));
const bedRejected=[];const choices=['wing','leaf','book','box','rock','hammock','chair'];
for(const [i,[x,y]]of LAWN_BEDS.entries()){
 if(beds.length===120)break;
 if(underCentre(x,y,190)||!dry(x,y,100)||pathEdge(x,y)<115||((x>3050&&x<5150&&y>1700&&y<3590))){bedRejected.push([x,y,'floor/lane/piazza']);continue;}
 let accepted=false;
 for(let j=0;j<choices.length;j++){
  const pose=choices[(i+j)%choices.length];world.sleepSpots[pose].push([x,y,!!(i%2)]);
  const next=resolve(),added=next.find(b=>b.x===x&&b.y===y);
  const footprint=added&&sleeperFootprint(added);
  const offGarden=added&&Math.hypot(x-4100,y-4250)>390+added.r&&art.props.filter(p=>/^b2-parterre/.test(p.id)).every(p=>Math.abs(x-p.x)>p.width/2+added.r||footprint.y+footprint.ry<p.y-p.height||footprint.y-footprint.ry>p.y);
  if(next.length===beds.length+1&&offGarden){beds=next;accepted=true;break;}
  world.sleepSpots[pose].pop();
 }
 if(!accepted)bedRejected.push([x,y,'clearance']);
}
if(beds.length!==120){if(process.argv.includes('--survey'))save('/private/tmp/bellovo-life-survey.json',{art,world,walk,harbor});save('scripts/bigger-cathedral/life-diagnostic.json',{plants:plants.length,trees:plants.filter(p=>p.autumn.kind==='tree').length,bushes:plants.filter(p=>p.autumn.kind==='bush').length,rejected,bedRejected,beds:beds.length,used:world.sleepSpots});throw Error(`Only ${beds.length}/120 valid authored beds; see life-diagnostic.json`);}
art.raster={enabled:true};
art.autumn={leaves:['amber','rust','mustard','green'].map(t=>`autumn/leaf-${t}.svg`),perTree:3,maxSprites:96,mobileMaxSprites:48};
// Warm only known grass material colours, preserving every path and water node.
const warm={'#93b72f':'#a2b542','#9bbd3b':'#aabc50','#93B72F':'#A2B542','#9BBD3B':'#AABC50'};
for(const src of new Set(art.ground.tiles.map(t=>t.src).filter(s=>s.endsWith('.svg')))){
 let svg=fs.readFileSync(A+src,'utf8'),next=svg.replace(/#(?:93b72f|9bbd3b)/gi,v=>warm[v]??warm[v.toLowerCase()]);if(next!==svg)fs.writeFileSync(A+src,next);
}
save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);
const metrics={trees:plants.filter(p=>p.autumn.kind==='tree').length,bushes:plants.filter(p=>p.autumn.kind==='bush').length,groves:new Set(plants.map(p=>p.grove).filter(Boolean)).size,benches:BENCHES.length,sleepers:beds.length,litter:art.flats.filter(p=>p.id?.startsWith('life-litter-')).length,rejected,bedRejected,poses:Object.fromEntries(Object.entries(world.sleepSpots).map(([k,v])=>[k,v.length]))};
save('scripts/bigger-cathedral/life-metrics.json',metrics);
console.log(JSON.stringify({trees:metrics.trees,bushes:metrics.bushes,groves:metrics.groves,benches:metrics.benches,sleepers:metrics.sleepers,litter:metrics.litter}));
