// Transparent crop gutters cost GPU memory without contributing any pixels.
// Rebuild only after Fair sources or their dimensions change. Artwork is read-only.
import {readFileSync,writeFileSync} from 'node:fs';
import sharp from 'sharp';
import {cropFairSVG,FAIR_TILE_SIZE} from '../../src/pixi/fair-raster.js';
import {layers} from './model.mjs';
const art=JSON.parse(readFileSync('public/pixi-art/themes/fair/art.json')),bounds={};
for(const {p,src,kind}of layers(art).filter(l=>l.kind!=='ground')){
 const width=p.width*(p.scale??1),height=p.height*(p.scale??1),key=[src,width,height].join('|');if(bounds[key])continue;
 const W=Math.ceil(width),H=Math.ceil(height);
 const {data,info}=await sharp(Buffer.from(cropFairSVG(readFileSync('public'+src,'utf8'),[width,height,0,0,width,height]))).resize(W,H,{fit:'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const crops=[];
 for(let y=0;y<height;y+=FAIR_TILE_SIZE)for(let x=0;x<width;x+=FAIR_TILE_SIZE){
  const right=Math.min(x+FAIR_TILE_SIZE+.5,width),bottom=Math.min(y+FAIR_TILE_SIZE+.5,height);
  const x0=Math.floor(x*W/width),x1=Math.min(W,Math.ceil(right*W/width)),y0=Math.floor(y*H/height),y1=Math.min(H,Math.ceil(bottom*H/height));
  let minX=W,minY=H,maxX=-1,maxY=-1;
  for(let iy=y0;iy<y1;iy++)for(let ix=x0;ix<x1;ix++)if(data[(iy*info.width+ix)*4+3]){minX=Math.min(minX,ix);maxX=Math.max(maxX,ix);minY=Math.min(minY,iy);maxY=Math.max(maxY,iy);}
  if(maxX<0)continue;
  const left=Math.max(x,Math.floor(minX*width/W)-2),top=Math.max(y,Math.floor(minY*height/H)-2);
  crops.push([left,top,Math.min(right,Math.ceil((maxX+1)*width/W)+2)-left,Math.min(bottom,Math.ceil((maxY+1)*height/H)+2)-top]);
 }
 bounds[key]=crops;
}
writeFileSync('src/pixi/fair-raster-bounds.json',JSON.stringify(bounds)+'\n');console.log(`${Object.keys(bounds).length} Fair SVG/size crop plans`);
