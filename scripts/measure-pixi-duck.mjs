import {readFileSync} from 'node:fs';
import {createCanvas,loadImage} from '@napi-rs/canvas';
const views=JSON.parse(readFileSync(0,'utf8'));
const result={};
for(const view of views){
 const part=view.parts.find(p=>p.role==='body'),canvas=createCanvas(part.rect[2],part.rect[3]),ctx=canvas.getContext('2d');
 ctx.drawImage(await loadImage(new URL(`../public${part.url}`,import.meta.url)),0,0);
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
 const scan=y=>{let left=Infinity,right=-Infinity;for(let x=0;x<canvas.width;x++)if(pixels[(Math.round(y-part.rect[1])*canvas.width+x)*4+3]>128){left=Math.min(left,x+part.rect[0]);right=Math.max(right,x+part.rect[0]);}return [left-view.ground[0],right-view.ground[0]];};
 result[view.angle]={head:scan(150),neckTop:scan(282),neckBottom:scan(320),neckY:282-view.ground[1],headY:part.bounds[1]-view.ground[1]};
}
process.stdout.write(JSON.stringify(result));
