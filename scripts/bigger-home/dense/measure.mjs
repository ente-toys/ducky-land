// Road union measured from the actual production sand outline, including its raised bank lip.
// Count raster coverage at one drawing pixel = 1/.18 world units. Same dry-land mask both times.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {inPoly} from '../../../rive/web/island-geometry.mjs';
const O='../concepts/themes/world-map/bigger/home-dense-work';mkdirSync(O,{recursive:true});
const read=p=>JSON.parse(readFileSync(p)),B=read('scripts/bigger-home/dense/before.json'),E=read('src/pixi/home-expansion.json');
for(const p of E.props.slice(B.props.length))assert.ok(inPoly(p.x,p.y,E.coast),p.id+' new garden prop stays on land');
for(const k of ['coast','origin','width','height','decks','walkways','rivers','riverWater','riverBridges','crossings','arches','boats','jetty','harborWater','openSpaces','commons'])assert.deepEqual(E[k],B[k],k+' preserved');
const at=p=>[p[0]*.18+278,p[1]*.18+204],poly=p=>'M'+p.map(v=>v.join(',')).join('L')+'Z';
const protectedCoast=read('../concepts/themes/world-map/bigger/work/original-walk-world.json').coast.map(at);
const vb=[278+E.origin.x*.18,204+E.origin.y*.18,E.width*.18,E.height*.18],W=1980,H=1485;
const wrap=body=>`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${vb.join(' ')}">${body}</svg>`;
const water=[...E.riverWater.map(r=>r.poly.map(at)),E.water.poly.map(at)];
const before=readFileSync('scripts/bigger-home/dense/before-ground.svg','utf8'),after=readFileSync('public'+E.tiles[0].src,'utf8');
writeFileSync(O+'/baseline-ground-full.svg',before.replace(/<svg[^>]*>/,`<svg xmlns="http://www.w3.org/2000/svg" width="${E.width}" height="${E.height}" viewBox="${vb.join(' ')}">`));
const coast=after.match(/<clipPath id="community-land"><path d="([^"]+)"/)[1];
const dry=`<path d="${coast}" fill="white"/><path d="${poly(protectedCoast)}" fill="black"/>${water.map(p=>`<path d="${poly(p)}" fill="black" stroke="black" stroke-width=".3"/>`).join('')}`;
const mask=`<defs><mask id="dry" maskUnits="userSpaceOnUse" x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}">${dry}</mask></defs>`;
const raster=async body=>sharp(Buffer.from(wrap(body))).ensureAlpha().raw().toBuffer();
const count=buf=>{let n=0;for(let i=0;i<buf.length;i+=4)if(buf[i]>=128&&buf[i+3]>=128)n++;return n;};
const land=count(await raster(mask+`<rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="white" mask="url(#dry)"/>`));
const report={method:'Rendered union of actual sand road and square outlines plus the 7-drawing-pixel raised bank lip; excludes protected original Home, river water and makers pond. Fixed 1980 x 1485 raster; threshold 128/255. One drawing pixel = 5.556 world units.',newDryLandPixels:land,stages:{},householdDistance:{}};
for(const [name,src]of [['before',before],['after',after]]){
 const g=src.match(/<g fill="#f4df91">([\s\S]*?)<\/g>/)[1];
 const body=mask+`<g mask="url(#dry)" fill="white" stroke="white" stroke-width="7" stroke-linejoin="round">${g}</g>`;
 const buf=await raster(body),n=count(buf);
 const file=O+`/road-mask-${name}.png`;await sharp(Buffer.from(wrap(body))).png().toFile(file);
 report.stages[name]={roadAndSquarePixels:n,percent:n/land*100};
}
for(const c of E.communities){const b=B.communities.find(v=>v.id===c.id),distance=(data,community)=>community.homes.reduce((s,id)=>{const p=data.props.find(p=>p.id===id);return s+Math.hypot(p.x-community.center[0],p.y-community.center[1]);},0)/community.homes.length;
 const before=distance(B,b),after=distance(E,c);report.householdDistance[c.id]={meanWorldDistanceToSquareBefore:before,meanWorldDistanceToSquareAfter:after,reductionPercent:(before-after)/before*100};}
report.roadReductionPercent=(report.stages.before.roadAndSquarePixels-report.stages.after.roadAndSquarePixels)/report.stages.before.roadAndSquarePixels*100;
assert.ok(report.stages.after.percent<20,'road coverage stays well under a quarter including banks');
assert.ok(report.stages.after.percent<report.stages.before.percent,'road area decreased');
for(const c of Object.values(report.householdDistance))assert.ok(c.reductionPercent>0,'each community clusters closer');
writeFileSync(O+'/metrics.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
