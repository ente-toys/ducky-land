// Raster union measurement of authored sand, commons paths, front walks and bridge decks.
// Both rounds use the same 20-world-unit grid and newly added dry-land mask.
import fs from 'node:fs';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {render} from './render.mjs';
import {OUT,original,read,ART,rings,pathRing,places,commons,homes} from './model.mjs';
import {roadSamples} from './ground.mjs';
import {water,crossings} from './waterways.mjs';
import {geometry} from '../../assets/world/island-geometry.mjs';
const baseline=read('scripts/bigger-library/dense-baseline.json');
const scale=.05,W=700,H=520;
const raster=async body=>sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="-3000 -2200 14000 10400" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`)).ensureAlpha().raw().toBuffer();
const polygon=(p,color='white')=>`<path d="${pathRing(p)}" fill="${color}"/>`;
const land=await raster(rings.map(r=>polygon(r)).join('')+original.world.coastRings.map(r=>polygon(r,'black')).join('')+water.map(w=>polygon(w.poly,'black')).join(''));
function sand(round){let s=round.roadSamples.map(r=>polygon(r.bank)).join('');
 for(const c of round.commons){const{x,y,rx,ry}=c;s+=`<path d="M${x-rx*.8} ${y+ry*.65}Q${x} ${y+ry*.4} ${x+rx*.75} ${y+ry*.7}" stroke="white" stroke-width="80" fill="none"/>`;}
 for(const h of round.homes){const{x,y}=h;s+=`<path d="M${x-43} ${y-10}Q${x-40} ${y+70} ${x-65} ${y+157}H${x+57}Q${x+36} ${y+70} ${x+43} ${y-10}" fill="white"/>`;}
 for(const z of places){const x=z.x,y=z.y+300;s+=`<path d="M${x-230} ${y-45}Q${x-270} ${y-200} ${x-60} ${y-220}Q${x+220} ${y-200} ${x+235} ${y+30}Q${x+150} ${y+220} ${x-90} ${y+190}Q${x-220} ${y+160} ${x-230} ${y-45}Z" fill="white"/>`;}
 for(const c of crossings)s+=`<rect x="${c.x-c.length/2}" y="${c.y-c.width/2}" width="${c.length}" height="${c.width}" transform="rotate(${c.angle*180/Math.PI} ${c.x} ${c.y})" fill="white"/>`;
 return s;
}
const masks=await Promise.all([raster(sand(baseline)),raster(sand({roadSamples,homes,commons}))]);
let denominator=0,before=0,after=0;for(let i=0;i<land.length;i+=4)if(land[i]>127&&land[i+3]>127){denominator++;if(masks[0][i]>127&&masks[0][i+3]>127)before++;if(masks[1][i]>127&&masks[1][i+3]>127)after++;}
const roadArea={method:'Union of sand carriageways, household front walks, square paving, common footpaths and unchanged bridge decks, sampled at 20 world units; excludes raised grassy banks. Denominator is added dry land, excluding original island and rivers.',sampleCellWorldUnits:20,newDryLandArea:denominator/scale**2,beforeArea:before/scale**2,afterArea:after/scale**2,beforePercent:100*before/denominator,afterPercent:100*after/denominator,reductionPercent:100*(before-after)/before};
const compactness=places.map(p=>{function metric(list){const a=list.filter(h=>h.zone===p.id);let nearest=a.map(h=>Math.min(...a.filter(j=>j!==h).map(j=>Math.hypot(j.x-h.x,j.y-h.y))));return{meanNearestHome:nearest.reduce((s,n)=>s+n,0)/a.length,homeCentreBoundsArea:(Math.max(...a.map(h=>h.x))-Math.min(...a.map(h=>h.x)))*(Math.max(...a.map(h=>h.y))-Math.min(...a.map(h=>h.y)))};}return {community:p.name,before:metric(baseline.homes),after:metric(homes)};});
const world=read('assets/world/themes/library/world.json'),walk=read('assets/world/themes/library/walk-world.json');
const result={roadArea,compactness,bridges:crossings.length,preserved:{waterMatchesWalk:JSON.stringify(world.water)===JSON.stringify(walk.water),coastRingsMatchAuthoring:JSON.stringify(world.coastRings)===JSON.stringify(rings),originalProps:JSON.stringify(read(ART+'art.json').props.slice(0,original.art.props.length))===JSON.stringify(original.art.props)}};
fs.mkdirSync(OUT+'/library-dense-crops',{recursive:true});
fs.writeFileSync(OUT+'/library-dense.png',await render({built:true}));
for(const z of places)fs.writeFileSync(`${OUT}/library-dense-crops/${z.id}.png`,await render({built:true,crop:{x:z.x,y:{quillwick:950,inkleaf:1300,bedtime:5200,paperboat:5450}[z.id],k:.8,w:2900,h:3000}}));
for(const c of [{id:'main-road',x:-1140,y:2950},{id:'shared-gardens',x:-1600,y:1310}])fs.writeFileSync(`${OUT}/library-dense-crops/${c.id}.png`,await render({built:true,crop:{...c,k:.8,w:1500,h:1200}}));
fs.writeFileSync('scripts/bigger-library/dense-proof.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
assert(roadArea.afterPercent<25,'roads below one quarter of added dry land');
assert(roadArea.afterPercent<roadArea.beforePercent,'roads reduced');
assert(Object.values(result.preserved).every(Boolean),'preserved island contract');
