// Bog uses recoloured copies of Home SVGs. Placement is authored, never random scatter.
import fs from 'node:fs';
import {buildSites} from './sites.mjs';
import {spawnSync} from 'node:child_process';
const root='public/pixi-art/themes/bog-arena';
const read=p=>fs.readFileSync(p,'utf8'),write=(p,s)=>fs.writeFileSync(p,s);
const json=(p,v)=>write(p,JSON.stringify(v,null,2)+'\n');
const palette={ink:'#39472d',ground:'#654569',path:'#cea2d0',court:'#a578b3',roof:'#168f98',leaf:'#b6d93b',sea:'#6EC9DE'};
const props=[],flats=[],floating=[],decks=[],blockers=[],sources={};
function reuse(name,source,replacements={}){
 let svg=read('public'+source);
 // Keep Home geometry, replace legacy paint gradients with their middle flat fill.
 const gradients=new Map();
 svg=svg.replace(/<linearGradient\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/linearGradient>/g,(_,id,body)=>{const stops=[...body.matchAll(/stop-color="([^"]+)"/g)].map(m=>m[1]);gradients.set(id,stops[Math.floor(stops.length/2)]??'#c88941');return '';});
 svg=svg.replace(/url\(#([^)]*)\)/g,(m,id)=>gradients.get(id)??m);
 svg=svg.replace(/#[0-9a-f]{6}/gi,c=>replacements[c.toLowerCase()]??c);
 write(`${root}/home/${name}.svg`,svg);sources[name]=source;
 return `home/${name}.svg`;
}
const themes={lime:['#a9cb33','#78962d','#d0e967'],orchid:['#bc88ce','#9363a9','#d9aae7'],sage:['#9dbca7','#708e82','#c3dac8'],teal:['#60b3ae','#398e8a','#9bd5c3']};
for(const [colour,[leaf,shade,light]] of Object.entries(themes)){
 for(const [kind,count]of [['tree',5],['bush',4]])for(let i=1;i<=count;i++)reuse(`${kind}-${i}-${colour}`,`/pixi-art/plants/${kind}-${i}.svg`,{'#4aa539':leaf,'#2b7a37':shade,'#89c332':light});
}
const buildingPalette={'#fff0c7':'#d9b8df','#e1c58d':'#b591c0','#f3ddb1':'#c9a7d0','#ffe6a2':'#bf94ce','#ffe8b5':'#edceea','#75bfc5':'#f5e277','#729aa7':'#168f98','#7399ad':'#168f98','#d9a94c':'#168f98','#c78a56':'#287f83','#b58a4b':'#287f83','#70a645':'#b6d93b','#6a9d3d':'#a1c238'};
Object.assign(buildingPalette,{'#fff0c7':'#329b9d','#e1c58d':'#287f83','#e1bb4b':'#168f98','#b08cba':'#168f98','#d1b26b':'#168f98','#ce91a4':'#168f98','#f4d3c7':'#329b9d','#9dbeb4':'#329b9d','#f1dbc6':'#329b9d'});
const homeBuildings=[['lodge','/pixi-art/home-hamlets/clovercrust/cottage-blue-roof.svg'],['cottage','/pixi-art/home-hamlets/lanternleaf/house-blue.svg'],['hall','/pixi-art/home-hamlets/lanternleaf/house-yellow.svg'],['chapel','/pixi-art/home-hamlets/petalpatch/house-domed-pottery-shop.svg'],['porch','/pixi-art/home-hamlets/reedwhistle/cottage-harbour.svg'],['studio','/pixi-art/home-hamlets/petalpatch/house-art-studio.svg']];
for(const [name,source]of homeBuildings)reuse(name,source,buildingPalette);
reuse('bench','/pixi-art/detail/street--bench-wood.svg');
reuse('lantern','/pixi-art/detail/street--lamp-lantern.svg',{'#4aa539':'#168f98'});
reuse('reeds','/pixi-art/prop-17.svg',{'#4aa539':'#b6d93b','#2b7a37':'#78962d'});
reuse('flowers','/pixi-art/plants/flower-1.svg',{'#f16e4b':'#d9aae7'});
reuse('rock','/pixi-art/prop-56.svg',{'#c6c3a5':'#a98bb0'});
reuse('marker','/pixi-art/detail/nature--rock-upright.svg',{'#c6c3a5':'#a98bb0','#b9bf9c':'#b591c0','#89936e':'#93729e'});
reuse('tuft','/pixi-art/detail/nature--grass-tuft-three.svg',{'#4aa539':'#87608c','#2b7a37':'#4e3657','#89c332':'#9b71a1'});
reuse('fountain','/pixi-art/detail/water--fountain-bowl.svg',{'#e4c567':'#b591c0','#fde48c':'#d9b8df','#6ec9de':'#b6d93b'});
reuse('bridge-ew','/pixi-art/home-expansion-c/bridges/bridge-ew.svg');
reuse('bridge-ns','/pixi-art/home-expansion-c/bridges/bridge-ns.svg');
reuse('dock','/pixi-art/home-expansion-c/fishing-deck.svg');
for(let i=0;i<4;i++)reuse(`lily-${i}`,`/pixi-art/lily-0${i}.svg`,{'#4aa539':'#b6d93b','#2b7a37':'#78962d'});
const add=(id,name,x,y,width,height,more={})=>{const p={id,name,src:`home/${name}.svg`,x,y,width,height,scale:1,anchor:{x:.5,y:1},shadow:true,wind:false,...more};props.push(p);return p;};
function rect(id,kind,x,y,width,height){blockers.push({id,kind,type:'rect',x,y,width,height});}
function building(id,name,x,y,width=440,height=390){add(id,name,x,y,width,height,{homeSource:sources[name],shadowSize:[width*.32,25],shadowOffset:[0,-20]});rect(id,'building',x-width*.36,y-height*.42,width*.72,height*.38);}
// Each base has a quiet shared court, two different Home façades, and two cover returns.
const areas={
 'privacy-nw':{x:1900,y:1850,label:'TEAM PRIVACY · NW',team:'privacy'},
 'google-ne':{x:6500,y:1850,label:'TEAM GOOGLE · NE',team:'google'},
 'site-a':{x:2050,y:3770,label:'SITE A'},
 'site-b':{x:6350,y:3770,label:'SITE B'},
 'privacy-sw':{x:1900,y:5650,label:'TEAM PRIVACY · SW',team:'privacy'},
 'google-se':{x:6500,y:5650,label:'TEAM GOOGLE · SE',team:'google'},
 mid:{x:4200,y:2170,label:'MID'},
 'lantern-cove':{x:4200,y:6870,label:'LANTERN COVE'},
};
for(const [key,a]of Object.entries(areas).filter(([,a])=>a.team)){
 building(`${key}-hall`,a.team==='privacy'?'lodge':'hall',a.x+120,a.y-200,480,420);
 building(`${key}-annex`,key.endsWith('sw')?'porch':a.team==='privacy'?'cottage':'studio',a.x-380,a.y-150,360,320);
}
building('mid-hall','chapel',4200,1640,590,505);
building('mid-west','cottage',3650,1710,350,310);
building('mid-east','studio',4750,1710,350,310);
building('cove-boathouse','porch',3760,6820,400,355);
const siteAdditions=buildSites({root,write,reuse,add,building,rect,flats,sources,areas});
// Walls use Home's upright front/top proportions, one shade, no oblique extrusion.
write(`${root}/home/wall.svg`,'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 105"><path d="M8 22Q128 15 252 22V92Q130 99 8 92Z" fill="#b591c0" stroke="#39472d" stroke-width="2"/><path d="M8 22L18 8Q128 2 242 8L252 22Q130 30 8 22Z" fill="#d9b8df" stroke="#39472d" stroke-width="2"/><path d="M88 27V95M174 27V95" fill="none" stroke="#93729e" stroke-width="1.2"/></svg>');
let coverIndex=0;
for(const [key,a]of Object.entries(areas).filter(([key])=>key!=='lantern-cove')){
 const positions=key==='mid'?[[-490,220],[490,220]]:[[-470,210],[470,210]];
 for(const [i,[dx,dy]]of positions.entries()){const cover=key==='mid'?'wall':['cover-planter','cover-crates','cover-harvest'][coverIndex++%3];add(`${key}-wall-${i}`,cover,a.x+dx,a.y+dy,260,key==='mid'?105:160,{shadowSize:[105,13],shadowOffset:[0,-8]});rect(`${key}-wall-${i}`,'wall',a.x+dx-122,a.y+dy-65,244,58);}
 for(const [i,dx]of [-390,390].entries())add(`${key}-lamp-${i}`,'lantern',a.x+dx,a.y+370,65,155,{shadowSize:[14,8],homeSource:sources.lantern});
}
for(const [key,a]of Object.entries(areas)){
 const lines=a.label.split(' · '),label=`label-${key}`;
 write(`${root}/home/${label}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 90"><g stroke="#39472d" stroke-width="1.8" stroke-linejoin="round"><path d="M28 49H39V87H28Z M201 49H212V87H201Z" fill="#c88941"/><path d="M9 5Q120 0 231 5V64Q120 70 9 64Z" fill="#edceea"/><path d="M15 11H225V58H15Z" fill="#fff0c7" stroke-width="1"/></g><text x="120" y="${lines.length>1?30:41}" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" font-weight="700" fill="#39472d">${lines[0]}</text>${lines[1]?`<text x="120" y="49" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" fill="#39472d">${lines[1]}</text>`:''}</svg>`);
 add(label,label,key==='lantern-cove'?3630:a.x,a.y+(key==='lantern-cove'?280:295),240,90,{shadowSize:[88,10]});
}
// Mixed Home plants at their original design-system sizes, overlapping in named banks.
const treeSizes=[[260,360],[180,360],[300,380],[200,280],[150,380]],bushSizes=[[130,100],[168,110],[116,104],[140,100]];
const grovePatterns=[[[1,-180,0],[3,15,-80],[2,160,30],[4,-60,130],[5,120,160]],[[3,-170,30],[5,-30,-100],[1,130,5],[2,245,120],[4,40,160],[1,-135,200]],[[2,-190,60],[1,-30,-60],[4,150,25],[3,55,160]]];
// Deliberate groves: shoreline, building backs, pool banks, then long-lane pockets.
const groves=[
 [1160,1150,'lime'],[1660,1020,'lime'],[2250,1050,'teal'],[2900,1170,'orchid'],[3500,800,'orchid'],[4100,660,'orchid'],[4700,820,'orchid'],[5350,1150,'sage'],[6100,1030,'sage'],[6850,1150,'sage'],
 [920,1700,'lime'],[880,2270,'lime'],[2790,1780,'teal'],[3030,2310,'orchid'],[5480,1830,'sage'],[7270,1790,'sage'],[7470,2310,'sage'],
 [1080,3000,'orchid'],[1580,2930,'orchid'],[2300,2880,'orchid'],[2910,3210,'orchid'],[5460,3000,'lime'],[5910,2810,'lime'],[6920,2930,'lime'],[7460,3210,'lime'],
 [820,3650,'orchid'],[1050,4170,'orchid'],[3000,4020,'lime'],[3450,3480,'teal'],[4990,3480,'teal'],[5400,4100,'lime'],[7400,3900,'sage'],[7590,4450,'sage'],
 [950,4930,'lime'],[1390,4840,'lime'],[2140,4800,'teal'],[2900,5040,'orchid'],[3520,4620,'orchid'],[4780,4620,'orchid'],[5460,4990,'teal'],[6040,4820,'teal'],[6810,4800,'teal'],[7400,5130,'teal'],
 [930,5800,'orchid'],[1210,6260,'orchid'],[2460,6220,'lime'],[2900,5940,'orchid'],[5520,6000,'teal'],[6050,6350,'teal'],[6880,6290,'teal'],[7470,5800,'teal'],
 [2920,6760,'lime'],[3290,7140,'lime'],[4960,6830,'lime'],[5300,7190,'orchid'],[3690,7420,'lime'],[4770,7520,'lime'],
 [3550,2860,'orchid'],[4750,2830,'orchid'],[3480,5730,'orchid'],[4780,5710,'orchid'],
];
for(const [g,[x,y,colour]] of groves.entries()){
 const pattern=grovePatterns[g%3];
 for(const [j,[n,dx,dy]]of pattern.entries()){
  const [w,h]=treeSizes[n-1];add(`grove-${g}-tree-${j}`,`tree-${n}-${colour}`,x+dx,y+dy,w,h,{homeSource:`/pixi-art/plants/tree-${n}.svg`,wind:true,shadowSize:[w*.22,17],trunk:[.5,.93]});
  // Tree collision is its trunk, never the crown. No fade or opacity changes.
  rect(`grove-${g}-trunk-${j}`,'tree',x+dx-15,y+dy-19,30,26);
 }
 for(const [j,[dx,dy]]of [[-205,155],[10,230],[175,205]].entries()){
  const n=(g+j)%4+1,[w,h]=bushSizes[n-1];add(`grove-${g}-bush-${j}`,`bush-${n}-${colour}`,x+dx,y+dy,w,h,{homeSource:`/pixi-art/plants/bush-${n}.svg`,wind:true,shadowSize:[w*.28,10]});
 }
 // Ground textures belong to the planting edge, leaving courts clean.
 for(const [j,[dx,dy]]of [[-235,200],[90,260],[-90,195]].entries())flats.push({src:'home/tuft.svg',x:x+dx,y:y+dy,width:36,height:24,homeSource:sources.tuft});
 if(g%2===0)add(`grove-${g}-flowers`,'flowers',x-180,y+255,95,70,{shadow:false,homeSource:sources.flowers});
}
for(const [i,[x,y]]of [[1570,2090],[2290,2070],[6100,2100],[6860,2070],[1600,5940],[2230,5930],[6100,5940],[6840,5920],[3740,2280],[4670,2280],[1770,4140],[6640,4130],[3670,6970],[4780,6820]].entries())add(`bench-${i}`,'bench',x,y,147.24,83.34,{anchor:{x:.5,y:451/463},homeSource:sources.bench,shadowSize:[65,12]});
const pools=[{id:'west-pool',points:[[1360,2750],[1530,2630],[1910,2610],[2260,2670],[2450,2790],[2350,2920],[1910,2970],[1520,2920]]},{id:'east-pool',points:[[5740,2590],[6070,2510],[6530,2580],[6780,2720],[6690,2850],[6260,2900],[5880,2810]]},{id:'cove-pool',points:[[3770,7140],[3990,6690],[4500,6660],[4730,6970],[4880,7530],[4690,7840],[4550,8330],[4150,8340],[3960,7940],[3830,7640]]}];
pools.push(siteAdditions.pool);
for(const [i,[x,y]]of [[1410,2770],[2320,2880],[1890,2660],[5890,2710],[6530,2600],[6670,2800],[3940,6860],[4670,6970],[4780,7540],[3910,7680]].entries())add(`reeds-${i}`,'reeds',x,y,72,95,{homeSource:sources.reeds,shadow:false,wind:true});
for(const [i,[x,y]]of [[1630,2780],[2130,2820],[1930,2890],[6070,2690],[6400,2770],[4520,7070],[4200,7450],[4490,7640]].entries())floating.push({src:`home/lily-${i%4}.svg`,x,y,width:70,height:36,anchor:{x:.5,y:.5},homeSource:sources[`lily-${i%4}`]});
// Authored planting trim after exact coast/water/lane review. These bank-edge
// instances crowd the narrow shore or a walking throat, so the open lane wins.
const trimTrees={0:[0,1],11:[0],16:[1,2,3,4],18:[1,2],19:[0,1],22:[1,2],33:[0],50:[2,3],52:[5],54:[2,4],55:[1,2,3],56:[0,1],13:[1,2],17:[2],27:[0,1],28:[2,4,5],29:[0,3],34:[2,3],41:[2,3],46:[5],47:[3],53:[0,1]};
const trimBushes={11:[0],15:[2],16:[1,2],50:[2],52:[0],54:[1,2],55:[2],56:[0],17:[2],23:[2],24:[0],28:[1],29:[0,1],31:[0],34:[2],41:[1],46:[0],47:[1,2]};
const omitted=new Set();
for(const [g,ns]of Object.entries(trimTrees))for(const n of ns){omitted.add(`grove-${g}-tree-${n}`);omitted.add(`grove-${g}-trunk-${n}`);}
for(const [g,ns]of Object.entries(trimBushes))for(const n of ns)omitted.add(`grove-${g}-bush-${n}`);
for(let i=props.length-1;i>=0;i--)if(omitted.has(props[i].id))props.splice(i,1);
for(let i=blockers.length-1;i>=0;i--)if(omitted.has(blockers[i].id))blockers.splice(i,1);
// Exact Home EW bridge, unrotated, original 104-unit deck width. Path throats meet both banks.
decks.push({id:'cove-bridge',src:'home/bridge-ew.svg',x:3750,y:6700,width:1100,height:240,homeSource:sources['bridge-ew'],overBoats:true});
// Home fishing deck is a detailed T dock, with boards, posts, rope and tackle retained.
decks.push({id:'cove-dock',src:'home/dock.svg',x:3720,y:7350,width:800,height:630*800/1450,homeSource:sources.dock});
const routes=[
 {id:'west-loop',width:128,points:[[1900,1850],[1300,2350],[1220,3400],[1350,4410],[1900,5650],[3000,6350],[3650,6490],[4200,6370]]},
 {id:'east-loop',width:128,points:[[6500,1850],[7120,2350],[7190,3400],[7070,4410],[6500,5650],[5400,6350],[4870,6460],[4200,6370]]},
 {id:'north-loop',width:128,points:[[1900,1850],[2900,2250],[4200,2420],[5480,2250],[6500,1850]]},
 {id:'west-mid',width:128,points:[[2050,3770],[3050,3910],[3610,3540],[4200,3260],[4770,3540],[5350,3910],[6350,3770]]},
 {id:'spine',width:128,points:[[4200,1640],[4200,2420],[4200,3260],[4200,4270],[4200,5220],[4200,6370],[3760,6580],[3760,6820]]},
 {id:'south-west',width:128,points:[[1900,5650],[2860,5520],[4200,5220],[5500,5520],[6500,5650]]},
 {id:'site-a-access',width:104,points:[[1300,4100],[2050,4090],[2600,4000],[3050,3910]]},
 {id:'site-b-access',width:104,points:[[5350,3910],[5900,4070],[6350,4090],[7100,4100]]},
 {id:'west-bridge-approach',width:104,points:[[3760,6580],[3740,6870],[3796,6870]]},
 {id:'east-bridge-approach',width:104,points:[[4804,6870],[4950,6860],[4870,6460]]},
 {id:'dock-access',width:104,points:[[3760,6820],[3690,7230],[3680,7410],[3740,7410]]},
];
// Every front door joins the court path with a 104-unit lane.
for(const p of props.filter(p=>sources[p.name]?.includes('home-hamlets')))routes.push({id:`${p.id}-door`,width:104,points:[[p.x,p.y-12],[p.x,p.y+160],[areas[p.id.replace(/-(hall|annex)$/,'')]?.x??p.x,p.y+290]]});
const data={width:8400,height:8200,palette,areas,pools,routes,groves,blockers,props,flats,floating,decks,sources};
json('scripts/bog-environment/layout.json',data);
const result=spawnSync('python3',['scripts/bog-environment/ground.py'],{stdio:'inherit'});if(result.status)process.exit(result.status);
json(`${root}/art.json`,{width:data.width,height:data.height,sea:palette.sea,raster:{enabled:true},ground:{tiles:[{src:'ground.svg',x:0,y:0,width:data.width,height:data.height}]},props,flats,floating,decks});
json(`${root}/centre/centre.json`,{pieces:[]});
console.log(JSON.stringify({trees:props.filter(p=>p.name.startsWith('tree')).length,bushes:props.filter(p=>p.name.startsWith('bush')).length,props:props.length,blockers:blockers.length}));
