import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {drawArcBench} from '../arc-bench-draw.mjs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {geometry,inShape} from '../../assets/world/island-geometry.mjs';
import {resolveSleepSpots,sleepHalfWidths} from '../../src/pixi/sleep-spots.js';
const A='public/pixi-art/themes/pink/',D='assets/world/themes/pink/';
const read=p=>JSON.parse(readFileSync(p,'utf8')),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,1)+'\n');
const base='scripts/themes/pink-polish-base.json';
if(!existsSync(base)||process.argv.includes('--from-build'))save(base,{art:read(A+'art.json'),world:read(D+'world.json'),walk:read(D+'walk-world.json')});
const {art,world,walk}=read(base),harbor=read(D+'harbor.json');
const baseMap=makeMap('pink',{world,walk,harbor,sleepers:[]});
const beds=resolveSleepSpots(baseMap.baseWalk,art.props,geometry(baseMap.baseWalk).walkable,sleepHalfWidths(),{spots:world.sleepSpots,avoid:world.sleepAvoid,warn:false});
const ink='#39472D',cream='#FFF0C7',pink='#F5A3C7',r=n=>Math.round(n*10)/10;
const seg=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)};
const pathDist=(x,y)=>Math.min(...world.paths.map((p,i)=>Math.min(...p.slice(1).map((b,j)=>seg(x,y,p[j],b)))-(world.pathWidths[i]/2)));
const deckDist=(x,y)=>Math.min(...world.walkways.map(w=>seg(x,y,w.a,w.b)-w.w/2));
const coastDist=(x,y)=>Math.min(...world.coast.map((b,i)=>seg(x,y,world.coast[(i+1)%world.coast.length],b)));
const bedClear=(x,y,w,h=0)=>beds.every(b=>Math.hypot(x-b.x,(y-b.y)*1.3)>w+b.r+45 && !(y>b.y-20 && y-h<b.y+20 && Math.abs(x-b.x)<w+b.r));
const onLand=(x,y)=>inShape(x,y,{poly:world.coast},0);
const clear=(x,y,rad=25,h=0)=>onLand(x,y)&&coastDist(x,y)>rad+25&&pathDist(x,y)>rad+22&&deckDist(x,y)>rad+110&&bedClear(x,y,rad,h)&&!world.water.some(o=>inShape(x,y,o,rad+35))&&!world.obstacles.some(o=>inShape(x,y,o,rad+15));
const addObstacle=o=>{world.obstacles.push(o);walk.obstacles.push(structuredClone(o))};
function removeProp(p){art.props=art.props.filter(q=>q.id!==p.id);for(const d of [world,walk])d.obstacles=d.obstacles.filter(o=>!(o.x===p.x&&Math.abs(o.y-p.y)<40));}
for(const p of [...art.props])if(/bow-bench/.test(p.id)&&['plaza','cafe','pond'].includes(p.zone))removeProp(p);
const benches=[];
function bench(ring,deg,span=20){
 const {x,y,rx,ry,id}=ring,sIn=rx-54,sOut=rx-14,back=rx-10,k=ry/rx;
 const ground=(a,s)=>[x+Math.cos(a*Math.PI/180)*s,y+Math.sin(a*Math.PI/180)*s*k];
 const b={deg,span},points=s=>Array.from({length:25},(_,i)=>ground(deg-span/2+span*i/24,s));
 const foot=[...points(sIn-4),...points(back+4).reverse()];
 if(foot.some(([x,y])=>pathDist(x,y)<22||!onLand(x,y)||!bedClear(x,y,28)||world.obstacles.some(o=>inShape(x,y,o,12))))return false;
 const xy=[sIn-4,back+4].flatMap(s=>points(s)).flatMap(([x,y])=>[[x,y+5],[x,y-54]]);
 const x0=Math.floor(Math.min(...xy.map(p=>p[0])))-4,y0=Math.floor(Math.min(...xy.map(p=>p[1])))-4;
 const w=Math.ceil(Math.max(...xy.map(p=>p[0])))-x0+4,h=Math.ceil(Math.max(...xy.map(p=>p[1])))-y0+4;
 const name=`pink-arc-${id}-${deg}`,file=`detail/${name}.svg`;
 const body=drawArcBench(b,{ground,sIn,sOut,back,seat:17,top:47,ink,line:2.2,thin:1.5});
 writeFileSync(A+file,`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x0} ${y0} ${w} ${h}"><title>Rosybutton ${id}: curved timber bench, follows its own ring</title><g stroke-linecap="round" stroke-linejoin="round">${body.join('')}</g></svg>`);
 const [ax,ay]=ground(deg,(sIn+sOut)/2);
 art.props.push({id:name,name:'Curved timber bench',src:file,x:r(ax),y:r(ay),width:w,height:h,scale:1,anchor:{x:(ax-x0)/w,y:(ay-y0)/h},zone:id,shadow:false});
 addObstacle({poly:foot.map(p=>p.map(r)),craft:'pink-ring-bench'});benches.push({id:name,deg,span,ring});return true;
}
const rings=[{id:'plaza',x:4000,y:2833.66,rx:760,ry:542,angles:[160,25,55,125,-155,-25]},
{id:'cafe',x:2197.7,y:3337.36,rx:580,ry:354,angles:[70,140,30,-25]},
{id:'festival',x:3150,y:3730,rx:416,ry:248,angles:[45,130,-35]},
{id:'pond',x:5654.35,y:1877.36,rx:725,ry:430,angles:[65,115,30]},
{id:'picnic',x:2580,y:1030,rx:635,ry:286,angles:[-130,140,-45]},
{id:'meadow',x:5420,y:1000,rx:595,ry:296,angles:[-145,-45,35]}];
for(const ring of rings){let n=0;for(const angle of ring.angles){for(const off of [0,-8,8,-16,16])if(bench(ring,angle+off,ring.id==='plaza'?19:22)){n++;break;}if(n>= (ring.id==='plaza'?4:2))break;}}
let seq=0;
function plant(kind,x,y,scale=1,zone='garden-edge'){
 const sizes={'bush-1':[130,100],'bush-2':[168,110],'bush-5':[170,110],'flower-1':[48,36],'flower-2':[48,36],'flower-3':[44,36],'tree-1':[260,360],'tree-2':[180,360],'tree-3':[300,380],'tree-4':[200,280]};
 const [w,h]=sizes[kind],rad=kind.startsWith('tree')?w*scale*.46:kind.startsWith('bush')?w*scale*.38:18;
 if(!clear(x,y,rad,h*scale)||!bedClear(x,y,w*scale*.5,h*scale))return false;
 if(art.props.some(p=>Math.hypot(x-p.x,(y-p.y)*1.5)<rad+p.width*(p.scale??1)*.35+20))return false;
 art.props.push({id:`pink-craft-${seq++}`,name:kind.startsWith('tree')?'Grove tree':kind.startsWith('bush')?'Rose garden bush':'Border flowers',src:`/pixi-art/plants/${kind}.svg`,x:r(x),y:r(y),width:w,height:h,scale,anchor:{x:.5,y:1},zone});
 if(kind.startsWith('bush'))addObstacle({x:r(x),y:r(y-8),rx:r(rad),ry:22,craft:'pink-border'});
 if(kind.startsWith('tree'))addObstacle({x:r(x),y:r(y-9),rx:31,ry:22,craft:'pink-grove'});
 return true;
}
const floor=[];
function flowerbed(x,y,rx=70,ry=29){
 if(!clear(x,y,rx*.65,50))return;
 floor.push({x,y,rx,ry});
 for(const [j,dx]of [-rx*.55,0,rx*.55].entries())plant(['flower-2','flower-3','flower-1'][j],x+dx,y+5,1.5,'rose-border');
}
for(const id of ['activity-1','activity-2','activity-3']){
 const z=world.zones[id];
 for(let a=0;a<360;a+=24){const t=a*Math.PI/180,x=z.x+Math.cos(t)*(z.rx+65),y=z.y+Math.sin(t)*(z.ry+65);if(a%48===0)flowerbed(x,y,48,22);else plant('bush-1',x,y,.65);}
}
for(const id of ['stalls-1','stalls-2','stalls-3']){
 const z=world.zones[id];
 for(const side of [-1,1])for(let i=-1;i<=1;i++)flowerbed(z.x+i*(z.length*.27),z.y+side*(z.depth/2+52),62,24);
}
const nod=new Set(world.sleepSpots.nod.map(s=>s[0]));
for(const p of art.props)if(p.x>6200&&/tree/i.test(p.name)&&!nod.has(p.id)&&!p.id.includes('willow'))p.scale*=.85;
const trees=art.props.filter(p=>/tree/i.test(p.name)),moved=[];
const treeBox=p=>({x:p.x-p.width*p.scale*.4,y:p.y-p.height*p.scale*.94,w:p.width*p.scale*.8,h:p.height*p.scale*.73});
const overlaps=(a,b)=>{a=treeBox(a);b=treeBox(b);return Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y))>Math.min(a.w*a.h,b.w*b.h)*.12;};
const keep=[];
for(const t of trees){if(!nod.has(t.id)&&!t.id.includes('islet')&&keep.some(p=>overlaps(p,t))){removeProp(t);moved.push(t)}else keep.push(t);}
let seed=2749;const rand=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
const noTree=(x,y,h,w)=>((x-4000)/1280)**2+((y-4432)/760)**2<1||Object.values(world.zones).some(z=>z.rx&&((x-z.x)/(z.rx+w*.35+20))**2+((y-z.y)/(z.ry+80))**2<1)||world.sleepAvoid.some(z=>inShape(x,y,z,w*.4))||[.25,.55,.85].some(k=>pathDist(x,y-h*k)<w*.48+25);
const hidesBuilding=(t,x,y)=>art.props.some(p=>/house|cafe|gazebo|cart|arch|tower/i.test(p.name)&&Math.abs(x-p.x)<(t.width*t.scale+p.width*(p.scale??1))*.38&&y>p.y-p.height*(p.scale??1)*.85&&y-t.height*t.scale*.9<p.y);
const candidates=Array.from({length:24000},()=>[850+rand()*6300,700+rand()*3900]);
for(const t of moved){
 let placed=false;const nearCandidates=[...candidates].sort((a,b)=>Math.hypot(a[0]-t.x,a[1]-t.y)-Math.hypot(b[0]-t.x,b[1]-t.y));const originalScale=t.scale;for(const factor of [1,.9,.8,.7]){t.scale=originalScale*factor;for(const [x,y]of nearCandidates){const w=t.width*t.scale,h=t.height*t.scale;
  if(!clear(x,y,w*.3,0)||!bedClear(x,y,w*.5,h)||hidesBuilding(t,x,y)||noTree(x,y,h,w)||art.props.some(p=>/house|cafe|gazebo|cart|arch|tower/i.test(p.name)&&Math.hypot(x-p.x,y-p.y )<330)||art.props.filter(p=>/tree/i.test(p.name)).some(p=>overlaps(p,{...t,x,y})))continue;
  t.x=r(x);t.y=r(y);art.props.push(t);addObstacle({x:t.x,y:t.y-9,rx:31,ry:22,craft:'pink-moved-tree'});placed=true;break;
 }if(placed)break;}if(!placed)throw Error('Could not replant '+t.id);
}
let newTrees=0;
for(const [x,y]of candidates){
 if(art.props.filter(p=>/tree/i.test(p.name)).length>=61)break;
 const kind=newTrees%3===0?'tree-2':'tree-4',w=kind==='tree-2'?180:200,h=kind==='tree-2'?360:280,scale=1.15;
 const t={x,y,width:w,height:h,scale};
 if(noTree(x,y,h*scale,w*scale)||art.props.filter(p=>/tree/i.test(p.name)).some(p=>overlaps(p,t))||art.props.some(p=>/house|cafe|gazebo|cart|arch|tower/i.test(p.name)&&Math.hypot(x-p.x,y-p.y)<450))continue;
 if(!art.props.some(p=>/tree/i.test(p.name)&&Math.hypot(x-p.x,y-p.y)<620))continue;
 if(plant(kind,x,y,scale,'grove'))newTrees++;
}
for(const [i,t]of art.props.filter(p=>/tree/i.test(p.name)).entries()){
 for(const side of [-1,1])plant(i%2?'bush-1':'bush-5',t.x+side*(t.width*t.scale*.35+50),t.y+28,.65,'grove-understory');
}
for(let i=0;i<300;i++){
 const [cx,cy]=world.coast[i%world.coast.length],x=cx+(4000-cx)*.022,y=cy+(2800-cy)*.022;
 if(!clear(x,y,15)||i%3)continue;
 art.flats.push({id:`pink-shore-${i}`,src:`/pixi-art/decals/pebble-${i%2+2}.svg`,x:r(x),y:r(y),width:44,height:25});
}
for(const [i,f]of floor.entries()){
 const {x,y,rx,ry}=f,name=`pink-bed-${rx}-${ry}`,w=rx*2+8,h=ry*2+8;
 writeFileSync(A+`detail/${name}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><title>Rose border soil and soft ink edging</title><ellipse cx="${rx+4}" cy="${ry+4}" rx="${rx}" ry="${ry}" fill="#679F37" stroke="${ink}" stroke-width="2.2"/><ellipse cx="${rx+4}" cy="${ry+2}" rx="${rx-5}" ry="${ry-5}" fill="#729F40"/></svg>`);
 art.flats.push({id:`pink-garden-bed-${i}`,src:`detail/${name}.svg`,x:r(x-rx-4),y:r(y-ry-4),width:w,height:h,topLeft:true});
}
for(const [i,t]of art.props.filter(p=>/tree/i.test(p.name)).entries()){
 if(i%2)continue;
 for(const side of [-1,1]){
 const x=t.x+side*(t.width*t.scale*.45+55),y=t.y+40;
 if(!clear(x,y,38,55)||art.props.some(p=>Math.hypot(x-p.x,(y-p.y)*1.5)<p.width*(p.scale??1)*.35+42))continue;
 art.props.push({id:`pink-grove-rock-${i}`,name:'Grove stone',src:'/pixi-art/detail/nature--rock-round.svg',x:r(x),y:r(y),width:105,height:67.6,scale:1,anchor:{x:.5,y:1},zone:'grove'});
 addObstacle({x:r(x),y:r(y-8),rx:35,ry:18,craft:'pink-rock'});break;
 }
}
const resultMap=makeMap('pink',{world,walk,harbor,sleepers:[]});
const resolved=resolveSleepSpots(resultMap.baseWalk,art.props,geometry(resultMap.baseWalk).walkable,sleepHalfWidths(),{spots:world.sleepSpots,avoid:world.sleepAvoid,warn:false});
if(resolved.length!==40||resolved.bad.length)throw Error('Sleeper regression: '+JSON.stringify(resolved.bad));
world.props=art.props.filter(p=>p.zone&&!['gardens','woods'].includes(p.zone)).map(p=>({name:p.name,x:p.x,y:p.y,zone:p.zone}));
save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);
const stats={benches:benches.length,rings:benches,trees:art.props.filter(p=>/tree/i.test(p.name)).length,newTrees,movedTrees:moved.map(p=>p.id),props:art.props.length,flats:art.flats.length,flowerbeds:floor.length,sleepers:resolved.length};
save(D+'pink-craft-validation.json',stats);console.log(JSON.stringify({...stats,rings:benches.map(b=>b.id)},null,2));
