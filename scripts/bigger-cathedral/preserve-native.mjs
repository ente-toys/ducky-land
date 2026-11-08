import fs from 'node:fs';
import sharp from 'sharp';
import {render} from './render.mjs';
import {path,el,svg} from './design.mjs';
const read=p=>JSON.parse(fs.readFileSync(p)),B='scripts/bigger-cathedral/baseline/';
const before=read(B+'art.json'),after=read('public/pixi-art/themes/cathedral/art.json'),world=read(B+'world.json');
const inner=world.coast.map(([x,y])=>[4100+(x-4100)*.994,2800+(y-2800)*.994]);
const shape=path(inner,'white')+world.islets.map(([x,y,rx,ry])=>el(x,y,rx-15,ry-15,'white')).join('');
let compared=0,changed=0,maxDelta=0;const chunks=[];
for(let y=0;y<6000;y+=1500)for(let x=0;x<8000;x+=1600){
 const opts={x,y,k:1,width:1600,height:1500};
 const mask=await sharp(Buffer.from(svg(1600,1500,shape,`${x} ${y} 1600 1500`))).ensureAlpha().raw().toBuffer();
 if(!mask.some((v,i)=>i%4===3&&v===255))continue;
 const a=await sharp(await render(before,{...opts,original:true})).ensureAlpha().raw().toBuffer();
 const b=await sharp(await render(after,opts)).ensureAlpha().raw().toBuffer();
 let count=0,diff=0;
 for(let i=0;i<a.length;i+=4)if(mask[i+3]===255){compared++;count++;let d=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]),Math.abs(a[i+3]-b[i+3]));maxDelta=Math.max(maxDelta,d);if(d){changed++;diff++;}}
 chunks.push({x,y,compared:count,changed:diff});console.log(x,y,count,diff);
}
const result={scale:1,compared,changed,maxChannelDelta:maxDelta,chunks,mask:'Original coast inset 0.6 percent, original islets inset 15 units; native texture pixels. No post-render restoration. Every original prop and flat is included in both independent renders.'};
fs.writeFileSync('scripts/bigger-cathedral/preservation-native.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({compared,changed,maxDelta}));if(changed)process.exitCode=1;
