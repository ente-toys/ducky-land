import {writeFileSync,readFileSync} from 'node:fs';
import {WORLD_ISLANDS,WORLD_GEO} from '../../src/pixi/world-map.js';
import {sphereShores,sphereShoreGap,BOAT_CHANNEL} from '../../src/pixi/sphere-shores.js';
import {sphereFrame,angle} from '../../src/pixi/sphere.js';
import {mapOf} from '../../src/pixi/island-maps.js';
import {localPoint} from '../../src/pixi/sphere-coordinates.js';
import {layoutIslet} from '../../src/pixi/islets.js';
import {isletShores,isletHull,flatRingGap} from '../../src/pixi/islet-shores.js';
import {placeRigid} from '../../src/pixi/rigid.js';
import {placeIslet} from '../../src/pixi/islet-placement.js';
import {DOMParser} from '@xmldom/xmldom';
import {svgContext} from '../../src/pixi/svg-context.js';
import {ISLET_SCALE,ISLET_BASE_SEED} from '../../src/pixi/islet-scale.js';
const ART=['odyssey','tree-and-rowboat','broken-shipwreck','04-small-mountain','05-lighthouse-rock','06-palm-treasure','07-pink-blossom','08-snow-igloo','09-spooky-purple','11-volcano','12-coral-atoll'];
const R=WORLD_GEO.Rw,shores=WORLD_ISLANDS.map(i=>sphereShores(i));
const widths=Object.fromEntries(ART.map(art=>[art,JSON.parse(readFileSync(`public/pixi-art/islets/${art}.meta.json`,'utf8')).designWidth*ISLET_SCALE]));
const bounds=Object.fromEntries(ART.map(art=>{
 const ctx=svgContext(readFileSync(`public/pixi-art/islets/${art}.svg`,'utf8'),t=>new DOMParser().parseFromString(t,'image/svg+xml'));
 const b=ctx.bounds,out=[b.minX,b.minY,b.maxX,b.maxY];ctx.destroy();return [art,out];
}));
const flatCoasts=new Map();
function coastsIn(chart){
 if(!flatCoasts.has(chart))flatCoasts.set(chart,WORLD_ISLANDS.flatMap((island,k)=>{const m=mapOf(island.id);return shores[k].map(s=>s.local.map(([x,y])=>{const p=placeRigid(chart,island.id,{x:x+m.cx,y:y+m.cy});return [p.x,p.y];}));}));
 return flatCoasts.get(chart);
}
const flat=(i,chart=i.home)=>isletHull(i).map(p=>{const q=placeIslet(chart,i,p);return [q.x,q.y];});
function drawing(i){const [x0,y0,x1,y1]=bounds[i.art],k=i.width/1024;return [[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(([x,y])=>{const q=placeIslet(i.home,i,[(x-512)*k,(y-512)*k]);return [q.x,q.y];});}
function clear(A,B){
 for(const a of A)for(const b of B){
  if((angle(a.center,b.center)-a.radius-b.radius)*R>=BOAT_CHANNEL)continue;
  if(sphereShoreGap([a],[b],R)<BOAT_CHANNEL)return false;
 }
 return true;
}
function place(seed){
 let state=seed;const rand=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296),placements=[];
 const order=[0].flatMap(round=>ART.map((art,artIndex)=>({art,artIndex,round})));
 order.sort((a,b)=>(b.art==='08-snow-igloo'&&b.round===0)-(a.art==='08-snow-igloo'&&a.round===0)||widths[b.art]-widths[a.art]);
 for(const {round,artIndex,art}of order){
  const width=widths[art],polar=art==='08-snow-igloo'&&round===0;let accepted=false;
  for(let tries=0;tries<80000;tries++){
   const lon=(rand()*2-1)*Math.PI;
   const lat=polar?(tries<30000?64+rand()*7:52+rand()*19)*Math.PI/180:Math.asin((rand()*2-1)*Math.sin(Math.PI/3));
   const p=sphereFrame(lon,lat).center;
   if(placements.some(i=>art===i.art&&angle(p,i.shape.center)*R<8000))continue;
   if(WORLD_ISLANDS.some(i=>{const q=localPoint(i.id,p);return mapOf(i.id).landAt(q.x,q.y);}))continue;
   const row={id:`sea-${artIndex+1}-${round+1}`,art,artIndex,lon,lat,width},shape=layoutIslet(row),rings=isletShores(shape);
   if(shores.some(s=>!clear(rings,s)))continue;
   if(placements.some(i=>!clear(rings,i.rings)))continue;
   const hull=flat(shape),artBox=drawing(shape);
   if(coastsIn(shape.home).some(s=>flatRingGap(hull,s,BOAT_CHANNEL)<BOAT_CHANNEL||flatRingGap(artBox,s,1)<1))continue;
   if(placements.some(i=>[shape.home,i.shape.home].some(chart=>flatRingGap(flat(shape,chart),flat(i.shape,chart),BOAT_CHANNEL)<BOAT_CHANNEL)))continue;
   placements.push({...row,shape,rings});console.log(`Seed ${seed}: placed ${row.id} (${placements.length}/11)`);accepted=true;break;
  }
  if(!accepted){console.log(`Seed ${seed}: no room for ${art}/${round} after ${placements.length} placements`);return null;}
 }
 return placements.sort((a,b)=>a.id.endsWith('-2')-b.id.endsWith('-2')||a.artIndex-b.artIndex).map(({shape,rings,...i})=>i);
}
const requested=Number(process.argv[2]??ISLET_BASE_SEED);let result=null,seed=requested;
for(let distance=0;distance<=100&&!result;distance++)for(const candidate of distance?[requested-distance,requested+distance]:[requested]){
 result=place(candidate);if(result){seed=candidate;break;}
}
if(!result)throw Error('No safe 3x islet layout within 100 seeds of the requested seed');
writeFileSync('src/pixi/islets-data.json',JSON.stringify({seed,scale:ISLET_SCALE,placements:result},null,2)+'\n');
console.log(`Placed ${result.length} islets at ${ISLET_SCALE}x with seed ${seed}`);
