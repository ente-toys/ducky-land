import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
export async function homeWaterMask(root){
 const world=JSON.parse(await fs.readFile(path.join(root,'assets/world/world.json'))),art=JSON.parse(await fs.readFile(path.join(root,'src/world/home/art-manifest.json'))),p=world.water[0];
 const rect={x:p.x-p.rx-35,y:p.y-p.ry-35,width:p.rx*2+70,height:p.ry*2+70},width=Math.ceil(rect.width*1.2),height=Math.ceil(rect.height*1.2),parts=[];
 for(const t of art.ground.tiles){if(t.x>=rect.x+rect.width||t.y>=rect.y+rect.height||t.x+t.width<=rect.x||t.y+t.height<=rect.y)continue;const text=await fs.readFile(path.join(root,'public',t.src),'utf8');parts.push(text.replace('<svg ',`<svg x="${t.x}" y="${t.y}" `).replace(/width="[^"]*"/,`width="${t.width}"`).replace(/height="[^"]*"/,`height="${t.height}"`));}
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${rect.x} ${rect.y} ${rect.width} ${rect.height}">${parts.join('')}</svg>`;
 const data=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();for(let i=0;i<data.length;i+=4){const yes=data[i+2]>130&&data[i+2]>data[i]*1.3&&data[i+1]>data[i]*1.2;data[i]=yes?255:0;data[i+1]=data[i+2]=0;data[i+3]=255;}
 const bytes=await sharp(data,{raw:{width,height,channels:4}}).png().toBuffer(),url=`art-prerender/ground-home-pond-${createHash('sha256').update(bytes).digest('hex').slice(0,20)}.png`;
 return {bytes,url,rect,width,height};
}
