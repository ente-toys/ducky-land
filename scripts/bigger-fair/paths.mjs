// One authority for Fair terrain and routes. Fit Home benches before routing;
// bridge geometry and resident positions remain inputs.
import fs from 'node:fs';
import {applyFairBenches} from './benches.mjs';
import {mapFor} from '../../src/pixi/island-maps.js';
import {sleeperFootprint} from '../../src/pixi/sleep-spots.js';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {applyFairWater} from './water.mjs';
const A='public/pixi-art/themes/fair/',D='rive/web/themes/fair/';
const read=p=>JSON.parse(fs.readFileSync(p));
const P=([x,y])=>[3570+(x-768)*4.3,2220+(y-520)*3.8];
export function fairRoutes(art,world){
 const routes=[];
 const road=(id,points,main=false)=>routes.push({id,width:main?128:104,points});
 // The perimeter is a circuit, with bridge centres included as fixed anchors.
 road('outer-loop',[[-1550,3130],[-1800,2700],[-1800,1800],[-1640,720],[-1000,0],[0,-500],[1800,-650],[2700,-850],[4100,-950],[5900,-850],[7300,-450],[8100,200],[8400,1000],[8500,1480],[8500,1920],[8600,2500],[8660,3300],[8560,4120],[8170,4500],[7480,5300],[5800,5500],[4200,5700],[2900,5760],[2450,5700],[1500,5670],[1000,5410],[-530,5190],[-1400,4300],[-1550,3550],[-1550,3130]],true);
 const ellipse=Array.from({length:97},(_,i)=>P([768+699*Math.cos(i*Math.PI/48),520+420*Math.sin(i*Math.PI/48)]));
 // The connected lagoon outlet occupies the old northern arc. Keep the
 // inner circuit on its south bank instead of crossing a new unbridged channel.
 for(const p of ellipse)if(p[1]<1900)p[1]=1900;
 road('heart-loop',ellipse,true);
 // Each hamlet has a through lane. The blueprint's obsolete curled lane caps
 // and ground-reaching connectors are deliberately absent.
 road('bobbinbell-through',[[-1640,720],[-1550,1100],[-1376,1510],[-1110,1610],[-850,1770],[-700,1940],[-880,2200],[-924,2427],[-1100,2670],[-1800,2700]]);
 road('bobbinbell-east-door',[[-700,1940],[-430,2113],[-299,2113]]);
 road('bobbinbell-west-door',[[-880,2200],[-1200,2150],[-1394,2109]]);
 road('bobbinbell-upper-door',[[-1110,1610],[-890.8,1435.8],[-564.4,1538.4],[-305.2,1509.6]]);
 road('cloudpop-through',[[2700,-850],[2700,-400],[2900,-50],[3450,-55],[4100,-120],[4750,160],[5500,100],[6500,-200],[7300,-450]]);
 road('sugarspoon-through',[[1000,5410],[1100,5610],[1500,5590],[2000,5590],[2450,5510],[2900,5580],[3550,5560],[4100,5490],[4200,5700]]);
 road('sugarspoon-north',[[1500,5590],[1460,5350],[1749.8,5097.5],[2450,5045.7],[3146.6,5097.5],[3510.2,5352.8],[3550,5560]]);
 road('sugarspoon-square',[[2450,5045.7],[2450,5342.5],[2450,5510]]);
 road('waddleshow-through',[[8600,2500],[8450,2810],[8068,3064],[7956,3202],[8250,3400],[8420,3880],[8560,4120]]);
 road('waddleshow-west',[[7956,3202],[7560,3170],[7464,3116]]);
 road('waddleshow-south',[[8250,3400],[7960,3790],[7670,3764]]);
 // Links cross water only on the existing decks, which this worker never edits.
 road('west-access',[[-1800,2700],[-900,2780],[160,2830],[580,2830],P([60,515])]);
 road('northwest-access',[[0,-500],[-200,300],[520,580],[520,980],P([252,181])]);
 road('north-access',[[3450,-55],[3560,175],[3560,565],P([768,89])]);
 road('northeast-access',[[6500,-200],[6560,495],[6560,835],P([1284,181])]);
 road('east-access',[[7956,3202],[7490,3270],[7200,2900],[7120,2590],[6680,2590],P([1476,515])]);
 road('southeast-access',[[7480,5300],[7000,4530],[6460,3930],[6460,3530],P([1266,844])]);
 road('south-access',[[3550,5560],[4020,5150],[4190,4640],[3570,4450],[3570,4275],[3570,3865],P([768,950])]);
 road('southwest-access',[[-530,5190],[220,4640],[820,4020],[820,3540],P([270,844])]);
 road('east-brook-lane',[[8400,1000],[8030,1390],[7780,1710],[7780,2150],[7330,2370],[7120,2590]]);
 road('harbour',[[1000,5410],[1005,5650]]);
 // Thin Home lanes replace the oversized blueprint polygons. Ride pads remain
 // destination courts, and checker paving stays within the balloon court only.
 for(const [id,points] of [
 ['west-upper',[[252,181],[355,259],[490,385]]],
 ['east-upper',[[1284,181],[1181,259],[1040,385]]],
 ['west-court',[[60,515],[237,548],[395,490]]],
 ['east-court',[[1476,515],[1299,548],[1141,490]]],
 ['west-lower',[[270,844],[405,740],[563,640]]],
 ['east-lower',[[1266,844],[1130,740],[973,640]]],
 ['castle-bridge-access',[[768,305],[768,393]]],
 ['castle-court',[[768,393],[768,600],[768,730]]],
 ['south-court',[[768,924],[768,950]]]
 ])road(id,points.map(P));
 // Bridge markers use the final visible deck endpoints, including directional
 // sources whose crossing axis differs from the historical bridge anchors.
 const crossings={
  'west-access':['west-heart',2,2], 'northwest-access':['northwest-heart',2,2],
  'north-access':['north-heart',1,2], 'northeast-access':['northeast-heart',1,2],
  'east-access':['east-heart',3,2], 'southeast-access':['southeast-heart',2,2],
  'south-access':['south-heart',4,2], 'southwest-access':['southwest-heart',2,2],
  'east-brook-lane':['wishwater-lane',2,2],
 };
 for(const [id,[bridge,index,count]]of Object.entries(crossings))
  routes.find(r=>r.id===id).points.splice(index,count,{bridge});
 const loop=routes.find(r=>r.id==='outer-loop').points;
 loop.splice(14,2,{bridge:'wishwater-coast'});
 loop.splice(loop.length-2,2,{bridge:'ribbon-coast'},loop[0]);
 routes.find(r=>r.id==='castle-bridge-access').points=[{bridge:'ac2-lagoon-bridge'},P([768,420])];
 // Feature approaches always belong to this same authoritative generator.
 if(world.fairLife)for(const route of JSON.parse(fs.readFileSync('scripts/fair-life/layout.json')).routes)
  routes.push({...route,points:route.points.toReversed(),attachEnd:route.id==='fair-life-hill'?'east-brook-lane':'south-access'});
 // Every retained house/workplace doorstep is a useful destination. Connecting
 // to its community lane replaces the old broad square painted under props.
 for(const p of art.props.filter(p=>p.role&&p.door)){
  const lane=routes.find(r=>r.id===({bobbinbell:'bobbinbell-through',cloudpop:'cloudpop-through',sugarspoon:'sugarspoon-north',waddleshow:'waddleshow-through'}[p.community]));
  if(lane)routes.push({id:'door-'+p.id,width:104,points:[p.door],attach:lane.id});
 }
 // Resolve junctions against the final fitted parent routes, so detours never
 // leave an obsolete authored cap stranded on grass.
 for(const id of ['bobbinbell-through','cloudpop-through','sugarspoon-through','waddleshow-through']){
  const r=routes.find(r=>r.id===id);r.attachStart='outer-loop';r.attachEnd='outer-loop';
 }
 for(const id of ['west-upper','east-upper','west-court','east-court','west-lower','east-lower'])
  routes.find(r=>r.id===id).attachStart='heart-loop';
 const parents={'west-access':'outer-loop','northwest-access':'outer-loop','north-access':'cloudpop-through','northeast-access':'cloudpop-through','east-access':'waddleshow-through','southeast-access':'outer-loop','south-access':'sugarspoon-through','southwest-access':'outer-loop','east-brook-lane':'outer-loop'};
 for(const [id,parent]of Object.entries(parents))routes.find(r=>r.id===id).attachStart=parent;
 for(const r of routes)if(/^(west|northwest|north|northeast|east|southeast|south|southwest)-access$/.test(r.id))r.attachEnd='heart-loop';
 return routes;
}
export function rebuildFairSurface({tiles,routeWrites=true}={}){
 applyFairBenches();
 const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),layout=read('scripts/bigger-fair/centre-source/layout.json');
 walk.obstacles.push(...mapFor('fair').sleepers.map(sleeperFootprint));
 if(tiles)art.ground.tiles=tiles;
 const result=JSON.parse(execFileSync('python3',['scripts/bigger-fair/paths.py'],{input:JSON.stringify({art,world,walk,layout,routes:fairRoutes(art,world)}),maxBuffer:32*1024*1024,encoding:'utf8'}));
 applyFairWater({land:result.land});
 // Merge only the route field, so independent workers' scene data survives.
 if(!routeWrites)return result;
 const current=read(D+'world.json');current.paths=result.routes.map(r=>r.samples);
 if(current.fairLife)current.fairLife.routes=current.fairLife.routes.map(r=>({...r,samples:result.routes.find(p=>p.id===r.id).samples}));
 fs.writeFileSync(D+'world.json',JSON.stringify(current,null,1)+'\n');
 fs.writeFileSync(D+'paths.json',JSON.stringify(current.paths,null,1)+'\n');
 fs.writeFileSync('scripts/bigger-fair/path-routes.json',JSON.stringify(result)+'\n');
 console.log(`Fair unified paths: ${result.routes.length} routes; ${art.ground.tiles.length} shared-contour tiles.`);
 return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url))rebuildFairSurface();
