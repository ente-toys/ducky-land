import fs from 'node:fs';
import sharp from 'sharp';
import {svg,path,el,roadShape,coast} from './design.mjs';
const read=p=>JSON.parse(fs.readFileSync(p)),base='scripts/bigger-cathedral/';
const old=read(base+'baseline/world.json'),water=read(base+'fix-water.json');
const k=.25,width=3200,height=2600,box='-2200 -2400 12800 10400';
const protectedLand=path(old.coast,'black')+old.islets.map(([x,y,rx,ry])=>el(x,y,rx,ry,'black')).join('');
const wet=water.outlines.map(p=>path(p,'black')).join('');
const defs=`<defs><mask id="dry"><rect x="-2200" y="-2400" width="12800" height="10400" fill="white"/>${protectedLand}${wet}</mask><clipPath id="land">${path(coast,'white')}</clipPath></defs>`;
async function count(body){const pixels=await sharp(Buffer.from(svg(width,height,defs+`<g clip-path="url(#land)" mask="url(#dry)">${body}</g>`,box))).ensureAlpha().raw().toBuffer();let n=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>=128)n++;return n/(k*k);}
const newDryLandArea=await count(path(coast,'white'));
const result={method:'Raster union at 4 world units/pixel. Sandy roads plus dark bank lip and community squares, clipped to dry extension. Excludes original island and water. Road numerator excludes the coastal beach; dry extension denominator includes that beach. Area is not the sum of overlapping road ribbons.',newDryLandArea};
for(const [name,file]of [['before','dense-before/plan.json'],['after','plan.json']]){const plan=read(base+file);const body=plan.roads.map(r=>path(roadShape(r).poly,'white','white',13)).join('')+plan.communities.map(c=>el(c.x,c.y,315,212,'white')).join('');let roadArea=await count(body);result[name]={roadArea,roadAreaPercent:100*roadArea/newDryLandArea,roadLength:plan.roads.reduce((n,r)=>{let p=roadShape(r).p;return n+p.slice(1).reduce((s,b,i)=>s+Math.hypot(b[0]-p[i][0],b[1]-p[i][1]),0)},0)};}
result.reductionPercent=100*(1-result.after.roadArea/result.before.roadArea);
fs.writeFileSync(base+'dense-metrics.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
