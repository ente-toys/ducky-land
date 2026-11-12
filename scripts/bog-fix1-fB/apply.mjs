import fs from 'node:fs';
import {inPoly} from '../../assets/world/island-geometry.mjs';
const root='public/pixi-art/themes/bog-arena/';
const read=p=>JSON.parse(fs.readFileSync(p)),write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const art=read(root+'art.json'),data=read('src/pixi/bog-environment.json');
let blockers=read('src/pixi/bog-blockers.json');
art.props=art.props.filter(p=>!p.id.startsWith('fb-'));
art.flats=art.flats.filter(p=>!p.id?.startsWith('fb-'));
blockers=blockers.filter(p=>!p.id.startsWith('fb-'));
data.world.obstacles=data.world.obstacles.filter(p=>!p.id.startsWith('fb-'));
fs.copyFileSync('scripts/bog-fix1-fB/moon-hall.svg',root+'home/fb-moon-hall.svg');
Object.assign(art.props.find(p=>p.id==='mid-hall'),{name:'moon-hall',src:'home/fb-moon-hall.svg',x:4200,y:1730,width:740,height:520,homeSource:'/pixi-art/home-hamlets/lanternleaf/house-yellow.svg',shadowSize:[245,26],shadowOffset:[0,-18]});
Object.assign(blockers.find(p=>p.id==='mid-hall'),{x:3934,y:1512,width:532,height:198});
fs.writeFileSync(root+'home/fb-moon-seal.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="220" height="126" viewBox="0 0 220 126"><ellipse cx="110" cy="63" rx="104" ry="56" fill="#b591c0" stroke="#93729e" stroke-width="3"/><ellipse cx="110" cy="63" rx="87" ry="44" fill="#a578b3"/><path d="M120 31C73 24 61 78 107 94C126 101 148 93 159 78C133 88 103 68 120 31Z" fill="#f5e277"/><path d="M170 49l3 7 10 2-9 3-3 7-3-7-9-2 9-3Z" fill="#f5e277"/></svg>`);
art.flats.push({id:'fb-mid-moon-seal',src:'home/fb-moon-seal.svg',x:4200,y:2110,width:220,height:126,anchor:{x:.5,y:.5}});
const trees=[[260,360],[180,360],[300,380],[200,280],[150,380]],bushes=[[130,100],[168,110],[116,104],[140,100]];
const banks=[
 ['moon-west','orchid',3330,1460,[[3,-110,-80],[1,60,-25],[5,180,90],[4,-60,130]],[[-160,170],[-30,215],[135,210]]],
 ['moon-east','sage',5100,1470,[[2,-105,-90],[3,65,-15],[5,180,100],[4,-50,150]],[[-170,170],[10,225],[170,210]]],
 ['moon-back','orchid',4200,1090,[[4,-195,5],[1,-35,-65],[3,145,0]],[[-245,100],[-110,155],[95,140],[250,120]]],
 ['northwest-elbow','teal',2730,2530,[[5,-115,-80],[1,35,-20],[4,170,130]],[[-190,80],[-70,155],[50,210],[195,215]]],
 ['northeast-elbow','sage',5350,2550,[[4,-120,-30],[1,45,50],[5,190,160]],[[-180,110],[-25,180],[125,235]]],
 ['mid-west-foot','orchid',3300,2940,[[1,-170,-60],[3,10,15],[2,180,140]],[[-210,100],[-80,180],[60,240],[210,240]]],
 ['mid-east-foot','orchid',5110,3160,[[3,-130,-70],[4,50,50],[5,190,150]],[[-180,100],[-35,185],[135,230]]],
 ['west-pond-bend','orchid',2610,3240,[[4,-100,-25],[2,45,45],[1,180,130]],[[-155,100],[-10,165],[145,235]]],
 ['east-pond-bend','lime',6800,3210,[[4,-110,-30],[1,55,55],[5,200,165]],[[-170,110],[-20,190],[145,240]]],
 ['west-junction-back','teal',3670,3230,[[5,-115,-80],[4,35,50],[1,160,100]],[[-170,80],[-40,160],[130,210]]],
 ['east-junction-back','teal',4590,3110,[[2,-110,-70],[1,50,40],[4,180,135]],[[-160,100],[-30,185],[135,230]]],
 ['west-middle-upper','lime',3050,4370,[[1,-160,-65],[5,10,-20],[3,170,90],[4,-45,170]],[[-210,100],[-130,220],[40,255],[205,215]]],
 ['west-middle-inner','orchid',3730,4090,[[3,-155,-75],[2,20,45],[4,155,155]],[[-200,90],[-70,175],[80,230],[215,245]]],
 ['east-middle-inner','orchid',4650,4100,[[2,-105,-60],[3,70,35],[4,210,160]],[[-160,100],[-25,190],[140,235]]],
 ['east-middle-upper','lime',5300,4510,[[3,-155,-65],[5,20,30],[1,180,140],[4,-50,170]],[[-210,110],[-105,240],[60,270],[215,240]]],
 ['west-middle-bottom','orchid',3630,4890,[[4,-185,-40],[3,-15,40],[5,160,135]],[[-230,100],[-105,190],[40,235],[190,235]]],
 ['east-middle-bottom','teal',4730,4920,[[5,-150,-70],[1,10,20],[4,175,120]],[[-210,100],[-70,180],[95,230],[225,220]]],
 ['west-lane-meadow','lime',2450,4500,[[4,-115,-40],[1,50,60],[5,195,150]],[[-175,100],[-35,195],[140,230]]],
 ['east-lane-meadow','sage',6030,4520,[[2,-110,-70],[4,50,70],[1,210,150]],[[-180,100],[-30,190],[150,245]]],
 ['southwest-triangle','orchid',3280,5920,[[3,-150,-60],[2,10,25],[4,175,130]],[[-210,100],[-65,180],[100,225]]],
 ['southwest-inner','lime',3830,6040,[[5,-155,-80],[1,0,15],[4,150,145]],[[-205,100],[-70,180],[90,235],[220,240]]],
 ['southeast-inner','orchid',4550,6090,[[4,-90,-90],[3,80,10],[2,245,140]],[[-155,100],[0,180],[165,235]]],
 ['southeast-triangle','teal',5070,5860,[[3,-115,-60],[5,55,35],[4,190,155]],[[-170,100],[-30,190],[145,235]]],
 ['west-loop-pocket','orchid',1020,4530,[[2,-100,-60],[4,50,60]],[[-150,100],[0,185],[155,210]]],
 ['east-loop-pocket','sage',7510,4740,[[4,-100,-50],[5,40,70]],[[-160,100],[-15,185],[120,210]]],
 ['southwest-shore','lime',2220,6490,[[4,-100,-50],[5,70,30]],[[-170,70],[-20,145],[120,175]]],
 ['southeast-shore','teal',6170,6400,[[5,-110,-70],[4,45,30]],[[-180,80],[-40,150],[105,175]]],
];
const add=(p)=>art.props.push({scale:1,anchor:{x:.5,y:1},shadow:true,wind:true,...p});
const solid=b=>{blockers.push(b);};
for(const [key,colour,x,y,ts,bs] of banks){
 for(const [i,[n,dx,dy]] of ts.entries()){
  const [width,height]=trees[n-1],id=`fb-${key}-tree-${i}`;
  add({id,name:`tree-${n}-${colour}`,src:`home/tree-${n}-${colour}.svg`,x:x+dx,y:y+dy,width,height,homeSource:`/pixi-art/plants/tree-${n}.svg`,shadowSize:[width*.22,17],trunk:[.5,.93]});
  solid({id:id+'-trunk',kind:'tree',type:'rect',x:x+dx-15,y:y+dy-19,width:30,height:26});
 }
 for(const [i,[dx,dy]] of bs.entries()){
  const n=[1,3,2,4][i], [width,height]=bushes[n-1];
  add({id:`fb-${key}-bush-${i}`,name:`bush-${n}-${colour}`,src:`home/bush-${n}-${colour}.svg`,x:x+dx,y:y+dy,width,height,homeSource:`/pixi-art/plants/bush-${n}.svg`,shadowSize:[width*.28,10]});
 }
 for(const [i,[dx,dy]] of [[-195,215],[15,290],[150,275]].entries())art.flats.push({id:`fb-${key}-grass-${i}`,src:'home/fb-tuft.svg',x:x+dx,y:y+dy,width:42,height:30,homeSource:'/pixi-art/detail/nature--grass-tuft-three.svg'});
 add({id:`fb-${key}-flowers`,name:'flowers',src:'home/flowers.svg',x:x-110,y:y+240,width:95,height:70,shadow:false,wind:false,homeSource:'/pixi-art/plants/flower-1.svg'});
}
fs.writeFileSync(root+'home/fb-tuft.svg',fs.readFileSync('public/pixi-art/detail/nature--grass-tuft-three.svg','utf8').replaceAll('#85c864','#9dbca7').replaceAll('#65b549','#708e82').replaceAll('#232323','#39472d'));
const omit=new Set([
  "fb-west-junction-back-tree-2",
  "fb-west-junction-back-bush-1",
  "fb-west-junction-back-bush-2",
  "fb-west-junction-back-flowers",
  "fb-east-junction-back-bush-0",
  "fb-east-junction-back-bush-1",
  "fb-east-junction-back-bush-2",
  "fb-east-junction-back-flowers",
  "fb-west-middle-bottom-bush-3",
  "fb-east-middle-bottom-flowers",
  "fb-southwest-inner-bush-3",
  "fb-southeast-inner-bush-2",
  "fb-southeast-inner-flowers",
  "fb-west-junction-back-grass-1",
  "fb-west-junction-back-grass-2",
  "fb-east-junction-back-grass-0",
  "fb-east-junction-back-grass-1",
  "fb-east-middle-bottom-grass-1",
  "fb-southeast-inner-grass-0",
  "fb-southeast-inner-grass-1",
  "fb-southeast-inner-grass-2"
]);
art.props=art.props.filter(p=>!omit.has(p.id));
art.flats=art.flats.filter(p=>!omit.has(p.id));
blockers=blockers.filter(p=>!omit.has(p.id.replace(/-trunk$/,'')));
const siteLaneMoves={"fb-west-pond-bend-bush-0":[2580,3340],"fb-west-pond-bend-flowers":[2610,3480],"fb-west-pond-bend-grass-0":[2580,3455],"fb-east-pond-bend-bush-1":[6660,3400],"fb-east-pond-bend-bush-2":[7000,3450],"fb-east-pond-bend-grass-1":[6720,3500]};
for(const p of [...art.props,...art.flats]){
 const at=siteLaneMoves[p.id];if(at)[p.x,p.y]=at;
}
for(const p of art.props.filter(p=>p.id.startsWith('fb-'))){
 if(!inPoly(p.x,p.y,data.world.coast)||data.world.water.some(w=>inPoly(p.x,p.y,w.poly)))throw Error('Plant root outside dry land: '+p.id);
}
for(const b of blockers.filter(b=>b.id.startsWith('fb-')||b.id==='mid-hall')){
 const obstacle={id:b.id,poly:[[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]]};
 const i=data.world.obstacles.findIndex(p=>p.id===b.id);if(i<0)data.world.obstacles.push(obstacle);else data.world.obstacles[i]=obstacle;
}
write(root+'art.json',art);write('src/pixi/bog-blockers.json',blockers);
fs.writeFileSync('src/pixi/bog-environment.json',JSON.stringify(data)+'\n');
console.log(JSON.stringify({banks:banks.length,newTrees:art.props.filter(p=>p.id.startsWith('fb-')&&p.name.startsWith('tree-')).length,newBushes:art.props.filter(p=>p.id.startsWith('fb-')&&p.name.startsWith('bush-')).length,totalTrees:art.props.filter(p=>p.name.startsWith('tree-')).length,blockers:blockers.length}));
