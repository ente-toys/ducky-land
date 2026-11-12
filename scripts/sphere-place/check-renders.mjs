import sharp from 'sharp';
import {writeFileSync} from 'node:fs';
const out='../concepts/themes/world-map/sphere',results=[];
for(const name of ['front','back','left','right','top','bottom']){
 const {data,info}=await sharp(`${out}/${name}.png`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const {width:W,height:H}=info,mask=new Uint8Array(W*H);let clusters=0;
 for(let y=65;y<H-65;y++)for(let x=5;x<W-5;x++){
  if(Math.hypot(x-W/2,y-H/2)<=465)continue;
  const i=(y*W+x)*4;
  if(Math.abs(data[i]-18)+Math.abs(data[i+1]-23)+Math.abs(data[i+2]-56)>30)mask[y*W+x]=1;
 }
 for(let y=68;y<H-68;y++)for(let x=8;x<W-8;x++)if(mask[y*W+x]){
  let n=0;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)n+=mask[(y+dy)*W+x+dx];if(n>=15)clusters++;
 }
 results.push({view:name,offSphereClusterPixels:clusters});
 if(clusters>0)process.exitCode=1;
}
writeFileSync(`${out}/exterior-check.json`,JSON.stringify({kind:'Offscreen shader render, not browser',results},null,2)+'\n');console.log(JSON.stringify(results));
