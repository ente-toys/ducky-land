import fs from 'node:fs';import sharp from 'sharp';import {render,OUT} from './render.mjs';import {inPoly} from '../../assets/world/island-geometry.mjs';
const read=p=>JSON.parse(fs.readFileSync(p)),S='scripts/bigger-community/',A='public/pixi-art/themes/community/',D='assets/world/themes/community/',a=read(A+'art.json'),h=read(D+'harbor.json'),p=read(S+'plan.json'),B=S+'baseline/';
await render(a,h,OUT+'/community-built.png');
await render(a,h,OUT+'/community-built-labelled.png',{labels:p.communities});
for(const c of p.communities)await render(a,h,OUT+'/community-crops/'+c.id+'.png',{crop:[c.x,c.y,.8]});
await render(a,h,OUT+'/community-crops/lanternloaf-bakehouse.png',{crop:[8350,5300,.8]});
await render(a,h,OUT+'/community-crops/storynest-homes.png',{crop:[500,250,.8]});
await render(a,h,OUT+'/community-crops/patchwing-workshop.png',{crop:[7900,2320,.8]});
await render(a,h,OUT+'/community-crops/road-junction.png',{crop:[4000,100,.8]});
await render(a,h,OUT+'/community-crops/residential-lane.png',{crop:[7800,890,.8]});
await render(a,h,OUT+'/community-crops/open-common.png',{crop:[4400,-250,.8]});
const labels=['DRAWING / four named communities','BUILT / production SVGs'],layers=[];
for(let i=0;i<2;i++){layers.push({input:OUT+'/'+['community-communities.png','community-built.png'][i],left:1800*i,top:50});layers.push({input:Buffer.from(`<svg width="1800" height="50"><rect width="1800" height="50" fill="#fff0c7"/><text x="25" y="33" font-family="Arial" font-size="23" fill="#39472d">${labels[i]}</text></svg>`),left:1800*i,top:0});}
await sharp({create:{width:3600,height:1400,channels:4,background:a.sea}}).composite(layers).png().toFile(OUT+'/community-vs-communities.png');
const ref=await sharp(OUT+'/../cursor-camp-paths-ref.jpg').resize(800,600).png().toBuffer();
const junction=await sharp(OUT+'/community-crops/road-junction.png').resize(830,600,{fit:'cover'}).png().toBuffer(),lane=await sharp(OUT+'/community-crops/residential-lane.png').resize(830,600,{fit:'cover'}).png().toBuffer();
await sharp({create:{width:2460,height:650,channels:4,background:'#FFF0C7'}}).composite([{input:ref,left:0,top:50},{input:junction,left:800,top:50},{input:lane,left:1630,top:50},{input:Buffer.from('<svg width="2460" height="50"><g font-family="Arial" font-size="21" fill="#39472D"><text x="20" y="33">Cursor Camp reference, study only</text><text x="820" y="33">Our main-road junction</text><text x="1650" y="33">Our residential lane</text></g></svg>'),left:0,top:0}]).png().toFile(OUT+'/community-paths-comparison.png');
const framing={crop:[4000,2900,.2]},before=OUT+'/community-crops/preservation-before.png',after=OUT+'/community-crops/preservation-after.png';const f=await render(read(B+'art.json'),{...read(B+'harbor.json'),boats:[]},before,framing);await render(a,{...h,boats:[]},after,framing);
const b=await sharp(before).ensureAlpha().raw().toBuffer(),c=await sharp(after).ensureAlpha().raw().toBuffer(),coast=read(B+'world.json').coast;let protectedPixels=0,changed=0,maxDelta=0,overTwo=0;const examples=[];
for(let y=0;y<f.H;y++)for(let x=0;x<f.W;x++){const wx=(x-f.ox)/f.k,wy=(y-f.oy)/f.k;if(![[0,0],[-20,0],[20,0],[0,-20],[0,20]].every(([dx,dy])=>inPoly(wx+dx,wy+dy,coast)))continue;protectedPixels++;const i=(y*f.W+x)*4;let d=0;for(let j=0;j<4;j++)d=Math.max(d,Math.abs(b[i+j]-c[i+j]));if(d){changed++;maxDelta=Math.max(maxDelta,d);if(d>2)overTwo++;if(examples.length<12)examples.push([wx,wy,...b.subarray(i,i+3),...c.subarray(i,i+3)]);}}
const result={protectedPixels,changed,maxDelta,overTwo,examples,mooringExclusion:'Refitted boats are excluded from both preservation renders. All original static art and sleepers remain included.',comparison:'Production SVG assembly at 0.2 px/unit, original coast inset 20 world units. No restored pixels.'};fs.writeFileSync(S+'pixel-validation.json',JSON.stringify(result,null,2)+'\n');console.log(result);
