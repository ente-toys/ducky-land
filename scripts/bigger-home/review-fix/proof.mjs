import {execFileSync} from 'node:child_process';
import {writeFileSync,readFileSync} from 'node:fs';
import sharp from 'sharp';
const O='../concepts/themes/world-map/bigger',script='scripts/bigger-home/review-fix/render.mjs';
const at=([x,y])=>[(x-278)/.18,(y-204)/.18];
execFileSync(process.execPath,[script],{stdio:'inherit'});
execFileSync(process.execPath,[script],{env:{...process.env,HOME_PRESERVE:'1'},stdio:'inherit'});
const P=JSON.parse(readFileSync('scripts/bigger-home/communities/plan.json'));
const crops=[['bridge-over-river',[876,846]],['road-junction',[303,322]],['village-lane',[307,177]],['community',[215,220]],['millrill',[1310,430]],['fishing-pier',[1014,1210]],['cider-common',[132,476]],...P.communities.slice(1).map(c=>[c.id,c.crop])];
for(const[name,p]of crops)execFileSync(process.execPath,[script],{env:{...process.env,HOME_CROP:[...at(p),.8].join(','),HOME_CROP_NAME:name},stdio:'inherit'});
writeFileSync(O+'/home-fix-work/crops.json',JSON.stringify(crops.map(([name,p])=>({name,center:at(p),pixelsPerWorldUnit:.8,width:1400,height:1000})),null,2));
const label=(w,text)=>Buffer.from(`<svg width="${w}" height="50"><rect width="100%" height="100%" fill="#fff0c7"/><text x="24" y="33" font-family="Arial" font-size="23" fill="#39472d">${text}</text></svg>`);
await sharp({create:{width:3200,height:1250,channels:4,background:'#6ec9de'}}).composite([
 {input:label(1600,'BEFORE / Home communities'),left:0,top:0},{input:O+'/home-built.png',left:0,top:50},
 {input:label(1600,'AFTER / rivers, raised paths, useful commons, individual homes'),left:1600,top:0},{input:O+'/home-fixed.png',left:1600,top:50}
]).png().toFile(O+'/home-fixed-before-after.png');
await sharp({create:{width:3600,height:1050,channels:4,background:'#fff0c7'}}).composite([
 {input:label(800,'CURSOR CAMP / visual reference'),left:0,top:0},{input:O+'/../cursor-camp-paths-ref.jpg',left:0,top:190},
 {input:label(1400,'HOME ROAD JUNCTION / 0.8 px per unit'),left:800,top:0},{input:O+'/home-fixed-crops/road-junction.png',left:800,top:50},
 {input:label(1400,'HOME LANE / 0.8 px per unit'),left:2200,top:0},{input:O+'/home-fixed-crops/village-lane.png',left:2200,top:50}
]).png().toFile(O+'/home-fixed-paths-vs-reference.png');
