// Offline proof from the production SVG manifest, with reproducible road coverage.
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {bounds,coast,roads,courts,rivers,bridges,communities} from './plan.mjs';
import {j,json,output,base,renderArt,roadBody,d,ribbon} from './scene.mjs';
const before=j('scripts/bigger-snow/dense-before.json');
const world=j('assets/world/themes/snow/world.json'),art=j('public/pixi-art/themes/snow/art.json');
assert.deepEqual(coast,before.coast);
assert.deepEqual(rivers,before.rivers);
assert.deepEqual(bridges,before.bridges);
const scale=.2,W=Math.round(bounds.width*scale),H=Math.round(bounds.height*scale);
const svg=body=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}">${body}</svg>`);
const eligibility=await sharp(svg(`<path d="${d(coast,true)}" fill="white"/><path d="${d(j(base+'world.json').coast,true)}" fill="black"/>`+rivers.map(r=>`<path d="${d(ribbon(r.line,r.width),true)}" fill="black"/>`).join(''))).ensureAlpha().raw().toBuffer();
async function coverage(streets,squares){
 const mask=await sharp(svg(roadBody(undefined,streets,squares))).ensureAlpha().raw().toBuffer();
 let land=0,road=0;
 for(let i=0;i<mask.length;i+=4){const eligible=eligibility[i]/255*eligibility[i+3]/255;land+=eligible;road+=eligible*mask[i+3]/255;}
 return {dryExtensionArea:Math.round(land/scale**2),roadArea:Math.round(road/scale**2),percent:+(road/land*100).toFixed(3)};
}
const coverageBefore=await coverage(before.roads,before.courts),coverageAfter=await coverage(roads,courts);
assert.ok(coverageAfter.percent<25);
assert.ok(coverageAfter.roadArea<coverageBefore.roadArea*.7);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const facts={method:'Alpha-weighted raster union of rendered road surfaces, bank lips, ruts, pebbles and verge tufts at 0.2 px/world unit; clipped to expanded coastline, excluding original coast and river water. Overlaps counted once. Courts and rounded road caps included.',before:coverageBefore,after:coverageAfter,reductionPercent:+((1-coverageAfter.roadArea/coverageBefore.roadArea)*100).toFixed(2),mainRoadWidth:122,originalMainPathWidth:122,laneWidths:[...new Set(roads.slice(1).map(r=>r.w))],preserved:{coast:hash(coast),rivers:hash(rivers),bridges:hash(bridges)},communities:communities.map(c=>({id:c.id,name:c.name,homes:c.homes.length,homeWidths:c.homes.map(h=>h[3]),gardenBeds:c.garden.length,domesticProps:c.details.length})),newProps:art.props.length-j(base+'art.json').props.length};
json(output+'/work/snow/dense-audit.json',facts);
const preview=structuredClone(art),h=j('assets/world/themes/snow/harbor.json');
preview.decks.push({src:'/pixi-art/bridge-jetty-1.svg',x:h.jetty.foot[0]-100,y:h.jetty.foot[1]-30,width:220,height:h.jetty.tip[1]-h.jetty.foot[1]+60});
for(const v of h.boats)preview.props.push({src:'/pixi-art/boat-sail.svg',x:v.x,y:v.y+20,width:188,height:216,anchor:{x:.5,y:.82},scale:1});
writeFileSync(output+'/snow-dense.png',await renderArt(preview,{sleepers:true}));
for(const[id,x,y,width,height]of [['cocoa',-1700,1450,1560,1450],['igloo',1600,-1550,2300,1400],['makers',7400,1500,1560,1560],['harbour',3300,5600,1950,1460]]){
 writeFileSync(output+'/snow-dense-'+id+'.png',await renderArt(preview,{k:.65,x,y,width,height,sleepers:true}));
}
console.log(JSON.stringify(facts,null,2));
