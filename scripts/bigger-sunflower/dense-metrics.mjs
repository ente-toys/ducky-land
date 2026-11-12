import sharp from 'sharp';
import {readFileSync} from 'node:fs';
import {inPoly,inShape} from '../../assets/world/island-geometry.mjs';
export async function roadCoverage(svg,world){
 const original=JSON.parse(readFileSync('scripts/bigger-sunflower/baseline/world.json'));
 const shapes=svg.match(/<clipPath id="roads">([\s\S]*?)<\/clipPath>/)[1];
 const width=2400,height=1680,k=.2;
 const wet=world.water.slice(original.water.length).map(w=>({w,x0:Math.min(...w.poly.map(p=>p[0])),x1:Math.max(...w.poly.map(p=>p[0])),y0:Math.min(...w.poly.map(p=>p[1])),y1:Math.max(...w.poly.map(p=>p[1]))}));
 const mask=await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="-2000 -1400 12000 8400"><g fill="white" stroke="white" stroke-width="31" stroke-linejoin="round">${shapes}</g></svg>`)).ensureAlpha().raw().toBuffer();
 let dry=0,road=0;
 for(let j=0;j<height;j++)for(let i=0;i<width;i++){
  const x=-2000+(i+.5)/k,y=-1400+(j+.5)/k;
  if(!inPoly(x,y,world.coast)||inPoly(x,y,original.coast)||original.islets.some(([cx,cy,rx,ry])=>((x-cx)/rx)**2+((y-cy)/ry)**2<=1))continue;
  if(wet.some(b=>x>=b.x0&&x<=b.x1&&y>=b.y0&&y<=b.y1&&inShape(x,y,b.w)))continue;
  dry++;if(mask[(j*width+i)*4+3]>=128)road++;
 }
 return {newDryLandWorldUnits2:dry/k**2,roadWorldUnits2:road/k**2,roadPercent:road/dry*100,sampleWorldUnits:1/k,includes:'Union of roads, short lanes, porch links, shared sand courts and all bank outlines; excludes original land, islets and water. Household garden paths and the outer beach are not road network.'};
}
export function clusterMetrics(communities){return communities.map(c=>({id:c.id,homes:c.homes.length,meanNearestNeighbour:Math.round(c.homes.reduce((s,p,i)=>s+Math.min(...c.homes.filter((_,j)=>i!==j).map(q=>Math.hypot(p[0]-q[0],p[1]-q[1]))),0)/c.homes.length),spanX:Math.max(...c.homes.map(p=>p[0]))-Math.min(...c.homes.map(p=>p[0])),spanY:Math.max(...c.homes.map(p=>p[1]))-Math.min(...c.homes.map(p=>p[1]))}));}
