// Measure the actual rendered sandy polygons over new dry land, including squares.
import fs from 'node:fs';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {read,write} from './design.mjs';
import {pathD} from './fix-geometry.mjs';
const S='scripts/bigger-fair/',world=read('assets/world/themes/fair/world.json'),old=read(S+'original-world.json');
const sample=process.argv[2]||'after',file=process.argv[3]||'public/pixi-art/themes/fair/bigger/ground-0-0.svg';
const source=fs.readFileSync(file,'utf8');
const shapes=[...source.matchAll(/<path d="([^"]+)" fill="#F3DF98" stroke="none"\/>/g)].map(m=>m[1]);
assert(shapes.length,'no road polygons found');
const poly=(d,color)=>`<path d="${d}" fill="${color}"/>`;
const outer=poly(pathD(world.coast),'white'),cut=poly(pathD(old.coast),'black')+world.water.map(w=>w.poly?poly(pathD(w.poly),'black'):`<ellipse cx="${w.x}" cy="${w.y}" rx="${w.rx}" ry="${w.ry}" fill="black"/>`).join('');
const raster=async body=>sharp(Buffer.from(`<svg width="3000" height="2050" viewBox="-2500 -1800 12000 8200" xmlns="http://www.w3.org/2000/svg"><rect x="-2500" y="-1800" width="12000" height="8200" fill="black"/>${body}</svg>`)).removeAlpha().raw().toBuffer();
const mask=await raster(outer+cut),road=await raster(shapes.map(d=>poly(d,'white')).join(''));
let dry=0,sand=0;for(let i=0;i<mask.length;i+=3){if(mask[i]<128)continue;dry++;if(road[i]>=128)sand++;}
const result={sample,method:'Union of actual sandy SVG road and square polygons at one sample per 4 world units; clipped to expanded coastline, excluding original coast and all inland water. Community squares count as road, beaches and original paths excluded.',roadPolygons:shapes.length,newDryArea:dry*16,sandyArea:sand*16,roadAreaPercent:+(sand/dry*100).toFixed(2)};
write(S+'dense-area-'+sample+'.json',result);console.log(result);
if(sample==='after')assert(result.roadAreaPercent<25);
