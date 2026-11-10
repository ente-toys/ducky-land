import fs from 'node:fs';
import {rasterLayers,A,D,read} from './final-model.mjs';
import {rasterPeak} from '../globe-perf/raster-peak.mjs';
import {GROUND_BUDGET_BYTES,tileResolution} from '../../src/pixi/ground-stream.js';
import {RASTER_ART_BUDGET_BYTES,RASTER_ART_UTILIZATION} from '../../src/pixi/theme-raster.js';
const out=(process.argv[2]??'/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/round3/bellovo').replace(/\/$/,'')+'/';
fs.mkdirSync(out,{recursive:true});
const layers=rasterLayers(),views=[];
for(const zoom of [.6,1.8])for(const [width,height]of [[390,844],[1400,1000],[1920,1080]]){
 const pools={};
 for(const [kind,tiles]of Object.entries(layers)){
  const peak=rasterPeak(tiles,{width,height,zoom});
  pools[kind]={...peak,MiB:peak.bytes/1048576,capMiB:(kind==='ground'?GROUND_BUDGET_BYTES:RASTER_ART_BUDGET_BYTES)/1048576,targetUtilization:kind==='ground'?.9:RASTER_ART_UTILIZATION,minTexelsPerDevicePixel:Math.min(...tiles.map(t=>tileResolution(t,zoom,2)/(zoom*2*(t.rasterDensity??1))))};
 }
 views.push({width,height,zoom,dpr:2,pools});
}
const report={method:'Exact weighted-rectangle sweep over every camera-space tile entry and exit edge; all camera positions, no sampling grid. Includes duplicate over-boat bridge streams. RGBA8 canvas residency estimates, not measured GPU/driver memory.',views,tiles:Object.fromEntries(Object.entries(layers).map(([k,v])=>[k,v.length])),animationHeadroom:'Reactive tree/bush crops reserve a 1.05x density factor and 16 world units of culling margin for the existing contact squash/shear. Separate falling leaves use 3.625x sampling.',staticNote:'No Bellovo prop, flat or deck source is permanently rasterized. Four 20x14 leaf sources use 3.625x sampling (59,568 RGBA bytes total); existing 1024x832 terrain fallback remains unchanged. Ground stays within its existing 128 MiB pool. The new 80 MiB art pool replaces the old 143.516 MiB permanent Bellovo art set, reducing the maximum theme allocation. Loading still uses the existing coarse terrain fallback until viewport crops decode.',scope:'Settled flat island view at 2x DPR; supported viewports 390x844, 1400x1000 and 1920x1080; default zoom 0.6 and maximum zoom 1.8. No claim of physical-phone FPS or verified browser GPU raster output.'};
report.leafBytes=read(A+'art.json').autumn.leaves.reduce((sum,src)=>{
 const svg=fs.readFileSync(A+src,'utf8'),w=+svg.match(/\bwidth="([\d.]+)"/)[1],h=+svg.match(/\bheight="([\d.]+)"/)[1];
 return sum+Math.ceil(w*3.625)*Math.ceil(h*3.625)*4;
},0);
report.staticNote=`No Bellovo prop, flat or deck source is permanently rasterized. Four 34x26 leaf sources use 3.625x sampling (${report.leafBytes} RGBA bytes total); the existing terrain fallback remains unchanged. Viewport crops use the existing 128 MiB ground and 80 MiB art pools. The olive uses the ground pool without changing drawing or sort order.`;
fs.writeFileSync(out+'sharpness.json',JSON.stringify(report,null,2)+'\n');
const art=read(A+'art.json'),world=read(D+'world.json');
fs.writeFileSync(out+'integration.json',JSON.stringify({trees:art.props.filter(p=>p.autumn?.kind==='tree').length,bushes:art.props.filter(p=>p.autumn?.kind==='bush').length,benches:art.props.filter(p=>p.sittable).length,sleepers:world.sleepTotal,bridges:art.decks.filter(p=>p.overBoats).length,doors:read('scripts/bigger-cathedral/buildings-doors.json').length,colonnadeBays:art.props.filter(p=>p.id.startsWith('centre-colonnade-')).length,routeCount:world.paths.length,olive:art.props.find(p=>p.id==='cloister-olive-well'),well:art.props.find(p=>p.id==='centre-wishing-well')},null,2)+'\n');
console.log(JSON.stringify(views.filter(v=>v.width===1920),null,2));
