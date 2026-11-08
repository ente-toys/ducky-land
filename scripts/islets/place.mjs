import {writeFileSync,readFileSync} from 'node:fs';
import {WORLD_ISLANDS,WORLD_GEO,neighboursOf} from '../../src/pixi/world-map.js';
import {sphereShores} from '../../src/pixi/sphere-shores.js';
import {sphereFrame,arcDistance,angle,expMap} from '../../src/pixi/sphere.js';
import {mapOf} from '../../src/pixi/island-maps.js';
import {localPoint,spherePoint} from '../../src/pixi/sphere-coordinates.js';
const ART=['odyssey','tree-and-rowboat','broken-shipwreck','04-small-mountain','05-lighthouse-rock','06-palm-treasure','07-pink-blossom','08-snow-igloo','09-spooky-purple','11-volcano','12-coral-atoll'];
// boss 8 Nov 16:55: islets ~1.7x bigger (width 1000-2400) so they read from the globe
const R=WORLD_GEO.Rw,SEED=831511;let seed=SEED;
const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const shores=WORLD_ISLANDS.flatMap(i=>sphereShores(i));
// Protect the centre of every linked harbour corridor, including tight channels.
const routes=[];for(const i of WORLD_ISLANDS)for(const {island:j}of neighboursOf(i.id))if(i.id<j.id)routes.push([spherePoint(i.id,mapOf(i.id).HARBOR.water),spherePoint(j.id,mapOf(j.id).HARBOR.water)]);
const placements=[];
for(let round=0;round<2;round++)for(const [artIndex,art]of ART.entries()){
 let accepted=false;
 const polar=art==='08-snow-igloo'&&round===0;
 // The polar igloo sits off Iceland's coast at 64-71N. On a smaller globe that coast can cover the band; only then does it
 // search further south (down to 52N), so a layout with room there keeps exactly the islets it had.
 for(let tries=0;tries<(polar?60000:80000);tries++){
  const lon=(rand()*2-1)*Math.PI;
  const lat=polar?(tries<30000?64+rand()*7:52+rand()*19)*Math.PI/180:Math.asin((rand()*2-1)*Math.sin(60*Math.PI/180));
  const width=Math.round(polar?600+rand()*800:1000+rand()*1400),rotation=(rand()-.5)*.48,frame=sphereFrame(lon,lat,rotation),p=frame.center;
  const required=900+width*.71;
  if(WORLD_ISLANDS.some(i=>{const q=localPoint(i.id,p);return mapOf(i.id).landAt(q.x,q.y);}))continue;
  if(shores.some(s=>{
   if((angle(p,s.center)-s.radius)*R>required)return false;
   return s.points.some((a,k)=>arcDistance(p,a,s.points[(k+1)%s.points.length])*R<required);
  }))continue;
  if(routes.some(([a,b])=>arcDistance(p,a,b)*R<width*.71+650))continue;
  if(placements.some(i=>angle(p,sphereFrame(i.lon,i.lat).center)*R<(art===i.art?8000:2000)+(width+i.width)/2))continue;
  placements.push({id:`sea-${artIndex+1}-${round+1}`,art,artIndex,lon,lat,width,rotation});accepted=true;break;
 }
 if(!accepted)throw Error(`No safe placement for ${art}/${round}`);
}
// boss 8 Nov (hand-drawn islets): the spots above stay exactly where the seed put them. Each islet is then drawn at the width
// its art was made for (public/pixi-art/islets/<art>.meta.json designWidth), so its ink and props match the Home centre, and
// islets.js stands it upright in its home island's view, so no roll is kept.
for(const p of placements){p.width=JSON.parse(readFileSync(`public/pixi-art/islets/${p.art}.meta.json`,'utf8')).designWidth;delete p.rotation;}
// The new 1024-wide volcano needs 9 more units than the old 1015-wide drawing.
placements.find(p=>p.id==='sea-10-2').lon+=.004;
writeFileSync('src/pixi/islets-data.json',JSON.stringify({seed:SEED,placements},null,2)+'\n');
console.log(`Placed ${placements.length} islets with seed ${SEED}`);
